const LABEL = { ifood: 'iFood', noventaenove: '99Food', keeta: 'Keeta' };

/** Badge pill pra identificar a plataforma (iFood/99Food/Keeta) numa linha de tabela. */
export default function PlatformBadge({ plataforma }) {
  return (
    <span className="inline-flex items-center rounded-full bg-surface-muted px-2.5 py-1 text-xs font-medium text-text-secondary">
      {LABEL[plataforma] ?? plataforma}
    </span>
  );
}
