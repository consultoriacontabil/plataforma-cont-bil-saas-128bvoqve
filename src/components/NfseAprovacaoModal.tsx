import React, { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sparkles,
  AlertTriangle,
  CheckCircle,
  FileText,
  DollarSign,
  Send,
  Loader2,
  Building2,
  ShieldAlert,
  Radio,
  CheckCircle2,
} from 'lucide-react'
import type { NfseSolicitacaoRecord, Empresa, NfseConfigRecord } from '@/types'
import { isValidCnpj, isValidCpf, maskCnpj, maskCpf } from '@/lib/formatters'
import { nfseWhatsappService } from '@/services/nfseWhatsapp'
import { useToast } from '@/hooks/use-toast'

interface NfseAprovacaoModalProps {
  solicitacao: NfseSolicitacaoRecord | null
  empresas: Empresa[]
  config?: NfseConfigRecord | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
  currentUserId?: string
}

export const NfseAprovacaoModal: React.FC<NfseAprovacaoModalProps> = ({
  solicitacao,
  empresas,
  config,
  open,
  onOpenChange,
  onSuccess,
  currentUserId,
}) => {
  const { toast } = useToast()

  const [empresaId, setEmpresaId] = useState<string>('')
  const [tomadorNome, setTomadorNome] = useState('')
  const [tomadorDocumento, setTomadorDocumento] = useState('')
  const [tomadorEmail, setTomadorEmail] = useState('')
  const [tomadorEndereco, setTomadorEndereco] = useState('')
  const [descricaoServicos, setDescricaoServicos] = useState('')
  const [codigoServico, setCodigoServico] = useState('01.07')
  const [valorServicos, setValorServicos] = useState<number>(0)
  const [aliquotaIss, setAliquotaIss] = useState<number>(2.0)
  const [issRetido, setIssRetido] = useState<boolean>(false)
  const [gerarTituloReceber, setGerarTituloReceber] = useState<boolean>(true)
  const [dataVencimentoTitulo, setDataVencimentoTitulo] = useState<string>('')

  const [emitindo, setEmitindo] = useState(false)

  // Sincronizar campos quando a solicitação abrir
  React.useEffect(() => {
    if (solicitacao) {
      setEmpresaId(solicitacao.empresa || (empresas.length > 0 ? empresas[0].id : ''))
      setTomadorNome(solicitacao.tomador_nome || '')
      setTomadorDocumento(solicitacao.tomador_documento || '')
      setTomadorEmail(solicitacao.tomador_email || '')
      setTomadorEndereco(solicitacao.tomador_endereco || '')
      setDescricaoServicos(solicitacao.descricao_servico || '')
      setCodigoServico(solicitacao.codigo_servico || '01.07')
      setValorServicos(solicitacao.valor_servico || 0)
      setAliquotaIss(2.0)
      setIssRetido(false)
      setGerarTituloReceber(true)

      const venc = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      setDataVencimentoTitulo(venc)
    }
  }, [solicitacao, empresas])

  if (!solicitacao) return null

  // Validação em tempo real do documento
  const cleanDoc = tomadorDocumento.replace(/\D/g, '')
  const docValido =
    cleanDoc.length === 11
      ? isValidCpf(cleanDoc)
      : cleanDoc.length === 14
        ? isValidCnpj(cleanDoc)
        : false

  const valorLiquidoEstimado = valorServicos - (issRetido ? (valorServicos * aliquotaIss) / 100 : 0)

  const isProducaoGov =
    config?.modo_operacao === 'producao' &&
    !!(config?.govbr_client_id && config?.govbr_client_secret)

  const handleEmitir = async () => {
    if (!empresaId) {
      toast({
        title: 'Selecione a empresa prestadora',
        description: 'Vincule a empresa emissora da nota fiscal.',
        variant: 'destructive',
      })
      return
    }

    if (!tomadorNome.trim() || !tomadorDocumento.trim() || valorServicos <= 0) {
      toast({
        title: 'Dados incompletos',
        description: 'Preencha Tomador, CPF/CNPJ e um valor maior que zero.',
        variant: 'destructive',
      })
      return
    }

    if (!docValido) {
      toast({
        title: 'Documento do tomador inválido',
        description: 'O CPF ou CNPJ informado não possui dígito verificador válido.',
        variant: 'destructive',
      })
      return
    }

    setEmitindo(true)
    try {
      await nfseWhatsappService.emitirNfse(
        solicitacao.tenant_id,
        {
          solicitacao_id: solicitacao.id,
          empresa_id: empresaId,
          tomador_nome: tomadorNome.trim(),
          tomador_documento: tomadorDocumento.trim(),
          tomador_email: tomadorEmail.trim(),
          tomador_endereco: tomadorEndereco.trim(),
          descricao_servicos: descricaoServicos.trim(),
          codigo_servico_municipal: codigoServico,
          valor_servicos: valorServicos,
          aliquota_iss: aliquotaIss,
          iss_retido: issRetido,
          criar_titulo_receber: gerarTituloReceber,
          data_vencimento_titulo: dataVencimentoTitulo,
        },
        currentUserId || 'system',
      )

      toast({
        title: isProducaoGov
          ? 'NFS-e emitida com sucesso no Gov.br!'
          : 'NFS-e emitida com sucesso (Modo Simulação)!',
        description:
          'A nota fiscal foi gerada, guardada no GED e a confirmação com o link oficial enviada ao WhatsApp do cliente.',
      })
      onSuccess()
      onOpenChange(false)
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err)
      toast({
        title: 'Falha na transmissão da NFS-e',
        description: errMsg,
        variant: 'destructive',
      })
      onSuccess() // atualiza a fila para refletir o status de erro_emissao
    } finally {
      setEmitindo(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#0FA3A3] text-white text-xs font-bold">
                5
              </span>
              <DialogTitle className="text-lg font-bold text-[#1A2333]">
                Revisar & Emitir NFS-e (API Engine Fiscal)
              </DialogTitle>
            </div>
            <Badge
              className={
                isProducaoGov
                  ? 'bg-emerald-600 text-white text-[10px]'
                  : 'bg-amber-600 text-white text-[10px]'
              }
            >
              {isProducaoGov ? 'PRODUÇÃO — GOV.BR' : 'SIMULAÇÃO CONTROLADA'}
            </Badge>
          </div>
          <DialogDescription className="text-xs text-[#64748B]">
            Etapa 5 do Framework: Valide os dados extraídos pelo Motor Cognitivo IA, ajuste se
            necessário e acione a transmissão para o Provedor Fiscal Ativo (Gov.br / Betha / Ginfes)
            ou Simulação.
          </DialogDescription>
        </DialogHeader>

        {/* Comparador: Mensagem Original vs Dados Extraídos */}
        <div className="space-y-4 my-2">
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 text-xs">
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-bold text-[#1A2333] flex items-center gap-1.5">
                <FileText className="h-4 w-4 text-[#0FA3A3]" />
                Etapa 1: Mensagem Original Recebida via WhatsApp
              </span>
              <Badge variant="outline" className="text-[10px] bg-white">
                De: {solicitacao.contato_nome} ({solicitacao.contato_telefone})
              </Badge>
            </div>
            <p className="italic text-[#475569] bg-white p-2.5 rounded-lg border border-slate-200 whitespace-pre-wrap">
              &quot;{solicitacao.mensagem_original}&quot;
            </p>
          </div>

          {/* Alertas de erro prévio se houver */}
          {solicitacao.ultimo_erro_emissao && (
            <div className="rounded-xl border border-rose-200 bg-rose-50/80 p-3 space-y-1">
              <div className="flex items-center gap-2 text-xs font-bold text-rose-800">
                <ShieldAlert className="h-4 w-4 text-rose-600" />
                Retentativa: Motivo do Erro na Última Transmissão:
              </div>
              <p className="text-xs text-rose-900">{solicitacao.ultimo_erro_emissao}</p>
              <div className="text-[11px] text-rose-700">
                Tentativas realizadas: <strong>{solicitacao.tentativas_emissao || 1}</strong>. A
                solicitação foi preservada na fila para retentativa.
              </div>
            </div>
          )}

          {/* Alertas do Motor Cognitivo se houver */}
          {solicitacao.alertas_json && solicitacao.alertas_json.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-800">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                Alertas Identificados na Extração da IA:
              </div>
              <ul className="text-xs text-amber-900 space-y-1 pl-4 list-disc">
                {solicitacao.alertas_json.map((al, idx) => (
                  <li key={idx}>
                    <strong>{al.campo ? `${al.campo}: ` : ''}</strong>
                    {al.mensagem}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Formulário de Conferência e Emissão */}
          <div className="border border-slate-200 rounded-xl p-4 bg-white space-y-4">
            <div className="flex items-center justify-between border-b pb-2">
              <span className="text-xs font-bold text-[#1A2333] uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-[#0FA3A3]" />
                Etapa 2 & 4: Dados Estruturados da NFS-e
              </span>
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-[#64748B]">Score de Confiança IA:</span>
                <Badge
                  className={
                    solicitacao.score_confianca >= 85
                      ? 'bg-emerald-100 text-emerald-800'
                      : solicitacao.score_confianca >= 60
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-rose-100 text-rose-800'
                  }
                >
                  {solicitacao.score_confianca}%
                </Badge>
              </div>
            </div>

            {/* Empresa Prestadora */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-[#1A2333]">
                Empresa Prestadora (Emitente) *
              </Label>
              <Select value={empresaId} onValueChange={setEmpresaId}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Selecione a empresa prestadora" />
                </SelectTrigger>
                <SelectContent>
                  {empresas.map((emp) => (
                    <SelectItem key={emp.id} value={emp.id} className="text-xs">
                      {emp.razao_social} ({emp.cnpj ? maskCnpj(emp.cnpj) : 'Sem CNPJ'})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Tomador e Documento */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-[#1A2333]">
                  Razão Social / Nome do Tomador *
                </Label>
                <Input
                  value={tomadorNome}
                  onChange={(e) => setTomadorNome(e.target.value)}
                  className="h-9 text-xs"
                  placeholder="Nome do cliente ou empresa"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-medium text-[#1A2333]">
                    CPF ou CNPJ do Tomador *
                  </Label>
                  {cleanDoc.length > 0 && (
                    <span
                      className={`text-[10px] font-bold flex items-center gap-1 ${
                        docValido ? 'text-emerald-600' : 'text-rose-600'
                      }`}
                    >
                      {docValido ? (
                        <>
                          <CheckCircle className="h-3 w-3" /> Válido
                        </>
                      ) : (
                        <>
                          <ShieldAlert className="h-3 w-3" /> Dígito Inválido
                        </>
                      )}
                    </span>
                  )}
                </div>
                <Input
                  value={tomadorDocumento}
                  onChange={(e) => {
                    const raw = e.target.value
                    const digits = raw.replace(/\D/g, '')
                    if (digits.length <= 11) {
                      setTomadorDocumento(maskCpf(raw))
                    } else {
                      setTomadorDocumento(maskCnpj(raw))
                    }
                  }}
                  className={`h-9 text-xs ${
                    cleanDoc.length > 0 && !docValido ? 'border-rose-400 focus:border-rose-500' : ''
                  }`}
                  placeholder="00.000.000/0000-00 ou 000.000.000-00"
                />
              </div>
            </div>

            {/* Email e Endereço */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-[#1A2333]">E-mail para Envio</Label>
                <Input
                  type="email"
                  value={tomadorEmail}
                  onChange={(e) => setTomadorEmail(e.target.value)}
                  className="h-9 text-xs"
                  placeholder="faturamento@cliente.com.br"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-[#1A2333]">Endereço do Tomador</Label>
                <Input
                  value={tomadorEndereco}
                  onChange={(e) => setTomadorEndereco(e.target.value)}
                  className="h-9 text-xs"
                  placeholder="Rua, Número, Bairro, Cidade - UF"
                />
              </div>
            </div>

            {/* Descrição do Serviço */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-[#1A2333]">
                Discriminação dos Serviços Prestados *
              </Label>
              <Textarea
                rows={3}
                value={descricaoServicos}
                onChange={(e) => setDescricaoServicos(e.target.value)}
                className="text-xs"
                placeholder="Detalhes dos serviços prestados..."
              />
            </div>

            {/* Valores e Tributos */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-[#1A2333]">
                  Valor dos Serviços (R$) *
                </Label>
                <div className="relative">
                  <DollarSign className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#94A3B8]" />
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={valorServicos || ''}
                    onChange={(e) => setValorServicos(parseFloat(e.target.value) || 0)}
                    className="h-9 pl-8 text-xs font-bold text-[#1A2333]"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-[#1A2333]">
                  Código de Serviço (LC 116)
                </Label>
                <Input
                  value={codigoServico}
                  onChange={(e) => setCodigoServico(e.target.value)}
                  className="h-9 text-xs font-mono"
                  placeholder="01.07"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-[#1A2333]">Alíquota ISS (%)</Label>
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  max="5"
                  value={aliquotaIss}
                  onChange={(e) => setAliquotaIss(parseFloat(e.target.value) || 0)}
                  className="h-9 text-xs font-mono"
                />
              </div>
            </div>

            {/* Opções de Integração Financeira */}
            <div className="rounded-lg bg-teal-50/60 border border-teal-200 p-3 space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="gerar-titulo"
                  checked={gerarTituloReceber}
                  onCheckedChange={(checked) => setGerarTituloReceber(!!checked)}
                />
                <label
                  htmlFor="gerar-titulo"
                  className="text-xs font-semibold text-[#0B1F3A] cursor-pointer"
                >
                  Gerar automaticamente Título a Receber no Módulo Financeiro
                </label>
              </div>

              {gerarTituloReceber && (
                <div className="flex items-center gap-3 pl-6">
                  <Label className="text-xs text-[#64748B]">Data de Vencimento:</Label>
                  <Input
                    type="date"
                    value={dataVencimentoTitulo}
                    onChange={(e) => setDataVencimentoTitulo(e.target.value)}
                    className="h-8 w-44 text-xs bg-white"
                  />
                  <span className="text-xs text-[#0FA3A3] font-bold">
                    Valor: R$ {valorLiquidoEstimado.toFixed(2)}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="flex items-center justify-between sm:justify-between w-full pt-2">
          <div className="flex items-center gap-2 text-xs text-[#64748B]">
            <Badge
              variant="outline"
              className={
                isProducaoGov
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : 'bg-amber-50 text-amber-700 border-amber-200'
              }
            >
              {isProducaoGov ? 'Produção Gov.br Ativa' : 'Modo Simulação Controlada'}
            </Badge>
            <span className="hidden sm:inline">
              {isProducaoGov
                ? 'Emissão transmitida ao Provedor Fiscal com arquivamento no GED.'
                : 'Validação ABRASF local e simulação segura com geração de XML/PDF.'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={emitindo}
              className="text-xs"
            >
              Cancelar
            </Button>

            <Button
              size="sm"
              onClick={handleEmitir}
              disabled={emitindo || !docValido || valorServicos <= 0}
              className="bg-[#0FA3A3] hover:bg-[#0d8c8c] text-white text-xs gap-1.5 shadow-sm"
            >
              {emitindo ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Emitindo NFS-e...
                </>
              ) : (
                <>
                  <Send className="h-3.5 w-3.5" />
                  {solicitacao.status === 'erro_emissao'
                    ? 'Retentar Emissão de NFS-e'
                    : 'Aprovar & Emitir NFS-e'}
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
