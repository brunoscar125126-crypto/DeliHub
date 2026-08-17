// Traduz o `statusEvento` cru que a plataforma manda (99Food: campo `type`
// do webhook, ex: "orderNew"; iFood: `code`/`fullCode` do evento, ex: "CFM"/
// "CONFIRMED") pra um rótulo legível + variante de cor do StatusBadge.
//
// Os códigos do iFood aqui (PLC/CFM/RTP/DSP/CON/CAN e as versões por extenso)
// são os documentados publicamente na Order API — o DeliHub ainda não
// processou nenhum pedido real do iFood pra confirmar 100%, então qualquer
// código não mapeado cai no fallback (mostra o valor cru, sem inventar
// tradução) em vez de quebrar ou mentir.
const MAPA_STATUS = {
  // 99Food
  orderNew: { label: 'Novo', variante: 'warning' },

  // iFood — código curto e fullCode, os dois formatos possíveis do evento
  PLC: { label: 'Novo', variante: 'warning' },
  PLACED: { label: 'Novo', variante: 'warning' },
  CFM: { label: 'Confirmado', variante: 'warning' },
  CONFIRMED: { label: 'Confirmado', variante: 'warning' },
  RTP: { label: 'Pronto', variante: 'warning' },
  READY_TO_PICKUP: { label: 'Pronto', variante: 'warning' },
  DSP: { label: 'Saiu para entrega', variante: 'warning' },
  DISPATCHED: { label: 'Saiu para entrega', variante: 'warning' },
  CON: { label: 'Entregue', variante: 'success' },
  CONCLUDED: { label: 'Entregue', variante: 'success' },
  CAN: { label: 'Cancelado', variante: 'danger' },
  CANCELLED: { label: 'Cancelado', variante: 'danger' },
};

/** @returns {{label: string, variante: 'success'|'warning'|'danger'|'neutral'}} */
export function statusPedido(statusEvento) {
  if (!statusEvento) return { label: 'Status desconhecido', variante: 'neutral' };
  return MAPA_STATUS[statusEvento] ?? { label: statusEvento, variante: 'neutral' };
}
