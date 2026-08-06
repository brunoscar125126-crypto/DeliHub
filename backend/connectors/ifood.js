// Conector iFood — toda a comunicação com a Merchant API do iFood passa por
// aqui. O resto do sistema (rotas, dashboard, financeiro) nunca chama a API
// do iFood diretamente, só este módulo.
//
// Host: https://merchant-api.ifood.com.br
//
// Autenticação: getValidToken('ifood') (lib/tokenManager.js) cuida de
// gerar/renovar o accessToken automaticamente. Aqui só consumimos o token —
// nunca chamar /authentication/v1.0/oauth/token diretamente neste módulo.
// Uso: header `Authorization: Bearer {accessToken}` (diferente da 99Food,
// que manda o token via query string).
//
// Preços em centavos. externalCode é o "código PDV" — usar como referência
// única do produto, é o campo pensado pro matching entre plataformas.

const axios = require('axios');
const crypto = require('crypto');
const { getValidToken } = require('../lib/tokenManager');

const BASE_URL = 'https://merchant-api.ifood.com.br';

// Status de disponibilidade do item no iFood (ver resumo técnico).
const ITEM_STATUS = {
  DISPONIVEL: 'AVAILABLE',
  PAUSADO: 'UNAVAILABLE',
};

async function authHeaders() {
  const token = await getValidToken('ifood');
  return { Authorization: `Bearer ${token}` };
}

/**
 * Lista as lojas (merchants) vinculadas às credenciais.
 * Doc: GET /merchant/v1.0/merchants
 */
async function listarLojas() {
  const headers = await authHeaders();
  const { data } = await axios.get(`${BASE_URL}/merchant/v1.0/merchants`, { headers });
  return data;
}

/**
 * Lista os catálogos de uma loja.
 * Doc: GET /catalog/v2.0/merchants/{merchantId}/catalogs
 */
async function listarCatalogos(merchantId) {
  const headers = await authHeaders();
  const { data } = await axios.get(`${BASE_URL}/catalog/v2.0/merchants/${merchantId}/catalogs`, {
    headers,
  });
  return data;
}

/**
 * Lista as categorias de um catálogo (com itens, por padrão).
 * Doc: GET /catalog/v2.0/merchants/{merchantId}/catalogs/{catalogId}/categories?include_items=true
 *
 * Obs: após criar um item, ele pode não aparecer aqui imediatamente
 * (indexação com delay) — nesse caso confirme direto via buscarItemPorId().
 */
async function listarCategorias(merchantId, catalogId, { includeItems = true } = {}) {
  const headers = await authHeaders();
  const { data } = await axios.get(
    `${BASE_URL}/catalog/v2.0/merchants/${merchantId}/catalogs/${catalogId}/categories`,
    { headers, params: { include_items: includeItems } }
  );
  return data;
}

/**
 * Cria uma categoria em um catálogo.
 * Doc: POST /catalog/v2.0/merchants/{merchantId}/catalogs/{catalogId}/categories
 *
 * Categoria de pizza é um template especial (`template: "PIZZA"`), com
 * grupos de complementos obrigatórios (tamanho, massa, borda, sabor) — não
 * modelado aqui, `categoria` é repassado como veio.
 */
async function criarCategoria(merchantId, catalogId, categoria) {
  const headers = await authHeaders();
  const { data } = await axios.post(
    `${BASE_URL}/catalog/v2.0/merchants/${merchantId}/catalogs/${catalogId}/categories`,
    categoria,
    { headers }
  );
  return data;
}

/**
 * Cria ou atualiza um item completo (item + produto).
 * Doc: PUT /catalog/v2.0/merchants/{merchantId}/items
 *
 * O iFood exige `item.productId` e `products[0].id` com o MESMO uuid,
 * linkando as duas entidades. Se `payload` não trouxer esses campos já
 * preenchidos (ex: numa atualização, reaproveitando o id existente), geramos
 * um uuid novo aqui automaticamente.
 */
