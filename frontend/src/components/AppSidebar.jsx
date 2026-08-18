import { LayoutDashboard, UtensilsCrossed, Package, ClipboardList, Settings } from 'lucide-react';
import LogoDeliHub from './LogoDeliHub.jsx';

const ITENS = [
  { valor: 'visaoGeral', label: 'Visão Geral', Icone: LayoutDashboard },
  { valor: 'cardapio', label: 'Cardápio', Icone: UtensilsCrossed },
  { valor: 'produtos', label: 'Produtos', Icone: Package },
  { valor: 'pedidos', label: 'Pedidos', Icone: ClipboardList },
  { valor: 'configuracoes', label: 'Configurações', Icone: Settings },
];

/**
 * Sidebar de navegação. Fixa em desktop; em mobile vira um drawer
 * (controlado por `aberta`/`onFechar`) que desliza por cima do conteúdo
 * com um overlay atrás.
 */
export default function AppSidebar({ paginaAtual, onNavegar, aberta, onFechar }) {
  return (
    <>
      {aberta && <div className="fixed inset-0 z-40 bg-black/30 md:hidden" onClick={onFechar} aria-hidden="true" />}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 shrink-0 flex-col border-r border-border bg-surface transition-transform duration-200 md:static md:z-auto md:w-56 md:translate-x-0 ${
          aberta ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center gap-2 px-5 py-5">
          <LogoDeliHub altura={30} />
        </div>

        <nav className="flex flex-1 flex-col gap-1 px-3">
          {ITENS.map(({ valor, label, Icone }) => {
            const ativo = paginaAtual === valor;
            return (
              <button
                key={valor}
                type="button"
                onClick={() => onNavegar(valor)}
                className={`flex min-h-[44px] items-center gap-3 rounded-control px-3 py-2 text-sm font-medium transition-colors duration-150 ${
                  ativo ? 'bg-text-primary text-white' : 'text-text-secondary hover:bg-surface-muted'
                }`}
              >
                <Icone size={18} strokeWidth={2} />
                {label}
              </button>
            );
          })}
        </nav>

        <div className="px-3 pb-5 text-xs text-text-secondary">Versão 0.1.0</div>
      </aside>
    </>
  );
}
