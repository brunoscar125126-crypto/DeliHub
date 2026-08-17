import { useState } from 'react';
import { ClipboardList, DollarSign } from 'lucide-react';
import { usePedidos } from '../context/PedidosContext.jsx';
import PageHeader from '../components/PageHeader.jsx';
import MetricCard from '../components/MetricCard.jsx';
import DataTable from '../components/DataTable.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import PlatformBadge from '../components/PlatformBadge.jsx';
import EmptyState from '../components/EmptyState.jsx';
import ModalPedido from '../components/ModalPedido.jsx';
import { statusPedido } from '../lib/statusPedido.js';

function formatarPreco(centavos) {
  if (centavos == null) return '—';
  return (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// O formato de `price` varia por plataforma/versão do payload — pega o
// primeiro campo numérico plausível em vez de assumir um nome fixo.
function precoTotal(price) {
  if (!price) return null;
  return price.real_price ?? price.order_price ?? price.total ?? null;
}

function ehHoje(dataISO) {
  const d = new Date(dataISO);
  const hoje = new Date();
  return (
    d.getFullYear() === hoje.getFullYear() && d.getMonth() === hoje.getMonth() && d.getDate() === hoje.getDate()
  );
}

/**
 * Histórico/visualização de status — o DeliHub não decide mais aceitar ou
 * recusar pedido (isso é feito direto no app oficial de cada plataforma),
 * então essa tela não tem mais nenhuma ação, só mostra o status real que
 * cada plataforma reportou por último (novo/confirmado/pronto/saiu para
 * entrega/entregue/cancelado).
 */
export default function Pedidos() {
  const { pedidos, carregando, erro, recarregar, intervaloPollingMs } = usePedidos();

  const [pedidoSelecionadoId, setPedidoSelecionadoId] = useState(null);
  const pedidoSelecionado = pedidos.find((p) => p.id === pedidoSelecionadoId) ?? null;

  const pedidosHoje = pedidos.filter((p) => ehHoje(p.createdAt));
  const valorHoje = pedidosHoje.reduce((soma, p) => soma + (precoTotal(p.price) ?? 0), 0);

  const colunas = [
    {
      chave: 'orderId',
      label: 'Pedido',
      render: (p) => <span className="font-mono text-xs text-text-secondary">{p.orderId}</span>,
    },
    { chave: 'plataforma', label: 'Plataforma', render: (p) => <PlatformBadge plataforma={p.plataforma} /> },
    {
      chave: 'itens',
      label: 'Itens',
      render: (p) => `${Array.isArray(p.orderItems) ? p.orderItems.length : 0} item(ns)`,
    },
    {
      chave: 'valor',
      label: 'Valor',
      render: (p) => <span className="font-medium">{formatarPreco(precoTotal(p.price))}</span>,
    },
    {
      chave: 'status',
      label: 'Status',
      render: (p) => {
        const { label, variante } = statusPedido(p.statusEvento);
        return <StatusBadge variante={variante}>{label}</StatusBadge>;
      },
    },
    {
      chave: 'recebidoEm',
      label: 'Recebido em',
      render: (p) => new Date(p.createdAt).toLocaleString('pt-BR'),
    },
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <PageHeader
        titulo="Pedidos"
        subtitulo="Histórico de status dos pedidos — captado via webhook/polling das plataformas. Aceitar/recusar é feito no app oficial de cada uma."
        acoes={
          <div className="flex items-center gap-3">
            <span className="hidden items-center gap-1.5 text-xs text-text-secondary sm:flex">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success" />
              Atualiza a cada {intervaloPollingMs / 1000}s
            </span>
            <button
              type="button"
              onClick={() => recarregar()}
              className="min-h-[44px] rounded-control border border-border bg-surface px-4 py-2 text-sm font-medium text-text-secondary shadow-card transition-colors duration-150 hover:bg-surface-muted"
            >
              Atualizar
            </button>
          </div>
        }
      />

      {erro && (
        <div className="mt-4 rounded-card border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-danger">{erro}</div>
      )}

      {!carregando && pedidos.length > 0 && (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <MetricCard Icone={ClipboardList} label="Total de pedidos" valor={pedidos.length} />
          <MetricCard
            Icone={DollarSign}
            label="Valor total hoje"
            valor={formatarPreco(valorHoje)}
            sub={`${pedidosHoje.length} pedido(s) hoje`}
            corIcone="text-success bg-emerald-50"
          />
        </div>
      )}

      {carregando ? (
        <EmptyState>Carregando...</EmptyState>
      ) : pedidos.length === 0 ? (
        <EmptyState>Nenhum pedido recebido ainda.</EmptyState>
      ) : (
        <DataTable
          colunas={colunas}
          linhas={pedidos}
          chaveLinha={(p) => p.id}
          onLinhaClick={(p) => setPedidoSelecionadoId(p.id)}
        />
      )}

      {pedidoSelecionado && (
        <ModalPedido pedido={pedidoSelecionado} onFechar={() => setPedidoSelecionadoId(null)} />
      )}
    </div>
  );
}
