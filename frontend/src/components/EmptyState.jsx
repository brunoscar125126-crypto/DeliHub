/** Mensagem padronizada de "nada aqui ainda", usada no lugar de uma tabela/lista vazia. */
export default function EmptyState({ children }) {
  return <p className="mt-8 text-sm text-text-secondary">{children}</p>;
}
