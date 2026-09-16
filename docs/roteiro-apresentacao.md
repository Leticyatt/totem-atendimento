# Roteiro — Apresentação Totem de Estacionamento (Segurança de Sistemas)

> Ordem pedida pelo professor: **1) estrutura/organização do código → 2) testes → 3) commits → 4) sistema rodando testando o checklist obrigatório.**
> Você conduz a apresentação — este roteiro é seu apoio, com o que falar e exatamente onde mostrar no código ou no terminal em cada momento.

---

## 0. Abertura (30s)

> "Nosso sistema é um totem de autoatendimento de estacionamento: entrada e saída de veículo, cálculo de tarifa e consulta de vagas. Ele implementa os três pilares de segurança pedidos e também os princípios da tríade CID. Vou mostrar primeiro como o projeto está organizado, depois os testes e os commits, e por fim vou rodar o sistema ao vivo e testar cada item do checklist."

---

## 1. Estrutura do código (mostrar na IDE, sem rodar nada ainda)

Abra a árvore de arquivos do projeto e vá apontando:

```
totem-atendimento/
├── config/config.js        → todas as configs num só lugar (tarifas, vagas, rate limit, porta)
├── src/
│   ├── app.js               → monta a aplicação (rotas + os 3 pilares)
│   ├── server.js             → só sobe o servidor (ponto de entrada)
│   ├── db.js                  → banco de dados + prepared statements
│   ├── errors.js               → erros tipados
│   ├── logger.js                → log técnico (console + arquivo)
│   ├── middleware/
│   │   ├── errorHandler.js       → Pilar 2
│   │   └── rateLimiter.js         → Pilar 3
│   └── routes/estacionamento.js   → rotas da API
├── assets/index.html         → interface visual do totem
├── tests/pilares.test.js     → testes automatizados dos 3 pilares
├── docs/pilares.md            → documentação técnica
├── package.json, .gitignore, README.md
```

**Fale:**
> "Separei o projeto em `config/` para as configurações, `src/` para o código-fonte, `assets/` para a interface, `tests/` para os testes automatizados e `docs/` para a documentação técnica — é a estrutura padrão que vocês pediram. Um destaque: separei `app.js` (a aplicação em si) de `server.js` (que só sobe o servidor) — isso é o que me permitiu escrever testes automatizados sem precisar abrir uma porta de verdade."

---

## 2. Testes automatizados

No terminal, dentro da pasta do projeto:

```bash
npm test
```

**Mostre o resultado** (3 testes passando: `pass 3`, `fail 0`).

**Fale, apontando pra `tests/pilares.test.js`:**
> "Escrevi um teste automatizado pra cada pilar, usando o test runner nativo do Node, sem precisar adicionar nenhuma biblioteca nova. O primeiro manda uma placa com um comando SQL malicioso e confere que o sistema não quebra. O segundo bate numa rota que não existe e confere que a resposta não vaza nenhum detalhe técnico — tipo caminho de arquivo. O terceiro dispara 12 requisições seguidas e confere que a partir da décima o sistema começa a bloquear com 429."

---

## 3. Commits (histórico versionado)

No terminal:

```bash
git log --oneline
```

**Mostre a lista de 5 commits** e narre a evolução:

| Commit | O que fala |
|---|---|
| `Versão inicial ... (vibe coding)` | "Esse é o ponto de partida: o backend já com os 3 pilares implementados." |
| `refactor: renomear public/ para assets/` | "Primeiro ajuste de estrutura: renomeei a pasta que serve a interface web pro nome padrão." |
| `refactor: criar config/config.js e separar app.js de server.js` | "Aqui tirei os valores fixos do código e centralizei em `config/`, e separei a aplicação do que sobe o servidor — isso é o que abriu espaço pra testar." |
| `test: adicionar testes automatizados + docs/pilares.md` | "Nessa etapa escrevi os testes e documentei os pilares." |
| `docs: atualizar README` | "Por último, atualizei a documentação geral do projeto." |

**Fale:**
> "Cada etapa da reorganização ficou registrada em um commit separado, então dá pra acompanhar a evolução do projeto do estado inicial até a estrutura final."

*(Se ele pedir pra ver o diff de algum commit: `git show <hash> --stat`.)*

---

## 4. Sistema rodando — checklist ao vivo

Suba o servidor:

```bash
npm start
```

Abra `http://localhost:3000` no navegador (interface do totem) **e** deixe um terminal separado aberto pros comandos `curl` abaixo.

### ✅ Pilar 1 — Prevenção de SQL Injection

**Onde no código:** `src/db.js` — todas as queries usam `db.prepare(...)` com `?` no lugar do valor (nunca concatenação de string).

**Demonstração ao vivo:**
```bash
curl -X POST http://localhost:3000/api/entrada \
  -H "Content-Type: application/json" \
  -d '{"placa":"'"'"'; DROP TABLE veiculos; --","tipo":"carro"}'
```
Resultado esperado: `400` com `"Placa inválida..."` — o texto malicioso nunca vira comando, é tratado só como dado (e nem passa na validação de formato).

**Prove que a tabela sobreviveu:**
```bash
curl http://localhost:3000/api/vagas
```
Mostra a contagem de vagas normalmente — nada foi apagado.

**Fale:** "O `?` faz o SQLite compilar o comando antes de saber o valor. Então o que a pessoa digitar nunca vira parte do SQL — vira só um texto."

