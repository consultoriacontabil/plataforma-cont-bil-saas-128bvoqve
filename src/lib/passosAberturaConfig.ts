export interface ItemCheckPassoAbertura {
  id: string // e.g. "passo1_item1"
  numero: number // 1 a 18
  passoId: 'passo_1' | 'passo_2' | 'passo_3'
  passoTitulo: string
  texto: string
  concluido: boolean
  concluido_em?: string
  concluido_por_id?: string
  concluido_por_nome?: string
  // Campos auxiliares inline
  temProtocoloViabilidade?: boolean
  protocolo_viabilidade?: string
  temNireCnpj?: boolean
  nire?: string
  data_efetivacao_cnpj?: string
  observacao?: string
}

export interface PassoAberturaGrupo {
  id: 'passo_1' | 'passo_2' | 'passo_3'
  numero: number
  titulo: string
  subtitulo: string
  itens: ItemCheckPassoAbertura[]
}

export const ITENS_PASSOS_ABERTURA_CONFIG: Omit<
  ItemCheckPassoAbertura,
  'concluido' | 'concluido_em' | 'concluido_por_id' | 'concluido_por_nome'
>[] = [
  // PASSO 1 — VIABILIDADE
  {
    id: 'passo1_item1',
    numero: 1,
    passoId: 'passo_1',
    passoTitulo: 'PASSO 1 — VIABILIDADE',
    texto:
      'abrir no portal da Junta (via Redesim) a consulta de viabilidade de NOME EMPRESARIAL + LOCAL (endereço + CNAE + forma de atuação + tipo de unidade)',
  },
  {
    id: 'passo1_item2',
    numero: 2,
    passoId: 'passo_1',
    passoTitulo: 'PASSO 1 — VIABILIDADE',
    texto:
      'Confirmar que os CNAEs pretendidos são permitidos no Simples Nacional antes de submeter a viabilidade',
  },
  {
    id: 'passo1_item3',
    numero: 3,
    passoId: 'passo_1',
    passoTitulo: 'PASSO 1 — VIABILIDADE',
    texto:
      'Submeter a viabilidade, anotar o PROTOCOLO e AGUARDAR O DEFERIMENTO antes de prosseguir',
    temProtocoloViabilidade: true,
  },
  {
    id: 'passo1_item4',
    numero: 4,
    passoId: 'passo_1',
    passoTitulo: 'PASSO 1 — VIABILIDADE',
    texto: 'Definir a participação de cada sócio no capital social e a forma de integralização',
  },

  // PASSO 2 — COLETOR NACIONAL
  {
    id: 'passo2_item5',
    numero: 5,
    passoId: 'passo_2',
    passoTitulo: 'PASSO 2 — COLETOR NACIONAL',
    texto: 'com a viabilidade deferida, abrir o Coletor Nacional (Redesim) e preencher as fichas',
  },
  {
    id: 'passo2_item6',
    numero: 6,
    passoId: 'passo_2',
    passoTitulo: 'PASSO 2 — COLETOR NACIONAL',
    texto:
      'Selecionar a natureza jurídica Sociedade Empresária Limitada (206-2) e informar o protocolo da viabilidade',
  },
  {
    id: 'passo2_item7',
    numero: 7,
    passoId: 'passo_2',
    passoTitulo: 'PASSO 2 — COLETOR NACIONAL',
    texto:
      'Preencher identificação/capital, CNAE principal/secundários, endereço, contato e porte (ME até R$ 360 mil / EPP até R$ 4,8 mi)',
  },
  {
    id: 'passo2_item8',
    numero: 8,
    passoId: 'passo_2',
    passoTitulo: 'PASSO 2 — COLETOR NACIONAL',
    texto:
      'Informar o contabilista (CPF/CNPJ + CRC) e o QSA com a participação de cada sócio (somando o capital)',
  },
  {
    id: 'passo2_item9',
    numero: 9,
    passoId: 'passo_2',
    passoTitulo: 'PASSO 2 — COLETOR NACIONAL',
    texto: 'Usar o MAT para indicar o regime Simples Nacional como pretendido',
  },
  {
    id: 'passo2_item10',
    numero: 10,
    passoId: 'passo_2',
    passoTitulo: 'PASSO 2 — COLETOR NACIONAL',
    texto:
      'Verificar pendências, finalizar e TRANSMITIR para gerar o DBE; acompanhar até o DBE deferido',
  },

  // PASSO 3 — JUNTA COMERCIAL
  {
    id: 'passo3_item11',
    numero: 11,
    passoId: 'passo_3',
    passoTitulo: 'PASSO 3 — JUNTA COMERCIAL',
    texto: 'gerar a capa/FCN no integrador e emitir/pagar a TAXA da Junta',
  },
  {
    id: 'passo3_item12',
    numero: 12,
    passoId: 'passo_3',
    passoTitulo: 'PASSO 3 — JUNTA COMERCIAL',
    texto:
      'Elaborar o contrato social (qualificação dos sócios, objeto, capital, quotas, administrador e cláusulas de retirada)',
  },
  {
    id: 'passo3_item13',
    numero: 13,
    passoId: 'passo_3',
    passoTitulo: 'PASSO 3 — JUNTA COMERCIAL',
    texto:
      'Montar o processo digital, anexar o contrato e ASSINAR com certificado digital (e-CPF) de todos os sócios ou assinatura gov.br',
  },
  {
    id: 'passo3_item14',
    numero: 14,
    passoId: 'passo_3',
    passoTitulo: 'PASSO 3 — JUNTA COMERCIAL',
    texto:
      "Protocolar e acompanhar o deferimento até obter o NIRE e a efetivação do CNPJ (confirmar situação 'Ativa' na RFB)",
    temNireCnpj: true,
  },
  {
    id: 'passo3_item15',
    numero: 15,
    passoId: 'passo_3',
    passoTitulo: 'PASSO 3 — JUNTA COMERCIAL',
    texto:
      'Solicitar a inscrição MUNICIPAL (CCM) e alvará; e a inscrição ESTADUAL (IE) na SEFAZ quando houver ICMS',
  },
  {
    id: 'passo3_item16',
    numero: 16,
    passoId: 'passo_3',
    passoTitulo: 'PASSO 3 — JUNTA COMERCIAL',
    texto: 'Verificar o licenciamento por classificação de risco e licenças setoriais obrigatórias',
  },
  {
    id: 'passo3_item17',
    numero: 17,
    passoId: 'passo_3',
    passoTitulo: 'PASSO 3 — JUNTA COMERCIAL',
    texto:
      'Formalizar a opção pelo Simples Nacional em até 30 dias do CNPJ e confirmar o deferimento no portal',
  },
  {
    id: 'passo3_item18',
    numero: 18,
    passoId: 'passo_3',
    passoTitulo: 'PASSO 3 — JUNTA COMERCIAL',
    texto:
      'Abrir conta bancária PJ, orientar os sócios sobre pró-labore/distribuição de lucros e arquivar viabilidade, DBE e contrato registrado',
  },
]

