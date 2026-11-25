/**
 * Quadro de rubricas (catálogo de verbas) da fase Preparar — Fatia 5 Pessoal.
 * CRUD com incidências INSS/IRRF/FGTS via verbasService (listCatalogo etc.).
 */

import { useCallback, useEffect, useState } from 'react'
import { Coins, Loader2, Plus, Trash2 } from 'lucide-react'
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
import { Switch } from '@/components/ui/switch'
import { verbasService, type CreateVerbaCatalogoInput } from '@/services/verbas'
import type { VerbaCatalogoRecord, VerbaTipo, VerbaUnidade } from '@/types'
import { formatCurrency } from '@/lib/formatters'
import { useToast } from '@/hooks/use-toast'

interface Props {
  tenantId?: string
  empresaId: string
  competencia: string
  funcionarios: unknown[]
  aoMudar: () => void
}

const UNIDADES: Array<{ value: VerbaUnidade; label: string }> = [
  { value: 'valor_fixo', label: 'Valor fixo' },
  { value: 'percentual', label: 'Percentual' },
  { value: 'horas', label: 'Horas' },
  { value: 'dias', label: 'Dias' },
]

export function RubricasQuadro({ tenantId, empresaId, aoMudar }: Props) {
  const { toast } = useToast()
  const [rubricas, setRubricas] = useState<VerbaCatalogoRecord[]>([])
  const [carregando, setCarregando] = useState(true)
  const [dialogAberto, setDialogAberto] = useState(false)
  const [salvando, setSalvando] = useState(false)

  const [codigo, setCodigo] = useState('')
  const [descricao, setDescricao] = useState('')
  const [tipo, setTipo] = useState<VerbaTipo>('provento')
  const [unidade, setUnidade] = useState<VerbaUnidade>('valor_fixo')
  const [valorPadrao, setValorPadrao] = useState('')
  const [rubricaEsocial, setRubricaEsocial] = useState('')
  const [incideInss, setIncideInss] = useState(false)
  const [incideIrrf, setIncideIrrf] = useState(false)
  const [incideFgts, setIncideFgts] = useState(false)

  const carregar = useCallback(async () => {
    if (!tenantId || !empresaId || empresaId === 'todas') {
      setRubricas([])
      setCarregando(false)
      return
    }
    setCarregando(true)
    try {
      const itens = await verbasService.listCatalogo(tenantId, empresaId)
      setRubricas(itens.filter((r) => r.ativo !== false))
    } catch {
      setRubricas([])
    } finally {
      setCarregando(false)
    }
  }, [tenantId, empresaId])

  useEffect(() => {
    carregar()
  }, [carregar])

  const salvar = async () => {
    if (!tenantId || !codigo.trim() || !descricao.trim()) {
      toast({ title: 'Informe código e descrição da rubrica', variant: 'destructive' })
      return
    }
    setSalvando(true)
    try {
      const input: CreateVerbaCatalogoInput = {
        tenant_id: tenantId,
        empresa: empresaId,
        valor_padrao: valorPadrao ? Number(valorPadrao.replace(',', '.')) : 0,
        codigo: codigo.trim(),
        descricao: descricao.trim(),
        tipo,
        unidade,
        rubrica_esocial: rubricaEsocial.trim(),
        incide_inss: incideInss,
        incide_irrf: incideIrrf,
        incide_fgts: incideFgts,
        integra_salario_contrib: incideInss,
        reflexo_dsr: false,
        reflexo_ferias_13: false,
        ativo: true,
      }
      await verbasService.createVerbaCatalogo(input, tenantId)
      toast({ title: 'Rubrica criada' })
      setDialogAberto(false)
      setCodigo('')
      setDescricao('')
      setValorPadrao('')
      setRubricaEsocial('')
      await carregar()
      aoMudar()
    } catch {
      toast({ title: 'Erro ao criar a rubrica', variant: 'destructive' })
    } finally {
      setSalvando(false)
    }
  }

  const excluir = async (r: VerbaCatalogoRecord) => {
    try {
      await verbasService.deleteVerbaCatalogo(r.id, tenantId)
      toast({ title: 'Rubrica excluída' })
      await carregar()
      aoMudar()
    } catch {
      toast({ title: 'Erro ao excluir a rubrica', variant: 'destructive' })
    }
  }

  if (!tenantId || !empresaId || empresaId === 'todas') {
    return (
      <Card className="rounded-2xl border-[#E2E8F0] p-4 shadow-2xs">
        <h4 className="text-sm font-bold text-[#1A2333] flex items-center gap-2">
          <Coins className="h-4 w-4 text-[#0FA3A3]" /> Rubricas
        </h4>
        <p className="text-xs text-slate-500 mt-2">
          Selecione uma empresa no cabeçalho para gerenciar o catálogo de rubricas.
        </p>
      </Card>
    )
  }

  return (
    <Card className="rounded-2xl border-[#E2E8F0] p-4 shadow-2xs">
      <div className="flex items-center gap-2 mb-3">
        <h4 className="text-sm font-bold text-[#1A2333] flex items-center gap-2 flex-1">
          <Coins className="h-4 w-4 text-[#0FA3A3]" /> Rubricas e incidências
          <Badge variant="outline" className="text-[10px] bg-slate-50 text-slate-500">
            {rubricas.length} no catálogo
          </Badge>
        </h4>
        <Button
          size="sm"
          variant="outline"
          className="h-8 text-xs"
          onClick={() => setDialogAberto(true)}
        >
          <Plus className="h-3.5 w-3.5" /> Nova rubrica
        </Button>
      </div>

      {carregando ? (
        <p className="text-xs text-slate-500 flex items-center gap-2 py-3">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Carregando rubricas…
        </p>
      ) : rubricas.length === 0 ? (
        <p className="text-xs text-slate-500 py-3">
          Nenhuma rubrica cadastrada para esta empresa — crie a primeira para lançar verbas
          variáveis na folha.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-[10px] uppercase text-slate-400 border-b">
                <th className="py-2 pr-3 font-semibold">Código</th>
                <th className="py-2 pr-3 font-semibold">Descrição</th>
                <th className="py-2 pr-3 font-semibold">Tipo</th>
                <th className="py-2 pr-3 font-semibold">Unidade</th>
                <th className="py-2 pr-3 font-semibold text-right">Valor padrão</th>
                <th className="py-2 pr-3 font-semibold">Incidências</th>
                <th className="py-2 font-semibold text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {rubricas.map((r) => (
                <tr key={r.id} className="border-b last:border-0 text-[#1A2333]">
                  <td className="py-2 pr-3 font-mono">{r.codigo}</td>
                  <td className="py-2 pr-3 font-medium">{r.descricao}</td>
                  <td className="py-2 pr-3 capitalize">{r.tipo}</td>
                  <td className="py-2 pr-3">
                    {UNIDADES.find((u) => u.value === r.unidade)?.label ?? r.unidade}
                  </td>
                  <td className="py-2 pr-3 text-right font-mono">
                    {formatCurrency(r.valor_padrao ?? 0)}
                  </td>
                  <td className="py-2 pr-3">
                    <span className="flex gap-1">
                      {r.incide_inss ? (
                        <Badge
                          className="text-[9px] bg-sky-50 text-sky-600 border-sky-200"
                          variant="outline"
                        >
                          INSS
                        </Badge>
                      ) : null}
                      {r.incide_irrf ? (
                        <Badge
                          className="text-[9px] bg-violet-50 text-violet-600 border-violet-200"
                          variant="outline"
                        >
                          IRRF
                        </Badge>
                      ) : null}
                      {r.incide_fgts ? (
                        <Badge
                          className="text-[9px] bg-emerald-50 text-emerald-600 border-emerald-200"
                          variant="outline"
                        >
                          FGTS
                        </Badge>
                      ) : null}
                    </span>
                  </td>
                  <td className="py-2 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-red-500 hover:text-red-600"
                      onClick={() => excluir(r)}
                      aria-label={`Excluir rubrica ${r.descricao}`}
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

      <Dialog open={dialogAberto} onOpenChange={setDialogAberto}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm">Nova rubrica</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label htmlFor="rub-codigo" className="text-[11px]">
                  Código
                </Label>
                <Input
                  id="rub-codigo"
                  value={codigo}
                  onChange={(e) => setCodigo(e.target.value)}
                  autoComplete="off"
                  className="h-9 text-xs font-mono"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="rub-esocial" className="text-[11px]">
                  Rubrica eSocial
                </Label>
                <Input
                  id="rub-esocial"
                  value={rubricaEsocial}
                  onChange={(e) => setRubricaEsocial(e.target.value)}
                  autoComplete="off"
                  className="h-9 text-xs font-mono"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="rub-descricao" className="text-[11px]">
                Descrição
              </Label>
              <Input
                id="rub-descricao"
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                autoComplete="off"
                className="h-9 text-xs"
              />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <Label htmlFor="rub-tipo" className="text-[11px]">
                  Tipo
                </Label>
                <Select value={tipo} onValueChange={(v) => setTipo(v as VerbaTipo)}>
                  <SelectTrigger id="rub-tipo" className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="provento">Provento</SelectItem>
                    <SelectItem value="desconto">Desconto</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="rub-unidade" className="text-[11px]">
                  Unidade
                </Label>
                <Select value={unidade} onValueChange={(v) => setUnidade(v as VerbaUnidade)}>
                  <SelectTrigger id="rub-unidade" className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {UNIDADES.map((u) => (
                      <SelectItem key={u.value} value={u.value}>
                        {u.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="rub-valor" className="text-[11px]">
                  Valor padrão
                </Label>
                <Input
                  id="rub-valor"
                  value={valorPadrao}
                  onChange={(e) => setValorPadrao(e.target.value)}
                  inputMode="decimal"
                  autoComplete="off"
                  className="h-9 text-xs"
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 pt-1">
              <span className="flex items-center gap-2 text-[11px] text-slate-600">
                <Switch checked={incideInss} onCheckedChange={setIncideInss} id="rub-inss" /> INSS
              </span>
              <span className="flex items-center gap-2 text-[11px] text-slate-600">
                <Switch checked={incideIrrf} onCheckedChange={setIncideIrrf} id="rub-irrf" /> IRRF
              </span>
              <span className="flex items-center gap-2 text-[11px] text-slate-600">
                <Switch checked={incideFgts} onCheckedChange={setIncideFgts} id="rub-fgts" /> FGTS
              </span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDialogAberto(false)}>
              Cancelar
            </Button>
            <Button size="sm" onClick={salvar} disabled={salvando}>
              {salvando ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Plus className="h-3.5 w-3.5" />
              )}
              Criar rubrica
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
