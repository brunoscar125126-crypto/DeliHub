const crypto = require('crypto');
const express = require('express');
const JSONbig = require('json-bigint')({ storeAsString: true });

const prisma = require('../lib/prisma');
const asyncHandler = require('../lib/asyncHandler');
const { processarEventoIfood } = require('../lib/processarEventosIfood');

// Endpoints que as plataformas chamam pra notificar eventos de pedido.
//
// Decisão (2026-08-17): o DeliHub NÃO decide mais aceitar/recusar pedido —
// isso passou a ser feito direto no app oficial de cada plataforma. Este
// arquivo só CAPTURA o status real que a plataforma relata (novo, confirmado,
// pronto, saiu para entrega, entregue, cancelado...), nunca chama nenhuma
// API de confirmação/aceite.
//
// Correção (2026-08-06): o comentário anterior aqui dizia que o iFood não
// tinha webhook de pedido, só polling — isso era baseado em conhecimento
// desatualizado. O iFood TEM webhook como alternativa ao polling (ver
// https://developer.ifood.com.br/pt-BR/docs/guides/modules/events/webhook-overview/),
// registrado na aba de configuração do app no Developer Portal. Os dois
// mecanismos ficam ativos ao mesmo tempo neste projeto por enquanto — ver
// lib/ifoodPolling.js.

const router = express.Router();

/**
 * Verifica a assinatura da 99Food: header `didi-header-sign` deve ser
 * MD5(raw_body + app_secret). Precisa do Buffer bruto do corpo (não o JSON
 * já parseado) — reserializar o objeto poderia mudar formatação/ordem de
 * chaves e quebrar a assinatura, por isso usamos req.rawBody (capturado em
 * server.js) em vez de req.body aqui.
 */
function assinaturaValida(rawBody, appSecret, assinaturaRecebida) {
  if (!rawBody || !appSecret || !assinaturaRecebida) return false;

  const esperada = crypto
    .createHash('md5')
    .update(Buffer.concat([rawBody, Buffer.from(appSecret, 'utf8')]))
    .digest('hex');

  const bufEsperado = Buffer.from(esperada, 'hex');
  const bufRecebido = Buffer.from(String(assinaturaRecebida), 'hex');
  if (bufEsperado.length !== bufRecebido.length) return false;

  return crypto.timingSafeEqual(bufEsperado, bufRecebido);
}

/**
 * Verifica a assinatura do iFood: header `X-IFood-Signature` deve ser
 * HMAC-SHA256(client_secret, raw_body) em hex — diferente da 99Food, aqui o
 * secret é a CHAVE do HMAC, não concatenado na mensagem.
 * Doc: https://developer.ifood.com.br/pt-BR/docs/guides/modules/events/webhook-signature/
 */
function assinaturaValidaIfood(rawBody, clientSecret, assinaturaRecebida) {
  if (!rawBody || !clientSecret || !assinaturaRecebida) return false;

  const esperada = crypto.createHmac('sha256', clientSecret).update(rawBody).digest('hex');

  const bufEsperado = Buffer.from(esperada, 'hex');
  const bufRecebido = Buffer.from(String(assinaturaRecebida), 'hex');
  if (bufEsperado.length !== bufRecebido.length) return false;

  return crypto.timingSafeEqual(bufEsperado, bufRecebido);
}

/**
 * Grava/atualiza o Pedido a partir de um evento da 99Food. `data` é
 * `payload.data` inteiro, não só `order_info` — porque, na prática (visto ao
 * vivo em produção), nem todo evento tem o mesmo formato:
 *   - "orderNew" (e provavelmente outros de status "cheio"): manda
 *     `data.order_info` com o pedido completo — dá pra criar OU atualizar.
 *   - "orderCancel" (confirmado ao vivo em 2026-08-17): manda só
 *     `data.order_id`, sem order_info nenhum — só dá pra ATUALIZAR um
 *     pedido que já exista (não tem shop/price/itens pra criar um do zero).
 * Nos dois casos, guarda o `type` recebido em statusEvento — é assim que a
 * gente acompanha o pedido evoluindo (novo → confirmado → ... → entregue/
 * cancelado) sem nunca chamar nenhuma API de confirmação/aceite.
 */
