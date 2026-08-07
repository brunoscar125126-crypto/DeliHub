import { useCallback, useEffect, useState } from 'react';
import { ClipboardList, DollarSign, Clock } from 'lucide-react';
import { api } from '../lib/api.js';
import PageHeader from '../components/PageHeader.jsx';
import MetricCard from '../components/MetricCard.jsx';
import DataTable from '../components/DataTable.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import PlatformBadge from '../components/PlatformBadge.jsx';
import EmptyState from '../components/EmptyState.jsx';

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

export default function Pedidos() {
  const [pedidos, setPedidos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      setPedidos(await api.listarPedidos());
    } catch (err) {
      setErro(err.message);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const pedidosHoje = pedidos.filter((p) => ehHoje(p.createdAt));
  const valorHoje = pedidosHoje.reduce((soma, p) => soma + (precoTotal(p.price) ?? 0), 0);
  const pendentes = pedidos.filter((p) => !p.confirmadoEm).length;

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
      chave: 'confirmacao',
      label: 'Confirmação',
      render: (p) =>
        p.confirmadoEm ? (
          <StatusBadge variante="success">Confirmado</StatusBadge>
        ) : (
          <StatusBadge variante="warning">Pendente</StatusBadge>
        ),
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
        subtitulo="Pedidos recebidos via webhook/polling das plataformas"
        acoes={
          <button
            type="button"
            onClick={carregar}
            className="min-h-[44px] rounded-control border border-border bg-surface px-4 py-2 text-sm font-medium text-text-secondary shadow-card transition-colors duration-150 hover:bg-surface-muted"
          >
            Atualizar
          </button>
        }
      />

      {erro && (
        <div className="mt-4 rounded-card border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-danger">{erro}</div>
      )}

      {!carregando && pedidos.length > 0 && (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <MetricCard Icone={ClipboardList} label="Total de pedidos" valor={pedidos.length} />
          <MetricCard
            Icone={DollarSign}
            label="Valor total hoje"
            valor={formatarPreco(valorHoje)}
            sub={`${pedidosHoje.length} pedido(s) hoje`}
            corIcone="text-success bg-emerald-50"
          />
          <MetricCard
            Icone={Clock}
            label="Pedidos pendentes"
            valor={pendentes}
            sub="aguardando confirmação"
            corIcone="text-warning bg-amber-50"
          />
        </div>
      )}

      {carregando ? (
        <EmptyState>Carregando...</EmptyState>
      ) : pedidos.length === 0 ? (
        <EmptyState>Nenhum pedido recebido ainda.</EmptyState>
      ) : (
        <DataTable colunas={colunas} linhas={pedidos} chaveLinha={(p) => p.id} />
      )}
    </div>
  );
}
