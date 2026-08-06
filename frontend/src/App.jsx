import { useState } from 'react';
import Dashboard from './Dashboard.jsx';
import Importacao from './Importacao.jsx';
import HorarioFuncionamento from './HorarioFuncionamento.jsx';

const ABAS = {
  dashboard: { label: 'Produtos', Componente: Dashboard },
  importacao: { label: 'Importar cardápio', Componente: Importacao },
  horario: { label: 'Horário de funcionamento', Componente: HorarioFuncionamento },
};

export default function App() {
  const [aba, setAba] = useState('dashboard');
  const { Componente } = ABAS[aba];

  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-4xl gap-1 px-4">
          {Object.entries(ABAS).map(([valor, { label }]) => (
            <button
              key={valor}
              type="button"
              onClick={() => setAba(valor)}
              className={`border-b-2 px-3 py-3 text-sm font-medium transition ${
                aba === valor
                  ? 'border-slate-900 text-slate-900'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </nav>
      <Componente />
    </div>
  );
}
