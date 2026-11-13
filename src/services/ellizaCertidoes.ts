import pb from '@/lib/pocketbase/client'
import type { CertidaoElliza } from '@/types'

/**
 * Certidões da Fase 1 ELLIZA (coleção elliza_certidoes, migration 0152).
 * Leitura pela ficha da empresa: lista por empresa com situação e PDF arquivado no GED.
 */

export type CertidaoTipo = CertidaoElliza['tipo_certidao']

export const CERTIDAO_TIPO_LABEL: Record<CertidaoTipo, string> = {
  cnd_federal: 'CND Federal (Receita/PGFN)',
  cnd_estadual: 'CND Estadual (SEFAZ)',
  cnd_municipal: 'CND Municipal',
  cndt: 'CNDT (Trabalhista)',
  comprovante_cnpj: 'Comprovante de Inscrição CNPJ',
}

export const CERTIDAO_SITUACAO_LABEL: Record<string, string> = {
  negativa: 'Negativa',
  positiva: 'Positiva',
  positiva_com_efeitos: 'Positiva com efeitos',
}

/**
 * URL do PDF arquivado no GED (coleção documentos). Preferência: arquivo físico
 * do registro; se não houver, usa a fonte pdf_url registrada na certidão.
 */
export function urlPdfCertidao(certidao: CertidaoElliza): string | null {
  if (certidao.documento_id && certidao.expand?.documento_id) {
    const doc = certidao.expand.documento_id as Record<string, unknown>
    const arquivo = doc['arquivo'] || doc['anexo'] || doc['pdf']
    if (typeof arquivo === 'string' && arquivo) {
      return pb.files.getURL(
        {
          collectionId: (doc['collectionId'] as string) || 'documentos',
          id: doc['id'] as string,
          fileName: arquivo,
        } as never,
        arquivo,
      )
    }
    const meta = doc['metadados_json'] as Record<string, unknown> | null
    if (meta && typeof meta.pdf_url === 'string') return meta.pdf_url
  }
  return certidao.pdf_url || null
}

export async function listarCertidoesPorEmpresa(empresaId: string): Promise<CertidaoElliza[]> {
  if (!empresaId) return []
  try {
    const recs = await pb.collection('elliza_certidoes').getList(1, 50, {
      filter: `empresa_id = "${empresaId}"`,
      sort: '-created',
      expand: 'documento_id',
    })
    return recs.items as unknown as CertidaoElliza[]
  } catch {
    return []
  }
}
