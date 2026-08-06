// Express 4 não propaga rejeições de Promise pro error handler sozinho —
// esse wrapper garante que qualquer erro assíncrono numa rota vire next(err)
// em vez de derrubar o processo ou travar a resposta.
module.exports = function asyncHandler(fn) {
  return function wrapped(req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
