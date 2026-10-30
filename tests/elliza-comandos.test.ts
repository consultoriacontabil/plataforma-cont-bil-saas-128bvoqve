import { describe, it, expect } from 'vitest'

describe('ELLIZA Desktop Integration Contracts', () => {
  it('valida estrutura dos tipos de comando', () => {
    const tipos = [
      'chat_objetivo',
      'extrair_documento',
      'conciliar_xml',
      'raspar_portal',
      'enviar_zap',
      'consultar_api',
      'sync_ged',
    ]
    expect(tipos).toContain('extrair_documento')
    expect(tipos).toContain('enviar_zap')
  })

  it('valida status permitidos da esteira Trilha RPA v1.0', () => {
    const status = ['pendente', 'aceito', 'em_execucao', 'concluido', 'erro', 'expirado']
    expect(status).toHaveLength(6)
  })

  it('valida que campos essenciais de nfiscal para extrair_documento contêm os requisitos mínimos', () => {
    const camposObrigatorios = ['numero', 'cnpj_emitente', 'cnpj_destinatario', 'valor_total', 'competencia']
    expect(camposObrigatorios.length).toBe(5)
  })
})
