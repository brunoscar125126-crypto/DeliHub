import { useCallback, useEffect, useState } from 'react';
import { api } from './lib/api.js';
import ProdutoCard from './ProdutoCard.jsx';

export default function Dashboard() {
  const [produtos, setProdutos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);

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

  // pausar/despausar disparam a chamada e recarregam a lista pra refletir o
  // status real que voltou de cada plataforma (não otimista).
  async function pausar(id) {
    const resultado = await api.pausarProduto(id);
    await carregar();
    return resultado;
  }

  async function despausar(id) {
    const resultado = await api.despausarProduto(id);
    await carregar();
    return resultado;
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">DeliHub</h1>
          <p className="mt-1 text-sm text-slate-500">Produtos e status por plataforma</p>
        </div>
        <button
          type="button"
          onClick={carregar}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
        >
          Atualizar
        </button>
      </header>

      {erro && (
        <div className="mt-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">
          Erro ao carregar produtos: {erro}
        </div>
      )}

      {carregando && produtos.length === 0 ? (
        // Só mostra o placeholder de carregamento na primeira busca. Num
        // refresh depois de pausar/despausar, manter a grade montada é
        // essencial: desmontar os ProdutoCard aqui destruiria o estado local
        // deles (o aviso de "não sincronizou com X") antes de conseguirem
        // exibi-lo pro usuário.
        <p className="mt-8 text-sm text-slate-500">Carregando...</p>
      ) : produtos.length === 0 ? (
        <p className="mt-8 text-sm text-slate-500">Nenhum produto cadastrado ainda.</p>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {produtos.map((produto) => (
            <ProdutoCard key={produto.id} produto={produto} onPausar={pausar} onDespausar={despausar} />
          ))}
        </div>
      )}
    </div>
  );
}
