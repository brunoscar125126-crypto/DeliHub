/**
 * Marca do DeliHub: ícone (cúpula/prato formando um "D", com as linhas de
 * movimento à esquerda) + wordmark "Deli" (marrom) + "Hub" (laranja/dourado),
 * recriando a logo oficial da marca. Usa os tokens `text-primary`/`primary`
 * do Tailwind, então acompanha a paleta definida em tailwind.config.js.
 */
export default function LogoDeliHub({ tamanhoIcone = 32, comTexto = true, className = '' }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <svg
        width={tamanhoIcone}
        height={tamanhoIcone}
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        className="shrink-0"
      >
        {/* Linhas de movimento (entrega/velocidade) */}
        <rect x="2" y="12" width="9" height="4" rx="2" className="fill-primary" />
        <rect x="2" y="22" width="14" height="4" rx="2" className="fill-primary" />
        <rect x="2" y="32" width="7" height="4" rx="2" className="fill-primary" />

        {/* Corpo do "D" */}
        <path
          d="M17 4h6c9.4 0 17 7.6 17 17v6c0 9.4-7.6 17-17 17h-6a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3Z"
          className="fill-text-primary"
        />

        {/* Cúpula (cloche) + prato, "recortados" dentro do D */}
        <circle cx="26" cy="14.5" r="1.8" className="fill-surface" />
        <path d="M17 24a9 9 0 0 1 18 0Z" className="fill-surface" />
        <rect x="15.5" y="24" width="21" height="3.4" rx="1.7" className="fill-surface" />
      </svg>

      {comTexto && (
        <span className="text-lg font-semibold text-text-primary">
          Deli<span className="text-primary">Hub</span>
        </span>
      )}
    </div>
  );
}
