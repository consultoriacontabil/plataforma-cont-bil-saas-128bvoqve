import { useState, useEffect } from 'react'
import {
  FileText,
  Plus,
  Trash2,
  RotateCcw,
  Save,
  Send,
  Loader2,
  Building2,
  Calendar,
  DollarSign,
  Clock,
  Layers,
  HelpCircle,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
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
import { useToast } from '@/hooks/use-toast'
import { contratosService, MODELO_CLAUSULAS_PADRAO } from '@/services/contratos'
import type {
  ContratoHonorarioRecord,
  Empresa,
  TipoContratoHonorario,
  ClausulaContrato,
} from '@/types'

interface ContratoEditorModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  contrato: ContratoHonorarioRecord | null
  empresas: Empresa[]
  tenantId: string
  userId?: string
  onSaved: () => void
}

export function ContratoEditorModal({
  open,
  onOpenChange,
  contrato,
  empresas,
  tenantId,
  userId,
  onSaved,
}: ContratoEditorModalProps) {
  const { toast } = useToast()

  const [tipo, setTipo] = useState<TipoContratoHonorario>('contrato')
  const [empresaId, setEmpresaId] = useState<string>('nenhuma')
  const [titulo, setTitulo] = useState('')
  const [modeloMensalidade, setModeloMensalidade] = useState('mensal_fixo')
  const [valorMensal, setValorMensal] = useState<number>(2500)
  const [diaVencimento, setDiaVencimento] = useState<number>(10)
  const [prazoContrato, setPrazoContrato] = useState<number>(12)
  const [dataInicio, setDataInicio] = useState<string>('2026-10-01')
  const [clausulas, setClausulas] = useState<ClausulaContrato[]>(MODELO_CLAUSULAS_PADRAO)
  const [loading, setLoading] = useState(false)

  // Resetar ou carregar contrato selecionado
  useEffect(() => {
    if (contrato) {
      setTipo(contrato.tipo || 'contrato')
      setEmpresaId(contrato.empresa || 'nenhuma')
      setTitulo(contrato.titulo || '')
      setModeloMensalidade(contrato.modelo_mensalidade || 'mensal_fixo')
      setValorMensal(contrato.valor_mensal ?? 2500)
      setDiaVencimento(contrato.dia_vencimento ?? 10)
      setPrazoContrato(contrato.prazo_contrato ?? 12)
      setDataInicio(contrato.data_inicio ? contrato.data_inicio.slice(0, 10) : '2026-10-01')
      if (Array.isArray(contrato.clausulas) && contrato.clausulas.length > 0) {
        setClausulas(contrato.clausulas)
      } else {
        setClausulas(MODELO_CLAUSULAS_PADRAO)
      }
    } else {
      setTipo('contrato')
      setEmpresaId('nenhuma')
      setTitulo('Contrato de Prestação de Serviços Contábeis')
      setModeloMensalidade('mensal_fixo')
      setValorMensal(2500)
      setDiaVencimento(10)
      setPrazoContrato(12)
      setDataInicio('2026-10-01')
      setClausulas(MODELO_CLAUSULAS_PADRAO)
    }
  }, [contrato, open])

  // Ajustar título dinamicamente se trocar empresa ou tipo quando estiver criando
  const handleEmpresaChange = (empId: string) => {
    setEmpresaId(empId)
    if (!contrato) {
      const emp = empresas.find((e) => e.id === empId)
      const nomeEmp = emp ? emp.nome_fantasia || emp.razao_social : 'Novo Cliente'
      const prefixo =
        tipo === 'proposta'
          ? 'Proposta Comercial Contábil — '
          : 'Contrato de Prestação de Serviços — '
      setTitulo(`${prefixo}${nomeEmp}`)
    }
  }

  const handleTipoChange = (newTipo: TipoContratoHonorario) => {
    setTipo(newTipo)
    if (!contrato) {
      const emp = empresas.find((e) => e.id === empresaId)
      const nomeEmp = emp ? emp.nome_fantasia || emp.razao_social : 'Cliente Prospect'
      const prefixo =
        newTipo === 'proposta'
          ? 'Proposta Comercial Contábil — '
          : 'Contrato de Prestação de Serviços — '
      setTitulo(`${prefixo}${nomeEmp}`)
    }
  }

  // Cláusulas: adicionar, alterar e remover
  const handleAddClausula = () => {
    const num = clausulas.length + 1
    setClausulas([
      ...clausulas,
      {
        titulo: `Cláusula ${num}ª — Nova Disposição`,
        texto: 'Descreva aqui as condições ou termos específicos acordados entre as partes.',
      },
    ])
  }

  const handleUpdateClausula = (index: number, campo: 'titulo' | 'texto', valor: string) => {
    const updated = [...clausulas]
    updated[index] = {
      ...updated[index],
      [campo]: valor,
    }
    setClausulas(updated)
  }

  const handleRemoveClausula = (index: number) => {
    if (clausulas.length <= 1) {
      toast({
        title: 'Aviso',
        description: 'O documento precisa ter pelo menos uma cláusula.',
      })
      return
    }
    setClausulas(clausulas.filter((_, i) => i !== index))
  }

  const handleResetModeloPadrao = () => {
    setClausulas(MODELO_CLAUSULAS_PADRAO)
    toast({
      title: 'Modelo padrão restaurado',
      description:
        'As 8 cláusulas contábeis completas em conformidade com o CFC foram recarregadas.',
    })
  }

  const handleSave = async (novoStatus?: 'rascunho' | 'enviado') => {
    if (!titulo.trim()) {
      toast({
        title: 'Título obrigatório',
        description: 'Preencha o título do contrato ou da proposta.',
        variant: 'destructive',
      })
      return
    }

    try {
      setLoading(true)
      const statusFinal = novoStatus || contrato?.status || 'rascunho'

      if (contrato) {
        await contratosService.update(contrato.id, {
          titulo: titulo.trim(),
          tipo,
          empresaId: empresaId,
          modeloMensalidade,
          valorMensal,
          diaVencimento,
          prazoContrato,
          dataInicio,
          clausulas,
          status: statusFinal,
        })
        toast({
          title: 'Alterações salvas!',
          description: 'A proposta/contrato foi atualizada com sucesso.',
        })
      } else {
        await contratosService.create({
          tenantId,
          titulo: titulo.trim(),
          tipo,
          empresaId: empresaId,
          modeloMensalidade,
          valorMensal,
          diaVencimento,
          prazoContrato,
          dataInicio,
          clausulas,
          status: statusFinal,
          criadoPor: userId,
        })
        toast({
          title: 'Documento criado!',
          description: `${tipo === 'proposta' ? 'Proposta' : 'Contrato'} registrado como rascunho.`,
        })
      }

      onOpenChange(false)
      onSaved()
    } catch (err: unknown) {
      console.error('Erro ao salvar contrato:', err)
      const msg = err instanceof Error ? err.message : 'Falha ao salvar contrato.'
      toast({
        title: 'Erro ao salvar',
        description: msg,
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] flex flex-col p-0 overflow-hidden rounded-2xl bg-white border-[#E2E8F0]">
        <DialogHeader className="p-4 px-6 border-b border-[#E2E8F0] bg-slate-50/70">
          <div className="flex items-center gap-2 text-[#0FA3A3] mb-1">
            <FileText className="h-5 w-5" />
            <span className="text-xs font-bold uppercase tracking-wider">
              {contrato ? 'Editar Documento Contábil' : 'Novo Contrato ou Proposta de Honorários'}
            </span>
          </div>
          <DialogTitle className="text-lg font-bold text-[#1A2333]">
            {contrato ? contrato.titulo : 'Elaboração de Honorários e Cláusulas'}
          </DialogTitle>
          <DialogDescription className="text-xs text-[#64748B]">
            Configure as cláusulas do padrão contábil Rumo, vigência e valores mensais para
            assinatura digital.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Seção 1: Dados Gerais e Classificação */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#0FA3A3] border-b pb-1">
              1. Identificação e Tomador dos Serviços
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label className="text-xs font-semibold text-[#1A2333]">Tipo do Documento *</Label>
                <Select
                  value={tipo}
                  onValueChange={(val) => handleTipoChange(val as TipoContratoHonorario)}
                >
                  <SelectTrigger className="mt-1 h-9 text-xs rounded-xl border-[#E2E8F0]">
                    <SelectValue placeholder="Selecione o tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="contrato">Contrato de Honorários</SelectItem>
                    <SelectItem value="proposta">Proposta Comercial</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="md:col-span-2">
                <Label className="text-xs font-semibold text-[#1A2333]">
                  Empresa Contratante (ou Prospect)
                </Label>
                <Select value={empresaId} onValueChange={handleEmpresaChange}>
                  <SelectTrigger className="mt-1 h-9 text-xs rounded-xl border-[#E2E8F0]">
                    <SelectValue placeholder="Selecione a empresa cadastrada ou prospect" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nenhuma">
                      (Sem empresa vinculada — Prospect em negociação)
                    </SelectItem>
                    {empresas.map((emp) => (
                      <SelectItem key={emp.id} value={emp.id}>
                        {emp.razao_social || emp.nome_fantasia} (CNPJ: {emp.cnpj || 'Sem CNPJ'})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="text-xs font-semibold text-[#1A2333]">Título do Documento *</Label>
              <Input
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                placeholder="Ex.: Contrato de Prestação de Serviços Contábeis e Fiscais — Inovatech"
                className="mt-1 h-9 text-xs rounded-xl border-[#E2E8F0]"
              />
            </div>
          </div>

          {/* Seção 2: Modelo de Cobrança e Condições Comerciais */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#0FA3A3] border-b pb-1">
              2. Modelo de Honorários & Parâmetros Financeiros
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <Label className="text-xs font-semibold text-[#1A2333]">
                  Modelo de Mensalidade *
                </Label>
                <Select value={modeloMensalidade} onValueChange={setModeloMensalidade}>
                  <SelectTrigger className="mt-1 h-9 text-xs rounded-xl border-[#E2E8F0]">
                    <SelectValue placeholder="Selecione o modelo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mensal_fixo">Mensal Fixo</SelectItem>
                    <SelectItem value="por_funcionario">Por Funcionário Ativo</SelectItem>
                    <SelectItem value="por_notas">Por Volume de Notas</SelectItem>
                    <SelectItem value="eventuais">Eventuais / BPO Específico</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs font-semibold text-[#1A2333]">Valor Mensal (R$) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={valorMensal}
                  onChange={(e) => setValorMensal(parseFloat(e.target.value) || 0)}
                  className="mt-1 h-9 text-xs rounded-xl border-[#E2E8F0]"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold text-[#1A2333]">Dia do Vencimento *</Label>
                <Input
                  type="number"
                  min="1"
                  max="31"
                  value={diaVencimento}
                  onChange={(e) => setDiaVencimento(parseInt(e.target.value, 10) || 10)}
                  className="mt-1 h-9 text-xs rounded-xl border-[#E2E8F0]"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold text-[#1A2333]">
                  Prazo Vigência (meses)
                </Label>
                <Input
                  type="number"
                  min="1"
                  value={prazoContrato}
                  onChange={(e) => setPrazoContrato(parseInt(e.target.value, 10) || 12)}
                  className="mt-1 h-9 text-xs rounded-xl border-[#E2E8F0]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs font-semibold text-[#1A2333]">
                  Data de Início da Vigência
                </Label>
                <Input
                  type="date"
                  value={dataInicio}
                  onChange={(e) => setDataInicio(e.target.value)}
                  className="mt-1 h-9 text-xs rounded-xl border-[#E2E8F0]"
                />
              </div>
            </div>
          </div>

          {/* Seção 3: Editor de Cláusulas Contratuais */}
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b pb-2">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#0FA3A3]">
                  3. Cláusulas e Condições Gerais ({clausulas.length})
                </h3>
                <p className="text-[11px] text-[#64748B]">
                  Edite, adicione ou remova cláusulas técnicas conforme o escopo negociado.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleResetModeloPadrao}
                  className="h-8 text-xs rounded-xl border-[#E2E8F0] gap-1 text-[#64748B]"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Restaurar Padrão Contábil</span>
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleAddClausula}
                  className="h-8 text-xs rounded-xl bg-[#0FA3A3] hover:bg-[#0D8B8B] text-white gap-1"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Adicionar Cláusula</span>
                </Button>
              </div>
            </div>

            <div className="space-y-4">
              {clausulas.map((c, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2 hover:border-[#0FA3A3]/50 transition-colors"
                >
                  <div className="flex items-center justify-between gap-3">
                    <Input
                      value={c.titulo}
                      onChange={(e) => handleUpdateClausula(idx, 'titulo', e.target.value)}
                      placeholder="Título da Cláusula"
                      className="h-8 text-xs font-bold text-[#0B1F3A] bg-white rounded-lg border-slate-200"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveClausula(idx)}
                      className="h-8 w-8 p-0 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg shrink-0"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <Textarea
                    value={c.texto}
                    onChange={(e) => handleUpdateClausula(idx, 'texto', e.target.value)}
                    placeholder="Texto completo da cláusula..."
                    rows={3}
                    className="text-xs leading-relaxed bg-white rounded-lg border-slate-200 resize-y"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter className="p-4 px-6 border-t border-[#E2E8F0] bg-slate-50/70 flex items-center justify-between">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={loading}
            className="text-xs text-[#64748B]"
          >
            Cancelar
          </Button>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleSave('rascunho')}
              disabled={loading}
              className="rounded-xl text-xs font-semibold border-[#E2E8F0] h-9 gap-1.5"
            >
              <Save className="h-4 w-4 text-[#0FA3A3]" />
              <span>Salvar Rascunho</span>
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
