import { useCallback, useEffect, useState } from 'react';
import { api } from './lib/api.js';

const DIAS = ['SEGUNDA', 'TERCA', 'QUARTA', 'QUINTA', 'SEXTA', 'SABADO', 'DOMINGO'];
const DIA_LABEL = {
  SEGUNDA: 'Segunda',
  TERCA: 'Terça',
  QUARTA: 'Quarta',
  QUINTA: 'Quinta',
  SEXTA: 'Sexta',
  SABADO: 'Sábado',
  DOMINGO: 'Domingo',
};

// 99Food: pause_time é enum, não minutos crus (confirmado ao vivo).
const DURACOES_99FOOD = [
  { valor: 1, label: '10 minutos' },
  { valor: 2, label: '20 minutos' },
  { valor: 3, label: '30 minutos' },
  { valor: 4, label: 'Até o fim do dia' },
];
// Só temos esses dois motivos confirmados — lista completa não confirmada.
const MOTIVOS_99FOOD = [
  { valor: 1002, label: 'Ausência temporária de equipe' },
  { valor: 1006, label: 'Outros' },
];

function turnosParaPorDia(turnos) {
  const porDia = Object.fromEntries(DIAS.map((d) => [d, []]));
  for (const t of turnos) {
    porDia[t.diaSemana]?.push({ inicio: t.inicio, fim: t.fim });
  }
  return porDia;
}

function porDiaParaTurnos(porDia) {
  const turnos = [];
  for (const dia of DIAS) {
    for (const faixa of porDia[dia]) {
      if (faixa.inicio && faixa.fim) turnos.push({ diaSemana: dia, inicio: faixa.inicio, fim: faixa.fim });
    }
  }
  return turnos;
}

