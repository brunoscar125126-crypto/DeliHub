import { useState } from 'react';
import { api } from '../lib/api.js';

/**
 * Botão compacto de confirmar, pra usar dentro de uma linha de tabela (ex:
 * coluna "Confirmação" de Pedidos.jsx) sem precisar abrir o ModalPedido.
 * Só aparece pra pedidos pendentes de plataformas com confirmação manual
 * suportada (99Food, por enquanto).
 */
export default function BotaoConfirmarPedido({ pedido, onConfirmado }) {
  const [confirmando, setConfirmando] = useState(false);
  const [erro, setErro] = useState(null);

  async function confirmar(e) {
    e.stopPropagation(); // não deixa o clique também abrir o ModalPedido (linha é clicável)
    setConfirmando(true);
    setErro(null);
    try {
      const atualizado = await api.confirmarPedido(pedido.id);
      onConfirmado?.(atualizado);
    } catch (err) {
      setErro(err.message);
    } finally {
      setConfirmando(false);
    }
  }

  if (pedido.plataforma !== 'noventaenove') {
    return <span className="text-xs text-text-secondary">Pendente</span>;
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={confirmar}
        disabled={confirmando}
        title={erro ?? 'Confirma o pedido na 99Food antes que ela cancele sozinha (até 5min)'}
        className="rounded-control bg-primary px-2.5 py-1 text-xs font-medium text-white transition-opacity duration-150 hover:opacity-90 disabled:opacity-50"
      >
        {confirmando ? 'Confirmando...' : 'Confirmar'}
      </button>
      {erro && <span className="text-xs text-danger">falhou</span>}
    </div>
  );
}
