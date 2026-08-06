// Único lugar do frontend que fala com o backend. Dashboard/ProdutoCard
// nunca chamam fetch() diretamente, só as funções daqui.

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

async function request(path, options = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(data?.error ?? `Erro ${res.status}`);
  }
  return data;
}

export const api = {
  listarProdutos: () => request('/api/produtos'),
  criarProduto: (produto) => request('/api/produtos', { method: 'POST', body: JSON.stringify(produto) }),
  pausarProduto: (id) => request(`/api/produtos/${id}/pausar`, { method: 'POST' }),
  despausarProduto: (id) => request(`/api/produtos/${id}/despausar`, { method: 'POST' }),
  previewImportacao: (plataforma) => request(`/api/importacao/${plataforma}/preview`),
  confirmarImportacao: (itens) =>
    request('/api/importacao/confirmar', { method: 'POST', body: JSON.stringify({ itens }) }),
};
