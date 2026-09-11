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
  AlertTriangle,
  Ban,
  Building2,
  FileText,
  Loader2,
  RefreshCw,
  Send,
  ShieldAlert,
  Clock,
  DollarSign,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react'
import type { NfseNotaEmitidaRecord, Empresa, NfseConfigRecord } from '@/types'
import { CODIGOS_CANCELAMENTO_OFICIAIS } from '@/services/fiscalAdapters'
import { nfseWhatsappService } from '@/services/nfseWhatsapp'
import { useToast } from '@/hooks/use-toast'
import { formatDatePtBr, maskCnpj } from '@/lib/formatters'

interface NfseCancelamentoModalProps {
  nota: NfseNotaEmitidaRecord | null
  empresa?: Empresa
  config?: NfseConfigRecord | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
  onSubstituir?: (notaOriginal: NfseNotaEmitidaRecord) => void
  currentUserId?: string
}

export const NfseCancelamentoModal: React.FC<NfseCancelamentoModalProps> = ({
  nota,
  empresa,
  config,
  open,
  onOpenChange,
  onSuccess,
  onSubstituir,
  currentUserId,
}) => {
  const { toast } = useToast()

  const [codigoCancelamento, setCodigoCancelamento] = useState<string>('1')
  const [motivo, setMotivo] = useState<string>('')
  const [cienciatransmissao, setCienciaTransmissao] = useState<boolean>(false)
  const [emitirSubstitutaApos, setEmitirSubstitutaApos] = useState<boolean>(false)
  const [cancelando, setCancelando] = useState<boolean>(false)

  // Resetar campos ao abrir
  React.useEffect(() => {
    if (nota) {
      setCodigoCancelamento('1')
      setMotivo('')
      setCienciaTransmissao(false)
      setEmitirSubstitutaApos(false)
    }
  }, [nota])

  if (!nota) return null

  // Cálculo de dias desde a emissão para alerta de prazo municipal configurável
  const dataEmissaoDate = new Date(nota.data_emissao)
  const diasDesdeEmissao = Math.floor(
    (Date.now() - dataEmissaoDate.getTime()) / (1000 * 60 * 60 * 24),
  )
  const prazoMunicipalConfig = config?.prazo_dias_cancelamento || 30
  const prazoExpiradoOuRisco = diasDesdeEmissao > prazoMunicipalConfig

  const provedorNome =
    nota.provedor_usado === 'betha'
      ? 'Betha Sistemas (ABRASF 2.x)'
      : nota.provedor_usado === 'ginfes'
        ? 'Ginfes (ABRASF)'
        : 'Gov.br (Emissor Nacional)'

  const isModoProducao =
    config?.modo_operacao === 'producao' &&
    ((nota.provedor_usado === 'betha' && config.betha_usuario) ||
      (nota.provedor_usado === 'ginfes' && config.ginfes_usuario) ||
      (config.govbr_client_id && config.govbr_client_secret))

  const motivoSelecionadoObj = CODIGOS_CANCELAMENTO_OFICIAIS.find(
    (c) => c.codigo === codigoCancelamento,
  )

  const handleConfirmarCancelamento = async () => {
    if (!motivo.trim()) {
      toast({
        title: 'Motivo obrigatório',
        description: 'Descreva a fundamentação do cancelamento da NFS-e.',
        variant: 'destructive',
      })
      return
    }

    if (!cienciatransmissao) {
      toast({
        title: 'Confirmação consciente obrigatória',
        description: 'Marque a ciência de que o pedido de cancelamento será transmitido ao fisco.',
        variant: 'destructive',
      })
      return
    }

    setCancelando(true)
    try {
      const res = await nfseWhatsappService.cancelarNfse(
        nota.tenant_id,
        {
          nota_id: nota.id,
          codigo_cancelamento: codigoCancelamento,
          motivo: motivo.trim(),
          emitir_substituta: emitirSubstitutaApos,
        },
        currentUserId || 'system',
      )

      toast({
        title: 'NFS-e Cancelada com Sucesso!',
        description: res.mensagemSucesso,
      })

      onSuccess()
      onOpenChange(false)

      // Se o usuário selecionou substituição, acionar o callback para abrir o modal de aprovação pré-preenchido
      if (emitirSubstitutaApos && onSubstituir) {
        onSubstituir(nota)
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err)
      toast({
        title: 'Falha no cancelamento da NFS-e',
        description: errMsg,
        variant: 'destructive',
      })
    } finally {
      setCancelando(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-rose-100 text-rose-700 font-bold">
                <Ban className="h-4 w-4" />
              </span>
              <div>
                <DialogTitle className="text-lg font-bold text-[#1A2333]">
                  Cancelamento de NFS-e Nº {nota.numero_nota}
                </DialogTitle>
                <DialogDescription className="text-xs text-[#64748B]">
                  Provedor Fiscal: <strong>{provedorNome}</strong> • Cód. Verificação:{' '}
                  <span className="font-mono">{nota.codigo_verificacao}</span>
                </DialogDescription>
              </div>
            </div>

            <Badge
              className={
                isModoProducao
                  ? 'bg-emerald-600 text-white text-[10px]'
                  : 'bg-amber-600 text-white text-[10px]'
              }
            >
              {isModoProducao ? 'PRODUÇÃO FISCAL' : 'SIMULAÇÃO CONTROLADA'}
            </Badge>
          </div>
        </DialogHeader>

        <div className="space-y-4 my-2">
          {/* Card Resumo da Nota */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 text-xs grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <span className="text-[10px] text-[#64748B] block">Empresa Prestadora:</span>
              <strong className="text-[#1A2333] block truncate">
                {empresa?.razao_social || 'Prestador'}
              </strong>
              <span className="text-[10px] text-[#64748B]">
                {empresa?.cnpj ? maskCnpj(empresa.cnpj) : '—'}
              </span>
            </div>

            <div>
              <span className="text-[10px] text-[#64748B] block">Tomador do Serviço:</span>
              <strong className="text-[#1A2333] block truncate">{nota.tomador_nome}</strong>
              <span className="text-[10px] text-[#64748B] font-mono">{nota.tomador_documento}</span>
            </div>

            <div>
              <span className="text-[10px] text-[#64748B] block">Data Emissão:</span>
              <strong className="text-[#1A2333] block">{formatDatePtBr(nota.data_emissao)}</strong>
              <span className="text-[10px] text-[#64748B]">Comp: {nota.competencia}</span>
            </div>

            <div>
              <span className="text-[10px] text-[#64748B] block">Valor dos Serviços:</span>
              <strong className="text-[#0FA3A3] text-sm block">
                {nota.valor_servicos.toLocaleString('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                })}
              </strong>
              <span className="text-[10px] text-[#64748B]">
                Líquido:{' '}
                {nota.valor_liquido.toLocaleString('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                })}
              </span>
            </div>
          </div>

          {/* Aviso sobre Prazo Municipal Configurável */}
          {prazoExpiradoOuRisco && (
            <div className="rounded-xl border border-amber-300 bg-amber-50/80 p-3 text-xs space-y-1 text-amber-900">
              <div className="flex items-center gap-1.5 font-bold text-amber-800">
                <Clock className="h-4 w-4 text-amber-600" />
                Atenção ao Prazo de Cancelamento: {diasDesdeEmissao} dias desde a emissão
              </div>
              <p className="text-[11px] leading-relaxed">
                O prazo municipal configurado neste tenant é de{' '}
                <strong>{prazoMunicipalConfig} dias</strong>. Dependendo do município do prestador (
                {empresa?.cidade || 'município emissor'}), o cancelamento após o fechamento da
                competência ou recolhimento do ISS pode exigir processo administrativo diretamente
                na Secretaria de Finanças.
              </p>
            </div>
          )}

          {/* Seletor do Código de Cancelamento Oficial */}
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-[#1A2333]">
              Código de Cancelamento Oficial (Tabela ABRASF / Gov.br) *
            </Label>
            <Select value={codigoCancelamento} onValueChange={setCodigoCancelamento}>
              <SelectTrigger className="h-10 text-xs">
                <SelectValue placeholder="Selecione o código oficial de cancelamento" />
              </SelectTrigger>
              <SelectContent>
                {CODIGOS_CANCELAMENTO_OFICIAIS.map((item) => (
                  <SelectItem key={item.codigo} value={item.codigo} className="text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-[#0FA3A3]">[{item.codigo}]</span>
                      <span>{item.descricao}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {motivoSelecionadoObj && (
              <p className="text-[11px] text-[#64748B] italic">{motivoSelecionadoObj.detalhe}</p>
            )}
          </div>

          {/* Descrição / Justificativa detalhada */}
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-[#1A2333]">
              Motivo e Justificativa Fundamentada *
            </Label>
            <Textarea
              rows={3}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              className="text-xs"
              placeholder="Exemplo: Cancelamento por erro no CNPJ do tomador e alíquota de ISS aplicada. Emissão de nota substituta acordada com o cliente..."
            />
          </div>

          {/* Opção de Substituição se for Erro na Emissão */}
          {motivoSelecionadoObj?.permiteSubstituicao && (
            <div className="rounded-xl border border-indigo-200 bg-indigo-50/70 p-3.5 space-y-2">
              <div className="flex items-start gap-2">
                <Checkbox
                  id="substituir"
                  checked={emitirSubstitutaApos}
                  onCheckedChange={(checked) => setEmitirSubstitutaApos(!!checked)}
                  className="mt-0.5"
                />
                <div>
                  <label
                    htmlFor="substituir"
                    className="text-xs font-bold text-indigo-950 cursor-pointer flex items-center gap-1.5"
                  >
                    <RefreshCw className="h-3.5 w-3.5 text-indigo-600" />
                    Emitir Nota Fiscal Substituta imediatamente após o cancelamento
                  </label>
                  <p className="text-[11px] text-indigo-800/90 mt-0.5 leading-tight">
                    Ao confirmar, abrirá a tela de emissão pré-preenchida com os mesmos dados do
                    tomador e valores para que você corrija os apontamentos e transmita a substituta
                    vinculada à nota Nº {nota.numero_nota}.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Impactos Automáticos do Cancelamento */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2 text-xs">
            <span className="font-bold text-[#1A2333] flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-[#0FA3A3]" />
              Ações Automáticas Executadas no Cancelamento:
            </span>
            <ul className="text-[11px] text-[#475569] space-y-1 pl-4 list-disc">
              <li>
                <strong>Provedor Fiscal:</strong> Transmissão do XML de cancelamento ao webservice
                oficial ({provedorNome}).
              </li>
              <li>
                <strong>GED da Empresa:</strong> Arquivamento automático do XML e termo de
                cancelamento.
              </li>
              <li>
                <strong>Financeiro:</strong> Baixa automática do Título a Receber vinculado (se
                pendente). Caso já conste como pago, será gerado alerta para decisão do financeiro.
              </li>
              <li>
                <strong>WhatsApp do Cliente:</strong> Registro do comunicado de cancelamento no chat
                da solicitação.
              </li>
              <li>
                <strong>Auditoria:</strong> Registro de data, usuário, IP e protocolo no log de
                segurança do tenant.
              </li>
            </ul>
          </div>

          {/* Checkbox de Ciência Consciente */}
          <div className="flex items-start space-x-2 pt-1">
            <Checkbox
              id="ciencia"
              checked={cienciatransmissao}
              onCheckedChange={(checked) => setCienciaTransmissao(!!checked)}
              className="mt-0.5"
            />
            <label
              htmlFor="ciencia"
              className="text-xs text-[#1A2333] font-medium leading-tight cursor-pointer"
            >
              Declaro que estou ciente de que o cancelamento de NFS-e é uma operação fiscal
              irreversível transmitida à prefeitura/Receita Federal e assumo a responsabilidade
              técnica e contábil.
            </label>
          </div>
        </div>

        <DialogFooter className="flex items-center justify-between sm:justify-between w-full pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={cancelando}
            className="text-xs"
          >
            Voltar
          </Button>

          <Button
            size="sm"
            onClick={handleConfirmarCancelamento}
            disabled={cancelando || !cienciatransmissao || !motivo.trim()}
            className="bg-rose-600 hover:bg-rose-700 text-white text-xs gap-1.5 shadow-sm"
          >
            {cancelando ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Transmitindo Cancelamento...
              </>
            ) : (
              <>
                <Ban className="h-3.5 w-3.5" />
                Confirmar & Cancelar NFS-e
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
