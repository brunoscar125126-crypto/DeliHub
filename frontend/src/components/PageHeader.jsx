/** Bloco de título + subtítulo + ações, repetido no topo de toda página. */
export default function PageHeader({ titulo, subtitulo, acoes }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-text-primary">{titulo}</h1>
        {subtitulo && <p className="mt-1 text-sm text-text-secondary">{subtitulo}</p>}
      </div>
      {acoes && <div className="flex flex-wrap items-center gap-2">{acoes}</div>}
    </div>
  );
}
