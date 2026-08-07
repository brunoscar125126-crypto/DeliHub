const VARIANTES = {
  success: 'bg-emerald-50 text-success',
  warning: 'bg-amber-50 text-warning',
  danger: 'bg-rose-50 text-danger',
  neutral: 'bg-surface-muted text-text-secondary',
};

/** Badge pill genérico de status (ativo/pausado, confirmado/pendente, etc.). */
export default function StatusBadge({ variante = 'neutral', children }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${VARIANTES[variante]}`}>
      {children}
    </span>
  );
}
