/**
 * Dialog de lançamento manual em partida dobrada (Fase Lançamentos, Fatia 4).
 */

import { Loader2, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { ContaContabil } from '@/types'

export interface FormPartida {
  data: string
  valor: string
  historico: string
  debito: string
  credito: string
  confirmarJa: boolean
}

export const PARTIDA_VAZIA: FormPartida = {
  data: '',
  valor: '',
  historico: '',
  debito: '',
  credito: '',
  confirmarJa: true,
}

interface Props {
  aberto: boolean
  onOpenChange: (v: boolean) => void
  form: FormPartida
  setForm: (f: FormPartida) => void
  analiticas: ContaContabil[]
  salvando: boolean
  onSalvar: () => void
}

export function LancamentoManualDialog({
  aberto,
  onOpenChange,
  form,
  setForm,
  analiticas,
  salvando,
  onSalvar,
}: Props) {
  const set = <K extends keyof FormPartida>(k: K, v: FormPartida[K]) => setForm({ ...form, [k]: v })

  return (
    <Dialog open={aberto} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-sm">Novo lançamento — partida dobrada</DialogTitle>
          <DialogDescription className="text-xs">
            Cada lançamento gera automaticamente o par débito/crédito equilibrado (mesmo lote).
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3 py-1">
          <div className="space-y-1">
            <Label htmlFor="lan-data" className="text-[11px]">
              Data
            </Label>
            <Input
              id="lan-data"
              type="date"
              value={form.data}
              onChange={(e) => set('data', e.target.value)}
              className="h-9 text-xs"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="lan-valor" className="text-[11px]">
              Valor (R$)
            </Label>
            <Input
              id="lan-valor"
              inputMode="decimal"
              value={form.valor}
              onChange={(e) => set('valor', e.target.value)}
              placeholder="1500,00"
              className="h-9 text-xs"
            />
          </div>
          <div className="col-span-2 space-y-1">
            <Label htmlFor="lan-historico" className="text-[11px]">
              Histórico
            </Label>
            <Input
              id="lan-historico"
              value={form.historico}
              onChange={(e) => set('historico', e.target.value)}
              placeholder="Ex.: pagamento de fornecedor via PIX"
              className="h-9 text-xs"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="lan-debito" className="text-[11px]">
              Conta debitada
            </Label>
            <Select value={form.debito} onValueChange={(v) => set('debito', v)}>
              <SelectTrigger id="lan-debito" className="h-9 text-xs">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {analiticas.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.codigo} — {c.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="lan-credito" className="text-[11px]">
              Conta creditada
            </Label>
            <Select value={form.credito} onValueChange={(v) => set('credito', v)}>
              <SelectTrigger id="lan-credito" className="h-9 text-xs">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {analiticas.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.codigo} — {c.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <label className="col-span-2 flex items-center gap-2 text-xs text-[#64748B]">
            <input
              type="checkbox"
              checked={form.confirmarJa}
              onChange={(e) => set('confirmarJa', e.target.checked)}
              className="accent-[#0FA3A3]"
            />
            Confirmar imediatamente (senão fica como rascunho e entra nos relatórios ao confirmar)
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button size="sm" onClick={onSalvar} disabled={salvando}>
            {salvando ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Plus className="h-3.5 w-3.5" />
            )}
            Lançar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
