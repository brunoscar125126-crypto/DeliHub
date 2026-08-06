const axios = require('axios');
const prisma = require('./prisma');

// Margem de segurança: renova o token um pouco antes da expiração real,
// pra nunca correr o risco de disparar uma chamada com token vencido.
const REFRESH_BUFFER_MS = 30 * 1000;

/**
 * Busca um novo access token do iFood (OAuth2 client_credentials).
 * Doc: POST /authentication/v1.0/oauth/token
 */
async function fetchIfoodToken() {
  const { IFOOD_CLIENT_ID, IFOOD_CLIENT_SECRET } = process.env;
  if (!IFOOD_CLIENT_ID || !IFOOD_CLIENT_SECRET) {
    throw new Error('Credenciais do iFood ausentes: defina IFOOD_CLIENT_ID e IFOOD_CLIENT_SECRET');
  }

  const body = new URLSearchParams({
    grantType: 'client_credentials',
    clientId: IFOOD_CLIENT_ID,
    clientSecret: IFOOD_CLIENT_SECRET,
  });

  const { data } = await axios.post(
    'https://merchant-api.ifood.com.br/authentication/v1.0/oauth/token',
    body.toString(),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  );

  // expiresIn vem em segundos (~6h)
  const expiresAt = new Date(Date.now() + Number(data.expiresIn) * 1000);
  return { token: data.accessToken, expiresAt };
}

/**
 * Busca um novo auth_token da 99Food.
 *
 * A 99Food exige DUAS chamadas nessa ordem quando não existe token válido:
 *   1. GET /v1/auth/authtoken/refresh — gera um token novo nos bastidores;
 *      a resposta só confirma sucesso/falha, não traz o token em si.
 *   2. GET /v1/auth/authtoken/get — busca o auth_token de fato, já
 *      renovado pelo passo 1.
 * Chamar só o "get" direto (sem o "refresh" antes) falha com errno 10102
 * "The store authorization information has expired" — foi exatamente esse
 * o bug que causava as falhas recorrentes de autenticação.
 *
 * Envelope confirmado na prática: { errno, errmsg, requestId, time, data }.
 * errno 0 = sucesso, payload real em `data`.
 */
async function fetchNoventaENoveToken() {
  const { NOVENTAENOVE_APP_ID, NOVENTAENOVE_APP_SECRET, NOVENTAENOVE_APP_SHOP_ID } = process.env;
  if (!NOVENTAENOVE_APP_ID || !NOVENTAENOVE_APP_SECRET || !NOVENTAENOVE_APP_SHOP_ID) {
    throw new Error(
      'Credenciais da 99Food ausentes: defina NOVENTAENOVE_APP_ID, NOVENTAENOVE_APP_SECRET e NOVENTAENOVE_APP_SHOP_ID'
    );
  }

  const params = {
    app_id: NOVENTAENOVE_APP_ID,
    app_secret: NOVENTAENOVE_APP_SECRET,
    app_shop_id: NOVENTAENOVE_APP_SHOP_ID,
  };

  // 1. refresh — gera o token novo nos bastidores (resposta só confirma sucesso/falha)
  const { data: refreshEnvelope } = await axios.get('https://openapi.didi-food.com/v1/auth/authtoken/refresh', {
    params,
  });
  if (refreshEnvelope.errno !== 0) {
    throw new Error(
      `Falha ao renovar (refresh) autenticação na 99Food [errno ${refreshEnvelope.errno}]: ${refreshEnvelope.errmsg}`
    );
  }

  // 2. get — busca o auth_token de fato, já renovado pelo refresh acima
  const { data: getEnvelope } = await axios.get('https://openapi.didi-food.com/v1/auth/authtoken/get', { params });
  if (getEnvelope.errno !== 0) {
    throw new Error(`Falha ao buscar (get) auth_token na 99Food [errno ${getEnvelope.errno}]: ${getEnvelope.errmsg}`);
  }

  const result = getEnvelope.data ?? {};
  const token = result.auth_token;
  const expiresAt = result.token_expiration_time
    ? new Date(Number(result.token_expiration_time) * 1000) // ajuste se a unidade não for segundos
    : new Date(Date.now() + 5 * 60 * 1000); // fallback conservador: 5 min

  if (!token) {
    throw new Error('Resposta da 99Food não trouxe auth_token mesmo com errno 0 — confira o payload retornado');
  }

  return { token, expiresAt };
}

// Estratégia de autenticação por plataforma. Plugar Keeta aqui quando o
// acesso (NDA + conta de desenvolvedor) for liberado — sem retrabalho no
// resto do sistema, que só conhece getValidToken(platform).
const STRATEGIES = {
  ifood: fetchIfoodToken,
  noventaenove: fetchNoventaENoveToken,
};

// Bug real já visto em produção: vários pedidos chegando quase juntos (ex:
// 4 webhooks orderNew no mesmo segundo) cada um chamando getValidToken()
// concorrentemente. Como o "refresh" da 99Food sempre gera um token NOVO
// (invalidando o anterior), chamadas paralelas se pisavam — uma pegava um
// token que a próxima já tinha invalidado, e a confirmação do pedido
// falhava com "auth token is incorrect or has expired" mesmo dentro da
// validade que a gente tinha registrado. Esse mapa garante que só existe
// uma renovação em voo por plataforma; chamadas concorrentes esperam a
// mesma promise em vez de cada uma disparar seu próprio refresh+get.
// (Só protege dentro deste processo — múltiplas réplicas do serviço
// rodando ao mesmo tempo ainda poderiam correr entre si; não é o caso hoje,
// o serviço no Railway roda com 1 réplica.)
const renovacoesEmAndamento = new Map();

async function renovarToken(platform, fetchNewToken) {
  const { token, expiresAt } = await fetchNewToken();
  await prisma.platformToken.upsert({
    where: { platform },
    update: { token, expiresAt },
    create: { platform, token, expiresAt },
  });
  return token;
}

/**
 * Retorna um token de acesso válido para a plataforma informada, renovando
 * automaticamente (e persistindo em `platform_tokens`) quando necessário.
 * Nunca deve haver geração manual de token em produção.
 *
 * @param {'ifood' | 'noventaenove'} platform
 * @returns {Promise<string>}
 */
async function getValidToken(platform) {
  const fetchNewToken = STRATEGIES[platform];
  if (!fetchNewToken) {
    throw new Error(`Plataforma desconhecida: "${platform}"`);
  }

  const existing = await prisma.platformToken.findUnique({ where: { platform } });

  const isStillValid = existing && existing.expiresAt.getTime() - REFRESH_BUFFER_MS > Date.now();
  if (isStillValid) {
    return existing.token;
  }

  // Já tem uma renovação dessa plataforma em andamento? Espera ela em vez
  // de disparar outra em paralelo.
  if (renovacoesEmAndamento.has(platform)) {
    return renovacoesEmAndamento.get(platform);
  }

  const promise = renovarToken(platform, fetchNewToken).finally(() => {
    renovacoesEmAndamento.delete(platform);
  });
  renovacoesEmAndamento.set(platform, promise);

  return promise;
}

module.exports = { getValidToken };
