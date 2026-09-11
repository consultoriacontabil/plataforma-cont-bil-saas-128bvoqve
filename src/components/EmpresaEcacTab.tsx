import React, { useState } from 'react'
import {
  Inbox,
  AlertTriangle,
  Plus,
  FileText,
  Calendar,
  CheckCircle2,
  Clock,
  Eye,
  Mail,
  MailOpen,
  Info,
  ShieldCheck,
  ShieldAlert,
  Loader2,
  Trash2,
  Download,
  AlertCircle,
  ExternalLink,
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
import { ecacService } from '@/services/regularidade'
import type {
  EcacComunicacaoRecord,
  TipoComunicacaoEcac,
  CriticidadeEcac,
  OrigemCapturaEcac,
} from '@/types'
import { formatDatePtBr } from '@/lib/formatters'
import pb from '@/lib/pocketbase/client'
import { useToast } from '@/hooks/use-toast'

interface EmpresaEcacTabProps {
  empresaId: string
  tenantId: string
  canEdit: boolean
  comunicacoes: EcacComunicacaoRecord[]
  temCertificadoA1: boolean
  onRefresh: () => Promise<void>
}

export function EmpresaEcacTab({
  empresaId,
  tenantId,
  canEdit,
  comunicacoes,
  temCertificadoA1,
  onRefresh,
}: EmpresaEcacTabProps) {
  const { toast } = useToast()

  const [modalOpen, setModalOpen] = useState(false)
  const [detalhesModalOpen, setDetalhesModalOpen] = useState(false)
  const [selecionada, setSelecionada] = useState<EcacComunicacaoRecord | null>(null)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Form State
  const [tipo, setTipo] = useState<TipoComunicacaoEcac>('intimacao_fiscal')
  const [assunto, setAssunto] = useState('')
  const [conteudo, setConteudo] = useState('')
  const [dataComunicacao, setDataComunicacao] = useState(new Date().toISOString().split('T')[0])
  const [dataLimiteResposta, setDataLimiteResposta] = useState('')
  const [criticidade, setCriticidade] = useState<CriticidadeEcac>('alta')
  const [numeroProcesso, setNumeroProcesso] = useState('')
  const [anexoFile, setAnexoFile] = useState<File | null>(null)

  const openNewModal = () => {
    setTipo('intimacao_fiscal')
    setAssunto('')
    setConteudo('')
    setDataComunicacao(new Date().toISOString().split('T')[0])
    // Prazo resposta sugerido: 30 dias
    const dtPrazo = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]
    setDataLimiteResposta(dtPrazo)
    setCriticidade('alta')
    setNumeroProcesso('')
    setAnexoFile(null)
    setModalOpen(true)
  }

  const openDetalhesModal = async (msg: EcacComunicacaoRecord) => {
    setSelecionada(msg)
    setDetalhesModalOpen(true)
    // Marcar como lida se ainda não estiver
    if (!msg.lida) {
      try {
        await ecacService.marcarComoLida(msg.id, true)
        await onRefresh()
      } catch (err) {
        console.error('Erro ao marcar como lida:', err)
      }
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!assunto.trim()) {
      toast({
        variant: 'destructive',
        title: 'Assunto obrigatório',
        description: 'Descreva resumidamente o assunto da comunicação E-CAC.',
      })
      return
    }

    setSaving(true)
    try {
      const formData = new FormData()
      formData.append('tenant_id', tenantId)
      formData.append('empresa', empresaId)
      formData.append('tipo', tipo)
      formData.append('assunto', assunto)
      if (conteudo) formData.append('conteudo', conteudo)
      formData.append('data_comunicacao', new Date(`${dataComunicacao}T12:00:00Z`).toISOString())
      if (dataLimiteResposta) {
        formData.append(
          'data_limite_resposta',
          new Date(`${dataLimiteResposta}T12:00:00Z`).toISOString(),
        )
      }
      formData.append('lida', 'false')
      formData.append('criticidade', criticidade)
      if (numeroProcesso) formData.append('numero_processo', numeroProcesso)
      formData.append('origem_captura', 'manual_supervisionado')
      if (anexoFile) {
        formData.append('anexo', anexoFile)
      }

      await ecacService.save(null, formData)

      toast({
        title: 'Comunicação registrada!',
        description:
          'A mensagem da Caixa Postal E-CAC foi salva no Modo Supervisionado com sucesso.',
      })

      setModalOpen(false)
      await onRefresh()
    } catch (err: unknown) {
      console.error('Erro ao salvar comunicação E-CAC:', err)
      const msg = err instanceof Error ? err.message : 'Falha ao registrar comunicação.'
      toast({
        variant: 'destructive',
        title: 'Erro ao gravar comunicação',
        description: msg,
      })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('Tem certeza que deseja excluir esta comunicação da caixa postal?')) return
    setDeletingId(id)
    try {
      await ecacService.delete(id)
      toast({
        title: 'Comunicação removida',
        description: 'O registro foi excluído da caixa postal.',
      })
      await onRefresh()
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Erro ao excluir',
        description: 'Não foi possível remover o registro.',
      })
    } finally {
      setDeletingId(null)
    }
  }

  const handleToggleLida = async (msg: EcacComunicacaoRecord, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await ecacService.marcarComoLida(msg.id, !msg.lida)
      toast({
        title: !msg.lida ? 'Marcada como lida' : 'Marcada como não lida',
      })
      await onRefresh()
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Erro ao atualizar status',
      })
    }
  }

  const renderCriticidadeBadge = (crit: CriticidadeEcac) => {
    switch (crit) {
      case 'alta':
        return (
          <Badge
            variant="outline"
            className="border-red-200 bg-red-50 text-red-700 text-xs font-semibold flex items-center gap-1 py-0.5 px-2"
          >
            <AlertTriangle className="h-3 w-3 text-red-600" />
            <span>Alta Criticidade</span>
          </Badge>
        )
      case 'media':
        return (
          <Badge
            variant="outline"
            className="border-amber-200 bg-amber-50 text-amber-800 text-xs font-semibold flex items-center gap-1 py-0.5 px-2"
          >
            <Clock className="h-3 w-3 text-amber-600" />
            <span>Média</span>
          </Badge>
        )
      case 'baixa':
      default:
        return (
          <Badge
            variant="outline"
            className="border-slate-200 bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1 py-0.5 px-2"
          >
            <Info className="h-3 w-3 text-slate-500" />
            <span>Informativo</span>
          </Badge>
        )
    }
  }

  const totalNaoLidas = comunicacoes.filter((c) => !c.lida).length
  const totalAltas = comunicacoes.filter((c) => !c.lida && c.criticidade === 'alta').length

  return (
    <div className="space-y-6">
      {/* Banner de Transparência Honesta: Modo Supervisionado vs. Ativo com Certificado A1 */}
      <Card className="rounded-2xl border-sky-200 bg-sky-50/60 p-4 shadow-xs">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-xl bg-sky-100 text-[#0B1F3A] flex items-center justify-center shrink-0 mt-0.5">
              <Inbox className="h-5 w-5 text-[#0FA3A3]" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h4 className="text-xs font-bold text-[#0B1F3A]">
                  Monitor da Caixa Postal E-CAC —{' '}
                  <span className="text-[#0FA3A3]">Modo Supervisionado Ativo</span>
                </h4>
                <Badge
                  variant="outline"
                  className="bg-white border-sky-300 text-sky-800 text-[10px] font-semibold"
                >
                  Supervisionado
                </Badge>
              </div>
              <p className="text-[11px] text-[#475569] leading-relaxed max-w-3xl">
                A varredura direta via webservice da Receita Federal exige o certificado e-CNPJ A1
                da empresa com procuração eletrônica no portal e-CAC. Enquanto as credenciais de
                conexão direta da RFB não estiverem ativas, o sistema opera no{' '}
                <b>Modo Supervisionado</b>: o contador registra ou cola as comunicações e o sistema
                assume o controle automático de prazos, severidade de resposta e notificações aos
                administradores. O conector está preparado para vincular o certificado A1 já
                cadastrado sem refatoração.
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:items-end gap-1 shrink-0">
            {temCertificadoA1 ? (
              <Badge className="bg-emerald-100 text-emerald-800 border border-emerald-300 text-[11px] font-semibold flex items-center gap-1.5 py-1 px-3">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                <span>Certificado A1 Vinculado</span>
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className="bg-white text-slate-600 border-slate-300 text-[11px] flex items-center gap-1.5 py-1 px-3"
              >
                <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
                <span>Sem Certificado A1 Vinculado</span>
              </Badge>
            )}
            <span className="text-[10px] text-[#64748B]">Conector RFB pronto para sincronismo</span>
          </div>
        </div>
      </Card>

      {/* Resumo de Comunicações */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="rounded-2xl border-[#E2E8F0] shadow-xs p-4 bg-linear-to-br from-white to-slate-50">
          <p className="text-xs font-semibold text-[#64748B]">Total de Comunicações</p>
          <p className="text-2xl font-bold text-[#1A2333] mt-1">{comunicacoes.length}</p>
          <span className="text-[11px] text-[#94A3B8]">Recebidas no Domicílio Tributário</span>
        </Card>

        <Card className="rounded-2xl border-amber-200 bg-amber-50/50 shadow-xs p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-amber-800">Não Lidas / Pendentes</p>
            <Mail className="h-4 w-4 text-amber-600" />
          </div>
          <p className="text-2xl font-bold text-amber-800 mt-1">{totalNaoLidas}</p>
          <span className="text-[11px] text-amber-700">Aguardando análise contábil</span>
        </Card>

        <Card className="rounded-2xl border-red-200 bg-red-50/50 shadow-xs p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-red-800">Criticidade Alta (Não Lidas)</p>
            <AlertTriangle className="h-4 w-4 text-red-600" />
          </div>
          <p className="text-2xl font-bold text-red-700 mt-1">{totalAltas}</p>
          <span className="text-[11px] text-red-700">Intimações ou risco de exclusão</span>
        </Card>
      </div>

      {/* Listagem de Mensagens E-CAC */}
      <Card className="rounded-2xl border-[#E2E8F0] shadow-xs overflow-hidden">
        <CardHeader className="pb-3 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
          <div>
            <CardTitle className="text-sm font-bold text-[#1A2333]">
              Caixa Postal Fiscal (DTE / e-CAC)
            </CardTitle>
            <CardDescription className="text-xs text-[#64748B]">
              Intimações, termos de exclusão, notificações de lançamento e avisos de cobrança da RFB
            </CardDescription>
          </div>

          {canEdit && (
            <Button
              type="button"
              onClick={openNewModal}
              className="gap-2 rounded-xl bg-[#0FA3A3] hover:bg-[#0C8585] text-white font-semibold text-xs h-9 px-4 shadow-xs shrink-0"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Registrar Comunicação E-CAC</span>
            </Button>
          )}
        </CardHeader>

        <CardContent className="p-0">
          {comunicacoes.length === 0 ? (
            <div className="py-12 px-4 text-center space-y-3">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-100 text-sky-700">
                <Inbox className="h-6 w-6" />
              </div>
              <h4 className="text-sm font-bold text-[#1A2333]">Caixa postal zerada</h4>
              <p className="text-xs text-[#64748B] max-w-md mx-auto">
                Nenhuma comunicação ou notificação da Receita Federal registrada para esta empresa
                até o momento.
              </p>
              {canEdit && (
                <Button
                  type="button"
                  onClick={openNewModal}
                  className="gap-2 rounded-xl bg-[#0FA3A3] hover:bg-[#0C8585] text-white font-semibold text-xs h-9 px-4"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Registrar Primeira Comunicação</span>
                </Button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {comunicacoes.map((item) => (
                <div
                  key={item.id}
                  onClick={() => openDetalhesModal(item)}
                  className={`p-4 transition-colors cursor-pointer hover:bg-slate-50/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    !item.lida ? 'bg-sky-50/30' : ''
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <button
                      type="button"
                      onClick={(e) => handleToggleLida(item, e)}
                      title={item.lida ? 'Marcar como não lida' : 'Marcar como lida'}
                      className="mt-0.5 text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      {item.lida ? (
                        <MailOpen className="h-4 w-4 text-slate-400" />
                      ) : (
                        <Mail className="h-4 w-4 text-[#0FA3A3]" />
                      )}
                    </button>

                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`text-xs font-bold ${
                            !item.lida ? 'text-[#1A2333]' : 'text-slate-600 font-medium'
                          }`}
                        >
                          {item.assunto}
                        </span>
                        {!item.lida && (
                          <Badge className="bg-[#0FA3A3] text-white text-[10px] font-semibold py-0 px-2 h-4">
                            Nova
                          </Badge>
                        )}
                        {renderCriticidadeBadge(item.criticidade)}
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-[11px] text-[#64748B]">
                        <span>
                          Tipo: <b>{ecacService.getTipoLabel(item.tipo)}</b>
                        </span>
                        {item.numero_processo && (
                          <span>
                            Processo: <b className="font-mono">{item.numero_processo}</b>
                          </span>
                        )}
                        <span>Recebida em: {formatDatePtBr(item.data_comunicacao)}</span>
                        {item.data_limite_resposta && (
                          <span className="text-red-700 font-medium">
                            Prazo de resposta: {formatDatePtBr(item.data_limite_resposta)}
                          </span>
                        )}
                      </div>

                      {item.conteudo && (
                        <p className="text-xs text-[#64748B] line-clamp-2 max-w-2xl">
                          {item.conteudo}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center">
                    {item.anexo && (
                      <a
                        href={pb.files.getURL(item, item.anexo)}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1 text-xs text-[#0FA3A3] hover:underline px-2 py-1 rounded-lg hover:bg-slate-100"
                        title="Baixar anexo"
                      >
                        <Download className="h-3.5 w-3.5" />
                        <span>Anexo</span>
                      </a>
                    )}

                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => openDetalhesModal(item)}
                      className="text-xs h-8 text-[#0FA3A3] hover:text-[#0C8585]"
                    >
                      <Eye className="h-3.5 w-3.5 mr-1" />
                      <span>Ver detalhes</span>
                    </Button>

                    {canEdit && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        disabled={deletingId === item.id}
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDelete(item.id)
                        }}
                        className="h-8 w-8 text-red-500 hover:bg-red-50"
                        title="Excluir comunicação"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal: Registrar Comunicação */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="rounded-2xl max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-[#1A2333]">
              Registrar Comunicação da Caixa Postal E-CAC
            </DialogTitle>
            <DialogDescription className="text-xs text-[#64748B]">
              Cole o conteúdo do despacho ou notificação recebida no e-CAC para controle de prazos e
              histórico fiscal.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSave} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-[#1A2333]">Tipo da Comunicação *</Label>
              <Select
                value={tipo}
                onValueChange={(val: TipoComunicacaoEcac) => {
                  setTipo(val)
                  if (val === 'exclusao_simples' || val === 'intimacao_fiscal') {
                    setCriticidade('alta')
                  }
                }}
              >
                <SelectTrigger className="h-10 text-xs rounded-xl border-[#E2E8F0]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="intimacao_fiscal">Intimação Fiscal</SelectItem>
                  <SelectItem value="notificacao_lancamento">Notificação de Lançamento</SelectItem>
                  <SelectItem value="pendencia_cadastral">Pendência Cadastral / DIPJ</SelectItem>
                  <SelectItem value="exclusao_simples">
                    Termo de Exclusão do Simples Nacional
                  </SelectItem>
                  <SelectItem value="cobranca_parcelamento">Cobrança / Parcelamento</SelectItem>
                  <SelectItem value="aviso_geral">Aviso Geral / Informativo</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="assunto" className="text-xs font-semibold text-[#1A2333]">
                Assunto da Mensagem *
              </Label>
              <Input
                id="assunto"
                required
                value={assunto}
                onChange={(e) => setAssunto(e.target.value)}
                placeholder="Ex: Termo de Intimação Fiscal nº 2026/0192 ou Aviso de Cobrança"
                className="h-10 text-xs rounded-xl border-[#E2E8F0]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-[#1A2333]">Criticidade *</Label>
                <Select
                  value={criticidade}
                  onValueChange={(val: CriticidadeEcac) => setCriticidade(val)}
                >
                  <SelectTrigger className="h-10 text-xs rounded-xl border-[#E2E8F0]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="alta">
                      Alta (Risco de Exclusão / Bloqueio / Multa)
                    </SelectItem>
                    <SelectItem value="media">Média (Aviso de Cobrança / Notificação)</SelectItem>
                    <SelectItem value="baixa">Baixa (Informativo Geral / Recibo)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="num_proc" className="text-xs font-semibold text-[#1A2333]">
                  Número do Processo / Dossiê
                </Label>
                <Input
                  id="num_proc"
                  value={numeroProcesso}
                  onChange={(e) => setNumeroProcesso(e.target.value)}
                  placeholder="Ex: 10980.720349/2026-11"
                  className="h-10 text-xs font-mono rounded-xl border-[#E2E8F0]"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="dt_com" className="text-xs font-semibold text-[#1A2333]">
                  Data da Mensagem *
                </Label>
                <Input
                  id="dt_com"
                  type="date"
                  required
                  value={dataComunicacao}
                  onChange={(e) => setDataComunicacao(e.target.value)}
                  className="h-10 text-xs rounded-xl border-[#E2E8F0]"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="dt_lim" className="text-xs font-semibold text-[#1A2333]">
                  Prazo Limite para Resposta / Defesa
                </Label>
                <Input
                  id="dt_lim"
                  type="date"
                  value={dataLimiteResposta}
                  onChange={(e) => setDataLimiteResposta(e.target.value)}
                  className="h-10 text-xs rounded-xl border-[#E2E8F0]"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="conteudo" className="text-xs font-semibold text-[#1A2333]">
                Teor do Despacho / Comunicação
              </Label>
              <Textarea
                id="conteudo"
                rows={3}
                value={conteudo}
                onChange={(e) => setConteudo(e.target.value)}
                placeholder="Cole aqui o texto da notificação ou despacho recebido no e-CAC..."
                className="text-xs rounded-xl border-[#E2E8F0]"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-[#1A2333]">
                Anexo PDF / Documento Oficial
              </Label>
              <Input
                type="file"
                accept=".pdf,.zip,image/*"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    setAnexoFile(e.target.files[0])
                  }
                }}
                className="h-10 text-xs rounded-xl border-[#E2E8F0] bg-white file:mr-2 file:py-1 file:px-2 file:rounded-md file:border-0 file:text-[11px] file:bg-[#0FA3A3]/10 file:text-[#0FA3A3]"
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
                  <span>Registrar Mensagem</span>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal: Detalhes da Mensagem Selecionada */}
      <Dialog open={detalhesModalOpen} onOpenChange={setDetalhesModalOpen}>
        <DialogContent className="rounded-2xl max-w-xl">
          <DialogHeader>
            <div className="flex items-center gap-2">
              {selecionada && renderCriticidadeBadge(selecionada.criticidade)}
              <span className="text-xs text-[#64748B]">
                {selecionada && ecacService.getTipoLabel(selecionada.tipo)}
              </span>
            </div>
            <DialogTitle className="text-base font-bold text-[#1A2333] mt-1">
              {selecionada?.assunto}
            </DialogTitle>
            <DialogDescription className="text-xs text-[#64748B]">
              Recebida em: {selecionada && formatDatePtBr(selecionada.data_comunicacao)}
              {selecionada?.numero_processo && (
                <>
                  {' '}
                  • Processo: <b className="font-mono">{selecionada.numero_processo}</b>
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          {selecionada && (
            <div className="space-y-4 pt-2 text-xs">
              {selecionada.data_limite_resposta && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-red-900 flex items-start gap-2.5">
                  <AlertTriangle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-xs">Atenção ao Prazo de Manifestação</p>
                    <p className="text-[11px] text-red-800">
                      Data limite para defesa ou regularização:{' '}
                      <b>{formatDatePtBr(selecionada.data_limite_resposta)}</b>.
                    </p>
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <span className="text-xs font-semibold text-[#1A2333]">Teor do Despacho:</span>
                <div className="rounded-xl bg-slate-50 border border-slate-200/70 p-3.5 text-xs text-slate-800 leading-relaxed max-h-60 overflow-y-auto whitespace-pre-line font-mono text-[11px]">
                  {selecionada.conteudo || 'Sem conteúdo adicional transcrito.'}
                </div>
              </div>

              {selecionada.anexo && (
                <div className="pt-2 flex items-center justify-between border-t border-slate-100">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-[#0FA3A3]" />
                    <span className="font-mono text-xs text-[#1A2333]">{selecionada.anexo}</span>
                  </div>
                  <a
                    href={pb.files.getURL(selecionada, selecionada.anexo)}
                    download
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0FA3A3] hover:underline"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>Baixar Documento</span>
                  </a>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="pt-2">
            <Button
              type="button"
              onClick={() => setDetalhesModalOpen(false)}
              className="text-xs rounded-xl h-9 px-4 bg-[#0FA3A3] hover:bg-[#0C8585] text-white"
            >
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
