import { useState } from 'react';
import AppSidebar from './components/AppSidebar.jsx';
import AppHeader from './components/AppHeader.jsx';
import { PedidosProvider } from './context/PedidosContext.jsx';
import VisaoGeral from './pages/VisaoGeral.jsx';
import Cardapio from './pages/Cardapio.jsx';
import Produtos from './pages/Produtos.jsx';
import Pedidos from './pages/Pedidos.jsx';
import Configuracoes from './pages/Configuracoes.jsx';

const PAGINAS = {
  visaoGeral: VisaoGeral,
  cardapio: Cardapio,
  produtos: Produtos,
  pedidos: Pedidos,
  configuracoes: Configuracoes,
};

export default function App() {
  const [pagina, setPagina] = useState('visaoGeral');
  const [sidebarAberta, setSidebarAberta] = useState(false);
  const Pagina = PAGINAS[pagina];

  function navegar(valor) {
    setPagina(valor);
    setSidebarAberta(false);
  }

  return (
    <PedidosProvider>
      <div className="flex min-h-screen bg-background">
        <AppSidebar
          paginaAtual={pagina}
          onNavegar={navegar}
          aberta={sidebarAberta}
          onFechar={() => setSidebarAberta(false)}
        />
        <div className="flex min-h-screen flex-1 flex-col overflow-x-hidden">
          <AppHeader onAbrirMenu={() => setSidebarAberta(true)} />
          <main className="flex-1">
            <Pagina />
          </main>
        </div>
      </div>
    </PedidosProvider>
  );
}
