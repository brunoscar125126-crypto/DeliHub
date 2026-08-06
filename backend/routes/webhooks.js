const crypto = require('crypto');
const express = require('express');
const JSONbig = require('json-bigint')({ storeAsString: true });

const prisma = require('../lib/prisma');
const asyncHandler = require('../lib/asyncHandler');
const noventaenove = require('../connectors/noventaenove');

// Endpoints que as plataformas chamam pra notificar eventos de pedido
// (só a 99Food usa esse modelo de fato — ver connectors/ifood.js sobre por
// que o iFood não tem webhook de pedido, é polling).

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
 * Processa um evento orderNew: grava o Pedido e confirma automaticamente
 * na 99Food (urgente — só 5 min antes do cancelamento automático). Os dois
 * passos são independentes: uma falha ao gravar no nosso banco não deve
 * impedir a tentativa de confirmação, que é a parte que realmente importa
 * dentro da janela de tempo.
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
    console.error(`[webhook 99food] falha ao gravar Pedido ${orderId} (confirmando mesmo assim):`, err.message);
  }

  try {
    const resultado = await noventaenove.confirmarPedido(String(orderId));
    if (resultado.errno === 0) {
      await prisma.pedido
        .update({
          where: { plataforma_orderId: { plataforma: 'noventaenove', orderId: String(orderId) } },
          data: { confirmadoEm: new Date() },
        })
        .catch(() => {}); // já logamos o essencial (confirmação na API) mesmo se isso falhar
      console.log(`[webhook 99food] pedido ${orderId} confirmado automaticamente`);
    } else {
      console.error(
        `[webhook 99food] falha ao confirmar pedido ${orderId} [errno ${resultado.errno}]: ${resultado.errmsg}`
      );
    }
  } catch (err) {
    console.error(`[webhook 99food] erro ao chamar confirmarPedido(${orderId}):`, err.response?.data ?? err.message);
  }
}

/**
 * POST /api/webhooks/99food
 *
 * Formato confirmado: { app_id, app_shop_id, timestamp, type, data: { order_info } }.
 * type === "orderNew" dispara gravação do Pedido + confirmação automática.
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

module.exports = router;
