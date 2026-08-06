import { useState } from 'react';
import Sidebar from './components/Sidebar.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Cardapio from './pages/Cardapio.jsx';
import Produtos from './pages/Produtos.jsx';
import Pedidos from './pages/Pedidos.jsx';
import Configuracoes from './pages/Configuracoes.jsx';

const PAGINAS = {
  dashboard: Dashboard,
  cardapio: Cardapio,
  produtos: Produtos,
  pedidos: Pedidos,
  configuracoes: Configuracoes,
};

export default function App() {
  const [pagina, setPagina] = useState('dashboard');
  const Pagina = PAGINAS[pagina];

  return (
    <div className="flex min-h-screen bg-stone-50">
      <Sidebar paginaAtual={pagina} onNavegar={setPagina} />
      <main className="flex-1 overflow-x-auto">
        <Pagina />
      </main>
    </div>
  );
}
