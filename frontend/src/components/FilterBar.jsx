/** Wrapper de espaçamento pra linha de busca/filtros no topo de uma listagem. */
export default function FilterBar({ children }) {
  return <div className="mt-6 flex flex-wrap items-center gap-3">{children}</div>;
}
