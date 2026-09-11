import pb from '@/lib/pocketbase/client'
import type { EmpresaCadastroAssistidoRecord, AlertaValidacao } from '@/types'

export interface ExtrairDocumentoResponse {
  success: boolean
  fileName: string
  markdown: string
  isScanned?: boolean
  erro?: string
  mensagem?: string
}

export const cadastroAssistidoService = {
  /**
   * Envia o arquivo ao backend PocketBase para extração via hook $documents.toMarkdown.
   */
  async extrairTextoDocumento(file: File): Promise<ExtrairDocumentoResponse> {
    const formData = new FormData()
    formData.append('arquivo', file)

    const res = await pb.send<ExtrairDocumentoResponse>('/backend/v1/documentos/extrair-empresa', {
      method: 'POST',
      body: formData,
    })
    return res
  },

  /**
   * Salva o log de cadastro assistido na coleção `empresa_cadastro_assistido`.
   */
  async salvarLog(params: {
    tenantId: string
    empresaId?: string
    arquivoNome: string
    arquivoFile?: File | null
    tipoDocumento: string
    camposExtraidos: Record<string, unknown>
    alertas: AlertaValidacao[]
    acoes: Record<string, unknown>
    criadoPorId?: string
  }): Promise<EmpresaCadastroAssistidoRecord> {
    const formData = new FormData()
    formData.append('tenant_id', params.tenantId)
    if (params.empresaId) {
      formData.append('empresa', params.empresaId)
    }
    formData.append('arquivo_nome', params.arquivoNome)
    if (params.arquivoFile) {
      formData.append('arquivo', params.arquivoFile)
    }
    formData.append('tipo_documento', params.tipoDocumento || 'cartao_cnpj')
    formData.append('campos_extraidos', JSON.stringify(params.camposExtraidos))
    formData.append('alertas', JSON.stringify(params.alertas))
    formData.append('acoes', JSON.stringify(params.acoes))
    if (params.criadoPorId) {
      formData.append('criado_por', params.criadoPorId)
    }

    return pb
      .collection('empresa_cadastro_assistido')
      .create<EmpresaCadastroAssistidoRecord>(formData)
  },

  /**
   * Lista logs de cadastro assistido por empresa ou tenant.
   */
  async listarLogs(tenantId: string, empresaId?: string) {
    let filter = `tenant_id = "${tenantId}"`
    if (empresaId) {
      filter += ` && empresa = "${empresaId}"`
    }
    return pb.collection('empresa_cadastro_assistido').getFullList<EmpresaCadastroAssistidoRecord>({
      filter,
      sort: '-created',
      expand: 'empresa,criado_por',
    })
  },
}
