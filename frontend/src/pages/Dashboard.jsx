import { useCallback, useEffect, useState } from 'react';
import { Package, CheckCircle2, DollarSign, ClipboardList } from 'lucide-react';
import { api } from '../lib/api.js';

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

function CardEstatistica({ Icone, label, valor, sub }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-stone-200 bg-white p-4">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-orange-100 text-orange-600">
        <Icone size={18} />
      </div>
      <div>
        <p className="text-sm text-stone-500">{label}</p>
        <p className="text-xl font-semibold text-stone-900">{valor}</p>
        {sub && <p className="text-xs text-stone-400">{sub}</p>}
      </div>
    </div>
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
        <h1 className="text-2xl font-semibold text-stone-900">Dashboard</h1>
        <p className="mt-1 text-sm text-stone-500">Visão geral do seu cardápio e pedidos</p>
      </header>

      {erro && <div className="mt-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</div>}

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
            />
            <CardEstatistica Icone={DollarSign} label="Ticket médio" valor={formatarPreco(ticketMedio)} />
            <CardEstatistica Icone={ClipboardList} label="Pedidos hoje" valor={pedidosHoje} />
          </div>

          {pedidos.length > 0 && (
            <div className="mt-8">
              <h2 className="text-sm font-medium text-stone-700">Pedidos recentes</h2>
              <div className="mt-3 divide-y divide-stone-100 rounded-lg border border-stone-200 bg-white">
                {pedidos.slice(0, 5).map((pedido) => (
                  <div key={pedido.id} className="flex items-center justify-between px-4 py-3 text-sm">
                    <span className="font-mono text-xs text-stone-500">{pedido.orderId}</span>
                    <span className="text-stone-600">{pedido.plataforma}</span>
                    <span
                      className={
                        pedido.confirmadoEm ? 'text-xs text-emerald-600' : 'text-xs text-amber-600'
                      }
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
