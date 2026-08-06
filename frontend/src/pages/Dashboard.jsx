import { useCallback, useEffect, useState } from 'react';
import { Package, CheckCircle2, DollarSign, ClipboardList } from 'lucide-react';
import { api } from '../lib/api.js';
import CardEstatistica from '../components/CardEstatistica.jsx';

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
    <div className="p-8">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-stone-900">Dashboard</h1>
        <p className="mt-1 text-sm text-stone-500">Visão geral do seu cardápio e pedidos</p>
      </header>

      {erro && (
        <div className="mt-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</div>
      )}

      {carregando ? (
        <p className="mt-8 text-sm text-stone-500">Carregando...</p>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <CardEstatistica Icone={Package} label="Total de produtos" valor={totalProdutos} />
            <CardEstatistica
              Icone={CheckCircle2}
              label="Produtos ativos"
              valor={produtosAtivos}
              sub={`${totalProdutos - produtosAtivos} sem venda ativa`}
              corIcone="text-emerald-600 bg-emerald-100"
            />
            <CardEstatistica
              Icone={DollarSign}
              label="Ticket médio"
              valor={formatarPreco(ticketMedio)}
              corIcone="text-amber-600 bg-amber-100"
            />
            <CardEstatistica
              Icone={ClipboardList}
              label="Pedidos hoje"
              valor={pedidosHoje}
              corIcone="text-rose-600 bg-rose-100"
            />
          </div>

          {pedidos.length > 0 && (
            <div className="mt-8">
              <h2 className="text-sm font-semibold text-stone-700">Pedidos recentes</h2>
              <div className="mt-3 overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm">
                {pedidos.slice(0, 5).map((pedido, i) => (
                  <div
                    key={pedido.id}
                    className={`flex items-center justify-between px-5 py-4 text-sm ${
                      i > 0 ? 'border-t border-stone-100' : ''
                    }`}
                  >
                    <span className="font-mono text-xs text-stone-500">{pedido.orderId}</span>
                    <span className="text-stone-600">{pedido.plataforma}</span>
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                        pedido.confirmadoEm ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                      }`}
                    >
                      {pedido.confirmadoEm ? 'Confirmado' : 'Pendente'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
