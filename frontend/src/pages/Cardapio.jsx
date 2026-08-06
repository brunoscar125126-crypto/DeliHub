import { useCallback, useState } from 'react';
import { api } from '../lib/api.js';

const PLATAFORMA_LABEL = { noventaenove: '99Food', ifood: 'iFood' };

function formatarPreco(centavos) {
  if (centavos == null) return '—';
  return (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function Cardapio() {
  const [plataforma, setPlataforma] = useState('noventaenove');
  const [itens, setItens] = useState([]);
  const [produtosExistentes, setProdutosExistentes] = useState([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState(null);
  const [selecionados, setSelecionados] = useState({}); // itemId -> boolean
  const [escolhas, setEscolhas] = useState({}); // itemId -> produtoExistenteId ('' = criar novo)
  const [importando, setImportando] = useState(false);
  const [resultado, setResultado] = useState(null);

  // Sem auto-fetch em useEffect de propósito: o preview da 99Food tem rate
  // limit de 2 chamadas/120s (ver backend/lib/importacao.js) — só busca sob
  // clique explícito do usuário.
  const buscar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    setResultado(null);
    try {
      const [{ itens: itensBuscados }, produtos] = await Promise.all([
        api.previewImportacao(plataforma),
        api.listarProdutos(),
      ]);
      setItens(itensBuscados);
      setProdutosExistentes(produtos);
      setSelecionados({});

      const novasEscolhas = {};
      itensBuscados.forEach((item) => {
        novasEscolhas[item.itemId] = item.sugestaoMatchId ?? '';
      });
      setEscolhas(novasEscolhas);
    } catch (err) {
      setErro(err.message);
    } finally {
      setCarregando(false);
    }
  }, [plataforma]);

  function alternarSelecao(itemId) {
    setSelecionados((prev) => ({ ...prev, [itemId]: !prev[itemId] }));
  }

  function mudarEscolha(itemId, produtoExistenteId) {
    setEscolhas((prev) => ({ ...prev, [itemId]: produtoExistenteId }));
  }

  async function importarSelecionados() {
    const paraImportar = itens.filter((item) => selecionados[item.itemId] && !item.jaImportado);
    if (paraImportar.length === 0) return;

    setImportando(true);
    setResultado(null);
    try {
      const payload = paraImportar.map((item) => ({
        plataforma: item.plataforma,
        itemId: item.itemId,
        nome: item.nome,
        descricao: item.descricao,
        precoCentavos: item.precoCentavos,
        produtoExistenteId: escolhas[item.itemId] || undefined,
      }));
      const { resultados } = await api.confirmarImportacao(payload);
      setResultado(resultados);
      await buscar(); // recarrega: marca os importados e limpa a seleção
    } catch (err) {
      setErro(err.message);
    } finally {
      setImportando(false);
    }
  }

  const selecionadosCount = Object.values(selecionados).filter(Boolean).length;

  return (
    <div className="p-8">
      <header>
        <h1 className="text-2xl font-semibold text-stone-900">Cardápio</h1>
        <p className="mt-1 text-sm text-stone-500">
          Puxa os produtos já existentes numa plataforma. Você decide, item a item: criar produto novo ou mesclar com
          um que já foi importado de outra plataforma.
        </p>
      </header>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-md border border-stone-300 p-1">
          {Object.entries(PLATAFORMA_LABEL).map(([valor, label]) => (
            <button
              key={valor}
              type="button"
              onClick={() => setPlataforma(valor)}
              className={`rounded px-3 py-1 text-sm font-medium transition ${
                plataforma === valor ? 'bg-stone-900 text-white' : 'text-stone-600 hover:bg-stone-100'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={buscar}
          disabled={carregando}
          className="rounded-md bg-orange-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-50"
        >
          {carregando ? 'Buscando...' : 'Buscar cardápio'}
        </button>

        {selecionadosCount > 0 && (
          <button
            type="button"
            onClick={importarSelecionados}
            disabled={importando}
            className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            {importando ? 'Importando...' : `Importar ${selecionadosCount} selecionado(s)`}
          </button>
        )}
      </div>

      {erro && <div className="mt-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</div>}

      {resultado && (
        <div className="mt-4 space-y-1 rounded-md bg-stone-100 px-4 py-3 text-sm">
          {resultado.map((r) => (
            <p key={r.itemId} className={r.sucesso ? 'text-emerald-700' : 'text-red-700'}>
              {r.itemId}:{' '}
              {r.sucesso
                ? r.modo === 'mesclado'
                  ? 'mesclado com produto existente'
                  : 'importado como produto novo'
                : r.erro}
            </p>
          ))}
        </div>
      )}

      {itens.length > 0 && (
        <div className="mt-6 divide-y divide-stone-200 rounded-lg border border-stone-200 bg-white">
          {itens.map((item) => (
            <div key={item.itemId} className="flex items-center gap-3 px-4 py-3">
              <input
                type="checkbox"
                checked={!!selecionados[item.itemId]}
                disabled={item.jaImportado}
                onChange={() => alternarSelecao(item.itemId)}
                className="h-4 w-4 shrink-0 rounded border-stone-300 disabled:opacity-40"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-stone-900">{item.nome}</p>
                <p className="text-xs text-stone-500">{formatarPreco(item.precoCentavos)}</p>
                {item.sugestaoMatchId && !item.jaImportado && (
                  <p className="text-[11px] text-amber-600">produto parecido já existe — sugestão pré-selecionada</p>
                )}
              </div>

              {item.jaImportado ? (
                <span className="shrink-0 rounded-full bg-stone-100 px-2.5 py-0.5 text-xs text-stone-500">
                  Já importado
                </span>
              ) : (
                <select
                  value={escolhas[item.itemId] ?? ''}
                  onChange={(e) => mudarEscolha(item.itemId, e.target.value)}
                  className="shrink-0 rounded-md border border-stone-300 px-2 py-1 text-xs text-stone-700"
                >
                  <option value="">Criar produto novo</option>
                  {produtosExistentes.map((p) => (
                    <option key={p.id} value={p.id}>
                      Mesclar com: {p.nome}
                    </option>
                  ))}
                </select>
              )}
            </div>
          ))}
        </div>
      )}

      {!carregando && itens.length === 0 && !erro && (
        <p className="mt-8 text-sm text-stone-500">
          Clique em &quot;Buscar cardápio&quot; pra ver os produtos dessa plataforma.
        </p>
      )}
    </div>
  );
}
