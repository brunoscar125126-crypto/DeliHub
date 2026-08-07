import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import PageHeader from '../components/PageHeader.jsx';
import PrimaryButton from '../components/PrimaryButton.jsx';
import EmptyState from '../components/EmptyState.jsx';

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
        <div key={dia} className="flex flex-col gap-1 text-sm sm:flex-row sm:items-start sm:gap-2">
          <span className="w-16 shrink-0 pt-1 text-text-secondary">{DIA_LABEL[dia]}</span>
          <div className="flex-1 space-y-1">
            {porDia[dia].length === 0 && <span className="text-text-secondary">Fechado</span>}
            {porDia[dia].map((faixa, i) =>
              editando ? (
                <div key={i} className="flex flex-wrap items-center gap-1.5">
                  <input
                    type="time"
                    value={faixa.inicio}
                    onChange={(e) => atualizarFaixa(dia, i, 'inicio', e.target.value)}
                    className="min-h-[36px] rounded-control border border-border px-1.5 py-0.5 text-xs"
                  />
                  <span className="text-text-secondary">–</span>
                  <input
                    type="time"
                    value={faixa.fim}
                    onChange={(e) => atualizarFaixa(dia, i, 'fim', e.target.value)}
                    className="min-h-[36px] rounded-control border border-border px-1.5 py-0.5 text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => removerFaixa(dia, i)}
                    className="px-1 text-xs text-danger hover:opacity-80"
                  >
                    remover
                  </button>
                </div>
              ) : (
                <span key={i} className="block text-text-primary">
                  {faixa.inicio} – {faixa.fim}
                </span>
              )
            )}
            {editando && (
              <button
                type="button"
                onClick={() => adicionarFaixa(dia)}
                className="text-xs text-text-secondary hover:text-text-primary"
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
      <div className="w-full max-w-sm rounded-card bg-surface p-6 shadow-xl">
        <h3 className="text-lg font-semibold text-text-primary">Pausar {PLATAFORMA_LABEL[plataforma]}</h3>

        {plataforma === 'ifood' ? (
          <div className="mt-4 space-y-3.5">
            <label className="block text-sm">
              <span className="text-text-secondary">Motivo (opcional)</span>
              <input
                type="text"
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                className="mt-1 w-full rounded-control border border-border px-3 py-2 text-sm"
                placeholder="Ex: falta de entregador"
              />
            </label>
            <label className="block text-sm">
              <span className="text-text-secondary">Duração</span>
              <select
                value={minutos}
                onChange={(e) => setMinutos(Number(e.target.value))}
                className="mt-1 w-full rounded-control border border-border px-3 py-2 text-sm"
              >
                <option value={15}>15 minutos</option>
                <option value={30}>30 minutos</option>
                <option value={60}>1 hora</option>
                <option value={120}>2 horas</option>
              </select>
            </label>
          </div>
        ) : (
          <div className="mt-4 space-y-3.5">
            <label className="block text-sm">
              <span className="text-text-secondary">Duração</span>
              <select
                value={duracao}
                onChange={(e) => setDuracao(Number(e.target.value))}
                className="mt-1 w-full rounded-control border border-border px-3 py-2 text-sm"
              >
                {DURACOES_99FOOD.map((d) => (
                  <option key={d.valor} value={d.valor}>
                    {d.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="text-text-secondary">Motivo (obrigatório)</span>
              <select
                value={motivoCode}
                onChange={(e) => setMotivoCode(Number(e.target.value))}
                className="mt-1 w-full rounded-control border border-border px-3 py-2 text-sm"
              >
                {MOTIVOS_99FOOD.map((m) => (
                  <option key={m.valor} value={m.valor}>
                    {m.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm text-text-secondary">
              <input type="checkbox" checked={autoRetomar} onChange={(e) => setAutoRetomar(e.target.checked)} />
              Retomar automaticamente depois da pausa
            </label>
          </div>
        )}

        {erro && <p className="mt-3 text-xs text-danger">{erro}</p>}

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onFechar}
            className="min-h-[44px] rounded-control border border-border px-4 py-2 text-sm font-medium text-text-secondary hover:bg-surface-muted"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={confirmar}
            disabled={enviando}
            className="min-h-[44px] rounded-control bg-warning px-4 py-2 text-sm font-medium text-white shadow-card hover:opacity-90 disabled:opacity-50"
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
    <div className="rounded-card border border-border bg-surface p-5 shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold text-text-primary">{PLATAFORMA_LABEL[plataforma]}</h3>
        <div className="flex gap-2">
          {editando ? (
            <>
              <button
                type="button"
                onClick={() => {
                  setEditando(false);
                  setRascunho(turnos);
                }}
                className="min-h-[36px] rounded-control border border-border px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-surface-muted"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={salvar}
                disabled={salvando}
                className="min-h-[36px] rounded-control bg-text-primary px-3 py-1.5 text-xs font-medium text-white shadow-card disabled:opacity-50"
              >
                {salvando ? 'Salvando...' : 'Salvar horário'}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setMostrarPausa(true)}
                className="min-h-[36px] rounded-control border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-warning hover:bg-amber-100"
              >
                Pausar agora
              </button>
              <button
                type="button"
                onClick={() => setEditando(true)}
                className="min-h-[36px] rounded-control border border-border px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-surface-muted"
              >
                Customizar
              </button>
            </>
          )}
        </div>
      </div>

      {erro && <p className="mt-2 text-xs text-danger">Erro ao carregar: {erro}</p>}
      {erroSalvar && <p className="mt-2 text-xs text-danger">Erro ao salvar: {erroSalvar}</p>}

      <div className="mt-4">
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
    <div className="p-4 sm:p-6 lg:p-8">
      <PageHeader
        titulo="Configurações"
        subtitulo="Horário de funcionamento e pausas"
        acoes={
          <button
            type="button"
            onClick={carregar}
            className="min-h-[44px] rounded-control border border-border bg-surface px-4 py-2 text-sm font-medium text-text-secondary shadow-card hover:bg-surface-muted"
          >
            Atualizar
          </button>
        }
      />

      {erro && (
        <div className="mt-4 rounded-card border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-danger">{erro}</div>
      )}

      {carregando ? (
        <EmptyState>Carregando...</EmptyState>
      ) : (
        dados && (
          <>
            <section className="mt-6 rounded-card border border-border bg-surface p-5 shadow-card">
              <h2 className="font-semibold text-text-primary">Horário semanal</h2>
              <p className="mt-1 text-sm text-text-secondary">
                Edite uma vez e aplique nas plataformas marcadas abaixo. Plataforma desmarcada mantém o horário atual
                dela — customize individualmente na seção abaixo, se precisar.
              </p>

              <div className="mt-4">
                <GradeSemanal turnos={turnosUnificados} editando onChange={setTurnosUnificados} />
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-4 border-t border-border pt-5">
                <span className="text-sm text-text-secondary">Aplicar em:</span>
                {Object.keys(PLATAFORMA_LABEL).map((plataforma) => (
                  <label key={plataforma} className="flex items-center gap-1.5 text-sm text-text-primary">
                    <input
                      type="checkbox"
                      checked={aplicarEm[plataforma]}
                      onChange={(e) => setAplicarEm((prev) => ({ ...prev, [plataforma]: e.target.checked }))}
                    />
                    {PLATAFORMA_LABEL[plataforma]}
                  </label>
                ))}
                <PrimaryButton
                  onClick={salvarUnificado}
                  disabled={salvandoUnificado || Object.values(aplicarEm).every((v) => !v)}
                  className="sm:ml-auto"
                >
                  {salvandoUnificado ? 'Salvando...' : 'Salvar horário'}
                </PrimaryButton>
              </div>

              {resultadoUnificado && (
                <div className="mt-3 space-y-1">
                  {resultadoUnificado.map((r) => (
                    <p key={r.plataforma} className={`text-xs ${r.sucesso ? 'text-success' : 'text-danger'}`}>
                      {PLATAFORMA_LABEL[r.plataforma]}: {r.sucesso ? 'salvo com sucesso' : r.erro}
                    </p>
                  ))}
                </div>
              )}
            </section>

            <section className="mt-8">
              <h2 className="text-sm font-semibold text-text-secondary">Customizar por plataforma</h2>
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
