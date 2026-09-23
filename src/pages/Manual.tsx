import React, { useState, useMemo } from 'react'
import {
  BookOpen,
  Users,
  Building2,
  FileText,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  ChevronRight,
  Search,
  Key,
  BadgeAlert,
  ArrowRight,
  Copy,
  Check,
  FileCheck,
  Compass,
  Sparkles,
  HelpCircle,
  TrendingUp,
  Receipt,
  Layers,
  Settings,
  Briefcase,
  Lock,
  Workflow,
  ArrowDownToLine,
  ArrowUpFromLine,
  FileSpreadsheet,
  PieChart,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import { Link } from 'react-router-dom'

interface SectionStep {
  numero: number
  titulo: string
  ondeClicar: string
  acao: string
  detalhe?: string
}

interface SectionItem {
  id: string
  categoria:
    | 'fundamentos'
    | 'empresas'
    | 'operacional'
    | 'fiscal_contabil'
    | 'integracoes'
    | 'gestao'
  titulo: string
  icone: React.ElementType
  subtitulo: string
  permissaoMinima: 'Administrador' | 'Contador' | 'Auxiliar' | 'Cliente'
  tipoExecucao: 'Nativo da Plataforma' | 'Requer Credencial Externa / Modo Supervisão' | 'Híbrido'
  passos: SectionStep[]
  requisitos?: string[]
  dicaPratica?: string
  alertaSupervisao?: string
  linkRota?: string
}

const MANUAL_SECTIONS: SectionItem[] = [
  {
    id: 'usuarios-perfis',
    categoria: 'fundamentos',
    titulo: '1. Autenticação e Convite de Usuários/Perfis',
    icone: Users,
    subtitulo: 'Como adicionar membros, gerenciar permissões e convidar clientes ou contadores',
    permissaoMinima: 'Administrador',
    tipoExecucao: 'Nativo da Plataforma',
    linkRota: '/usuarios',
    requisitos: [
      'Perfil Administrador logado no escritório',
      'E-mail válido do novo membro para envio do convite',
    ],
    passos: [
      {
        numero: 1,
        titulo: 'Acessar Central de Usuários',
        ondeClicar: 'Menu lateral esquerdo > Gestão & Integrações > "Usuários & Perfis"',
        acao: 'Visualize a lista de membros atuais do escritório contábil e a aba de perfis e acessos.',
      },
      {
        numero: 2,
        titulo: 'Abrir Modal de Convite',
        ondeClicar: 'Botão azul "+ Convidar Usuário" no canto superior direito',
        acao: 'Preencha o Nome Completo, E-mail profissional e defina o Perfil de Acesso.',
      },
      {
        numero: 3,
        titulo: 'Selecionar o Perfil Apropriado',
        ondeClicar: 'Campo suspenso "Perfil"',
        acao: 'Escolha conforme a hierarquia de controle: Administrador (gestão total, convites e exclusões), Contador (operações técnicas, apurações e fechamentos), Auxiliar (lançamentos operacionais e anexação de documentos) ou Cliente (acesso restrito ao Portal do Cliente).',
      },
      {
        numero: 4,
        titulo: 'Disparo e Ativação do Convite',
        ondeClicar: 'Botão "Enviar Convite"',
        acao: 'O usuário recebe o e-mail de ativação e fica com status "convite pendente" na listagem até seu primeiro acesso.',
      },
    ],
    dicaPratica:
      'Administradores podem alterar o perfil de qualquer usuário a qualquer momento no menu de ações (três pontos) > "Editar perfil".',
  },
  {
    id: 'cadastro-empresas',
    categoria: 'empresas',
    titulo: '2. Cadastro de Empresas & Exclusão com Backup 24h',
    icone: Building2,
    subtitulo:
      'Cadastro manual ou via CNPJ público, consulta assistida e exclusão segura com retenção temporária',
    permissaoMinima: 'Contador',
    tipoExecucao: 'Nativo da Plataforma',
    linkRota: '/empresas',
    requisitos: [
      'CNPJ válido ou dados cadastrais completos da empresa',
      'Vínculo com o tenant (escritório) selecionado',
    ],
    passos: [
      {
        numero: 1,
        titulo: 'Iniciar Cadastro de Empresa',
        ondeClicar: 'Menu lateral > Empresas > Botão "+ Nova Empresa"',
        acao: 'Abre o formulário de cadastro estruturado por abas (Identificação, Regime Tributário, Endereço, Sócios/QSA e CNAEs).',
      },
      {
        numero: 2,
        titulo: 'Preenchimento Automático via CNPJ Público',
        ondeClicar: 'Campo CNPJ > Botão "Buscar CNPJ na Receita Federal / BrasilAPI"',
        acao: 'O sistema preenche automaticamente Razão Social, Nome Fantasia, Endereço, CNAE Principal e Secundários, Natureza Jurídica e Sócios do QSA.',
      },
      {
        numero: 3,
        titulo: 'Salvar Ficha da Empresa',
        ondeClicar: 'Botão inferior "Salvar Empresa"',
        acao: 'A empresa é indexada na carteira ativa e sincronizada em tempo real com todos os módulos da plataforma.',
      },
      {
        numero: 4,
        titulo: 'Exclusão Segura com Retenção de 24h',
        ondeClicar: 'Ficha da empresa > Ações > "Excluir (backup 24h)"',
        acao: 'O sistema congela e compacta todos os registros vinculados (guias, colaboradores, lançamentos) em JSON na coleção de backups por 24 horas antes da purga definitiva. A empresa pode ser restaurada na aba "Exclusões & Backups".',
      },
    ],
    dicaPratica:
      'Durante o período de 24 horas, o backup retido protege contra exclusões acidentais. Um cronjob automático executa a purga após o prazo.',
  },
  {
    id: 'abertura-empresa',
    categoria: 'empresas',
    titulo: '3. Abertura de Empresa (Workflow, Link Público & 3 Passos)',
    icone: Workflow,
    subtitulo:
      'Aba de Abertura na empresa, link público para o cliente, checklist com aprovação e os 3 passos legais',
    permissaoMinima: 'Contador',
    tipoExecucao: 'Nativo da Plataforma',
    linkRota: '/empresas?tab=abertura',
    requisitos: [
      'Empresa em fase de constituição ou novo workflow de abertura cadastrado',
      'Documentos básicos dos sócios (RG/CNH, comprovante de endereço)',
    ],
    passos: [
      {
        numero: 1,
        titulo: 'Acessar Central de Abertura',
        ondeClicar:
          'Menu lateral > Empresas > Sub-aba "Abertura de Empresa" (ou aba Abertura dentro da Ficha da Empresa)',
        acao: 'Visualize o painel com pipeline de etapas (Viabilidade, Coletor, Junta, Inscrições e Conclusão), base legal citada e checklist documental.',
      },
      {
        numero: 2,
        titulo: 'Gerar Link Público para o Cliente',
        ondeClicar: 'Card do workflow > Botão "Gerar Link Público" / "Compartilhar com Cliente"',
        acao: 'O sistema gera uma URL única com token criptográfico seguro (rota pública `/abertura/:token`). O cliente pode preencher dados e fazer upload dos documentos pelo celular ou navegador sem precisar de login prévio.',
      },
      {
        numero: 3,
        titulo: 'Auditar Checklist Documental com Aprovação/Recusa',
        ondeClicar: 'Aba do Workflow > Checklist de Documentos',
        acao: 'Cada documento enviado pelo cliente pode ser visualizado e ter seu status alterado para "Aprovado" ou "Recusado" (com justificativa obrigatória enviada ao cliente).',
      },
      {
        numero: 4,
        titulo: 'Validar os 3 Passos Regulatórios',
        ondeClicar: 'Seção "Checklist dos 3 Passos Regulatórios"',
        acao: 'Marque o cumprimento das 3 etapas legais: PASSO 1 VIABILIDADE (pesquisa de viabilidade locacional e nome empresarial na Junta), PASSO 2 COLETOR NACIONAL (DBE / REDESIM perante a Receita Federal) e PASSO 3 JUNTA COMERCIAL (FCN, protocolo, taxas DARE/DARF e assinatura digital dos sócios).',
      },
      {
        numero: 5,
        titulo: 'Finalizar Abertura & Importar Empresa',
        ondeClicar: 'Botão "Concluir Abertura e Importar Empresa"',
        acao: 'Abre o modal de finalização que migra os dados validados diretamente para as Empresas Cadastradas ativas da carteira contábil.',
      },
    ],
    dicaPratica:
      'O link público pode ser revogado ou regenerado a qualquer instante pelo contador através do modal "Gerar Link Público".',
  },
  {
    id: 'migracoes-onboarding',
    categoria: 'empresas',
    titulo: '4. Migrações & Onboarding (Entrada e Saída)',
    icone: Layers,
    subtitulo:
      'Acolhimento de novos clientes de outro contador ou handover organizado de saída com data de corte e badges',
    permissaoMinima: 'Contador',
    tipoExecucao: 'Nativo da Plataforma',
    linkRota: '/empresas?tab=migracoes',
    requisitos: [
      'Empresa cadastrada no escritório',
      'Definição da data de corte e primeira competência de responsabilidade',
    ],
    passos: [
      {
        numero: 1,
        titulo: 'Abrir Painel de Migrações',
        ondeClicar: 'Menu lateral > Empresas > Aba "Migrações & Onboarding"',
        acao: 'Visualize contadores de Entradas em Andamento, Saídas em Handover e Concluídas.',
      },
      {
        numero: 2,
        titulo: 'Iniciar Processo de Migração',
        ondeClicar: 'Botão "+ Migração Entrada" ou "+ Migração Saída"',
        acao: 'Selecione a empresa alvo, defina a Data de Corte, o nome/contato do outro contador e a Primeira Competência sob sua responsabilidade técnica.',
      },
      {
        numero: 3,
        titulo: 'Acompanhar Checklist e Badges de Status',
        ondeClicar: 'Lista de processos > Selecione o card do processo',
        acao: 'Os processos exibem badges visuais de direção (Entrada / Saída) e status (Iniciado, Em Andamento, Bloqueado, Concluído). Complete o checklist operacional específico (termo de transferência, plano de contas anterior, extratos e certidões).',
      },
    ],
    dicaPratica:
      'Nas migrações de saída, o sistema preserva histórico completo de documentos e termo de responsabilidade de entrega assinado.',
  },
  {
    id: 'ged-documentos',
    categoria: 'operacional',
    titulo: '5. Gestão Eletrônica de Documentos (GED) e Uploads',
    icone: FileText,
    subtitulo:
      'Repositório central de arquivos, organização por empresa, competência e tipo com busca indexada',
    permissaoMinima: 'Auxiliar',
    tipoExecucao: 'Nativo da Plataforma',
    linkRota: '/documentos',
    requisitos: [
      'Arquivos em PDF, XML, DOCX, XLSX, PNG ou JPEG',
      'Empresa selecionada para vinculação do arquivo',
    ],
    passos: [
      {
        numero: 1,
        titulo: 'Acessar Central GED',
        ondeClicar: 'Menu lateral > Módulos Operacionais > "Documentos (GED)"',
        acao: 'Visualize a lista de arquivos com filtros por empresa, tipo (nota_fiscal, guia, contrato, extrato, comprovante) e status de processamento.',
      },
      {
        numero: 2,
        titulo: 'Fazer Upload de Novo Arquivo',
        ondeClicar: 'Botão "+ Enviar Documento" ou arraste os arquivos para a zona de upload',
        acao: 'Selecione a empresa vinculada, categoria do documento e adicione observações explicativas.',
      },
      {
        numero: 3,
        titulo: 'Visualização e Download Seguro',
        ondeClicar: 'Linha do documento > Ícone de visualização / download',
        acao: 'O arquivo é servido diretamente pelo armazenamento seguro do backend Skip Cloud/PocketBase com verificação de autenticação.',
      },
    ],
    dicaPratica:
      'Documentos gerados automaticamente por outros módulos (como guias DAS e comprovantes de eSocial) são arquivados no GED sem intervenção manual.',
  },
  {
    id: 'workflow-solicitacoes',
    categoria: 'operacional',
    titulo: '6. Workflow de Solicitações & Kanban',
    icone: CheckCircle2,
    subtitulo:
      'Gestão de chamados e demandas contábeis entre cliente e escritório em quadro Kanban interativo',
    permissaoMinima: 'Auxiliar',
    tipoExecucao: 'Nativo da Plataforma',
    linkRota: '/workflow',
    requisitos: [
      'Empresa cliente cadastrada',
      'Usuário interno ou cliente logado para criação de solicitações',
    ],
    passos: [
      {
        numero: 1,
        titulo: 'Abrir Quadro Kanban',
        ondeClicar: 'Menu lateral > Módulos Operacionais > "Workflow / Demandas"',
        acao: 'Visualize as colunas de status: Pendente, Em Andamento, Aguardando Cliente e Concluído.',
      },
      {
        numero: 2,
        titulo: 'Criar Nova Solicitação',
        ondeClicar: 'Botão "+ Nova Solicitação"',
        acao: 'Defina o título, empresa, prioridade (Baixa, Média, Alta, Urgente), prazo limite e anexe documentos explicativos.',
      },
      {
        numero: 3,
        titulo: 'Movimentação e Interação com Cliente',
        ondeClicar: 'Arraste os cards entre colunas ou clique no card para ver o histórico',
        acao: 'Comentários e anexos ficam visíveis para o cliente no Portal do Cliente, criando um canal auditado sem perda de contexto.',
      },
    ],
    dicaPratica:
      'Solicitações com prazo próximo acionam badges de alerta no Dashboard e notificações no sininho da barra superior.',
  },
  {
    id: 'fiscal-ecac',
    categoria: 'fiscal_contabil',
    titulo: '7. Fiscal, Guias & Busca de Recolhimentos no e-CAC',
    icone: Receipt,
    subtitulo:
      'Apuração tributária, emissão de guias DAS/DARF e baixa assistida de recolhimentos via e-CAC em Modo Supervisão',
    permissaoMinima: 'Contador',
    tipoExecucao: 'Requer Credencial Externa / Modo Supervisão',
    linkRota: '/obrigacoes',
    alertaSupervisao:
      'A busca automática direta no e-CAC via mTLS depende de credenciais e-CAC / canal seguro do governo. Sem certificado A1 ativo e canal configurado, opera em Modo Supervisão com Baixa Assistida informando recibo/autenticação.',
    requisitos: [
      'Empresa com regime Simples Nacional ou Lucro Presumido configurado',
      'Acesso ao portal e-CAC da Receita Federal ou código de arrecadação',
    ],
    passos: [
      {
        numero: 1,
        titulo: 'Acessar Calendário e Painel Fiscal',
        ondeClicar: 'Menu lateral > Fiscal & Tributário > "Obrigações Fiscais"',
        acao: 'Visualize o calendário com DAS, DCTFWeb, EFD, SPED, guias geradas e status de pagamento.',
      },
      {
        numero: 2,
        titulo: 'Abrir Busca e-CAC / Baixa Assistida',
        ondeClicar: 'Botão "Buscar Recolhimentos no e-CAC" no topo da página',
        acao: 'Abre o modal assistido que consulta guias em aberto ou permite a conferência de comprovantes de pagamento.',
      },
      {
        numero: 3,
        titulo: 'Executar Baixa Assistida em Modo Supervisão',
        ondeClicar: 'Linha da guia pendente > Botão "Baixar Assistido"',
        acao: 'Informe a Data de Pagamento, Valor Efetivamente Pago, Código de Autenticação/Recibo e selecione a Origem ("Manual Supervisão Contábil" ou "Conector RFB / e-CAC Assistido"). O sistema registra na auditoria a baixa assistida com transparência.',
      },
      {
        numero: 4,
        titulo: 'Painel de Regularidade Fiscal & CNDs',
        ondeClicar: 'Ficha da empresa > Aba "Regularidade & CND / E-CAC"',
        acao: 'Acompanhe o termômetro de saúde fiscal, validade de CNDs e mensagens da Caixa Postal DTE da Receita Federal.',
      },
    ],
    dicaPratica:
      'Ao realizar a baixa assistida, o título financeiro correspondente e a obrigação do calendário são marcados como quitados simultaneamente.',
  },
  {
    id: 'certificado-digital',
    categoria: 'fiscal_contabil',
    titulo: '8. Certificado Digital A1 & Vinculação Automática',
    icone: Key,
    subtitulo:
      'Upload de arquivo .pfx/.p12, validação de senha, cálculo de validade e propagação instantânea para todos os módulos',
    permissaoMinima: 'Contador',
    tipoExecucao: 'Nativo da Plataforma',
    linkRota: '/empresas',
    requisitos: [
      'Arquivo de certificado digital e-CNPJ modelo A1 (.pfx ou .p12)',
      'Senha de proteção do arquivo do certificado',
    ],
    passos: [
      {
        numero: 1,
        titulo: 'Acessar a Seção de Certificado na Empresa',
        ondeClicar: 'Empresas > Selecione a empresa > Aba "Certificado Digital"',
        acao: 'Veja o status atual (Válido, Expirado ou Sem Certificado) e o botão de cadastro.',
      },
      {
        numero: 2,
        titulo: 'Cadastrar / Substituir Certificado A1',
        ondeClicar: 'Botão "+ Cadastrar Certificado" ou "Atualizar / Substituir Certificado"',
        acao: 'Abre o modal seguro. Faça o upload do arquivo .pfx, informe a Senha do Certificado, Titular e Data de Validade.',
      },
      {
        numero: 3,
        titulo: 'Propagação Automática via Backend Hook',
        ondeClicar: 'Botão "Salvar Certificado"',
        acao: 'O backend executa automaticamente o hook `vincular_certificado_empresa.js`, conectando o certificado A1 aos módulos satélites: Conector RFB / e-CAC DTE, Busca Automática NF-e SEFAZ DFe, e-Social gov.br e EFD-Reinf / DCTFWeb.',
      },
    ],
    dicaPratica:
      'Quando o certificado estiver a menos de 30 dias do vencimento, a plataforma emite alerta preventivo de renovação no Dashboard e no sininho.',
  },
  {
    id: 'departamento-pessoal',
    categoria: 'fiscal_contabil',
    titulo: '9. Departamento Pessoal (Folha, Férias, Rescisões & e-Social)',
    icone: Briefcase,
    subtitulo:
      'Cálculo CLT de INSS progressivo, IRRF com dedução, férias, 13º salário, rescisões e geração de eventos do e-Social',
    permissaoMinima: 'Contador',
    tipoExecucao: 'Híbrido',
    linkRota: '/departamento-pessoal',
    alertaSupervisao:
      'Os eventos periódicos (S-1200 remuneração, S-1210 pagamento, S-1299 fechamento) são gerados em conformidade com o layout oficial do e-Social. Sem credencial de transmissão direta gov.br configurada, operam em Modo Supervisão assistido gerando recibo e protocolo rastreáveis.',
    requisitos: [
      'Empresa com colaboradores CLT cadastrados',
      'Configuração de verbas e convenções coletivas (quando houver)',
    ],
    passos: [
      {
        numero: 1,
        titulo: 'Cadastrar Colaborador',
        ondeClicar: 'Depto. Pessoal > Aba "Colaboradores" > "+ Novo Colaborador"',
        acao: 'Preencha CPF, Salário Base, Cargo, Data de Admissão, Dependentes de IRRF e Matrícula eSocial.',
      },
      {
        numero: 2,
        titulo: 'Processar Folha Mensal',
        ondeClicar: 'Depto. Pessoal > Aba "Folha Mensal" > "Calcular Folha da Competência"',
        acao: 'O motor CLT aplica as tabelas oficiais progressivas de INSS, calcula a base líquida de IRRF e apura o FGTS de 8%, gerando o título a pagar no Financeiro.',
      },
      {
        numero: 3,
        titulo: 'Férias, 13º Salário e Rescisões',
        ondeClicar: 'Depto. Pessoal > Abas "Férias & 13º" e "Rescisões"',
        acao: 'Simule e homologue períodos aquisitivos, cálculo de 1/3 constitucional, abono pecuniário, aviso prévio indenizado/trabalhado e multas rescisórias.',
      },
      {
        numero: 4,
        titulo: 'Painel e-Social',
        ondeClicar: 'Depto. Pessoal > Aba "Painel e-Social"',
        acao: 'Monitore os eventos periódicos e não-periódicos com validação estrutural do schema oficial.',
      },
    ],
    dicaPratica:
      'A folha de pagamento gera automaticamente o provisionamento contábil e a integração de DARF Previdenciário em Impostos Retidos.',
  },
  {
    id: 'contabil-fechamento',
    categoria: 'fiscal_contabil',
    titulo: '10. Módulo Contábil (Partidas Dobradas, Fechamento & DRE/Balanço)',
    icone: BookOpen,
    subtitulo:
      'Lançamentos estritamente equilibrados (D=C), trava de competência fechada e demonstrações chanceladas pelo CRC',
    permissaoMinima: 'Contador',
    tipoExecucao: 'Nativo da Plataforma',
    linkRota: '/contabil/lancamentos',
    requisitos: [
      'Plano de contas ativo configurado para o escritório',
      'Contas bancárias vinculadas às contas do razão contábil',
    ],
    passos: [
      {
        numero: 1,
        titulo: 'Efetuar Lançamentos em Partidas Dobradas',
        ondeClicar: 'Menu lateral > Contábil > "Lançamentos"',
        acao: 'Cadastre débitos e créditos com conta débito, conta crédito (contrapartida), valor idêntico e histórico padronizado. O sistema valida rigorosamente Débitos = Créditos.',
      },
      {
        numero: 2,
        titulo: 'Revisar Pré-Lançamentos e Balancete',
        ondeClicar: 'Menu lateral > Contábil > "Pré-Lançamento" e "Balancete"',
        acao: 'Confira pendências oriundas do financeiro antes da efetivação e confira se a soma do Ativo iguala Passivo + PL no Balancete de Verificação.',
      },
      {
        numero: 3,
        titulo: 'Executar Fecho Mensal com Trava de Segurança',
        ondeClicar: 'Menu lateral > Contábil > "Fecho Mensal"',
        acao: 'Percorra o checklist de 7 etapas auditadas (conciliação, folha, obrigações, lançamentos, depreciação, balancete e GED). Ao travar a competência como "fechada", o hook `validate_lancamento_competencia_fechada.js` impede qualquer alteração retroativa.',
      },
      {
        numero: 4,
        titulo: 'Emitir DRE e Balanço com Chancela CRC',
        ondeClicar: 'Menu lateral > Contábil > "DRE & Balanço" (/relatorios-contabeis)',
        acao: 'Gere a Demonstração do Resultado do Exercício e o Balanço Patrimonial com cálculo de hash SHA-256, token de verificação público e chancela do responsável técnico CRC.',
      },
    ],
    dicaPratica:
      'Qualquer pessoa pode validar a autenticidade de um demonstrativo assinado acessando a página pública `/verificar-assinatura` e colando o hash ou token.',
  },
  {
    id: 'integracoes-supervisao',
    categoria: 'integracoes',
    titulo: '11. Integrações & o Conceito de Modo Supervisão',
    icone: Compass,
    subtitulo:
      'Como funciona a integração com NFS-e, WhatsApp, e-Social e Reinf/DCTFWeb com transparência absoluta',
    permissaoMinima: 'Contador',
    tipoExecucao: 'Requer Credencial Externa / Modo Supervisão',
    linkRota: '/integracoes',
    alertaSupervisao:
      'O "Modo Supervisão" é a garantia de honestidade técnica da plataforma Rumo: nenhum falso sucesso é exibido ao usuário. Sem credenciais de API contratadas (como API oficial Meta para WhatsApp ou certificados de webservices municipais), o sistema audita, gera o XML/payload correto e registra a supervisão assistida.',
    requisitos: [
      'Para Modo Supervisão: funciona imediatamente com certificados e validações internas da plataforma',
      'Para Modo Produção Real Direto: requer chaves de API externas (ex: Meta Cloud API, webservice prefeitura municipal)',
    ],
    passos: [
      {
        numero: 1,
        titulo: 'Entender a Badge de Modo Supervisão',
        ondeClicar: 'Abas dos módulos integrados (NFS-e, WhatsApp, RFB, e-Social)',
        acao: 'Identifique o badge amarelo/azul "Modo Supervisão (Transparente)". Isso indica que a lógica de negócios, validações de regras e auditoria operam com 100% de integridade, simulando o retorno oficial ou aguardando credencial de canal contratada.',
      },
      {
        numero: 2,
        titulo: 'Configurar NFS-e & Provedores Municipais',
        ondeClicar: 'Menu lateral > Fiscal & Tributário > "NFS-e WhatsApp" > Aba "Configurações"',
        acao: 'Selecione o provedor tributário do município (Padrão Nacional Gov.br, Betha Sistemas, Ginfes ou Próprio). Em Modo Supervisão, notas fiscais podem ser simuladas gerando espelho financeiro e DANFSe.',
      },
      {
        numero: 3,
        titulo: 'Sair do Modo Supervisão para Transmissão Real',
        ondeClicar: 'Aba de Configuração do respectivo conector',
        acao: 'Insira o Certificado Digital A1 ativo com senha válida, URL do webservice municipal e token de API. O conector chaveará o status de "modo_supervisao" para "conectado".',
      },
    ],
    dicaPratica:
      'O Modo Supervisão permite testar ponta a ponta todas as regras fiscais de um cliente antes de colocar a integração em produção real.',
  },
  {
    id: 'dashboard-contadores',
    categoria: 'gestao',
    titulo: '12. Dashboard: Monitor de CNDs & Contadores Clicáveis',
    icone: TrendingUp,
    subtitulo:
      'Como interpretar os 5 pilares de certidões, obrigações do mês, pendências e atalhos rápidos',
    permissaoMinima: 'Auxiliar',
    tipoExecucao: 'Nativo da Plataforma',
    linkRota: '/dashboard',
    requisitos: ['Empresas ativas cadastradas no escritório'],
    passos: [
      {
        numero: 1,
        titulo: 'Monitor de CNDs nos 5 Pilares',
        ondeClicar: 'Dashboard > Painel Superior "Monitor de CNDs da Carteira"',
        acao: 'Acompanhe as 5 certidões essenciais: Federal (RFB/PGFN), Estadual (SEFAZ), Municipal (Tributos Mobiliários), FGTS/CRF (Caixa Econômica) e Trabalhista (CNDT / TST). As barras e badges mostram status Válida (verde), Próxima do Vencimento (amarelo) ou Vencida (vermelho).',
      },
      {
        numero: 2,
        titulo: 'Interpretar Contadores Clicáveis do Dashboard',
        ondeClicar: 'Cards de métricas no topo do Dashboard',
        acao: 'Clique em qualquer card (Total Empresas, Obrigações Pendentes, Solicitações Abertas, Faturamento Mensal) para ser direcionado imediatamente à tela filtrada correspondente.',
      },
      {
        numero: 3,
        titulo: 'Gerar Ação de Regularização Fiscal',
        ondeClicar: 'Monitor de CNDs > Linha da empresa com pendência > "Regularizar"',
        acao: 'Cria uma tarefa de regularização automática no Workflow de solicitações com todo o descritivo da certidão pendente pré-preenchido.',
      },
    ],
    dicaPratica:
      'Use a busca rápida da barra superior (Ctrl+K ou campo de pesquisa) para encontrar qualquer empresa ou documento em segundos sem sair do Dashboard.',
  },
  {
    id: 'auditoria-seguranca',
    categoria: 'gestao',
    titulo: '13. Auditoria de Operações e Trilha de Conformidade',
    icone: ShieldCheck,
    subtitulo:
      'Logs imutáveis de todas as inclusões, alterações e exclusões de registros na plataforma',
    permissaoMinima: 'Administrador',
    tipoExecucao: 'Nativo da Plataforma',
    linkRota: '/auditoria',
    requisitos: ['Perfil Administrador ou Contador com acesso de supervisão'],
    passos: [
      {
        numero: 1,
        titulo: 'Acessar a Trilha de Auditoria',
        ondeClicar: 'Menu lateral > Gestão & Integrações > "Auditoria"',
        acao: 'Visualize a lista cronológica decrescente de todos os eventos com carimbo de data/hora UTC, autor, entidade afetada e descrição da ação.',
      },
      {
        numero: 2,
        titulo: 'Filtrar por Entidade ou Período',
        ondeClicar: 'Campos de filtro no topo da listagem',
        acao: 'Filtre por tipo de entidade (empresas, lancamentos_contabeis, documentos, etc.) para investigar alterações específicas ou conferir exclusões realizadas.',
      },
      {
        numero: 3,
        titulo: 'Exportar Relatório de Conformidade',
        ondeClicar: 'Botão "Exportar Relatório" / Visualização de Detalhes',
        acao: 'Consulte o payload JSON completo para fins de compliance perante órgãos fiscalizadores ou auditorias externas.',
      },
    ],
    dicaPratica:
      'Hooks automáticos no backend Skip Cloud disparam registros imediatos na coleção `audit_log` mesmo em operações executadas via rotinas programadas.',
  },
  {
    id: 'configuracoes-logo-dispositivo',
    categoria: 'gestao',
    titulo: '14. Configurações: Identidade Visual & Limpar Dados do Dispositivo',
    icone: Settings,
    subtitulo:
      'Personalização do logotipo do escritório contábil e rotina para esvaziar cache local do navegador',
    permissaoMinima: 'Auxiliar',
    tipoExecucao: 'Nativo da Plataforma',
    linkRota: '/perfil',
    requisitos: ['Acesso à página de Perfil / Configurações da Conta'],
    passos: [
      {
        numero: 1,
        titulo: 'Acessar Minha Conta / Perfil',
        ondeClicar: 'Avatar no canto superior direito > "Minha Conta" ou menu lateral "Perfil"',
        acao: 'Visualize informações do usuário, escritório ativo, dados cadastrais e opções do sistema.',
      },
      {
        numero: 2,
        titulo: 'Identidade Visual & Logotipo',
        ondeClicar: 'Seção "Identidade Visual do Escritório" / Avatar',
        acao: 'Faça upload da imagem do logotipo do escritório. A marca é aplicada automaticamente no cabeçalho do sistema, relatórios de demonstrativos e no Portal do Cliente.',
      },
      {
        numero: 3,
        titulo: 'Limpar Dados do Dispositivo (Cache Local)',
        ondeClicar: 'Card "Dados Locais e Armazenamento" > Botão "Limpar dados deste dispositivo"',
        acao: 'Limpa com segurança chaves temporárias do localStorage e sessionStorage sem afetar o banco de dados na nuvem, útil para resolver lentidão ou alternar estações de trabalho compartilhadas.',
      },
    ],
    dicaPratica:
      'A limpeza de dados locais não exclui nenhum dado no servidor Skip Cloud; após o processo, basta efetuar login novamente.',
  },
]

export default function ManualPage() {
  const [activeSectionId, setActiveSectionId] = useState<string>('usuarios-perfis')
  const [searchFilter, setSearchFilter] = useState<string>('')
  const [selectedCategoria, setSelectedCategoria] = useState<string>('todas')
  const [copiedId, setCopiedId] = useState<string | null>(null)

  // Filtragem de seções
  const filteredSections = useMemo(() => {
    return MANUAL_SECTIONS.filter((sec) => {
      const matchCategoria = selectedCategoria === 'todas' || sec.categoria === selectedCategoria
      const matchSearch =
        searchFilter.trim() === '' ||
        sec.titulo.toLowerCase().includes(searchFilter.toLowerCase()) ||
        sec.subtitulo.toLowerCase().includes(searchFilter.toLowerCase()) ||
        sec.passos.some(
          (p) =>
            p.titulo.toLowerCase().includes(searchFilter.toLowerCase()) ||
            p.acao.toLowerCase().includes(searchFilter.toLowerCase()) ||
            p.ondeClicar.toLowerCase().includes(searchFilter.toLowerCase()),
        )
      return matchCategoria && matchSearch
    })
  }, [searchFilter, selectedCategoria])

  // Seção atualmente selecionada
  const activeSection = useMemo(() => {
    const found = MANUAL_SECTIONS.find((s) => s.id === activeSectionId)
    if (found) return found
    return filteredSections[0] || MANUAL_SECTIONS[0]
  }, [activeSectionId, filteredSections])

  const handleCopyLink = (secId: string) => {
    const url = `${window.location.origin}/manual#${secId}`
    navigator.clipboard?.writeText(url)
    setCopiedId(secId)
    setTimeout(() => setCopiedId(null), 2000)
  }

  return (
    <div className="space-y-6">
      {/* Cabeçalho da Página */}
      <div className="flex flex-col gap-3 rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#0FA3A3]/10 text-[#0FA3A3]">
              <BookOpen className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-[#1A2333]">
                  Manual de Ativação & Uso das Funções
                </h1>
                <Badge className="bg-[#0FA3A3] text-white text-[10px] font-bold uppercase tracking-wide">
                  OFICIAL
                </Badge>
              </div>
              <p className="text-xs text-[#64748B] mt-0.5">
                Guia passo a passo prático para começar a usar cada módulo da Plataforma Contábil
                Rumo.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="font-medium text-[#64748B]">Versão:</span>
            <span className="font-mono font-semibold text-[#1A2333] bg-slate-100 px-2 py-0.5 rounded-md">
              v0.0.51 (Rumo Cloud)
            </span>
          </div>
        </div>

        {/* NOTA LEGAL OBRIGATÓRIA */}
        <Alert className="border-amber-200 bg-amber-50/70 text-amber-900 mt-2 rounded-xl">
          <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
          <AlertTitle className="text-xs font-bold uppercase tracking-wide text-amber-800">
            Aviso de Conformidade Regulatória & Modo Supervisão
          </AlertTitle>
          <AlertDescription className="text-[11px] text-amber-800/90 leading-relaxed mt-1">
            A plataforma <strong>Rumo Consultoria Contábil</strong> é uma ferramenta de automação,
            gestão e cálculo.
            <strong>
              {' '}
              Ela NÃO substitui parecer jurídico ou decisão contábil técnica de profissional
              habilitado (CRC/CFC).
            </strong>{' '}
            Módulos sinalizados em <strong>Modo Supervisão</strong> executam validações de
            integridade e regras de negócio em ambiente assistido e exigem credenciais reais
            (certificados A1 e chaves governamentais) para transmissão direta aos webservices dos
            órgãos públicos (Receita Federal, e-Social e prefeituras).
          </AlertDescription>
        </Alert>
      </div>

      {/* Barra de Filtro e Busca */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
          <Input
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            placeholder="Buscar por módulo, onde clicar ou palavra-chave..."
            className="h-10 pl-9 pr-4 text-xs rounded-xl border-[#E2E8F0] bg-white focus:border-[#0FA3A3]"
          />
        </div>

        <Tabs
          value={selectedCategoria}
          onValueChange={setSelectedCategoria}
          className="w-auto overflow-x-auto"
        >
          <TabsList className="bg-white border border-[#E2E8F0] p-1 rounded-xl h-10">
            <TabsTrigger value="todas" className="rounded-lg text-xs font-medium">
              Todas ({MANUAL_SECTIONS.length})
            </TabsTrigger>
            <TabsTrigger value="fundamentos" className="rounded-lg text-xs font-medium">
              Fundamentos
            </TabsTrigger>
            <TabsTrigger value="empresas" className="rounded-lg text-xs font-medium">
              Empresas
            </TabsTrigger>
            <TabsTrigger value="operacional" className="rounded-lg text-xs font-medium">
              Operacional
            </TabsTrigger>
            <TabsTrigger value="fiscal_contabil" className="rounded-lg text-xs font-medium">
              Fiscal & Contábil
            </TabsTrigger>
            <TabsTrigger value="integracoes" className="rounded-lg text-xs font-medium">
              Integrações
            </TabsTrigger>
            <TabsTrigger value="gestao" className="rounded-lg text-xs font-medium">
              Gestão
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Grid Principal: Índice Lateral (Esquerda) + Conteúdo Detalhado (Direita) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Índice Lateral Navegável (4 colunas) */}
        <div className="lg:col-span-4 space-y-2 lg:sticky lg:top-24">
          <div className="rounded-2xl border border-[#E2E8F0] bg-white p-3 shadow-xs">
            <div className="flex items-center justify-between px-3 py-2 border-b border-[#E2E8F0] mb-2">
              <span className="text-xs font-bold text-[#1A2333] uppercase tracking-wider">
                Índice de Funções
              </span>
              <span className="text-[11px] font-semibold text-[#0FA3A3]">
                {filteredSections.length} tópicos
              </span>
            </div>

            <div className="max-h-[640px] overflow-y-auto space-y-1 pr-1">
              {filteredSections.map((sec) => {
                const Icon = sec.icone
                const isSelected = sec.id === activeSection.id

                return (
                  <button
                    key={sec.id}
                    onClick={() => setActiveSectionId(sec.id)}
                    className={`w-full flex items-start gap-3 p-2.5 rounded-xl text-left transition-all text-xs ${
                      isSelected
                        ? 'bg-[#123B6D] text-white font-semibold shadow-xs'
                        : 'text-[#64748B] hover:bg-slate-50 hover:text-[#1A2333]'
                    }`}
                  >
                    <Icon
                      className={`h-4 w-4 shrink-0 mt-0.5 ${
                        isSelected ? 'text-[#0FA3A3]' : 'text-[#94A3B8]'
                      }`}
                    />
                    <div className="flex-1 min-w-0">
                      <p className={`truncate ${isSelected ? 'text-white' : 'text-[#1A2333]'}`}>
                        {sec.titulo}
                      </p>
                      <span
                        className={`text-[10px] block truncate mt-0.5 ${
                          isSelected ? 'text-slate-200' : 'text-[#94A3B8]'
                        }`}
                      >
                        {sec.tipoExecucao}
                      </span>
                    </div>
                    {isSelected && (
                      <ChevronRight className="h-4 w-4 text-[#0FA3A3] shrink-0 mt-0.5" />
                    )}
                  </button>
                )
              })}

              {filteredSections.length === 0 && (
                <div className="p-4 text-center text-xs text-[#94A3B8]">
                  Nenhuma função encontrada para o filtro atual.
                </div>
              )}
            </div>
          </div>

          {/* Card Rápido de Atalho: Rumo Agent */}
          <div className="rounded-2xl border border-teal-200 bg-teal-50/70 p-4">
            <div className="flex items-center gap-2 text-teal-900 font-bold text-xs">
              <Sparkles className="h-4 w-4 text-[#0FA3A3]" />
              <span>Dúvida durante a operação?</span>
            </div>
            <p className="text-[11px] text-teal-800 mt-1 leading-relaxed">
              Você pode perguntar a qualquer momento para o <strong>Rumo Agent (IA)</strong> no menu
              lateral para receber orientações guiadas sobre telas e rotinas contábeis.
            </p>
            <Link
              to="/rumo-agent"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-[#0FA3A3] hover:underline mt-2"
            >
              <span>Abrir Rumo Agent</span>
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </div>

        {/* Conteúdo Detalhado da Função Selecionada (8 colunas) */}
        <div className="lg:col-span-8 space-y-6">
          <Card className="rounded-2xl border-[#E2E8F0] shadow-xs">
            <CardHeader className="pb-4">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge
                      variant="outline"
                      className="border-[#0FA3A3]/40 bg-teal-50 text-[#0FA3A3] font-semibold text-[10px]"
                    >
                      {activeSection.categoria.toUpperCase()}
                    </Badge>
                    <Badge
                      className={`text-[10px] font-semibold ${
                        activeSection.permissaoMinima === 'Administrador'
                          ? 'bg-[#0B1F3A] text-white'
                          : activeSection.permissaoMinima === 'Contador'
                            ? 'bg-[#123B6D] text-white'
                            : 'bg-slate-200 text-[#1A2333]'
                      }`}
                    >
                      Permissão: {activeSection.permissaoMinima}+
                    </Badge>
                    <Badge
                      className={`text-[10px] font-semibold ${
                        activeSection.tipoExecucao === 'Nativo da Plataforma'
                          ? 'bg-emerald-100 text-emerald-800'
                          : activeSection.tipoExecucao === 'Híbrido'
                            ? 'bg-sky-100 text-sky-800'
                            : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {activeSection.tipoExecucao}
                    </Badge>
                  </div>
                  <CardTitle className="text-lg md:text-xl font-bold text-[#1A2333]">
                    {activeSection.titulo}
                  </CardTitle>
                  <CardDescription className="text-xs text-[#64748B]">
                    {activeSection.subtitulo}
                  </CardDescription>
                </div>

                <div className="flex items-center gap-2 self-start">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleCopyLink(activeSection.id)}
                    className="h-8 rounded-xl border-[#E2E8F0] text-xs gap-1.5"
                    title="Copiar link desta seção"
                  >
                    {copiedId === activeSection.id ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-emerald-600" />
                        <span className="text-emerald-600">Copiado</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5 text-[#64748B]" />
                        <span>Copiar link</span>
                      </>
                    )}
                  </Button>

                  {activeSection.linkRota && (
                    <Button
                      size="sm"
                      asChild
                      className="h-8 rounded-xl bg-[#0FA3A3] hover:bg-[#0C8585] text-white text-xs gap-1.5 shadow-xs"
                    >
                      <Link to={activeSection.linkRota}>
                        <span>Ir para tela</span>
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Link>
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>

            <Separator />

            <CardContent className="pt-6 space-y-6">
              {/* Alerta de Modo Supervisão se aplicável */}
              {activeSection.alertaSupervisao && (
                <Alert className="border-amber-200 bg-amber-50/70 text-amber-900 rounded-xl">
                  <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                  <AlertTitle className="text-xs font-bold text-amber-800">
                    Aviso Técnico de Modo Supervisão
                  </AlertTitle>
                  <AlertDescription className="text-xs text-amber-800/90 leading-relaxed mt-0.5">
                    {activeSection.alertaSupervisao}
                  </AlertDescription>
                </Alert>
              )}

              {/* Pré-requisitos */}
              {activeSection.requisitos && activeSection.requisitos.length > 0 && (
                <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 space-y-2">
                  <span className="text-xs font-bold text-[#1A2333] uppercase tracking-wide flex items-center gap-1.5">
                    <Key className="h-3.5 w-3.5 text-[#0FA3A3]" />
                    O que é necessário antes de começar
                  </span>
                  <ul className="space-y-1 text-xs text-[#64748B]">
                    {activeSection.requisitos.map((req, rIdx) => (
                      <li key={rIdx} className="flex items-center gap-2">
                        <span className="h-1.5 w-1.5 rounded-full bg-[#0FA3A3]" />
                        <span>{req}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Passos Práticos Numerados */}
              <div className="space-y-4">
                <span className="text-xs font-bold text-[#1A2333] uppercase tracking-wide block">
                  Passo a Passo de Ativação e Execução
                </span>

                <div className="space-y-3">
                  {activeSection.passos.map((passo) => (
                    <div
                      key={passo.numero}
                      className="flex items-start gap-3 rounded-xl border border-[#E2E8F0] bg-white p-4 transition-all hover:border-[#0FA3A3]/50 shadow-xs"
                    >
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#0FA3A3] text-white text-xs font-bold shadow-xs">
                        {passo.numero}
                      </div>

                      <div className="flex-1 space-y-1.5 min-w-0">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                          <p className="font-bold text-sm text-[#1A2333]">{passo.titulo}</p>
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#0FA3A3] bg-teal-50 px-2 py-0.5 rounded-md border border-teal-100">
                            <Compass className="h-3 w-3" />
                            {passo.ondeClicar}
                          </span>
                        </div>

                        <p className="text-xs text-[#64748B] leading-relaxed">{passo.acao}</p>

                        {passo.detalhe && (
                          <p className="text-[11px] text-[#94A3B8] italic">Nota: {passo.detalhe}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Dica Prática */}
              {activeSection.dicaPratica && (
                <div className="rounded-xl border border-sky-200 bg-sky-50/70 p-4 flex items-start gap-3 text-xs text-sky-900">
                  <Sparkles className="h-4 w-4 text-sky-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Dica Operacional: </span>
                    <span>{activeSection.dicaPratica}</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
