import { useIsMobile } from '../hooks/useIsMobile.js';

/**
 * Tabela genérica: no desktop renderiza <table>; abaixo do breakpoint
 * mobile vira uma lista de cards (usa `renderCardMobile` se fornecido —
 * necessário quando o conteúdo da célula é complexo/interativo, como em
 * Produtos — senão empilha as colunas como pares label/valor).
 *
 * @param {{chave: string, label: string, render?: (linha: any) => any}[]} colunas
 * @param {any[]} linhas
 * @param {(linha: any) => string} chaveLinha
 * @param {(linha: any) => any} [renderCardMobile]
 * @param {(linha: any) => void} [onLinhaClick] - se fornecido, linha/card vira clicável (ex: abrir detalhe)
 */
export default function DataTable({ colunas, linhas, chaveLinha, renderCardMobile, onLinhaClick }) {
  const isMobile = useIsMobile();
  const clicavel = !!onLinhaClick;

  if (isMobile) {
    return (
      <div className="mt-6 space-y-3">
        {linhas.map((linha) => (
          <div
            key={chaveLinha(linha)}
            onClick={clicavel ? () => onLinhaClick(linha) : undefined}
            className={`rounded-card border border-border bg-surface p-4 shadow-card ${clicavel ? 'cursor-pointer active:bg-surface-muted' : ''}`}
          >
            {renderCardMobile
              ? renderCardMobile(linha)
              : colunas.map((coluna) => (
                  <div key={coluna.chave} className="flex items-center justify-between gap-3 py-1 text-sm">
                    <span className="text-text-secondary">{coluna.label}</span>
                    <span className="text-text-primary">
                      {coluna.render ? coluna.render(linha) : linha[coluna.chave]}
                    </span>
                  </div>
                ))}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="mt-6 overflow-x-auto rounded-card border border-border bg-surface shadow-card">
      <table className="w-full text-left">
        <thead>
          <tr className="border-b border-border bg-surface-muted text-xs uppercase tracking-wide text-text-secondary">
            {colunas.map((coluna) => (
              <th key={coluna.chave} className="px-5 py-3.5 font-medium">
                {coluna.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {linhas.map((linha) => (
            <tr
              key={chaveLinha(linha)}
              onClick={clicavel ? () => onLinhaClick(linha) : undefined}
              className={`border-b border-border last:border-0 hover:bg-surface-muted/60 ${clicavel ? 'cursor-pointer' : ''}`}
            >
              {colunas.map((coluna) => (
                <td key={coluna.chave} className="px-5 py-4 text-sm text-text-primary">
                  {coluna.render ? coluna.render(linha) : linha[coluna.chave]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
