import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pencil, Trash2, X, Plus } from 'lucide-react';
import { api } from '../lib/api.js';
import PageHeader from '../components/PageHeader.jsx';
import PrimaryButton from '../components/PrimaryButton.jsx';
import DataTable from '../components/DataTable.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import FilterBar from '../components/FilterBar.jsx';
import EmptyState from '../components/EmptyState.jsx';

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

function calcularMargem(produto) {
  if (produto.custoCentavos == null || produto.precoCentavos <= 0) return null;
  return Math.round(((produto.precoCentavos - produto.custoCentavos) / produto.precoCentavos) * 100);
}

function Iniciais({ nome }) {
  const cores = ['bg-orange-50 text-primary', 'bg-amber-50 text-warning', 'bg-rose-50 text-danger'];
  const cor = cores[nome.charCodeAt(0) % cores.length];
  return (
    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${cor}`}>
      {nome.charAt(0).toUpperCase()}
    </div>
  );
}

function BadgeMargem({ margem }) {
  if (margem == null) return <span className="text-sm text-text-secondary">—</span>;
  const variante = margem >= 50 ? 'success' : margem >= 20 ? 'warning' : 'danger';
  return <StatusBadge variante={variante}>{margem}%</StatusBadge>;
}

/** Uma célula de plataforma: vinculado mostra preço + toggle + desvincular; não vinculado mostra "vincular". */
function CelulaPlataforma({ produtoId, plataforma, vinculo, onMudou }) {
  const [vinculando, setVinculando] = useState(false);
  const [itemId, setItemId] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState(null);

  if (plataforma === 'keeta') {
    return <span className="text-sm text-text-secondary">—</span>;
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
              className="w-24 rounded-control border border-border px-1.5 py-1 text-xs"
            />
            <button
              type="button"
              onClick={confirmarVinculo}
              disabled={carregando}
              className="rounded-control bg-text-primary px-2 py-1 text-xs text-white disabled:opacity-50"
            >
              ok
            </button>
            <button
              type="button"
              onClick={() => setVinculando(false)}
              className="p-1 text-text-secondary"
              aria-label="Cancelar"
            >
              <X size={14} />
            </button>
          </div>
          {erro && <span className="text-[11px] text-danger">{erro}</span>}
        </div>
      );
    }
    return (
      <button
        type="button"
        onClick={() => setVinculando(true)}
        className="flex min-h-[32px] items-center gap-1 rounded-full border border-dashed border-border px-2.5 py-1 text-xs text-text-secondary hover:border-primary hover:text-primary"
      >
        <Plus size={12} /> vincular
      </button>
    );
  }

  const ativo = vinculo.status === 'ATIVO';
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <span className="text-sm text-text-primary">{formatarPreco(vinculo.precoCentavos)}</span>
        <button
          type="button"
          onClick={alternarStatus}
          disabled={carregando}
          title={ativo ? 'Ativo — clique pra pausar' : 'Pausado — clique pra reativar'}
          className={`relative h-5 w-9 shrink-0 rounded-full transition-colors duration-150 disabled:opacity-50 ${
            ativo ? 'bg-success' : 'bg-border'
          }`}
        >
          <span
            className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform duration-150 ${
              ativo ? 'translate-x-[18px]' : 'translate-x-0.5'
            }`}
          />
        </button>
        <button
          type="button"
          onClick={desvincular}
          disabled={carregando}
          title="Desvincular"
          className="p-1 text-text-secondary hover:text-danger"
        >
          <X size={13} />
        </button>
      </div>
      {erro && <span className="text-[11px] text-danger">{erro}</span>}
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
      <div className="w-full max-w-md rounded-card bg-surface p-6 shadow-xl">
        <h3 className="text-lg font-semibold text-text-primary">{produto ? 'Editar produto' : 'Novo produto'}</h3>

        <div className="mt-4 space-y-3.5">
          <label className="block text-sm">
            <span className="text-text-secondary">Nome</span>
            <input
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="mt-1 w-full rounded-control border border-border px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm">
            <span className="text-text-secondary">Descrição</span>
            <input
              type="text"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              className="mt-1 w-full rounded-control border border-border px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm">
            <span className="text-text-secondary">Categoria</span>
            <input
              type="text"
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
              className="mt-1 w-full rounded-control border border-border px-3 py-2 text-sm"
            />
          </label>
          <div className="grid grid-cols-2 gap-3.5">
            <label className="block text-sm">
              <span className="text-text-secondary">Preço (R$)</span>
              <input
                type="text"
                inputMode="decimal"
                value={preco}
                onChange={(e) => setPreco(e.target.value)}
                className="mt-1 w-full rounded-control border border-border px-3 py-2 text-sm"
              />
            </label>
            <label className="block text-sm">
              <span className="text-text-secondary">Custo (R$, opcional)</span>
              <input
                type="text"
                inputMode="decimal"
                value={custo}
                onChange={(e) => setCusto(e.target.value)}
                className="mt-1 w-full rounded-control border border-border px-3 py-2 text-sm"
              />
            </label>
          </div>
          <label className="block text-sm">
            <span className="text-text-secondary">URL da imagem (opcional)</span>
            <input
              type="text"
              value={imagemUrl}
              onChange={(e) => setImagemUrl(e.target.value)}
              className="mt-1 w-full rounded-control border border-border px-3 py-2 text-sm"
            />
          </label>
        </div>

        {erro && <p className="mt-3 text-xs text-danger">{erro}</p>}

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onFechar}
            className="min-h-[44px] rounded-control border border-border px-4 py-2 text-sm font-medium text-text-secondary hover:bg-surface-muted"
          >
            Cancelar
          </button>
          <PrimaryButton onClick={salvar} disabled={salvando}>
            {salvando ? 'Salvando...' : 'Salvar'}
          </PrimaryButton>
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

  const colunas = [
    {
      chave: 'produto',
      label: 'Produto',
      render: (produto) => (
        <div className="flex items-center gap-3">
          {produto.imagemUrl ? (
            <img src={produto.imagemUrl} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover" />
          ) : (
            <Iniciais nome={produto.nome} />
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-text-primary">{produto.nome}</p>
            {produto.descricao && <p className="truncate text-xs text-text-secondary">{produto.descricao}</p>}
          </div>
        </div>
      ),
    },
    { chave: 'categoria', label: 'Categoria', render: (p) => p.categoria ?? '—' },
    ...PLATAFORMAS.map((plataforma) => ({
      chave: plataforma.chave,
      label: plataforma.label,
      render: (produto) => (
        <CelulaPlataforma
          produtoId={produto.id}
          plataforma={plataforma.chave}
          vinculo={produto.plataformas.find((pp) => pp.plataforma === plataforma.chave) ?? null}
          onMudou={carregar}
        />
      ),
    })),
    { chave: 'custo', label: 'Custo', render: (p) => formatarPreco(p.custoCentavos) },
    { chave: 'margem', label: 'Margem', render: (p) => <BadgeMargem margem={calcularMargem(p)} /> },
    {
      chave: 'acoes',
      label: 'Ações',
      render: (produto) => (
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setModalProduto(produto)}
            title="Editar"
            className="flex h-9 w-9 items-center justify-center rounded-control text-text-secondary hover:bg-surface-muted hover:text-text-primary"
          >
            <Pencil size={15} />
          </button>
          <button
            type="button"
            onClick={() => setExcluindo(produto)}
            title="Excluir"
            className="flex h-9 w-9 items-center justify-center rounded-control text-text-secondary hover:bg-rose-50 hover:text-danger"
          >
            <Trash2 size={15} />
          </button>
        </div>
      ),
    },
  ];

  function renderCardMobile(produto) {
    const margem = calcularMargem(produto);
    return (
      <div>
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            {produto.imagemUrl ? (
              <img src={produto.imagemUrl} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover" />
            ) : (
              <Iniciais nome={produto.nome} />
            )}
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-text-primary">{produto.nome}</p>
              <p className="text-xs text-text-secondary">{produto.categoria ?? 'Sem categoria'}</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={() => setModalProduto(produto)}
              title="Editar"
              className="flex h-9 w-9 items-center justify-center rounded-control text-text-secondary hover:bg-surface-muted"
            >
              <Pencil size={15} />
            </button>
            <button
              type="button"
              onClick={() => setExcluindo(produto)}
              title="Excluir"
              className="flex h-9 w-9 items-center justify-center rounded-control text-text-secondary hover:bg-rose-50 hover:text-danger"
            >
              <Trash2 size={15} />
            </button>
          </div>
        </div>

        <div className="mt-3 flex items-center gap-4 border-t border-border pt-3 text-sm">
          <span className="text-text-secondary">Custo: {formatarPreco(produto.custoCentavos)}</span>
          <BadgeMargem margem={margem} />
        </div>

        <div className="mt-3 space-y-2 border-t border-border pt-3">
          {PLATAFORMAS.map((plataforma) => (
            <div key={plataforma.chave} className="flex items-center justify-between gap-3">
              <span className="text-xs font-medium text-text-secondary">{plataforma.label}</span>
              <CelulaPlataforma
                produtoId={produto.id}
                plataforma={plataforma.chave}
                vinculo={produto.plataformas.find((pp) => pp.plataforma === plataforma.chave) ?? null}
                onMudou={carregar}
              />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <PageHeader
        titulo="Produtos"
        subtitulo="Gerencie seus produtos e vínculos por plataforma"
        acoes={<PrimaryButton onClick={() => setModalProduto({})}>+ Novo Produto</PrimaryButton>}
      />

      <FilterBar>
        <input
          type="text"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar produto ou categoria..."
          className="w-full max-w-sm rounded-control border border-border bg-surface px-3.5 py-2.5 text-sm shadow-card"
        />
      </FilterBar>

      {erro && (
        <div className="mt-4 rounded-card border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-danger">{erro}</div>
      )}

      {carregando ? (
        <EmptyState>Carregando...</EmptyState>
      ) : produtosFiltrados.length === 0 ? (
        <EmptyState>Nenhum produto encontrado.</EmptyState>
      ) : (
        <DataTable
          colunas={colunas}
          linhas={produtosFiltrados}
          chaveLinha={(p) => p.id}
          renderCardMobile={renderCardMobile}
        />
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
          <div className="w-full max-w-sm rounded-card bg-surface p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-text-primary">Excluir "{excluindo.nome}"?</h3>
            <p className="mt-1.5 text-sm text-text-secondary">
              Remove o produto e todos os vínculos de plataforma daqui — não afeta os itens já cadastrados nas
              próprias plataformas.
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setExcluindo(null)}
                className="min-h-[44px] rounded-control border border-border px-4 py-2 text-sm font-medium text-text-secondary hover:bg-surface-muted"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => confirmarExclusao(excluindo)}
                className="min-h-[44px] rounded-control bg-danger px-4 py-2 text-sm font-medium text-white shadow-card hover:opacity-90"
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
