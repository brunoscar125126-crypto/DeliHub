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

  buscarHorario: () => request('/api/horario'),
  salvarHorario: (plataforma, turnos) =>
    request(`/api/horario/${plataforma}`, { method: 'PUT', body: JSON.stringify({ turnos }) }),
  criarPausaIfood: ({ descricao, inicio, fim }) =>
    request('/api/horario/ifood/pausa', { method: 'POST', body: JSON.stringify({ descricao, inicio, fim }) }),
  cancelarPausaIfood: (interrupcaoId) =>
    request(`/api/horario/ifood/pausa/${interrupcaoId}`, { method: 'DELETE' }),
  criarPausaNoventaENove: ({ duracao, motivoCode, autoRetomar }) =>
    request('/api/horario/noventaenove/pausa', {
      method: 'POST',
      body: JSON.stringify({ duracao, motivoCode, autoRetomar }),
    }),
};
