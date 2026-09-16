/**
 * server.js
 * ---------
 * Ponto de entrada do backend do Totem de Atendimento ao Consumidor.
 * Junta os três pilares:
 *   1) Prevenção de SQL Injection  -> ./src/db.js (prepared statements)
 *   2) Gestão de erros no servidor -> ./src/middleware/errorHandler.js
 *   3) Rate limiting                -> ./src/middleware/rateLimiter.js
 */

// Captura quedas inesperadas de processo (ex: interrupção abrupta de energia)
process.on('uncaughtException', (err) => {
  console.error('[CRÍTICO] O servidor sofreu uma interrupção abrupta de energia ou falha de sistema:', err);
  // Aqui o log grava a emergência antes do encerramento total do hardware
  process.exit(1);
});

const express = require('express');
const path = require('path');
const { criarRateLimiter } = require('./src/middleware/rateLimiter');
const { errorHandler, rotaNaoEncontrada } = require('./src/middleware/errorHandler');
const rotasEstacionamento = require('./src/routes/estacionamento');
const { logInfo } = require('./src/logger');

const app = express();

app.disable('x-powered-by'); // não expõe tecnologia usada (boa prática extra)
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// PILAR 3: aplicado só nas rotas da API, que é onde o "aperta 500 milhões
// de vezes" do enunciado acontece (ex.: carro tentando registrar entrada
// repetidas vezes, ou alguém tentando "advinhar" tickets no /saida).
// Limite: 10 requisições a cada 60s por IP; quem estourar fica bloqueado
// por mais 60s.
const limitadorApi = criarRateLimiter({
  limite: 10,
  janelaMs: 60_000,
  tempoBloqueioMs: 60_000,
});

app.use('/api', limitadorApi, rotasEstacionamento);

app.get('/api/status', (req, res) => {
  res.json({ sucesso: true, status: 'online', hora: new Date().toISOString() });
});

// Responde sobre a saúde do hardware/rede.
// IMPORTANTE: precisa vir ANTES de rotaNaoEncontrada/errorHandler,
// já que esses dois middlewares não têm filtro de caminho e
// interceptariam essa rota antes dela ser executada.
app.get('/api/health', (req, res) => {
  try {
    // Testa se o SQLite continua respondendo (se a energia caiu ou corrompeu o arquivo, isso falha)
    const { db } = require('./src/db');
    db.prepare('SELECT 1').get();

    return res.status(200).json({
      status: "operacional",
      infraestrutura: {
        rede: "conectada",
        bancoDeDados: "ativo",
        eletricidadeNoTotem: "estavel" // Simulação de status de hardware
      },
      mensagem: "Todos os sistemas operando normalmente."
    });
  } catch (erroDeHardware) {
    // Captura falhas críticas de infraestrutura (queda de energia, disco corrompido, cabo de rede rompido)
    return res.status(503).json({
      status: "critico",
      erro: "Falha de infraestrutura detectada no totem.",
      detalhePublico: "Serviço temporariamente indisponível por instabilidade de rede ou energia."
    });
  }
});

// PILAR 2 (parte 1): rota não encontrada tratada explicitamente.
app.use(rotaNaoEncontrada);

// PILAR 2 (parte 2): middleware final de erros. Tem que ser o ÚLTIMO
// app.use() da cadeia, com 4 argumentos, para o Express reconhecer
// como error handler.
app.use(errorHandler);

const PORTA = process.env.PORT || 3000;
app.listen(PORTA, () => {
  logInfo(`Totem de atendimento rodando em http://localhost:${PORTA}`);
});