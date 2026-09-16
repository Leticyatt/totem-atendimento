/**
 * app.js
 * ------
 * Monta a aplicação Express (rotas, middlewares, pilares de segurança)
 * e a exporta, sem subir o servidor. Isso permite reutilizar o "app"
 * tanto no entrypoint real (src/server.js) quanto nos testes
 * automatizados (tests/), sem precisar abrir uma porta de verdade.
 *
 * Junta os três pilares:
 *   1) Prevenção de SQL Injection  -> ./db.js (prepared statements)
 *   2) Gestão de erros no servidor -> ./middleware/errorHandler.js
 *   3) Rate limiting                -> ./middleware/rateLimiter.js
 */

const express = require('express');
const path = require('path');
const { errorHandler, rotaNaoEncontrada } = require('./middleware/errorHandler');
const rotasEstacionamento = require('./routes/estacionamento');

function criarApp() {
  const app = express();

  app.disable('x-powered-by'); // não expõe tecnologia usada (boa prática extra)
  app.use(express.json());
  app.use(express.static(path.join(__dirname, '..', 'assets')));

  // PILAR 3: o rate limiter agora é aplicado dentro de
  // ./routes/estacionamento.js, apenas nas rotas de escrita
  // (/entrada e /saida) — ver comentário lá para o motivo.
  app.use('/api', rotasEstacionamento);

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
      const { db } = require('./db');
      db.prepare('SELECT 1').get();

      return res.status(200).json({
        status: 'operacional',
        infraestrutura: {
          rede: 'conectada',
          bancoDeDados: 'ativo',
          eletricidadeNoTotem: 'estavel', // Simulação de status de hardware
        },
        mensagem: 'Todos os sistemas operando normalmente.',
      });
    } catch (erroDeHardware) {
      // Captura falhas críticas de infraestrutura (queda de energia, disco corrompido, cabo de rede rompido)
      return res.status(503).json({
        status: 'critico',
        erro: 'Falha de infraestrutura detectada no totem.',
        detalhePublico: 'Serviço temporariamente indisponível por instabilidade de rede ou energia.',
      });
    }
  });

  // PILAR 2 (parte 1): rota não encontrada tratada explicitamente.
  app.use(rotaNaoEncontrada);

  // PILAR 2 (parte 2): middleware final de erros. Tem que ser o ÚLTIMO
  // app.use() da cadeia, com 4 argumentos, para o Express reconhecer
  // como error handler.
  app.use(errorHandler);

  return app;
}

module.exports = { criarApp };
