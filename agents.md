
# AGENTS.md — Guia de refatoração (Anima Cantus)

Manual para agentes de IA que refatoram código neste repositório. Leia inteiro antes de alterar qualquer arquivo.

**Princípio geral:** priorize soluções simples, funcionais, legíveis e consistentes com o projeto. Aplique boas práticas na medida em que tragam benefícios reais, sem transformar princípios em regras dogmáticas nem sacrificar a clareza em nome de abstrações ou padrões arquiteturais.

---

## 1. Contexto mínimo

Monorepo pnpm com três pacotes:

| Pacote     | Stack                                | Responsabilidade                                                                |
| ---------- | ------------------------------------ | ------------------------------------------------------------------------------- |
| `shared` | TypeScript, Zod                      | Enums, schemas, datas, dinheiro (centavos), WhatsApp. Regras puras.             |
| `api`    | NestJS, Prisma, BullMQ, Redis, MinIO | Regras de negócio, persistência, filas, autorização, e-mail.                |
| `web`    | Next.js 15, React 19, CSS próprio   | Interface do casal e da equipe. Consome a API via `serverApi`/`client-api`. |

Jornada do casal: `CADASTRO → CONTRATO → REPERTORIO → CASAMENTO → POS_EVENTO`. A sequência é controlada pelo **backend**.

Referências: `README`, `docs/decisoes.md`, `schema.prisma`, `transitions.ts`, `infra.module.ts`, `reconcile.service.ts`, `processors.ts`.

---

## 2. Antes de refatorar

1. Inspecione o estado atual do repositório (`git status`, arquivos vizinhos, convenções locais).
2. Preserve alterações preexistentes que não são suas.
3. Defina o objetivo da refatoração em uma frase. Se não conseguir, o escopo está vago demais.
4. Localize os testes que cobrem o trecho. Se não houver, escreva um teste de caracterização **antes** de mudar o código.
5. Não toque na pasta `html/`: são páginas demonstrativas antigas, não o frontend ativo.
6. Priorize `web/`, `api/` e `shared/`.

---

## 3. Diretrizes de refatoração

### 3.1 Paradigma funcional

- Prefira funções puras, imutabilidade, composição e transformações de dados (`map`, `filter`, `reduce`, spread).
- Evite efeitos colaterais desnecessários e estado mutável compartilhado.
- Isole efeitos (banco, fila, e-mail, storage, relógio) nas bordas: serviços, processors e controllers. Regras de decisão ficam em funções puras.
- Receba a data atual como parâmetro em vez de chamar `new Date()` dentro da regra.

```ts
// Antes: regra misturada com efeito e relógio
async sendReminder(coupleId: string) {
  const couple = await this.repo.find(coupleId);
  if (differenceInDays(couple.weddingDate, new Date()) <= 35) {
    await this.mailer.send(couple.email, 'Lembrete');
  }
}

// Depois: decisão pura em `shared`, efeito na borda
export const isInReminderWindow = (weddingDate: Date, today: Date, windowDays: number) =>
  differenceInDays(weddingDate, today) <= windowDays;
```

### 3.2 Simplicidade e legibilidade

- Prefira soluções diretas. Evite condicionais aninhadas, funções longas e fluxos complexos.
- Use retornos antecipados (guard clauses) para manter o fluxo linear.
- Use composição funcional em vez de laços com acumuladores mutáveis.
- Se uma função precisa de comentário para ser entendida, tente primeiro renomear ou dividir.

```ts
// Antes
if (contract) {
  if (contract.status === 'APPROVED') {
    if (!selections.length) { ... }
  }
}

// Depois
if (!contract) return notFound();
if (contract.status !== 'APPROVED') return blocked();
if (selections.length === 0) return empty();
```

### 3.3 Clean Code e Clean Architecture (proporcionais)

- Separe responsabilidades: controller recebe e valida; service orquestra; funções puras decidem; repositório/Prisma persiste.
- Baixo acoplamento, alta coesão: cada módulo NestJS cuida de um assunto (`auth`, `contracts`, `repertoire`, `journey`, etc.).
- A direção das dependências é: regras puras (`shared`) ← serviços ← controllers. Regras de negócio não importam Nest, Prisma, Next nem React.
- **Não crie** camadas, interfaces, ports/adapters, use cases ou factories sem benefício concreto e imediato. O Nest já fornece injeção de dependência; use-a, sem empilhar abstrações sobre ela.
- Um módulo com uma única implementação e nenhum plano real de troca não precisa de interface.

### 3.4 Nomenclatura

- **Todo identificador novo em inglês**: variáveis, funções, classes, interfaces, tipos, enums, constantes, arquivos e pastas.
- Nomes claros, consistentes e semanticamente precisos: `calculateContractTotalInCents`, não `calc` nem `getValor`.
- Funções são verbos (`buildContractSnapshot`); booleanos são perguntas (`isContractApproved`, `hasPendingStep`).
- Mantenha um termo por conceito em todo o código (por exemplo, sempre `couple`, nunca alternar com `pair`).

