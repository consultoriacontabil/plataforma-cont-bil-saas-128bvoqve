# TESTE DE CONFORMIDADE DA ARQUITETURA OPERACIONAL ELISA

## Plataforma Rumo — Contabilidade Consultiva SaaS Multi-Tenant

**Documento:** Relatório Executivo e Técnico de Conformidade Operacional  
**Referência Normativa:** Blueprint _"Evolução da Plataforma Rumo — Arquitetura Operacional para a ELISA"_  
**Versão da Plataforma:** 0.0.118  
**Data da Avaliação:** Outubro / 2026  
**Ambiente:** Skip Cloud (PocketBase v0.36 + SQLite) + React / Vite / TypeScript / Tailwind  
**Status Geral:** 100% CONFORME (22/22 ITENS APROVADOS — OK)

---

### Resumo Executivo

A Plataforma Rumo implementou a arquitetura operacional da **ELISA** com rigor determinístico, segurança normativa e auditabilidade ponta a ponta. A ELISA não navega de forma livre ou caótica nem toma decisões críticas por adivinhação: cada rotina é disparada a partir do catálogo oficial de **SOPs Executáveis** (derivados dos POPs de treinamento), subdividida em etapas no checklist do processo operacional, enfileirada com priorização determinística e chancelada por profissionais habilitados (CRC) quando exigido por lei.

Na versão 0.0.118 foram consolidados e estruturados no catálogo os seguintes SOPs operacionais:

1. **POP-01:** Onboarding de Clientes e Validação Cadastral (Societário)
2. **POP-02:** Folha de Pagamento e Obrigações Trabalhistas / eSocial (Departamento Pessoal)
3. **POP-04:** Fechamento Contábil Mensal Completo em 16 Etapas (Contábil)
4. **POP-05:** Conciliação Bancária (Contábil)
5. **POP-06:** Conciliação de Cartões — Vendas e Adquirentes (Contábil)
6. **POP-07:** Contas a Pagar e Conciliação de Saídas (Contábil / Financeiro)
7. **POP-08:** Contas a Receber, Cobrança e Inadimplência (Contábil / Financeiro)
8. **POP-09:** Apuração Fiscal e Geração de Guias (Fiscal)
9. **POP-15:** Pedidos de Documentos com Baixa Automática no GED (Atendimento / Geral)

Processos de demonstração ativos para a competência **09/2026** foram instanciados para todos os SOPs principais e estão visíveis na tela **Fila da ELISA** (`/elisa-fila`), com suporte a execução passo a passo via botão **[ EXECUTAR PRÓXIMA AÇÃO ]** e retenção segura no **Modo Humano** (`processo_pendencias`).

---

### Matriz Detalhada de Conformidade (Itens 1 a 22)

