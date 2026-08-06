// Conector 99Food — toda a comunicação com a OpenAPI da 99Food (DiDi Food)
// passa por aqui. O resto do sistema (rotas, dashboard, financeiro) nunca
// chama essa API diretamente, só este módulo.
//
// Host: https://openapi.didi-food.com
//
// Autenticação: getValidToken('noventaenove') (lib/tokenManager.js) cuida de
// gerar/renovar o auth_token automaticamente. Aqui só consumimos o token —
// nunca chamar /v1/auth/authtoken/get ou /refresh diretamente neste módulo.
// O auth_token vai sempre via query string em toda chamada (get e post),
// nunca como header — diferente do iFood.
//
// IDs (app, pedido, loja, item) são inteiros 64-bit: parseamos as respostas
// com json-bigint (storeAsString) em vez de JSON.parse puro, pra não perder
// precisão. Por consequência, todo item_id que circula por este módulo é
// string — passe sempre como string ao chamar estas funções.

const axios = require('axios');
const JSONbig = require('json-bigint')({ storeAsString: true });
const { getValidToken } = require('../lib/tokenManager');

const BASE_URL = 'https://openapi.didi-food.com';
const DEFAULT_SHOP_ID = process.env.NOVENTAENOVE_APP_SHOP_ID;

// Status de disponibilidade do item na 99Food (ver resumo técnico).
const ITEM_STATUS = {
  DISPONIVEL: 1,
  PAUSADO: 2,
};

const client = axios.create({
  baseURL: BASE_URL,
  // Parseia o corpo da resposta com json-bigint em vez do JSON.parse padrão
  // do axios, preservando IDs de 64 bits.
  transformResponse: [
    (data) => {
      if (typeof data !== 'string' || data.length === 0) return data;
      try {
        return JSONbig.parse(data);
      } catch {
        return data; // resposta não-JSON (ex: erro HTML/texto) — devolve como veio
      }
    },
  ],
});

/**
 * Monta os query params comuns a toda chamada: auth_token válido (renovado
 * automaticamente pelo tokenManager quando necessário) + app_shop_id.
 */
async function baseParams(extra = {}) {
  const auth_token = await getValidToken('noventaenove');
  return { auth_token, app_shop_id: DEFAULT_SHOP_ID, ...extra };
}

/**
 * Lista o cardápio completo da loja (menu → categoria → item → sub_item).
 * Doc: GET /v1/item/item/list
 */
async function listarCardapio(extraParams = {}) {
  const params = await baseParams(extraParams);
  const { data } = await client.get('/v1/item/item/list', { params });
  return data;
}

/**
 * Atualiza um item existente (preço, nome, descrição, etc.).
 * Doc: POST /v1/item/item/update
 *
 * `item` deve seguir o payload validado no ReqBin para este endpoint
 * (precisa incluir o identificador do item, `app_item_id` — confirmado via
 * listarCardapio() real). Preços em centavos.
 */
async function atualizarItem(item) {
  const params = await baseParams();
  const { data } = await client.post('/v1/item/item/update', item, { params });
  return data;
}

/**
 * Muda o status de disponibilidade de um item (pausar/despausar).
 * Doc: POST /v1/item/item/updateItemStatus
 *
 * @param {string} appItemId - o `app_item_id` retornado por listarCardapio()
 * @param {1 | 2} status - use ITEM_STATUS.DISPONIVEL ou ITEM_STATUS.PAUSADO
 */
async function atualizarStatusItem(appItemId, status) {
  const params = await baseParams();
  const { data } = await client.post(
    '/v1/item/item/updateItemStatus',
    { app_item_id: appItemId, status },
    { params }
  );
  return data;
}

/** Pausa um item (equivalente ao teste já validado manualmente no ReqBin). */
async function pausarItem(appItemId) {
  return atualizarStatusItem(appItemId, ITEM_STATUS.PAUSADO);
}

/** Reativa um item. */
async function despausarItem(appItemId) {
  return atualizarStatusItem(appItemId, ITEM_STATUS.DISPONIVEL);
}

module.exports = {
  ITEM_STATUS,
  listarCardapio,
  atualizarItem,
  atualizarStatusItem,
  pausarItem,
  despausarItem,
};
