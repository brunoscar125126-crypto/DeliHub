const express = require('express');

const prisma = require('../lib/prisma');
const asyncHandler = require('../lib/asyncHandler');
const ifood = require('../connectors/ifood');
const noventaenove = require('../connectors/noventaenove');

// Recebe ações do frontend e aciona os conectores certos. Nunca fala
// diretamente com nenhuma plataforma — só com os módulos em /connectors.

const router = express.Router();

const IFOOD_MERCHANT_ID = process.env.IFOOD_MERCHANT_ID;

// Adapta a assinatura de cada conector (que varia por plataforma — o iFood
// precisa de merchantId, a 99Food não) pra uma interface única
// (itemId) => Promise, que as rotas abaixo conseguem chamar sem saber dessa
// diferença.
const CONECTORES = {
  ifood: {
    pausar: (itemId) => ifood.pausarItem(IFOOD_MERCHANT_ID, itemId),
    despausar: (itemId) => ifood.despausarItem(IFOOD_MERCHANT_ID, itemId),
  },
  noventaenove: {
    pausar: (itemId) => noventaenove.pausarItem(itemId),
    despausar: (itemId) => noventaenove.despausarItem(itemId),
  },
  // keeta: plugar aqui quando o acesso for liberado
};

/** GET /api/produtos — lista todos os produtos com seus mapeamentos de plataforma. */
router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const produtos = await prisma.produto.findMany({
      include: { plataformas: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json(produtos);
  })
);

/** GET /api/produtos/:id — detalhe de um produto. */
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const produto = await prisma.produto.findUnique({
      where: { id: req.params.id },
      include: { plataformas: true },
    });
    if (!produto) return res.status(404).json({ error: 'Produto não encontrado' });
    res.json(produto);
  })
);

/**
 * PATCH /api/produtos/:id — edita os campos base do produto (não mexe em
 * plataformas — isso é PATCH/DELETE /:id/plataformas/:plataforma).
 * Body: qualquer subconjunto de { nome, descricao, categoria,
 *       precoCentavos, custoCentavos, imagemUrl }
 */
router.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const { nome, descricao, categoria, precoCentavos, custoCentavos, imagemUrl } = req.body;

    const data = {};
    if (nome !== undefined) data.nome = nome;
    if (descricao !== undefined) data.descricao = descricao;
    if (categoria !== undefined) data.categoria = categoria;
    if (precoCentavos !== undefined) data.precoCentavos = precoCentavos;
    if (custoCentavos !== undefined) data.custoCentavos = custoCentavos;
    if (imagemUrl !== undefined) data.imagemUrl = imagemUrl;

    try {
      const produto = await prisma.produto.update({
        where: { id: req.params.id },
        data,
        include: { plataformas: true },
      });
      res.json(produto);
    } catch (err) {
      if (err.code === 'P2025') return res.status(404).json({ error: 'Produto não encontrado' });
      throw err;
    }
  })
);

/** DELETE /api/produtos/:id — exclui o produto (cascade remove os vínculos de plataforma). */
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    try {
      await prisma.produto.delete({ where: { id: req.params.id } });
      res.status(204).end();
    } catch (err) {
      if (err.code === 'P2025') return res.status(404).json({ error: 'Produto não encontrado' });
      throw err;
    }
  })
);

/**
 * PATCH /api/produtos/:id/plataformas/:plataforma — vincula (se ainda não
 * existe) ou pausa/despausa (se já vinculado) um produto numa única
 * plataforma. Diferente do fan-out de /pausar e /despausar, que mexe em
 * todas de uma vez — aqui é só a plataforma da URL.
 *
 * Body pra VINCULAR (sem vínculo ainda): { itemId, precoCentavos? }
 * Body pra PAUSAR/DESPAUSAR (já vinculado): { status: 'ATIVO' | 'PAUSADO' }
 */
router.patch(
  '/:id/plataformas/:plataforma',
  asyncHandler(async (req, res) => {
    const { id, plataforma } = req.params;
    const { itemId, precoCentavos, status } = req.body;

    const produto = await prisma.produto.findUnique({ where: { id }, include: { plataformas: true } });
    if (!produto) return res.status(404).json({ error: 'Produto não encontrado' });

    const vinculoAtual = produto.plataformas.find((pp) => pp.plataforma === plataforma);

    // Caso 1: ainda não vinculado — precisa de itemId pra criar o vínculo.
    if (!vinculoAtual) {
      if (!itemId) {
        return res.status(400).json({ error: 'itemId é obrigatório pra vincular uma plataforma nova' });
      }
      try {
        const novoVinculo = await prisma.produtoPlataforma.create({
          data: { produtoId: id, plataforma, itemId, precoCentavos },
        });
        return res.status(201).json(novoVinculo);
      } catch (err) {
        if (err.code === 'P2002') {
          return res.status(409).json({ error: 'Esse itemId já está vinculado a outro produto nessa plataforma' });
        }
        throw err;
      }
    }

    // Caso 2: já vinculado — muda status (pausa/despausa só nessa plataforma).
    if (status) {
      const conector = CONECTORES[plataforma];
      if (!conector) return res.status(400).json({ error: `Nenhum conector disponível para "${plataforma}"` });

      const acao = status === 'PAUSADO' ? 'pausar' : 'despausar';
      try {
        await conector[acao](vinculoAtual.itemId);
      } catch (err) {
        return res.status(502).json({ error: `Falha ao ${acao} na plataforma: ${err.message}` });
      }

      const atualizado = await prisma.produtoPlataforma.update({
        where: { id: vinculoAtual.id },
        data: { status, sincronizadoEm: new Date() },
      });
      return res.json(atualizado);
    }

    // Nem itemId (já vinculado, então não se aplica) nem status no body.
    if (precoCentavos !== undefined) {
      const atualizado = await prisma.produtoPlataforma.update({
        where: { id: vinculoAtual.id },
        data: { precoCentavos },
      });
      return res.json(atualizado);
    }

    res.status(400).json({ error: 'Nada pra atualizar — informe status ou precoCentavos' });
  })
);

