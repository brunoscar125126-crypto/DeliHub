import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pencil, Trash2, X, Plus } from 'lucide-react';
import { api } from '../lib/api.js';

const PLATAFORMAS = [
  { chave: 'ifood', label: 'iFood' },
  { chave: 'noventaenove', label: '99Food' },
  { chave: 'keeta', label: 'Keeta' }, // conector ainda não existe — coluna sempre "—"
];

function formatarPreco(centavos) {
  if (centavos == null) return '—';
  return (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function reaisParaCentavos(texto) {
  const n = Number(String(texto).replace(',', '.'));
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}

function Iniciais({ nome }) {
  const cores = ['bg-orange-100 text-orange-700', 'bg-amber-100 text-amber-700', 'bg-rose-100 text-rose-700'];
  const cor = cores[nome.charCodeAt(0) % cores.length];
  return (
    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${cor}`}>
      {nome.charAt(0).toUpperCase()}
    </div>
  );
}

/** Uma célula de plataforma: vinculado mostra preço + toggle + desvincular; não vinculado mostra "vincular". */
function CelulaPlataforma({ produtoId, plataforma, vinculo, onMudou }) {
  const [vinculando, setVinculando] = useState(false);
  const [itemId, setItemId] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState(null);

  if (plataforma === 'keeta') {
    return <span className="text-sm text-stone-300">—</span>;
  }

  async function confirmarVinculo() {
    if (!itemId.trim()) return;
    setCarregando(true);
    setErro(null);
    try {
      await api.atualizarPlataformaProduto(produtoId, plataforma, { itemId: itemId.trim() });
      setVinculando(false);
      setItemId('');
      onMudou();
    } catch (err) {
      setErro(err.message);
    } finally {
      setCarregando(false);
    }
  }

  async function alternarStatus() {
    setCarregando(true);
    setErro(null);
    try {
      const novoStatus = vinculo.status === 'ATIVO' ? 'PAUSADO' : 'ATIVO';
      await api.atualizarPlataformaProduto(produtoId, plataforma, { status: novoStatus });
      onMudou();
    } catch (err) {
      setErro(err.message);
    } finally {
      setCarregando(false);
    }
  }

  async function desvincular() {
    setCarregando(true);
    setErro(null);
    try {
      await api.removerPlataformaProduto(produtoId, plataforma);
      onMudou();
    } catch (err) {
      setErro(err.message);
    } finally {
      setCarregando(false);
    }
  }

  if (!vinculo) {
    if (vinculando) {
      return (
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1">
            <input
              autoFocus
              type="text"
              value={itemId}
              onChange={(e) => setItemId(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && confirmarVinculo()}
              placeholder="itemId"
              className="w-24 rounded border border-stone-300 px-1.5 py-0.5 text-xs"
            />
            <button
              type="button"
              onClick={confirmarVinculo}
              disabled={carregando}
              className="rounded bg-stone-900 px-1.5 py-0.5 text-xs text-white disabled:opacity-50"
            >
              ok
            </button>
            <button type="button" onClick={() => setVinculando(false)} className="text-xs text-stone-400">
              <X size={14} />
            </button>
          </div>
          {erro && <span className="text-[11px] text-red-600">{erro}</span>}
        </div>
      );
    }
    return (
      <button
        type="button"
        onClick={() => setVinculando(true)}
        className="flex items-center gap-1 rounded-full border border-dashed border-stone-300 px-2.5 py-1 text-xs text-stone-400 hover:border-orange-400 hover:text-orange-600"
      >
        <Plus size={12} /> vincular
      </button>
    );
  }

  const ativo = vinculo.status === 'ATIVO';
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <span className="text-sm text-stone-700">{formatarPreco(vinculo.precoCentavos)}</span>
        <button
          type="button"
          onClick={alternarStatus}
          disabled={carregando}
          title={ativo ? 'Ativo — clique pra pausar' : 'Pausado — clique pra reativar'}
          className={`relative h-4 w-7 shrink-0 rounded-full transition disabled:opacity-50 ${
            ativo ? 'bg-emerald-500' : 'bg-stone-300'
          }`}
        >
          <span
            className={`absolute top-0.5 h-3 w-3 rounded-full bg-white transition ${ativo ? 'left-3.5' : 'left-0.5'}`}
          />
        </button>
        <button
          type="button"
          onClick={desvincular}
          disabled={carregando}
          title="Desvincular"
          className="text-stone-300 hover:text-red-500"
        >
          <X size={13} />
        </button>
      </div>
      {erro && <span className="text-[11px] text-red-600">{erro}</span>}
    </div>
  );
}

/** Modal de criar/editar produto (campos base, não mexe em plataforma). */
function ModalProduto({ produto, onFechar, onSalvo }) {
  const [nome, setNome] = useState(produto?.nome ?? '');
  const [descricao, setDescricao] = useState(produto?.descricao ?? '');
  const [categoria, setCategoria] = useState(produto?.categoria ?? '');
  const [preco, setPreco] = useState(produto ? String(produto.precoCentavos / 100) : '');
  const [custo, setCusto] = useState(produto?.custoCentavos != null ? String(produto.custoCentavos / 100) : '');
  const [imagemUrl, setImagemUrl] = useState(produto?.imagemUrl ?? '');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState(null);

  async function salvar() {
    const precoCentavos = reaisParaCentavos(preco);
    if (!nome.trim() || precoCentavos == null) {
      setErro('Nome e preço são obrigatórios');
      return;
    }
    setSalvando(true);
    setErro(null);
    const dados = {
      nome: nome.trim(),
      descricao: descricao.trim() || null,
      categoria: categoria.trim() || null,
      precoCentavos,
      custoCentavos: custo.trim() ? reaisParaCentavos(custo) : null,
      imagemUrl: imagemUrl.trim() || null,
    };
    try {
      if (produto) {
        await api.atualizarProduto(produto.id, dados);
      } else {
        await api.criarProduto(dados);
      }
      onSalvo();
    } catch (err) {
      setErro(err.message);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-10 flex items-center justify-center bg-black/30 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <h3 className="text-lg font-semibold text-stone-900">{produto ? 'Editar produto' : 'Novo produto'}</h3>

        <div className="mt-4 space-y-3.5">
          <label className="block text-sm">
            <span className="text-stone-500">Nome</span>
            <input
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm">
            <span className="text-stone-500">Descrição</span>
            <input
              type="text"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm">
            <span className="text-stone-500">Categoria</span>
            <input
              type="text"
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
              className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
            />
          </label>
          <div className="grid grid-cols-2 gap-3.5">
            <label className="block text-sm">
              <span className="text-stone-500">Preço (R$)</span>
              <input
                type="text"
                inputMode="decimal"
                value={preco}
                onChange={(e) => setPreco(e.target.value)}
                className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="block text-sm">
              <span className="text-stone-500">Custo (R$, opcional)</span>
              <input
                type="text"
                inputMode="decimal"
                value={custo}
                onChange={(e) => setCusto(e.target.value)}
                className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
              />
            </label>
          </div>
          <label className="block text-sm">
            <span className="text-stone-500">URL da imagem (opcional)</span>
            <input
              type="text"
              value={imagemUrl}
              onChange={(e) => setImagemUrl(e.target.value)}
              className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
            />
          </label>
        </div>

        {erro && <p className="mt-3 text-xs text-red-600">{erro}</p>}

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onFechar}
            className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={salvar}
            disabled={salvando}
            className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-orange-600 disabled:opacity-50"
          >
            {salvando ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Produtos() {
  const [produtos, setProdutos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);
  const [busca, setBusca] = useState('');
  const [modalProduto, setModalProduto] = useState(null); // null = fechado, {} = novo, produto = editar
  const [excluindo, setExcluindo] = useState(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      setProdutos(await api.listarProdutos());
    } catch (err) {
      setErro(err.message);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const produtosFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return produtos;
    return produtos.filter(
      (p) => p.nome.toLowerCase().includes(termo) || (p.categoria ?? '').toLowerCase().includes(termo)
    );
  }, [produtos, busca]);

  async function confirmarExclusao(produto) {
    try {
      await api.excluirProduto(produto.id);
      setExcluindo(null);
      carregar();
    } catch (err) {
      alert(`Erro ao excluir: ${err.message}`);
    }
  }

  return (
    <div className="p-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-stone-900">Produtos</h1>
          <p className="mt-1 text-sm text-stone-500">Gerencie seus produtos e vínculos por plataforma</p>
        </div>
        <button
          type="button"
          onClick={() => setModalProduto({})}
          className="rounded-lg bg-orange-500 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-orange-600"
        >
          + Novo Produto
        </button>
      </header>

      <div className="mt-6">
        <input
          type="text"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar produto ou categoria..."
          className="w-full max-w-sm rounded-lg border border-stone-300 bg-white px-3.5 py-2.5 text-sm shadow-sm"
        />
      </div>

      {erro && (
        <div className="mt-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</div>
      )}

      {carregando ? (
        <p className="mt-8 text-sm text-stone-500">Carregando...</p>
      ) : produtosFiltrados.length === 0 ? (
        <p className="mt-8 text-sm text-stone-500">Nenhum produto encontrado.</p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-xl border border-stone-200 bg-white shadow-sm">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-stone-200 bg-stone-50/60 text-xs uppercase tracking-wide text-stone-400">
                <th className="px-5 py-3.5 font-medium">Produto</th>
                <th className="px-5 py-3.5 font-medium">Categoria</th>
                {PLATAFORMAS.map((p) => (
                  <th key={p.chave} className="px-5 py-3.5 font-medium">
                    {p.label}
                  </th>
                ))}
                <th className="px-5 py-3.5 font-medium">Custo</th>
                <th className="px-5 py-3.5 font-medium">Margem</th>
                <th className="px-5 py-3.5 font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {produtosFiltrados.map((produto) => {
                const margem =
                  produto.custoCentavos != null && produto.precoCentavos > 0
                    ? Math.round(((produto.precoCentavos - produto.custoCentavos) / produto.precoCentavos) * 100)
                    : null;
                return (
                  <tr key={produto.id} className="border-b border-stone-100 last:border-0 hover:bg-stone-50/60">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        {produto.imagemUrl ? (
                          <img
                            src={produto.imagemUrl}
                            alt=""
                            className="h-10 w-10 shrink-0 rounded-full object-cover"
                          />
                        ) : (
                          <Iniciais nome={produto.nome} />
                        )}
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-stone-900">{produto.nome}</p>
                          {produto.descricao && (
                            <p className="truncate text-xs text-stone-400">{produto.descricao}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-sm text-stone-600">{produto.categoria ?? '—'}</td>
                    {PLATAFORMAS.map((p) => (
                      <td key={p.chave} className="px-5 py-4">
                        <CelulaPlataforma
                          produtoId={produto.id}
                          plataforma={p.chave}
                          vinculo={produto.plataformas.find((pp) => pp.plataforma === p.chave) ?? null}
                          onMudou={carregar}
                        />
                      </td>
                    ))}
                    <td className="px-5 py-4 text-sm text-stone-600">{formatarPreco(produto.custoCentavos)}</td>
                    <td className="px-5 py-4">
                      {margem != null ? (
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                            margem >= 50
                              ? 'bg-emerald-100 text-emerald-700'
                              : margem >= 20
                                ? 'bg-amber-100 text-amber-700'
                                : 'bg-red-100 text-red-700'
                          }`}
                        >
                          {margem}%
                        </span>
                      ) : (
                        <span className="text-sm text-stone-300">—</span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setModalProduto(produto)}
                          title="Editar"
                          className="rounded-lg p-2 text-stone-400 hover:bg-stone-100 hover:text-stone-700"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setExcluindo(produto)}
                          title="Excluir"
                          className="rounded-lg p-2 text-stone-400 hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {modalProduto !== null && (
        <ModalProduto
          produto={modalProduto.id ? modalProduto : null}
          onFechar={() => setModalProduto(null)}
          onSalvo={() => {
            setModalProduto(null);
            carregar();
          }}
        />
      )}

      {excluindo && (
        <div className="fixed inset-0 z-10 flex items-center justify-center bg-black/30 px-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-stone-900">Excluir "{excluindo.nome}"?</h3>
            <p className="mt-1.5 text-sm text-stone-500">
              Remove o produto e todos os vínculos de plataforma daqui — não afeta os itens já cadastrados nas
              próprias plataformas.
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setExcluindo(null)}
                className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => confirmarExclusao(excluindo)}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-red-700"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
