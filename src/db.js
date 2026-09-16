/**
 * db.js
 * -----
 * Camada de acesso ao banco de dados do Totem de Autoatendimento para
 * Estacionamento.
 *
 * PILAR 1 - PREVENCAO DE SQL INJECTION
 * -------------------------------------
 * Toda consulta aqui usa "Prepared Statements" (db.prepare + parametros
 * com "?"). O texto digitado/lido pelo usuario (placa do veiculo, codigo
 * do ticket) NUNCA e concatenado diretamente na string SQL.
 *
 * Errado (NUNCA fazer):
 *   db.exec(`SELECT * FROM veiculos WHERE placa = '${placa}'`)
 *
 * Certo (o que fazemos aqui):
 *   db.prepare('SELECT * FROM veiculos WHERE placa = ?').get(placa)
 *
 * PILAR 2 (parte de infraestrutura) - ENCAPSULAMENTO DE ERROS DE BANCO
 * ----------------------------------------------------------------------
 * Qualquer chamada .get/.run/.all de qualquer statement passa por
 * "encapsular()", que converte falhas reais do SQLite (arquivo corrompido,
 * disco cheio, banco travado - o equivalente a "queda de energia/rede" do
 * enunciado) em ErroDeBancoDeDados. Assim TODAS as rotas (leitura e
 * escrita) ficam protegidas automaticamente, sem precisar repetir
 * try/catch em cada uma.
 */

const Database = require('better-sqlite3');
const path = require('path');
const { ErroDeBancoDeDados } = require('./errors');

const dbPath = path.join(__dirname, '..', 'estacionamento.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS veiculos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket TEXT NOT NULL UNIQUE,
    placa TEXT,
    tipo TEXT NOT NULL DEFAULT 'carro',
    entrada TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    saida TEXT,
    valor_pago REAL,
    status TEXT NOT NULL DEFAULT 'dentro'
  );

  CREATE TABLE IF NOT EXISTS configuracao (
    chave TEXT PRIMARY KEY,
    valor TEXT NOT NULL
  );
`);

// Configuracao padrao do patio (idempotente).
// Vagas separadas por tipo: a area de moto e menor e fica isolada da area
// de carro (como em patios reais com vaga exclusiva pra moto).
db.prepare(
  `INSERT OR IGNORE INTO configuracao (chave, valor) VALUES ('vagas_totais_carro', '50')`
).run();
db.prepare(
  `INSERT OR IGNORE INTO configuracao (chave, valor) VALUES ('vagas_totais_moto', '10')`
).run();
// Tarifa FIXA por tipo de veiculo (sem cobranca progressiva por hora):
// carro paga um valor fechado, moto paga um valor fechado e mais barato -
// e o que o patio real faz quando tem uma area exclusiva pra moto.
db.prepare(
  `INSERT OR IGNORE INTO configuracao (chave, valor) VALUES ('valor_carro', '13.00')`
).run();
db.prepare(
  `INSERT OR IGNORE INTO configuracao (chave, valor) VALUES ('valor_moto', '10.00')`
).run();

const TIPOS_VALIDOS = ['carro', 'moto'];

/**
 * Envolve um statement "cru" do better-sqlite3 para que qualquer erro
 * lancado por .get/.run/.all vire um ErroDeBancoDeDados (503), com o
 * detalhe tecnico original preservado so para o log do servidor.
 */
function encapsular(stmt) {
  return {
    get: (...args) => {
      try {
        return stmt.get(...args);
      } catch (erroBanco) {
        throw new ErroDeBancoDeDados(erroBanco.message);
      }
    },
    run: (...args) => {
      try {
        return stmt.run(...args);
      } catch (erroBanco) {
        throw new ErroDeBancoDeDados(erroBanco.message);
      }
    },
    all: (...args) => {
      try {
        return stmt.all(...args);
      } catch (erroBanco) {
        throw new ErroDeBancoDeDados(erroBanco.message);
      }
    },
  };
}

// Todas as instrucoes abaixo sao PREPARADAS uma unica vez, reutilizadas
// com parametros (?) e encapsuladas para tratar falha de infraestrutura
// de forma automatica e consistente em toda a aplicacao.
const stmts = {
  inserirEntrada: encapsular(db.prepare(
    `INSERT INTO veiculos (ticket, placa, tipo) VALUES (?, ?, ?)`
  )),
  buscarPorTicket: encapsular(db.prepare(
    `SELECT * FROM veiculos WHERE ticket = ?`
  )),
  buscarDentroPorPlaca: encapsular(db.prepare(
    `SELECT * FROM veiculos WHERE placa = ? AND status = 'dentro' ORDER BY id DESC LIMIT 1`
  )),
  registrarSaida: encapsular(db.prepare(
    `UPDATE veiculos SET status = 'saiu', saida = datetime('now','localtime'), valor_pago = ?
     WHERE id = ?`
  )),
  contarVeiculosDentroPorTipo: encapsular(db.prepare(
    `SELECT COUNT(*) AS total FROM veiculos WHERE status = 'dentro' AND tipo = ?`
  )),
  listarVeiculosDentro: encapsular(db.prepare(
    `SELECT * FROM veiculos WHERE status = 'dentro' ORDER BY entrada ASC`
  )),
  buscarConfig: encapsular(db.prepare(
    `SELECT valor FROM configuracao WHERE chave = ?`
  )),
};

function tipoValido(tipo) {
  return TIPOS_VALIDOS.includes(tipo);
}

function getConfigNumero(chave) {
  const linha = stmts.buscarConfig.get(chave);
  return linha ? Number(linha.valor) : null;
}

function gerarTicket() {
  // Codigo curto e legivel para impressao no totem: T + timestamp base36 + aleatorio
  const agora = Date.now().toString(36).toUpperCase();
  const aleatorio = Math.floor(Math.random() * 36 ** 3).toString(36).toUpperCase().padStart(3, '0');
  return `T-${agora}-${aleatorio}`;
}

module.exports = {
  db,
  stmts,
  TIPOS_VALIDOS,
  tipoValido,
  getConfigNumero,
  gerarTicket,
};