**Exceção obrigatória — contratos públicos e dados persistidos:** valores já existentes como `CADASTRO`, `CONTRATO`, `REPERTORIO`, `CASAMENTO`, `POS_EVENTO`, nomes de colunas, valores gravados no banco, rotas HTTP e chaves de JSON **não devem ser renomeados** sem migração, versionamento e justificativa explícita. Se necessário, crie um mapeamento na borda em vez de renomear o dado.

Textos exibidos ao usuário (mensagens, e-mails, PDF, labels) continuam em **português brasileiro**.

### 3.5 Comentários

- Escreva **somente em português**, e **somente quando estritamente necessário**.
- Curtos e diretos. Explique o *porquê* não evidente (regra de negócio, restrição externa, decisão), nunca o *o quê*.
- Remova comentários que apenas repetem o código ou que ficaram desatualizados.

```ts
// Ruim
// Soma os valores
const total = sum(items);

// Bom
// Valor em centavos para evitar erro de ponto flutuante
const total = sumCents(items);
```

### 3.6 Tratamento de erros

- Não use exceções como controle de fluxo.
- Valide na entrada (Zod em `shared`, DTO/pipes no Nest) e retorne cedo.
- Quando a falha for esperada pelo domínio (transição inválida, contrato bloqueado, janela vencida), represente-a como **valor explícito** com recursos nativos da linguagem, como união discriminada. Sem bibliotecas de `Result`/`Either`.
- Use `try/catch` apenas quando precisar lidar com uma exceção real (I/O, SMTP, storage, parsing), no ponto adequado, sem engolir o erro. Registre ou propague com contexto.
- Na borda HTTP, convertendo o resultado em resposta, o uso das exceções HTTP do Nest (`NotFoundException`, `ForbiddenException`, etc.) é o padrão do framework e é aceitável. Evite lançá-las em camadas internas puras.

```ts
type TransitionResult =
  | { ok: true; nextState: StepState }
  | { ok: false; reason: 'CONTRACT_NOT_APPROVED' | 'STEP_ALREADY_DONE' };

export const transitionStep = (state: StepState, event: StepEvent): TransitionResult => {
  if (state === 'DONE') return { ok: false, reason: 'STEP_ALREADY_DONE' };
  // ...
  return { ok: true, nextState };
};
```

### 3.7 Abstrações

- Extraia função, módulo ou componente quando isso melhorar clareza, reutilização ou separação de responsabilidades.
- Regra prática: duplicação aparece pela terceira vez, ou a extração dá um nome útil a uma ideia que hoje está escondida.
- Evite fragmentação excessiva: cinco funções de duas linhas que só se chamam em cadeia pioram a leitura.
- Evite indireção: se o leitor precisa abrir quatro arquivos para entender um fluxo, simplifique.
- Em React, extraia componente quando houver responsabilidade clara ou reuso; prefira server components para busca de dados e client components apenas para interação.

### 3.8 Consistência

- Siga os padrões, convenções e ferramentas já adotados (ESLint, formatação, estrutura de módulos Nest, `serverApi`/`client-api`, CSS próprio).
- **Não adicione dependências** (lodash, fp-ts, neverthrow, Tailwind, Redux, etc.) nem novas abordagens arquiteturais sem necessidade justificada por escrito na descrição da mudança.
- Reutilize o que existe em `shared` antes de criar utilitário novo.

### 3.9 Preservação do comportamento

Refatorar é mudar a estrutura sem mudar o comportamento observável. Portanto:

- Mantenha funcionalidades, contratos públicos (rotas, DTOs, schemas, tipos de resposta, eventos de fila) e regras de negócio.
- Se encontrar um bug, **não o corrija no meio da refatoração**. Registre-o separadamente e, se precisar corrigi-lo, faça em mudança própria com justificativa e teste.
- Qualquer mudança de comportamento intencional deve estar explícita e justificada.

### 3.10 Qualidade e testes

- Código previsível, testável e fácil de manter. Funções puras são testadas sem mocks.
- Preserve os testes existentes. Não os enfraqueça nem os apague para a refatoração passar.
- Atualize ou adicione testes quando a estrutura mudar ou quando o trecho refatorado não tiver cobertura.
- Teste comportamento e resultados, não detalhes de implementação.

### 3.11 Escopo e proporcionalidade

- Faça alterações focadas no objetivo declarado.
- Evite reescritas amplas, otimização prematura, renomeações em massa e mudanças não relacionadas.
- Prefira vários passos pequenos e revisáveis a uma mudança grande. Se o diff cresceu além do objetivo, divida.
- Não reformate arquivos inteiros se a mudança é local.

---

## 4. Invariantes do domínio (não quebrar)

Estas regras já estão decididas e protegidas. Uma refatoração não pode alterá-las:

**Dinheiro**

- Valores sempre em **inteiros, em centavos**. Nunca `float`.
- O total é calculado **no servidor**; o cliente não define o valor final.
- Reutilize `shared/src/money.ts`.

**Datas**

- Datas de calendário são armazenadas como datas, para evitar erro de fuso.
- Fuso de agendamento: `America/Sao_Paulo`.
- Reutilize `shared/src/dates.ts` para prazos e janelas (repertório recomendado de 35 a 30 dias antes do casamento).

