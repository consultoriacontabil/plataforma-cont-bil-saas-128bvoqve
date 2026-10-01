import React, { useState } from 'react'
import {
  FileCheck2,
  AlertTriangle,
  Plus,
  FileText,
  Calendar,
  ExternalLink,
  Download,
  Trash2,
  Edit,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  Clock,
  Sparkles,
  Info,
  Loader2,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { certidoesService, type CertidaoSaudeInfo } from '@/services/regularidade'
import type { CertidaoRecord, TipoCertidao, StatusCertidao, OrigemCertidao } from '@/types'
import { formatDatePtBr } from '@/lib/formatters'
import pb from '@/lib/pocketbase/client'
import { useToast } from '@/hooks/use-toast'

interface EmpresaCertidoesTabProps {
  empresaId: string
  tenantId: string
  canEdit: boolean
  certidoes: CertidaoRecord[]
  onRefresh: () => Promise<void>
}

export function EmpresaCertidoesTab({
  empresaId,
  tenantId,
  canEdit,
  certidoes,
  onRefresh,
}: EmpresaCertidoesTabProps) {
  const { toast } = useToast()

  const [modalOpen, setModalOpen] = useState(false)
  const [editingCertidao, setEditingCertidao] = useState<CertidaoRecord | null>(null)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Form State
  const [tipo, setTipo] = useState<TipoCertidao>('receita_pgfn_cnd')
  const [status, setStatus] = useState<StatusCertidao>('valida')
  const [numeroControle, setNumeroControle] = useState('')
  const [dataEmissao, setDataEmissao] = useState('')
  const [dataValidade, setDataValidade] = useState('')
  const [origem, setOrigem] = useState<OrigemCertidao>('manual')
  const [observacoes, setObservacoes] = useState('')
  const [arquivoPdf, setArquivoPdf] = useState<File | null>(null)

  const openNewModal = (sugestaoTipo?: TipoCertidao) => {
    setEditingCertidao(null)
    setTipo(sugestaoTipo || 'receita_pgfn_cnd')
    setStatus('valida')
    setNumeroControle('')
    setDataEmissao(new Date().toISOString().split('T')[0])
    // Validade padrão: +180 dias
    const valDefault = new Date(Date.now() + 180 * 86400000).toISOString().split('T')[0]
    setDataValidade(valDefault)
    setOrigem('manual')
    setObservacoes('')
    setArquivoPdf(null)
    setModalOpen(true)
  }

  const openEditModal = (cert: CertidaoRecord) => {
    setEditingCertidao(cert)
    setTipo(cert.tipo)
    setStatus(cert.status)
    setNumeroControle(cert.numero_controle || '')
    setDataEmissao(cert.data_emissao ? cert.data_emissao.split('T')[0] : '')
    setDataValidade(cert.data_validade ? cert.data_validade.split('T')[0] : '')
    setOrigem(cert.origem || 'manual')
    setObservacoes(cert.observacoes || '')
    setArquivoPdf(null)
    setModalOpen(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!dataValidade) {
      toast({
        variant: 'destructive',
        title: 'Data de validade obrigatória',
        description: 'Informe a data em que a certidão expira.',
      })
      return
    }

    setSaving(true)
    try {
      const formData = new FormData()
      formData.append('tenant_id', tenantId)
      formData.append('empresa', empresaId)
      formData.append('tipo', tipo)
      formData.append('status', status)
      if (numeroControle) formData.append('numero_controle', numeroControle)
      if (dataEmissao)
        formData.append('data_emissao', new Date(`${dataEmissao}T12:00:00Z`).toISOString())
      formData.append('data_validade', new Date(`${dataValidade}T12:00:00Z`).toISOString())
      formData.append('origem', origem)
      if (observacoes) formData.append('observacoes', observacoes)
      if (arquivoPdf) {
        formData.append('arquivo_pdf', arquivoPdf)
      }

      await certidoesService.save(editingCertidao?.id || null, formData)

      toast({
        title: editingCertidao ? 'Certidão atualizada!' : 'Certidão registrada!',
        description: `A certidão ${certidoesService.getTipoLabel(tipo)} foi gravada com sucesso.`,
      })

      setModalOpen(false)
      await onRefresh()
    } catch (err: unknown) {
      console.error('Erro ao salvar certidão:', err)
      const msg = err instanceof Error ? err.message : 'Falha ao salvar certidão.'
      toast({
        variant: 'destructive',
        title: 'Erro ao gravar certidão',
        description: msg,
      })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('Tem certeza que deseja excluir esta certidão?')) return
    setDeletingId(id)
    try {
      await certidoesService.delete(id)
      toast({
        title: 'Certidão removida',
        description: 'O registro foi excluído com sucesso.',
      })
      await onRefresh()
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Erro ao excluir',
        description: 'Não foi possível remover a certidão.',
      })
    } finally {
      setDeletingId(null)
    }
  }

  // Renderizar o badge de saúde padronizado (Verde >30d, Amarelo <=30d, Vermelho vencida)
  const renderSaudeBadge = (cert: CertidaoRecord) => {
    const info: CertidaoSaudeInfo = certidoesService.calcularSaude(cert)

    if (info.saude === 'valida') {
      return (
        <Badge
          variant="outline"
          className="border-emerald-200 bg-emerald-50 text-emerald-700 text-xs font-semibold flex items-center gap-1.5 py-1 px-2.5"
        >
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
          <span>Válida ({info.diasRestantes}d)</span>
        </Badge>
      )
    }

    if (info.saude === 'proximo_vencimento') {
      return (
        <Badge
          variant="outline"
          className="border-amber-300 bg-amber-50 text-amber-800 text-xs font-semibold flex items-center gap-1.5 py-1 px-2.5 animate-pulse"
        >
          <ShieldAlert className="h-3.5 w-3.5 text-amber-600" />
          <span>Vence em {info.diasRestantes}d</span>
        </Badge>
      )
    }

    if (info.saude === 'vencida') {
      return (
        <Badge
          variant="outline"
          className="border-red-200 bg-red-50 text-red-700 text-xs font-semibold flex items-center gap-1.5 py-1 px-2.5"
        >
          <ShieldX className="h-3.5 w-3.5 text-red-600" />
          <span>{info.label}</span>
        </Badge>
      )
    }

    if (info.saude === 'sem_efeito') {
      return (
        <Badge
          variant="outline"
          className="border-red-300 bg-red-50 text-red-800 text-xs font-semibold flex items-center gap-1.5 py-1 px-2.5"
        >
          <AlertTriangle className="h-3.5 w-3.5 text-red-600" />
          <span>Positiva s/ Efeito</span>
        </Badge>
      )
    }

    const isDemonstracao =
      cert.origem === 'automatica' ||
      (cert.numero_controle &&
        (cert.numero_controle.includes('DEMO') || cert.numero_controle.includes('RFB.AUTOSYNC'))) ||
      (cert.observacoes && cert.observacoes.toLowerCase().includes('demonstração'))

    if (isDemonstracao) {
      return (
        <Badge
          variant="outline"
          className="border-amber-400 bg-amber-50 text-amber-900 text-xs font-semibold flex items-center gap-1.5 py-1 px-2.5"
          title="Consulta em modo demonstração — pendente de emissão oficial via webservice e-CAC/RFB"
        >
          <Clock className="h-3.5 w-3.5 text-amber-600" />
          <span>Demonstração / Pendente de Emissão Oficial</span>
        </Badge>
      )
    }

    return (
      <Badge
        variant="outline"
        className="border-slate-200 bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 py-1 px-2.5"
      >
        <Clock className="h-3.5 w-3.5 text-slate-500" />
        <span>Pendente de emissão</span>
      </Badge>
    )
  }

  // Estatísticas de certidões
  const total = certidoes.length
  const validas = certidoes.filter((c) => {
    const s = certidoesService.calcularSaude(c)
    return s.saude === 'valida'
  }).length
  const vencendo = certidoes.filter((c) => {
    const s = certidoesService.calcularSaude(c)
    return s.saude === 'proximo_vencimento'
  }).length
  const vencidas = certidoes.filter((c) => {
    const s = certidoesService.calcularSaude(c)
    return s.saude === 'vencida' || s.saude === 'sem_efeito'
  }).length

  return (
    <div className="space-y-6">
      {/* Cards de Resumo de Saúde */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <Card className="rounded-2xl border-[#E2E8F0] shadow-xs p-4 bg-linear-to-br from-white to-slate-50">
          <p className="text-xs font-semibold text-[#64748B]">Total Monitoradas</p>
          <p className="text-2xl font-bold text-[#1A2333] mt-1">{total}</p>
          <span className="text-[11px] text-[#94A3B8]">Certidões cadastradas</span>
        </Card>

        <Card className="rounded-2xl border-emerald-100 bg-emerald-50/40 shadow-xs p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-emerald-800">Regulares &gt;30d</p>
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-bold text-emerald-700 mt-1">{validas}</p>
          <span className="text-[11px] text-emerald-700">Dentro do prazo de validade</span>
        </Card>

        <Card className="rounded-2xl border-amber-200 bg-amber-50/50 shadow-xs p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-amber-800">Vencendo em ≤30d</p>
            <ShieldAlert className="h-4 w-4 text-amber-600" />
          </div>
          <p className="text-2xl font-bold text-amber-800 mt-1">{vencendo}</p>
          <span className="text-[11px] text-amber-700">Atenção para renovação</span>
        </Card>

        <Card className="rounded-2xl border-red-100 bg-red-50/50 shadow-xs p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-red-800">Vencidas / Irregulares</p>
            <ShieldX className="h-4 w-4 text-red-600" />
          </div>
          <p className="text-2xl font-bold text-red-700 mt-1">{vencidas}</p>
          <span className="text-[11px] text-red-700">Exigem ação imediata</span>
        </Card>
      </div>

      {/* Tabela de Certidões */}
      <Card className="rounded-2xl border-[#E2E8F0] shadow-xs overflow-hidden">
        <CardHeader className="pb-3 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
          <div>
            <CardTitle className="text-sm font-bold text-[#1A2333]">
              Certidões Negativas de Débito (CND / CPEN)
            </CardTitle>
            <CardDescription className="text-xs text-[#64748B]">
              Acompanhamento contínuo perante Receita Federal/PGFN, FGTS/Caixa, Fazenda Estadual,
              Prefeitura e TST.
            </CardDescription>
          </div>

          {canEdit && (
            <Button
              type="button"
              onClick={() => openNewModal()}
              className="gap-2 rounded-xl bg-[#0FA3A3] hover:bg-[#0C8585] text-white font-semibold text-xs h-9 px-4 shadow-xs shrink-0"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Nova Certidão</span>
            </Button>
          )}
        </CardHeader>

        <CardContent className="p-0">
          {certidoes.length === 0 ? (
            <div className="py-12 px-4 text-center space-y-3">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#0FA3A3]/10 text-[#0FA3A3]">
                <FileCheck2 className="h-6 w-6" />
              </div>
              <h4 className="text-sm font-bold text-[#1A2333]">Nenhuma certidão registrada</h4>
              <p className="text-xs text-[#64748B] max-w-md mx-auto">
                Registre as certidões CND/CPEN desta empresa para monitoramento automático de
                vencimento com alertas diários por e-mail e notificações.
              </p>
              {canEdit && (
                <Button
                  type="button"
                  onClick={() => openNewModal()}
                  className="gap-2 rounded-xl bg-[#0FA3A3] hover:bg-[#0C8585] text-white font-semibold text-xs h-9 px-4"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Cadastrar Primeira Certidão</span>
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#E2E8F0] bg-slate-50/75 text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
                    <th className="py-3 px-4">Tipo da Certidão</th>
                    <th className="py-3 px-4">Status & Validade</th>
                    <th className="py-3 px-4">Nº Controle</th>
                    <th className="py-3 px-4">Emissão</th>
                    <th className="py-3 px-4">Validade</th>
                    <th className="py-3 px-4">Origem</th>
                    <th className="py-3 px-4">GED / Anexo</th>
                    {canEdit && <th className="py-3 px-4 text-right">Ações</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {certidoes.map((cert) => (
                    <tr key={cert.id} className="hover:bg-slate-50/75 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-semibold text-[#1A2333]">
                          {certidoesService.getTipoLabel(cert.tipo)}
                        </div>
                        {cert.observacoes && (
                          <p className="text-[11px] text-[#64748B] line-clamp-1 max-w-xs">
                            {cert.observacoes}
                          </p>
                        )}
                      </td>
                      <td className="py-3 px-4">{renderSaudeBadge(cert)}</td>
                      <td className="py-3 px-4 font-mono text-[#64748B]">
                        {cert.numero_controle || '—'}
                      </td>
                      <td className="py-3 px-4 text-[#64748B]">
                        {formatDatePtBr(cert.data_emissao)}
                      </td>
                      <td className="py-3 px-4 font-semibold text-[#1A2333]">
                        {formatDatePtBr(cert.data_validade)}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-col gap-1 items-start">
                          <Badge
                            variant="outline"
                            className={
                              cert.origem === 'automatica'
                                ? 'border-sky-200 bg-sky-50 text-sky-700 text-[10px]'
                                : 'border-slate-200 bg-slate-50 text-slate-700 text-[10px]'
                            }
                          >
                            {cert.origem === 'automatica' ? 'Consulta Auto' : 'Manual / Contador'}
                          </Badge>
                          {cert.origem === 'automatica' && cert.status === 'pendente_emissao' && (
                            <Badge
                              variant="outline"
                              className="border-amber-300 bg-amber-50 text-amber-800 text-[9px] font-medium"
                            >
                              Sem Webservice Real
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        {cert.arquivo_pdf ? (
                          <a
                            href={pb.files.getURL(cert, cert.arquivo_pdf)}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0FA3A3] hover:underline"
                          >
                            <FileText className="h-3.5 w-3.5" />
                            <span>PDF</span>
                          </a>
                        ) : (
                          <span className="text-[11px] text-[#94A3B8]">Sem PDF</span>
                        )}
                      </td>
                      {canEdit && (
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => openEditModal(cert)}
                              className="h-8 w-8 text-[#3B82F6] hover:bg-blue-50"
                              title="Editar certidão"
                            >
                              <Edit className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              disabled={deletingId === cert.id}
                              onClick={() => handleDelete(cert.id)}
                              className="h-8 w-8 text-[#EF4444] hover:bg-red-50"
                              title="Excluir certidão"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal de Cadastro / Edição de Certidão */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="rounded-2xl max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-[#1A2333]">
              {editingCertidao ? 'Editar Certidão Negativa' : 'Nova Certidão Negativa'}
            </DialogTitle>
            <DialogDescription className="text-xs text-[#64748B]">
              Informe os dados da certidão e anexe o comprovante em PDF para o GED contábil.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSave} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-[#1A2333]">
                Órgão / Tipo de Certidão *
              </Label>
              <Select value={tipo} onValueChange={(val: TipoCertidao) => setTipo(val)}>
                <SelectTrigger className="h-10 text-xs rounded-xl border-[#E2E8F0]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="receita_pgfn_cnd">
                    Receita Federal / PGFN (CND Negativa Plena)
                  </SelectItem>
                  <SelectItem value="receita_pgfn_cpen">
                    Receita Federal / PGFN (CPEN Positiva c/ Efeito de Negativa)
                  </SelectItem>
                  <SelectItem value="fgts_crf">FGTS (CRF Caixa Econômica Federal)</SelectItem>
                  <SelectItem value="estadual">Fazenda Estadual (ICMS / SEFAZ)</SelectItem>
                  <SelectItem value="municipal">Prefeitura Municipal (ISS / Alvará)</SelectItem>
                  <SelectItem value="trabalhista_cndt">Justiça do Trabalho (CNDT / TST)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-[#1A2333]">Status da Certidão *</Label>
                <Select value={status} onValueChange={(val: StatusCertidao) => setStatus(val)}>
                  <SelectTrigger className="h-10 text-xs rounded-xl border-[#E2E8F0]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="valida">Válida / Regular</SelectItem>
                    <SelectItem value="pendente_emissao">Pendente de emissão</SelectItem>
                    <SelectItem value="vencida">Vencida</SelectItem>
                    <SelectItem value="positiva_sem_efeito">Positiva sem efeito</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-[#1A2333]">Origem da Emissão</Label>
                <Select value={origem} onValueChange={(val: OrigemCertidao) => setOrigem(val)}>
                  <SelectTrigger className="h-10 text-xs rounded-xl border-[#E2E8F0]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">Emitida manualmente pelo contador</SelectItem>
                    <SelectItem value="automatica">Consultada automaticamente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="num_controle" className="text-xs font-semibold text-[#1A2333]">
                Número de Controle / Código de Autenticidade
              </Label>
              <Input
                id="num_controle"
                value={numeroControle}
                onChange={(e) => setNumeroControle(e.target.value)}
                placeholder="Ex: RFB.2026.883910.BR ou CNDT-99214/2026"
                className="h-10 text-xs font-mono rounded-xl border-[#E2E8F0]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="dt_emissao" className="text-xs font-semibold text-[#1A2333]">
                  Data de Emissão
                </Label>
                <Input
                  id="dt_emissao"
                  type="date"
                  value={dataEmissao}
                  onChange={(e) => setDataEmissao(e.target.value)}
                  className="h-10 text-xs rounded-xl border-[#E2E8F0]"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="dt_validade" className="text-xs font-semibold text-[#1A2333]">
                  Data de Validade *
                </Label>
                <Input
                  id="dt_validade"
                  type="date"
                  required
                  value={dataValidade}
                  onChange={(e) => setDataValidade(e.target.value)}
                  className="h-10 text-xs rounded-xl border-[#E2E8F0]"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-[#1A2333]">
                Arquivo PDF da Certidão (GED)
              </Label>
              <Input
                type="file"
                accept=".pdf,application/pdf"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    setArquivoPdf(e.target.files[0])
                  }
                }}
                className="h-10 text-xs rounded-xl border-[#E2E8F0] bg-white file:mr-2 file:py-1 file:px-2 file:rounded-md file:border-0 file:text-[11px] file:bg-[#0FA3A3]/10 file:text-[#0FA3A3]"
              />
              {editingCertidao?.arquivo_pdf && !arquivoPdf && (
                <p className="text-[11px] text-emerald-700 flex items-center gap-1">
                  <span>Arquivo atual: {editingCertidao.arquivo_pdf}</span>
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="obs_cert" className="text-xs font-semibold text-[#1A2333]">
                Observações / Detalhes de Débitos
              </Label>
              <Textarea
                id="obs_cert"
                rows={2}
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                placeholder="Ex: Parcelamento ativo, certidão emitida com pendência de débitos estaduais suspensos..."
                className="text-xs rounded-xl border-[#E2E8F0]"
              />
            </div>

            <DialogFooter className="gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setModalOpen(false)}
                className="text-xs rounded-xl h-9"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={saving}
                className="gap-2 rounded-xl bg-[#0FA3A3] hover:bg-[#0C8585] text-white font-semibold text-xs h-9 px-5 shadow-xs"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Salvando...</span>
                  </>
                ) : (
                  <span>Salvar Certidão</span>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
