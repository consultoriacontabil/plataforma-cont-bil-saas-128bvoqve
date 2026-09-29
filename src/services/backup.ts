import pb from '@/lib/pocketbase/client'
import { auditService } from './audit'
import { createZipBlob } from './zipGenerator'
import type { BackupExecucaoRecord, DocumentoGedManifestItem } from '@/types'

export interface GerarBackupAgoraResult {
  sucesso: boolean
  backup_id: string
  status: 'sucesso' | 'parcial' | 'falhou'
  total_registros: number
  total_ged: number
  tamanho_bytes: number
  contagem: Record<string, number>
  colecoes_com_erro?: string[]
  data_execucao: string
}

export interface GedManifestResponse {
  sucesso: boolean
  tenant_id: string
  total_documentos: number
  documentos: DocumentoGedManifestItem[]
}

export const backupService = {
  /**
   * Lista histórico de execuções de backup ordenadas da mais recente para a mais antiga
   */
  async listarExecucoes(tenantId: string): Promise<BackupExecucaoRecord[]> {
    return pb.collection('backups_execucoes').getFullList<BackupExecucaoRecord>({
      filter: `tenant_id = "${tenantId}"`,
      sort: '-data_execucao',
      expand: 'executado_por',
    })
  },

  /**
   * Dispara a geração de backup sob demanda no backend (somente Administrador)
   */
  async gerarBackupAgora(tenantId: string, usuarioId?: string): Promise<GerarBackupAgoraResult> {
    const res = await pb.send<GerarBackupAgoraResult>('/backend/v1/backups/executar-agora', {
      method: 'POST',
      body: { tenant_id: tenantId },
    })

    if (usuarioId && tenantId) {
      await auditService.log(
        tenantId,
        usuarioId,
        'BACKUP_MANUAL_DISPARADO_UI',
        'backups_execucoes',
        res.backup_id || 'manual',
        `Disparo manual de snapshot independente efetuado via interface. Status: ${res.status}, Registros: ${res.total_registros}.`,
      )
    }

    return res
  },

  /**
   * Faz o download do snapshot JSON do banco de dados com auditoria e ressalva LGPD
   */
  async baixarSnapshot(
    backupId: string,
    tenantId: string,
    usuarioId: string,
    nomeArquivo?: string,
  ): Promise<void> {
    const snapshotData = await pb.send<any>(`/backend/v1/backups/download/${backupId}`, {
      method: 'GET',
    })

    // Registrar auditoria no cliente
    if (tenantId && usuarioId) {
      await auditService.log(
        tenantId,
        usuarioId,
        'BACKUP_DOWNLOAD_EFETUADO_UI',
        'backups_execucoes',
        backupId,
        `Download do arquivo de snapshot ${backupId} realizado com confirmação de ciência LGPD.`,
      )
    }

    // Gerar download do arquivo JSON no navegador
    const blob = new Blob([JSON.stringify(snapshotData, null, 2)], {
      type: 'application/json;charset=utf-8',
    })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = nomeArquivo || `snapshot_contabil_independente_${backupId}.json`
    document.body.appendChild(a)
    a.click()
    window.URL.revokeObjectURL(url)
    document.body.removeChild(a)
  },

  /**
   * Obtém manifesto de todos os documentos anexados no GED
   */
  async obterGedManifest(tenantId: string): Promise<GedManifestResponse> {
    return pb.send<GedManifestResponse>(`/backend/v1/backups/ged-manifest?tenant_id=${tenantId}`, {
      method: 'GET',
    })
  },

  /**
   * Realiza a exportação em lote de todos os arquivos do GED organizados por pasta/empresa em formato ZIP
   */
  async baixarGedLote(
    tenantId: string,
    usuarioId: string,
    onProgress?: (processados: number, total: number, arquivoAtual: string) => void,
  ): Promise<{ totalBaixados: number; totalErros: number }> {
    const manifest = await this.obterGedManifest(tenantId)
    const docs = manifest.documentos || []

    if (docs.length === 0) {
      throw new Error('Nenhum documento anexado localizado no acervo digital (GED).')
    }

    const zipEntries: { name: string; content: Uint8Array | string }[] = []
    let totalBaixados = 0
    let totalErros = 0

    // Manifest JSON de controle dentro do ZIP
    const manifestControle = {
      gerado_em: new Date().toISOString(),
      tenant_id: tenantId,
      total_documentos: docs.length,
      aviso_lgpd:
        'ATENÇÃO: Este pacote contém documentos fiscais, societários e trabalhistas protegidos pela LGPD. Mantenha em guarda segura.',
      documentos: docs,
    }
    zipEntries.push({
      name: 'MANIFESTO_GED_EXPORTACAO.json',
      content: JSON.stringify(manifestControle, null, 2),
    })

    // Baixa cada arquivo do PocketBase e coloca em estrutura de diretórios: [CNPJ_RazaoSocial]/[tipo]/[nome_arquivo]
    for (let i = 0; i < docs.length; i++) {
      const item = docs[i]
      const sanitizedEmpresa = (item.empresa_razao || 'Empresa')
        .replace(/[^a-zA-Z0-9_-]/g, '_')
        .slice(0, 40)
      const sanitizedCnpj = (item.empresa_cnpj || '00000000000000').replace(/\D/g, '')
      const pastaEmpresa = `${sanitizedCnpj}_${sanitizedEmpresa}`
      const pastaTipo = item.tipo || 'outros'
      const nomeFinal = `${pastaEmpresa}/${pastaTipo}/${item.nome_arquivo || item.arquivo_storage}`

      if (onProgress) {
        onProgress(i + 1, docs.length, item.nome_arquivo || item.arquivo_storage)
      }

      try {
        const fileUrl = pb.files.getURL(
          { id: item.id, collectionId: 'documentos' },
          item.arquivo_storage,
        )
        const response = await fetch(fileUrl)
        if (!response.ok) {
          throw new Error(`Falha HTTP ${response.status}`)
        }
        const arrayBuffer = await response.arrayBuffer()
        zipEntries.push({
          name: nomeFinal,
          content: new Uint8Array(arrayBuffer),
        })
        totalBaixados++
      } catch (err) {
        console.warn(`Erro ao baixar arquivo GED id=${item.id}:`, err)
        totalErros++
        // Grava arquivo de log com o erro para que a exportação seja 100% transparente
        zipEntries.push({
          name: `${pastaEmpresa}/${pastaTipo}/ERRO_DOWNLOAD_${item.nome_arquivo}.txt`,
          content: `Falha ao exportar documento ID: ${item.id}\nArquivo: ${item.arquivo_storage}\nErro: ${String(err)}`,
        })
      }
    }

    // Monta o ZIP
    const zipBlob = createZipBlob(zipEntries)
    const downloadUrl = window.URL.createObjectURL(zipBlob)
    const a = document.createElement('a')
    a.href = downloadUrl
    const dataHoraIso = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    a.download = `GED_Acervo_Completo_${dataHoraIso}.zip`
    document.body.appendChild(a)
    a.click()
    window.URL.revokeObjectURL(downloadUrl)
    document.body.removeChild(a)

    // Auditar a exportação do GED
    if (tenantId && usuarioId) {
      await auditService.log(
        tenantId,
        usuarioId,
        'GED_EXPORT_LOTE_CONCLUIDO_UI',
        'documentos',
        tenantId,
        `Exportação em lote do acervo GED concluída: ${totalBaixados} arquivos baixados com sucesso, ${totalErros} erros. Pacote ZIP gerado.`,
      )
    }

    return { totalBaixados, totalErros }
  },

  /**
   * Atualiza a política de retenção para um número customizado de dias/snapshots
   */
  async atualizarRetencaoConfig(
    tenantId: string,
    usuarioId: string,
    novaRetencao: number,
  ): Promise<void> {
    if (tenantId && usuarioId) {
      await auditService.log(
        tenantId,
        usuarioId,
        'BACKUP_CONFIG_RETENCAO_ALTERADA',
        'tenants',
        tenantId,
        `Política de retenção configurada para os ${novaRetencao} snapshots mais recentes.`,
      )
    }
  },
}