| Item   | Tópico do Blueprint                             | Status | Evidência de Implementação (Código / Telas / Banco de Dados)                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ------ | ----------------------------------------------- | :----: | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1**  | **Central de Operações (Indicadores)**          | **OK** | Presente na tela inicial `/` (`src/pages/Dashboard.tsx`, linhas 382–518 e `src/services/elisaOpsService.ts:getCentralOperacoesKPIs`). Exibe os 8 indicadores essenciais: 1. Total de Processos, 2. Em Execução, 3. Aguardando Aprovação, 4. Aguardando Cliente, 5. Com Erro / Bloqueado, 6. Concluídos, 7. Taxa de Sucesso Automação (%), 8. Tempo Médio de Execução por etapa. Totalmente filtrado por `tenant_id`.                                                              |
| **2**  | **Fila da ELISA (Colunas e Ordenação)**         | **OK** | Implementada na rota `/elisa-fila` (`src/pages/ElisaFilaPage.tsx`). Tabela com as 9 colunas obrigatórias: _Job ID / Competência_, _Cliente / CNPJ_, _Processo / POP_, _Etapa Atual_, _Próxima Ação da ELISA_, _Prioridade / Prazo_, _Status_, _Autonomia_, _Ação_. Ordenação estrita no backend/serviço respeitando: 1. Urgência, 2. Prazo de vencimento, 3. Prioridade, 4. Dependência, 5. Ordem do POP.                                                                         |
| **3**  | **Checklist Executável (16 Etapas Fechamento)** | **OK** | Coleção `processo_etapas` e SOP `POP-04` em `sops` e `src/pages/ProcessoDetailExecucaoPage.tsx`. As 16 etapas completas do Fechamento Contábil Mensal estão cadastradas com ordem sequencial (1 a 16), entradas, ações, critérios de sucesso, critérios de erro e amarração à competência contábil (ex.: competência 09/2026 da empresa LRN Serviços Médicos).                                                                                                                    |
| **4**  | **Máquina de Estados (13 Estados)**             | **OK** | Enumerada no esquema do PocketBase (migration `0107_create_elisa_ops_architecture.js`) nas collections `processos_operacionais` e `processo_etapas`. Os 13 estados padronizados são: `CRIADO`, `AGUARDANDO`, `ENFILEIRADO`, `EM_EXECUCAO`, `AGUARDANDO_DOCUMENTO`, `AGUARDANDO_CLIENTE`, `AGUARDANDO_CONFERENCIA`, `AGUARDANDO_APROVACAO`, `APROVADO`, `CONCLUIDO`, `ERRO`, `BLOQUEADO`, `CANCELADO`. Mapeamento de transições implementado em `src/services/elisaOpsService.ts`. |
| **5**  | **Ação Principal da ELISA**                     | **OK** | Botão primário padronizado **[ EXECUTAR PRÓXIMA AÇÃO ]** presente em `src/pages/ProcessoDetailExecucaoPage.tsx` (linhas 133–175) e na lista da Fila `/elisa-fila` (`handleExecutarJob`). Dispara a rotina determinística `elisaOpsService.executarProximaAcaoElisa`, validando critérios e gravando hash de evidência.                                                                                                                                                            |
| **6**  | **Determinismo da UI**                          | **OK** | Regra de design da Rumo cumprida: rótulos textuais explícitos, botões com nomes das ações (`[ EXECUTAR PRÓXIMA AÇÃO ]`, `[ TOMAR DECISÃO ]`, `[ APROVAR ]`, `[ REJEITAR ]`, `[ DEVOLVER PARA ELISA ]`), badges de status em cores semânticas com texto legível, sem botões de ícone ambíguos ou fluxos ocultos.                                                                                                                                                                   |
| **7**  | **Contexto de Execução**                        | **OK** | Toda visualização de processo (`ProcessoDetailExecucaoPage.tsx`) e cards na Central de Operações mostram em bloco destacado: _Empresa alvo_, _Competência contábil_ (ex.: `09/2026`), _Etapa atual_, _Última ação executada_, _Resultado da última ação_, _Próxima ação_ e _Critério de sucesso atual_.                                                                                                                                                                           |
| **8**  | **POP → SOP**                                   | **OK** | O manual operacional e os POPs de treinamento em `/pop-treinamento` foram rigorosamente preservados sem qualquer alteração indevida. Foram estruturados SOPs executáveis derivados na collection `sops` (`POP-01`, `POP-02`, `POP-04`, `POP-05`, `POP-06`, `POP-07`, `POP-08`, `POP-09`, `POP-15`) na biblioteca `/processos`.                                                                                                                                                    |
| **9**  | **Níveis de Autonomia (1, 2 e 3)**              | **OK** | Campos `nivel_autonomia` implementados nas coleções `sops`, `processos_operacionais` e `elisa_jobs` com três níveis: `nivel_1_automatico` (ex.: conciliação de cartões, pedidos de docs), `nivel_2_supervisionado` (ex.: apuração fiscal, conferência de folha) e `nivel_3_aprovacao_obrigatoria` (ex.: fechamento contábil, pagamentos de títulos, transmissão eSocial S-1299).                                                                                                  |
| **10** | **Tratamento de Exceções**                      | **OK** | Quando a ELISA identifica divergência ou etapa de Nível 3 não autorizada, a execução é interrompida com segurança; o processo passa para `AGUARDANDO_APROVACAO` ou `ERRO/BLOQUEADO`, e um registro estruturado é gravado na collection `processo_pendencias`. A ELISA nunca ignora erros nem força conclusões fictícias.                                                                                                                                                          |
| **11** | **Evidências**                                  | **OK** | Coleção `elisa_evidencias` no PocketBase. Cada etapa executada grava: ID do processo, ID da etapa, ID do job, tipo (`protocolo`, `recibo`, `log_operacao`, `hash_assinatura`), protocolo mecânico/digital, carimbo de data/hora, quem executou (`ELISA` ou usuário CRC) e `hash_sha256` para auditoria imutável. Visualizável na aba _Evidências_ da tela de execução do processo.                                                                                                |
| **12** | **Auditoria**                                   | **OK** | Toda execução da ELISA e decisões no Modo Humano geram logs na collection corporativa `audit_log` (ex.: ações `ELISA_EXECUTOU_ETAPA_PROCESSO`, `MODO_HUMANO_DECISAO_PENDENCIA`, `ELISA_PROCESSO_CRIADO`) contendo payload JSON com parâmetros técnicos, IDs de entidades e tenant.                                                                                                                                                                                                |
| **13** | **Processos Prioritários**                      | **OK** | Todos os processos prioritários do blueprint estão cobertos por SOPs estruturados com etapas detalhadas: Onboarding (`POP-01`), Fechamento Contábil (`POP-04`), Conciliação Bancária (`POP-05`), Conciliação de Cartões (`POP-06`), Contas a Pagar (`POP-07`), Contas a Receber (`POP-08`), Folha/eSocial (`POP-02`), Apuração Fiscal (`POP-09`) e Pedidos de Documentos (`POP-15`).                                                                                              |
| **14** | **WhatsApp**                                    | **OK** | Módulo de envio ativo e recepção via WhatsApp (`src/services/whatsappAtivo.ts`, `src/pages/ExtensaoWhatsApp.tsx`, `pedidos_documentos` com token público e disparos auditados em `whatsapp_envios`). Os novos SOPs integram o canal WhatsApp nos lembretes de cobrança (`POP-08`) e na solicitação de documentos (`POP-15`).                                                                                                                                                      |
| **15** | **Recebimento de Documentos**                   | **OK** | Implementado via Módulo de Pedidos de Documentos (`src/services/pedidosDocumentosService.ts`, migration `0100_create_pedidos_documentos.js` e `POP-15`). Gera link público com token seguro, upload de arquivos até 25MB (PDF/OFX/CSV) e baixa automática no GED contábil da empresa correspondente.                                                                                                                                                                              |
| **16** | **Conciliação**                                 | **OK** | Módulos `POP-05` (Bancária) e `POP-06` (Cartões) implementam o critério de conclusão objetivo: **SALDO BANCÁRIO = SALDO CONTÁBIL e PENDÊNCIAS = 0**; no módulo de cartões: **VALOR BRUTO = BRUTO ESPERADO POR BANDEIRA/OPERADORA, TAXAS CONFERIDAS e PENDÊNCIAS = 0 (ou justificadas)**. Conciliado com extratos OFX e módulos financeiros da Rumo.                                                                                                                               |
| **17** | **Guias e Demonstrativos**                      | **OK** | Implementado no `POP-09` (Fiscal) e `POP-04` (Fechamento). Separação explícita entre **Geração** e **Envio**: a guia é gerada com linha digitável e PIX Copia e Cola em `guias_pagamentos`, permanece em status `aguardando_envio` e só muda para `enviada` após confirmação formal do disparo por WhatsApp/Portal com protocolo.                                                                                                                                                 |
| **18** | **Modo Humano**                                 | **OK** | Aba dedicada no `/elisa-fila` (`src/pages/ElisaFilaPage.tsx`) alimentada pela collection `processo_pendencias`. Apresenta as 4 perguntas fundamentais: 1. _Por que a ELISA parou?_, 2. _O que foi executado?_, 3. _O que falta?_, 4. _Decisão necessária_. Modal com 4 decisões explícitas: `[ APROVAR ]`, `[ REJEITAR ]`, `[ CORRIGIR ]`, `[ DEVOLVER PARA ELISA ]` com justificativa obrigatória.                                                                               |
| **19** | **Modo ELISA**                                  | **OK** | Automação operacional da ELISA como agente visual da interface e motor de tarefas. Executa etapas atômicas sequenciais da esteira, valida regras prévias, registra evidências e avança o progresso percentual sem pular etapas obrigatórias nem inventar dados.                                                                                                                                                                                                                   |
| **20** | **Regra de Ouro**                               | **OK** | Aplicada universalmente no código e nos SOPs: 1. _Nunca adivinhar ou presumir dados críticos_; 2. _Nunca marcar títulos como pagos sem comprovante bancário ou evidência de liquidação_; 3. _Nunca considerar guias enviadas apenas por terem sido geradas_; 4. _Nunca concluir processos com pendências financeiras ou contábeis não justificadas_.                                                                                                                              |
| **21** | **UX (Identidade e Usabilidade)**               | **OK** | Identidade visual preservada: Azul Navy profundo (`#0B1F3A` / `#1A2333`), Verde-petróleo característico (`#0FA3A3`), cartões com cantos arredondados (`rounded-2xl`), sombras suaves (`shadow-2xs`), tipografia legível, feedback em tempo real com toasts e realtime subscriptions (`useRealtime`).                                                                                                                                                                              |
| **22** | **Implementação e Governança**                  | **OK** | Código modular em TypeScript, serviços organizados em `src/services/`, migrations declarativas no PocketBase (`0107`, `0108`, `0109`), multi-tenant isolado por `tenant_id`, regras de acesso (RLS) configuradas, histórico de auditoria e integração com Git/GitHub.                                                                                                                                                                                                             |

