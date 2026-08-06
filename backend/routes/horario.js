const express = require('express');

const asyncHandler = require('../lib/asyncHandler');
const ifood = require('../connectors/ifood');
const noventaenove = require('../connectors/noventaenove');
const { turnosParaIfood, ifoodParaTurnos, turnosParaNoventaENove, noventaENoveParaTurnos } = require('../lib/horarioFuncionamento');

// Horário de funcionamento (semanal fixo + pausas rápidas) das duas
// plataformas, lado a lado. Cada plataforma é editada independentemente —
// esta rota não força os dois horários a ficarem sincronizados.

const router = express.Router();

const IFOOD_MERCHANT_ID = process.env.IFOOD_MERCHANT_ID;

/** GET /api/horario — busca o horário atual das duas plataformas (+ pausas ativas do iFood) em paralelo. */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const [ifoodResultado, noventaenoveResultado, pausasIfoodResultado] = await Promise.allSettled([
      ifood.buscarHorarioFuncionamento(IFOOD_MERCHANT_ID),
      noventaenove.detalheLoja(),
      ifood.listarPausas(IFOOD_MERCHANT_ID),
    ]);

    const resposta = {};

    if (ifoodResultado.status === 'fulfilled') {
      resposta.ifood = { turnos: ifoodParaTurnos(ifoodResultado.value.shifts), erro: null };
    } else {
      resposta.ifood = { turnos: [], erro: ifoodResultado.reason.message };
    }

    if (noventaenoveResultado.status === 'fulfilled' && noventaenoveResultado.value.errno === 0) {
      const d = noventaenoveResultado.value.data;
      resposta.noventaenove = {
        turnos: noventaENoveParaTurnos(d.biz_day_time),
        storeStatus: d.store_status,
        erro: null,
      };
    } else {
      const erro =
        noventaenoveResultado.status === 'fulfilled'
          ? `[errno ${noventaenoveResultado.value.errno}] ${noventaenoveResultado.value.errmsg}`
          : noventaenoveResultado.reason.message;
      resposta.noventaenove = { turnos: [], storeStatus: null, erro };
    }

    resposta.pausasIfood = pausasIfoodResultado.status === 'fulfilled' ? pausasIfoodResultado.value : [];

    res.json(resposta);
  })
);

/** PUT /api/horario/ifood — substitui o horário semanal inteiro do iFood. Body: { turnos: [...] } */
router.put(
  '/ifood',
  asyncHandler(async (req, res) => {
    const { turnos } = req.body;
    if (!Array.isArray(turnos)) return res.status(400).json({ error: 'turnos (array) é obrigatório' });

    const resultado = await ifood.atualizarHorarioFuncionamento(IFOOD_MERCHANT_ID, turnosParaIfood(turnos));
    res.json({ turnos: ifoodParaTurnos(resultado.shifts) });
  })
);

/**
 * PUT /api/horario/noventaenove — substitui o horário semanal fixo da
 * 99Food. Body: { turnos: [...] }
 *
 * shop/shop/update é atualização PARCIAL (confirmado ao vivo, errno 0) —
 * só manda biz_day_time, não precisa buscar/reenviar o resto da loja.
 */
router.put(
  '/noventaenove',
  asyncHandler(async (req, res) => {
    const { turnos } = req.body;
    if (!Array.isArray(turnos)) return res.status(400).json({ error: 'turnos (array) é obrigatório' });

    const resultado = await noventaenove.atualizarHorario({ biz_day_time: turnosParaNoventaENove(turnos) });
    if (resultado.errno !== 0) {
      return res.status(502).json({ error: `[errno ${resultado.errno}] ${resultado.errmsg}` });
    }

    res.json({ turnos });
  })
);

/**
 * POST /api/horario/ifood/pausa — pausa livre (início/fim customizados).
 * Body: { descricao, inicio (ISO 8601), fim (ISO 8601) }
 */
router.post(
  '/ifood/pausa',
  asyncHandler(async (req, res) => {
    const { descricao, inicio, fim } = req.body;
    if (!inicio || !fim) return res.status(400).json({ error: 'inicio e fim (ISO 8601) são obrigatórios' });

    const resultado = await ifood.criarPausa(IFOOD_MERCHANT_ID, {
      description: descricao ?? '',
      start: inicio,
      end: fim,
    });
    res.status(201).json(resultado);
  })
);

/** DELETE /api/horario/ifood/pausa/:interrupcaoId — cancela uma pausa antes do fim previsto. */
router.delete(
  '/ifood/pausa/:interrupcaoId',
  asyncHandler(async (req, res) => {
    await ifood.cancelarPausa(IFOOD_MERCHANT_ID, req.params.interrupcaoId);
    res.status(204).end();
  })
);

/**
 * POST /api/horario/noventaenove/pausa — pausa com duração fixa (enum) +
 * motivo obrigatório. Body: { duracao: 1|2|3|4, motivoCode: number, autoRetomar?: boolean }
 */
router.post(
  '/noventaenove/pausa',
  asyncHandler(async (req, res) => {
    const { duracao, motivoCode, autoRetomar = true } = req.body;
    if (!duracao || !motivoCode) {
      return res.status(400).json({ error: 'duracao e motivoCode são obrigatórios' });
    }

    const resultado = await noventaenove.definirStatusLoja({
      store_status: noventaenove.LOJA_STATUS.PAUSADA,
      pause_time: duracao,
      pause_reason_code: motivoCode,
      auto_switch: autoRetomar ? 2 : 1,
    });

    if (resultado.errno !== 0) {
      return res.status(502).json({ error: `[errno ${resultado.errno}] ${resultado.errmsg}` });
    }
    res.status(201).json({ ok: true });
  })
);

module.exports = router;
