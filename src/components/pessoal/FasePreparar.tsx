/**
 * Fase Preparar do Módulo Pessoal (Fatia 5 Makro).
 * Cadastro de colaboradores (nome, CPF, cargo, salário, tipo CLT/PJ/estágio),
 * convenções coletivas e rubricas com incidências — via pessoalMakro.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ClipboardList, Loader2, Plus, Pencil, Trash2, Save, X, Users } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { pessoalMakro, type FuncionarioMakroInput } from '@/services/pessoalMakro'
import type {
  Funcionario,
  FuncionarioStatus,
  FuncionarioTipo,
  VerbaCatalogoRecord,
  VerbaTipo,
  VerbaUnidade,
} from '@/types'
import { formatCurrency, isValidCpf, maskCpf } from '@/lib/formatters'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import { RubricasQuadro } from './RubricasQuadro'

const TIPOS: Array<{ value: FuncionarioTipo; label: string }> = [
  { value: 'clt', label: 'CLT' },
  { value: 'pj', label: 'PJ' },
  { value: 'estagio', label: 'Estágio' },
]

const STATUS_LABEL: Record<FuncionarioStatus, string> = {
  ativo: 'Ativo',
  demitido: 'Demitido',
  ferias: 'Férias',
  afastado: 'Afastado',
}

const STATUS_CLASSE: Record<FuncionarioStatus, string> = {
  ativo: 'bg-emerald-50 text-emerald-600 border-emerald-200',
  demitido: 'bg-slate-50 text-slate-400 border-slate-200',
  ferias: 'bg-amber-50 text-amber-600 border-amber-200',
  afastado: 'bg-rose-50 text-rose-600 border-rose-200',
}

interface Props {
  tenantId?: string
  usuarioId?: string
  empresaId: string
  competencia: string
  aoMudar: () => void
}

export function FasePreparar({ tenantId, empresaId, competencia, aoMudar }: Props) {
  const { toast } = useToast()
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([])
  const [carregando, setCarregando] = useState(true)
  const [dialogAberto, setDialogAberto] = useState(false)
  const [editando, setEditando] = useState<Funcionario | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [busca, setBusca] = useState('')

  const [nome, setNome] = useState('')
  const [cpf, setCpf] = useState('')
  const [cargo, setCargo] = useState('')
  const [cbo, setCbo] = useState('')
  const [dataAdmissao, setDataAdmissao] = useState('')
  const [salario, setSalario] = useState('')
  const [tipo, setTipo] = useState<FuncionarioTipo>('clt')
  const [status, setStatus] = useState<FuncionarioStatus>('ativo')
  const [dependentes, setDependentes] = useState('0')

  const carregar = useCallback(async () => {
    if (!tenantId) {
      setFuncionarios([])
      setCarregando(false)
      return
    }
    setCarregando(true)
    try {
      const lista = await pessoalMakro.listarFuncionarios(
        tenantId,
        empresaId && empresaId !== 'todas' ? empresaId : undefined,
      )
      setFuncionarios(lista)
    } catch {
      setFuncionarios([])
    } finally {
      setCarregando(false)
    }
  }, [tenantId, empresaId])

  useEffect(() => {
    carregar()
  }, [carregar])

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    if (!termo) return funcionarios
    return funcionarios.filter(
      (f) =>
        f.nome_completo.toLowerCase().includes(termo) ||
        f.cargo.toLowerCase().includes(termo) ||
        (f.cpf || '').includes(termo),
    )
  }, [funcionarios, busca])

  const abrirNovo = () => {
    setEditando(null)
    setNome('')
    setCpf('')
    setCargo('')
    setCbo('')
    setDataAdmissao(new Date().toISOString().slice(0, 10))
    setSalario('')
    setTipo('clt')
    setStatus('ativo')
    setDependentes('0')
    setDialogAberto(true)
  }

  const abrirEdicao = (f: Funcionario) => {
    setEditando(f)
    setNome(f.nome_completo)
    setCpf(maskCpf(f.cpf || ''))
    setCargo(f.cargo)
    setCbo(f.cbo || '')
    setDataAdmissao((f.data_admissao || '').slice(0, 10))
    setSalario(String(f.salario ?? ''))
    setTipo(f.tipo)
    setStatus(f.status)
    setDependentes(String(f.dependentes_irrf ?? 0))
    setDialogAberto(true)
  }

  const salvar = async () => {
    if (!tenantId || !empresaId || empresaId === 'todas') {
      toast({
        title: 'Selecione uma empresa no cabeçalho',
        variant: 'destructive',
      })
      return
    }
    if (!nome.trim() || !cpf.trim() || !cargo.trim() || !salario) {
      toast({ title: 'Preencha nome, CPF, cargo e salário', variant: 'destructive' })
      return
    }
    const cpfDigitos = cpf.replace(/\D/g, '')
    if (!isValidCpf(cpfDigitos)) {
      toast({ title: 'CPF inválido — verifique os dígitos', variant: 'destructive' })
      return
    }
    setSalvando(true)
    try {
      const input: FuncionarioMakroInput = {
        empresa: empresaId,
        nome_completo: nome.trim(),
        cpf: cpfDigitos,
        cargo: cargo.trim(),
        cbo: cbo.replace(/\D/g, '') || undefined,
        data_admissao: dataAdmissao,
        salario: Number(salario.replace(',', '.')),
        tipo,
        status,
        dependentes_irrf: Number(dependentes) || 0,
      }
      if (editando) {
        await pessoalMakro.atualizarFuncionario(editando.id, input as Partial<Funcionario>)
      } else {
        await pessoalMakro.criarFuncionario(tenantId, input)
      }
      toast({ title: editando ? 'Colaborador atualizado' : 'Colaborador cadastrado' })
      setDialogAberto(false)
      await carregar()
      aoMudar()
    } catch {
      toast({ title: 'Erro ao salvar o colaborador', variant: 'destructive' })
    } finally {
      setSalvando(false)
    }
  }

  const excluir = async (f: Funcionario) => {
    try {
      await pessoalMakro.excluirFuncionario(f.id)
      toast({ title: 'Colaborador excluído' })
      await carregar()
      aoMudar()
    } catch {
      toast({ title: 'Erro ao excluir o colaborador', variant: 'destructive' })
    }
  }

  if (!tenantId || !empresaId) {
    return (
      <Card className="rounded-2xl p-4 text-xs text-slate-500">
        Selecione uma empresa no cabeçalho para gerenciar o cadastro de pessoal.
      </Card>
    )
  }

  if (carregando) {
    return (
      <Card className="rounded-2xl p-4 text-xs text-slate-500 flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando colaboradores…
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <Card className="rounded-2xl border-[#E2E8F0] p-4 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-3">
          <h4 className="text-sm font-bold text-[#1A2333] flex items-center gap-2 flex-1">
            <Users className="h-4 w-4 text-[#0FA3A3]" /> Colaboradores
            <Badge variant="outline" className="text-[10px] bg-slate-50 text-slate-500">
              {funcionarios.length} cadastrados
            </Badge>
          </h4>
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar nome, cargo ou CPF…"
            aria-label="Buscar colaborador"
            className="h-9 text-xs sm:w-56"
          />
          <Button size="sm" className="h-9 text-xs" onClick={abrirNovo}>
            <Plus className="h-3.5 w-3.5" /> Novo colaborador
          </Button>
        </div>

        {filtrados.length === 0 ? (
          <div className="py-8 text-center">
            <Users className="h-8 w-8 mx-auto text-slate-300 mb-2" aria-hidden />
            <p className="text-sm font-semibold text-[#1A2333]">
              Cadastre um colaborador para começar
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Nome, CPF, cargo e salário bastam para habilitar a folha, o 13º e as férias.
            </p>
            <Button size="sm" className="mt-3 h-8 text-xs" onClick={abrirNovo}>
              <Plus className="h-3.5 w-3.5" /> Cadastrar colaborador
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-[10px] uppercase text-slate-400 border-b">
                  <th className="py-2 pr-3 font-semibold">Nome</th>
                  <th className="py-2 pr-3 font-semibold">CPF</th>
                  <th className="py-2 pr-3 font-semibold">Cargo</th>
                  <th className="py-2 pr-3 font-semibold">Tipo</th>
                  <th className="py-2 pr-3 font-semibold text-right">Salário</th>
                  <th className="py-2 pr-3 font-semibold">Status</th>
                  <th className="py-2 font-semibold text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((f) => (
                  <tr key={f.id} className="border-b last:border-0 text-[#1A2333]">
                    <td className="py-2 pr-3 font-medium">{f.nome_completo}</td>
                    <td className="py-2 pr-3 font-mono">{maskCpf(f.cpf || '')}</td>
                    <td className="py-2 pr-3">
                      {f.cargo}
                      {f.cbo ? (
                        <span className="text-[10px] text-slate-400"> · {f.cbo}</span>
                      ) : null}
                    </td>
                    <td className="py-2 pr-3">{TIPOS.find((t) => t.value === f.tipo)?.label}</td>
                    <td className="py-2 pr-3 text-right font-mono">{formatCurrency(f.salario)}</td>
                    <td className="py-2 pr-3">
                      <span
                        className={cn(
                          'text-[10px] font-bold rounded-full px-2 py-0.5 border',
                          STATUS_CLASSE[f.status],
                        )}
                      >
                        {STATUS_LABEL[f.status]}
                      </span>
                    </td>
                    <td className="py-2 text-right whitespace-nowrap">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2"
                        onClick={() => abrirEdicao(f)}
                        aria-label={`Editar colaborador ${f.nome_completo}`}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-red-500 hover:text-red-600"
                        onClick={() => excluir(f)}
                        aria-label={`Excluir colaborador ${f.nome_completo}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <RubricasQuadro
        tenantId={tenantId}
        empresaId={empresaId}
        competencia={competencia}
        funcionarios={funcionarios}
        aoMudar={aoMudar}
      />

      <Dialog open={dialogAberto} onOpenChange={setDialogAberto}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-sm">
              {editando ? `Editar ${editando.nome_completo}` : 'Novo colaborador'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-1">
              <Label htmlFor="func-nome" className="text-[11px]">
                Nome completo
              </Label>
              <Input
                id="func-nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                autoComplete="off"
                className="h-9 text-xs"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label htmlFor="func-cpf" className="text-[11px]">
                  CPF
                </Label>
                <Input
                  id="func-cpf"
                  value={cpf}
                  onChange={(e) => setCpf(maskCpf(e.target.value))}
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="000.000.000-00"
                  className="h-9 text-xs font-mono"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="func-cargo" className="text-[11px]">
                  Cargo
                </Label>
                <Input
                  id="func-cargo"
                  value={cargo}
                  onChange={(e) => setCargo(e.target.value)}
                  autoComplete="off"
                  className="h-9 text-xs"
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <Label htmlFor="func-cbo" className="text-[11px]">
                  CBO
                </Label>
                <Input
                  id="func-cbo"
                  value={cbo}
                  onChange={(e) => setCbo(e.target.value)}
                  inputMode="numeric"
                  autoComplete="off"
                  className="h-9 text-xs font-mono"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="func-admissao" className="text-[11px]">
                  Admissão
                </Label>
                <Input
                  id="func-admissao"
                  type="date"
                  value={dataAdmissao}
                  onChange={(e) => setDataAdmissao(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="func-salario" className="text-[11px]">
                  Salário (R$)
                </Label>
                <Input
                  id="func-salario"
                  value={salario}
                  onChange={(e) => setSalario(e.target.value)}
                  inputMode="decimal"
                  autoComplete="off"
                  className="h-9 text-xs"
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <Label htmlFor="func-tipo" className="text-[11px]">
                  Tipo
                </Label>
                <Select value={tipo} onValueChange={(v) => setTipo(v as FuncionarioTipo)}>
                  <SelectTrigger id="func-tipo" className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIPOS.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="func-status" className="text-[11px]">
                  Status
                </Label>
                <Select value={status} onValueChange={(v) => setStatus(v as FuncionarioStatus)}>
                  <SelectTrigger id="func-status" className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(STATUS_LABEL) as FuncionarioStatus[]).map((s) => (
                      <SelectItem key={s} value={s}>
                        {STATUS_LABEL[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="func-dep" className="text-[11px]">
                  Dependentes IRRF
                </Label>
                <Input
                  id="func-dep"
                  value={dependentes}
                  onChange={(e) => setDependentes(e.target.value)}
                  inputMode="numeric"
                  autoComplete="off"
                  className="h-9 text-xs"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDialogAberto(false)}>
              <X className="h-3.5 w-3.5" /> Cancelar
            </Button>
            <Button size="sm" onClick={salvar} disabled={salvando}>
              {salvando ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              {editando ? 'Salvar alterações' : 'Cadastrar colaborador'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// Reexportado para uso do quadro de rubricas (evita import circular)
export type {
  VerbaCatalogoRecord as VerbaCatalogoTipo,
  VerbaTipo as VerbaTipoEnum,
  VerbaUnidade as VerbaUnidadeEnum,
  ClipboardList as ClipboardListIcon,
}
