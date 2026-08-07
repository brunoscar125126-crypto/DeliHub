import { useCallback, useEffect, useRef, useState } from 'react';
import { Bell, X } from 'lucide-react';
import { usePedidosNovosListener } from '../context/PedidosContext.jsx';

const PLATAFORMA_LABEL = { ifood: 'iFood', noventaenove: '99Food', keeta: 'Keeta' };
const CHAVE_DISPENSADO = 'delihub_aviso_som_dispensado';

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
 * tela, e depois toca/notifica sempre que o PedidosContext detectar
 * pedido novo. Monta uma vez em App.jsx, funciona em qualquer página.
 */
export default function NotificacoesPedidos() {
  const [ativado, setAtivado] = useState(false);
  const [dispensado, setDispensado] = useState(() => sessionStorage.getItem(CHAVE_DISPENSADO) === '1');
  const audioContextRef = useRef(null);

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

  const aoChegarPedidoNovo = useCallback((pedidosNovos) => {
    tocarBeep(audioContextRef.current);

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

  function dispensar() {
    sessionStorage.setItem(CHAVE_DISPENSADO, '1');
    setDispensado(true);
  }

  if (ativado || dispensado) return null;

  return (
    <div className="flex items-center justify-between gap-3 border-b border-border bg-primary/10 px-4 py-2 text-sm text-text-primary">
      <span className="flex items-center gap-2">
        <Bell size={16} className="shrink-0 text-primary" />
        Clique em qualquer lugar da tela pra ativar o som e as notificações de pedido novo.
      </span>
      <button
        type="button"
        onClick={dispensar}
        aria-label="Dispensar aviso"
        className="shrink-0 rounded-control p-1 text-text-secondary hover:bg-surface-muted"
      >
        <X size={16} />
      </button>
    </div>
  );
}
