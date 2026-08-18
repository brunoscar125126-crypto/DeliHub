import { useCallback, useEffect, useMemo, useState } from 'react';
import { Package, CheckCircle2, DollarSign, ClipboardList, Receipt } from 'lucide-react';
import { api } from '../lib/api.js';
import { usePedidos } from '../context/PedidosContext.jsx';
import { statusEhCancelado } from '../lib/statusPedido.js';
import PageHeader from '../components/PageHeader.jsx';
import MetricCard from '../components/MetricCard.jsx';
import PlatformBadge from '../components/PlatformBadge.jsx';
import EmptyState from '../components/EmptyState.jsx';

function formatarPreco(centavos) {
  return ((centavos ?? 0) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// O formato de `price` varia por plataforma/versão do payload — pega o
// primeiro campo numérico plausível em vez de assumir um nome fixo.
function precoTotal(price) {
  if (!price) return null;
  return price.real_price ?? price.order_price ?? price.total ?? null;
}

// "YYYY-MM-DD" a partir dos componentes locais (não toISOString, que usa
// UTC e pode virar o dia errado perto da meia-noite em fusos negativos).
function formatarDataInput(date) {
  const ano = date.getFullYear();
  const mes = String(date.getMonth() + 1).padStart(2, '0');
  const dia = String(date.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

function inicioDoDia(dataYMD) {
  return new Date(`${dataYMD}T00:00:00`);
}

function fimDoDia(dataYMD) {
  return new Date(`${dataYMD}T23:59:59.999`);
}

// Ordem fixa de exibição — mesmos valores usados em PlatformToken.platform/Pedido.plataforma.
const PLATAFORMAS = [
  { valor: 'ifood', label: 'iFood' },
  { valor: 'noventaenove', label: '99Food' },
  { valor: 'keeta', label: 'Keeta' },
];

// Intervalo do polling dos produtos (independente do de pedidos, que já vem
// do PedidosContext). GET /api/produtos também só lê do nosso banco.
const INTERVALO_POLLING_MS = 8000;

/**
 * Resumo financeiro/operacional por plataforma e período — total e
 * detalhado (iFood/99Food/Keeta). Só conta pedido NÃO cancelado (novo,
 * confirmado, entregue etc. todos contam — só cancelado fica de fora; ver
 * statusEhCancelado). "Pedidos recentes" saiu daqui, mora só na página
 * Pedidos agora, pra não aparecer duplicado.
 */
export default function VisaoGeral() {
  const { pedidos } = usePedidos();

  const [produtos, setProdutos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);

  const hoje = useMemo(() => new Date(), []);
  const trintaDiasAtras = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 29);
    return d;
  }, []);
  const [dataInicio, setDataInicio] = useState(() => formatarDataInput(trintaDiasAtras));
  const [dataFim, setDataFim] = useState(() => formatarDataInput(hoje));

  const carregarProdutos = useCallback(async (silencioso = false) => {
    if (!silencioso) setCarregando(true);
    setErro(null);
    try {
      setProdutos(await api.listarProdutos());
    } catch (err) {
      setErro(err.message);
    } finally {
      if (!silencioso) setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregarProdutos();
    const intervalo = setInterval(() => carregarProdutos(true), INTERVALO_POLLING_MS);
    return () => clearInterval(intervalo);
  }, [carregarProdutos]);

  const resumo = useMemo(() => {
    const inicio = inicioDoDia(dataInicio);
    const fim = fimDoDia(dataFim);

    const porPlataforma = Object.fromEntries(PLATAFORMAS.map((p) => [p.valor, { faturamento: 0, pedidos: 0 }]));

    for (const pedido of pedidos) {
      const criadoEm = new Date(pedido.createdAt);
      if (criadoEm < inicio || criadoEm > fim) continue;
      if (statusEhCancelado(pedido.statusEvento)) continue;

      if (!porPlataforma[pedido.plataforma]) porPlataforma[pedido.plataforma] = { faturamento: 0, pedidos: 0 };
      porPlataforma[pedido.plataforma].faturamento += precoTotal(pedido.price) ?? 0;
      porPlataforma[pedido.plataforma].pedidos += 1;
    }

    const faturamentoTotal = Object.values(porPlataforma).reduce((soma, v) => soma + v.faturamento, 0);
    const pedidosTotal = Object.values(porPlataforma).reduce((soma, v) => soma + v.pedidos, 0);

    return { porPlataforma, faturamentoTotal, pedidosTotal };
  }, [pedidos, dataInicio, dataFim]);

  const ticketMedioPeriodo = resumo.pedidosTotal > 0 ? resumo.faturamentoTotal / resumo.pedidosTotal : 0;

  const totalProdutos = produtos.length;
  const produtosAtivos = produtos.filter((p) => p.plataformas.some((pp) => pp.status === 'ATIVO')).length;

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <PageHeader
        titulo="Visão Geral"
        subtitulo="Resumo financeiro e operacional por plataforma e período"
        acoes={
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <label className="flex items-center gap-1.5 text-text-secondary">
              de
              <input
                type="date"
                value={dataInicio}
                max={dataFim}
                onChange={(e) => setDataInicio(e.target.value)}
                className="rounded-control border border-border bg-surface px-2.5 py-1.5 text-text-primary"
              />
            </label>
            <label className="flex items-center gap-1.5 text-text-secondary">
              até
              <input
                type="date"
                value={dataFim}
                min={dataInicio}
                max={formatarDataInput(hoje)}
                onChange={(e) => setDataFim(e.target.value)}
                className="rounded-control border border-border bg-surface px-2.5 py-1.5 text-text-primary"
              />
            </label>
          </div>
        }
      />

      {erro && (
        <div className="mt-4 rounded-card border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-danger">{erro}</div>
      )}

      {carregando ? (
        <EmptyState>Carregando...</EmptyState>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <MetricCard
              Icone={DollarSign}
              label="Faturamento total"
              valor={formatarPreco(resumo.faturamentoTotal)}
              sub="não cancelados, no período"
              corIcone="text-success bg-emerald-50"
            />
            <MetricCard
              Icone={ClipboardList}
              label="Total de pedidos"
              valor={resumo.pedidosTotal}
              sub="não cancelados, no período"
              corIcone="text-danger bg-rose-50"
            />
            <MetricCard
              Icone={Receipt}
              label="Ticket médio"
              valor={formatarPreco(ticketMedioPeriodo)}
              sub="no período"
              corIcone="text-warning bg-amber-50"
            />
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <BlocoPorPlataforma
              titulo="Faturamento por plataforma"
              formatarValor={(v) => formatarPreco(v.faturamento)}
              porPlataforma={resumo.porPlataforma}
            />
            <BlocoPorPlataforma
              titulo="Pedidos por plataforma"
              formatarValor={(v) => String(v.pedidos)}
              porPlataforma={resumo.porPlataforma}
            />
          </div>

          <div className="mt-8">
            <h2 className="text-sm font-semibold text-text-secondary">Cardápio</h2>
            <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <MetricCard Icone={Package} label="Total de produtos" valor={totalProdutos} />
              <MetricCard
                Icone={CheckCircle2}
                label="Produtos ativos"
                valor={produtosAtivos}
                sub={`${totalProdutos - produtosAtivos} sem venda ativa`}
                corIcone="text-success bg-emerald-50"
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/** Um card com os 3 valores por plataforma lado a lado (faturamento OU contagem de pedidos, conforme `formatarValor`). */
function BlocoPorPlataforma({ titulo, formatarValor, porPlataforma }) {
  return (
    <div className="rounded-card border border-border bg-surface p-5 shadow-card">
      <p className="text-sm text-text-secondary">{titulo}</p>
      <div className="mt-4 grid grid-cols-3 gap-3">
        {PLATAFORMAS.map(({ valor }) => (
          <div key={valor}>
            <PlatformBadge plataforma={valor} />
            <p className="mt-2 text-lg font-semibold text-text-primary">
              {formatarValor(porPlataforma[valor] ?? { faturamento: 0, pedidos: 0 })}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
