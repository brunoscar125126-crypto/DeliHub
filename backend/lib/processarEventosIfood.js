// Processa um evento de pedido do iFood (vindo de webhook OU polling — os
// dois entregam o mesmo tipo de descritor curto: {id, code, fullCode,
// orderId, merchantId, ...}, nunca o pedido completo) buscando o detalhe
// real via GET /order/v1.0/orders/{orderId} (connectors/ifood.js) e
// gravando/atualizando o Pedido. Compartilhado entre lib/ifoodPolling.js e
// routes/webhooks.js (rota /ifood) — mesma lógica de upsert pros dois canais,
// que segundo o comentário em routes/webhooks.js ficam ativos ao mesmo tempo.
//
// Extração de shop/price/receiveAddress/orderItems é BEST-EFFORT: este
// projeto nunca recebeu um pedido real do iFood ainda (só catálogo/horário
// foram testados contra a API real), então os nomes de campo abaixo são a
// melhor estimativa com base na Order API pública — podem não bater exatos
// com a resposta real. Por causa disso, `payloadBruto` sempre grava a
// resposta inteira sem filtro: mesmo que a extração erre o nome de um campo,
// a verdade crua nunca se perde (dá pra conferir em ModalPedido → "Ver
// payload completo"). Vale reconferir os nomes de campo assim que o
// primeiro pedido real do iFood passar por aqui.

const ifood = require('../connectors/ifood');
const prisma = require('./prisma');

// Evento de presença/heartbeat — não representa pedido nenhum, não vale a
// pena buscar detalhe nem fazer upsert.
const CODIGOS_IGNORADOS = new Set(['KEEPALIVE']);

async function processarEventoIfood(evento) {
  const codigo = evento?.fullCode ?? evento?.code ?? null;
  const orderId = evento?.orderId;

  if (!orderId || CODIGOS_IGNORADOS.has(codigo)) return;

  let pedido;
  try {
    pedido = await ifood.buscarPedido(orderId);
  } catch (err) {
    console.error(`[ifood] falha ao buscar detalhe do pedido ${orderId}:`, err.response?.data ?? err.message);
    return;
  }

  const shop = pedido?.merchant ?? {};
  const price = pedido?.total ?? {};
  const receiveAddress = pedido?.delivery?.deliveryAddress ?? pedido?.deliveryAddress ?? {};
  const orderItems = pedido?.items ?? [];

  try {
    await prisma.pedido.upsert({
      where: { plataforma_orderId: { plataforma: 'ifood', orderId: String(orderId) } },
      update: { statusEvento: codigo, shop, price, receiveAddress, orderItems, payloadBruto: pedido },
      create: {
        plataforma: 'ifood',
        orderId: String(orderId),
        statusEvento: codigo,
        shop,
        price,
        receiveAddress,
        orderItems,
        payloadBruto: pedido,
      },
    });
    console.log(`[ifood] pedido ${orderId} atualizado (status: ${codigo ?? 'desconhecido'})`);
  } catch (err) {
    console.error(`[ifood] falha ao gravar Pedido ${orderId}:`, err.message);
  }
}

module.exports = { processarEventoIfood };
