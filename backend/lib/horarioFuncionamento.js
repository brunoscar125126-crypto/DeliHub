// Tradução entre o formato "canônico" de horário semanal do DeliHub e o
// formato específico de cada plataforma. O resto do sistema (rotas,
// frontend) só conhece o formato canônico:
//
//   turno = { diaSemana: 'SEGUNDA'..'DOMINGO', inicio: 'HH:MM', fim: 'HH:MM' }
//
// Suporta turno atravessando meia-noite (ex: inicio '22:00', fim '02:00').

const DIAS_CANONICOS = ['SEGUNDA', 'TERCA', 'QUARTA', 'QUINTA', 'SEXTA', 'SABADO', 'DOMINGO'];

// --- iFood: shifts[] com dayOfWeek (EN, maiúsculo) + start (HH:MM:SS) + duration (minutos) ---

const DIA_CANONICO_PARA_IFOOD = {
  SEGUNDA: 'MONDAY',
  TERCA: 'TUESDAY',
  QUARTA: 'WEDNESDAY',
  QUINTA: 'THURSDAY',
  SEXTA: 'FRIDAY',
  SABADO: 'SATURDAY',
  DOMINGO: 'SUNDAY',
};
const DIA_IFOOD_PARA_CANONICO = Object.fromEntries(
  Object.entries(DIA_CANONICO_PARA_IFOOD).map(([canonico, ifood]) => [ifood, canonico])
);

function horaParaMinutos(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

function minutosParaHora(totalMinutos) {
  const m = ((totalMinutos % 1440) + 1440) % 1440; // normaliza, cobre passar de 24h
  const h = Math.floor(m / 60);
  const min = m % 60;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

/** turnos (canônico) -> shifts (iFood, pronto pra PUT /opening-hours) */
function turnosParaIfood(turnos) {
  return turnos.map((t) => {
    const inicioMin = horaParaMinutos(t.inicio);
    let fimMin = horaParaMinutos(t.fim);
    if (fimMin <= inicioMin) fimMin += 1440; // atravessa meia-noite
    return {
      dayOfWeek: DIA_CANONICO_PARA_IFOOD[t.diaSemana],
      start: `${t.inicio}:00`,
      duration: fimMin - inicioMin,
    };
  });
}

/** shifts (iFood, de GET /opening-hours) -> turnos (canônico) */
function ifoodParaTurnos(shifts) {
  return shifts.map((s) => {
    const inicioMin = horaParaMinutos(s.start.slice(0, 5));
    return {
      diaSemana: DIA_IFOOD_PARA_CANONICO[s.dayOfWeek],
      inicio: s.start.slice(0, 5),
      fim: minutosParaHora(inicioMin + s.duration),
    };
  });
}

// --- 99Food: biz_day_time — ATENÇÃO, formato de LEITURA e ESCRITA são
// diferentes (descoberto ao vivo, custou várias rodadas de tentativa e
// erro): GET shop/shop/detail devolve `biz_day`/`biz_time` (snake_case),
// mas POST shop/shop/update espera `bizDay`/`bizTime` (camelCase) dentro do
// mesmo campo `biz_day_time`. `begin`/`end` são iguais nos dois.
// Numeração de dia confirmada (via doc oficial): 1 = segunda ... 7 = domingo.

const DIA_CANONICO_PARA_99FOOD_NUM = {
  SEGUNDA: 1,
  TERCA: 2,
  QUARTA: 3,
  QUINTA: 4,
  SEXTA: 5,
  SABADO: 6,
  DOMINGO: 7,
};
const DIA_99FOOD_NUM_PARA_CANONICO = Object.fromEntries(
  Object.entries(DIA_CANONICO_PARA_99FOOD_NUM).map(([canonico, num]) => [num, canonico])
);

/**
 * turnos (canônico) -> biz_day_time no formato de ESCRITA (bizDay/bizTime
 * camelCase), pronto pro body de POST shop/shop/update. Confirmado ao vivo
 * (errno 0) — endpoint é atualização parcial, não precisa reenviar o resto
 * da loja, só este campo.
 */
function turnosParaNoventaENove(turnos) {
  // Uma entrada por dia (não compacta dias com o mesmo horário num só
  // grupo) — mais simples de gerar e igualmente válido pro schema deles.
  const porDia = new Map();
  for (const t of turnos) {
    const num = DIA_CANONICO_PARA_99FOOD_NUM[t.diaSemana];
    if (!porDia.has(num)) porDia.set(num, []);
    porDia.get(num).push({ begin: t.inicio, end: t.fim });
  }
  return Array.from(porDia.entries()).map(([bizDay, bizTime]) => ({ bizDay: [bizDay], bizTime }));
}

/** biz_day_time no formato de LEITURA (biz_day/biz_time snake_case, de shop/shop/detail) -> turnos (canônico) */
function noventaENoveParaTurnos(bizDayTime) {
  const turnos = [];
  for (const grupo of bizDayTime ?? []) {
    for (const dia of grupo.biz_day) {
      const diaSemana = DIA_99FOOD_NUM_PARA_CANONICO[dia];
      if (!diaSemana) continue; // número fora do mapeamento conhecido — ignora em vez de quebrar
      for (const faixa of grupo.biz_time) {
        turnos.push({ diaSemana, inicio: faixa.begin, fim: faixa.end });
      }
    }
  }
  return turnos;
}

module.exports = {
  DIAS_CANONICOS,
  turnosParaIfood,
  ifoodParaTurnos,
  turnosParaNoventaENove,
  noventaENoveParaTurnos,
};
