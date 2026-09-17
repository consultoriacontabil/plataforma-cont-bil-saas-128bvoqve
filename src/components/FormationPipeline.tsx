import React from 'react'
import { GitCommit, CheckCircle2, Clock, AlertCircle, Calendar, User, Hash } from 'lucide-react'
import type { EtapaPipelineItem, StatusEtapaPipeline } from '@/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface FormationPipelineProps {
  etapas: EtapaPipelineItem[]
  canEdit: boolean
  onChange: (etapas: EtapaPipelineItem[]) => void
}

export const FormationPipeline: React.FC<FormationPipelineProps> = ({
  etapas,
  canEdit,
  onChange,
}) => {
  const concluidasCount = etapas.filter((e) => e.status === 'concluido').length
  const totalCount = etapas.length
  const percConcluido = totalCount > 0 ? Math.round((concluidasCount / totalCount) * 100) : 0

  const handleUpdateEtapa = (id: string, field: keyof EtapaPipelineItem, value: any) => {
    const updated = etapas.map((etapa) => {
      if (etapa.id !== id) return etapa
      const mod = { ...etapa, [field]: value }
      if (field === 'status' && value === 'concluido' && !mod.data_conclusao) {
        mod.data_conclusao = new Date().toISOString().slice(0, 10)
      }
      if (field === 'status' && value === 'em_andamento' && !mod.data_inicio) {
        mod.data_inicio = new Date().toISOString().slice(0, 10)
      }
      return mod
    })
    onChange(updated)
  }

  // Identifica a primeira etapa em andamento ou com pendência
  const etapaAtual = etapas.find((e) => e.status === 'em_andamento' || e.status === 'com_pendencia')

  return (
    <Card className="rounded-2xl border-[#E2E8F0] shadow-xs">
      <CardHeader className="pb-3 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <CardTitle className="text-sm font-bold text-[#1A2333] flex items-center gap-2">
            <GitCommit className="h-4 w-4 text-[#0FA3A3]" />
            <span>Fluxo e Pipeline de Abertura (Etapa a Etapa)</span>
          </CardTitle>
          <p className="text-xs text-[#64748B] mt-0.5">
            Cronograma oficial da constituição: da viabilidade à liberação do CNPJ e alvarás
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-[#1A2333]">
            {concluidasCount} de {totalCount} concluídas ({percConcluido}%)
          </span>
          <div className="w-28 h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
            <div
              className="h-full bg-[#0FA3A3] transition-all duration-300"
              style={{ width: `${percConcluido}%` }}
            />
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-4 space-y-4 text-xs">
        {etapaAtual && (
          <div className="rounded-xl bg-teal-50/50 border border-teal-200 p-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Badge className="bg-[#0FA3A3] text-white text-[10px]">Etapa Atual</Badge>
              <span className="font-semibold text-teal-950 text-xs">{etapaAtual.nome}</span>
            </div>
            {etapaAtual.protocolo && (
              <span className="font-mono text-[11px] text-teal-800 bg-teal-100 px-2 py-0.5 rounded">
                Protocolo: {etapaAtual.protocolo}
              </span>
            )}
          </div>
        )}

        {/* Linha do tempo de etapas */}
        <div className="space-y-3 relative before:absolute before:inset-0 before:left-3.5 before:w-0.5 before:bg-slate-200 before:top-2 before:bottom-2">
          {etapas.map((etapa, idx) => {
            const isConcluido = etapa.status === 'concluido'
            const isEmAndamento = etapa.status === 'em_andamento'
            const isComPendencia = etapa.status === 'com_pendencia'

            return (
              <div key={etapa.id} className="relative pl-9 space-y-2 group">
                {/* Marcador na linha */}
                <div
                  className={`absolute left-1.5 top-2.5 h-4 w-4 rounded-full -translate-x-1/2 border-2 flex items-center justify-center bg-white ${
                    isConcluido
                      ? 'border-emerald-500 text-emerald-600'
                      : isEmAndamento
                        ? 'border-teal-500 bg-teal-500 ring-4 ring-teal-100'
                        : isComPendencia
                          ? 'border-red-500 bg-red-500 ring-4 ring-red-100'
                          : 'border-slate-300 text-slate-300'
                  }`}
                >
                  {isConcluido ? (
                    <CheckCircle2 className="h-3 w-3 fill-emerald-500 text-white" />
                  ) : null}
                </div>

                <div className="p-3.5 rounded-xl border border-slate-200 bg-white hover:border-slate-300 transition-colors space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-[#1A2333]">{etapa.nome}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      {canEdit ? (
                        <Select
                          value={etapa.status}
                          onValueChange={(val) =>
                            handleUpdateEtapa(etapa.id, 'status', val as StatusEtapaPipeline)
                          }
                        >
                          <SelectTrigger
                            className={`h-7 w-36 text-xs rounded-lg font-medium ${
                              isConcluido
                                ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                                : isEmAndamento
                                  ? 'bg-blue-50 border-blue-300 text-blue-800'
                                  : isComPendencia
                                    ? 'bg-red-50 border-red-300 text-red-800'
                                    : 'bg-slate-50 border-slate-200 text-slate-600'
                            }`}
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pendente">Não Iniciada</SelectItem>
                            <SelectItem value="em_andamento">Em Andamento</SelectItem>
                            <SelectItem value="com_pendencia">Com Pendência</SelectItem>
                            <SelectItem value="concluido">Concluída</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge
                          className={
                            isConcluido
                              ? 'bg-emerald-100 text-emerald-800'
                              : isEmAndamento
                                ? 'bg-blue-100 text-blue-800'
                                : isComPendencia
                                  ? 'bg-red-100 text-red-800'
                                  : 'bg-slate-100 text-slate-600'
                          }
                        >
                          {etapa.status === 'concluido'
                            ? 'Concluída'
                            : etapa.status === 'em_andamento'
                              ? 'Em Andamento'
                              : etapa.status === 'com_pendencia'
                                ? 'Com Pendência'
                                : 'Não Iniciada'}
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Campos de detalhes da etapa */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                    <div>
                      <Label className="text-[10px] text-[#64748B]">
                        Protocolo / Chave de Acompanhamento
                      </Label>
                      {canEdit ? (
                        <Input
                          value={etapa.protocolo || ''}
                          onChange={(e) => handleUpdateEtapa(etapa.id, 'protocolo', e.target.value)}
                          placeholder="Ex.: VIB-2025-00192 ou DARE-992"
                          className="h-7 text-xs rounded-lg mt-0.5 font-mono"
                        />
                      ) : (
                        <p className="font-mono text-[#1A2333] mt-0.5">{etapa.protocolo || '—'}</p>
                      )}
                    </div>

                    <div>
                      <Label className="text-[10px] text-[#64748B]">Responsável</Label>
                      {canEdit ? (
                        <Input
                          value={etapa.responsavel || ''}
                          onChange={(e) =>
                            handleUpdateEtapa(etapa.id, 'responsavel', e.target.value)
                          }
                          placeholder="Ex.: Equipe Paralegal / Contador"
                          className="h-7 text-xs rounded-lg mt-0.5"
                        />
                      ) : (
                        <p className="text-[#1A2333] mt-0.5">{etapa.responsavel || '—'}</p>
                      )}
                    </div>

                    <div>
                      <Label className="text-[10px] text-[#64748B]">Data Início / Conclusão</Label>
                      {canEdit ? (
                        <div className="flex items-center gap-1 mt-0.5">
                          <Input
                            type="date"
                            value={etapa.data_inicio || ''}
                            onChange={(e) =>
                              handleUpdateEtapa(etapa.id, 'data_inicio', e.target.value)
                            }
                            className="h-7 text-[11px] rounded-lg px-2"
                            title="Data Início"
                          />
                          <span className="text-slate-400">→</span>
                          <Input
                            type="date"
                            value={etapa.data_conclusao || ''}
                            onChange={(e) =>
                              handleUpdateEtapa(etapa.id, 'data_conclusao', e.target.value)
                            }
                            className="h-7 text-[11px] rounded-lg px-2"
                            title="Data Conclusão"
                          />
                        </div>
                      ) : (
                        <p className="text-[#1A2333] mt-0.5">
                          {etapa.data_inicio || '—'}{' '}
                          {etapa.data_conclusao ? `até ${etapa.data_conclusao}` : ''}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Observação */}
                  <div>
                    <Label className="text-[10px] text-[#64748B]">
                      Observações e Despachos do Órgão
                    </Label>
                    {canEdit ? (
                      <Input
                        value={etapa.observacao || ''}
                        onChange={(e) => handleUpdateEtapa(etapa.id, 'observacao', e.target.value)}
                        placeholder="Ex.: Aprovada viabilidade locacional sem restrições de zoneamento"
                        className="h-7 text-xs rounded-lg mt-0.5"
                      />
                    ) : (
                      <p className="text-[#64748B] italic mt-0.5">{etapa.observacao || '—'}</p>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