async function processarEvento99Food(tipo, data) {
  const orderInfo = data?.order_info;
  const orderId = orderInfo?.order_id ?? data?.order_id;

  if (!orderId) {
    console.error('[webhook 99food] evento sem order_id, ignorando payload:', JSON.stringify(data));
    return;
  }

  if (orderInfo) {
    const { status, shop, price, receive_address: receiveAddress, order_items: orderItems } = orderInfo;
    try {
      await prisma.pedido.upsert({
        where: { plataforma_orderId: { plataforma: 'noventaenove', orderId: String(orderId) } },
        update: {
          status,
          statusEvento: tipo ?? null,
          shop,
          price,
          receiveAddress,
          orderItems,
          payloadBruto: orderInfo,
        },
        create: {
          plataforma: 'noventaenove',
          orderId: String(orderId),
          status,
          statusEvento: tipo ?? null,
          shop,
          price,
          receiveAddress,
          orderItems,
          payloadBruto: orderInfo,
        },
      });
      console.log(`[webhook 99food] pedido ${orderId} atualizado (status: ${tipo ?? 'desconhecido'})`);
    } catch (err) {
      console.error(`[webhook 99food] falha ao gravar Pedido ${orderId}:`, err.message);
    }
    return;
  }

  // Evento enxuto (ex: orderCancel) — só o order_id, sem o pedido completo.
  // Só dá pra atualizar um pedido que a gente já conhece (do orderNew dele);
  // se não existir ainda, não tem como criar do zero (faltam campos
  // obrigatórios como shop/price/itens).
  try {
    const atualizado = await prisma.pedido.updateMany({
      where: { plataforma: 'noventaenove', orderId: String(orderId) },
      data: { statusEvento: tipo ?? null },
    });
    if (atualizado.count === 0) {
      console.warn(
        `[webhook 99food] evento "${tipo}" pro pedido ${orderId}, mas ele ainda não existe no nosso banco — ignorado`
      );
    } else {
      console.log(`[webhook 99food] pedido ${orderId} atualizado (status: ${tipo ?? 'desconhecido'}, evento enxuto)`);
    }
  } catch (err) {
    console.error(`[webhook 99food] falha ao atualizar Pedido ${orderId}:`, err.message);
  }
}

/**
 * POST /api/webhooks/99food
 *
 * Formato confirmado: { app_id, app_shop_id, timestamp, type, data }, onde
 * `data` é `{ order_info: {...} }` (orderNew) OU só `{ order_id }`
 * (orderCancel, confirmado ao vivo — ver processarEvento99Food). Qualquer
 * evento que traga um order_id (de um jeito ou de outro) atualiza o
 * histórico de status — sem mais chamar nenhuma API de confirmação/aceite.
 */
router.post(
  '/99food',
  asyncHandler(async (req, res) => {
    const assinaturaRecebida = req.headers['didi-header-sign'];
    if (!assinaturaValida(req.rawBody, process.env.NOVENTAENOVE_APP_SECRET, assinaturaRecebida)) {
      console.warn('[webhook 99food] assinatura inválida — payload rejeitado');
      return res.status(401).json({ error: 'assinatura inválida' });
    }

    // Reparseia com json-bigint em vez de usar req.body (parseado pelo
    // express.json com JSON.parse comum) — order_id é 64-bit, precisão importa.
    let payload;
    try {
      payload = JSONbig.parse(req.rawBody.toString('utf8'));
    } catch {
      payload = req.body; // não deveria acontecer — express.json() já validou que é JSON válido
    }

    console.log('[webhook 99food] payload recebido:', JSON.stringify(payload));
    await prisma.eventoPedido.create({
      data: { plataforma: 'noventaenove', origem: 'webhook', payload },
    });

    if (payload?.data?.order_info || payload?.data?.order_id) {
      await processarEvento99Food(payload.type, payload.data);
    }

    res.status(200).json({ recebido: true });
  })
);

/**
 * POST /api/webhooks/ifood
 *
 * Diferente da 99Food, o payload aqui é só uma NOTIFICAÇÃO de evento (code,
 * fullCode, id, merchantId, orderId) — não o pedido completo. Por isso
 * processarEventoIfood busca o detalhe via GET /order/v1.0/orders/{orderId}
 * antes de gravar/atualizar o Pedido (ver lib/processarEventosIfood.js).
 *
 * iFood exige resposta 202 em até 5s (não 200) — só 5xx dispara retry, por
 * até 15 min. Por isso a captura roda depois de responder, sem o cliente
 * esperar a busca do detalhe (que pode ser lenta). Eventos de presença/
 * heartbeat (code "KEEPALIVE") chegam aqui automaticamente a cada intervalo —
 * são gravados no log bruto mas ignorados por processarEventoIfood.
 */
router.post(
  '/ifood',
  asyncHandler(async (req, res) => {
    const assinaturaRecebida = req.headers['x-ifood-signature'];
    if (!assinaturaValidaIfood(req.rawBody, process.env.IFOOD_CLIENT_SECRET, assinaturaRecebida)) {
      console.warn('[webhook ifood] assinatura inválida — payload rejeitado');
      return res.status(401).json({ error: 'assinatura inválida' });
    }

    console.log('[webhook ifood] evento recebido:', JSON.stringify(req.body));
    await prisma.eventoPedido.create({
      data: { plataforma: 'ifood', origem: 'webhook', payload: req.body },
    });

    res.status(202).end();

    processarEventoIfood(req.body).catch((err) =>
      console.error('[webhook ifood] falha ao processar evento:', err.message)
    );
  })
);

/** GET /api/webhooks/eventos — lista os eventos brutos recebidos, pra inspecionar o formato real. */
router.get(
  '/eventos',
  asyncHandler(async (req, res) => {
    const { plataforma } = req.query;
    const eventos = await prisma.eventoPedido.findMany({
      where: plataforma ? { plataforma } : undefined,
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    res.json(eventos);
  })
);

/** GET /api/webhooks/pedidos — lista os pedidos, histórico de status por plataforma. */
router.get(
  '/pedidos',
  asyncHandler(async (req, res) => {
    const pedidos = await prisma.pedido.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    res.json(pedidos);
  })
);

module.exports = router;
