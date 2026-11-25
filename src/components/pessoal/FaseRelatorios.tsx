/**
 * Fase Relatórios do Módulo Pessoal (Fatia 5 Makro).
 * Recibo de pagamento (montarReciboPagamento) e relatório gerencial da folha
 * (montarRelatorioGerencial, com opção de exibição de CBO) — via pessoalMakro.
 */

import { useCallback, useEffect, useState } from 'react'
import { FileText, Loader2, ReceiptText, Users } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { pessoalMakro } from '@/services/pessoalMakro'
import type { FolhaPagamento, Funcionario } from '@/types'
import { formatCurrency } from '@/lib/formatters'
import { cn } from '@/lib/utils'

interface Props {
  tenantId?: string
  empresaId: string
  empresaNome: string
  competencia: string
}

function toNum(v: unknown): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

export function FaseRelatorios({ tenantId, empresaId, empresaNome, competencia }: Props) {
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([])
  const [folha, setFolha] = useState<FolhaPagamento[]>([])
  const [carregando, setCarregando] = useState(true)
  const [exibirCbo, setExibirCbo] = useState(false)
  const [funcionarioRecibo, setFuncionarioRecibo] = useState('')

  const carregar = useCallback(async () => {
    if (!tenantId || !empresaId || empresaId === 'todas') {
      setFuncionarios([])
      setFolha([])
      setCarregando(false)
      return
    }
    setCarregando(true)
    try {
      const [funcs, fls] = await Promise.all([
        pessoalMakro.listarFuncionarios(tenantId, empresaId),
        pessoalMakro.listarFolha(tenantId, competencia, empresaId).catch(() => []),
      ])
      setFuncionarios(funcs)
      setFolha(fls)
      setFuncionarioRecibo((atual) =>
        funcs.some((f) => f.id === atual) ? atual : (funcs[0]?.id ?? ''),
      )
    } catch {
      setFuncionarios([])
      setFolha([])
    } finally {
      setCarregando(false)
    }
  }, [tenantId, empresaId, competencia])

  useEffect(() => {
    carregar()
  }, [carregar])

  const recibo = (() => {
    const func = funcionarios.find((f) => f.id === funcionarioRecibo)
    if (!func) return null
    const folhaFunc = folha.find((f) => f.funcionario === func.id)
    return pessoalMakro.montarReciboPagamento({
      empresaNome: empresaNome || 'Empresa',
      competencia,
      funcionario: func,
      folha: folhaFunc,
    })
  })()

  const gerencial = pessoalMakro.montarRelatorioGerencial({
    funcionarios,
    folha,
    incluirCbo: exibirCbo,
  })

  if (!tenantId || !empresaId || empresaId === 'todas') {
    return (
      <Card className="rounded-2xl p-4 text-xs text-slate-500">
        Selecione uma empresa no cabeçalho para emitir os relatórios.
      </Card>
    )
  }

  if (carregando) {
    return (
      <Card className="rounded-2xl p-4 text-xs text-slate-500 flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando relatórios…
      </Card>
    )
  }

  if (funcionarios.length === 0) {
    return (
      <Card className="rounded-2xl border-[#E2E8F0] p-4 shadow-2xs">
        <div className="py-8 text-center">
          <Users className="h-8 w-8 mx-auto text-slate-300 mb-2" aria-hidden />
          <p className="text-sm font-semibold text-[#1A2333]">
            Cadastre um colaborador para começar
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Recibo de pagamento e relatório gerencial aparecem aqui após o cadastro na fase
            Preparar.
          </p>
        </div>
      </Card>
    )
  }

  const totalFuncionarios = gerencial.linhas.length

  return (
    <div className="space-y-4">
      {/* Relatório gerencial */}
      <Card className="rounded-2xl border-[#E2E8F0] p-4 shadow-2xs">
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <h4 className="text-sm font-bold text-[#1A2333] flex items-center gap-2 flex-1 min-w-0">
            <FileText className="h-4 w-4 text-[#0FA3A3]" /> Relatório gerencial · {competencia}
            <Badge variant="outline" className="text-[10px] bg-slate-50 text-slate-500">
              {totalFuncionarios} colaborador(es)
            </Badge>
          </h4>
          <span className="flex items-center gap-2 text-xs text-slate-600">
            <Checkbox
              id="exibir-cbo"
              checked={exibirCbo}
              onCheckedChange={(v) => setExibirCbo(v === true)}
            />
            <Label htmlFor="exibir-cbo" className="text-xs cursor-pointer">
              Exibir CBO
            </Label>
          </span>
        </div>

        {gerencial.linhas.length === 0 ? (
          <p className="text-xs text-slate-500 py-3">
            Nenhum colaborador ativo para esta empresa — o relatório gerencial considera apenas
            colaboradores não demitidos.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-[10px] uppercase text-slate-400 border-b">
                  <th className="py-2 pr-3 font-semibold">Colaborador</th>
                  <th className="py-2 pr-3 font-semibold">Cargo</th>
                  {exibirCbo ? <th className="py-2 pr-3 font-semibold">CBO</th> : null}
                  <th className="py-2 pr-3 font-semibold text-right">Salário</th>
                  <th className="py-2 pr-3 font-semibold text-right">Proventos</th>
                  <th className="py-2 pr-3 font-semibold text-right">Descontos</th>
                  <th className="py-2 pr-3 font-semibold text-right">Líquido</th>
                  <th className="py-2 pr-3 font-semibold text-right">INSS</th>
                  <th className="py-2 pr-3 font-semibold text-right">IRRF</th>
                  <th className="py-2 pr-3 font-semibold text-right">FGTS</th>
                  <th className="py-2 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {gerencial.linhas.map((l) => (
                  <tr key={l.nome} className="border-b last:border-0 text-[#1A2333]">
                    <td className="py-2 pr-3 font-medium">{l.nome}</td>
                    <td className="py-2 pr-3">{l.cargo || '—'}</td>
                    {exibirCbo ? <td className="py-2 pr-3 font-mono">{l.cbo || '—'}</td> : null}
                    <td className="py-2 pr-3 text-right font-mono">{formatCurrency(l.salario)}</td>
                    <td className="py-2 pr-3 text-right font-mono">
                      {formatCurrency(l.proventos)}
                    </td>
                    <td className="py-2 pr-3 text-right font-mono">
                      {formatCurrency(l.descontos)}
                    </td>
                    <td className="py-2 pr-3 text-right font-mono font-semibold">
                      {formatCurrency(l.liquido)}
                    </td>
                    <td className="py-2 pr-3 text-right font-mono text-slate-500">
                      {formatCurrency(l.inss)}
                    </td>
                    <td className="py-2 pr-3 text-right font-mono text-slate-500">
                      {formatCurrency(l.irrf)}
                    </td>
                    <td className="py-2 pr-3 text-right font-mono text-slate-500">
                      {formatCurrency(l.fgts)}
                    </td>
                    <td className="py-2">
                      <Badge
                        variant="outline"
                        className="text-[10px] bg-slate-50 text-slate-600 border-slate-200 capitalize"
                      >
                        {l.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
                <tr className="font-semibold text-[#1A2333]">
                  <td className="py-2 pr-3" colSpan={exibirCbo ? 3 : 2}>
                    Totais
                  </td>
                  <td className="py-2 pr-3 text-right font-mono">
                    {formatCurrency(gerencial.totais.salario)}
                  </td>
                  <td className="py-2 pr-3" />
                  <td className="py-2 pr-3" />
                  <td className="py-2 pr-3 text-right font-mono">
                    {formatCurrency(gerencial.totais.liquido)}
                  </td>
                  <td className="py-2 pr-3 text-right font-mono">
                    {formatCurrency(gerencial.totais.inss)}
                  </td>
                  <td className="py-2 pr-3 text-right font-mono">
                    {formatCurrency(gerencial.totais.irrf)}
                  </td>
                  <td className="py-2 pr-3 text-right font-mono">
                    {formatCurrency(gerencial.totais.fgts)}
                  </td>
                  <td />
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Recibo de pagamento */}
      <Card className="rounded-2xl border-[#E2E8F0] p-4 shadow-2xs">
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <h4 className="text-sm font-bold text-[#1A2333] flex items-center gap-2 flex-1 min-w-0">
            <ReceiptText className="h-4 w-4 text-[#0FA3A3]" /> Recibo de pagamento · {competencia}
          </h4>
          <span className="flex items-center gap-2">
            <Label htmlFor="recibo-colaborador" className="text-[11px] text-slate-600">
              Colaborador
            </Label>
            <Select value={funcionarioRecibo} onValueChange={setFuncionarioRecibo}>
              <SelectTrigger className="h-8 w-56 text-xs" aria-label="Selecionar colaborador">
                <SelectValue placeholder="Selecione o colaborador" />
              </SelectTrigger>
              <SelectContent>
                {funcionarios.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.nome_completo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </span>
        </div>

        {!recibo ? (
          <p className="text-xs text-slate-500 py-3">
            Selecione um colaborador para visualizar o recibo de pagamento.
          </p>
        ) : recibo.linhas.length === 0 ? (
          <div className="py-8 text-center">
            <ReceiptText className="h-8 w-8 mx-auto text-slate-300 mb-2" aria-hidden />
            <p className="text-sm font-semibold text-[#1A2333]">
              Sem folha calculada para este colaborador
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Calcule a folha na fase Movimentações para emitir o recibo de {competencia}.
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-[#E2E8F0] overflow-hidden">
            <div className="px-3 py-2 bg-slate-50 border-b border-[#E2E8F0]">
              <p className="text-xs font-bold text-[#1A2333]">{recibo.titulo}</p>
              <p className="text-[10px] text-slate-500">
                {recibo.fgtsInformativo > 0
                  ? `FGTS do mês (informativo): ${formatCurrency(recibo.fgtsInformativo)}`
                  : 'FGTS do mês (informativo): —'}
              </p>
            </div>
            <table className="w-full text-xs">
              <tbody>
                {recibo.linhas.map((l, i) => (
                  <tr
                    key={`${l.descricao}-${i}`}
                    className={cn(
                      'border-b last:border-0',
                      l.valor < 0 ? 'text-red-600' : 'text-[#1A2333]',
                    )}
                  >
                    <td className="py-1.5 px-3">{l.descricao}</td>
                    <td className="py-1.5 px-3 text-slate-400">{l.referencia || ''}</td>
                    <td className="py-1.5 px-3 text-right font-mono">{formatCurrency(l.valor)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50 text-[#1A2333]">
                  <td className="py-2 px-3 font-semibold" colSpan={2}>
                    Total de proventos
                  </td>
                  <td className="py-2 px-3 text-right font-mono font-semibold">
                    {formatCurrency(recibo.totalProventos)}
                  </td>
                </tr>
                <tr className="bg-slate-50 text-[#1A2333]">
                  <td className="py-2 px-3 font-semibold" colSpan={2}>
                    Total de descontos
                  </td>
                  <td className="py-2 px-3 text-right font-mono font-semibold">
                    {formatCurrency(recibo.totalDescontos)}
                  </td>
                </tr>
                <tr className="bg-[#0FA3A3]/10 text-[#1A2333]">
                  <td className="py-2 px-3 font-bold" colSpan={2}>
                    Líquido a receber
                  </td>
                  <td className="py-2 px-3 text-right font-mono font-bold">
                    {formatCurrency(toNum(recibo.totalLiquido))}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
