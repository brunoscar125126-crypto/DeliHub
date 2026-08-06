import { useState } from 'react';

const PLATAFORMA_LABEL = {
  ifood: 'iFood',
  noventaenove: '99Food',
  keeta: 'Keeta',
};

function formatarPreco(centavos) {
  return (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function ProdutoCard({ produto, onPausar, onDespausar }) {
  const [carregando, setCarregando] = useState(false);
  const [aviso, setAviso] = useState(null);

  const pausado = produto.status === 'PAUSADO';

  async function alternarStatus() {
    setCarregando(true);
    setAviso(null);
    try {
      const resultado = pausado ? await onDespausar(produto.id) : await onPausar(produto.id);
      const falhas = resultado?.resultados?.filter((r) => !r.sucesso) ?? [];
      if (falhas.length > 0) {
        const nomes = falhas.map((f) => PLATAFORMA_LABEL[f.plataforma] ?? f.plataforma).join(', ');
        setAviso(`Não sincronizou com: ${nomes}`);
      }
    } catch (err) {
      setAviso(err.message);
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate font-medium text-slate-900">{produto.nome}</h3>
          <p className="text-sm text-slate-500">{formatarPreco(produto.precoCentavos)}</p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${
            pausado ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
          }`}
        >
          {pausado ? 'Pausado' : 'Ativo'}
        </span>
      </div>

      {produto.plataformas.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {produto.plataformas.map((pp) => (
            <span
              key={pp.id}
              className={`rounded-md px-2 py-0.5 text-xs ${
                pp.status === 'PAUSADO' ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-600'
              }`}
              title={`item: ${pp.itemId}`}
            >
              {PLATAFORMA_LABEL[pp.plataforma] ?? pp.plataforma}
            </span>
          ))}
        </div>
      )}

      {aviso && <p className="mt-2 text-xs text-red-600">{aviso}</p>}

      <button
        type="button"
        onClick={alternarStatus}
        disabled={carregando}
        className="mt-3 w-full rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {carregando ? 'Aguarde...' : pausado ? 'Reativar' : 'Pausar'}
      </button>
    </div>
  );
}
