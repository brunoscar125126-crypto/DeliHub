export default function CardEstatistica({ Icone, label, valor, sub, corIcone = 'text-orange-600 bg-orange-100' }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${corIcone}`}>
        <Icone size={18} />
      </div>
      <div>
        <p className="text-sm text-stone-500">{label}</p>
        <p className="mt-0.5 text-2xl font-semibold tracking-tight text-stone-900">{valor}</p>
        {sub && <p className="mt-0.5 text-xs text-stone-400">{sub}</p>}
      </div>
    </div>
  );
}
