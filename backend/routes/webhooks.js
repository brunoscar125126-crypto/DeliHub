const express = require('express');

const prisma = require('../lib/prisma');
const asyncHandler = require('../lib/asyncHandler');

// Endpoints que as plataformas chamam pra notificar eventos de pedido
// (só a 99Food usa esse modelo de fato — ver connectors/ifood.js sobre por
// que o iFood não tem webhook de pedido, é polling).

const router = express.Router();

/**
 * POST /api/webhooks/99food
 *
 * ATENÇÃO: a 99Food ainda não tem, neste projeto, nem o formato do payload
 * nem o mecanismo de verificação de assinatura confirmados — nenhuma
 * documentação foi validada ainda (diferente do resto do conector, que foi
 * todo testado contra a API real). Por segurança, este endpoint aceita
 * qualquer POST e só grava o payload bruto — NÃO confiar nesses dados pra
 * nenhuma ação automática (confirmar/cancelar pedido, etc.) até
 * confirmarmos o formato real e implementarmos verificação de assinatura.
 */
router.post(
  '/99food',
  asyncHandler(async (req, res) => {
    console.log('[webhook 99food] payload recebido:', JSON.stringify(req.body));
    await prisma.eventoPedido.create({
      data: {
        plataforma: 'noventaenove',
        origem: 'webhook',
        payload: req.body,
      },
    });
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

module.exports = router;
