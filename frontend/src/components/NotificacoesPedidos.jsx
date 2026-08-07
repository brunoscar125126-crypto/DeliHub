import { useCallback, useEffect, useRef, useState } from 'react';
import { Bell, BellOff, X } from 'lucide-react';
import { usePedidos, usePedidosNovosListener } from '../context/PedidosContext.jsx';

const PLATAFORMA_LABEL = { ifood: 'iFood', noventaenove: '99Food', keeta: 'Keeta' };
const CHAVE_DISPENSADO = 'delihub_aviso_som_dispensado';

// A cada quanto tempo o alarme repete enquanto houver pedido pendente
// (pedido "decidido" = confirmadoEm preenchido — hoje só existe confirmar,
// não tem recusar ainda; quando existir, entra na mesma conta).
const INTERVALO_ALARME_MS = 2500;

/** Dois beeps curtos ascendentes via Web Audio API — sem depender de nenhum arquivo de áudio. */
function tocarBeep(ctx) {
  if (!ctx) return;
  try {
    [0, 0.18].forEach((atraso, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = i === 0 ? 880 : 1046.5; // A5 -> C6
      const inicio = ctx.currentTime + atraso;
      gain.gain.setValueAtTime(0, inicio);
      gain.gain.linearRampToValueAtTime(0.25, inicio + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, inicio + 0.35);
      osc.connect(gain).connect(ctx.destination);
      osc.start(inicio);
      osc.stop(inicio + 0.4);
    });
  } catch {
    // Web Audio indisponível ou contexto suspenso — som é um extra, não pode quebrar a UI.
  }
}

/**
 * Não renderiza os pedidos em si — só cuida do "sino" da aplicação: pede
 * autorização (som + Notification API) no primeiro clique do usuário na
 * tela, dispara notificação do navegador quando o PedidosContext detecta
 * pedido novo, e mantém um alarme em loop enquanto houver pedido pendente
 * de decisão. Monta uma vez em App.jsx, funciona em qualquer página.
 */
export default function NotificacoesPedidos() {
  const { pedidos } = usePedidos();
  const [ativado, setAtivado] = useState(false);
  const [dispensado, setDispensado] = useState(() => sessionStorage.getItem(CHAVE_DISPENSADO) === '1');
  const [silenciado, setSilenciado] = useState(false);
  const audioContextRef = useRef(null);
  const alarmeIntervalRef = useRef(null);

  useEffect(() => {
    if (ativado) return;

    function ativar() {
      // AudioContext só pode ser criado/retomado depois de um gesto real do
      // usuário (bloqueio de autoplay) — é esse gesto que capturamos aqui,
      // no primeiro clique em QUALQUER lugar da tela.
      if (!audioContextRef.current) {
        const AudioContextCls = window.AudioContext || window.webkitAudioContext;
        if (AudioContextCls) audioContextRef.current = new AudioContextCls();
      }
      audioContextRef.current?.resume?.();

      if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
      }

      setAtivado(true);
    }

    document.addEventListener('click', ativar);
    return () => document.removeEventListener('click', ativar);
  }, [ativado]);

  const pendentes = pedidos.filter((p) => !p.confirmadoEm);
  const haPendentes = pendentes.length > 0;

  // Alarme em loop: toca (imediato + a cada INTERVALO_ALARME_MS) enquanto
  // houver ao menos 1 pedido pendente, o som estiver ativado e não estiver
  // silenciado na mão. A dependência é o BOOLEANO `haPendentes`, não a
  // contagem — assim, um segundo pedido chegando enquanto o alarme já toca
  // não reinicia nem duplica o loop (some 1→2 pendentes não muda o
  // booleano); só um efeito real (zerou os pendentes, ativou/desativou o
  // som, silenciou/reativou) reinicia ou para o timer.
  useEffect(() => {
    if (!haPendentes || !ativado || silenciado) return undefined;

    tocarBeep(audioContextRef.current);
    alarmeIntervalRef.current = setInterval(() => tocarBeep(audioContextRef.current), INTERVALO_ALARME_MS);

    return () => {
      clearInterval(alarmeIntervalRef.current);
      alarmeIntervalRef.current = null;
    };
  }, [haPendentes, ativado, silenciado]);

  // "Silenciar" é pra um momento, não pra esquecer ligado: some sozinho
  // assim que a fila de pendentes zera, pro próximo pedido novo já tocar
  // normal (em vez de ficar mudo por engano numa sessão futura).
  useEffect(() => {
    if (!haPendentes && silenciado) setSilenciado(false);
  }, [haPendentes, silenciado]);

  const aoChegarPedidoNovo = useCallback((pedidosNovos) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      pedidosNovos.forEach((p) => {
        const label = PLATAFORMA_LABEL[p.plataforma] ?? p.plataforma;
        const notificacao = new Notification('Novo pedido no DeliHub', {
          body: `${label} — pedido ${p.orderId}`,
          icon: '/pwa-192.png',
          tag: p.id, // evita duplicar se o mesmo pedido disparar o evento mais de uma vez
        });
        notificacao.onclick = () => window.focus();
      });
    }
  }, []);

  usePedidosNovosListener(aoChegarPedidoNovo);

  function dispensarAvisoAtivacao() {
    sessionStorage.setItem(CHAVE_DISPENSADO, '1');
    setDispensado(true);
  }

  // Aviso de "clique pra ativar" — só antes da primeira ativação.
  if (!ativado && !dispensado) {
    return (
      <div className="flex items-center justify-between gap-3 border-b border-border bg-primary/10 px-4 py-2 text-sm text-text-primary">
        <span className="flex items-center gap-2">
          <Bell size={16} className="shrink-0 text-primary" />
          Clique em qualquer lugar da tela pra ativar o som e as notificações de pedido novo.
        </span>
        <button
          type="button"
          onClick={dispensarAvisoAtivacao}
          aria-label="Dispensar aviso"
          className="shrink-0 rounded-control p-1 text-text-secondary hover:bg-surface-muted"
        >
          <X size={16} />
        </button>
      </div>
    );
  }

  // Barra de alarme — só aparece com o som ativado e pedido(s) esperando decisão.
  if (ativado && haPendentes) {
    return (
      <div className="flex items-center justify-between gap-3 border-b border-border bg-warning/10 px-4 py-2 text-sm text-text-primary">
        <span className="flex items-center gap-2">
          <Bell size={16} className={`shrink-0 text-warning ${silenciado ? '' : 'animate-pulse'}`} />
          {pendentes.length} pedido{pendentes.length > 1 ? 's' : ''} aguardando confirmação
          {silenciado && ' — som silenciado'}
        </span>
        <button
          type="button"
          onClick={() => setSilenciado((v) => !v)}
          className="flex shrink-0 items-center gap-1.5 rounded-control border border-border bg-surface px-2.5 py-1 text-xs font-medium text-text-primary hover:bg-surface-muted"
        >
          {silenciado ? (
            <>
              <Bell size={14} /> Reativar som
            </>
          ) : (
            <>
              <BellOff size={14} /> Silenciar
            </>
          )}
        </button>
      </div>
    );
  }

  return null;
}
