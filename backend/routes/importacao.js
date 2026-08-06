const express = require('express');

const prisma = require('../lib/prisma');
const asyncHandler = require('../lib/asyncHandler');
const { preVisualizarImportacao } = require('../lib/importacao');

// Importação inicial de cardápio — puxa os produtos já existentes numa
// plataforma e deixa o usuário decidir, item a item, se cria um Produto
// novo ou mescla com um já existente (matching/merge assistido).

const router = express.Router();

/** GET /api/importacao/:plataforma/preview — busca o cardápio real, sem gravar nada. */
router.get(
  '/:plataforma/preview',
  asyncHandler(async (req, res) => {
    const itens = await preVisualizarImportacao(req.params.plataforma);
    res.json({ itens });
  })
);

/**
 * POST /api/importacao/confirmar — grava a importação.
 * Body: { itens: [{ plataforma, itemId, nome, precoCentavos, descricao?,
 *                    produtoExistenteId? }] }
 *
 * Sem produtoExistenteId: cria um Produto novo + o mapeamento de plataforma.
 * Com produtoExistenteId: só cria/atualiza o mapeamento, mesclando esse item
 * num Produto que já existe (ex: o mesmo prato já importado de outra
 * plataforma).
 */
router.post(
  '/confirmar',
  asyncHandler(async (req, res) => {
    const { itens } = req.body;
    if (!Array.isArray(itens) || itens.length === 0) {
      return res.status(400).json({ error: 'itens (array não vazio) é obrigatório' });
    }

    const resultados = [];
    for (const item of itens) {
      const { plataforma, itemId, nome, precoCentavos, descricao, produtoExistenteId } = item;

      if (!plataforma || !itemId) {
        resultados.push({ itemId, sucesso: false, erro: 'plataforma e itemId são obrigatórios' });
        continue;
      }

      try {
        if (produtoExistenteId) {
          const mapeamento = await prisma.produtoPlataforma.upsert({
            where: { plataforma_itemId: { plataforma, itemId } },
            update: { produtoId: produtoExistenteId },
            create: { plataforma, itemId, produtoId: produtoExistenteId },
          });
          resultados.push({ itemId, sucesso: true, produtoId: mapeamento.produtoId, modo: 'mesclado' });
        } else {
          if (!nome || typeof precoCentavos !== 'number') {
            throw new Error('nome e precoCentavos (number) são obrigatórios pra criar um produto novo');
          }
          const produto = await prisma.produto.create({
            data: {
              nome,
              descricao,
              precoCentavos,
              plataformas: { create: [{ plataforma, itemId }] },
            },
          });
          resultados.push({ itemId, sucesso: true, produtoId: produto.id, modo: 'novo' });
        }
      } catch (err) {
        resultados.push({ itemId, sucesso: false, erro: err.message });
      }
    }

    res.json({ resultados });
  })
);

module.exports = router;
