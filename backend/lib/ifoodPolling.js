// Loop de polling da Events API do iFood — só existe porque o iFood não
// empurra pedido pra webhook nenhum (ver connectors/ifood.js). A cada
// intervalo, busca eventos pendentes, salva o payload bruto (formato ainda
// não confirmado neste projeto) em EventoPedido, e confirma o recebimento.

const ifood = require('../connectors/ifood');
const prisma = require('./prisma');

const INTERVALO_MS = Number(process.env.IFOOD_POLLING_INTERVAL_MS) || 30_000;

let intervalId = null;
let executando = false; // evita sobrepor um ciclo com o anterior se a API demorar

async function cicloDePolling() {
  if (executando) return;
  executando = true;
  try {
    const eventos = await ifood.buscarEventosPendentes();
    if (eventos.length > 0) {
      console.log(`[ifoodPolling] ${eventos.length} evento(s) recebido(s)`);
      await prisma.eventoPedido.createMany({
        data: eventos.map((evento) => ({
          plataforma: 'ifood',
          origem: 'polling',
          payload: evento,
        })),
      });
      await ifood.confirmarEventos(eventos.map((e) => e.id).filter(Boolean));
    }
  } catch (err) {
    // Não deixa o polling morrer por causa de um ciclo com erro (ex: token
    // expirado momentaneamente) — só loga e tenta de novo no próximo tick.
    console.error('[ifoodPolling] erro no ciclo:', err.response?.data ?? err.message);
  } finally {
    executando = false;
  }
}

function iniciarPolling() {
  if (intervalId) return; // já rodando, não duplica
  if (!process.env.IFOOD_MERCHANT_ID) {
    console.warn('[ifoodPolling] IFOOD_MERCHANT_ID não configurado — polling de eventos não iniciado');
    return;
  }
  console.log(`[ifoodPolling] iniciando, intervalo de ${INTERVALO_MS}ms`);
  intervalId = setInterval(cicloDePolling, INTERVALO_MS);
  cicloDePolling(); // primeira busca imediata, não espera o primeiro intervalo
}

function pararPolling() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

module.exports = { iniciarPolling, pararPolling };
