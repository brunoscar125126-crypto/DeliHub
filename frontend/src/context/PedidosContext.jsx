import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { api } from '../lib/api.js';

// Intervalo do polling "quase tempo real" dos pedidos. GET /api/webhooks/pedidos
// não tem rate limit (lê só do nosso banco, não bate na API das plataformas).
const INTERVALO_POLLING_MS = 8000;

const PedidosContext = createContext(null);

/**
 * Fonte única do estado de pedidos, levantada pro nível do App (em vez de
 * cada página ter seu próprio polling) por dois motivos:
 * 1. Antes, só a página montada na hora fazia polling — navegar pra
 *    Produtos/Configurações "desligava" a detecção de pedido novo. Agora
 *    roda o tempo todo, não importa em qual página o usuário está.
 * 2. Um único ponto de detecção evita disparar som/notificação em
 *    duplicidade se mais de uma tela dependesse do mesmo pedido.
 *
 * Consumidores de dados usam usePedidos(); quem quer reagir a pedido novo
 * (som, notificação) usa usePedidosNovosListener() — mantém a camada de
 * dados separada do efeito colateral.
 */
export function PedidosProvider({ children }) {
  const [pedidos, setPedidos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);

  const idsConhecidosRef = useRef(new Set());
  const primeiraCargaFeitaRef = useRef(false);
  const listenersRef = useRef(new Set());

  const carregar = useCallback(async (silencioso = false) => {
    if (!silencioso) setCarregando(true);
    setErro(null);
    try {
      const dados = await api.listarPedidos();

      if (!primeiraCargaFeitaRef.current) {
        // Carga inicial: só estabelece a linha de base, não "descobre" N
        // pedidos novos de uma vez só (todo pedido já existente não é novo).
        dados.forEach((p) => idsConhecidosRef.current.add(p.id));
        primeiraCargaFeitaRef.current = true;
      } else {
        const novos = dados.filter((p) => !idsConhecidosRef.current.has(p.id));
        if (novos.length > 0) {
          novos.forEach((p) => idsConhecidosRef.current.add(p.id));
          listenersRef.current.forEach((cb) => cb(novos));
        }
      }

      setPedidos(dados);
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

  // Atualiza um pedido específico já carregado (ex: depois de confirmar) —
  // reflete na hora sem esperar o próximo tick do polling.
  const patchPedido = useCallback((atualizado) => {
    setPedidos((prev) => prev.map((p) => (p.id === atualizado.id ? atualizado : p)));
  }, []);

  // Registra um listener de "chegou pedido novo"; devolve a função de cancelar.
  const registrarListenerNovoPedido = useCallback((callback) => {
    listenersRef.current.add(callback);
    return () => listenersRef.current.delete(callback);
  }, []);

  const valor = {
    pedidos,
    carregando,
    erro,
    recarregar: carregar,
    patchPedido,
    registrarListenerNovoPedido,
    intervaloPollingMs: INTERVALO_POLLING_MS,
  };

  return <PedidosContext.Provider value={valor}>{children}</PedidosContext.Provider>;
}

/** Dados de pedidos (lista, loading, erro) + ações (recarregar, patchPedido). */
export function usePedidos() {
  const ctx = useContext(PedidosContext);
  if (!ctx) throw new Error('usePedidos precisa estar dentro de um <PedidosProvider>');
  return ctx;
}

/** Chama `callback(pedidosNovos)` toda vez que o polling detectar pedido(s) novo(s). */
export function usePedidosNovosListener(callback) {
  const { registrarListenerNovoPedido } = usePedidos();
  useEffect(() => registrarListenerNovoPedido(callback), [registrarListenerNovoPedido, callback]);
}
