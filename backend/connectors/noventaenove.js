// Conector 99Food — toda a comunicação com a OpenAPI da 99Food (DiDi Food)
// passa por aqui. O resto do sistema (rotas, dashboard, financeiro) nunca
// chama essa API diretamente, só este módulo.
//
// Host: https://openapi.didi-food.com
//
// Autenticação: getValidToken('noventaenove') (lib/tokenManager.js) cuida de
// gerar/renovar o auth_token automaticamente. Aqui só consumimos o token —
// nunca chamar /v1/auth/authtoken/get ou /refresh diretamente neste módulo.
// O auth_token vai sempre via query string em toda chamada (get e post),
// nunca como header — diferente do iFood.
//
// IDs (app, pedido, loja, item) são inteiros 64-bit: parseamos as respostas
// com json-bigint (storeAsString) em vez de JSON.parse puro, pra não perder
// precisão. Por consequência, todo item_id que circula por este módulo é
// string — passe sempre como string ao chamar estas funções.

const axios = require('axios');
const JSONbig = require('json-bigint')({ storeAsString: true });
const { getValidToken } = require('../lib/tokenManager');

const BASE_URL = 'https://openapi.didi-food.com';
const DEFAULT_SHOP_ID = process.env.NOVENTAENOVE_APP_SHOP_ID;

// Status de disponibilidade do item na 99Food (ver resumo técnico).
const ITEM_STATUS = {
  DISPONIVEL: 1,
  PAUSADO: 2,
};

const client = axios.create({
  baseURL: BASE_URL,
  // Parseia o corpo da resposta com json-bigint em vez do JSON.parse padrão
  // do axios, preservando IDs de 64 bits.
  transformResponse: [
    (data) => {
      if (typeof data !== 'string' || data.length === 0) return data;
      try {
        return JSONbig.parse(data);
      } catch {
        return data; // resposta não-JSON (ex: erro HTML/texto) — devolve como veio
      }
    },
  ],
});

/**
 * Monta os query params comuns a toda chamada: auth_token válido (renovado
 * automaticamente pelo tokenManager quando necessário) + app_shop_id.
 */
async function baseParams(extra = {}) {
  const auth_token = await getValidToken('noventaenove');
  return { auth_token, app_shop_id: DEFAULT_SHOP_ID, ...extra };
}

/**
 * Lista o cardápio completo da loja (menu → categoria → item → sub_item).
 * Doc: GET /v1/item/item/list
 */
async function listarCardapio(extraParams = {}) {
  const params = await baseParams(extraParams);
  const { data } = await client.get('/v1/item/item/list', { params });
  return data;
}

/**
 * Atualiza um item existente (preço, nome, descrição, etc.).
 * Doc: POST /v1/item/item/update
 *
 * `item` deve seguir o payload validado no ReqBin para este endpoint
 * (precisa incluir o identificador do item, `app_item_id` — confirmado via
 * listarCardapio() real). Preços em centavos.
 */
async function atualizarItem(item) {
  const params = await baseParams();
  const { data } = await client.post('/v1/item/item/update', item, { params });
  return data;
}

/**
 * Muda o status de disponibilidade de um item (pausar/despausar).
 * Doc: POST /v1/item/item/updateItemStatus
 *
 * A 99Food embute erro dentro de uma resposta HTTP 200 normal (envelope
 * {errno, errmsg}) — o axios não lança nada sozinho nesse caso. Descoberto
 * ao vivo: um app_item_id inexistente retornava como se tivesse funcionado
 * pra quem só checava "a chamada não deu throw". Lança explicitamente aqui
 * pra todo caller (fan-out em routes/produtos.js, toggle por plataforma,
 * etc.) herdar a checagem certa sem precisar lembrar de fazer isso.
 *
 * @param {string} appItemId - o `app_item_id` retornado por listarCardapio()
 * @param {1 | 2} status - use ITEM_STATUS.DISPONIVEL ou ITEM_STATUS.PAUSADO
 */
async function atualizarStatusItem(appItemId, status) {
  const params = await baseParams();
  const { data } = await client.post(
    '/v1/item/item/updateItemStatus',
    { app_item_id: appItemId, status },
    { params }
  );
  if (data.errno !== 0) {
    throw new Error(`Falha ao atualizar status do item na 99Food [errno ${data.errno}]: ${data.errmsg}`);
  }
  return data;
}

/** Pausa um item (equivalente ao teste já validado manualmente no ReqBin). */
async function pausarItem(appItemId) {
  return atualizarStatusItem(appItemId, ITEM_STATUS.PAUSADO);
}

/** Reativa um item. */
async function despausarItem(appItemId) {
  return atualizarStatusItem(appItemId, ITEM_STATUS.DISPONIVEL);
}

