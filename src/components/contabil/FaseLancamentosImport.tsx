/**
 * Dialog de importação/conciliação de extrato bancário OFX/TXT
 * (Fase Lançamentos do Módulo Contábil, Fatia 4 Makro).
 */

import { useRef, useState } from 'react'
import { FileText, Loader2, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
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
import { conciliarExtrato, type ResultadoConciliacao } from '@/services/contabilMakroExtratos'
import type { ContaContabil } from '@/types'
import { useToast } from '@/hooks/use-toast'
import { formatCurrency } from '@/lib/formatters'

const fmt = (v: number) => formatCurrency(v)

interface Props {
  aberto: boolean
  onOpenChange: (v: boolean) => void
  tenantId?: string
  empresaId: string
  competencia: string
  contas: ContaContabil[]
  onConciliado: (r: ResultadoConciliacao, contaBancariaId: string, contrapartidaId: string) => void
}

export function ImportacaoExtrato({
  aberto,
  onOpenChange,
  tenantId,
  empresaId,
  competencia,
  contas,
  onConciliado,
}: Props) {
  const { toast } = useToast()
  const fileRef = useRef<HTMLInputElement>(null)
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [contaBancaria, setContaBancaria] = useState('')
  const [contrapartida, setContrapartida] = useState('')
  const [processando, setProcessando] = useState(false)
  const [preview, setPreview] = useState<ResultadoConciliacao | null>(null)

  const analiticas = contas.filter((c) => !contas.some((f) => f.pai === c.id))
  const contasBancarias = analiticas.filter((c) => /banco|caixa/i.test(c.nome))
  const contrapartidas = analiticas.filter((c) => c.id !== contaBancaria)

  const escolherArquivo = (f: File | null) => {
    setArquivo(f)
    setPreview(null)
  }

  const processar = async () => {
    if (!tenantId || !arquivo || !contaBancaria) {
      toast({
        title: 'Selecione o arquivo e a conta bancária',
        variant: 'destructive',
      })
      return
    }
    setProcessando(true)
    try {
      const texto = await arquivo.text()
      const r = await conciliarExtrato({
        texto,
        tenantId,
        empresaId,
        competencia,
        contaBancariaId: contaBancaria,
      })
      setPreview(r)
      if (r.novas.length === 0) {
        toast({
          title: 'Extrato totalmente conciliado',
          description: 'Todas as transações já possuem lançamento na competência.',
        })
      }
    } catch {
      toast({ title: 'Erro ao ler o extrato', variant: 'destructive' })
    } finally {
      setProcessando(false)
    }
  }

  const confirmar = () => {
    if (preview && contaBancaria && contrapartida) {
      onConciliado(preview, contaBancaria, contrapartida)
    } else {
      toast({
        title: 'Selecione a conta de contrapartida',
        description: 'É a conta que recebe o lançamento das transações não conciliadas.',
        variant: 'destructive',
      })
    }
  }

  return (
    <Dialog open={aberto} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-sm">Importar extrato (OFX/TXT) e conciliar</DialogTitle>
          <DialogDescription className="text-xs">
            As transações do extrato são comparadas com os lançamentos confirmados da competência
            por data e valor. As não conciliadas podem gerar lançamentos automáticos.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-1">
          <div className="space-y-1">
            <Label htmlFor="ext-arquivo" className="text-[11px]">
              Arquivo do extrato
            </Label>
            <Input
              id="ext-arquivo"
              type="file"
              accept=".ofx,.txt,text/plain"
              ref={fileRef}
              onChange={(e) => escolherArquivo(e.target.files?.[0] || null)}
              className="h-9 text-xs"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="ext-conta" className="text-[11px]">
              Conta bancária (banco/caixa)
            </Label>
            <Select value={contaBancaria} onValueChange={setContaBancaria}>
              <SelectTrigger id="ext-conta" className="h-9 text-xs">
                <SelectValue placeholder="Selecione a conta bancária" />
              </SelectTrigger>
              <SelectContent>
                {contasBancarias.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.codigo} — {c.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {contasBancarias.length === 0 && (
              <p className="text-[10px] text-amber-600">
                Nenhuma conta analítica com "banco" ou "caixa" no nome. Crie uma na fase Cadastros.
              </p>
            )}
          </div>

          <div className="space-y-1">
            <Label htmlFor="ext-contrapartida" className="text-[11px]">
              Conta de contrapartida dos lançamentos gerados
            </Label>
            <Select value={contrapartida} onValueChange={setContrapartida}>
              <SelectTrigger id="ext-contrapartida" className="h-9 text-xs">
                <SelectValue placeholder="Selecione a contrapartida" />
              </SelectTrigger>
              <SelectContent>
                {contrapartidas.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.codigo} — {c.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {processando && (
            <p className="text-xs text-slate-500 flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Processando extrato…
            </p>
          )}

          {preview && (
            <div className="rounded-lg border bg-slate-50 p-3 space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge
                  variant="outline"
                  className="text-[10px] bg-emerald-50 text-emerald-600 border-emerald-200"
                >
                  {preview.conciliadas} conciliada(s)
                </Badge>
                <Badge
                  variant="outline"
                  className="text-[10px] bg-amber-50 text-amber-600 border-amber-200"
                >
                  {preview.novas.length} nova(s)
                </Badge>
                <Badge
                  variant="outline"
                  className="text-[10px] bg-slate-50 text-slate-500 border-slate-200"
                >
                  saldo final {fmt(preview.saldoFinal)}
                </Badge>
              </div>
              {preview.novas.length > 0 && (
                <div className="max-h-40 overflow-y-auto text-[11px] text-[#1A2333] divide-y">
                  {preview.novas.map((t, i) => (
                    <div key={i} className="py-1 flex justify-between gap-2">
                      <span>
                        <FileText className="h-3 w-3 inline mr-1 text-slate-400" />
                        {t.data} — {t.descricao}
                      </span>
                      <span className="font-semibold whitespace-nowrap">{fmt(t.valor)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={processar}
            disabled={processando || !arquivo || !contaBancaria}
          >
            {processando ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Upload className="h-3.5 w-3.5" />
            )}
            Processar
          </Button>
          <Button size="sm" onClick={confirmar} disabled={!preview || preview.novas.length === 0}>
            Gerar lançamentos ({preview?.novas.length || 0})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