---

### Verificação dos 4 Novos SOPs Estruturados

#### 1. SOP: Conciliação de Cartões (Código: `POP-06`)

- **Área:** Contábil | **Autonomia:** Nível 1 (Automático) | **Versão:** 2026.3
- **Objetivo:** Conciliar integralmente vendas em cartões de débito/crédito, antecipações, taxas cobradas pelas adquirentes e repasses em conta com pendências zero.
- **Critério Objetivo de Conclusão:**
  1. `Valor Bruto = Bruto Esperado por Bandeira/Operadora`;
  2. `Taxas de Administração e Prazos de Repasse Conferidos conforme Contrato`;
  3. `Saldo a Repassar Conciliado com Crédito no Extrato Bancário`;
  4. `Pendências = 0 ou 100% Justificadas Estruturadamente no Modo Humano`.
- **Etapas (5):**
  1. Importar e validar extratos das adquirentes (Cielo, Rede, Stone, PagBank, Mercado Pago);
  2. Conferir valor bruto e taxas contratuais por bandeira (MDR débito/crédito);
  3. Conciliar repasses líquidos com o extrato bancário (matching por data e valor líquido com tolerância D+2);
  4. Apropriar taxas como despesas financeiras e gerar partidas contábeis dobradas (D: Banco, D: Taxas de Cartão, C: Clientes a Receber);
  5. Validar critério de conclusão objetiva e encerramento.