/**
 * Confirma um pedido novo. Urgente: a 99Food cancela automaticamente um
 * pedido não confirmado em ~5 min (ver routes/webhooks.js, chamado logo
 * após um evento orderNew).
 * Doc: POST /v1/order/order/confirm
 *
 * Nome do campo (`order_id` no body) segue o padrão dos outros endpoints
 * POST da 99Food — ainda não validado contra um pedido real de verdade,
 * conferir no primeiro orderNew de produção.
 */
async function confirmarPedido(orderId) {
  const params = await baseParams();
  const { data } = await client.post('/v1/order/order/confirm', { order_id: orderId }, { params });
  return data;
}

/**
 * Busca o detalhe completo de um pedido — útil quando o payload do webhook
 * não basta (reconciliação, consulta manual, etc.).
 * Doc: GET /v1/order/order/detail
 */
async function detalheDoPedido(orderId) {
  const params = await baseParams({ order_id: orderId });
  const { data } = await client.get('/v1/order/order/detail', { params });
  return data;
}

// Duração da pausa (Business Pause) — enum, não minutos crus. Descoberto ao
// vivo: a API rejeita qualquer valor fora de 1-4 com o range certinho no erro.
const PAUSA_DURACAO = {
  MIN_10: 1,
  MIN_20: 2,
  MIN_30: 3,
  ATE_FIM_DO_DIA: 4,
};

// Motivos de pausa (pause_reason_code) — confirmados pelo lojista via
// documentação da 99Food. Só temos esses dois por enquanto; lista completa
// não confirmada.
const PAUSA_MOTIVO = {
  AUSENCIA_TEMPORARIA_EQUIPE: 1002,
  OUTROS: 1006,
};

// store_status — usado tanto na resposta de shop/shop/detail quanto no
// corpo de shop/shop/setStatus.
const LOJA_STATUS = {
  ABERTA: 1,
  FECHADA: 2, // "Business Close" — fica fechada até reabertura manual (API ou app)
  PAUSADA: 3, // "Business Pause" — preserva horário agendado, pode voltar sozinha
};

/**
 * Busca os detalhes completos da loja: horário semanal (biz_day_time),
 * feriados/exceções (biz_holiday_time), status atual (store_status), etc.
 * Doc: GET /v1/shop/shop/detail
 *
 * Rate limit observado ao vivo: 1 chamada a cada 60s (errno 10005) —
 * parece compartilhado com shop/shop/update e shop/shop/setStatus (mesmo
 * grupo "shop"). routes/horario.js não faz polling automático por causa
 * disso, só busca sob ação explícita do usuário.
 */
async function detalheLoja() {
  const params = await baseParams();
  const { data } = await client.get('/v1/shop/shop/detail', { params });
  return data;
}

/**
 * Atualiza campos da loja — é atualização PARCIAL (confirmado ao vivo,
 * `auth_token` é o único campo realmente obrigatório): manda só o que
 * quer mudar, sem precisar reenviar o resto.
 * Doc: POST /v1/shop/shop/update
 *
 * Pra horário (`biz_day_time`/`biz_holiday_time`): ATENÇÃO, o formato de
 * escrita usa `bizDay`/`bizTime`/`bizHoliday`/`restAllDay` (camelCase),
 * diferente do formato de leitura de shop/shop/detail, que usa
 * `biz_day`/`biz_time` (snake_case) — descoberto ao vivo depois de várias
 * tentativas com o formato de leitura, que falhava com "Date or time
 * cannot be blank". Use lib/horarioFuncionamento.js pra montar o payload
 * certo em vez de montar isso na mão.
 */
async function atualizarHorario(dados) {
  const params = await baseParams();
  const { data } = await client.post('/v1/shop/shop/update', dados, { params });
  return data;
}

/**
 * Muda o status da loja: pausa temporária (com retorno automático
 * opcional) ou fechamento manual.
 * Doc: POST /v1/shop/shop/setStatus
 *
 * Pra pausar: { store_status: LOJA_STATUS.PAUSADA, pause_time: PAUSA_DURACAO.*,
 * pause_reason_code: PAUSA_MOTIVO.*, auto_switch: 2 } — os quatro campos
 * são obrigatórios juntos ao pausar (confirmado ao vivo: pause_time fora de
 * 1-4 e pause_reason_code fora do formato numérico esperado geram erro
 * explícito da API).
 */
async function definirStatusLoja(dados) {
  const params = await baseParams();
  const { data } = await client.post('/v1/shop/shop/setStatus', dados, { params });
  return data;
}

module.exports = {
  ITEM_STATUS,
  PAUSA_DURACAO,
  PAUSA_MOTIVO,
  LOJA_STATUS,
  listarCardapio,
  atualizarItem,
  atualizarStatusItem,
  pausarItem,
  despausarItem,
  confirmarPedido,
  detalheDoPedido,
  detalheLoja,
  atualizarHorario,
  definirStatusLoja,
};
