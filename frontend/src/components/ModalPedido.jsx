import { useState } from 'react';
import PlatformBadge from './PlatformBadge.jsx';
import StatusBadge from './StatusBadge.jsx';

function formatarPreco(centavos) {
  if (centavos == null) return '—';
  return (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// Mesma lógica de Pedidos.jsx/Dashboard.jsx: o campo de valor varia por
// plataforma/versão do payload, então pega o primeiro numérico plausível.
function precoTotal(price) {
  if (!price) return null;
  return price.real_price ?? price.order_price ?? price.total ?? null;
}

// Endereço de entrega também varia por plataforma — monta uma linha só com
// o que existir, sem assumir campos fixos.
function formatarEndereco(endereco) {
  if (!endereco || typeof endereco !== 'object') return null;
  const partes = [
    [endereco.first_name, endereco.last_name].filter(Boolean).join(' ') || endereco.name,
    endereco.street_name &&
      `${endereco.street_name}${endereco.street_number ? `, ${endereco.street_number}` : ''}`,
    endereco.complement,
    endereco.district,
    endereco.city,
    endereco.state,
    endereco.postal_code,
  ].filter(Boolean);
  return partes.length > 0 ? partes.join(' — ') : null;
}

/** Um item do pedido, com seus sub-itens (opções/adicionais) recursivamente. */
function ItemPedido({ item, nivel = 0 }) {
  const subitens = Array.isArray(item.sub_item_list) ? item.sub_item_list : [];
  return (
    <div className={nivel > 0 ? 'ml-4 border-l border-border pl-3' : ''}>
      <div className="flex items-center justify-between gap-3 py-1 text-sm">
        <span className={nivel === 0 ? 'font-medium text-text-primary' : 'text-text-secondary'}>
          {item.amount > 1 ? `${item.amount}× ` : ''}
          {item.name}
        </span>
        <span className="shrink-0 text-text-secondary">{formatarPreco(item.total_price ?? item.sku_price)}</span>
      </div>
      {subitens.map((sub, i) => (
        <ItemPedido key={i} item={sub} nivel={nivel + 1} />
      ))}
    </div>
  );
}

/**
 * Detalhe completo de um pedido — tudo que a plataforma manda, não só o
 * resumo da tabela. `pedido` é o registro do backend (já traz shop/price/
 * receiveAddress/orderItems/payloadBruto prontos, sem precisar de rota nova).
 */
export default function ModalPedido({ pedido, onFechar }) {
  const [verJsonCompleto, setVerJsonCompleto] = useState(false);

  if (!pedido) return null;

  const itens = Array.isArray(pedido.orderItems) ? pedido.orderItems : [];
  const endereco = formatarEndereco(pedido.receiveAddress);
  const shop = pedido.shop ?? {};

  return (
    <div className="fixed inset-0 z-10 flex items-center justify-center bg-black/30 px-4">
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-card bg-surface shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b border-border px-6 py-4">
          <div>
            <div className="flex items-center gap-2">
              <PlatformBadge plataforma={pedido.plataforma} />
              {pedido.confirmadoEm ? (
                <StatusBadge variante="success">Confirmado</StatusBadge>
              ) : (
                <StatusBadge variante="warning">Pendente</StatusBadge>
              )}
            </div>
            <p className="mt-1.5 font-mono text-xs text-text-secondary">{pedido.orderId}</p>
          </div>
          <button
            type="button"
            onClick={onFechar}
            className="shrink-0 rounded-control px-2 py-1 text-sm text-text-secondary hover:bg-surface-muted"
          >
            Fechar
          </button>
        </div>

        <div className="overflow-y-auto px-6 py-4">
          <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <div>
              <p className="text-xs text-text-secondary">Valor total</p>
              <p className="font-medium text-text-primary">{formatarPreco(precoTotal(pedido.price))}</p>
            </div>
            <div>
              <p className="text-xs text-text-secondary">Recebido em</p>
              <p className="text-text-primary">{new Date(pedido.createdAt).toLocaleString('pt-BR')}</p>
            </div>
            {shop.shop_name && (
              <div className="col-span-2">
                <p className="text-xs text-text-secondary">Loja</p>
                <p className="text-text-primary">
                  {shop.shop_name}
                  {shop.shop_addr && ` — ${shop.shop_addr}`}
                </p>
              </div>
            )}
            {endereco && (
              <div className="col-span-2">
                <p className="text-xs text-text-secondary">Endereço de entrega</p>
                <p className="text-text-primary">{endereco}</p>
              </div>
            )}
          </div>

          {itens.length > 0 && (
            <div className="mt-4">
              <p className="text-xs font-medium uppercase tracking-wide text-text-secondary">Itens</p>
              <div className="mt-2 divide-y divide-border rounded-control border border-border px-3">
                {itens.map((item, i) => (
                  <ItemPedido key={i} item={item} />
                ))}
              </div>
            </div>
          )}

          <div className="mt-4">
            <button
              type="button"
              onClick={() => setVerJsonCompleto((v) => !v)}
              className="text-xs font-medium text-primary hover:text-primary-hover"
            >
              {verJsonCompleto ? '▾ Esconder' : '▸ Ver'} payload completo (JSON bruto)
            </button>
            {verJsonCompleto && (
              <pre className="mt-2 max-h-64 overflow-auto rounded-control bg-surface-muted p-3 text-[11px] leading-relaxed text-text-primary">
                {JSON.stringify(pedido.payloadBruto ?? pedido, null, 2)}
              </pre>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
