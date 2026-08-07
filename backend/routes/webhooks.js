const crypto = require('crypto');
const express = require('express');
const JSONbig = require('json-bigint')({ storeAsString: true });

const prisma = require('../lib/prisma');
const asyncHandler = require('../lib/asyncHandler');
const noventaenove = require('../connectors/noventaenove');

// Endpoints que as plataformas chamam pra notificar eventos de pedido.
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

// A 99Food cancela sozinha o pedido que não for confirmado em até 5 min.
// Confirmação agora é manual (botão no frontend) — esse timer é só uma rede
// de segurança: se ninguém confirmar a tempo, confirma automaticamente 1 min
// antes do prazo, pra não perder o pedido por descuido. Só funciona enquanto
// o processo do backend continua de pé (não sobrevive a um redeploy/restart
// do Railway no meio da janela — limitação aceita, é melhor que nada).
const JANELA_CANCELAMENTO_MS = 5 * 60 * 1000;
const MARGEM_SEGURANCA_MS = 60 * 1000;

/**
 * Confirma um pedido na 99Food e grava `confirmadoEm`. Usada tanto pelo
 * botão manual (routes/webhooks.js POST /pedidos/:id/confirmar) quanto pela
 * rede de segurança automática.
 */
async function confirmarNoventaENove(orderId, { origem }) {
  try {
    const resultado = await noventaenove.confirmarPedido(String(orderId));
    if (resultado.errno === 0) {
      const pedido = await prisma.pedido.update({
        where: { plataforma_orderId: { plataforma: 'noventaenove', orderId: String(orderId) } },
        data: { confirmadoEm: new Date() },
      });
      console.log(`[webhook 99food] pedido ${orderId} confirmado (${origem})`);
      return { ok: true, pedido };
    }
    console.error(
      `[webhook 99food] falha ao confirmar pedido ${orderId} [errno ${resultado.errno}]: ${resultado.errmsg}`
    );
    return { ok: false, erro: resultado.errmsg ?? `errno ${resultado.errno}` };
  } catch (err) {
    const mensagem = err.response?.data ?? err.message;
    console.error(`[webhook 99food] erro ao chamar confirmarPedido(${orderId}):`, mensagem);
    return { ok: false, erro: String(mensagem) };
  }
}

/** Agenda a confirmação automática de segurança, só dispara se ninguém confirmou na mão antes. */
function agendarConfirmacaoDeSeguranca(orderId) {
  setTimeout(async () => {
    const pedido = await prisma.pedido
      .findUnique({ where: { plataforma_orderId: { plataforma: 'noventaenove', orderId: String(orderId) } } })
      .catch(() => null);
    if (!pedido || pedido.confirmadoEm) return; // já confirmado na mão (ou pedido sumiu) — nada a fazer

    console.warn(`[webhook 99food] pedido ${orderId} não confirmado manualmente — acionando rede de segurança`);
    await confirmarNoventaENove(orderId, { origem: 'rede de segurança automática' });
  }, JANELA_CANCELAMENTO_MS - MARGEM_SEGURANCA_MS);
}

/**
 * Processa um evento orderNew: grava o Pedido (sem confirmar) e agenda a
 * rede de segurança. A confirmação em si agora é manual, via
 * POST /api/webhooks/pedidos/:id/confirmar.
 */
async function processarPedidoNovo(orderInfo) {
  const {
    order_id: orderId,
    status,
    shop,
    price,
    receive_address: receiveAddress,
    order_items: orderItems,
  } = orderInfo ?? {};

  if (!orderId) {
    console.error('[webhook 99food] orderNew sem order_id, ignorando payload:', JSON.stringify(orderInfo));
    return;
  }

  try {
    await prisma.pedido.upsert({
      where: { plataforma_orderId: { plataforma: 'noventaenove', orderId: String(orderId) } },
      update: { status, shop, price, receiveAddress, orderItems, payloadBruto: orderInfo },
      create: {
        plataforma: 'noventaenove',
        orderId: String(orderId),
        status,
        shop,
        price,
        receiveAddress,
        orderItems,
        payloadBruto: orderInfo,
      },
    });
  } catch (err) {
    console.error(`[webhook 99food] falha ao gravar Pedido ${orderId}:`, err.message);
  }

  agendarConfirmacaoDeSeguranca(orderId);
}

/**
 * POST /api/webhooks/99food
 *
 * Formato confirmado: { app_id, app_shop_id, timestamp, type, data: { order_info } }.
 * type === "orderNew" dispara gravação do Pedido + agenda a rede de segurança
 * (confirmação em si é manual agora — ver POST /pedidos/:id/confirmar).
 * Qualquer outro type só é logado/armazenado por enquanto (ex: cancelamento,
 * status update — ainda não modelados).
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

    if (payload?.type === 'orderNew' && payload?.data?.order_info) {
      await processarPedidoNovo(payload.data.order_info);
    }

    res.status(200).json({ recebido: true });
  })
);

/**
 * POST /api/webhooks/ifood
 *
 * Diferente da 99Food, o payload aqui é só uma NOTIFICAÇÃO de evento (code,
 * fullCode, id, merchantId, orderId) — não o pedido completo. Pra agir
 * sobre um pedido de verdade (confirmar, etc.) seria preciso buscar o
 * detalhe via GET /order/v1.0/orders/{orderId}, ainda não implementado no
 * conector. Por enquanto só grava o evento bruto, igual fizemos com a
 * 99Food antes de conhecer o formato real.
 *
 * iFood exige resposta 202 em até 5s (não 200) — só 5xx dispara retry, por
 * até 15 min. Eventos de presença/heartbeat (code "KEEPALIVE") também
 * chegam aqui automaticamente a cada intervalo — tratados como qualquer
 * outro evento (gravados e respondidos 202).
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

/** GET /api/webhooks/pedidos — lista os pedidos processados, pra debug/verificação. */
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

/**
 * POST /api/webhooks/pedidos/:id/confirmar — confirmação manual (botão no
 * frontend). `:id` é o id interno do Pedido (não o orderId da plataforma).
 * Idempotente: se já tiver confirmadoEm, só devolve o pedido como está.
 */
router.post(
  '/pedidos/:id/confirmar',
  asyncHandler(async (req, res) => {
    const pedido = await prisma.pedido.findUnique({ where: { id: req.params.id } });
    if (!pedido) return res.status(404).json({ error: 'pedido não encontrado' });
    if (pedido.confirmadoEm) return res.json(pedido);

    if (pedido.plataforma !== 'noventaenove') {
      return res.status(400).json({ error: `confirmação manual ainda não suportada para ${pedido.plataforma}` });
    }

    const resultado = await confirmarNoventaENove(pedido.orderId, { origem: 'confirmação manual' });
    if (!resultado.ok) {
      return res.status(502).json({ error: resultado.erro });
    }
    res.json(resultado.pedido);
  })
);

module.exports = router;
