import React, { useState } from 'react'
import {
  Users,
  Plus,
  Trash2,
  AlertTriangle,
  Globe,
  UserCheck,
  Building,
  CheckCircle2,
  Info,
} from 'lucide-react'
import type { SocioAberturaItem } from '@/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
import { maskCpf, maskCnpj } from '@/lib/formatters'
import { useToast } from '@/hooks/use-toast'

interface FormationSociosTableProps {
  socios: SocioAberturaItem[]
  canEdit: boolean
  capitalSocialTotal: number
  naturezaJuridica: string
  onSociosChange: (socios: SocioAberturaItem[], totalCapitalCalculado: number) => void
}

export const FormationSociosTable: React.FC<FormationSociosTableProps> = ({
  socios,
  canEdit,
  capitalSocialTotal,
  naturezaJuridica,
  onSociosChange,
}) => {
  const { toast } = useToast()

  const somaPercentual = socios.reduce((acc, s) => acc + (Number(s.percentual_cotas) || 0), 0)
  const somaValor = socios.reduce((acc, s) => acc + (Number(s.valor_participacao) || 0), 0)
  const percentualValido = Math.abs(somaPercentual - 100) < 0.01

  const handleAddSocio = () => {
    const novoSocio: SocioAberturaItem = {
      id: `socio_${Date.now()}`,
      tipo_pessoa: 'PF',
      nome_razao: '',
      cpf_cnpj: '',
      percentual_cotas: socios.length === 0 ? 100 : 0,
      valor_participacao: socios.length === 0 ? capitalSocialTotal : 0,
      data_entrada: new Date().toISOString().slice(0, 10),
      pais_residencia: 'Brasil',
      residente_exterior: false,
      cargo_funcao: socios.length === 0 ? 'Sócio-Administrador' : 'Sócio',
      qualificacao: '49 - Sócio-Administrador',
      pro_labore: true,
    }
    const updated = [...socios, novoSocio]
    const novoTotal = updated.reduce((acc, s) => acc + (Number(s.valor_participacao) || 0), 0)
    onSociosChange(updated, novoTotal)
  }

  const handleRemoveSocio = (id: string) => {
    const updated = socios.filter((s) => s.id !== id)
    const novoTotal = updated.reduce((acc, s) => acc + (Number(s.valor_participacao) || 0), 0)
    onSociosChange(updated, novoTotal)
  }

  const handleUpdateSocio = (id: string, field: keyof SocioAberturaItem, value: any) => {
    const updated = socios.map((s) => {
      if (s.id !== id) return s
      const updatedSocio = { ...s, [field]: value }

      // Se mudou o percentual de cotas, recalcula o valor automaticamente se o capital total estiver definido
      if (field === 'percentual_cotas' && capitalSocialTotal > 0) {
        const perc = Number(value) || 0
        updatedSocio.valor_participacao = Math.round((perc / 100) * capitalSocialTotal * 100) / 100
      }

      // Se mudou o valor da cota, atualiza percentual se aplicável
      if (field === 'valor_participacao') {
        const val = Number(value) || 0
        updatedSocio.valor_participacao = val
      }

      return updatedSocio
    })

    const novoTotal = updated.reduce((acc, s) => acc + (Number(s.valor_participacao) || 0), 0)
    onSociosChange(updated, novoTotal > 0 ? novoTotal : capitalSocialTotal)
  }

  return (
    <Card className="rounded-2xl border-[#E2E8F0] shadow-xs">
      <CardHeader className="pb-3 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <CardTitle className="text-sm font-bold text-[#1A2333] flex items-center gap-2">
            <Users className="h-4 w-4 text-[#0FA3A3]" />
            <span>Estrutura Societária & Quadro de Sócios (QSA)</span>
          </CardTitle>
          <p className="text-xs text-[#64748B] mt-0.5">
            Composição do capital, cotas, qualificação e regras legais de administração
          </p>
        </div>

        <div className="flex items-center gap-2">
          {canEdit && (
            <Button
              onClick={handleAddSocio}
              size="sm"
              variant="outline"
              className="h-8 gap-1.5 rounded-xl text-xs font-semibold text-[#0FA3A3] border-teal-200 hover:bg-teal-50"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Adicionar Sócio / Acionista</span>
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="pt-4 space-y-4">
        {/* Validação de Percentual e Regras */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs">
          <div className="flex items-center gap-4">
            <div>
              <span className="text-[#64748B]">Total de Sócios:</span>{' '}
              <span className="font-semibold text-[#1A2333]">{socios.length}</span>
            </div>
            <div>
              <span className="text-[#64748B]">Soma das Cotas:</span>{' '}
              <span
                className={`font-semibold ${
                  percentualValido ? 'text-emerald-700' : 'text-red-600 font-bold'
                }`}
              >
                {somaPercentual.toFixed(2)}%
              </span>
            </div>
            <div>
              <span className="text-[#64748B]">Capital Social Total:</span>{' '}
              <span className="font-semibold text-[#1A2333]">
                R$ {somaValor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {!percentualValido && (
            <Badge
              variant="outline"
              className="border-red-300 bg-red-50 text-red-700 text-xs gap-1"
            >
              <AlertTriangle className="h-3.5 w-3.5" />
              <span>A soma das cotas deve totalizar exatamente 100,00%</span>
            </Badge>
          )}
          {percentualValido && socios.length > 0 && (
            <Badge className="bg-emerald-100 text-emerald-800 text-xs gap-1">
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>Cotas 100% integralizadas</span>
            </Badge>
          )}
        </div>

        {/* Lista de Sócios */}
        {socios.length === 0 ? (
          <div className="py-8 text-center text-xs text-[#94A3B8] border border-dashed rounded-xl border-slate-200">
            Nenhum sócio ou acionista cadastrado para este processo. Clique no botão acima para
            adicionar.
          </div>
        ) : (
          <div className="space-y-3">
            {socios.map((socio, idx) => (
              <div
                key={socio.id}
                className="p-4 rounded-xl border border-slate-200 bg-white hover:border-slate-300 transition-colors space-y-3 text-xs"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-[11px] font-bold text-slate-700">
                      {idx + 1}
                    </span>
                    <Badge variant="outline" className="text-[10px] font-semibold">
                      {socio.tipo_pessoa === 'PF' ? 'Pessoa Física' : 'Pessoa Jurídica'}
                    </Badge>
                    {socio.residente_exterior && (
                      <Badge className="bg-amber-100 text-amber-800 text-[10px] gap-1">
                        <Globe className="h-3 w-3" />
                        <span>Sócio Residente no Exterior (Bacen/RFB)</span>
                      </Badge>
                    )}
                  </div>

                  {canEdit && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleRemoveSocio(socio.id)}
                      className="h-7 text-xs text-red-600 hover:bg-red-50 hover:text-red-700 gap-1"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>Remover</span>
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                  {/* Tipo de Pessoa */}
                  <div>
                    <Label className="text-[11px] text-[#64748B]">Tipo</Label>
                    {canEdit ? (
                      <Select
                        value={socio.tipo_pessoa}
                        onValueChange={(val) => handleUpdateSocio(socio.id, 'tipo_pessoa', val)}
                      >
                        <SelectTrigger className="h-8 text-xs rounded-lg mt-0.5">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="PF">Pessoa Física (CPF)</SelectItem>
                          <SelectItem value="PJ">Pessoa Jurídica (CNPJ)</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <p className="font-semibold text-[#1A2333] mt-0.5">{socio.tipo_pessoa}</p>
                    )}
                  </div>

                  {/* Nome Completo / Razão */}
                  <div className="sm:col-span-2">
                    <Label className="text-[11px] text-[#64748B]">
                      {socio.tipo_pessoa === 'PF' ? 'Nome Completo do Sócio' : 'Razão Social da PJ'}
                    </Label>
                    {canEdit ? (
                      <Input
                        value={socio.nome_razao}
                        onChange={(e) => handleUpdateSocio(socio.id, 'nome_razao', e.target.value)}
                        placeholder="Ex.: Dr. Carlos Eduardo Silva"
                        className="h-8 text-xs rounded-lg mt-0.5"
                      />
                    ) : (
                      <p className="font-semibold text-[#1A2333] mt-0.5">
                        {socio.nome_razao || '—'}
                      </p>
                    )}
                  </div>

                  {/* CPF / CNPJ */}
                  <div>
                    <Label className="text-[11px] text-[#64748B]">
                      {socio.tipo_pessoa === 'PF' ? 'CPF' : 'CNPJ'}
                    </Label>
                    {canEdit ? (
                      <Input
                        value={socio.cpf_cnpj}
                        onChange={(e) => {
                          const val = e.target.value
                          const masked = socio.tipo_pessoa === 'PF' ? maskCpf(val) : maskCnpj(val)
                          handleUpdateSocio(socio.id, 'cpf_cnpj', masked)
                        }}
                        placeholder={
                          socio.tipo_pessoa === 'PF' ? '000.000.000-00' : '00.000.000/0000-00'
                        }
                        className="h-8 text-xs rounded-lg mt-0.5 font-mono"
                      />
                    ) : (
                      <p className="font-mono text-[#1A2333] mt-0.5">{socio.cpf_cnpj || '—'}</p>
                    )}
                  </div>

                  {/* % de Cotas */}
                  <div>
                    <Label className="text-[11px] text-[#64748B]">Participação (%)</Label>
                    {canEdit ? (
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        value={socio.percentual_cotas}
                        onChange={(e) =>
                          handleUpdateSocio(
                            socio.id,
                            'percentual_cotas',
                            parseFloat(e.target.value) || 0,
                          )
                        }
                        className="h-8 text-xs rounded-lg mt-0.5"
                      />
                    ) : (
                      <p className="font-semibold text-[#1A2333] mt-0.5">
                        {socio.percentual_cotas}%
                      </p>
                    )}
                  </div>

                  {/* Valor da Participação */}
                  <div>
                    <Label className="text-[11px] text-[#64748B]">Valor da Participação (R$)</Label>
                    {canEdit ? (
                      <Input
                        type="number"
                        min="0"
                        step="100"
                        value={socio.valor_participacao}
                        onChange={(e) =>
                          handleUpdateSocio(
                            socio.id,
                            'valor_participacao',
                            parseFloat(e.target.value) || 0,
                          )
                        }
                        className="h-8 text-xs rounded-lg mt-0.5"
                      />
                    ) : (
                      <p className="font-semibold text-[#1A2333] mt-0.5">
                        R${' '}
                        {Number(socio.valor_participacao || 0).toLocaleString('pt-BR', {
                          minimumFractionDigits: 2,
                        })}
                      </p>
                    )}
                  </div>

                  {/* Cargo / Função */}
                  <div>
                    <Label className="text-[11px] text-[#64748B]">Cargo / Função Social</Label>
                    {canEdit ? (
                      <Select
                        value={socio.cargo_funcao}
                        onValueChange={(val) => handleUpdateSocio(socio.id, 'cargo_funcao', val)}
                      >
                        <SelectTrigger className="h-8 text-xs rounded-lg mt-0.5">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Sócio-Administrador">Sócio-Administrador</SelectItem>
                          <SelectItem value="Sócio Cotista">Sócio Cotista (Sem Gestão)</SelectItem>
                          <SelectItem value="Diretor">Diretor Estatutário</SelectItem>
                          <SelectItem value="Titular">Titular Único (SLU/EI)</SelectItem>
                          <SelectItem value="Administrador Não Sócio">
                            Administrador Não Sócio
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <p className="font-semibold text-[#1A2333] mt-0.5">{socio.cargo_funcao}</p>
                    )}
                  </div>

                  {/* País de Residência */}
                  <div>
                    <Label className="text-[11px] text-[#64748B]">País de Residência</Label>
                    {canEdit ? (
                      <Input
                        value={socio.pais_residencia}
                        onChange={(e) => {
                          const pais = e.target.value
                          handleUpdateSocio(socio.id, 'pais_residencia', pais)
                          handleUpdateSocio(
                            socio.id,
                            'residente_exterior',
                            pais.toLowerCase() !== 'brasil' && pais !== '',
                          )
                        }}
                        placeholder="Ex.: Brasil ou Portugal"
                        className="h-8 text-xs rounded-lg mt-0.5"
                      />
                    ) : (
                      <p className="font-semibold text-[#1A2333] mt-0.5">
                        {socio.pais_residencia || 'Brasil'}
                      </p>
                    )}
                  </div>
                </div>

                {/* Sócio Residente no Exterior Alerta */}
                {socio.residente_exterior && (
                  <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-amber-900 text-[11px] space-y-1">
                    <div className="flex items-center gap-1.5 font-bold">
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                      <span>Exigências Legais para Sócio Residente no Exterior (Bacen & RFB)</span>
                    </div>
                    <p>
                      1. Obrigatoriedade de Procurador residente no Brasil com poderes para receber
                      citações judiciais e administrar bens (art. 1.011 CC c/ Instrução DREI 81/20).
                    </p>
                    <p>
                      2. Registro Declaratório Eletrônico de Investimento Estrangeiro Direto
                      (RDE-IED) no Banco Central do Brasil para ingresso do capital.
                    </p>
                    <div className="pt-1">
                      <Label className="text-[10px] text-amber-800">
                        Nome do Representante Legal / Procurador no Brasil:
                      </Label>
                      {canEdit ? (
                        <Input
                          value={socio.representante_legal || ''}
                          onChange={(e) =>
                            handleUpdateSocio(socio.id, 'representante_legal', e.target.value)
                          }
                          placeholder="Nome e CPF do procurador residente no Brasil"
                          className="h-7 text-xs rounded-lg mt-0.5 bg-white border-amber-300"
                        />
                      ) : (
                        <p className="font-semibold">
                          {socio.representante_legal || 'Não informado'}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 text-[11px] text-[#64748B] flex items-start gap-2">
          <Info className="h-4 w-4 text-[#0FA3A3] shrink-0 mt-0.5" />
          <span>
            <b>Aviso legal de registro societário:</b> Qualquer alteração posterior no quadro de
            cotas, inclusão ou exclusão de sócios e redistribuição de capital exigirá arquivamento
            de alteração contratual na Junta Comercial competente.
          </span>
        </div>
      </CardContent>
    </Card>
  )
}
