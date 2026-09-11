import React, { useState, useEffect, useCallback } from 'react'
import {
  FileSpreadsheet,
  Plus,
  ArrowRight,
  Trash2,
  Edit,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Sparkles,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { fechoContabilService } from '@/services/fechoContabil'
import { contabilService } from '@/services/contabil'
import type { MapeamentoContabil, ContaContabil, MapeamentoOrigem } from '@/types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import { useToast } from '@/hooks/use-toast'

export default function MapeamentoContabilPage() {
  const { tenant, member } = useAuth()
  const { toast } = useToast()

  const [regras, setRegras] = useState<MapeamentoContabil[]>([])
  const [contas, setContas] = useState<ContaContabil[]>([])
  const [loading, setLoading] = useState(true)

  // Modal
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formOrigem, setFormOrigem] = useState<MapeamentoOrigem>('obrigacao')
  const [formChave, setFormChave] = useState('')
  const [formDesc, setFormDesc] = useState('')
  const [formContaDebito, setFormContaDebito] = useState('')
  const [formContaCredito, setFormContaCredito] = useState('')
  const [saving, setSaving] = useState(false)

  const canManage = member?.perfil === 'administrador' || member?.perfil === 'contador'

  const loadData = useCallback(async () => {
    if (!tenant?.id) return
    setLoading(true)
    try {
      const [maps, cts] = await Promise.all([
        fechoContabilService.listMapeamentos(tenant.id),
        contabilService.getPlanoContas(tenant.id),
      ])
      setRegras(maps)
      setContas(cts.filter((c) => !c.sintetica)) // apenas analíticas para lançamentos
    } catch (err) {
      console.error('Erro ao listar mapeamento contábil:', err)
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar',
        description: 'Não foi possível carregar as regras de mapeamento.',
      })
    } finally {
      setLoading(false)
    }
  }, [tenant?.id, toast])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleOpenModal = (regra?: MapeamentoContabil) => {
    if (regra) {
      setEditingId(regra.id)
      setFormOrigem(regra.origem)
      setFormChave(regra.chave)
      setFormDesc(regra.descricao || '')
      setFormContaDebito(regra.conta_debito)
      setFormContaCredito(regra.conta_credito)
    } else {
      setEditingId(null)
      setFormOrigem('obrigacao')
      setFormChave('')
      setFormDesc('')
      setFormContaDebito(contas[0]?.id || '')
      setFormContaCredito(contas[1]?.id || '')
    }
    setModalOpen(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!tenant?.id || !formContaDebito || !formContaCredito) return

    setSaving(true)
    try {
      if (editingId) {
        await fechoContabilService.updateMapeamento(editingId, {
          chave: formChave.trim(),
          descricao: formDesc.trim(),
          conta_debito: formContaDebito,
          conta_credito: formContaCredito,
        })
        toast({ title: 'Regra atualizada com sucesso' })
      } else {
        await fechoContabilService.createMapeamento({
          tenant_id: tenant.id,
          origem: formOrigem,
          chave: formChave.trim(),
          descricao: formDesc.trim(),
          conta_debito: formContaDebito,
          conta_credito: formContaCredito,
        })
        toast({ title: 'Regra contábil criada com sucesso' })
      }
      setModalOpen(false)
      loadData()
    } catch (err) {
      console.error('Erro ao salvar mapeamento:', err)
      toast({
        variant: 'destructive',
        title: 'Erro ao salvar',
        description: 'Verifique se os dados estão preenchidos corretamente.',
      })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string, chave: string) => {
    if (!window.confirm(`Deseja remover a regra de mapeamento para ${chave}?`)) return
    try {
      await fechoContabilService.deleteMapeamento(id)
      toast({ title: 'Regra removida' })
      loadData()
    } catch (err) {
      toast({ variant: 'destructive', title: 'Erro ao excluir' })
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold tracking-tight text-[#1A2333]">
              Mapeamento Contábil Automático
            </h2>
            <Badge className="bg-[#0FA3A3] text-white text-[11px] font-semibold">Fecho</Badge>
          </div>
          <p className="text-xs text-[#64748B]">
            Configure as contrapartidas de débito e crédito que o motor de fecho utilizará ao
            liquidar guias fiscais e classificar notas
          </p>
        </div>

        {canManage && (
          <Button
            onClick={() => handleOpenModal()}
            className="gap-2 rounded-xl text-xs font-semibold h-10 bg-[#0FA3A3] text-white hover:bg-[#0C8585]"
          >
            <Plus className="h-4 w-4" />
            <span>Nova Regra de Mapeamento</span>
          </Button>
        )}
      </div>

      {/* Tabela de Regras */}
      <div className="rounded-2xl border border-[#E2E8F0] bg-white shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F8FAFC] text-[#64748B] font-semibold border-b border-[#E2E8F0]">
              <tr>
                <th className="py-3 px-4">Origem</th>
                <th className="py-3 px-4">Chave / Tipo</th>
                <th className="py-3 px-4">Descrição da Regra</th>
                <th className="py-3 px-4">Conta Débito (+)</th>
                <th className="py-3 px-4">Conta Crédito (-)</th>
                {canManage && <th className="py-3 px-4 text-right">Ações</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-[#1A2333]">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-[#94A3B8]">
                    Carregando regras de mapeamento...
                  </td>
                </tr>
              ) : regras.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-[#94A3B8]">
                    Nenhuma regra de mapeamento configurada. Clique em &quot;Nova Regra&quot; para
                    cadastrar.
                  </td>
                </tr>
              ) : (
                regras.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3.5 px-4 font-bold">
                      {r.origem === 'obrigacao' ? (
                        <Badge className="bg-blue-100 text-[#2563EB] border-blue-200">
                          Obrigação Fiscal
                        </Badge>
                      ) : (
                        <Badge className="bg-purple-100 text-[#9333EA] border-purple-200">
                          Documento / GED
                        </Badge>
                      )}
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold text-[#0FA3A3]">{r.chave}</td>
                    <td className="py-3.5 px-4 text-[#64748B]">{r.descricao || '—'}</td>
                    <td className="py-3.5 px-4">
                      <span className="font-mono font-semibold text-[#1A2333]">
                        {r.expand?.conta_debito?.codigo}
                      </span>{' '}
                      <span className="text-[#64748B]">{r.expand?.conta_debito?.nome}</span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="font-mono font-semibold text-[#1A2333]">
                        {r.expand?.conta_credito?.codigo}
                      </span>{' '}
                      <span className="text-[#64748B]">{r.expand?.conta_credito?.nome}</span>
                    </td>
                    {canManage && (
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenModal(r)}
                            className="h-7 w-7 p-0 text-[#64748B] hover:text-[#0FA3A3]"
                          >
                            <Edit className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(r.id, r.chave)}
                            className="h-7 w-7 p-0 text-[#64748B] hover:text-[#EF4444]"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Nova / Editar Regra */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingId ? 'Editar Regra de Mapeamento' : 'Nova Regra de Mapeamento'}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Vincule a sigla da obrigação fiscal ou categoria documental às contas analíticas de
              débito e crédito.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSave} className="space-y-3 py-2 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold">Origem</Label>
                <Select
                  value={formOrigem}
                  onValueChange={(v) => setFormOrigem(v as MapeamentoOrigem)}
                  disabled={Boolean(editingId)}
                >
                  <SelectTrigger className="h-9 rounded-xl border-[#E2E8F0] mt-1 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="obrigacao">Obrigação Fiscal</SelectItem>
                    <SelectItem value="documento">Documento / GED</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs font-semibold">Chave (Ex: DAS, DARF)</Label>
                <Input
                  value={formChave}
                  onChange={(e) => setFormChave(e.target.value)}
                  placeholder="Ex: DAS ou nota_fiscal"
                  required
                  className="h-9 rounded-xl border-[#E2E8F0] mt-1 text-xs"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs font-semibold">Descrição da Regra</Label>
              <Input
                value={formDesc}
                onChange={(e) => setFormDesc(e.target.value)}
                placeholder="Ex: Guia DAS Simples Nacional / Imposto"
                className="h-9 rounded-xl border-[#E2E8F0] mt-1 text-xs"
              />
            </div>

            <div>
              <Label className="text-xs font-semibold">Conta Débito (Despesa / Obrigação)</Label>
              <Select value={formContaDebito} onValueChange={setFormContaDebito} required>
                <SelectTrigger className="h-9 rounded-xl border-[#E2E8F0] mt-1 text-xs">
                  <SelectValue placeholder="Selecione a conta analítica" />
                </SelectTrigger>
                <SelectContent className="max-h-56">
                  {contas.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.codigo} - {c.nome} ({c.tipo})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs font-semibold">
                Conta Crédito (Disponibilidade / Banco)
              </Label>
              <Select value={formContaCredito} onValueChange={setFormContaCredito} required>
                <SelectTrigger className="h-9 rounded-xl border-[#E2E8F0] mt-1 text-xs">
                  <SelectValue placeholder="Selecione a conta analítica" />
                </SelectTrigger>
                <SelectContent className="max-h-56">
                  {contas.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.codigo} - {c.nome} ({c.tipo})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setModalOpen(false)}
                className="rounded-xl text-xs"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={saving}
                className="rounded-xl text-xs bg-[#0FA3A3] text-white hover:bg-[#0C8585]"
              >
                {saving ? 'Gravando...' : 'Salvar Regra'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
