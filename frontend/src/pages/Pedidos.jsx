import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api.js';

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

  return (
    <div className="p-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-stone-900">Pedidos</h1>
          <p className="mt-1 text-sm text-stone-500">Pedidos recebidos via webhook/polling das plataformas</p>
        </div>
        <button
          type="button"
          onClick={carregar}
          className="rounded-md border border-stone-300 px-3 py-1.5 text-sm text-stone-600 hover:bg-stone-100"
        >
          Atualizar
        </button>
      </header>

      {erro && <div className="mt-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</div>}

      {carregando ? (
        <p className="mt-8 text-sm text-stone-500">Carregando...</p>
      ) : pedidos.length === 0 ? (
        <p className="mt-8 text-sm text-stone-500">Nenhum pedido recebido ainda.</p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-lg border border-stone-200 bg-white">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-stone-200 text-xs uppercase tracking-wide text-stone-400">
                <th className="px-4 py-3 font-medium">Pedido</th>
                <th className="px-4 py-3 font-medium">Plataforma</th>
                <th className="px-4 py-3 font-medium">Itens</th>
                <th className="px-4 py-3 font-medium">Valor</th>
                <th className="px-4 py-3 font-medium">Confirmação</th>
                <th className="px-4 py-3 font-medium">Recebido em</th>
              </tr>
            </thead>
            <tbody>
              {pedidos.map((pedido) => (
                <tr key={pedido.id} className="border-b border-stone-100 last:border-0">
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs text-stone-600">{pedido.orderId}</span>
                  </td>
                  <td className="px-4 py-3 text-sm text-stone-700">
                    {PLATAFORMA_LABEL[pedido.plataforma] ?? pedido.plataforma}
                  </td>
                  <td className="px-4 py-3 text-sm text-stone-600">
                    {Array.isArray(pedido.orderItems) ? pedido.orderItems.length : 0} item(ns)
                  </td>
                  <td className="px-4 py-3 text-sm text-stone-700">{formatarPreco(precoTotal(pedido.price))}</td>
                  <td className="px-4 py-3">
                    {pedido.confirmadoEm ? (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                        Confirmado
                      </span>
                    ) : (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                        Pendente
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-stone-500">
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
