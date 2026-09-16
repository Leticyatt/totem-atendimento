/**
 * server.js
 * ---------
 * Ponto de entrada do backend do Totem de Atendimento ao Consumidor.
 * Responsabilidade única: subir o servidor HTTP na porta configurada.
 * A montagem da aplicação (rotas, middlewares, pilares) fica em ./app.js.
 */

// Captura quedas inesperadas de processo (ex: interrupção abrupta de energia)
process.on('uncaughtException', (err) => {
  console.error('[CRÍTICO] O servidor sofreu uma interrupção abrupta de energia ou falha de sistema:', err);
  // Aqui o log grava a emergência antes do encerramento total do hardware
  process.exit(1);
});

const { criarApp } = require('./app');
const { logInfo } = require('./logger');
const config = require('../config/config');

const app = criarApp();

app.listen(config.porta, () => {
  logInfo(`Totem de atendimento rodando em http://localhost:${config.porta}`);
});