---

### ✅ Pilar 2 — Gestão de erros no servidor

**Onde no código:** `src/errors.js` (mensagem pública x detalhe interno) e `src/middleware/errorHandler.js` (loga tudo, devolve só o genérico).

**Demonstração ao vivo:** registre uma entrada, dê saída duas vezes no mesmo ticket.
```bash
# 1) entrada
curl -X POST http://localhost:3000/api/entrada -H "Content-Type: application/json" -d '{"tipo":"carro"}'
# copie o "ticket" da resposta e use abaixo (ex.: T-XXXX)

# 2) primeira saída (funciona)
curl -X POST http://localhost:3000/api/saida -H "Content-Type: application/json" -d '{"ticket":"T-XXXX"}'

# 3) segunda saída no mesmo ticket (erro tratado)
curl -X POST http://localhost:3000/api/saida -H "Content-Type: application/json" -d '{"ticket":"T-XXXX"}'
```
Resultado esperado no passo 3: mensagem genérica `"Este veículo já registrou saída anteriormente."` — sem stack trace, sem nome de arquivo.

**Mostre o console do servidor** (onde rodou `npm start`): aparece a linha `[ERRO] ... | POST /api/saida | ...` — o detalhe técnico fica só ali.

**Se quiser, mostre o arquivo completo:**
```bash
cat logs/erros.log
```
Isso tem o stack trace inteiro, IP e corpo da requisição — informação que **nunca** vai pro cliente.

**Fale:** "O usuário do totem recebe só a frase genérica. O stack trace completo, com IP e corpo da requisição, fica registrado aqui no servidor, pra eu poder investigar depois."

---

### ✅ Pilar 3 — Rate Limiting

**Onde no código:** `src/middleware/rateLimiter.js` (janela deslizante por IP) + `config/config.js` (limite: 10 requisições / 60s, bloqueio de 60s).

**Demonstração ao vivo:**
```bash
for i in $(seq 1 12); do curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/status; done
```
Resultado esperado: dez `200` seguidos e depois `429` nas últimas.

**Fale:** "Isso simula alguém apertando o botão sem parar. Depois da décima requisição no mesmo minuto, o IP fica bloqueado por 60 segundos."

---

### ✅ Tríade CID

#### 🔒 Confidencialidade
**Onde:** `src/errors.js` + `src/middleware/errorHandler.js` — a resposta de erro nunca inclui `error.stack`, `error.message` cru nem qualquer segredo/chave.

**Fale, apontando o trecho do `errorHandler.js`:**
> "Aqui no código a resposta pro cliente é sempre montada manualmente com uma mensagem pública — nunca devolvemos `erro.stack` ou `erro.message` direto no JSON. Isso garante que, mesmo se o sistema tivesse alguma chave de API ou segredo, ele nunca vazaria numa resposta de erro."

*(Pode reaproveitar a mesma demonstração do Pilar 2 pra provar isso — a resposta do passo 3 não tem nada além da mensagem genérica.)*

#### ✅ Integridade
**Onde:** `src/routes/estacionamento.js`, rota `POST /api/saida` — o valor a pagar é sempre calculado com `getConfigNumero('valor_' + tipo)`, lendo do banco/config no servidor. **O corpo da requisição de saída só tem `ticket`/`placa` — nunca um valor de preço vindo do cliente.**

**Demonstração ao vivo:** tente mandar um valor forjado e mostre que ele é ignorado:
```bash
curl -X POST http://localhost:3000/api/saida \
  -H "Content-Type: application/json" \
  -d '{"ticket":"T-XXXX", "valor": 0.01}'
```
O `resumo.valor` na resposta continua sendo a tarifa real configurada no servidor (R$ 13,00 ou R$ 10,00) — o `0.01` enviado é simplesmente ignorado pela rota.

**Fale:** "Mesmo que eu tente forçar um valor de R$ 0,01 no corpo da requisição, o backend ignora completamente esse campo — o preço real é sempre recalculado aqui no servidor, nunca confiando no que vem do cliente."

#### 🌐 Disponibilidade
**Onde:** `src/middleware/rateLimiter.js` (evita sobrecarga por excesso de requisições) e o endpoint `GET /api/health` em `src/app.js` (monitoramento do estado do backend/banco).

**Seja honesta aqui** — isso é importante pro professor ver que você entende o limite do que fez:
> "Balanceamento de carga entre múltiplos servidores é uma solução de infraestrutura — nosso projeto roda como uma instância única, então não implementamos um load balancer de verdade. O que implementamos que contribui pra disponibilidade foi: o rate limiting, que evita que o servidor fique sobrecarregado por excesso de requisições, e o endpoint `/api/health`, que permite monitorar se o backend e o banco de dados estão respondendo — a base que, em produção, se ligaria a uma ferramenta de monitoramento."

**Demonstração ao vivo (opcional):**
```bash
curl http://localhost:3000/api/health
```

---

## 5. Encerramento (15s)

> "Resumindo: prevenção de SQL Injection com prepared statements, erros tratados sem vazar informação, rate limiting contra excesso de requisições, e os três pilares da tríade CID — confidencialidade nas respostas de erro, integridade no cálculo do valor no servidor, e disponibilidade com o rate limiter e o health check. Tudo isso documentado, testado automaticamente e versionado em commits."
