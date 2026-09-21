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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { ArrowDownLeft, ArrowUpRight, Building2, Calendar, Loader2, UserCheck } from 'lucide-react'
import type { Empresa, MigracaoTipo, EmpresaMigracaoOnboardingRecord } from '@/types'
import { maskCnpj } from '@/lib/formatters'
import { empresasMigracoesOnboardingService } from '@/services/empresasMigracoesOnboardingService'

interface ModalNovoProcessoMigracaoProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  tenantId: string
  empresas: Empresa[]
  empresaPreSelecionadaId?: string
  tipoPreSelecionado?: MigracaoTipo
  usuarioId: string
  usuarioNome?: string
  onCriado: (processo: EmpresaMigracaoOnboardingRecord) => void
}

export function ModalNovoProcessoMigracao({
  open,
  onOpenChange,
  tenantId,
  empresas,
  empresaPreSelecionadaId,
  tipoPreSelecionado = 'entrada',
  usuarioId,
  usuarioNome,
  onCriado,
}: ModalNovoProcessoMigracaoProps) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)

  const [empresaId, setEmpresaId] = useState(empresaPreSelecionadaId || '')
  const [tipo, setTipo] = useState<MigracaoTipo>(tipoPreSelecionado)
  const [dataCorte, setDataCorte] = useState('')
  const [primeiraCompetencia, setPrimeiraCompetencia] = useState('')
  const [contadorAnterior, setContadorAnterior] = useState('')
  const [novoContador, setNovoContador] = useState('')
  const [contatoOutroContador, setContatoOutroContador] = useState('')
  const [regimeDefinido, setRegimeDefinido] = useState<string>('')
  const [motivoSaida, setMotivoSaida] = useState('')
  const [observacoes, setObservacoes] = useState('')

  // Sincroniza se as props mudarem ao abrir
  React.useEffect(() => {
    if (open) {
      if (empresaPreSelecionadaId) setEmpresaId(empresaPreSelecionadaId)
      if (tipoPreSelecionado) setTipo(tipoPreSelecionado)
      // Sugerir primeira competência atual (ex: 2026-09 ou próximo mês)
      const now = new Date()
      const mesStr = String(now.getMonth() + 1).padStart(2, '0')
      setPrimeiraCompetencia(`${mesStr}/${now.getFullYear()}`)
    }
  }, [open, empresaPreSelecionadaId, tipoPreSelecionado])

  const empresaSelecionada = empresas.find((e) => e.id === empresaId)

  // Ao selecionar empresa, sugerir regime já cadastrado nela
  React.useEffect(() => {
    if (empresaSelecionada?.regime_tributario) {
      setRegimeDefinido(empresaSelecionada.regime_tributario)
    }
  }, [empresaSelecionada])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!tenantId || !empresaId) {
      toast({
        variant: 'destructive',
        title: 'Selecione uma empresa',
        description: 'É necessário indicar qual empresa terá o processo de migração iniciado.',
      })
      return
    }

    try {
      setLoading(true)
      const novo = await empresasMigracoesOnboardingService.criarProcesso(
        {
          tenant_id: tenantId,
          empresa_id: empresaId,
          tipo,
          data_corte: dataCorte || undefined,
          primeira_competencia: primeiraCompetencia || undefined,
          contador_anterior: tipo === 'entrada' ? contadorAnterior : undefined,
          novo_contador: tipo === 'saida' ? novoContador : undefined,
          contato_outro_contador: contatoOutroContador || undefined,
          regime_tributario_definido: regimeDefinido || undefined,
          motivo_saida: tipo === 'saida' ? motivoSaida : undefined,
          observacoes: observacoes || undefined,
          responsavel_id: usuarioId,
        },
        usuarioId,
        usuarioNome,
      )

      toast({
        title: `Processo de ${tipo === 'entrada' ? 'Entrada (Onboarding)' : 'Saída (Handover)'} criado!`,
        description: `Checklist oficial inicializado para "${empresaSelecionada?.razao_social || 'a empresa'}".`,
      })

      onCriado(novo)
      onOpenChange(false)
    } catch (err: unknown) {
      console.error('Erro ao iniciar processo de migração:', err)
      const msg = err instanceof Error ? err.message : 'Falha ao iniciar processo.'
      toast({
        variant: 'destructive',
        title: 'Erro ao criar processo',
        description: msg,
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] flex flex-col p-0 rounded-2xl border-[#E2E8F0] overflow-hidden">
        <DialogHeader className="p-5 pb-3 border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div
              className={`h-10 w-10 rounded-xl flex items-center justify-center font-bold text-white shadow-xs ${
                tipo === 'entrada' ? 'bg-[#0FA3A3]' : 'bg-amber-600'
              }`}
            >
              {tipo === 'entrada' ? (
                <ArrowDownLeft className="h-5 w-5" />
              ) : (
                <ArrowUpRight className="h-5 w-5" />
              )}
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-[#1A2333] flex items-center gap-2">
                <span>Novo Processo de Migração</span>
                <Badge
                  variant="outline"
                  className={
                    tipo === 'entrada'
                      ? 'border-teal-300 bg-teal-50 text-teal-800 text-[10px] uppercase font-bold'
                      : 'border-amber-300 bg-amber-50 text-amber-800 text-[10px] uppercase font-bold'
                  }
                >
                  {tipo === 'entrada' ? 'Migração de Entrada' : 'Migração de Saída'}
                </Badge>
              </DialogTitle>
              <DialogDescription className="text-xs text-[#64748B]">
                {tipo === 'entrada'
                  ? 'Implantação e acolhimento de empresa vinda de outro contador até assumir a responsabilidade.'
                  : 'Transferência de responsabilidade técnica e entrega organizada de documentos ao novo contador.'}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Seletor de Tipo de Migração */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-[#1A2333]">Direção da Migração *</Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setTipo('entrada')}
                className={`p-3 rounded-xl border text-left flex items-start gap-2.5 transition-all ${
                  tipo === 'entrada'
                    ? 'border-[#0FA3A3] bg-teal-50/50 shadow-2xs ring-1 ring-[#0FA3A3]'
                    : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
              >
                <ArrowDownLeft
                  className={`h-4 w-4 shrink-0 mt-0.5 ${
                    tipo === 'entrada' ? 'text-[#0FA3A3]' : 'text-slate-400'
                  }`}
                />
                <div>
                  <p className="text-xs font-bold text-[#1A2333]">Migração de ENTRADA</p>
                  <p className="text-[11px] text-[#64748B] leading-tight mt-0.5">
                    Chegando de outro escritório para implantação (Onboarding)
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setTipo('saida')}
                className={`p-3 rounded-xl border text-left flex items-start gap-2.5 transition-all ${
                  tipo === 'saida'
                    ? 'border-amber-500 bg-amber-50/50 shadow-2xs ring-1 ring-amber-500'
                    : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
              >
                <ArrowUpRight
                  className={`h-4 w-4 shrink-0 mt-0.5 ${
                    tipo === 'saida' ? 'text-amber-600' : 'text-slate-400'
                  }`}
                />
                <div>
                  <p className="text-xs font-bold text-[#1A2333]">Migração de SAÍDA</p>
                  <p className="text-[11px] text-[#64748B] leading-tight mt-0.5">
                    Saindo para outro contador com entrega de arquivos (Handover)
                  </p>
                </div>
              </button>
            </div>
          </div>

          {/* Seleção da Empresa */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-[#1A2333]">Empresa Vinculada *</Label>
            <Select value={empresaId} onValueChange={setEmpresaId} required>
              <SelectTrigger className="h-9 text-xs rounded-xl border-[#E2E8F0]">
                <SelectValue placeholder="Selecione a empresa cadastrada..." />
              </SelectTrigger>
              <SelectContent className="max-h-56">
                {empresas.map((emp) => (
                  <SelectItem key={emp.id} value={emp.id} className="text-xs">
                    <span className="font-semibold text-slate-800">
                      {emp.nome_fantasia || emp.razao_social}
                    </span>{' '}
                    <span className="text-slate-400 font-mono">({maskCnpj(emp.cnpj)})</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {empresaSelecionada && (
              <p className="text-[11px] text-teal-700 font-medium">
                Razão: {empresaSelecionada.razao_social} • Regime:{' '}
                {empresaSelecionada.regime_tributario || 'Não informado'}
              </p>
            )}
          </div>

          {/* Datas Operacionais */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-[#1A2333] flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5 text-[#0FA3A3]" />
                <span>Data de Corte Oficial</span>
              </Label>
              <Input
                type="date"
                value={dataCorte}
                onChange={(e) => setDataCorte(e.target.value)}
                className="h-9 text-xs rounded-xl border-[#E2E8F0]"
              />
              <span className="text-[10px] text-slate-400">
                Dia formal de transferência de responsabilidade.
              </span>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold text-[#1A2333]">
                {tipo === 'entrada'
                  ? 'Primeira Competência Sob Guarda'
                  : 'Última Competência Apurada'}
              </Label>
              <Input
                value={primeiraCompetencia}
                onChange={(e) => setPrimeiraCompetencia(e.target.value)}
                placeholder="Ex.: 10/2026 ou 2026-10"
                className="h-9 text-xs rounded-xl border-[#E2E8F0]"
              />
              <span className="text-[10px] text-slate-400">
                Mês/ano base das primeiras ou últimas obrigações.
              </span>
            </div>
          </div>

          {/* Dados do Outro Contador */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-[#1A2333]">
                {tipo === 'entrada'
                  ? 'Contador / Escritório Anterior'
                  : 'Novo Contador / Escritório'}
              </Label>
              <Input
                value={tipo === 'entrada' ? contadorAnterior : novoContador}
                onChange={(e) =>
                  tipo === 'entrada'
                    ? setContadorAnterior(e.target.value)
                    : setNovoContador(e.target.value)
                }
                placeholder={
                  tipo === 'entrada' ? 'Ex.: Alfa Contabilidade S/S' : 'Ex.: Ômega Assessoria'
                }
                className="h-9 text-xs rounded-xl border-[#E2E8F0]"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold text-[#1A2333]">
                Contato do Outro Escritório (E-mail / Tel)
              </Label>
              <Input
                value={contatoOutroContador}
                onChange={(e) => setContatoOutroContador(e.target.value)}
                placeholder="Ex.: contato@outrocontador.com.br / (41) 9999-0000"
                className="h-9 text-xs rounded-xl border-[#E2E8F0]"
              />
            </div>
          </div>

          {/* Regime Tributário ou Motivo da Saída */}
          {tipo === 'entrada' ? (
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-[#1A2333]">
                Regime Tributário Homologado para Implantação
              </Label>
              <Select value={regimeDefinido} onValueChange={setRegimeDefinido}>
                <SelectTrigger className="h-9 text-xs rounded-xl border-[#E2E8F0]">
                  <SelectValue placeholder="Selecione o regime tributário..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="simples_nacional">Simples Nacional</SelectItem>
                  <SelectItem value="lucro_presumido">Lucro Presumido</SelectItem>
                  <SelectItem value="lucro_real">Lucro Real</SelectItem>
                  <SelectItem value="mei">MEI - Microempreendedor Individual</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-[#1A2333]">
                Motivo da Saída / Transferência
              </Label>
              <Input
                value={motivoSaida}
                onChange={(e) => setMotivoSaida(e.target.value)}
                placeholder="Ex.: Mudança de sócio, cisão societária, solicitação do cliente..."
                className="h-9 text-xs rounded-xl border-[#E2E8F0]"
              />
            </div>
          )}

          {/* Observações Operacionais */}
          <div className="space-y-1">
            <Label className="text-xs font-semibold text-[#1A2333]">Observações Iniciais</Label>
            <Textarea
              rows={2}
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Anotações adicionais da equipe, pendências herdadas, acordos de transição..."
              className="text-xs rounded-xl border-[#E2E8F0]"
            />
          </div>
        </form>

        <DialogFooter className="p-4 border-t border-slate-100 bg-slate-50/70 flex items-center justify-between">
          <Button
            type="button"
            variant="outline"
            disabled={loading}
            onClick={() => onOpenChange(false)}
            className="text-xs h-9 rounded-xl border-[#E2E8F0]"
          >
            Cancelar
          </Button>

          <Button
            type="button"
            disabled={loading || !empresaId}
            onClick={handleSubmit}
            className={`text-xs h-9 font-semibold rounded-xl text-white shadow-xs ${
              tipo === 'entrada'
                ? 'bg-[#0FA3A3] hover:bg-[#0C8585]'
                : 'bg-amber-600 hover:bg-amber-700'
            }`}
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                <span>Inicializando Processo...</span>
              </>
            ) : (
              <>
                <UserCheck className="h-4 w-4 mr-1.5" />
                <span>Iniciar Checklist de {tipo === 'entrada' ? 'Entrada' : 'Saída'}</span>
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
