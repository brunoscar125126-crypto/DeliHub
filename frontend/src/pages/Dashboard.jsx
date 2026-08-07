import { useCallback, useEffect, useState } from 'react';
import { Package, CheckCircle2, DollarSign, ClipboardList } from 'lucide-react';
import { api } from '../lib/api.js';
import PageHeader from '../components/PageHeader.jsx';
import MetricCard from '../components/MetricCard.jsx';
import DataTable from '../components/DataTable.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import PlatformBadge from '../components/PlatformBadge.jsx';
import EmptyState from '../components/EmptyState.jsx';

function formatarPreco(centavos) {
  return (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function ehHoje(dataISO) {
  const d = new Date(dataISO);
  const hoje = new Date();
  return (
    d.getFullYear() === hoje.getFullYear() && d.getMonth() === hoje.getMonth() && d.getDate() === hoje.getDate()
  );
}

const COLUNAS_PEDIDOS_RECENTES = [
  {
    chave: 'orderId',
    label: 'Pedido',
    render: (p) => <span className="font-mono text-xs text-text-secondary">{p.orderId}</span>,
  },
  { chave: 'plataforma', label: 'Plataforma', render: (p) => <PlatformBadge plataforma={p.plataforma} /> },
  {
    chave: 'status',
    label: 'Status',
    render: (p) =>
      p.confirmadoEm ? (
        <StatusBadge variante="success">Confirmado</StatusBadge>
      ) : (
        <StatusBadge variante="warning">Pendente</StatusBadge>
      ),
  },
];

export default function Dashboard() {
  const [produtos, setProdutos] = useState([]);
  const [pedidos, setPedidos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const [p, ped] = await Promise.all([api.listarProdutos(), api.listarPedidos().catch(() => [])]);
      setProdutos(p);
      setPedidos(ped);
    } catch (err) {
      setErro(err.message);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const totalProdutos = produtos.length;
  const produtosAtivos = produtos.filter((p) => p.plataformas.some((pp) => pp.status === 'ATIVO')).length;
  const ticketMedio =
    produtos.length > 0 ? produtos.reduce((soma, p) => soma + p.precoCentavos, 0) / produtos.length : 0;
  const pedidosHoje = pedidos.filter((p) => ehHoje(p.createdAt)).length;

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <PageHeader titulo="Dashboard" subtitulo="Visão geral do seu cardápio e pedidos" />

      {erro && (
        <div className="mt-4 rounded-card border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-danger">{erro}</div>
      )}

      {carregando ? (
        <EmptyState>Carregando...</EmptyState>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard Icone={Package} label="Total de produtos" valor={totalProdutos} />
            <MetricCard
              Icone={CheckCircle2}
              label="Produtos ativos"
              valor={produtosAtivos}
              sub={`${totalProdutos - produtosAtivos} sem venda ativa`}
              corIcone="text-success bg-emerald-50"
            />
            <MetricCard
              Icone={DollarSign}
              label="Ticket médio"
              valor={formatarPreco(ticketMedio)}
              corIcone="text-warning bg-amber-50"
            />
            <MetricCard
              Icone={ClipboardList}
              label="Pedidos hoje"
              valor={pedidosHoje}
              corIcone="text-danger bg-rose-50"
            />
          </div>

          {pedidos.length > 0 && (
            <div className="mt-8">
              <h2 className="text-sm font-semibold text-text-secondary">Pedidos recentes</h2>
              <DataTable colunas={COLUNAS_PEDIDOS_RECENTES} linhas={pedidos.slice(0, 5)} chaveLinha={(p) => p.id} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