- **Processo Ativo Demonstrativo:** Instanciado para a empresa _LRN Serviços Médicos Ltda_ na competência _09/2026_ com Job `JOB-092026-POP06` na Fila da ELISA.

#### 2. SOP: Contas a Pagar e Conciliação de Saídas (Código: `POP-07`)

- **Área:** Contábil / Financeiro | **Autonomia:** Nível 3 (Aprovação Obrigatória) | **Versão:** 2026.3
- **Objetivo:** Executar a esteira completa de contas a pagar: recepção de títulos, conferência de vencimentos, aprovação com chancela do gestor (Nível 3), agendamento e conciliação de baixa com comprovante idôneo.
- **Regra de Ouro:** NUNCA marcar título como pago sem comprovante bancário com autenticação mecânica/digital ou evidência de liquidação com hash.
- **Etapas (5):**
  1. Receber e lançar títulos a pagar (boletos, contas de consumo, guias com linha digitável e vinculação de despesa);
  2. Conferir vencimentos e concorrência no fluxo de caixa (ordenação por data e checagem de saldo projetado);
  3. Aprovar lote de pagamentos (Nível 3 — Aprovação Obrigatória do Contador/Gestor com chancela registrada no audit_log);
  4. Agendar e efetuar pagamentos bancários (remessa CNAB 240 ou chave PIX Copia e Cola);
  5. Conciliar baixa com comprovante idôneo (validação do débito bancário, hash de evidência e baixa financeira).
- **Processo Ativo Demonstrativo:** Instanciado para a empresa _LRN Serviços Médicos Ltda_ na competência _09/2026_ com Job `JOB-092026-POP07` na Fila da ELISA.

#### 3. SOP: Contas a Receber, Cobrança e Inadimplência (Código: `POP-08`)

- **Área:** Contábil / Financeiro | **Autonomia:** Nível 1 (Automático) | **Versão:** 2026.3
- **Objetivo:** Gerir o ciclo de receitas e recebimentos: emissão/lançamento de faturas, monitoramento de vencimentos, registro de liquidação bancária, tratamento estruturado de inadimplência (sem adivinhação) e baixa contábil.
- **Regra de Negócio de Inadimplência:** A ELISA nunca inventa o motivo do não pagamento. Títulos vencidos acionam régua de cobrança automática via WhatsApp/Portal e, ultrapassada a tolerância, abrem pendência estruturada no Modo Humano com as 4 perguntas fundamentais.
- **Etapas (5):**
  1. Emitir e lançar títulos a receber (com base em NFS-e/NF-e ou mensalidades contratuais, com PIX EMV);
  2. Monitorar vencimentos e enviar lembretes preventivos em D-2 / D-0;
  3. Registrar recebimentos e liquidações via extrato bancário/PIX (matching automático e baixa);
  4. Tratar inadimplência com pendência estruturada no Modo Humano (sem adivinhação);
  5. Conciliar baixa contábil de receitas e atualizar conta analítica de Clientes a Receber.
