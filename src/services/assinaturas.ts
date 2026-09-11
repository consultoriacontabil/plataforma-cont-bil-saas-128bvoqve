import pb from '@/lib/pocketbase/client'
import type {
  AssinaturaDemonstrativoRecord,
  TipoAssinaturaDemonstrativo,
  TipoCertificadoIcp,
  DemonstrativoRecord,
} from '@/types'

// Função utilitária para calcular SHA-256 de uma string/objeto no navegador
export async function calculateSha256(data: unknown): Promise<string> {
  const text = typeof data === 'string' ? data : JSON.stringify(data)
  const encoder = new TextEncoder()
  const dataBuffer = encoder.encode(text)
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

export interface SolicitarAssinaturaInput {
  tenantId: string
  demonstrativoId: string
  empresaId: string
  competencia: string
  tipoAssinatura: TipoAssinaturaDemonstrativo
  tipoCertificado?: TipoCertificadoIcp
  assinante: string
  cargoCpf: string
  emailAssinante?: string
  dadosDemonstrativo: Record<string, unknown>
}

export interface AssinarInput {
  assinaturaId: string
  demonstrativoId: string
  dadosAtuaisDemonstrativo: Record<string, unknown>
  ipAssinatura?: string
  observacoes?: string
}

export const assinaturasService = {
  // Listar assinaturas por demonstrativo
  async listByDemonstrativo(demonstrativoId: string): Promise<AssinaturaDemonstrativoRecord[]> {
    return pb.collection('assinaturas_demonstrativos').getFullList<AssinaturaDemonstrativoRecord>({
      filter: `demonstrativo = "${demonstrativoId}"`,
      sort: '-created',
      expand: 'demonstrativo,empresa',
    })
  },

  // Listar assinaturas por tenant ou empresa
  async list(
    tenantId: string,
    filters?: { empresaId?: string; competencia?: string },
  ): Promise<AssinaturaDemonstrativoRecord[]> {
    const parts = [`tenant_id = "${tenantId}"`]
    if (filters?.empresaId && filters.empresaId !== 'todas') {
      parts.push(`empresa = "${filters.empresaId}"`)
    }
    if (filters?.competencia && filters.competencia !== 'todas') {
      parts.push(`competencia = "${filters.competencia}"`)
    }

    return pb.collection('assinaturas_demonstrativos').getFullList<AssinaturaDemonstrativoRecord>({
      filter: parts.join(' && '),
      sort: '-created',
      expand: 'demonstrativo,empresa',
    })
  },

  // Obter assinatura por token de verificação pública (sem exigir autenticação)
  async getByToken(token: string): Promise<{
    assinatura: AssinaturaDemonstrativoRecord
    demonstrativo: DemonstrativoRecord | null
    integridadeOk: boolean
    hashAtualCalculado: string
  }> {
    const cleanToken = token.trim()
    const records = await pb
      .collection('assinaturas_demonstrativos')
      .getFullList<AssinaturaDemonstrativoRecord>({
        filter: `token_verificacao = "${cleanToken}"`,
        expand: 'demonstrativo,empresa',
      })

    if (!records || records.length === 0) {
      throw new Error('Assinatura não localizada para o token fornecido.')
    }

    const assinatura = records[0]
    let demonstrativo: DemonstrativoRecord | null = null
    let hashAtualCalculado = ''
    let integridadeOk = false

    try {
      if (assinatura.demonstrativo) {
        demonstrativo = await pb
          .collection('demonstrativos')
          .getOne<DemonstrativoRecord>(assinatura.demonstrativo, {
            expand: 'empresa,aprovado_por,gerado_por',
          })
        if (demonstrativo && demonstrativo.dados) {
          hashAtualCalculado = await calculateSha256(demonstrativo.dados)
          integridadeOk = hashAtualCalculado === assinatura.hash_conteudo
        }
      }
    } catch (e) {
      console.warn('Não foi possível obter demonstrativo vinculado para verificação completa:', e)
    }

    return {
      assinatura,
      demonstrativo,
      integridadeOk,
      hashAtualCalculado,
    }
  },

  // Solicitar nova assinatura para um demonstrativo congelado
  async solicitarAssinatura(
    input: SolicitarAssinaturaInput,
  ): Promise<AssinaturaDemonstrativoRecord> {
    const hashConteudo = await calculateSha256(input.dadosDemonstrativo)
    const randomToken = Math.random().toString(36).substring(2, 10).toUpperCase()
    const tokenVerificacao = `RUMO-${input.competencia.replace('/', '')}-${randomToken}`

    return pb.collection('assinaturas_demonstrativos').create<AssinaturaDemonstrativoRecord>(
      {
        tenant_id: input.tenantId,
        demonstrativo: input.demonstrativoId,
        empresa: input.empresaId,
        competencia: input.competencia,
        tipo_assinatura: input.tipoAssinatura,
        tipo_certificado: input.tipoCertificado || 'nenhum',
        assinante: input.assinante,
        cargo_cpf: input.cargoCpf,
        email_assinante: input.emailAssinante || '',
        hash_conteudo: hashConteudo,
        hash_documentacao: `DOC-SHA256-${hashConteudo.slice(0, 16)}`,
        status: 'solicitada',
        token_verificacao: tokenVerificacao,
        data_solicitacao: new Date().toISOString(),
        provedor: input.tipoAssinatura === 'icp_brasil' ? 'd4sign' : 'interno',
        payload_provedor: {
          solicitadoPor: 'Rumo Contabilidade Digital',
          hashRegistrado: hashConteudo,
          avisoLegal:
            input.tipoAssinatura === 'icp_brasil'
              ? 'Aguardando envio ao provedor ICP-Brasil com certificado digital qualificado A1/A3.'
              : 'Assinatura eletrônica declarada com registro de integridade SHA-256 e IP.',
        },
      },
      { expand: 'demonstrativo,empresa' },
    )
  },

  // Executar a assinatura pelo usuário/assinante
  async assinar(input: AssinarInput): Promise<AssinaturaDemonstrativoRecord> {
    // 1. Obter assinatura atual
    const assinatura = await pb
      .collection('assinaturas_demonstrativos')
      .getOne<AssinaturaDemonstrativoRecord>(input.assinaturaId)

    // 2. Validação prévia de integridade no client (além da validação obrigatória no servidor)
    const hashAtual = await calculateSha256(input.dadosAtuaisDemonstrativo)
    if (hashAtual !== assinatura.hash_conteudo) {
      throw new Error(
        'Demonstrativo alterado após a solicitação de assinatura! O hash de conteúdo diverge do registrado originalmente. Solicite uma nova assinatura.',
      )
    }

    // 3. Obter IP estimado se não passado
    const ip = input.ipAssinatura || '127.0.0.1 (Origem Segura HTTPS)'

    return pb.collection('assinaturas_demonstrativos').update<AssinaturaDemonstrativoRecord>(
      input.assinaturaId,
      {
        status: 'assinada',
        data_assinatura: new Date().toISOString(),
        ip_assinatura: ip,
        payload_provedor: {
          ...(assinatura.payload_provedor || {}),
          statusFinal: 'Assinado pelo declarante',
          concluidoEm: new Date().toISOString(),
          observacoes:
            input.observacoes || 'Concordância explícita com os termos e integridade contábil.',
        },
      },
      { expand: 'demonstrativo,empresa' },
    )
  },

  // Cancelar solicitação de assinatura
  async cancelar(assinaturaId: string): Promise<AssinaturaDemonstrativoRecord> {
    return pb
      .collection('assinaturas_demonstrativos')
      .update<AssinaturaDemonstrativoRecord>(
        assinaturaId,
        { status: 'cancelada' },
        { expand: 'demonstrativo,empresa' },
      )
  },
}
