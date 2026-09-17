import React, { useState } from 'react'
import {
  FileCode,
  AlertCircle,
  ShieldAlert,
  Building,
  Plus,
  Trash2,
  CheckCircle2,
  Info,
} from 'lucide-react'
import type { CnaesAberturaConfig, CnaeItem } from '@/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { analisarCnae } from '@/lib/companyFormationLegal'

interface FormationCnaesSectionProps {
  cnaes: CnaesAberturaConfig
  naturezaJuridica: string
  canEdit: boolean
  onChange: (cnaes: CnaesAberturaConfig) => void
}

export const FormationCnaesSection: React.FC<FormationCnaesSectionProps> = ({
  cnaes,
  naturezaJuridica,
  canEdit,
  onChange,
}) => {
  const isMei = naturezaJuridica === 'mei'

  const handlePrincipalCodigoChange = (codigoRaw: string) => {
    const analise = analisarCnae(codigoRaw)
    const principalAtualizado: CnaeItem = {
      ...cnaes.principal,
      codigo: analise.codigoFormatado,
      exigeConselho: analise.exigeConselho,
      orgaoRegistro: analise.orgaoRegistro,
      impedidoMei: analise.impedidoMei,
      anexoSimples: analise.anexoSimples,
    }
    onChange({
      ...cnaes,
      principal: principalAtualizado,
    })
  }

  const handlePrincipalDescricaoChange = (descricao: string) => {
    onChange({
      ...cnaes,
      principal: { ...cnaes.principal, descricao },
    })
  }

  const handleAddSecundario = () => {
    const novoSecundario: CnaeItem = {
      codigo: '',
      descricao: '',
      exigeConselho: false,
      impedidoMei: false,
    }
    onChange({
      ...cnaes,
      secundarios: [...(cnaes.secundarios || []), novoSecundario],
    })
  }

  const handleRemoveSecundario = (index: number) => {
    const updated = (cnaes.secundarios || []).filter((_, idx) => idx !== index)
    onChange({
      ...cnaes,
      secundarios: updated,
    })
  }

  const handleSecundarioCodigoChange = (index: number, codigoRaw: string) => {
    const analise = analisarCnae(codigoRaw)
    const updated = [...(cnaes.secundarios || [])]
    updated[index] = {
      ...updated[index],
      codigo: analise.codigoFormatado,
      exigeConselho: analise.exigeConselho,
      orgaoRegistro: analise.orgaoRegistro,
      impedidoMei: analise.impedidoMei,
      anexoSimples: analise.anexoSimples,
    }
    onChange({
      ...cnaes,
      secundarios: updated,
    })
  }

  const handleSecundarioDescricaoChange = (index: number, descricao: string) => {
    const updated = [...(cnaes.secundarios || [])]
    updated[index] = {
      ...updated[index],
      descricao,
    }
    onChange({
      ...cnaes,
      secundarios: updated,
    })
  }

  const todosCnaes = [cnaes.principal, ...(cnaes.secundarios || [])].filter((c) =>
    Boolean(c?.codigo),
  )
  const possuiImpedimentoMei = isMei && todosCnaes.some((c) => c.impedidoMei)
  const conselhosExigidos = todosCnaes.filter((c) => c.exigeConselho && c.orgaoRegistro)

  return (
    <Card className="rounded-2xl border-[#E2E8F0] shadow-xs">
      <CardHeader className="pb-3 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <CardTitle className="text-sm font-bold text-[#1A2333] flex items-center gap-2">
            <FileCode className="h-4 w-4 text-[#0FA3A3]" />
            <span>Atividades Econômicas (CNAE Principal e Secundários)</span>
          </CardTitle>
          <p className="text-xs text-[#64748B] mt-0.5">
            Classificação Nacional de Atividades Econômicas com detecção de órgãos de classe e
            impedimentos
          </p>
        </div>

        {canEdit && (
          <Button
            onClick={handleAddSecundario}
            size="sm"
            variant="outline"
            className="h-8 gap-1.5 rounded-xl text-xs font-semibold text-[#0FA3A3] border-teal-200 hover:bg-teal-50"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Adicionar CNAE Secundário</span>
          </Button>
        )}
      </CardHeader>

      <CardContent className="pt-4 space-y-4 text-xs">
        {/* Alerta de Impedimento de MEI */}
        {possuiImpedimentoMei && (
          <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-red-900 text-xs space-y-1">
            <div className="flex items-center gap-2 font-bold text-red-700">
              <ShieldAlert className="h-4 w-4 text-red-600" />
              <span>ALERTA DE IMPEDIMENTO LEGAL: Atividade Vedada ao MEI</span>
            </div>
            <p>
              Uma ou mais atividades selecionadas pertencem ao rol de ocupações
              intelectuais/regulamentadas ou não autorizadas pela Resolução CGSN nº 140/2018 (art.
              18-A da LC 123/2006). A empresa não conseguirá inscrição pelo Portal do Empreendedor
              como MEI.
            </p>
            <p className="font-semibold text-red-800">
              Sugestão: Alterar a natureza jurídica para <b>SLU (Sociedade Limitada Unipessoal)</b>{' '}
              ou <b>LTDA</b> no Simples Nacional.
            </p>
          </div>
        )}

        {/* Alertas de Órgão de Classe */}
        {conselhosExigidos.length > 0 && (
          <div className="rounded-xl bg-blue-50 border border-blue-200 p-3 text-blue-900 text-xs space-y-1.5">
            <div className="flex items-center gap-2 font-bold text-blue-800">
              <Building className="h-4 w-4 text-blue-600" />
              <span>
                Exigência Obrigatória de Registro em Órgão / Conselho de Classe (Lei 6.839/80)
              </span>
            </div>
            <p className="text-[11px] text-blue-800">
              Conforme as atividades informadas, a pessoa jurídica deverá ser registrada nos
              seguintes conselhos profissionais para obtenção de alvará:
            </p>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {Array.from(new Set(conselhosExigidos.map((c) => c.orgaoRegistro))).map(
                (orgao, i) => (
                  <Badge
                    key={i}
                    className="bg-blue-100 text-blue-800 border-blue-300 font-semibold text-[11px]"
                  >
                    {orgao}
                  </Badge>
                ),
              )}
            </div>
          </div>
        )}

        {/* CNAE Principal */}
        <div className="p-3.5 rounded-xl border border-teal-200 bg-teal-50/20 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge className="bg-[#0FA3A3] text-white text-[10px] uppercase font-bold">
                CNAE Principal
              </Badge>
              {cnaes.principal?.anexoSimples && (
                <Badge variant="outline" className="text-[10px] text-teal-800 border-teal-300">
                  {cnaes.principal.anexoSimples}
                </Badge>
              )}
            </div>

            {cnaes.principal?.exigeConselho && (
              <Badge className="bg-amber-100 text-amber-800 border-amber-300 text-[10px]">
                Exige Conselho Profissional
              </Badge>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="sm:col-span-1">
              <Label className="text-[11px] text-[#64748B]">Código (7 dígitos)</Label>
              {canEdit ? (
                <Input
                  value={cnaes.principal?.codigo || ''}
                  onChange={(e) => handlePrincipalCodigoChange(e.target.value)}
                  placeholder="Ex.: 8630-5/03"
                  className="h-8 text-xs rounded-lg mt-0.5 font-mono"
                />
              ) : (
                <p className="font-mono font-semibold text-[#1A2333] mt-0.5">
                  {cnaes.principal?.codigo || 'Não informado'}
                </p>
              )}
            </div>

            <div className="sm:col-span-3">
              <Label className="text-[11px] text-[#64748B]">Descrição da Atividade Econômica</Label>
              {canEdit ? (
                <Input
                  value={cnaes.principal?.descricao || ''}
                  onChange={(e) => handlePrincipalDescricaoChange(e.target.value)}
                  placeholder="Ex.: Atividade médica ambulatorial restrita a consultas"
                  className="h-8 text-xs rounded-lg mt-0.5"
                />
              ) : (
                <p className="font-semibold text-[#1A2333] mt-0.5">
                  {cnaes.principal?.descricao || '—'}
                </p>
              )}
            </div>
          </div>

          {cnaes.principal?.orgaoRegistro && (
            <p className="text-[11px] text-teal-900 mt-1">
              Órgão / Enquadramento: <b>{cnaes.principal.orgaoRegistro}</b>
            </p>
          )}
        </div>

        {/* CNAEs Secundários */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-xs text-[#1A2333]">
              Atividades Secundárias ({cnaes.secundarios?.length || 0})
            </span>
          </div>

          {!cnaes.secundarios || cnaes.secundarios.length === 0 ? (
            <p className="text-xs text-[#94A3B8] italic">
              Nenhum CNAE secundário cadastrado. Adicione atividades secundárias caso a empresa
              exerça múltiplos serviços ou comércio.
            </p>
          ) : (
            <div className="space-y-2">
              {cnaes.secundarios.map((sec, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-xl border border-slate-200 bg-white hover:border-slate-300 transition-colors space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-600">
                      CNAE Secundário #{idx + 1}
                    </span>
                    {canEdit && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleRemoveSecundario(idx)}
                        className="h-6 text-[11px] text-red-600 hover:text-red-700 hover:bg-red-50 p-1"
                      >
                        <Trash2 className="h-3 w-3 mr-1" />
                        <span>Remover</span>
                      </Button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <div className="sm:col-span-1">
                      <Label className="text-[11px] text-[#64748B]">Código (7 dígitos)</Label>
                      {canEdit ? (
                        <Input
                          value={sec.codigo}
                          onChange={(e) => handleSecundarioCodigoChange(idx, e.target.value)}
                          placeholder="Ex.: 8640-2/08"
                          className="h-8 text-xs rounded-lg mt-0.5 font-mono"
                        />
                      ) : (
                        <p className="font-mono font-semibold text-[#1A2333] mt-0.5">
                          {sec.codigo}
                        </p>
                      )}
                    </div>

                    <div className="sm:col-span-3">
                      <Label className="text-[11px] text-[#64748B]">Descrição</Label>
                      {canEdit ? (
                        <Input
                          value={sec.descricao}
                          onChange={(e) => handleSecundarioDescricaoChange(idx, e.target.value)}
                          placeholder="Descrição da atividade secundária"
                          className="h-8 text-xs rounded-lg mt-0.5"
                        />
                      ) : (
                        <p className="font-semibold text-[#1A2333] mt-0.5">
                          {sec.descricao || '—'}
                        </p>
                      )}
                    </div>
                  </div>

                  {sec.orgaoRegistro && (
                    <div className="flex items-center gap-2 text-[10px] text-slate-500">
                      <span>Órgão regulador: {sec.orgaoRegistro}</span>
                      {sec.anexoSimples && <span>• {sec.anexoSimples}</span>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
