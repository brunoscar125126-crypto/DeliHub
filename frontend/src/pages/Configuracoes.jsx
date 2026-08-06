import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api.js';

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
const PLATAFORMA_LABEL = { ifood: 'iFood', noventaenove: '99Food' };

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

/** Grade semanal editável — reaproveitada tanto no editor único quanto na customização por plataforma. */
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
          <span className="w-16 shrink-0 pt-1 text-stone-500">{DIA_LABEL[dia]}</span>
          <div className="flex-1 space-y-1">
            {porDia[dia].length === 0 && <span className="text-stone-400">Fechado</span>}
            {porDia[dia].map((faixa, i) =>
              editando ? (
                <div key={i} className="flex items-center gap-1.5">
                  <input
                    type="time"
                    value={faixa.inicio}
                    onChange={(e) => atualizarFaixa(dia, i, 'inicio', e.target.value)}
                    className="rounded border border-stone-300 px-1.5 py-0.5 text-xs"
                  />
                  <span className="text-stone-400">–</span>
                  <input
                    type="time"
                    value={faixa.fim}
                    onChange={(e) => atualizarFaixa(dia, i, 'fim', e.target.value)}
                    className="rounded border border-stone-300 px-1.5 py-0.5 text-xs"
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
                <span key={i} className="block text-stone-700">
                  {faixa.inicio} – {faixa.fim}
                </span>
              )
            )}
            {editando && (
              <button
                type="button"
                onClick={() => adicionarFaixa(dia)}
                className="text-xs text-stone-500 hover:text-stone-700"
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
        <h3 className="font-medium text-stone-900">Pausar {PLATAFORMA_LABEL[plataforma]}</h3>

        {plataforma === 'ifood' ? (
          <div className="mt-3 space-y-3">
            <label className="block text-sm">
              <span className="text-stone-600">Motivo (opcional)</span>
              <input
                type="text"
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                className="mt-1 w-full rounded-md border border-stone-300 px-2 py-1.5 text-sm"
                placeholder="Ex: falta de entregador"
              />
            </label>
            <label className="block text-sm">
              <span className="text-stone-600">Duração</span>
              <select
                value={minutos}
                onChange={(e) => setMinutos(Number(e.target.value))}
                className="mt-1 w-full rounded-md border border-stone-300 px-2 py-1.5 text-sm"
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
              <span className="text-stone-600">Duração</span>
              <select
                value={duracao}
                onChange={(e) => setDuracao(Number(e.target.value))}
                className="mt-1 w-full rounded-md border border-stone-300 px-2 py-1.5 text-sm"
              >
                {DURACOES_99FOOD.map((d) => (
                  <option key={d.valor} value={d.valor}>
                    {d.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="text-stone-600">Motivo (obrigatório)</span>
              <select
                value={motivoCode}
                onChange={(e) => setMotivoCode(Number(e.target.value))}
                className="mt-1 w-full rounded-md border border-stone-300 px-2 py-1.5 text-sm"
              >
                {MOTIVOS_99FOOD.map((m) => (
                  <option key={m.valor} value={m.valor}>
                    {m.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm text-stone-600">
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
            className="rounded-md border border-stone-300 px-3 py-1.5 text-sm text-stone-600 hover:bg-stone-100"
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

/** Painel de customização individual de uma plataforma — pra quando o horário único não serve pra ela. */
function PainelPersonalizado({ plataforma, turnos, erro, onSalvo }) {
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
    <div className="rounded-lg border border-stone-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-stone-900">{PLATAFORMA_LABEL[plataforma]}</h3>
        <div className="flex gap-2">
          {editando ? (
            <>
              <button
                type="button"
                onClick={() => {
                  setEditando(false);
                  setRascunho(turnos);
                }}
                className="rounded-md border border-stone-300 px-2.5 py-1 text-xs text-stone-600 hover:bg-stone-100"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={salvar}
                disabled={salvando}
                className="rounded-md bg-stone-900 px-2.5 py-1 text-xs font-medium text-white hover:bg-stone-700 disabled:opacity-50"
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
                className="rounded-md border border-stone-300 px-2.5 py-1 text-xs text-stone-600 hover:bg-stone-100"
              >
                Customizar
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

export default function Configuracoes() {
  const [dados, setDados] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);

  const [turnosUnificados, setTurnosUnificados] = useState([]);
  const [aplicarEm, setAplicarEm] = useState({ ifood: true, noventaenove: true });
  const [salvandoUnificado, setSalvandoUnificado] = useState(false);
  const [resultadoUnificado, setResultadoUnificado] = useState(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const resposta = await api.buscarHorario();
      setDados(resposta);
      // Pré-preenche o editor único com o horário do iFood como ponto de
      // partida (é só uma sugestão editável, não precisa bater com nenhuma
      // plataforma especificamente).
      setTurnosUnificados(resposta.ifood.turnos.length ? resposta.ifood.turnos : resposta.noventaenove.turnos);
    } catch (err) {
      setErro(err.message);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function salvarUnificado() {
    const plataformasMarcadas = Object.entries(aplicarEm)
      .filter(([, marcado]) => marcado)
      .map(([plataforma]) => plataforma);

    if (plataformasMarcadas.length === 0) return;

    setSalvandoUnificado(true);
    setResultadoUnificado(null);
    try {
      const execucoes = await Promise.allSettled(
        plataformasMarcadas.map((plataforma) => api.salvarHorario(plataforma, turnosUnificados))
      );
      const resultado = plataformasMarcadas.map((plataforma, i) => ({
        plataforma,
        sucesso: execucoes[i].status === 'fulfilled',
        erro: execucoes[i].status === 'rejected' ? execucoes[i].reason.message : null,
      }));
      setResultadoUnificado(resultado);
      await carregar();
    } finally {
      setSalvandoUnificado(false);
    }
  }

  return (
    <div className="p-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-stone-900">Configurações</h1>
          <p className="mt-1 text-sm text-stone-500">Horário de funcionamento e pausas</p>
        </div>
        <button
          type="button"
          onClick={carregar}
          className="rounded-md border border-stone-300 px-3 py-1.5 text-sm text-stone-600 hover:bg-stone-100"
        >
          Atualizar
        </button>
      </header>

      {erro && <div className="mt-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</div>}

      {carregando ? (
        <p className="mt-8 text-sm text-stone-500">Carregando...</p>
      ) : (
        dados && (
          <>
            <section className="mt-6 rounded-lg border border-stone-200 bg-white p-4">
              <h2 className="font-medium text-stone-900">Horário semanal</h2>
              <p className="mt-1 text-sm text-stone-500">
                Edite uma vez e aplique nas plataformas marcadas abaixo. Plataforma desmarcada mantém o horário atual
                dela — customize individualmente na seção abaixo, se precisar.
              </p>

              <div className="mt-4">
                <GradeSemanal turnos={turnosUnificados} editando onChange={setTurnosUnificados} />
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-stone-100 pt-4">
                <span className="text-sm text-stone-600">Aplicar em:</span>
                {Object.keys(PLATAFORMA_LABEL).map((plataforma) => (
                  <label key={plataforma} className="flex items-center gap-1.5 text-sm text-stone-700">
                    <input
                      type="checkbox"
                      checked={aplicarEm[plataforma]}
                      onChange={(e) => setAplicarEm((prev) => ({ ...prev, [plataforma]: e.target.checked }))}
                    />
                    {PLATAFORMA_LABEL[plataforma]}
                  </label>
                ))}
                <button
                  type="button"
                  onClick={salvarUnificado}
                  disabled={salvandoUnificado || Object.values(aplicarEm).every((v) => !v)}
                  className="ml-auto rounded-md bg-orange-500 px-4 py-1.5 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-50"
                >
                  {salvandoUnificado ? 'Salvando...' : 'Salvar horário'}
                </button>
              </div>

              {resultadoUnificado && (
                <div className="mt-3 space-y-1">
                  {resultadoUnificado.map((r) => (
                    <p
                      key={r.plataforma}
                      className={`text-xs ${r.sucesso ? 'text-emerald-600' : 'text-red-600'}`}
                    >
                      {PLATAFORMA_LABEL[r.plataforma]}: {r.sucesso ? 'salvo com sucesso' : r.erro}
                    </p>
                  ))}
                </div>
              )}
            </section>

            <section className="mt-8">
              <h2 className="text-sm font-medium text-stone-700">Customizar por plataforma</h2>
              <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
                <PainelPersonalizado
                  plataforma="ifood"
                  turnos={dados.ifood.turnos}
                  erro={dados.ifood.erro}
                  onSalvo={carregar}
                />
                <PainelPersonalizado
                  plataforma="noventaenove"
                  turnos={dados.noventaenove.turnos}
                  erro={dados.noventaenove.erro}
                  onSalvo={carregar}
                />
              </div>
            </section>
          </>
        )
      )}
    </div>
  );
}