/** Grade semanal editável — usada tanto pro iFood quanto pra 99Food, cada uma com seu próprio estado. */
function GradeSemanal({ turnos, editando, onChange }) {
  const porDia = turnosParaPorDia(turnos);

  function atualizarFaixa(dia, index, campo, valor) {
    const novoPorDia = { ...porDia, [dia]: porDia[dia].map((f, i) => (i === index ? { ...f, [campo]: valor } : f)) };
    onChange(porDiaParaTurnos(novoPorDia));
  }

  function adicionarFaixa(dia) {
    const novoPorDia = { ...porDia, [dia]: [...porDia[dia], { inicio: '08:00', fim: '18:00' }] };
    onChange(porDiaParaTurnos(novoPorDia));
  }

  function removerFaixa(dia, index) {
    const novoPorDia = { ...porDia, [dia]: porDia[dia].filter((_, i) => i !== index) };
    onChange(porDiaParaTurnos(novoPorDia));
  }

  return (
    <div className="space-y-1.5">
      {DIAS.map((dia) => (
        <div key={dia} className="flex items-start gap-2 text-sm">
          <span className="w-16 shrink-0 pt-1 text-slate-500">{DIA_LABEL[dia]}</span>
          <div className="flex-1 space-y-1">
            {porDia[dia].length === 0 && <span className="text-slate-400">Fechado</span>}
            {porDia[dia].map((faixa, i) =>
              editando ? (
                <div key={i} className="flex items-center gap-1.5">
                  <input
                    type="time"
                    value={faixa.inicio}
                    onChange={(e) => atualizarFaixa(dia, i, 'inicio', e.target.value)}
                    className="rounded border border-slate-300 px-1.5 py-0.5 text-xs"
                  />
                  <span className="text-slate-400">–</span>
                  <input
                    type="time"
                    value={faixa.fim}
                    onChange={(e) => atualizarFaixa(dia, i, 'fim', e.target.value)}
                    className="rounded border border-slate-300 px-1.5 py-0.5 text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => removerFaixa(dia, i)}
                    className="text-xs text-red-500 hover:text-red-700"
                  >
                    remover
                  </button>
                </div>
              ) : (
                <span key={i} className="block text-slate-700">
                  {faixa.inicio} – {faixa.fim}
                </span>
              )
            )}
            {editando && (
              <button
                type="button"
                onClick={() => adicionarFaixa(dia)}
                className="text-xs text-slate-500 hover:text-slate-700"
              >
                + adicionar turno
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Modal de pausa rápida — campos diferentes por plataforma. */
function ModalPausa({ plataforma, onFechar, onCriada }) {
  const [descricao, setDescricao] = useState('');
  const [minutos, setMinutos] = useState(30);
  const [duracao, setDuracao] = useState(3);
  const [motivoCode, setMotivoCode] = useState(1006);
  const [autoRetomar, setAutoRetomar] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState(null);

  async function confirmar() {
    setEnviando(true);
    setErro(null);
    try {
      if (plataforma === 'ifood') {
        const inicio = new Date();
        const fim = new Date(inicio.getTime() + minutos * 60_000);
        await api.criarPausaIfood({ descricao, inicio: inicio.toISOString(), fim: fim.toISOString() });
      } else {
        await api.criarPausaNoventaENove({ duracao, motivoCode, autoRetomar });
      }
      onCriada();
    } catch (err) {
      setErro(err.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-10 flex items-center justify-center bg-black/30 px-4">
      <div className="w-full max-w-sm rounded-lg bg-white p-5 shadow-lg">
        <h3 className="font-medium text-slate-900">Pausar {plataforma === 'ifood' ? 'iFood' : '99Food'}</h3>

        {plataforma === 'ifood' ? (
          <div className="mt-3 space-y-3">
            <label className="block text-sm">
              <span className="text-slate-600">Motivo (opcional)</span>
              <input
                type="text"
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                placeholder="Ex: falta de entregador"
              />
            </label>
            <label className="block text-sm">
              <span className="text-slate-600">Duração</span>
              <select
                value={minutos}
                onChange={(e) => setMinutos(Number(e.target.value))}
                className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              >
                <option value={15}>15 minutos</option>
                <option value={30}>30 minutos</option>
                <option value={60}>1 hora</option>
                <option value={120}>2 horas</option>
              </select>
            </label>
          </div>
        ) : (
          <div className="mt-3 space-y-3">
            <label className="block text-sm">
              <span className="text-slate-600">Duração</span>
              <select
                value={duracao}
                onChange={(e) => setDuracao(Number(e.target.value))}
                className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              >
                {DURACOES_99FOOD.map((d) => (
                  <option key={d.valor} value={d.valor}>
                    {d.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="text-slate-600">Motivo (obrigatório)</span>
              <select
                value={motivoCode}
                onChange={(e) => setMotivoCode(Number(e.target.value))}
                className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              >
                {MOTIVOS_99FOOD.map((m) => (
                  <option key={m.valor} value={m.valor}>
                    {m.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input type="checkbox" checked={autoRetomar} onChange={(e) => setAutoRetomar(e.target.checked)} />
              Retomar automaticamente depois da pausa
            </label>
          </div>
        )}

        {erro && <p className="mt-3 text-xs text-red-600">{erro}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onFechar}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={confirmar}
            disabled={enviando}
            className="rounded-md bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-500 disabled:opacity-50"
          >
            {enviando ? 'Pausando...' : 'Confirmar pausa'}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Painel de uma plataforma: grade semanal + botões de editar/salvar/pausar. */
function PainelPlataforma({ label, plataforma, turnos, erro, onSalvo }) {
  const [editando, setEditando] = useState(false);
  const [rascunho, setRascunho] = useState(turnos);
  const [salvando, setSalvando] = useState(false);
  const [erroSalvar, setErroSalvar] = useState(null);
  const [mostrarPausa, setMostrarPausa] = useState(false);

  useEffect(() => {
    if (!editando) setRascunho(turnos);
  }, [turnos, editando]);

  async function salvar() {
    setSalvando(true);
    setErroSalvar(null);
    try {
      await api.salvarHorario(plataforma, rascunho);
      setEditando(false);
      onSalvo();
    } catch (err) {
      setErroSalvar(err.message);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <h2 className="font-medium text-slate-900">{label}</h2>
        <div className="flex gap-2">
          {editando ? (
            <>
              <button
                type="button"
                onClick={() => {
                  setEditando(false);
                  setRascunho(turnos);
                }}
                className="rounded-md border border-slate-300 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-100"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={salvar}
                disabled={salvando}
                className="rounded-md bg-slate-900 px-2.5 py-1 text-xs font-medium text-white hover:bg-slate-700 disabled:opacity-50"
              >
                {salvando ? 'Salvando...' : 'Salvar horário'}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setMostrarPausa(true)}
                className="rounded-md border border-amber-300 px-2.5 py-1 text-xs font-medium text-amber-700 hover:bg-amber-50"
              >
                Pausar agora
              </button>
              <button
                type="button"
                onClick={() => setEditando(true)}
                className="rounded-md border border-slate-300 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-100"
              >
                Editar horário
              </button>
            </>
          )}
        </div>
      </div>

      {erro && <p className="mt-2 text-xs text-red-600">Erro ao carregar: {erro}</p>}
      {erroSalvar && <p className="mt-2 text-xs text-red-600">Erro ao salvar: {erroSalvar}</p>}

      <div className="mt-3">
        <GradeSemanal turnos={editando ? rascunho : turnos} editando={editando} onChange={setRascunho} />
      </div>

      {mostrarPausa && (
        <ModalPausa
          plataforma={plataforma}
          onFechar={() => setMostrarPausa(false)}
          onCriada={() => {
            setMostrarPausa(false);
            onSalvo();
          }}
        />
      )}
    </div>
  );
}

export default function HorarioFuncionamento() {
  const [dados, setDados] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      setDados(await api.buscarHorario());
    } catch (err) {
      setErro(err.message);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Horário de funcionamento</h1>
          <p className="mt-1 text-sm text-slate-500">Horário semanal e pausas rápidas, por plataforma</p>
        </div>
        <button
          type="button"
          onClick={carregar}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
        >
          Atualizar
        </button>
      </header>

      {erro && <div className="mt-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</div>}

      {carregando ? (
        <p className="mt-8 text-sm text-slate-500">Carregando...</p>
      ) : (
        dados && (
          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
            <PainelPlataforma
              label="iFood"
              plataforma="ifood"
              turnos={dados.ifood.turnos}
              erro={dados.ifood.erro}
              onSalvo={carregar}
            />
            <PainelPlataforma
              label="99Food"
              plataforma="noventaenove"
              turnos={dados.noventaenove.turnos}
              erro={dados.noventaenove.erro}
              onSalvo={carregar}
            />
          </div>
        )
      )}
    </div>
  );
}