async function criarOuAtualizarItem(payload) {
  const headers = await authHeaders();

  const productId = payload.item?.productId ?? payload.products?.[0]?.id ?? crypto.randomUUID();
  const [firstProduct, ...restProducts] = payload.products ?? [{}];

  const body = {
    ...payload,
    item: { ...payload.item, productId },
    products: [{ ...firstProduct, id: productId }, ...restProducts],
  };

  const { data } = await axios.put(`${BASE_URL}/catalog/v2.0/merchants/${payload.merchantId}/items`, body, {
    headers,
  });
  return data;
}

/**
 * Busca um item pelo ID — útil para confirmar a criação de um item que
 * ainda não apareceu na listagem por categoria (delay de indexação).
 * Doc: GET /catalog/v2.0/merchants/{merchantId}/items/{itemId}
 */
async function buscarItemPorId(merchantId, itemId) {
  const headers = await authHeaders();
  const { data } = await axios.get(`${BASE_URL}/catalog/v2.0/merchants/${merchantId}/items/${itemId}`, {
    headers,
  });
  return data;
}

/**
 * Muda o status de disponibilidade de um item (pausar/despausar).
 * Doc: PATCH /catalog/v2.0/merchants/{merchantId}/items/{itemId}/status
 *
 * @param {'AVAILABLE' | 'UNAVAILABLE'} status - use ITEM_STATUS.DISPONIVEL ou ITEM_STATUS.PAUSADO
 */
async function atualizarStatusItem(merchantId, itemId, status) {
  const headers = await authHeaders();
  const { data } = await axios.patch(
    `${BASE_URL}/catalog/v2.0/merchants/${merchantId}/items/${itemId}/status`,
    { status },
    { headers }
  );
  return data;
}

/** Pausa um item (equivalente ao teste já validado manualmente no ReqBin). */
async function pausarItem(merchantId, itemId) {
  return atualizarStatusItem(merchantId, itemId, ITEM_STATUS.PAUSADO);
}

/** Reativa um item. */
async function despausarItem(merchantId, itemId) {
  return atualizarStatusItem(merchantId, itemId, ITEM_STATUS.DISPONIVEL);
}

/**
 * Um dos dois jeitos de receber eventos da Events API do iFood (o outro é
 * webhook — ver routes/webhooks.js:/ifood — os dois ficam ativos ao mesmo
 * tempo neste projeto por enquanto). Aqui A GENTE puxa periodicamente
 * (polling, ~30s recomendado pela doc) e depois confirma o recebimento.
 * Doc: GET /events/v1.0/events:polling
 */
async function buscarEventosPendentes() {
  const headers = await authHeaders();
  const { data } = await axios.get(`${BASE_URL}/events/v1.0/events:polling`, { headers });
  // Sem eventos pendentes, a API responde 204/corpo vazio (string vazia via
  // axios, não null/undefined) — normaliza tudo que não for array pra [].
  return Array.isArray(data) ? data : [];
}

/**
 * Confirma o recebimento de eventos (obrigatório, senão o iFood reenvia).
 * Doc: POST /events/v1.0/events/acknowledgment
 * Body esperado: array de { id: eventId }.
 */
async function confirmarEventos(eventIds) {
  if (!eventIds?.length) return;
  const headers = await authHeaders();
  await axios.post(
    `${BASE_URL}/events/v1.0/events/acknowledgment`,
    eventIds.map((id) => ({ id })),
    { headers }
  );
}

/**
 * Busca o pedido completo — o evento de webhook/polling só traz
 * id/code/orderId, não o pedido em si (itens, cliente, endereço,
 * pagamento...). Testado contra um pedido real do Developer Portal.
 * Doc: GET /order/v1.0/orders/{orderId}
 */
async function buscarPedido(orderId) {
  const headers = await authHeaders();
  const { data } = await axios.get(`${BASE_URL}/order/v1.0/orders/${orderId}`, { headers });
  return data;
}

module.exports = {
  ITEM_STATUS,
  listarLojas,
  listarCatalogos,
  listarCategorias,
  criarCategoria,
  criarOuAtualizarItem,
  buscarItemPorId,
  atualizarStatusItem,
  pausarItem,
  despausarItem,
  buscarEventosPendentes,
  confirmarEventos,
  buscarPedido,
};
