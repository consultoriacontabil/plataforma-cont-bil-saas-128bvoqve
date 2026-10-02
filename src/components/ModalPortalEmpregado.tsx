import React, { useState, useEffect } from 'react'
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
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import {
  KeyRound,
  Copy,
  Check,
  Send,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  ShieldAlert,
  Smartphone,
  Lock,
  AlertCircle,
  Clock,
  UserCheck,
  Building2,
  FileBadge,
  Ban,
} from 'lucide-react'
import pb from '@/lib/pocketbase/client'
import { portalEmpregadoService } from '@/services/portalEmpregado'
import { whatsappAtivoService } from '@/services/whatsappAtivo'
import { maskCpf, maskPhone } from '@/lib/formatters'
import type { Funcionario, PortalEmpregadoAcessoRecord } from '@/types'

interface ModalPortalEmpregadoProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  funcionario: Funcionario | null
  usuarioId: string
  tenantId: string
  onAcessoAtualizado?: () => void
}

export function ModalPortalEmpregado({
  open,
  onOpenChange,
  funcionario,
  usuarioId,
  tenantId,
  onAcessoAtualizado,
}: ModalPortalEmpregadoProps) {
  const { toast } = useToast()

  const [loading, setLoading] = useState(false)
  const [gerando, setGerando] = useState(false)
  const [enviandoWa, setEnviandoWa] = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)
  const [copiedCode, setCopiedCode] = useState(false)

  const [acesso, setAcesso] = useState<PortalEmpregadoAcessoRecord | null>(null)
  const [telefone, setTelefone] = useState('')
  const [tokenGerado, setTokenGerado] = useState('')
  const [codigoGerado, setCodigoGerado] = useState('')
  const [linkAcesso, setLinkAcesso] = useState('')
  const [nomeEmpresaResolvido, setNomeEmpresaResolvido] = useState('')
  const [evolutionStatus, setEvolutionStatus] = useState<{
    configurado: boolean
  }>({ configurado: false })

  // Carregar dados de acesso quando abrir para o funcionário
  useEffect(() => {
    if (!open || !funcionario) {
      setAcesso(null)
      setTokenGerado('')
      setCodigoGerado('')
      setLinkAcesso('')
      return
    }

    const carregar = async () => {
      setLoading(true)
      try {
        // Resolver nome da empresa de forma robusta
        const nomeExpand =
          funcionario.expand?.empresa?.nome_fantasia || funcionario.expand?.empresa?.razao_social
        if (nomeExpand) {
          setNomeEmpresaResolvido(nomeExpand)
        } else if (funcionario.empresa) {
          try {
            const empRec = await pb
              .collection('empresas')
              .getOne<{ nome_fantasia?: string; razao_social?: string }>(funcionario.empresa)
            setNomeEmpresaResolvido(
              empRec.nome_fantasia || empRec.razao_social || 'Empresa Vinculada',
            )
          } catch {
            setNomeEmpresaResolvido('Empresa Vinculada')
          }
        } else {
          setNomeEmpresaResolvido('Empresa Não Vinculada')
        }

        const evo = await whatsappAtivoService.getStatusEvolutionTenant(tenantId)
        setEvolutionStatus({ configurado: evo.configurado })

        const existente = await portalEmpregadoService.getAcessoPorFuncionario(funcionario.id)
        if (existente) {
          setAcesso(existente)
          setTelefone(existente.telefone_whatsapp || '')
          setTokenGerado(existente.token_acesso || '')
          setCodigoGerado(existente.codigo_temporario || '')
          const origin = typeof window !== 'undefined' ? window.location.origin : ''
          const cpfLimpo = funcionario.cpf.replace(/\D/g, '')
          if (existente.token_acesso) {
            setLinkAcesso(
              `${origin}/portal-empregado?token=${existente.token_acesso}&cpf=${cpfLimpo}`,
            )
          } else {
            setLinkAcesso('')
          }
        } else {
          setAcesso(null)
          setTelefone('')
          setTokenGerado('')
          setCodigoGerado('')
          setLinkAcesso('')
        }
      } catch (err) {
        console.warn('Erro ao carregar acesso:', err)
      } finally {
        setLoading(false)
      }
    }

    carregar()
  }, [open, funcionario, tenantId])

  const handleGerarAcesso = async () => {
    if (!funcionario) return

    try {
      setGerando(true)
      const res = await portalEmpregadoService.gerarOuRenovarAcesso({
        tenantId,
        empresaId: funcionario.empresa,
        funcionarioId: funcionario.id,
        usuarioId,
        telefoneWhatsapp: telefone.trim(),
        expiraEmDias: 30,
      })

      setAcesso(res.acesso)
      setTokenGerado(res.token)
      setCodigoGerado(res.codigoTemporario)
      setLinkAcesso(res.linkAcesso)

      toast({
        title: 'Código e Link gerados!',
        description: `O colaborador ${funcionario.nome_completo} agora tem credenciais ativas para o Portal do Empregado.`,
      })

      if (onAcessoAtualizado) onAcessoAtualizado()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao gerar credenciais.'
      toast({
        variant: 'destructive',
        title: 'Erro ao gerar acesso',
        description: msg,
      })
    } finally {
      setGerando(false)
    }
  }

  const handleCopiarLink = async () => {
    if (!linkAcesso) return
    try {
      await navigator.clipboard.writeText(linkAcesso)
      setCopiedLink(true)
      setTimeout(() => setCopiedLink(false), 2500)
      toast({
        title: 'Link copiado!',
        description: 'Link direto com token copiado para a área de transferência.',
      })
    } catch (_) {
      toast({
        variant: 'destructive',
        title: 'Erro ao copiar',
        description: 'Copie manualmente o link exibido.',
      })
    }
  }

  const handleCopiarCodigo = async () => {
    if (!codigoGerado) return
    try {
      await navigator.clipboard.writeText(codigoGerado)
      setCopiedCode(true)
      setTimeout(() => setCopiedCode(false), 2500)
      toast({
        title: 'Código copiado!',
        description: `Código "${codigoGerado}" copiado.`,
      })
    } catch {
      /* intentionally ignored */
    }
  }

  const handleEnviarWhatsApp = async () => {
    if (!funcionario || !tokenGerado || !codigoGerado) return

    const telLimpo = telefone.replace(/\D/g, '')
    if (telLimpo.length < 10) {
      toast({
        variant: 'destructive',
        title: 'Telefone inválido',
        description: 'Informe um número com DDD válido (ex: 11999998888).',
      })
      return
    }

    try {
      setEnviandoWa(true)
      const res = await portalEmpregadoService.enviarAcessoWhatsApp({
        tenantId,
        empresaId: funcionario.empresa,
        funcionarioId: funcionario.id,
        destinatarioTelefone: telLimpo,
        token: tokenGerado,
        codigo: codigoGerado,
        linkAcesso,
      })

      if (res.status === 'enviado') {
        toast({
          title: 'WhatsApp transmitido!',
          description: `Credenciais enviadas via Evolution API para ${maskPhone(telLimpo)}.`,
        })
      } else if (res.status === 'aguardando_credenciais') {
        toast({
          title: 'Enfileirado (Modo Supervisão)',
          description:
            'A mensagem foi registrada na fila. Como a Evolution API não está configurada neste tenant, ela aguarda credenciais ou envio manual.',
        })
      } else {
        toast({
          title: 'Envio registrado',
          description: res.mensagem,
        })
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao despachar WhatsApp.'
      toast({
        variant: 'destructive',
        title: 'Erro no envio WhatsApp',
        description: msg,
      })
    } finally {
      setEnviandoWa(false)
    }
  }

  const handleRevogar = async () => {
    if (!funcionario) return
    if (
      !window.confirm(
        `Deseja realmente revogar o acesso ao Portal do Empregado de ${funcionario.nome_completo}?`,
      )
    ) {
      return
    }

    try {
      setLoading(true)
      await portalEmpregadoService.revogarAcesso(tenantId, funcionario.id, usuarioId)
      setAcesso(null)
      setTokenGerado('')
      setCodigoGerado('')
      setLinkAcesso('')
      toast({
        title: 'Acesso revogado',
        description: 'O colaborador não conseguirá mais efetuar login com o código anterior.',
      })
      if (onAcessoAtualizado) onAcessoAtualizado()
    } catch (err: unknown) {
      toast({
        variant: 'destructive',
        title: 'Erro ao revogar',
        description: err instanceof Error ? err.message : 'Falha na revogação.',
      })
    } finally {
      setLoading(false)
    }
  }

  if (!funcionario) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl rounded-2xl bg-white p-6 shadow-xl">
        <DialogHeader className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-50 text-[#0FA3A3]">
              <KeyRound className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold text-[#1A2333]">
                Portal do Empregado • Credenciais de Acesso
              </DialogTitle>
              <DialogDescription className="text-xs text-[#64748B]">
                Emissão de código de primeiro acesso, link direto e envio por WhatsApp.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 space-y-2">
            <RefreshCw className="h-6 w-6 animate-spin text-[#0FA3A3]" />
            <p className="text-xs text-[#64748B]">Consultando acessos existentes...</p>
          </div>
        ) : (
          <div className="space-y-4 pt-2">
            {/* Card com dados do Colaborador */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 flex flex-col sm:flex-row sm:items-start justify-between gap-3">
              <div className="space-y-1">
                <p className="text-sm font-bold text-[#1A2333] flex items-center gap-1.5">
                  <UserCheck className="h-4 w-4 text-[#0FA3A3]" />
                  <span>{acesso?.nome_colaborador || funcionario.nome_completo}</span>
                </p>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[#64748B]">
                  <span className="font-mono">CPF: {maskCpf(funcionario.cpf)}</span>
                  <span>•</span>
                  <span>
                    Cargo:{' '}
                    <strong className="text-[#1A2333] font-medium">
                      {funcionario.cargo || 'Não especificado'}
                    </strong>
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <FileBadge className="h-3 w-3 text-slate-400" />
                    Matrícula e-Social:{' '}
                    <strong className="text-[#1A2333] font-mono font-medium">
                      {funcionario.matricula_esocial || 'Sem matrícula'}
                    </strong>
                  </span>
                </div>
                <p className="text-[11px] text-[#64748B] flex items-center gap-1.5 pt-0.5">
                  <Building2 className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                  <span>
                    Empresa:{' '}
                    <strong className="text-[#1A2333] font-medium">{nomeEmpresaResolvido}</strong>
                  </span>
                </p>
              </div>

              {/* Status Badge e Validade */}
              <div className="sm:text-right shrink-0">
                {(() => {
                  const expirado = acesso?.expira_em
                    ? new Date(acesso.expira_em).getTime() < Date.now()
                    : false
                  if (!acesso && !funcionario.token_acesso_publico) {
                    return (
                      <Badge className="bg-slate-100 text-slate-700 border-slate-200 text-[11px] font-medium">
                        Sem Código Emitido
                      </Badge>
                    )
                  }
                  if (acesso?.ativo === false) {
                    return (
                      <Badge className="bg-rose-50 text-rose-700 border-rose-200 text-[11px] font-semibold gap-1">
                        <Ban className="h-3 w-3" /> Acesso Revogado
                      </Badge>
                    )
                  }
                  if (expirado) {
                    return (
                      <div className="sm:text-right">
                        <Badge className="bg-amber-50 text-amber-800 border-amber-200 text-[11px] font-semibold gap-1">
                          <ShieldAlert className="h-3 w-3 text-amber-600" /> Código Expirado
                        </Badge>
                        {acesso?.expira_em && (
                          <p className="text-[10px] text-amber-700 mt-0.5">
                            Expirou em {new Date(acesso.expira_em).toLocaleDateString('pt-BR')}
                          </p>
                        )}
                      </div>
                    )
                  }
                  if (acesso?.primeiro_acesso_realizado || funcionario.primeiro_acesso_realizado) {
                    return (
                      <div className="sm:text-right">
                        <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[11px] font-semibold gap-1">
                          <ShieldCheck className="h-3 w-3" /> 1º Acesso Concluído
                        </Badge>
                        {acesso?.ultimo_acesso && (
                          <p className="text-[10px] text-emerald-700 mt-0.5">
                            Último: {new Date(acesso.ultimo_acesso).toLocaleDateString('pt-BR')}
                          </p>
                        )}
                      </div>
                    )
                  }
                  return (
                    <div className="sm:text-right">
                      <Badge className="bg-teal-50 text-teal-700 border-teal-200 text-[11px] font-semibold gap-1">
                        <ShieldCheck className="h-3 w-3" /> Portal Ativo
                      </Badge>
                      {acesso?.expira_em && (
                        <p className="text-[10px] text-teal-700 mt-0.5">
                          Expira em {new Date(acesso.expira_em).toLocaleDateString('pt-BR')}
                        </p>
                      )}
                    </div>
                  )
                })()}
              </div>
            </div>

            {/* Campo de Telefone para WhatsApp */}
            <div className="space-y-1.5">
              <Label htmlFor="tel-colaborador" className="text-xs font-semibold text-[#1A2333]">
                WhatsApp do Colaborador
              </Label>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Smartphone className="h-4 w-4 text-[#64748B] absolute left-3 top-2.5" />
                  <Input
                    id="tel-colaborador"
                    value={telefone}
                    onChange={(e) => setTelefone(e.target.value)}
                    placeholder="(11) 98765-4321"
                    className="pl-9 h-9 text-xs rounded-xl border-[#E2E8F0]"
                  />
                </div>
                <Button
                  onClick={handleGerarAcesso}
                  disabled={gerando}
                  className="h-9 text-xs gap-1.5 bg-[#0FA3A3] text-white hover:bg-[#0C8585] rounded-xl shrink-0"
                >
                  {gerando ? (
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <KeyRound className="h-3.5 w-3.5" />
                  )}
                  <span>{tokenGerado ? 'Renovar Código' : 'Gerar Código'}</span>
                </Button>
              </div>
            </div>

            {/* Credenciais Geradas */}
            {tokenGerado && (
              <div className="space-y-3 p-4 rounded-xl bg-teal-50/40 border border-teal-200/80">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#0FA3A3] uppercase tracking-wide flex items-center gap-1.5">
                    <Lock className="h-3.5 w-3.5" />
                    Credenciais Ativas
                  </span>
                  <div className="flex items-center gap-1 text-[11px] text-[#64748B]">
                    <Clock className="h-3 w-3" />
                    <span>
                      {acesso?.expira_em
                        ? `Válido até ${new Date(acesso.expira_em).toLocaleDateString('pt-BR')}`
                        : 'Válido por 30 dias'}
                    </span>
                  </div>
                </div>

                {/* Código de Primeiro Acesso */}
                <div className="flex items-center justify-between bg-white p-2.5 rounded-lg border border-teal-200">
                  <div>
                    <span className="text-[10px] text-[#64748B] block font-medium">
                      CÓDIGO DE PRIMEIRO ACESSO (6 DÍGITOS)
                    </span>
                    <span className="font-mono text-base font-bold text-[#1A2333] tracking-widest">
                      {codigoGerado}
                    </span>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleCopiarCodigo}
                    className="h-8 text-xs gap-1 border-teal-200 hover:bg-teal-50"
                  >
                    {copiedCode ? (
                      <>
                        <Check className="h-3 w-3 text-emerald-600" />
                        <span className="text-emerald-700">Copiado</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3" />
                        <span>Copiar Código</span>
                      </>
                    )}
                  </Button>
                </div>

                {/* Link Direto */}
                <div className="space-y-1">
                  <span className="text-[10px] text-[#64748B] block font-medium">
                    LINK DE ACESSO DIRETO (SEM PRECISAR DIGITAR CÓDIGO)
                  </span>
                  <div className="flex items-center gap-2">
                    <Input
                      readOnly
                      value={linkAcesso}
                      className="h-8 text-[11px] font-mono bg-white border-slate-200"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleCopiarLink}
                      className="h-8 text-xs gap-1 shrink-0 border-slate-200"
                    >
                      {copiedLink ? (
                        <>
                          <Check className="h-3 w-3 text-emerald-600" />
                          <span className="text-emerald-700">Copiado</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3" />
                          <span>Copiar</span>
                        </>
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => window.open(linkAcesso, '_blank')}
                      className="h-8 w-8 p-0 text-[#0FA3A3] shrink-0"
                      title="Abrir no navegador"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                {/* Botão de Envio WhatsApp */}
                <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-2 border-t border-teal-100">
                  <div className="text-[11px] text-[#64748B] flex items-center gap-1.5">
                    <Smartphone className="h-3.5 w-3.5 text-emerald-600" />
                    <span>
                      {evolutionStatus.configurado
                        ? 'Evolution API conectada (disparo direto).'
                        : 'Evolution API não configurada (vai para fila aguardando credenciais).'}
                    </span>
                  </div>

                  <Button
                    size="sm"
                    onClick={handleEnviarWhatsApp}
                    disabled={enviandoWa || !telefone.trim()}
                    className="h-8 text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg w-full sm:w-auto"
                  >
                    {enviandoWa ? (
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Send className="h-3.5 w-3.5" />
                    )}
                    <span>Disparar WhatsApp</span>
                  </Button>
                </div>
              </div>
            )}

            {/* Aviso LGPD */}
            <div className="flex items-start gap-2 p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-[11px] text-[#64748B]">
              <AlertCircle className="h-4 w-4 text-[#0FA3A3] shrink-0 mt-0.5" />
              <p>
                <strong>Sigilo e Proteção LGPD:</strong> O Portal do Empregado isola estritamente os
                dados de cada colaborador. Nenhum empregado tem acesso aos dados, salários ou
                holerites de outros colaboradores da empresa.
              </p>
            </div>
          </div>
        )}

        <DialogFooter className="flex flex-row items-center justify-between pt-2">
          {acesso?.ativo && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRevogar}
              className="text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50"
            >
              Revogar Acesso
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-xs ml-auto"
          >
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
