/** Card de métrica do topo das páginas (Visão Geral, Pedidos). Substitui o antigo CardEstatistica, mesma API de props. */
export default function MetricCard({ Icone, label, valor, sub, corIcone = 'text-primary bg-orange-50' }) {
  return (
    <div className="flex items-start gap-3 rounded-card border border-border bg-surface p-5 shadow-card">
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${corIcone}`}>
        <Icone size={18} />
      </div>
      <div>
        <p className="text-sm text-text-secondary">{label}</p>
        <p className="mt-0.5 text-2xl font-semibold tracking-tight text-text-primary">{valor}</p>
        {sub && <p className="mt-0.5 text-xs text-text-secondary">{sub}</p>}
      </div>
    </div>
  );
}
