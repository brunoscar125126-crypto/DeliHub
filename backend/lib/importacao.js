// Módulo de importação de cardápio — puxa os produtos já existentes numa
// plataforma (via list/categories dos conectores) e normaliza pro formato
// interno comum, pensando no onboarding do futuro SaaS: um novo lojista não
// cadastra produto a produto, a gente importa o cardápio que ele já tem.
//
// Fluxo: buscar (conectores) → normalizar (formato comum) → prévia (marca
// o que já foi importado + sugere matches por nome entre plataformas) →
// confirmar (rotas/importacao.js decide criar produto novo ou mesclar).

const noventaenove = require('../connectors/noventaenove');
const ifood = require('../connectors/ifood');
const prisma = require('./prisma');

const IFOOD_MERCHANT_ID = process.env.IFOOD_MERCHANT_ID;

/**
 * Busca e normaliza o cardápio da 99Food pro formato interno comum.
 *
 * Atenção: item/item/list tem rate limit de 2 chamadas a cada 120s
 * (confirmado na prática — errno 10005 "The calling frequency exceeds the
 * setting"). Evitar chamar preVisualizarImportacao('noventaenove') em loop
 * ou em cada re-render do frontend; só sob ação explícita do usuário.
 */
async function buscarCardapioNoventaENove() {
  const resposta = await noventaenove.listarCardapio();
  if (resposta.errno !== 0) {
    throw new Error(`Falha ao buscar cardápio da 99Food [errno ${resposta.errno}]: ${resposta.errmsg}`);
  }

  const itens = resposta.data?.items ?? [];
  return itens.map((item) => ({
    plataforma: 'noventaenove',
    itemId: item.app_item_id,
    nome: item.item_name,
    descricao: item.short_desc || null,
    precoCentavos: item.price ?? null,
  }));
}

/** Busca e normaliza o cardápio do iFood pro formato interno comum. */
async function buscarCardapioIfood() {
  if (!IFOOD_MERCHANT_ID) {
    throw new Error('IFOOD_MERCHANT_ID não configurado — necessário pra importar o cardápio do iFood');
  }

  const catalogos = await ifood.listarCatalogos(IFOOD_MERCHANT_ID);
  const itens = [];

  for (const catalogo of catalogos) {
    const categorias = await ifood.listarCategorias(IFOOD_MERCHANT_ID, catalogo.catalogId, {
      includeItems: true,
    });
    for (const categoria of categorias) {
      for (const item of categoria.items ?? []) {
        itens.push({
          plataforma: 'ifood',
          itemId: item.id,
          nome: item.name,
          descricao: item.description || null,
          precoCentavos: item.price?.value ?? null,
          categoria: categoria.name,
        });
      }
    }
  }

  return itens;
}

const BUSCADORES = {
  noventaenove: buscarCardapioNoventaENove,
  ifood: buscarCardapioIfood,
};

function normalizarNome(nome) {
  return nome.trim().toLowerCase();
}

/**
 * Busca o cardápio de uma plataforma e enriquece cada item com:
 *  - jaImportado / produtoId: se esse item já está mapeado no nosso banco
 *  - sugestaoMatchId: um Produto existente (de outra importação) com nome
 *    igual, pra ajudar o "matching/merge assistido" entre plataformas —
 *    é só uma sugestão, quem decide mesclar ou criar novo é o chamador.
 */
async function preVisualizarImportacao(plataforma) {
  const buscar = BUSCADORES[plataforma];
  if (!buscar) {
    throw new Error(`Plataforma desconhecida: "${plataforma}"`);
  }

  const itens = await buscar();
  const itemIds = itens.map((i) => i.itemId);

  const [jaImportados, produtosExistentes] = await Promise.all([
    prisma.produtoPlataforma.findMany({
      where: { plataforma, itemId: { in: itemIds.length ? itemIds : ['__nenhum__'] } },
      select: { itemId: true, produtoId: true },
    }),
    prisma.produto.findMany({ select: { id: true, nome: true } }),
  ]);

  const mapaImportados = new Map(jaImportados.map((pp) => [pp.itemId, pp.produtoId]));
  const mapaPorNome = new Map(produtosExistentes.map((p) => [normalizarNome(p.nome), p.id]));

  return itens.map((item) => {
    const jaImportado = mapaImportados.has(item.itemId);
    return {
      ...item,
      jaImportado,
      produtoId: mapaImportados.get(item.itemId) ?? null,
      sugestaoMatchId: jaImportado ? null : (mapaPorNome.get(normalizarNome(item.nome)) ?? null),
    };
  });
}

module.exports = { preVisualizarImportacao };
