import { useCallback, useEffect, useState } from 'react';
import { ClipboardList, DollarSign, Clock } from 'lucide-react';
import { api } from '../lib/api.js';
import CardEstatistica from '../components/CardEstatistica.jsx';

const PLATAFORMA_LABEL = { noventaenove: '99Food', ifood: 'iFood' };

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

  return (
    <div className="p-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-stone-900">Pedidos</h1>
          <p className="mt-1 text-sm text-stone-500">Pedidos recebidos via webhook/polling das plataformas</p>
        </div>
        <button
          type="button"
          onClick={carregar}
          className="rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-600 shadow-sm hover:bg-stone-50"
        >
          Atualizar
        </button>
      </header>

      {erro && (
        <div className="mt-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</div>
      )}

      {!carregando && pedidos.length > 0 && (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <CardEstatistica Icone={ClipboardList} label="Total de pedidos" valor={pedidos.length} />
          <CardEstatistica
            Icone={DollarSign}
            label="Valor total hoje"
            valor={formatarPreco(valorHoje)}
            sub={`${pedidosHoje.length} pedido(s) hoje`}
            corIcone="text-emerald-600 bg-emerald-100"
          />
          <CardEstatistica
            Icone={Clock}
            label="Pedidos pendentes"
            valor={pendentes}
            sub="aguardando confirmação"
            corIcone="text-amber-600 bg-amber-100"
          />
        </div>
      )}

      {carregando ? (
        <p className="mt-8 text-sm text-stone-500">Carregando...</p>
      ) : pedidos.length === 0 ? (
        <p className="mt-8 text-sm text-stone-500">Nenhum pedido recebido ainda.</p>
      ) : (
        <div className="mt-6 overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-stone-200 bg-stone-50/60 text-xs uppercase tracking-wide text-stone-400">
                <th className="px-5 py-3.5 font-medium">Pedido</th>
                <th className="px-5 py-3.5 font-medium">Plataforma</th>
                <th className="px-5 py-3.5 font-medium">Itens</th>
                <th className="px-5 py-3.5 font-medium">Valor</th>
                <th className="px-5 py-3.5 font-medium">Confirmação</th>
                <th className="px-5 py-3.5 font-medium">Recebido em</th>
              </tr>
            </thead>
            <tbody>
              {pedidos.map((pedido) => (
                <tr key={pedido.id} className="border-b border-stone-100 last:border-0 hover:bg-stone-50/60">
                  <td className="px-5 py-4">
                    <span className="font-mono text-xs text-stone-600">{pedido.orderId}</span>
                  </td>
                  <td className="px-5 py-4">
                    <span className="rounded-full bg-stone-100 px-2.5 py-1 text-xs font-medium text-stone-600">
                      {PLATAFORMA_LABEL[pedido.plataforma] ?? pedido.plataforma}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-sm text-stone-600">
                    {Array.isArray(pedido.orderItems) ? pedido.orderItems.length : 0} item(ns)
                  </td>
                  <td className="px-5 py-4 text-sm font-medium text-stone-700">
                    {formatarPreco(precoTotal(pedido.price))}
                  </td>
                  <td className="px-5 py-4">
                    {pedido.confirmadoEm ? (
                      <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700">
                        Confirmado
                      </span>
                    ) : (
                      <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-700">
                        Pendente
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-4 text-sm text-stone-500">
                    {new Date(pedido.createdAt).toLocaleString('pt-BR')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
