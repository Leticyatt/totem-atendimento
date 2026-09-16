/**
 * tests/pilares.test.js
 * ----------------------
 * Testes automatizados dos 3 pilares de segurança exigidos no trabalho:
 *   1) Prevenção de SQL Injection
 *   2) Gestão de erros no servidor
 *   3) Rate limiting
 *
 * Usa o test runner nativo do Node (node:test) — não exige nenhuma
 * dependência nova no projeto. Roda com: npm test
 *
 * Cada teste usa um arquivo de banco de dados isolado (via variável de
 * ambiente) para não sujar o banco real usado em desenvolvimento.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const http = require('node:http');

// Banco de dados isolado só para os testes (apagado ao final).
const DB_TESTE = path.join(__dirname, 'teste-estacionamento.db');
process.env.TOTEM_DB_PATH = DB_TESTE;

function limparBancoDeTeste() {
  for (const sufixo of ['', '-shm', '-wal']) {
    const arquivo = DB_TESTE + sufixo;
    if (fs.existsSync(arquivo)) fs.unlinkSync(arquivo);
  }
}

limparBancoDeTeste();

const { criarApp } = require('../src/app');

// Sobe o app num servidor HTTP real, em porta aleatória (0),
// só durante a bateria de testes.
function subirServidorDeTeste() {
  const app = criarApp();
  const servidor = http.createServer(app);
  return new Promise((resolve) => {
    servidor.listen(0, () => resolve(servidor));
  });
}

function requisitar(servidor, metodo, caminho, corpo) {
  const { port } = servidor.address();
  const dados = corpo ? JSON.stringify(corpo) : null;
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: 'localhost',
        port,
        path: caminho,
        method: metodo,
        headers: dados
          ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(dados) }
          : {},
      },
      (res) => {
        let bruto = '';
        res.on('data', (chunk) => (bruto += chunk));
        res.on('end', () => {
          let json = null;
          try { json = JSON.parse(bruto); } catch { /* corpo vazio/não-JSON */ }
          resolve({ status: res.statusCode, corpo: json });
        });
      }
    );
    req.on('error', reject);
    if (dados) req.write(dados);
    req.end();
  });
}

test('PILAR 1 - SQL Injection: placa maliciosa é tratada como dado, não como comando SQL', async (t) => {
  const servidor = await subirServidorDeTeste();
  t.after(() => servidor.close());

  const placaMaliciosa = "' OR '1'='1'; DROP TABLE veiculos; --";

  const resposta = await requisitar(servidor, 'POST', '/api/entrada', {
    placa: placaMaliciosa,
    tipo: 'carro',
  });

  // O importante: o servidor não quebra nem executa o SQL malicioso.
  // Ele deve responder normalmente (sucesso) ou com um erro de
  // validação — nunca com um erro de sintaxe SQL ou tabela apagada.
  assert.ok([200, 201, 400, 422].includes(resposta.status));

  // A tabela "veiculos" precisa continuar existindo (não foi derrubada).
  const statusApi = await requisitar(servidor, 'GET', '/api/status');
  assert.equal(statusApi.status, 200);
});

test('PILAR 2 - Gestão de erros: rota inexistente retorna 404 com mensagem genérica', async (t) => {
  const servidor = await subirServidorDeTeste();
  t.after(() => servidor.close());

  const resposta = await requisitar(servidor, 'GET', '/api/rota-que-nao-existe');

  assert.equal(resposta.status, 404);
  // Mensagem deve ser genérica para o usuário (sem stack trace, sem
  // detalhes internos do servidor vazando na resposta).
  assert.ok(resposta.corpo);
  const textoResposta = JSON.stringify(resposta.corpo).toLowerCase();
  assert.ok(!textoResposta.includes('at ') && !textoResposta.includes('.js:'));
});

test('PILAR 3 - Rate limiting: bloqueia após exceder o limite de requisições na rota de escrita', async (t) => {
  const servidor = await subirServidorDeTeste();
  t.after(() => servidor.close());

  const respostas = [];
  // O limite padrão é 10 por janela; disparamos mais que isso contra uma
  // rota de ESCRITA (/entrada), que é onde o limitador é aplicado agora
  // (rotas de leitura como /vagas e /tarifas ficam de fora de propósito).
  for (let i = 0; i < 12; i++) {
    // eslint-disable-next-line no-await-in-loop
    respostas.push(await requisitar(servidor, 'POST', '/api/entrada', { tipo: 'carro' }));
  }

  const bloqueadas = respostas.filter((r) => r.status === 429);
  assert.ok(bloqueadas.length > 0, 'esperava pelo menos uma resposta 429 (Too Many Requests)');
});

test('PILAR 3 - Rate limiting: rotas de leitura (/vagas) não são bloqueadas', async (t) => {
  const servidor = await subirServidorDeTeste();
  t.after(() => servidor.close());

  const respostas = [];
  for (let i = 0; i < 15; i++) {
    // eslint-disable-next-line no-await-in-loop
    respostas.push(await requisitar(servidor, 'GET', '/api/vagas'));
  }

  const bloqueadas = respostas.filter((r) => r.status === 429);
  assert.equal(bloqueadas.length, 0, 'consultas de leitura não deveriam ser limitadas');
});

test.after(() => limparBancoDeTeste());
