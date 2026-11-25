/**
 * Fase Relatórios do Módulo Pessoal (Fatia 5 Makro).
 * Recibo de pagamento por colaborador/competência e relatório gerencial da
 * folha, com opção de exibição de CBO (spec Makro: "relatórios gerenciais com
 * opção de exibição de CBO e vencimentos") — via pessoalMakro.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { FileText, Loader2, Printer, ReceiptText, Users } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
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

type Recibo = ReturnType<typeof pessoalMakro.montarReciboPagamento>
type Gerencial = ReturnType<typeof pessoalMakro.montarRelatorioGerencial>

export function FaseRelatorios({ tenantId, empresaId, empresaNome, competencia }: Props) {
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([])
  const [folhas, setFolhas] = useState<FolhaPagamento[]>([])
  const [carregando, setCarregando] = useState(true)
  const [funcionarioId, setFuncionarioId] = useState('')
  const [incluirCbo, setIncluirCbo] = useState(true)

  const carregar = useCallback(async () => {
    if (!tenantId || !empresaId || empresaId === 'todas') {
      setFuncionarios([])
      setFolhas([])
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
      setFolhas(fls)
    } catch {
      setFuncionarios([])
      setFolhas([])
    } finally {
      setCarregando(false)
    }
  }, [tenantId, empresaId, competencia])

  useEffect(() => {
    carregar()
  }, [carregar])

  const ativos = useMemo(() => funcionarios.filter((f) => f.status !== 'demitido'), [funcionarios])

  useEffect(() => {
    if (!funcionarioId && ativos.length > 0) setFuncionarioId(ativos[0].id)
    if (funcionarioId && !ativos.some((f) => f.id === funcionarioId)) setFuncionarioId('')
  }, [ativos, funcionarioId])

  const recibo = useMemo<Recibo | null>(() => {
    const func = ativos.find((f) => f.id === funcionarioId)
    if (!func) return null
    const folha = folhas.find((f) => f.funcionario === func.id)
    return pessoalMakro.montarReciboPagamento({
      empresaNome,
      competencia,
      funcionario: func,
      folha,
    })
  }, [ativos, folhas, funcionarioId, empresaNome, competencia])

  const gerencial = useMemo<Gerencial>(
    () =>
      pessoalMakro.montarRelatorioGerencial({
        funcionarios,
        folha: folhas,
        incluirCbo,
      }),
    [funcionarios, folhas, incluirCbo],
  )

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
      <Card className="rounded-2xl border-[#E2E8F0] p-6 shadow-2xs">
        <div className="py-6 text-center">
          <Users className="h-8 w-8 mx-auto text-slate-300 mb-2" aria-hidden />
          <p className="text-sm font-semibold text-[#1A2333]">
            Nenhum colaborador para gerar relatórios
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Cadastre colaboradores na fase Preparar e calcule a folha na fase Movimentações para
            emitir o recibo de pagamento e o relatório gerencial.
          </p>
        </div>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Recibo de pagamento */}
      <Card className="rounded-2xl border-[#E2E8F0] p-4 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-3">
          <h4 className="text-sm font-bold text-[#1A2333] flex items-center gap-2 flex-1">
            <ReceiptText className="h-4 w-4 text-[#0FA3A3]" /> Recibo de pagamento · {competencia}
          </h4>
          {recibo ? (
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs"
              onClick={() => window.print()}
            >
              <Printer className="h-3.5 w-3.5" /> Imprimir
            </Button>
          ) : null}
        </div>

        <div className="space-y-1 mb-3">
          <Label htmlFor="rel-func" className="text-[11px]">
            Colaborador
          </Label>
          <Select value={funcionarioId} onValueChange={setFuncionarioId}>
            <SelectTrigger id="rel-func" className="h-9 text-xs sm:max-w-xs">
              <SelectValue placeholder="Selecione o colaborador" />
            </SelectTrigger>
            <SelectContent>
              {ativos.map((f) => (
                <SelectItem key={f.id} value={f.id}>
                  {f.nome_completo}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {ativos.length === 0 ? (
          <p className="text-xs text-slate-500 py-2">
            Nenhum colaborador ativo — o recibo depende de colaboradores cadastrados na fase
            Preparar.
          </p>
        ) : !recibo ? (
          <p className="text-xs text-slate-500 py-2">Selecione um colaborador para o recibo.</p>
        ) : (
          <div className="space-y-3">
            <p className="text-xs font-semibold text-[#1A2333]">{recibo.titulo}</p>
            {recibo.linhas.length === 0 ? (
              <p className="text-xs text-slate-500 py-2">
                Sem lançamentos de folha para este colaborador em {competencia} — calcule a folha na
                fase Movimentações.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-[#E2E8F0]">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-[10px] uppercase text-slate-400 border-b bg-slate-50">
                      <th className="py-2 px-3 font-semibold">Rubrica</th>
                      <th className="py-2 px-3 font-semibold">Referência</th>
                      <th className="py-2 px-3 font-semibold text-right">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recibo.linhas.map((l, i) => (
                      <tr key={`${l.descricao}-${i}`} className="border-b last:border-0">
                        <td className="py-2 px-3 text-[#1A2333]">{l.descricao}</td>
                        <td className="py-2 px-3 text-slate-500">{l.referencia || '—'}</td>
                        <td
                          className={cn(
                            'py-2 px-3 text-right font-mono',
                            l.valor < 0 ? 'text-red-600' : 'text-[#1A2333]',
                          )}
                        >
                          {formatCurrency(l.valor)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t bg-slate-50 font-semibold text-[#1A2333]">
                      <td className="py-2 px-3" colSpan={2}>
                        Total de proventos
                      </td>
                      <td className="py-2 px-3 text-right font-mono">
                        {formatCurrency(recibo.totalProventos)}
                      </td>
                    </tr>
                    <tr className="bg-slate-50 font-semibold text-[#1A2333]">
                      <td className="py-2 px-3" colSpan={2}>
                        Total de descontos
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-red-600">
                        {formatCurrency(recibo.totalDescontos)}
                      </td>
                    </tr>
                    <tr className="bg-slate-50 font-bold text-[#0FA3A3]">
                      <td className="py-2 px-3" colSpan={2}>
                        Líquido a receber
                      </td>
                      <td className="py-2 px-3 text-right font-mono">
                        {formatCurrency(recibo.totalLiquido)}
                      </td>
                    </tr>
                    <tr className="bg-slate-50 text-[10px] uppercase text-slate-400">
                      <td className="py-2 px-3" colSpan={2}>
                        FGTS do mês (informativo)
                      </td>
                      <td className="py-2 px-3 text-right font-mono">
                        {formatCurrency(recibo.fgtsInformativo)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Relatório gerencial */}
      <Card className="rounded-2xl border-[#E2E8F0] p-4 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-3">
          <h4 className="text-sm font-bold text-[#1A2333] flex items-center gap-2 flex-1">
            <FileText className="h-4 w-4 text-[#0FA3A3]" /> Relatório gerencial · {competencia}
            <Badge variant="outline" className="text-[10px] bg-slate-50 text-slate-500">
              {gerencial.linhas.length} colaborador(es)
            </Badge>
          </h4>
          <span className="flex items-center gap-2 text-xs text-slate-600">
            <Checkbox
              id="rel-cbo"
              checked={incluirCbo}
              onCheckedChange={(v) => setIncluirCbo(v === true)}
            />
            <Label htmlFor="rel-cbo" className="text-[11px] cursor-pointer">
              Exibir CBO
            </Label>
          </span>
        </div>

        {gerencial.linhas.length === 0 ? (
          <p className="text-xs text-slate-500 py-2">
            Nenhum colaborador ativo nesta empresa — cadastre na fase Preparar.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-[10px] uppercase text-slate-400 border-b">
                  <th className="py-2 pr-3 font-semibold">Colaborador</th>
                  {incluirCbo ? <th className="py-2 pr-3 font-semibold">CBO</th> : null}
                  <th className="py-2 pr-3 font-semibold">Cargo</th>
                  <th className="py-2 pr-3 font-semibold text-right">Salário</th>
                  <th className="py-2 pr-3 font-semibold text-right">Proventos</th>
                  <th className="py-2 pr-3 font-semibold text-right">Descontos</th>
                  <th className="py-2 pr-3 font-semibold text-right">INSS</th>
                  <th className="py-2 pr-3 font-semibold text-right">IRRF</th>
                  <th className="py-2 pr-3 font-semibold text-right">FGTS</th>
                  <th className="py-2 pr-3 font-semibold text-right">Líquido</th>
                  <th className="py-2 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {gerencial.linhas.map((l) => (
                  <tr key={l.nome} className="border-b last:border-0 text-[#1A2333]">
                    <td className="py-2 pr-3 font-medium">{l.nome}</td>
                    {incluirCbo ? (
                      <td className="py-2 pr-3 font-mono text-slate-500">{l.cbo || '—'}</td>
                    ) : null}
                    <td className="py-2 pr-3">{l.cargo || '—'}</td>
                    <td className="py-2 pr-3 text-right font-mono">{formatCurrency(l.salario)}</td>
                    <td className="py-2 pr-3 text-right font-mono">
                      {formatCurrency(l.proventos)}
                    </td>
                    <td className="py-2 pr-3 text-right font-mono text-red-600">
                      {formatCurrency(l.descontos)}
                    </td>
                    <td className="py-2 pr-3 text-right font-mono">{formatCurrency(l.inss)}</td>
                    <td className="py-2 pr-3 text-right font-mono">{formatCurrency(l.irrf)}</td>
                    <td className="py-2 pr-3 text-right font-mono">{formatCurrency(l.fgts)}</td>
                    <td className="py-2 pr-3 text-right font-mono font-bold">
                      {formatCurrency(l.liquido)}
                    </td>
                    <td className="py-2">
                      <Badge
                        variant="outline"
                        className={cn(
                          'text-[9px] capitalize',
                          l.status === 'ativo'
                            ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                            : 'bg-amber-50 text-amber-600 border-amber-200',
                        )}
                      >
                        {l.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t bg-slate-50 font-semibold text-[#1A2333]">
                  <td className="py-2 pr-3" colSpan={incluirCbo ? 3 : 2}>
                    Totais
                  </td>
                  <td className="py-2 pr-3 text-right font-mono">
                    {formatCurrency(gerencial.totais.salario)}
                  </td>
                  <td className="py-2 pr-3" />
                  <td className="py-2 pr-3" />
                  <td className="py-2 pr-3 text-right font-mono">
                    {formatCurrency(gerencial.totais.inss)}
                  </td>
                  <td className="py-2 pr-3 text-right font-mono">
                    {formatCurrency(gerencial.totais.irrf)}
                  </td>
                  <td className="py-2 pr-3 text-right font-mono">
                    {formatCurrency(gerencial.totais.fgts)}
                  </td>
                  <td className="py-2 pr-3 text-right font-mono text-[#0FA3A3]">
                    {formatCurrency(gerencial.totais.liquido)}
                  </td>
                  <td className="py-2" />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
