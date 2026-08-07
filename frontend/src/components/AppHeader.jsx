import { Menu, Bell, ChevronDown } from 'lucide-react';

/**
 * Topbar fixa. Os controles de seletor de loja/status/sincronizar/sino/
 * usuário são PLACEHOLDER — visualmente presentes (bate com a referência),
 * mas desabilitados de propósito: DeliHub ainda é single-tenant, sem login
 * nem sistema de notificações, então não existe dado real por trás deles
 * ainda. `title` em cada um explica isso ao passar o mouse.
 */
export default function AppHeader({ onAbrirMenu }) {
  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-border bg-surface px-4 md:px-6">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onAbrirMenu}
          className="flex h-11 w-11 items-center justify-center rounded-control text-text-secondary hover:bg-surface-muted md:hidden"
          aria-label="Abrir menu"
        >
          <Menu size={20} />
        </button>

        <button
          type="button"
          disabled
          title="Em breve: múltiplas lojas"
          className="hidden cursor-not-allowed items-center gap-1.5 rounded-control border border-border px-3 py-1.5 text-sm font-medium text-text-primary opacity-60 sm:flex"
        >
          Minha Loja
          <ChevronDown size={14} />
        </button>

        <span
          title="Em breve: status em tempo real"
          className="hidden items-center gap-1.5 rounded-control border border-border px-3 py-1.5 text-xs font-medium text-text-secondary opacity-60 sm:flex"
        >
          <span className="h-2 w-2 rounded-full bg-success" />
          Ativo
        </span>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled
          title="Em breve: sincronização manual de todas as plataformas"
          className="hidden cursor-not-allowed items-center gap-2 rounded-control bg-primary px-4 py-2 text-sm font-medium text-white opacity-60 sm:flex"
        >
          Sincronizar agora
        </button>

        <button
          type="button"
          disabled
          title="Em breve: notificações"
          className="flex h-11 w-11 cursor-not-allowed items-center justify-center rounded-control text-text-secondary opacity-60 hover:bg-surface-muted"
        >
          <Bell size={18} />
        </button>

        <div title="Em breve: contas de usuário" className="flex items-center gap-2 rounded-control px-1 opacity-60">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-muted text-xs font-semibold text-text-secondary">
            A
          </div>
          <span className="hidden text-sm font-medium text-text-primary md:inline">Administrador</span>
        </div>
      </div>
    </header>
  );
}
