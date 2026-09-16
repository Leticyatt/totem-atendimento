/**
 * config.js
 * ---------
 * Configurações da aplicação, centralizadas em um único lugar
 * (em vez de espalhadas/hardcoded pelo código-fonte).
 *
 * Qualquer valor "de negócio" (tarifas, vagas, limites de requisição,
 * porta do servidor) deve ser lido a partir daqui.
 */

module.exports = {
  // Porta do servidor HTTP. Pode ser sobrescrita por variável de ambiente.
  porta: process.env.PORT || 3000,

  // PILAR 3 - Rate limiting: limite de requisições sucessivas por IP
  // nas rotas da API (ex.: alguém "apertando" o botão de entrada/saída
  // repetidas vezes, ou tentando adivinhar tickets).
  rateLimiter: {
    limite: 10,          // requisições permitidas
    janelaMs: 60_000,     // por janela de 60s
    tempoBloqueioMs: 60_000, // tempo de bloqueio ao estourar o limite
  },

  // Configuração padrão do pátio de estacionamento (valores-semente,
  // inseridos no banco na primeira execução, ver src/db.js).
  patio: {
    vagasTotaisCarro: 50,
    vagasTotaisMoto: 10,
    valorCarro: 13.0, // tarifa fixa por veículo tipo "carro"
    valorMoto: 10.0,  // tarifa fixa por veículo tipo "moto"
  },
};
