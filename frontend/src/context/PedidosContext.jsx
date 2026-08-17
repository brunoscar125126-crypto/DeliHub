import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from '../lib/api.js';

// Intervalo do polling "quase tempo real" dos pedidos. GET /api/webhooks/pedidos
// não tem rate limit (lê só do nosso banco, não bate na API das plataformas).
const INTERVALO_POLLING_MS = 8000;

const PedidosContext = createContext(null);

/**
 * Fonte única do estado de pedidos, levantada pro nível do App (em vez de
 * cada página ter seu próprio polling) — assim navegar entre páginas não
 * derruba o polling nem faz cada tela buscar a lista de novo do zero.
 *
 * O DeliHub não decide mais aceitar/recusar pedido (isso passou a ser feito
 * direto no app oficial de cada plataforma) — este contexto só expõe o
 * histórico/status de cada pedido pra leitura, sem nenhuma ação associada.
 */
export function PedidosProvider({ children }) {
  const [pedidos, setPedidos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);

  const carregar = useCallback(async (silencioso = false) => {
    if (!silencioso) setCarregando(true);
    setErro(null);
    try {
      setPedidos(await api.listarPedidos());
    } catch (err) {
      setErro(err.message);
    } finally {
      if (!silencioso) setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregar();
    const intervalo = setInterval(() => carregar(true), INTERVALO_POLLING_MS);
    return () => clearInterval(intervalo);
  }, [carregar]);

  const valor = {
    pedidos,
    carregando,
    erro,
    recarregar: carregar,
    intervaloPollingMs: INTERVALO_POLLING_MS,
  };

  return <PedidosContext.Provider value={valor}>{children}</PedidosContext.Provider>;
}

/** Dados de pedidos (lista, loading, erro) + ação de recarregar. Só leitura. */
export function usePedidos() {
  const ctx = useContext(PedidosContext);
  if (!ctx) throw new Error('usePedidos precisa estar dentro de um <PedidosProvider>');
  return ctx;
}