/**
 * DELETE /api/produtos/:id/plataformas/:plataforma — desvincula (remove só
 * o mapeamento local). Não chama a plataforma — o item real lá continua
 * como está, só paramos de gerenciá-lo por aqui.
 */
router.delete(
  '/:id/plataformas/:plataforma',
  asyncHandler(async (req, res) => {
    const { id, plataforma } = req.params;
    const vinculo = await prisma.produtoPlataforma.findUnique({
      where: { produtoId_plataforma: { produtoId: id, plataforma } },
    });
    if (!vinculo) return res.status(404).json({ error: 'Vínculo não encontrado' });

    await prisma.produtoPlataforma.delete({ where: { id: vinculo.id } });
    res.status(204).end();
  })
);

/**
 * POST /api/produtos — cria um produto, opcionalmente já com os
 * mapeamentos de plataforma.
 * Body: { nome, descricao?, precoCentavos, externalCode?,
 *         plataformas?: [{ plataforma, itemId, precoCentavos? }] }
 */
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const { nome, descricao, precoCentavos, externalCode, plataformas } = req.body;

    if (!nome || typeof precoCentavos !== 'number') {
      return res.status(400).json({ error: 'nome e precoCentavos (number, em centavos) são obrigatórios' });
    }

    const produto = await prisma.produto.create({
      data: {
        nome,
        descricao,
        precoCentavos,
        externalCode,
        plataformas: plataformas?.length
          ? {
              create: plataformas.map((p) => ({
                plataforma: p.plataforma,
                itemId: p.itemId,
                precoCentavos: p.precoCentavos,
              })),
            }
          : undefined,
      },
      include: { plataformas: true },
    });

    res.status(201).json(produto);
  })
);

/**
 * Fluxo comum a pausar/despausar (ver resumo técnico):
 *   1. busca no banco o ID do produto em cada plataforma
 *   2. chama getValidToken() por plataforma (dentro dos conectores, renova se expirado)
 *   3. dispara a chamada real para cada plataforma em paralelo
 *   4. atualiza status no próprio banco (só nas plataformas que confirmaram sucesso)
 *   5. responde ao frontend com o resultado por plataforma
 */
async function alterarStatusEmTodasAsPlataformas(produtoId, { statusFinal, acao }) {
  const produto = await prisma.produto.findUnique({
    where: { id: produtoId },
    include: { plataformas: true },
  });
  if (!produto) return { notFound: true };

  const execucoes = await Promise.allSettled(
    produto.plataformas.map((pp) => {
      const conector = CONECTORES[pp.plataforma];
      if (!conector) {
        return Promise.reject(new Error(`Nenhum conector disponível para a plataforma "${pp.plataforma}"`));
      }
      return conector[acao](pp.itemId);
    })
  );

  const resultados = produto.plataformas.map((pp, i) => {
    const execucao = execucoes[i];
    return {
      plataforma: pp.plataforma,
      itemId: pp.itemId,
      sucesso: execucao.status === 'fulfilled',
      erro: execucao.status === 'rejected' ? execucao.reason.message : undefined,
    };
  });

  // Só marca como sincronizada (status + sincronizadoEm) a plataforma que
  // confirmou sucesso na chamada real — uma falha isolada não deve mentir
  // sobre o estado real naquela plataforma.
  const atualizacoesPlataforma = produto.plataformas
    .filter((_pp, i) => resultados[i].sucesso)
    .map((pp) =>
      prisma.produtoPlataforma.update({
        where: { id: pp.id },
        data: { status: statusFinal, sincronizadoEm: new Date() },
      })
    );

  const [produtoAtualizado] = await prisma.$transaction([
    prisma.produto.update({ where: { id: produtoId }, data: { status: statusFinal } }),
    ...atualizacoesPlataforma,
  ]);

  return { produto: produtoAtualizado, resultados };
}

/** POST /api/produtos/:id/pausar — pausa o produto em todas as plataformas mapeadas. */
router.post(
  '/:id/pausar',
  asyncHandler(async (req, res) => {
    const resultado = await alterarStatusEmTodasAsPlataformas(req.params.id, {
      statusFinal: 'PAUSADO',
      acao: 'pausar',
    });
    if (resultado.notFound) return res.status(404).json({ error: 'Produto não encontrado' });
    res.json(resultado);
  })
);

/** POST /api/produtos/:id/despausar — reativa o produto em todas as plataformas mapeadas. */
router.post(
  '/:id/despausar',
  asyncHandler(async (req, res) => {
    const resultado = await alterarStatusEmTodasAsPlataformas(req.params.id, {
      statusFinal: 'ATIVO',
      acao: 'despausar',
    });
    if (resultado.notFound) return res.status(404).json({ error: 'Produto não encontrado' });
    res.json(resultado);
  })
);

module.exports = router;