**Jornada**

- A sequência das etapas e os bloqueios (ex.: repertório só após validação do contrato) são aplicados no **backend** e conferem `transitions.ts`.
- O front exibe o estado, mas não decide a transição.

**Contrato**

- O snapshot do contrato é **imutável** e preserva dados, serviços, valores e condições mesmo que o catálogo mude.
- O PDF é gerado de forma assíncrona (fila `contracts`) e armazenado em MinIO/S3.
- O hash SHA-256 registra integridade, **não** comprova a assinatura. A conferência da assinatura é manual.
- Upload via URL pré-assinada; o worker valida e processa.

**Segurança**

- Senhas com Argon2id; tokens de e-mail como hash, com validade e uso único.
- Sessão em Redis com cookie `httpOnly`; revogável.
- CSRF, verificação de origem e rate limit nas rotas relevantes.
- Autorização e validação **sempre também no servidor**, nunca só no front.

**Validação**

- Schemas Zod ficam em `shared` e são usados por API e front. Não duplique a validação em cada lado.

**Jobs**

- Tentativas e backoff exponencial configurados em `infra.module.ts`.
- Reconciliação diária às 8h, verificação operacional às 18h, execução inicial no start do worker.
- Jobs devem continuar **idempotentes**: reprocessar não deve duplicar e-mail nem estado.

**Canais**

- E-mail é o canal automático. WhatsApp é só link `wa.me`; o envio automático permanece explicitamente recusado.

---

## 5. Onde colocar cada coisa

| Tipo de código                               | Local                                  |
| --------------------------------------------- | -------------------------------------- |
| Regra pura usada por API e front              | `shared/src`                         |
| Schema Zod                                    | `shared/src/schemas.ts`              |
| Orquestração, acesso a banco, filas, e-mail | `api/src/<module>`                   |
| Processamento assíncrono                     | módulo `worker` (`processors.ts`) |
| Busca de dados no servidor (Next)             | `serverApi` em `web/src/lib`       |
| Ações disparadas no navegador               | `client-api` em `web/src/lib`      |
| UI                                            | `web/src`                            |

Se uma regra está duplicada entre `api` e `web`, a candidata natural para consolidação é `shared`, desde que seja pura e não dependa de framework.

---

## 6. Processo recomendado

1. **Entender**: leia o código, os testes e as decisões em `docs/decisoes.md`.
2. **Proteger**: garanta testes cobrindo o comportamento atual.
3. **Refatorar em passos pequenos**, rodando os testes a cada passo.
4. **Validar** com o comando mais específico possível e depois com o conjunto maior:
   - `shared` e `web`: Vitest
   - `api`: Jest
   - lint, typecheck e build dos pacotes afetados
   - Playwright quando a mudança afetar fluxo de tela (o CI atual não o executa)
   - Se mexer em `shared`, faça build antes de testar `api` e `web`.
5. **Revisar o diff**: remova mudanças acidentais, comentários redundantes e código morto introduzido.
6. **Descrever** a mudança: o que mudou, por que, o que **não** mudou e como foi validado.

---

## 7. Checklist antes de entregar

- [ ] O comportamento observável é o mesmo (rotas, DTOs, respostas, eventos, estados).
- [ ] Nenhum valor persistido ou público foi renomeado sem migração.
- [ ] Identificadores novos estão em inglês; textos de usuário continuam em português.
- [ ] Comentários novos estão em português e são realmente necessários.
- [ ] Sem condicionais aninhadas desnecessárias; fluxo linear com retornos antecipados.
- [ ] Regras puras separadas dos efeitos.
- [ ] Erros esperados são valores; `try/catch` só onde há exceção real e sem ocultar falhas.
- [ ] Nenhuma dependência, camada ou padrão novo sem justificativa.
- [ ] Dinheiro em centavos e datas via `shared`.
- [ ] Autorização e validação continuam no servidor.
- [ ] Testes existentes preservados; testes novos onde faltava cobertura.
- [ ] Lint, testes e build dos pacotes afetados passam.
- [ ] O diff é focado e fácil de revisar.

---

## 8. O que evitar

- Reescrever módulos inteiros "porque ficaria mais bonito".
- Introduzir bibliotecas de programação funcional ou de `Result`.
- Criar interfaces, repositórios genéricos, factories e camadas sem necessidade comprovada.
- Mover lógica de negócio do backend para o front.
- Alterar a pasta `html/` achando que é o frontend ativo.
- Corrigir bugs ou adicionar funcionalidades dentro de uma refatoração sem declarar.
- Enfraquecer ou remover testes para fazê-los passar.
- Otimizar desempenho sem medição.
- Silenciar erros com `catch` vazio.
- Misturar formatação em massa com mudança de lógica no mesmo diff.

---

## 9. Em caso de dúvida

Escolha a opção mais simples, mais legível e mais próxima do que o repositório já faz. Se a refatoração exigir mudar comportamento, contrato público ou regra de negócio, **pare, explique o motivo e peça confirmação** antes de seguir.
