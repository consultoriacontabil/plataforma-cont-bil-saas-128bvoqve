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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import {
  CheckCircle2,
  Building2,
  User,
  ShieldAlert,
  Loader2,
  FileCheck2,
  AlertCircle,
  ExternalLink,
} from 'lucide-react'
import type {
  CompanyOnboardingWorkflowRecord,
  NaturezaJuridicaTipo,
  Empresa,
  EmpresaRegime,
  EmpresaPorte,
} from '@/types'
import { companyOnboardingService } from '@/services/companyOnboarding'
import { empresasService } from '@/services/empresas'
import { maskCnpj, maskPhone, isValidCnpj } from '@/lib/formatters'
import { NATUREZAS_JURIDICAS } from '@/lib/companyFormationLegal'

interface ModalConclusaoImportacaoEmpresaProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  workflow: CompanyOnboardingWorkflowRecord | null
  usuarioId: string
  usuarioNome: string
  tenantId: string
  onConcluido: (resultado: { empresa: Empresa; workflow: CompanyOnboardingWorkflowRecord }) => void
}

export function ModalConclusaoImportacaoEmpresa({
  open,
  onOpenChange,
  workflow,
  usuarioId,
  usuarioNome,
  tenantId,
  onConcluido,
}: ModalConclusaoImportacaoEmpresaProps) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [checkingCnpj, setCheckingCnpj] = useState(false)
  const [empresaDuplicada, setEmpresaDuplicada] = useState<Empresa | null>(null)

  // Formulário de Conclusão & Importação
  const [naturezaJuridica, setNaturezaJuridica] = useState<NaturezaJuridicaTipo>('ltda')
  const [razaoSocial, setRazaoSocial] = useState('')
  const [nomeFantasia, setNomeFantasia] = useState('')
  const [cnpj, setCnpj] = useState('')
  const [clienteNome, setClienteNome] = useState('')
  const [clienteTelefone, setClienteTelefone] = useState('')
  const [clienteEmail, setClienteEmail] = useState('')
  const [regimeTributario, setRegimeTributario] = useState<EmpresaRegime>('simples_nacional')
  const [porte, setPorte] = useState<EmpresaPorte>('me')
  const [inscricaoMunicipal, setInscricaoMunicipal] = useState('')
  const [inscricaoEstadual, setInscricaoEstadual] = useState('')

  // Preenche dados sugeridos caso o cliente tenha enviado via link ou haja dados preliminares
  useEffect(() => {
    if (!workflow || !open) return

    const prelim = workflow.dados_preliminares_json || {}
    const passos = workflow.checklist_passos_json || []
    const itemCnpj = passos.find((it) => it.temNireCnpj && it.data_efetivacao_cnpj)

    // Sugestão de razão social
    const sugeridaRazao =
      workflow.razao_social_pretendida ||
      prelim.razao_social_pretendida ||
      prelim.sugestao_razao_social ||
      workflow.titulo.replace(/^Abertura(?:\s*de\s*Empresa)?\s*[-–:]\s*/i, '')

    // Sugestão de cliente
    const sugeridoCliente =
      workflow.cliente_nome ||
      prelim.sugestao_cliente_nome ||
      (prelim.socios && prelim.socios[0]?.nome) ||
      ''

    const sugeridoTelefone =
      workflow.cliente_telefone ||
      prelim.sugestao_cliente_telefone ||
      (prelim.socios && prelim.socios[0]?.telefone) ||
      ''

    const sugeridoEmail =
      workflow.cliente_email ||
      prelim.sugestao_cliente_email ||
      (prelim.socios && prelim.socios[0]?.email) ||
      ''

    setNaturezaJuridica(
      (workflow.natureza_juridica as NaturezaJuridicaTipo) ||
        (prelim.natureza_juridica as NaturezaJuridicaTipo) ||
        'ltda',
    )
    setRazaoSocial(sugeridaRazao || '')
    setNomeFantasia(prelim.nome_fantasia_pretendido || workflow.nome_fantasia_pretendido || '')
    setCnpj(prelim.cnpj_pretendido ? maskCnpj(prelim.cnpj_pretendido) : '')
    setClienteNome(sugeridoCliente)
    setClienteTelefone(sugeridoTelefone ? maskPhone(sugeridoTelefone) : '')
    setClienteEmail(sugeridoEmail)
    setRegimeTributario((workflow.regime_pretendido as EmpresaRegime) || 'simples_nacional')
    setPorte((workflow.porte_pretendido as EmpresaPorte) || 'me')
    setInscricaoMunicipal('')
    setInscricaoEstadual('')
    setEmpresaDuplicada(null)
  }, [workflow, open])

  // Verificação de CNPJ duplicado em tempo real
  useEffect(() => {
    const rawCnpj = cnpj.replace(/\D/g, '')
    if (rawCnpj.length !== 14 || !tenantId) {
      setEmpresaDuplicada(null)
      return
    }

    let isMounted = true
    setCheckingCnpj(true)

    const timer = setTimeout(async () => {
      try {
        const existente = await empresasService.getByCnpj(tenantId, rawCnpj)
        if (isMounted) {
          setEmpresaDuplicada(existente)
        }
      } catch (err) {
        console.error('Erro ao verificar CNPJ duplicado:', err)
      } finally {
        if (isMounted) {
          setCheckingCnpj(false)
        }
      }
    }, 350)

    return () => {
      isMounted = false
      clearTimeout(timer)
    }
  }, [cnpj, tenantId])

  const handleCnpjChange = (val: string) => {
    const masked = maskCnpj(val)
    setCnpj(masked)
  }

  const handleTelefoneChange = (val: string) => {
    setClienteTelefone(maskPhone(val))
  }

  const handleFinalizarEImportar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!workflow || !tenantId) return

    // Validações
    if (!razaoSocial.trim()) {
      toast({
        variant: 'destructive',
        title: 'Razão Social obrigatória',
        description: 'Informe a Razão Social definitiva deferida na Junta Comercial.',
      })
      return
    }

    const rawCnpj = cnpj.replace(/\D/g, '')
    if (rawCnpj.length > 0) {
      if (rawCnpj.length !== 14 || !isValidCnpj(rawCnpj)) {
        toast({
          variant: 'destructive',
          title: 'CNPJ inválido',
          description: 'O número de CNPJ informado é inválido.',
        })
        return
      }

      if (empresaDuplicada) {
        toast({
          variant: 'destructive',
          title: 'CNPJ duplicado na carteira',
          description: `Este CNPJ já está cadastrado para a empresa "${empresaDuplicada.razao_social}". Não é permitido duplicar.`,
        })
        return
      }
    }

    try {
      setLoading(true)
      const res = await companyOnboardingService.concluirEImportarEmpresaDefinitiva(
        workflow,
        {
          natureza_juridica: naturezaJuridica,
          razao_social: razaoSocial.trim(),
          nome_fantasia: nomeFantasia.trim() || razaoSocial.trim(),
          cnpj: rawCnpj,
          cliente_nome: clienteNome.trim(),
          cliente_telefone: clienteTelefone.trim(),
          cliente_email: clienteEmail.trim(),
          regime_tributario: regimeTributario,
          porte,
          inscricao_municipal: inscricaoMunicipal.trim(),
          inscricao_estadual: inscricaoEstadual.trim(),
        },
        usuarioId,
        usuarioNome,
      )

      toast({
        title: 'Abertura finalizada com sucesso!',
        description: `A empresa "${res.empresa.razao_social}" foi importada diretamente para Empresas Cadastradas.`,
      })

      onConcluido(res)
      onOpenChange(false)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao concluir abertura.'
      toast({
        variant: 'destructive',
        title: 'Erro na conclusão',
        description: msg,
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[92vh] flex flex-col rounded-2xl bg-white p-6 shadow-xl border-[#E2E8F0]">
        <DialogHeader className="border-b border-[#E2E8F0] pb-3">
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <FileCheck2 className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-[#1A2333] flex items-center gap-2">
                <span>Conclusão do Processo & Importação Definitiva</span>
                <Badge className="bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                  Passo Final
                </Badge>
              </DialogTitle>
              <DialogDescription className="text-xs text-[#64748B]">
                Preencha os dados finais deferidos da empresa. Ao confirmar, o processo de abertura
                é concluído e a empresa é cadastrada automaticamente em Empresas Cadastradas.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleFinalizarEImportar} className="flex-1 overflow-y-auto space-y-4 py-3">
          {/* Alerta de aviso informativo */}
          <div className="rounded-xl border border-teal-200 bg-teal-50/50 p-3.5 text-xs text-teal-950 flex items-start gap-2.5">
            <CheckCircle2 className="h-4 w-4 text-[#0FA3A3] shrink-0 mt-0.5" />
            <div className="space-y-0.5 leading-relaxed">
              <p className="font-semibold">Cadastro Definitivo e Importação Direta para o SaaS</p>
              <p className="text-[#64748B] text-[11px]">
                Estes dados serão registrados na ficha oficial da empresa (
                <span className="font-mono text-slate-800">/empresas</span>), incluindo tipo
                societário, razão social homologada, CNPJ e contato do cliente responsável.
              </p>
            </div>
          </div>

          {/* Dados da Empresa Definitiva */}
          <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/50 p-4">
            <h4 className="text-xs font-bold text-[#1A2333] flex items-center gap-1.5">
              <Building2 className="h-4 w-4 text-[#0FA3A3]" />
              <span>Identificação Definitiva da Empresa Homologada</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1 sm:col-span-1">
                <Label className="text-xs font-semibold text-[#1A2333]">Tipo Societário *</Label>
                <Select
                  value={naturezaJuridica}
                  onValueChange={(val) => setNaturezaJuridica(val as NaturezaJuridicaTipo)}
                >
                  <SelectTrigger className="h-9 text-xs rounded-xl bg-white border-[#E2E8F0]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ltda">LTDA - Sociedade Limitada</SelectItem>
                    <SelectItem value="slu">SLU - Limitada Unipessoal</SelectItem>
                    <SelectItem value="mei">MEI - Microempreendedor</SelectItem>
                    <SelectItem value="ei">EI - Empresário Individual</SelectItem>
                    <SelectItem value="sociedade_simples_pura">Sociedade Simples</SelectItem>
                    <SelectItem value="sa_fechada">S/A Fechada</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1 sm:col-span-2">
                <Label className="text-xs font-semibold text-[#1A2333]">
                  Razão Social Definitiva *
                </Label>
                <Input
                  required
                  value={razaoSocial}
                  onChange={(e) => setRazaoSocial(e.target.value)}
                  placeholder="Ex.: CLINICA MEDICA INOVACAO LTDA"
                  className="h-9 text-xs rounded-xl bg-white border-[#E2E8F0] font-semibold"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-[#1A2333]">
                  Nome Fantasia (opcional)
                </Label>
                <Input
                  value={nomeFantasia}
                  onChange={(e) => setNomeFantasia(e.target.value)}
                  placeholder="Ex.: INOVACAO MEDICINA INTEGRADA"
                  className="h-9 text-xs rounded-xl bg-white border-[#E2E8F0]"
                />
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold text-[#1A2333]">CNPJ Homologado *</Label>
                  {checkingCnpj && (
                    <span className="text-[10px] text-teal-600 flex items-center gap-1">
                      <Loader2 className="h-3 w-3 animate-spin" /> Verificando duplicidade...
                    </span>
                  )}
                </div>
                <Input
                  required
                  value={cnpj}
                  onChange={(e) => handleCnpjChange(e.target.value)}
                  placeholder="00.000.000/0000-00"
                  className={`h-9 text-xs rounded-xl bg-white font-mono ${
                    empresaDuplicada ? 'border-rose-400 bg-rose-50/50' : 'border-[#E2E8F0]'
                  }`}
                />
                {empresaDuplicada && (
                  <p className="text-[11px] text-rose-600 flex items-center gap-1 font-medium">
                    <AlertCircle className="h-3 w-3 shrink-0" />
                    CNPJ já cadastrado para: {empresaDuplicada.razao_social}
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
              <div className="space-y-1">
                <Label className="text-[11px] text-[#64748B]">Regime Tributário</Label>
                <Select
                  value={regimeTributario}
                  onValueChange={(val) => setRegimeTributario(val as EmpresaRegime)}
                >
                  <SelectTrigger className="h-8 text-xs rounded-lg bg-white border-[#E2E8F0]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="simples_nacional">Simples Nacional</SelectItem>
                    <SelectItem value="lucro_presumido">Lucro Presumido</SelectItem>
                    <SelectItem value="lucro_real">Lucro Real</SelectItem>
                    <SelectItem value="mei">MEI / SIMEI</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] text-[#64748B]">Porte</Label>
                <Select value={porte} onValueChange={(val) => setPorte(val as EmpresaPorte)}>
                  <SelectTrigger className="h-8 text-xs rounded-lg bg-white border-[#E2E8F0]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="me">Microempresa (ME)</SelectItem>
                    <SelectItem value="epp">Pequeno Porte (EPP)</SelectItem>
                    <SelectItem value="mei">MEI</SelectItem>
                    <SelectItem value="demais">Demais portes</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] text-[#64748B]">Inscrição Municipal</Label>
                <Input
                  value={inscricaoMunicipal}
                  onChange={(e) => setInscricaoMunicipal(e.target.value)}
                  placeholder="CCM / Alvará"
                  className="h-8 text-xs rounded-lg bg-white border-[#E2E8F0]"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] text-[#64748B]">Inscrição Estadual</Label>
                <Input
                  value={inscricaoEstadual}
                  onChange={(e) => setInscricaoEstadual(e.target.value)}
                  placeholder="IE ou Isento"
                  className="h-8 text-xs rounded-lg bg-white border-[#E2E8F0]"
                />
              </div>
            </div>
          </div>

          {/* Dados do Cliente de Contato */}
          <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/50 p-4">
            <h4 className="text-xs font-bold text-[#1A2333] flex items-center gap-1.5">
              <User className="h-4 w-4 text-[#0FA3A3]" />
              <span>Cliente Responsável pelo Vínculo</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-[#1A2333]">Nome do Cliente *</Label>
                <Input
                  required
                  value={clienteNome}
                  onChange={(e) => setClienteNome(e.target.value)}
                  placeholder="Ex.: Dra. Mariana Rocha"
                  className="h-9 text-xs rounded-xl bg-white border-[#E2E8F0]"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-[#1A2333]">Telefone / WhatsApp</Label>
                <Input
                  value={clienteTelefone}
                  onChange={(e) => handleTelefoneChange(e.target.value)}
                  placeholder="(41) 98877-6655"
                  className="h-9 text-xs rounded-xl bg-white border-[#E2E8F0]"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-[#1A2333]">E-mail de Contato</Label>
                <Input
                  type="email"
                  value={clienteEmail}
                  onChange={(e) => setClienteEmail(e.target.value)}
                  placeholder="mariana.rocha@exemplo.com.br"
                  className="h-9 text-xs rounded-xl bg-white border-[#E2E8F0]"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="pt-2 gap-2 border-t border-[#E2E8F0]">
            <Button
              type="button"
              variant="outline"
              disabled={loading}
              onClick={() => onOpenChange(false)}
              className="h-10 text-xs rounded-xl border-[#E2E8F0]"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={loading || Boolean(empresaDuplicada)}
              className="h-10 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold gap-2 shadow-xs"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              <span>Concluir Abertura e Importar Empresa</span>
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
