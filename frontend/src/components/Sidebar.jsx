import { LayoutDashboard, UtensilsCrossed, Package, ClipboardList, Settings } from 'lucide-react';

const ITENS = [
  { valor: 'dashboard', label: 'Dashboard', Icone: LayoutDashboard },
  { valor: 'cardapio', label: 'Cardápio', Icone: UtensilsCrossed },
  { valor: 'produtos', label: 'Produtos', Icone: Package },
  { valor: 'pedidos', label: 'Pedidos', Icone: ClipboardList },
  { valor: 'configuracoes', label: 'Configurações', Icone: Settings },
];

export default function Sidebar({ paginaAtual, onNavegar }) {
  return (
    <aside className="flex h-screen w-56 shrink-0 flex-col border-r border-stone-200 bg-white">
      <div className="flex items-center gap-2 px-5 py-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-orange-500 text-sm font-bold text-white">
          D
        </div>
        <span className="text-lg font-semibold text-stone-900">
          Deli<span className="text-orange-500">Hub</span>
        </span>
      </div>

      <nav className="flex flex-1 flex-col gap-1 px-3">
        {ITENS.map(({ valor, label, Icone }) => {
          const ativo = paginaAtual === valor;
          return (
            <button
              key={valor}
              type="button"
              onClick={() => onNavegar(valor)}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
                ativo ? 'bg-stone-900 text-white' : 'text-stone-600 hover:bg-stone-100'
              }`}
            >
              <Icone size={18} strokeWidth={2} />
              {label}
            </button>
          );
        })}
      </nav>

      <div className="px-3 pb-5 text-xs text-stone-400">Versão 0.1.0</div>
    </aside>
  );
}