export const PASSOS_DEFINICOES = [
  {
    id: 'passo_1' as const,
    numero: 1,
    titulo: 'PASSO 1 — VIABILIDADE',
    subtitulo: 'Consulta prévia de nome e endereço na Redesim / Junta Comercial',
  },
  {
    id: 'passo_2' as const,
    numero: 2,
    titulo: 'PASSO 2 — COLETOR NACIONAL',
    subtitulo: 'Fichas cadastrais, QSA, contabilista e geração/transmissão do DBE',
  },
  {
    id: 'passo_3' as const,
    numero: 3,
    titulo: 'PASSO 3 — JUNTA COMERCIAL',
    subtitulo: 'Contrato social, taxas, assinaturas, NIRE, CNPJ, inscrições e Simples',
  },
]

/**
 * Inicializa ou normaliza a lista de itens preservando o que já foi salvo.
 */
export function inicializarChecklistPassos(
  existente?: ItemCheckPassoAbertura[] | null,
): ItemCheckPassoAbertura[] {
  const mapExistente = new Map<string, ItemCheckPassoAbertura>()
  if (Array.isArray(existente)) {
    for (const it of existente) {
      if (it && it.id) {
        mapExistente.set(it.id, it)
      }
    }
  }

  return ITENS_PASSOS_ABERTURA_CONFIG.map((cfg) => {
    const salvo = mapExistente.get(cfg.id)
    return {
      ...cfg,
      concluido: salvo?.concluido ?? false,
      concluido_em: salvo?.concluido_em,
      concluido_por_id: salvo?.concluido_por_id,
      concluido_por_nome: salvo?.concluido_por_nome,
      protocolo_viabilidade: salvo?.protocolo_viabilidade ?? '',
      nire: salvo?.nire ?? '',
      data_efetivacao_cnpj: salvo?.data_efetivacao_cnpj ?? '',
      observacao: salvo?.observacao ?? '',
    }
  })
}

/**
 * Agrupa os itens nos 3 passos com status e contadores calculados
 */
export function agruparPassosAbertura(itens: ItemCheckPassoAbertura[]): PassoAberturaGrupo[] {
  return PASSOS_DEFINICOES.map((passo) => ({
    ...passo,
    itens: itens.filter((it) => it.passoId === passo.id),
  }))
}
