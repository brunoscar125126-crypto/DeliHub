require('dotenv').config();

const express = require('express');
const cors = require('cors');
const produtosRouter = require('./routes/produtos');
const importacaoRouter = require('./routes/importacao');
const webhooksRouter = require('./routes/webhooks');
const horarioRouter = require('./routes/horario');
const { iniciarPolling } = require('./lib/ifoodPolling');

const app = express();

app.use(cors());
app.use(
  express.json({
    // Guarda o corpo bruto (Buffer) em req.rawBody — necessário pra: (1)
    // verificar assinatura de webhooks exatamente como chegou, e (2)
    // reparsear com json-bigint quando IDs de 64 bits estiverem em jogo
    // (ver routes/webhooks.js). O parser padrão do Express usa JSON.parse,
    // que perde precisão nesses casos.
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  })
);

app.get('/health', (_req, res) => res.json({ status: 'ok' }));
app.use('/api/produtos', produtosRouter);
app.use('/api/importacao', importacaoRouter);
app.use('/api/webhooks', webhooksRouter);
app.use('/api/horario', horarioRouter);

// Error handler global — captura tanto erros síncronos quanto os
// encaminhados via asyncHandler (lib/asyncHandler.js) nas rotas.
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Erro interno' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`DeliHub backend rodando na porta ${PORT}`);
  iniciarPolling();
});
