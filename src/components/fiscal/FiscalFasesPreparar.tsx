/**
 * Fases "Preparar" e "Movimentações" do Módulo Fiscal (Fatia 2 Makro).
 * Preparar: importação em lote de XMLs (upload manual + GED da Elliza),
 * com contagem de movimentações/produtos/fornecedores auto-cadastrados.
 * Movimentações: grades de entradas, saídas e serviços prestados/tomados.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Upload,
  FolderOpen,
  Loader2,
  Trash2,
  Package,
  Truck,
  FileSpreadsheet,
  CheckCircle2,
  XCircle,
  Copy,
} from 'lucide-react'
import pb from '@/lib/pocketbase/client'
import {
  importarLoteXml,
  carregarXmlsDoGed,
  excluirMovimento,
  type MovimentoFiscal,
  type ResultadoImportacaoXml,
  type EntradaLote,
  type TipoMovimento,
} from '@/services/fiscalMakro'
import type { Empresa } from '@/types'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { formatCurrency, formatDatePtBr } from '@/lib/formatters'
import { cn } from '@/lib/utils'

const TIPO_LABEL: Record<TipoMovimento, string> = {
  entrada: 'Entrada',
  saida: 'Saída',
  servico_prestado: 'Serviço prestado',
  servico_tomado: 'Serviço tomado',
}

const MODELO_LABEL: Record<string, string> = {
  nfe: 'NF-e',
  nfce: 'NFC-e',
  cte: 'CT-e',
  nfse: 'NFS-e',
}

const ORIGEM_LABEL: Record<string, string> = {
  xml_upload: 'Upload',
  xml_ged: 'GED (Elliza)',
  manual: 'Manual',
}

// ---------------------------------------------------------------------------
// Fase: Preparar
// ---------------------------------------------------------------------------

export function PrepararFase({
  tenantId,
  empresa,
  competencia,
  movimentos,
  aoImportar,
}: {
  tenantId?: string
  empresa: Empresa | null
  competencia: string
  movimentos: MovimentoFiscal[]
  aoImportar: () => void
}) {
  const { toast } = useToast()
  const inputRef = useRef<HTMLInputElement>(null)
  const [importando, setImportando] = useState<'upload' | 'ged' | null>(null)
  const [resultados, setResultados] = useState<ResultadoImportacaoXml[] | null>(null)
  const [contagens, setContagens] = useState({ produtos: 0, fornecedores: 0 })

  const carregarContagens = useCallback(async () => {
    if (!tenantId || !empresa) {
      setContagens({ produtos: 0, fornecedores: 0 })
      return
    }
    try {
      const [prod, forn] = await Promise.all([
        pb
          .collection('fiscais_produtos')
          .getList(1, 1, { filter: `tenant_id="${tenantId}" && empresa_id="${empresa.id}"` }),
        pb
          .collection('fiscais_fornecedores')
          .getList(1, 1, { filter: `tenant_id="${tenantId}" && empresa_id="${empresa.id}"` }),
      ])
      setContagens({ produtos: prod.totalItems, fornecedores: forn.totalItems })
    } catch {
      setContagens({ produtos: 0, fornecedores: 0 })
    }
  }, [tenantId, empresa])

  useEffect(() => {
    carregarContagens()
  }, [carregarContagens])

  const executarImportacao = async (entradas: EntradaLote[], origem: 'upload' | 'ged') => {
    if (!tenantId || !empresa || entradas.length === 0) return
    setImportando(origem)
    setResultados(null)
    try {
      const res = await importarLoteXml({ tenantId, empresaId: empresa.id, entradas })
      setResultados(res)
      const ok = res.filter((r) => r.status === 'importado').length
      const dup = res.filter((r) => r.status === 'duplicado').length
      const erro = res.filter((r) => r.status === 'erro').length
      toast({
        title: ok > 0 ? `${ok} XML(s) importado(s)` : 'Nenhum XML novo importado',
        description: `${dup} duplicado(s), ${erro} com erro.`,
      })
      aoImportar()
      carregarContagens()
    } catch {
      toast({ variant: 'destructive', title: 'Falha na importação em lote' })
    } finally {
      setImportando(null)
    }
  }

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    const entradas: EntradaLote[] = []
    for (const f of Array.from(files)) {
      entradas.push({ nome: f.name, conteudo: await f.text(), origem: 'xml_upload' })
    }
    await executarImportacao(entradas, 'upload')
    if (inputRef.current) inputRef.current.value = ''
  }

  const handleGed = async () => {
    if (!tenantId || !empresa) return
    setImportando('ged')
    try {
      const entradas = await carregarXmlsDoGed({ empresaId: empresa.id, competencia })
      if (entradas.length === 0) {
        toast({
          title: 'Nenhum XML encontrado no GED',
          description: 'Não há documentos .xml para esta empresa/competência.',
        })
        return
      }
      await executarImportacao(entradas, 'ged')
    } catch {
      toast({ variant: 'destructive', title: 'Falha ao ler os XMLs do GED' })
    } finally {
      setImportando(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="rounded-2xl border-[#E2E8F0] p-4">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="h-4 w-4 text-[#0FA3A3]" />
            <span className="text-xs font-semibold text-[#64748B]">
              Movimentações na competência
            </span>
          </div>
          <p className="text-2xl font-bold text-[#1A2333] mt-1">{movimentos.length}</p>
        </Card>
        <Card className="rounded-2xl border-[#E2E8F0] p-4">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-[#0FA3A3]" />
            <span className="text-xs font-semibold text-[#64748B]">Produtos auto-cadastrados</span>
          </div>
          <p className="text-2xl font-bold text-[#1A2333] mt-1">{contagens.produtos}</p>
        </Card>
        <Card className="rounded-2xl border-[#E2E8F0] p-4">
          <div className="flex items-center gap-2">
            <Truck className="h-4 w-4 text-[#0FA3A3]" />
            <span className="text-xs font-semibold text-[#64748B]">
              Fornecedores auto-cadastrados
            </span>
          </div>
          <p className="text-2xl font-bold text-[#1A2333] mt-1">{contagens.fornecedores}</p>
        </Card>
      </div>

      <Card className="rounded-2xl border-[#E2E8F0] p-4">
        <h4 className="text-sm font-bold text-[#1A2333]">Importação em lote de XMLs</h4>
        <p className="text-xs text-[#64748B] mt-0.5">
          Envie os XMLs de NF-e/NFS-e da empresa (upload manual) ou busque os arquivos já coletados
          pelo GED da Elliza. Cada XML válido cria a movimentação, os itens e preenche
          produtos/fornecedores automaticamente; chaves de acesso já importadas são ignoradas.
        </p>
        <div className="flex flex-wrap gap-2 mt-3">
          <Button
            onClick={() => inputRef.current?.click()}
            disabled={!empresa || importando !== null}
            className="gap-2 rounded-xl bg-[#0FA3A3] hover:bg-[#0C8585] text-white text-xs h-9"
          >
            {importando === 'upload' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            Importar XMLs (upload)
          </Button>
          <Button
            onClick={handleGed}
            variant="outline"
            disabled={!empresa || importando !== null}
            className="gap-2 rounded-xl border-[#0FA3A3]/40 text-[#0FA3A3] hover:bg-teal-50 text-xs h-9"
          >
            {importando === 'ged' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FolderOpen className="h-4 w-4" />
            )}
            Buscar XMLs no GED (Elliza)
          </Button>
          <input
            ref={inputRef}
            type="file"
            accept=".xml,text/xml,application/xml"
            multiple
            className="hidden"
            onChange={(e) => handleUpload(e.target.files)}
            aria-label="Selecionar arquivos XML para importação"
          />
        </div>
        {!empresa && (
          <p className="text-xs text-amber-600 mt-2">
            Selecione uma empresa no cabeçalho para importar.
          </p>
        )}
      </Card>

      {resultados && (
        <Card className="rounded-2xl border-[#E2E8F0] p-4">
          <h4 className="text-sm font-bold text-[#1A2333] mb-2">Resultado da última importação</h4>
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="text-left px-3 py-2 font-semibold">Arquivo</th>
                  <th className="text-left px-3 py-2 font-semibold">Status</th>
                  <th className="text-left px-3 py-2 font-semibold">Mensagem</th>
                </tr>
              </thead>
              <tbody>
                {resultados.map((r, i) => (
                  <tr key={`${r.arquivo}-${i}`} className="border-t border-slate-100">
                    <td className="px-3 py-2 text-slate-700 max-w-[240px] truncate">{r.arquivo}</td>
                    <td className="px-3 py-2">
                      {r.status === 'importado' && (
                        <Badge className="gap-1 bg-[#DCFCE7] text-[#166534] hover:bg-[#DCFCE7]">
                          <CheckCircle2 className="h-3 w-3" /> Importado
                        </Badge>
                      )}
                      {r.status === 'duplicado' && (
                        <Badge className="gap-1 bg-[#FEF3C7] text-[#92400E] hover:bg-[#FEF3C7]">
                          <Copy className="h-3 w-3" /> Duplicado
                        </Badge>
                      )}
                      {r.status === 'erro' && (
                        <Badge className="gap-1 bg-[#FEE2E2] text-[#991B1B] hover:bg-[#FEE2E2]">
                          <XCircle className="h-3 w-3" /> Erro
                        </Badge>
                      )}
                    </td>
                    <td className="px-3 py-2 text-slate-500">{r.mensagem || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Fase: Movimentações
// ---------------------------------------------------------------------------

export function MovimentacoesFase({
  movimentos,
  carregando,
  podeExcluir,
  aoExcluir,
}: {
  movimentos: MovimentoFiscal[]
  carregando: boolean
  podeExcluir: boolean
  aoExcluir: (id: string) => Promise<void>
}) {
  const [filtro, setFiltro] = useState<'todos' | TipoMovimento>('todos')
  const [excluindo, setExcluindo] = useState<string | null>(null)

  const filtrados = useMemo(
    () => (filtro === 'todos' ? movimentos : movimentos.filter((m) => m.tipo_movimento === filtro)),
    [movimentos, filtro],
  )

  const totais = useMemo(
    () =>
      filtrados.reduce(
        (acc, m) => ({
          total: acc.total + (m.valor_total || 0),
          icms: acc.icms + (m.valor_icms || 0),
          st: acc.st + (m.valor_icms_st || 0),
          fcp: acc.fcp + (m.valor_fcp_st || 0),
        }),
        { total: 0, icms: 0, st: 0, fcp: 0 },
      ),
    [filtrados],
  )

  const handleExcluir = async (id: string) => {
    if (!window.confirm('Excluir esta movimentação e permanecer com os itens órfãos?')) return
    setExcluindo(id)
    try {
      await excluirMovimento(id)
      await aoExcluir(id)
    } finally {
      setExcluindo(null)
    }
  }

  return (
    <Card className="rounded-2xl border-[#E2E8F0] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <h4 className="text-sm font-bold text-[#1A2333]">Movimentações fiscais</h4>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrar por tipo">
          {(['todos', 'entrada', 'saida', 'servico_prestado', 'servico_tomado'] as const).map(
            (f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFiltro(f)}
                className={cn(
                  'rounded-full px-3 py-1 text-[11px] font-semibold transition-colors',
                  filtro === f
                    ? 'bg-[#0FA3A3] text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
                )}
              >
                {f === 'todos' ? 'Todas' : TIPO_LABEL[f]}
              </button>
            ),
          )}
        </div>
      </div>

      {carregando ? (
        <div className="flex items-center justify-center py-10 text-slate-400">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : filtrados.length === 0 ? (
        <div className="py-10 text-center text-xs text-slate-500">
          Nenhuma movimentação encontrada. Use a fase <strong>Preparar</strong> para importar os
          XMLs da competência.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="text-left px-3 py-2 font-semibold">Emissão</th>
                <th className="text-left px-3 py-2 font-semibold">Tipo</th>
                <th className="text-left px-3 py-2 font-semibold">Doc.</th>
                <th className="text-left px-3 py-2 font-semibold">Nº</th>
                <th className="text-left px-3 py-2 font-semibold">Emitente / Destinatário</th>
                <th className="text-right px-3 py-2 font-semibold">Valor total</th>
                <th className="text-right px-3 py-2 font-semibold">ICMS</th>
                <th className="text-right px-3 py-2 font-semibold">ICMS-ST</th>
                <th className="text-right px-3 py-2 font-semibold">FCP-ST</th>
                <th className="text-left px-3 py-2 font-semibold">Origem</th>
                {podeExcluir && <th className="px-3 py-2" aria-label="Ações" />}
              </tr>
            </thead>
            <tbody>
              {filtrados.map((m) => (
                <tr key={m.id} className="border-t border-slate-100 hover:bg-slate-50/60">
                  <td className="px-3 py-2 text-slate-600 whitespace-nowrap">
                    {formatDatePtBr(m.data_emissao)}
                  </td>
                  <td className="px-3 py-2">
                    <Badge
                      variant="outline"
                      className="text-[10px] font-semibold bg-slate-50 text-slate-600 border-slate-200"
                    >
                      {TIPO_LABEL[m.tipo_movimento]}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 text-slate-600">{MODELO_LABEL[m.modelo_documento]}</td>
                  <td className="px-3 py-2 text-slate-600">
                    {m.numero_nota || '—'}
                    {m.serie ? ` / ${m.serie}` : ''}
                  </td>
                  <td className="px-3 py-2 text-slate-700 max-w-[220px] truncate">
                    {(m.tipo_movimento === 'saida' || m.tipo_movimento === 'servico_prestado'
                      ? m.destinatario_nome
                      : m.emitente_nome) || '—'}
                  </td>
                  <td className="px-3 py-2 text-right text-slate-800 font-semibold">
                    {formatCurrency(m.valor_total)}
                  </td>
                  <td className="px-3 py-2 text-right text-slate-600">
                    {formatCurrency(m.valor_icms)}
                  </td>
                  <td className="px-3 py-2 text-right text-slate-600">
                    {formatCurrency(m.valor_icms_st)}
                  </td>
                  <td className="px-3 py-2 text-right text-slate-600">
                    {formatCurrency(m.valor_fcp_st)}
                  </td>
                  <td className="px-3 py-2 text-slate-500">{ORIGEM_LABEL[m.origem]}</td>
                  {podeExcluir && (
                    <td className="px-3 py-2 text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-slate-400 hover:text-red-600"
                        onClick={() => handleExcluir(m.id)}
                        disabled={excluindo === m.id}
                        aria-label={`Excluir movimentação ${m.numero_nota || ''}`}
                      >
                        {excluindo === m.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-slate-50 font-semibold text-slate-700">
              <tr>
                <td className="px-3 py-2" colSpan={5}>
                  Totais ({filtrados.length} nota{filtrados.length === 1 ? '' : 's'})
                </td>
                <td className="px-3 py-2 text-right">{formatCurrency(totais.total)}</td>
                <td className="px-3 py-2 text-right">{formatCurrency(totais.icms)}</td>
                <td className="px-3 py-2 text-right">{formatCurrency(totais.st)}</td>
                <td className="px-3 py-2 text-right">{formatCurrency(totais.fcp)}</td>
                <td className="px-3 py-2" colSpan={podeExcluir ? 2 : 1} />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </Card>
  )
}