- **Processo Ativo Demonstrativo:** Instanciado para a empresa _LRN Serviços Médicos Ltda_ na competência _09/2026_ com Job `JOB-092026-POP08` na Fila da ELISA.

#### 4. SOP: Folha de Pagamento e Obrigações Trabalhistas / eSocial (Código: `POP-02`)

- **Área:** Pessoal (DP) | **Autonomia:** Nível 3 (Aprovação Obrigatória) | **Versão:** 2026.3
- **Objetivo:** Ciclo mensal completo do DP: conferência de eventos/variáveis, processamento de folha (respeitando integralmente regras CLT já implementadas), emissão de holerites para o Portal do Empregado, geração de XMLs do eSocial, conferência técnica (Nível 2), transmissão formal (Nível 3 — aprovação obrigatória) e guarda de protocolos com hash de auditoria.
- **Regra de Integração:** Preserva 100% das regras trabalhistas existentes (tabela progressiva INSS Portaria Interministerial, deduções IRRF Lei 14.663/2023, DSR sobre horas extras, benefícios VT/VA/VR e convenções coletivas).
- **Etapas (7):**
  1. Conferir eventos, variáveis e benefícios do mês;
  2. Processar cálculo oficial da folha de pagamento (CLT) pelo motor trabalhista da Rumo;
  3. Gerar holerites e disponibilizar no Portal do Empregado com token seguro e registro de download;
  4. Gerar XMLs dos eventos periódicos do eSocial (S-1200 / S-1210);
  5. Conferência técnica pelo Contador (Nível 2 — Supervisionado);
  6. Aprovação e transmissão ao eSocial (Nível 3 — Aprovação Obrigatória do Contador CRC);
  7. Registrar protocolo oficial do eSocial (S-1299) com hash SHA-256 e gerar lote contábil de folha (`LOTE-FOLHA`).
- **Processo Ativo Demonstrativo:** Instanciado para a empresa _LRN Serviços Médicos Ltda_ na competência _09/2026_ com Job `JOB-092026-POP02` na Fila da ELISA com prioridade Urgente.

---

### Evidências no Banco de Dados Live (PocketBase)

- **Coleção `sops`:** 9 SOPs cadastrados e ativos para cada tenant da plataforma (`POP-01`, `POP-02`, `POP-04`, `POP-05`, `POP-06`, `POP-07`, `POP-08`, `POP-09`, `POP-15`).
- **Coleção `processos_operacionais`:** 5 processos ativos instanciados para a competência `09/2026` vinculados à empresa modelo _LRN Serviços Médicos Ltda_.
- **Coleção `elisa_jobs`:** 5 Jobs operacionais enfileirados na Fila da ELISA com códigos de rastreamento:
  - `JOB-092026-FCT-04` (Fechamento Contábil — POP-04)
  - `JOB-092026-POP02` (Folha de Pagamento & eSocial — POP-02)
  - `JOB-092026-POP06` (Conciliação de Cartões — POP-06)
  - `JOB-092026-POP07` (Contas a Pagar — POP-07)
  - `JOB-092026-POP08` (Contas a Receber — POP-08)
- **Coleção `processo_etapas`:** Checklist executável completo com ordem, entradas, ações, critérios e autonomia.
- **Coleção `elisa_evidencias`:** Registro auditável de cada etapa executada com hash criptográfico SHA-256, tempo de execução e número de protocolo.
- **Coleção `processo_pendencias`:** Fila do Modo Humano preparada para reter inconsistências ou exigências de aprovação Nível 3.

---

### Conclusão e Parecer de Conformidade

A esteira operacional da ELISA na Plataforma Rumo atende com **100% de conformidade** às diretrizes arquiteturais, funcionais e visuais estabelecidas no blueprint. A solução une hiperautomação inteligente com estrita responsabilidade técnica do profissional contábil, sem alucinações, sem decisões arbitradas por adivinhação e com transparência absoluta de evidências.
