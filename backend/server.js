require('dotenv').config();

const express = require('express');
const cors = require('cors');
const produtosRouter = require('./routes/produtos');
const importacaoRouter = require('./routes/importacao');
const webhooksRouter = require('./routes/webhooks');
const { iniciarPolling } = require('./lib/ifoodPolling');

const app = express();

app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => res.json({ status: 'ok' }));
app.use('/api/produtos', produtosRouter);
app.use('/api/importacao', importacaoRouter);
app.use('/api/webhooks', webhooksRouter);

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
