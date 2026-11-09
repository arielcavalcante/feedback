# ino — feedback da equipe

O **ino** é a plataforma interna de feedback e 1:1 da Praia Sertão. Toda semana, cada pessoa avalia a coordenação, a equipe e o próprio trabalho. A coordenação vê o resultado do grupo sem saber quem respondeu o quê. Quem quiser conversar sobre uma avaliação pode assinar com o próprio nome, e as conversas viram anotações que ficam salvas pros dois. Também tem um botão de reclamar, aberto o tempo todo.

O nome vem de Ino, que virou Leucoteia na Odisseia: a deusa que dá a Odisseu o véu que o protege na travessia, sem atravessar por ele. A história está em [`/sobre`](https://ino.praiasertao.com.br/sobre).

Produção: **https://ino.praiasertao.com.br**

## Sumário

- [Como funciona](#como-funciona)
- [Perfis e o que cada um vê](#perfis-e-o-que-cada-um-vê)
- [Privacidade e anonimato](#privacidade-e-anonimato)
- [Arquitetura](#arquitetura)
- [Rodando localmente](#rodando-localmente)
- [Modo dev com dados fictícios](#modo-dev-com-dados-fictícios)
- [Testes e verificação](#testes-e-verificação)
- [Deploy](#deploy)
- [Operação](#operação)
- [Documentação](#documentação)

## Como funciona

### Avaliação da semana

- Cada semana é um **ciclo**, aberto de **segunda 00h a domingo 23h59** (horário de Fortaleza). A pessoa responde quando quiser dentro da semana, uma vez por ciclo.
- São três notas de 1 a 5 — **coordenação**, **equipe** e **trabalho** — e um comentário opcional.
- O resultado da semana sai na **segunda às 9h**, e só se pelo menos **3 pessoas** tiverem respondido anonimamente. Abaixo disso, fica guardado.
- Quem entra numa equipe no meio da semana já participa do ciclo daquela semana.
- O histórico do funcionário mostra só se ele **respondeu** ou **não respondeu** em cada semana.

### Avaliação assinada e conversas

- Na avaliação tem a chave **"Assinar com meu nome"**. Assinada, ela aparece pra coordenação com nome, notas e comentário, pra vocês conversarem sobre ela.
- Dá pra assinar ao enviar ou depois, **enquanto a semana estiver aberta**. Assinou, não dá pra desfazer.
- Avaliação assinada **não entra** na média anônima do grupo.
- Durante uma conversa, a coordenação abre a pessoa em **Conversas com o time**, vê as avaliações que ela assinou e registra o que combinaram: como cada um pode trabalhar em cima daquilo. Dá pra registrar conversa com qualquer pessoa do time, com ou sem avaliação assinada.
- As anotações aparecem pro funcionário em **Pontos de atenção**, junto das avaliações que ele assinou.

### Reclamar

- O botão **Reclamar** fica disponível o tempo todo, lado a lado com **Bora responder**. Ele é secundário enquanto a avaliação da semana está pendente e vira o principal quando ela já foi feita.
- A pessoa escolhe um ou mais de 10 temas — máquina e equipamento, software e ferramentas, colegas, condições de trabalho, infraestrutura, fim do home office, processos e burocracia, demandas e prazos, comunicação e outros — e escreve sem limite.
- Não existe tema de liderança: sobre a coordenação, o caminho é a avaliação da semana.
- Cada reclamação pode ser **assinada** (a coordenação vê na hora, com nome) ou **anônima** (chega na segunda, referente à semana anterior, só se pelo menos 3 pessoas diferentes reclamaram anonimamente naquela equipe). Dá pra mandar várias por semana, umas assinadas e outras não.

### Administração

- Não existe cadastro público. A administração convida as pessoas por e-mail, define os **perfis** de cada uma (admin, coordenação, colaborador — dá pra ter mais de um) e a **equipe**.
- Cada equipe tem uma coordenação. Quem não está numa equipe com coordenação fica fora dos ciclos.
- Desativar uma pessoa derruba as sessões dela na hora e mantém o histórico.

### Primeiro acesso

- O convite chega por e-mail com um link de uso único. A pessoa cria a senha (mínimo de 15 caracteres; uma frase funciona bem) e entra.
- Quem é colaborador vê uma introdução curta na primeira vez: quem é a coordenação, como funcionam as notas e o histórico.

## Perfis e o que cada um vê

Uma pessoa pode ter vários perfis. A tela inicial mostra as seções de cada um, nesta ordem: colaborador, coordenação, admin.

| | Colaborador | Coordenação | Admin |
|---|---|---|---|
| Responder a avaliação da semana | ✓ | | |
| Reclamar (assinado ou anônimo) | ✓ | | |
| Ver o próprio histórico (respondeu / não respondeu) | ✓ | | |
| Ver as próprias avaliações **assinadas** e os pontos de atenção | ✓ | | |
| Resultado anônimo do time (médias e comentários, com mínimo de 3) | | ✓ | |
| Avaliações assinadas e reclamações assinadas do time | | ✓ | |
| Reclamações anônimas da semana anterior (com mínimo de 3 pessoas) | | ✓ | |
| Registrar e editar anotações de conversa | | ✓ | |
| Convidar, editar e desativar pessoas; montar equipes | | | ✓ |
| Ver respostas ou reclamações | | | ✗ nunca |

## Privacidade e anonimato

O anonimato é a promessa central do produto. As regras completas estão em [`docs/PRIVACY.md`](docs/PRIVACY.md). Em resumo:

- O **Worker é a fronteira de autorização**: toda rota confere sessão, perfil e escopo de equipe. Esconder na interface nunca basta.
- A coordenação nunca recebe autoria, horário exato nem ordem de envio de nada anônimo.
- Resultados e reclamações anônimas só aparecem com **pelo menos 3 pessoas**. Abaixo disso, a resposta não traz nem a contagem.
- Durante a semana, a coordenação vê só **se o mínimo já foi atingido**, nunca quantas pessoas responderam (ADR-023).
- Assinar é sempre escolha da pessoa, item a item. O que é assinado sai do cálculo anônimo, e a avaliação só pode ser assinada até a semana fechar. Assim ninguém consegue deduzir a resposta dos outros por subtração.
- Respostas anônimas **nunca são mostradas de volta**, nem pra quem respondeu. Isso evita pressão do tipo "me mostra o que tu respondeu".
- A administração gerencia pessoas e equipes e não tem nenhuma tela de respostas.
- O sistema guarda a autoria em sigilo (pra contar o mínimo, evitar duplicidade e lidar com abuso), mas os logs e o registro de auditoria não ligam ninguém a uma reclamação anônima.

## Arquitetura

- **Front-end:** React 19 + TypeScript + Vite, servido como assets estáticos do Worker.
- **API:** Cloudflare Worker (`worker/`), que também é a fronteira de autorização e privacidade.
- **Banco:** Cloudflare D1 (SQLite), schema em Drizzle (`worker/db/schema.ts`) e migrações em `drizzle/`.
- **Agendamento:** Cron Trigger a cada 15 min. A lógica em `worker/scheduler/` cria os ciclos semanais a partir da âncora guardada no banco, abre e fecha os ciclos e inclui os participantes.
- **E-mail:** Resend, com template próprio compatível com Outlook (imagens embutidas por CID).
- **Autenticação:** convite por e-mail com token opaco de uso único, senha com PBKDF2-HMAC-SHA256 + pepper e sessões em cookie `HttpOnly`/`Secure` com token guardado só como hash.
- **Idioma:** português do Brasil por padrão, com o catálogo em inglês mantido em `shared/localization.ts` (`?lang=en` pra revisar).
- **Visual:** identidade do portfólio (`ariel-portfolio-react`): Clash Grotesk, papel/tinta/azul/laranja/dourado, menu fixo e botões em pílula.

```
src/            interface (App.tsx, views/, components/, dev/ = modo dev)
worker/         API, autenticação, regras de privacidade, scheduler, e-mail
  domain/       regras puras e testadas (agenda, privacidade da coordenação, reclamações)
shared/         textos/traduções e temas de reclamação usados pelos dois lados
drizzle/        migrações do D1
docs/           decisões (ADRs), privacidade, setup, modelo de dados
public/         fontes, ícones e imagens do e-mail
```

## Rodando localmente

Requisitos: Node 22, pnpm 11 e uma conta Cloudflare com acesso ao Worker/D1 `feedback`.

```sh
pnpm install
cp .dev.vars.example .dev.vars        # segredos locais (não vão pro git)
pnpm db:migrate:local
pnpm admin:bootstrap -- voce@praiasertao.com.br "Seu Nome"   # cria o primeiro admin local e imprime o link de convite
pnpm dev
```

Em ambiente local, o e-mail não é enviado: o link do convite aparece na própria tela de admin.

## Modo dev com dados fictícios

```sh
pnpm dev:mock
```

Roda só o React, sem Worker, D1 nem `.dev.vars`, com uma API falsa (`src/dev/`) que segue os mesmos formatos e regras da real. Uma barra preta no topo deixa navegar como **Admin**, **Coordenador**, **Funcionário** ou **Deslogado**, marcar se a avaliação da semana está pendente, escolher o cenário da coordenação (resultado pronto, ciclo aberto com ou sem o mínimo, aguardando segunda, sem mínimo, sem ciclos, sem equipe) e rever a introdução. Qualquer e-mail e senha entram.

`pnpm build:mock` gera uma versão estática em `dist-mock/` pra compartilhar uma prévia. O build de produção nunca inclui esse código: o `scripts/assert-safe-build.mjs` falha se incluir.

## Testes e verificação

```sh
pnpm check     # typecheck + testes + checagem das migrações + build seguro
```

- Os testes de domínio cobrem a agenda semanal, o mínimo de 3 (n-1, n, n+1), reclamações e assinatura.
- `worker/integration.test.ts` roda a API inteira contra as migrações reais usando o SQLite do Node no lugar do D1: convites, perfis, equipes, ciclos, avaliações assinadas, conversas e reclamações, incluindo quem não pode ver o quê.
- `shared/localization.test.ts` garante que todo texto da interface tem tradução.

## Deploy

```sh
git push origin dev
pnpm check
pnpm run deploy               # build seguro + wrangler deploy ("pnpm deploy", sem o run, é outro comando do pnpm)
pnpm run db:migrate:remote    # depois do deploy, quando houver migração nova
```

- O domínio, o banco D1 e o cron já estão no `wrangler.jsonc`.
- Segredos de produção (no Cloudflare, nunca no git): `AUTH_PEPPER` e `RESEND_API_KEY`.
- Publique o código antes de rodar migrações que mudam a agenda, pra o scheduler já no ar não criar ciclos com a regra antiga.
- Confira com `curl https://ino.praiasertao.com.br/api/health`.

## Operação

- **Primeiro admin em produção:** `pnpm admin:bootstrap -- email "Nome" --remote` (ver `docs/SETUP.md`).
- **Consultar o banco:** `pnpm exec wrangler d1 execute feedback --remote --command "SELECT ..."`. Faça um `wrangler d1 export` antes de qualquer alteração manual. Mudanças de pessoas e equipes devem ser feitas pela tela de admin, que já revoga sessões e registra auditoria.
- **Feriados:** tabela `holidays`. Precisa ser revisada a cada ano.
- **E-mail:** os envios aparecem no painel do Resend. O domínio de envio é `mail.praiasertao.com.br`.

### Pendências conhecidas

- MFA (TOTP) pros admins, que é pré-requisito do piloto segundo `docs/SETUP.md`.
- E-mails de lembrete da avaliação e de aviso de resultado pronto.
- Revisão jurídica de privacidade e retenção de dados antes de ampliar o uso.

## Documentação

- [Decisões de arquitetura (ADRs)](docs/DECISIONS.md)
- [Privacidade e anonimato](docs/PRIVACY.md)
- [Setup e decisões operacionais](docs/SETUP.md)
- [Modelo de dados](docs/DATA_MODEL.md)
- [Roadmap](ROADMAP.md)
- [Regras para agentes de código](AGENTS.md)
