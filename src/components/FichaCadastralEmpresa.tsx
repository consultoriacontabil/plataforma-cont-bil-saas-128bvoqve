import { useState, useEffect } from 'react'
import {
  Building2,
  Users,
  Sliders,
  MapPin,
  FileText,
  Upload,
  Edit2,
  Save,
  X,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FileCheck,
  Plus,
  Trash2,
  Download,
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { useToast } from '@/hooks/use-toast'
import { empresasService } from '@/services/empresas'
import { proLaboreService } from '@/services/proLaboreService'
import type { Empresa, SocioRecord } from '@/types'

interface FichaCadastralEmpresaProps {
  empresa: Empresa
  tenantId: string
  canEdit?: boolean
  onEmpresaAtualizada?: (empresaAtualizada: Empresa) => void
}

interface ServicoItem {
  especie: string
  modelo: string
  serie: string
}

const SERVICOS_DEFAULT: ServicoItem[] = [
  { especie: 'NFS', modelo: '—', serie: 'Consulta Desabilitada' },
]

export function FichaCadastralEmpresa({
  empresa,
  tenantId,
  canEdit = true,
  onEmpresaAtualizada,
}: FichaCadastralEmpresaProps) {
  const { toast } = useToast()

  // Estado de edição da Ficha
  const [modoEdicao, setModoEdicao] = useState(false)
  const [salvando, setSalvando] = useState(false)

  // Sócios da empresa
  const [socios, setSocios] = useState<SocioRecord[]>([])
  const [loadingSocios, setLoadingSocios] = useState(true)

  // Estado dos accordions de sócios (IDs abertos)
  const [sociosAbertos, setSociosAbertos] = useState<Record<string, boolean>>({})

  // Form local da empresa
  const [formDataEmpresa, setFormDataEmpresa] = useState<Partial<Empresa>>({})

  // Form local dos sócios (map de id -> Partial<SocioRecord>)
  const [formDataSocios, setFormDataSocios] = useState<Record<string, Partial<SocioRecord>>>({})

  // Carregar sócios
  const carregarSocios = async () => {
    setLoadingSocios(true)
    try {
      const lista = await proLaboreService.listSocios(tenantId, empresa.id)
      setSocios(lista)
      // Abre todos os sócios por padrão no accordion
      const abertosMap: Record<string, boolean> = {}
      const sociosMap: Record<string, Partial<SocioRecord>> = {}
      lista.forEach((s) => {
        abertosMap[s.id] = true
        sociosMap[s.id] = { ...s }
      })
      setSociosAbertos(abertosMap)
      setFormDataSocios(sociosMap)
    } catch (err) {
      console.error('[FichaCadastral] Erro ao carregar sócios:', err)
    } finally {
      setLoadingSocios(false)
    }
  }

  useEffect(() => {
    carregarSocios()
  }, [empresa.id, tenantId])

  // Sincronizar form local quando empresa muda
  useEffect(() => {
    setFormDataEmpresa({
      tag: empresa.tag || '',
      codigo_interno: empresa.codigo_interno || '',
      percentual_contratual: empresa.percentual_contratual,
      codigo_externo: empresa.codigo_externo || '',
      razao_social: empresa.razao_social || '',
      nome_fantasia: empresa.nome_fantasia || '',
      razao_social_2: empresa.razao_social_2 || '',
      razao_social_3: empresa.razao_social_3 || '',
      cnpj: empresa.cnpj || '',
      data_abertura: empresa.data_abertura ? empresa.data_abertura.split('T')[0] : '',
      inscricao_estadual: empresa.inscricao_estadual || '',
      inscricao_municipal: empresa.inscricao_municipal || '',
      nire: empresa.nire || '',
      cemail: empresa.cemail || '',
      email: empresa.email || '',
      naf_ecnpj: empresa.naf_ecnpj || '',
      telefone: empresa.telefone || '',
      cep: empresa.cep || '',
      logradouro: empresa.logradouro || '',
      numero: empresa.numero || '',
      complemento: empresa.complemento || '',
      bairro: empresa.bairro || '',
      cidade: empresa.cidade || '',
      uf: empresa.uf || '',
      area_ocupada_m2: empresa.area_ocupada_m2 || '',
      atuacao: empresa.atuacao || '',
      unidade: empresa.unidade || '',
      unidade_auxiliar: empresa.unidade_auxiliar || '',
      atividade_descricao: empresa.atividade_descricao || '',
      regime_tributario: empresa.regime_tributario,
      segmento: empresa.segmento || '',
      subsegmento: empresa.subsegmento || '',
      natureza_juridica: empresa.natureza_juridica || '',
      capital_social: empresa.capital_social,
      cnae_principal: empresa.cnae_principal || '',
      cnaes_secundarios: empresa.cnaes_secundarios || '',
      fator_r_optante: empresa.fator_r_optante || false,
      fator_r_alteracao_automatica_prolabore:
        empresa.fator_r_alteracao_automatica_prolabore || false,
      anexo_simples: empresa.anexo_simples || '',
      tipo_de_nota: empresa.tipo_de_nota || '',
      servicos_config_json: empresa.servicos_config_json || SERVICOS_DEFAULT,
    })
  }, [empresa])

  // Helper de exibição honesta: "—" se nulo/vazio
  const displayVal = (v: any): string => {
    if (v === null || v === undefined) return '—'
    const s = String(v).trim()
    if (!s || s === 'null' || s === 'undefined' || s === 'Não informado') return '—'
    return s
  }

  // Formatar data para exibição pt-BR (DD/MM/AAAA)
  const formatDataPtBr = (v?: string): string => {
    if (!v) return '—'
    try {
      const d = v.split('T')[0]
      const [ano, mes, dia] = d.split('-')
      if (ano && mes && dia) return `${dia}/${mes}/${ano}`
      return v
    } catch {
      return v
    }
  }

  // Toggle do accordion do sócio
  const toggleSocioAccordion = (socioId: string) => {
    setSociosAbertos((prev) => ({
      ...prev,
      [socioId]: !prev[socioId],
    }))
  }

  // Salvar alterações da Ficha
  const handleSalvarFicha = async () => {
    setSalvando(true)
    try {
      // 1. Atualizar Empresa
      const payloadEmpresa: Partial<Empresa> = {
        tag: formDataEmpresa.tag,
        codigo_interno: formDataEmpresa.codigo_interno,
        percentual_contratual: formDataEmpresa.percentual_contratual
          ? Number(formDataEmpresa.percentual_contratual)
          : undefined,
        codigo_externo: formDataEmpresa.codigo_externo,
        razao_social: formDataEmpresa.razao_social,
        nome_fantasia: formDataEmpresa.nome_fantasia,
        razao_social_2: formDataEmpresa.razao_social_2,
        razao_social_3: formDataEmpresa.razao_social_3,
        cnpj: formDataEmpresa.cnpj,
        data_abertura: formDataEmpresa.data_abertura
          ? `${formDataEmpresa.data_abertura}T00:00:00.000Z`
          : undefined,
        inscricao_estadual: formDataEmpresa.inscricao_estadual,
        inscricao_municipal: formDataEmpresa.inscricao_municipal,
        nire: formDataEmpresa.nire,
        cemail: formDataEmpresa.cemail,
        email: formDataEmpresa.email,
        naf_ecnpj: formDataEmpresa.naf_ecnpj,
        telefone: formDataEmpresa.telefone,
        cep: formDataEmpresa.cep,
        logradouro: formDataEmpresa.logradouro,
        numero: formDataEmpresa.numero,
        complemento: formDataEmpresa.complemento,
        bairro: formDataEmpresa.bairro,
        cidade: formDataEmpresa.cidade,
        uf: formDataEmpresa.uf,
        area_ocupada_m2: formDataEmpresa.area_ocupada_m2,
        atuacao: formDataEmpresa.atuacao,
        unidade: formDataEmpresa.unidade,
        unidade_auxiliar: formDataEmpresa.unidade_auxiliar,
        atividade_descricao: formDataEmpresa.atividade_descricao,
        regime_tributario: formDataEmpresa.regime_tributario,
        segmento: formDataEmpresa.segmento,
        subsegmento: formDataEmpresa.subsegmento,
        natureza_juridica: formDataEmpresa.natureza_juridica,
        capital_social: formDataEmpresa.capital_social
          ? Number(formDataEmpresa.capital_social)
          : undefined,
        cnae_principal: formDataEmpresa.cnae_principal,
        cnaes_secundarios: formDataEmpresa.cnaes_secundarios,
        fator_r_optante: Boolean(formDataEmpresa.fator_r_optante),
        fator_r_alteracao_automatica_prolabore: Boolean(
          formDataEmpresa.fator_r_alteracao_automatica_prolabore,
        ),
        anexo_simples: formDataEmpresa.anexo_simples,
        tipo_de_nota: formDataEmpresa.tipo_de_nota,
        servicos_config_json: formDataEmpresa.servicos_config_json || SERVICOS_DEFAULT,
      }

      const empresaSalva = await empresasService.update(empresa.id, payloadEmpresa)

      // 2. Atualizar Sócios
      for (const socio of socios) {
        const dadosSocio = formDataSocios[socio.id]
        if (dadosSocio) {
          await proLaboreService.updateSocio(socio.id, {
            nome_completo: dadosSocio.nome_completo,
            cpf: dadosSocio.cpf,
            data_nascimento: dadosSocio.data_nascimento
              ? `${dadosSocio.data_nascimento.split('T')[0]}T00:00:00.000Z`
              : undefined,
            rg: dadosSocio.rg,
            data_expedicao_rg: dadosSocio.data_expedicao_rg
              ? `${dadosSocio.data_expedicao_rg.split('T')[0]}T00:00:00.000Z`
              : undefined,
            orgao_expedicao_rg: dadosSocio.orgao_expedicao_rg,
            uf_expedicao_rg: dadosSocio.uf_expedicao_rg,
            naturalidade: dadosSocio.naturalidade,
            uf_nascimento: dadosSocio.uf_nascimento,
            estado_civil: dadosSocio.estado_civil,
            regime_bens: dadosSocio.regime_bens,
            titulo_eleitor: dadosSocio.titulo_eleitor,
            recibo_irpf: dadosSocio.recibo_irpf,
            registro_spc: dadosSocio.registro_spc,
            nacionalidade: dadosSocio.nacionalidade,
            percentual_participacao: dadosSocio.percentual_participacao
              ? Number(dadosSocio.percentual_participacao)
              : 0,
            cep_endereco: dadosSocio.cep_endereco,
            logradouro_endereco: dadosSocio.logradouro_endereco,
            numero_endereco: dadosSocio.numero_endereco,
            complemento_endereco: dadosSocio.complemento_endereco,
            bairro_endereco: dadosSocio.bairro_endereco,
            cidade_endereco: dadosSocio.cidade_endereco,
            uf_endereco: dadosSocio.uf_endereco,
            serie_gv_scr: dadosSocio.serie_gv_scr,
            serie_gvr_scr: dadosSocio.serie_gvr_scr,
            senha_govbr: dadosSocio.senha_govbr,
            documentos_socios_json: dadosSocio.documentos_socios_json,
          })
        }
      }

      toast({
        title: 'Ficha Cadastral atualizada!',
        description: 'Dados da empresa e quadro societário salvos com sucesso.',
      })

      setModoEdicao(false)
      if (onEmpresaAtualizada) onEmpresaAtualizada(empresaSalva)
      await carregarSocios()
    } catch (err: any) {
      console.error('[FichaCadastral] Erro ao salvar:', err)
      toast({
        title: 'Erro ao salvar Ficha Cadastral',
        description: err?.message || 'Falha ao gravar os dados no banco.',
        variant: 'destructive',
      })
    } finally {
      setSalvando(false)
    }
  }

  // Upload simulado de documento do sócio
  const handleUploadDocSocio = (socioId: string) => {
    const nomeDoc = window.prompt(
      'Informe o nome do documento do sócio (ex: CNH, RG, Comprovante de Residência):',
    )
    if (!nomeDoc || !nomeDoc.trim()) return

    const sAtual = formDataSocios[socioId] || {}
    const docsAtuais = sAtual.documentos_socios_json || []
    const novoDoc = {
      id: `doc-${Date.now()}`,
      nome: nomeDoc.trim(),
      tipo: 'identificacao',
      data_upload: new Date().toISOString(),
    }
    const docsAtualizados = [...docsAtuais, novoDoc]

    setFormDataSocios((prev) => ({
      ...prev,
      [socioId]: {
        ...prev[socioId],
        documentos_socios_json: docsAtualizados,
      },
    }))

    toast({
      title: 'Documento registrado',
      description: `"${nomeDoc.trim()}" adicionado à lista. Clique em "Salvar Alterações" para confirmar no banco.`,
    })
  }

  // Remoção de doc do sócio
  const handleRemoverDocSocio = (socioId: string, docId?: string) => {
    const sAtual = formDataSocios[socioId] || {}
    const docsAtuais = sAtual.documentos_socios_json || []
    const filtrados = docsAtuais.filter((d) => d.id !== docId)

    setFormDataSocios((prev) => ({
      ...prev,
      [socioId]: {
        ...prev[socioId],
        documentos_socios_json: filtrados,
      },
    }))
  }

  // Grid de Serviços na Parametrização
  const servicosLista: ServicoItem[] =
    formDataEmpresa.servicos_config_json && Array.isArray(formDataEmpresa.servicos_config_json)
      ? formDataEmpresa.servicos_config_json
      : SERVICOS_DEFAULT

  return (
    <div id="rpa-empresa-ficha" className="space-y-6 text-[#1A2333]">
      {/* Barra de Ações Superior da Ficha */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-teal-50 text-[#0FA3A3] flex items-center justify-center font-bold">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-[#1A2333]">Ficha Cadastral Completa</h2>
              <Badge
                variant="outline"
                className="border-teal-300 bg-teal-50 text-teal-800 text-[10px] font-bold"
              >
                Layout &quot;Consulta de Empresa&quot;
              </Badge>
              <Badge
                variant="outline"
                className="border-slate-200 text-slate-500 font-mono text-[10px]"
              >
                #rpa-empresa-ficha
              </Badge>
            </div>
            <p className="text-xs text-[#64748B]">
              Visualização fiel de Identificação, Quadro Societário por sócio e Parametrização
              fiscal
            </p>
          </div>
        </div>

        {canEdit && (
          <div className="flex items-center gap-2">
            {!modoEdicao ? (
              <Button
                onClick={() => setModoEdicao(true)}
                className="gap-2 rounded-xl bg-[#0FA3A3] hover:bg-[#0C8585] text-white text-xs font-semibold h-9"
              >
                <Edit2 className="h-3.5 w-3.5" />
                <span>Editar Ficha</span>
              </Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  onClick={() => {
                    setModoEdicao(false)
                    carregarSocios()
                  }}
                  className="gap-1.5 rounded-xl text-xs h-9"
                  disabled={salvando}
                >
                  <X className="h-3.5 w-3.5" />
                  <span>Cancelar</span>
                </Button>
                <Button
                  onClick={handleSalvarFicha}
                  disabled={salvando}
                  className="gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold h-9"
                >
                  <Save className="h-3.5 w-3.5" />
                  <span>{salvando ? 'Salvando...' : 'Salvar Alterações'}</span>
                </Button>
              </>
            )}
          </div>
        )}
      </div>

      {/* ========================================================================================= */}
      {/* BLOCO 1 — IDENTIFICAÇÃO */}
      {/* ========================================================================================= */}
      <Card className="rounded-2xl border-slate-200 shadow-xs bg-white overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-slate-50 to-white border-b border-slate-100 py-3 px-5">
          <CardTitle className="text-sm font-bold text-[#1A2333] flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-[#0FA3A3]" />
              <span>Identificação</span>
            </span>
            <span className="text-[11px] font-normal text-slate-400 font-mono">
              Bloco 1 • Telemetria Ativa
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-5 space-y-5 text-xs">
          {/* Linha 1: Tag, Código, % Contratual, Cód. Externo */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <label className="text-[11px] font-semibold text-slate-600 mb-1 block">Tag:</label>
              {modoEdicao ? (
                <Input
                  value={formDataEmpresa.tag || ''}
                  onChange={(e) => setFormDataEmpresa({ ...formDataEmpresa, tag: e.target.value })}
                  className="h-8 text-xs font-bold"
                  placeholder="Ex.: RUMO CONSULTORIA"
                />
              ) : (
                <div
                  className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 font-bold text-slate-800"
                  data-rpa-field="tag"
                  data-rpa-value={formDataEmpresa.tag || '—'}
                >
                  {displayVal(formDataEmpresa.tag)}
                </div>
              )}
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-600 mb-1 block">Código:</label>
              {modoEdicao ? (
                <Input
                  value={formDataEmpresa.codigo_interno || ''}
                  onChange={(e) =>
                    setFormDataEmpresa({ ...formDataEmpresa, codigo_interno: e.target.value })
                  }
                  className="h-8 text-xs"
                  placeholder="Ex.: 001"
                />
              ) : (
                <div
                  className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 font-mono text-slate-800"
                  data-rpa-field="codigo"
                  data-rpa-value={formDataEmpresa.codigo_interno || '—'}
                >
                  {displayVal(formDataEmpresa.codigo_interno)}
                </div>
              )}
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-600 mb-1 block">
                % Contratual:
              </label>
              {modoEdicao ? (
                <Input
                  type="number"
                  step="0.01"
                  value={formDataEmpresa.percentual_contratual ?? ''}
                  onChange={(e) =>
                    setFormDataEmpresa({
                      ...formDataEmpresa,
                      percentual_contratual: e.target.value ? Number(e.target.value) : undefined,
                    })
                  }
                  className="h-8 text-xs"
                  placeholder="Ex.: 100"
                />
              ) : (
                <div
                  className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 font-mono text-slate-800"
                  data-rpa-field="percentual_contratual"
                  data-rpa-value={
                    formDataEmpresa.percentual_contratual !== undefined &&
                    formDataEmpresa.percentual_contratual !== null
                      ? `${formDataEmpresa.percentual_contratual}%`
                      : '—'
                  }
                >
                  {formDataEmpresa.percentual_contratual !== undefined &&
                  formDataEmpresa.percentual_contratual !== null
                    ? `${formDataEmpresa.percentual_contratual}%`
                    : '—'}
                </div>
              )}
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-600 mb-1 block">
                Cód. Externo:
              </label>
              {modoEdicao ? (
                <Input
                  value={formDataEmpresa.codigo_externo || ''}
                  onChange={(e) =>
                    setFormDataEmpresa({ ...formDataEmpresa, codigo_externo: e.target.value })
                  }
                  className="h-8 text-xs font-mono"
                  placeholder="Ex.: 2472"
                />
              ) : (
                <div
                  className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 font-mono text-slate-800"
                  data-rpa-field="cod_externo"
                  data-rpa-value={formDataEmpresa.codigo_externo || '—'}
                >
                  {displayVal(formDataEmpresa.codigo_externo)}
                </div>
              )}
            </div>
          </div>

          {/* Linha 2: Razão Social */}
          <div>
            <label className="text-[11px] font-semibold text-slate-600 mb-1 block">
              Razão Social:
            </label>
            {modoEdicao ? (
              <Input
                value={formDataEmpresa.razao_social || ''}
                onChange={(e) =>
                  setFormDataEmpresa({ ...formDataEmpresa, razao_social: e.target.value })
                }
                className="h-8 text-xs uppercase font-semibold"
              />
            ) : (
              <div
                className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 font-semibold text-slate-900"
                data-rpa-field="razao_social"
                data-rpa-value={formDataEmpresa.razao_social || '—'}
              >
                {displayVal(formDataEmpresa.razao_social)}
              </div>
            )}
          </div>

          {/* Linha 3: 2ª Razão Social */}
          <div>
            <label className="text-[11px] font-semibold text-slate-600 mb-1 block">
              2ª Razão Social:
            </label>
            {modoEdicao ? (
              <Input
                value={formDataEmpresa.razao_social_2 || ''}
                onChange={(e) =>
                  setFormDataEmpresa({ ...formDataEmpresa, razao_social_2: e.target.value })
                }
                className="h-8 text-xs uppercase"
                placeholder="Não informado"
              />
            ) : (
              <div
                className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-slate-700"
                data-rpa-field="razao_social_2"
                data-rpa-value={formDataEmpresa.razao_social_2 || '—'}
              >
                {displayVal(formDataEmpresa.razao_social_2)}
              </div>
            )}
          </div>

          {/* Linha 4: 3ª Razão Social */}
          <div>
            <label className="text-[11px] font-semibold text-slate-600 mb-1 block">
              3ª Razão Social:
            </label>
            {modoEdicao ? (
              <Input
                value={formDataEmpresa.razao_social_3 || ''}
                onChange={(e) =>
                  setFormDataEmpresa({ ...formDataEmpresa, razao_social_3: e.target.value })
                }
                className="h-8 text-xs uppercase"
                placeholder="Não informado"
              />
            ) : (
              <div
                className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-slate-700"
                data-rpa-field="razao_social_3"
                data-rpa-value={formDataEmpresa.razao_social_3 || '—'}
              >
                {displayVal(formDataEmpresa.razao_social_3)}
              </div>
            )}
          </div>

          {/* Linha 5: CNPJ, Data CNPJ */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-semibold text-slate-600 mb-1 block">CNPJ:</label>
              {modoEdicao ? (
                <Input
                  value={formDataEmpresa.cnpj || ''}
                  onChange={(e) => setFormDataEmpresa({ ...formDataEmpresa, cnpj: e.target.value })}
                  className="h-8 text-xs font-mono font-semibold"
                />
              ) : (
                <div
                  className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 font-mono font-semibold text-slate-900"
                  data-rpa-field="cnpj"
                  data-rpa-value={formDataEmpresa.cnpj || '—'}
                >
                  {displayVal(formDataEmpresa.cnpj)}
                </div>
              )}
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-600 mb-1 block">
                Data CNPJ:
              </label>
              {modoEdicao ? (
                <Input
                  type="date"
                  value={formDataEmpresa.data_abertura || ''}
                  onChange={(e) =>
                    setFormDataEmpresa({ ...formDataEmpresa, data_abertura: e.target.value })
                  }
                  className="h-8 text-xs"
                />
              ) : (
                <div
                  className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 font-mono text-slate-800"
                  data-rpa-field="data_cnpj"
                  data-rpa-value={formatDataPtBr(formDataEmpresa.data_abertura)}
                >
                  {formatDataPtBr(formDataEmpresa.data_abertura)}
                </div>
              )}
            </div>
          </div>

          {/* Linha 6: IE, IM */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-semibold text-slate-600 mb-1 block">I.E.:</label>
              {modoEdicao ? (
                <Input
                  value={formDataEmpresa.inscricao_estadual || ''}
                  onChange={(e) =>
                    setFormDataEmpresa({ ...formDataEmpresa, inscricao_estadual: e.target.value })
                  }
                  className="h-8 text-xs font-mono"
                  placeholder="Não informado"
                />
              ) : (
                <div
                  className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 font-mono text-slate-800"
                  data-rpa-field="ie"
                  data-rpa-value={formDataEmpresa.inscricao_estadual || '—'}
                >
                  {displayVal(formDataEmpresa.inscricao_estadual)}
                </div>
              )}
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-600 mb-1 block">I.M.:</label>
              {modoEdicao ? (
                <Input
                  value={formDataEmpresa.inscricao_municipal || ''}
                  onChange={(e) =>
                    setFormDataEmpresa({ ...formDataEmpresa, inscricao_municipal: e.target.value })
                  }
                  className="h-8 text-xs font-mono"
                  placeholder="Ex.: 171911734108"
                />
              ) : (
                <div
                  className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 font-mono text-slate-800"
                  data-rpa-field="im"
                  data-rpa-value={formDataEmpresa.inscricao_municipal || '—'}
                >
                  {displayVal(formDataEmpresa.inscricao_municipal)}
                </div>
              )}
            </div>
          </div>

          {/* Linha 7: NIRE, CEmail (ou E-mail) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-semibold text-slate-600 mb-1 block">NIRE:</label>
              {modoEdicao ? (
                <Input
                  value={formDataEmpresa.nire || ''}
                  onChange={(e) => setFormDataEmpresa({ ...formDataEmpresa, nire: e.target.value })}
                  className="h-8 text-xs font-mono"
                  placeholder="Ex.: 41212620072"
                />
              ) : (
                <div
                  className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 font-mono text-slate-800"
                  data-rpa-field="nire"
                  data-rpa-value={formDataEmpresa.nire || '—'}
                >
                  {displayVal(formDataEmpresa.nire)}
                </div>
              )}
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-600 mb-1 block">
                CEmail (E-mail):
              </label>
              {modoEdicao ? (
                <Input
                  type="email"
                  value={formDataEmpresa.cemail || formDataEmpresa.email || ''}
                  onChange={(e) =>
                    setFormDataEmpresa({
                      ...formDataEmpresa,
                      cemail: e.target.value,
                      email: e.target.value,
                    })
                  }
                  className="h-8 text-xs"
                  placeholder="Ex.: contato@empresa.com.br"
                />
              ) : (
                <div
                  className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-slate-800 truncate"
                  data-rpa-field="cemail"
                  data-rpa-value={formDataEmpresa.cemail || formDataEmpresa.email || '—'}
                >
                  {displayVal(formDataEmpresa.cemail || formDataEmpresa.email)}
                </div>
              )}
            </div>
          </div>

          {/* Linha 8: Telefone, NAF/e-CNPJ */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-semibold text-slate-600 mb-1 block">
                Telefone:
              </label>
              {modoEdicao ? (
                <Input
                  value={formDataEmpresa.telefone || ''}
                  onChange={(e) =>
                    setFormDataEmpresa({ ...formDataEmpresa, telefone: e.target.value })
                  }
                  className="h-8 text-xs font-mono"
                  placeholder="(41) 9999-9999"
                />
              ) : (
                <div
                  className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 font-mono text-slate-800"
                  data-rpa-field="telefone"
                  data-rpa-value={formDataEmpresa.telefone || '—'}
                >
                  {displayVal(formDataEmpresa.telefone)}
                </div>
              )}
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-600 mb-1 block">
                NAF / e-CNPJ:
              </label>
              {modoEdicao ? (
                <Input
                  value={formDataEmpresa.naf_ecnpj || ''}
                  onChange={(e) =>
                    setFormDataEmpresa({ ...formDataEmpresa, naf_ecnpj: e.target.value })
                  }
                  className="h-8 text-xs"
                  placeholder="Ex.: e-CNPJ Ativo / CTA"
                />
              ) : (
                <div
                  className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-slate-800"
                  data-rpa-field="naf_ecnpj"
                  data-rpa-value={formDataEmpresa.naf_ecnpj || '—'}
                >
                  {displayVal(formDataEmpresa.naf_ecnpj)}
                </div>
              )}
            </div>
          </div>

          {/* ------------------------------------------------------------- */}
          {/* Sub-bloco LOCALIZAÇÃO */}
          {/* ------------------------------------------------------------- */}
          <div className="pt-4 border-t border-slate-200 space-y-4">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-[#0FA3A3]" />
              <span>Localização</span>
            </h4>

            {/* CEP */}
            <div className="max-w-xs">
              <label className="text-[11px] font-semibold text-slate-600 mb-1 block">CEP:</label>
              {modoEdicao ? (
                <Input
                  value={formDataEmpresa.cep || ''}
                  onChange={(e) => setFormDataEmpresa({ ...formDataEmpresa, cep: e.target.value })}
                  className="h-8 text-xs font-mono"
                  placeholder="81210-245"
                />
              ) : (
                <div
                  className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 font-mono text-slate-800"
                  data-rpa-field="cep"
                  data-rpa-value={formDataEmpresa.cep || '—'}
                >
                  {displayVal(formDataEmpresa.cep)}
                </div>
              )}
            </div>

            {/* Endereço */}
            <div>
              <label className="text-[11px] font-semibold text-slate-600 mb-1 block">
                Endereço:
              </label>
              {modoEdicao ? (
                <Input
                  value={formDataEmpresa.logradouro || ''}
                  onChange={(e) =>
                    setFormDataEmpresa({ ...formDataEmpresa, logradouro: e.target.value })
                  }
                  className="h-8 text-xs uppercase"
                  placeholder="RUA JOSÉ MARTINHO LISSA"
                />
              ) : (
                <div
                  className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-slate-800 uppercase"
                  data-rpa-field="endereco"
                  data-rpa-value={formDataEmpresa.logradouro || '—'}
                >
                  {displayVal(formDataEmpresa.logradouro)}
                </div>
              )}
            </div>

            {/* Número, Complemento */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-1">
                <label className="text-[11px] font-semibold text-slate-600 mb-1 block">
                  Número:
                </label>
                {modoEdicao ? (
                  <Input
                    value={formDataEmpresa.numero || ''}
                    onChange={(e) =>
                      setFormDataEmpresa({ ...formDataEmpresa, numero: e.target.value })
                    }
                    className="h-8 text-xs"
                    placeholder="48"
                  />
                ) : (
                  <div
                    className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-slate-800"
                    data-rpa-field="numero"
                    data-rpa-value={formDataEmpresa.numero || '—'}
                  >
                    {displayVal(formDataEmpresa.numero)}
                  </div>
                )}
              </div>

              <div className="sm:col-span-2">
                <label className="text-[11px] font-semibold text-slate-600 mb-1 block">
                  Complemento:
                </label>
                {modoEdicao ? (
                  <Input
                    value={formDataEmpresa.complemento || ''}
                    onChange={(e) =>
                      setFormDataEmpresa({ ...formDataEmpresa, complemento: e.target.value })
                    }
                    className="h-8 text-xs uppercase"
                    placeholder="CASA 03 COND CALIFORNIA RES"
                  />
                ) : (
                  <div
                    className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-slate-800 uppercase"
                    data-rpa-field="complemento"
                    data-rpa-value={formDataEmpresa.complemento || '—'}
                  >
                    {displayVal(formDataEmpresa.complemento)}
                  </div>
                )}
              </div>
            </div>

            {/* Bairro, Cidade, Estado */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-slate-600 mb-1 block">
                  Bairro:
                </label>
                {modoEdicao ? (
                  <Input
                    value={formDataEmpresa.bairro || ''}
                    onChange={(e) =>
                      setFormDataEmpresa({ ...formDataEmpresa, bairro: e.target.value })
                    }
                    className="h-8 text-xs"
                    placeholder="MOSSUNGUÊ"
                  />
                ) : (
                  <div
                    className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-slate-800"
                    data-rpa-field="bairro"
                    data-rpa-value={formDataEmpresa.bairro || '—'}
                  >
                    {displayVal(formDataEmpresa.bairro)}
                  </div>
                )}
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-600 mb-1 block">
                  Cidade:
                </label>
                {modoEdicao ? (
                  <Input
                    value={formDataEmpresa.cidade || ''}
                    onChange={(e) =>
                      setFormDataEmpresa({ ...formDataEmpresa, cidade: e.target.value })
                    }
                    className="h-8 text-xs"
                    placeholder="Curitiba"
                  />
                ) : (
                  <div
                    className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-slate-800"
                    data-rpa-field="cidade"
                    data-rpa-value={formDataEmpresa.cidade || '—'}
                  >
                    {displayVal(formDataEmpresa.cidade)}
                  </div>
                )}
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-600 mb-1 block">
                  Estado (UF):
                </label>
                {modoEdicao ? (
                  <Input
                    value={formDataEmpresa.uf || ''}
                    onChange={(e) =>
                      setFormDataEmpresa({ ...formDataEmpresa, uf: e.target.value.toUpperCase() })
                    }
                    className="h-8 text-xs uppercase"
                    placeholder="PR"
                  />
                ) : (
                  <div
                    className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-slate-800 font-semibold"
                    data-rpa-field="estado"
                    data-rpa-value={formDataEmpresa.uf || '—'}
                  >
                    {displayVal(formDataEmpresa.uf)}
                  </div>
                )}
              </div>
            </div>

            {/* Área Ocupada, Atuação */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-slate-600 mb-1 block">
                  Área Ocupada:
                </label>
                {modoEdicao ? (
                  <Input
                    value={formDataEmpresa.area_ocupada_m2 || ''}
                    onChange={(e) =>
                      setFormDataEmpresa({ ...formDataEmpresa, area_ocupada_m2: e.target.value })
                    }
                    className="h-8 text-xs"
                    placeholder="0.00m²"
                  />
                ) : (
                  <div
                    className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-slate-800"
                    data-rpa-field="area_ocupada"
                    data-rpa-value={formDataEmpresa.area_ocupada_m2 || '—'}
                  >
                    {displayVal(formDataEmpresa.area_ocupada_m2)}
                  </div>
                )}
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-600 mb-1 block">
                  Atuação:
                </label>
                {modoEdicao ? (
                  <Input
                    value={formDataEmpresa.atuacao || ''}
                    onChange={(e) =>
                      setFormDataEmpresa({ ...formDataEmpresa, atuacao: e.target.value })
                    }
                    className="h-8 text-xs"
                    placeholder="Não informado"
                  />
                ) : (
                  <div
                    className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-slate-800"
                    data-rpa-field="atuacao"
                    data-rpa-value={formDataEmpresa.atuacao || '—'}
                  >
                    {displayVal(formDataEmpresa.atuacao)}
                  </div>
                )}
              </div>
            </div>

            {/* Unidade, Unidade Auxiliar */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-slate-600 mb-1 block">
                  Unidade:
                </label>
                {modoEdicao ? (
                  <Input
                    value={formDataEmpresa.unidade || ''}
                    onChange={(e) =>
                      setFormDataEmpresa({ ...formDataEmpresa, unidade: e.target.value })
                    }
                    className="h-8 text-xs"
                    placeholder="Não informado"
                  />
                ) : (
                  <div
                    className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-slate-800"
                    data-rpa-field="unidade"
                    data-rpa-value={formDataEmpresa.unidade || '—'}
                  >
                    {displayVal(formDataEmpresa.unidade)}
                  </div>
                )}
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-600 mb-1 block">
                  Unidade Aux.:
                </label>
                {modoEdicao ? (
                  <Input
                    value={formDataEmpresa.unidade_auxiliar || ''}
                    onChange={(e) =>
                      setFormDataEmpresa({ ...formDataEmpresa, unidade_auxiliar: e.target.value })
                    }
                    className="h-8 text-xs"
                    placeholder="Não informado"
                  />
                ) : (
                  <div
                    className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-slate-800"
                    data-rpa-field="unidade_auxiliar"
                    data-rpa-value={formDataEmpresa.unidade_auxiliar || '—'}
                  >
                    {displayVal(formDataEmpresa.unidade_auxiliar)}
                  </div>
                )}
              </div>
            </div>

            {/* Atividade */}
            <div>
              <label className="text-[11px] font-semibold text-slate-600 mb-1 block">
                Atividade:
              </label>
              {modoEdicao ? (
                <Input
                  value={formDataEmpresa.atividade_descricao || ''}
                  onChange={(e) =>
                    setFormDataEmpresa({ ...formDataEmpresa, atividade_descricao: e.target.value })
                  }
                  className="h-8 text-xs"
                  placeholder="Ex.: 69.20-6-01 - Atividades de contabilidade"
                />
              ) : (
                <div
                  className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-slate-800"
                  data-rpa-field="atividade"
                  data-rpa-value={formDataEmpresa.atividade_descricao || '—'}
                >
                  {displayVal(formDataEmpresa.atividade_descricao)}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ========================================================================================= */}
      {/* BLOCO 2 — SOCIETÁRIO (ACCORDION POR SÓCIO COM TELEMETRIA rpa-grid-qsa) */}
      {/* ========================================================================================= */}
      <Card
        id="rpa-grid-qsa"
        data-total-rows={socios.length}
        className="rounded-2xl border-slate-200 shadow-xs bg-white overflow-hidden"
      >
        <CardHeader className="bg-gradient-to-r from-slate-50 to-white border-b border-slate-100 py-3 px-5 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-bold text-[#1A2333] flex items-center gap-2">
            <Users className="h-4 w-4 text-[#0FA3A3]" />
            <span>
              Societário ({socios.length} sócio{socios.length !== 1 ? 's' : ''})
            </span>
          </CardTitle>
          <span className="text-[11px] font-normal text-slate-400 font-mono">
            Bloco 2 • #rpa-grid-qsa
          </span>
        </CardHeader>
        <CardContent className="p-5 space-y-4">
          {loadingSocios ? (
            <div className="py-8 text-center text-xs text-slate-400">
              Carregando quadro societário...
            </div>
          ) : socios.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-500 border border-dashed border-slate-200 rounded-xl">
              Nenhum sócio cadastrado nesta empresa.
            </div>
          ) : (
            socios.map((socio) => {
              const aberto = sociosAbertos[socio.id] ?? true
              const sForm = formDataSocios[socio.id] || socio

              return (
                <div
                  key={socio.id}
                  data-socio-id={socio.id}
                  data-socio-cpf={sForm.cpf || '—'}
                  data-socio-participacao={
                    sForm.percentual_participacao !== undefined
                      ? `${sForm.percentual_participacao}%`
                      : '—'
                  }
                  className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-2xs"
                >
                  {/* Cabeçalho do Accordion por Sócio */}
                  <button
                    type="button"
                    onClick={() => toggleSocioAccordion(socio.id)}
                    className="w-full flex items-center justify-between p-3.5 bg-slate-50 hover:bg-slate-100/80 transition-colors text-left border-b border-slate-200"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs uppercase text-slate-900">
                        {displayVal(sForm.nome_completo || socio.nome_completo)}
                      </span>
                      {sForm.percentual_participacao !== undefined && (
                        <Badge
                          variant="outline"
                          className="bg-white text-teal-800 border-teal-300 text-[10px] font-bold"
                        >
                          {sForm.percentual_participacao}% de quotas
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-mono text-slate-500">{sForm.cpf}</span>
                      {aberto ? (
                        <ChevronUp className="h-4 w-4 text-slate-500" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-slate-500" />
                      )}
                    </div>
                  </button>

                  {/* Corpo do Sócio */}
                  {aberto && (
                    <div className="p-4 space-y-5 text-xs">
                      {/* Sub-bloco DADOS */}
                      <div className="space-y-3">
                        <h5 className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                          Dados Pessoais
                        </h5>

                        {/* Nome */}
                        <div>
                          <label className="text-[11px] font-semibold text-slate-600 mb-1 block">
                            Nome:
                          </label>
                          {modoEdicao ? (
                            <Input
                              value={sForm.nome_completo || ''}
                              onChange={(e) =>
                                setFormDataSocios((prev) => ({
                                  ...prev,
                                  [socio.id]: {
                                    ...prev[socio.id],
                                    nome_completo: e.target.value,
                                  },
                                }))
                              }
                              className="h-8 text-xs uppercase"
                            />
                          ) : (
                            <div
                              className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 font-semibold text-slate-900 uppercase"
                              data-rpa-field={`socio_${socio.id}_nome`}
                              data-rpa-value={sForm.nome_completo || '—'}
                            >
                              {displayVal(sForm.nome_completo)}
                            </div>
                          )}
                        </div>

                        {/* CPF, Data de Nascimento */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="text-[11px] font-semibold text-slate-600 mb-1 block">
                              CPF:
                            </label>
                            {modoEdicao ? (
                              <Input
                                value={sForm.cpf || ''}
                                onChange={(e) =>
                                  setFormDataSocios((prev) => ({
                                    ...prev,
                                    [socio.id]: { ...prev[socio.id], cpf: e.target.value },
                                  }))
                                }
                                className="h-8 text-xs font-mono"
                              />
                            ) : (
                              <div
                                className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 font-mono text-slate-800"
                                data-rpa-field={`socio_${socio.id}_cpf`}
                                data-rpa-value={sForm.cpf || '—'}
                              >
                                {displayVal(sForm.cpf)}
                              </div>
                            )}
                          </div>

                          <div>
                            <label className="text-[11px] font-semibold text-slate-600 mb-1 block">
                              Data de Nascimento:
                            </label>
                            {modoEdicao ? (
                              <Input
                                type="date"
                                value={
                                  sForm.data_nascimento ? sForm.data_nascimento.split('T')[0] : ''
                                }
                                onChange={(e) =>
                                  setFormDataSocios((prev) => ({
                                    ...prev,
                                    [socio.id]: {
                                      ...prev[socio.id],
                                      data_nascimento: e.target.value,
                                    },
                                  }))
                                }
                                className="h-8 text-xs"
                              />
                            ) : (
                              <div
                                className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 font-mono text-slate-800"
                                data-rpa-field={`socio_${socio.id}_nascimento`}
                                data-rpa-value={formatDataPtBr(sForm.data_nascimento)}
                              >
                                {formatDataPtBr(sForm.data_nascimento)}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* RG, Data de Expedição */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="text-[11px] font-semibold text-slate-600 mb-1 block">
                              RG:
                            </label>
                            {modoEdicao ? (
                              <Input
                                value={sForm.rg || ''}
                                onChange={(e) =>
                                  setFormDataSocios((prev) => ({
                                    ...prev,
                                    [socio.id]: { ...prev[socio.id], rg: e.target.value },
                                  }))
                                }
                                className="h-8 text-xs font-mono"
                                placeholder="Não informado"
                              />
                            ) : (
                              <div
                                className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 font-mono text-slate-800"
                                data-rpa-field={`socio_${socio.id}_rg`}
                                data-rpa-value={sForm.rg || '—'}
                              >
                                {displayVal(sForm.rg)}
                              </div>
                            )}
                          </div>

                          <div>
                            <label className="text-[11px] font-semibold text-slate-600 mb-1 block">
                              Data de Expedição:
                            </label>
                            {modoEdicao ? (
                              <Input
                                type="date"
                                value={
                                  sForm.data_expedicao_rg
                                    ? sForm.data_expedicao_rg.split('T')[0]
                                    : ''
                                }
                                onChange={(e) =>
                                  setFormDataSocios((prev) => ({
                                    ...prev,
                                    [socio.id]: {
                                      ...prev[socio.id],
                                      data_expedicao_rg: e.target.value,
                                    },
                                  }))
                                }
                                className="h-8 text-xs"
                              />
                            ) : (
                              <div
                                className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 font-mono text-slate-800"
                                data-rpa-field={`socio_${socio.id}_rg_expedicao`}
                                data-rpa-value={formatDataPtBr(sForm.data_expedicao_rg)}
                              >
                                {formatDataPtBr(sForm.data_expedicao_rg)}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* UF de Expedição, Órgão de Expedição */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="text-[11px] font-semibold text-slate-600 mb-1 block">
                              UF de Expedição:
                            </label>
                            {modoEdicao ? (
                              <Input
                                value={sForm.uf_expedicao_rg || ''}
                                onChange={(e) =>
                                  setFormDataSocios((prev) => ({
                                    ...prev,
                                    [socio.id]: {
                                      ...prev[socio.id],
                                      uf_expedicao_rg: e.target.value.toUpperCase(),
                                    },
                                  }))
                                }
                                className="h-8 text-xs uppercase"
                                placeholder="null / PR"
                              />
                            ) : (
                              <div
                                className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-slate-800"
                                data-rpa-field={`socio_${socio.id}_rg_uf`}
                                data-rpa-value={sForm.uf_expedicao_rg || '—'}
                              >
                                {displayVal(sForm.uf_expedicao_rg)}
                              </div>
                            )}
                          </div>

                          <div>
                            <label className="text-[11px] font-semibold text-slate-600 mb-1 block">
                              Órgão de Expedição:
                            </label>
                            {modoEdicao ? (
                              <Input
                                value={sForm.orgao_expedicao_rg || ''}
                                onChange={(e) =>
                                  setFormDataSocios((prev) => ({
                                    ...prev,
                                    [socio.id]: {
                                      ...prev[socio.id],
                                      orgao_expedicao_rg: e.target.value.toUpperCase(),
                                    },
                                  }))
                                }
                                className="h-8 text-xs uppercase"
                                placeholder="SSP"
                              />
                            ) : (
                              <div
                                className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-slate-800"
                                data-rpa-field={`socio_${socio.id}_rg_orgao`}
                                data-rpa-value={sForm.orgao_expedicao_rg || '—'}
                              >
                                {displayVal(sForm.orgao_expedicao_rg)}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Estado Civil, Regime de Bens */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="text-[11px] font-semibold text-slate-600 mb-1 block">
                              Estado Civil:
                            </label>
                            {modoEdicao ? (
                              <Input
                                value={sForm.estado_civil || ''}
                                onChange={(e) =>
                                  setFormDataSocios((prev) => ({
                                    ...prev,
                                    [socio.id]: {
                                      ...prev[socio.id],
                                      estado_civil: e.target.value,
                                    },
                                  }))
                                }
                                className="h-8 text-xs"
                                placeholder="Casado(a)"
                              />
                            ) : (
                              <div
                                className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-slate-800"
                                data-rpa-field={`socio_${socio.id}_estado_civil`}
                                data-rpa-value={sForm.estado_civil || '—'}
                              >
                                {displayVal(sForm.estado_civil)}
                              </div>
                            )}
                          </div>

                          <div>
                            <label className="text-[11px] font-semibold text-slate-600 mb-1 block">
                              Regime de Bens:
                            </label>
                            {modoEdicao ? (
                              <Input
                                value={sForm.regime_bens || ''}
                                onChange={(e) =>
                                  setFormDataSocios((prev) => ({
                                    ...prev,
                                    [socio.id]: {
                                      ...prev[socio.id],
                                      regime_bens: e.target.value,
                                    },
                                  }))
                                }
                                className="h-8 text-xs"
                                placeholder="Comunhão parcial de bens"
                              />
                            ) : (
                              <div
                                className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-slate-800"
                                data-rpa-field={`socio_${socio.id}_regime_bens`}
                                data-rpa-value={sForm.regime_bens || '—'}
                              >
                                {displayVal(sForm.regime_bens)}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Título de Eleitor, Recibo IRPF */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="text-[11px] font-semibold text-slate-600 mb-1 block">
                              Título de Eleitor:
                            </label>
                            {modoEdicao ? (
                              <Input
                                value={sForm.titulo_eleitor || ''}
                                onChange={(e) =>
                                  setFormDataSocios((prev) => ({
                                    ...prev,
                                    [socio.id]: {
                                      ...prev[socio.id],
                                      titulo_eleitor: e.target.value,
                                    },
                                  }))
                                }
                                className="h-8 text-xs font-mono"
                                placeholder="Não informado"
                              />
                            ) : (
                              <div
                                className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 font-mono text-slate-800"
                                data-rpa-field={`socio_${socio.id}_titulo_eleitor`}
                                data-rpa-value={sForm.titulo_eleitor || '—'}
                              >
                                {displayVal(sForm.titulo_eleitor)}
                              </div>
                            )}
                          </div>

                          <div>
                            <label className="text-[11px] font-semibold text-slate-600 mb-1 block">
                              Recibo IRPF:
                            </label>
                            {modoEdicao ? (
                              <Input
                                value={sForm.recibo_irpf || ''}
                                onChange={(e) =>
                                  setFormDataSocios((prev) => ({
                                    ...prev,
                                    [socio.id]: {
                                      ...prev[socio.id],
                                      recibo_irpf: e.target.value,
                                    },
                                  }))
                                }
                                className="h-8 text-xs font-mono"
                                placeholder="Não informado"
                              />
                            ) : (
                              <div
                                className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 font-mono text-slate-800"
                                data-rpa-field={`socio_${socio.id}_recibo_irpf`}
                                data-rpa-value={sForm.recibo_irpf || '—'}
                              >
                                {displayVal(sForm.recibo_irpf)}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Naturalidade, Participação % */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="text-[11px] font-semibold text-slate-600 mb-1 block">
                              Naturalidade:
                            </label>
                            {modoEdicao ? (
                              <Input
                                value={sForm.naturalidade || ''}
                                onChange={(e) =>
                                  setFormDataSocios((prev) => ({
                                    ...prev,
                                    [socio.id]: {
                                      ...prev[socio.id],
                                      naturalidade: e.target.value,
                                    },
                                  }))
                                }
                                className="h-8 text-xs uppercase"
                                placeholder="Ex.: PINHÃO"
                              />
                            ) : (
                              <div
                                className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-slate-800 uppercase"
                                data-rpa-field={`socio_${socio.id}_naturalidade`}
                                data-rpa-value={sForm.naturalidade || '—'}
                              >
                                {displayVal(sForm.naturalidade)}
                              </div>
                            )}
                          </div>

                          <div>
                            <label className="text-[11px] font-semibold text-slate-600 mb-1 block">
                              Participação:
                            </label>
                            {modoEdicao ? (
                              <Input
                                type="number"
                                step="0.01"
                                value={sForm.percentual_participacao ?? ''}
                                onChange={(e) =>
                                  setFormDataSocios((prev) => ({
                                    ...prev,
                                    [socio.id]: {
                                      ...prev[socio.id],
                                      percentual_participacao: e.target.value
                                        ? Number(e.target.value)
                                        : 0,
                                    },
                                  }))
                                }
                                className="h-8 text-xs font-mono"
                                placeholder="50.00"
                              />
                            ) : (
                              <div
                                className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 font-mono font-bold text-teal-800"
                                data-rpa-field={`socio_${socio.id}_participacao`}
                                data-rpa-value={
                                  sForm.percentual_participacao !== undefined
                                    ? `${sForm.percentual_participacao.toFixed(2)}%`
                                    : '—'
                                }
                              >
                                {sForm.percentual_participacao !== undefined
                                  ? `${sForm.percentual_participacao.toFixed(2)}%`
                                  : '—'}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Registro SPC e Nacionalidade */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="text-[11px] font-semibold text-slate-600 mb-1 block">
                              Registro SPC:
                            </label>
                            {modoEdicao ? (
                              <Input
                                value={sForm.registro_spc || ''}
                                onChange={(e) =>
                                  setFormDataSocios((prev) => ({
                                    ...prev,
                                    [socio.id]: {
                                      ...prev[socio.id],
                                      registro_spc: e.target.value,
                                    },
                                  }))
                                }
                                className="h-8 text-xs font-mono"
                                placeholder="Não informado"
                              />
                            ) : (
                              <div
                                className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 font-mono text-slate-800"
                                data-rpa-field={`socio_${socio.id}_registro_spc`}
                                data-rpa-value={sForm.registro_spc || '—'}
                              >
                                {displayVal(sForm.registro_spc)}
                              </div>
                            )}
                          </div>

                          <div>
                            <label className="text-[11px] font-semibold text-slate-600 mb-1 block">
                              Nacionalidade:
                            </label>
                            {modoEdicao ? (
                              <Input
                                value={sForm.nacionalidade || ''}
                                onChange={(e) =>
                                  setFormDataSocios((prev) => ({
                                    ...prev,
                                    [socio.id]: {
                                      ...prev[socio.id],
                                      nacionalidade: e.target.value,
                                    },
                                  }))
                                }
                                className="h-8 text-xs"
                                placeholder="Brasileira"
                              />
                            ) : (
                              <div
                                className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-slate-800"
                                data-rpa-field={`socio_${socio.id}_nacionalidade`}
                                data-rpa-value={sForm.nacionalidade || '—'}
                              >
                                {displayVal(sForm.nacionalidade)}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Sub-bloco ENDEREÇO DO SÓCIO */}
                      <div className="pt-4 border-t border-slate-200 space-y-3">
                        <h5 className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                          <MapPin className="h-3.5 w-3.5 text-[#0FA3A3]" />
                          <span>Endereço do Sócio</span>
                        </h5>

                        <div className="max-w-xs">
                          <label className="text-[11px] font-semibold text-slate-600 mb-1 block">
                            CEP:
                          </label>
                          {modoEdicao ? (
                            <Input
                              value={sForm.cep_endereco || ''}
                              onChange={(e) =>
                                setFormDataSocios((prev) => ({
                                  ...prev,
                                  [socio.id]: {
                                    ...prev[socio.id],
                                    cep_endereco: e.target.value,
                                  },
                                }))
                              }
                              className="h-8 text-xs font-mono"
                              placeholder="81210245"
                            />
                          ) : (
                            <div
                              className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 font-mono text-slate-800"
                              data-rpa-field={`socio_${socio.id}_endereco_cep`}
                              data-rpa-value={sForm.cep_endereco || '—'}
                            >
                              {displayVal(sForm.cep_endereco)}
                            </div>
                          )}
                        </div>

                        <div>
                          <label className="text-[11px] font-semibold text-slate-600 mb-1 block">
                            Endereço:
                          </label>
                          {modoEdicao ? (
                            <Input
                              value={sForm.logradouro_endereco || ''}
                              onChange={(e) =>
                                setFormDataSocios((prev) => ({
                                  ...prev,
                                  [socio.id]: {
                                    ...prev[socio.id],
                                    logradouro_endereco: e.target.value,
                                  },
                                }))
                              }
                              className="h-8 text-xs"
                              placeholder="Rua José Martinho Lissa"
                            />
                          ) : (
                            <div
                              className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-slate-800"
                              data-rpa-field={`socio_${socio.id}_endereco_logradouro`}
                              data-rpa-value={sForm.logradouro_endereco || '—'}
                            >
                              {displayVal(sForm.logradouro_endereco)}
                            </div>
                          )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div>
                            <label className="text-[11px] font-semibold text-slate-600 mb-1 block">
                              Número:
                            </label>
                            {modoEdicao ? (
                              <Input
                                value={sForm.numero_endereco || ''}
                                onChange={(e) =>
                                  setFormDataSocios((prev) => ({
                                    ...prev,
                                    [socio.id]: {
                                      ...prev[socio.id],
                                      numero_endereco: e.target.value,
                                    },
                                  }))
                                }
                                className="h-8 text-xs"
                                placeholder="48"
                              />
                            ) : (
                              <div
                                className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-slate-800"
                                data-rpa-field={`socio_${socio.id}_endereco_numero`}
                                data-rpa-value={sForm.numero_endereco || '—'}
                              >
                                {displayVal(sForm.numero_endereco)}
                              </div>
                            )}
                          </div>

                          <div className="sm:col-span-2">
                            <label className="text-[11px] font-semibold text-slate-600 mb-1 block">
                              Complemento:
                            </label>
                            {modoEdicao ? (
                              <Input
                                value={sForm.complemento_endereco || ''}
                                onChange={(e) =>
                                  setFormDataSocios((prev) => ({
                                    ...prev,
                                    [socio.id]: {
                                      ...prev[socio.id],
                                      complemento_endereco: e.target.value,
                                    },
                                  }))
                                }
                                className="h-8 text-xs uppercase"
                                placeholder="CASA SOBRADO"
                              />
                            ) : (
                              <div
                                className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-slate-800"
                                data-rpa-field={`socio_${socio.id}_endereco_complemento`}
                                data-rpa-value={sForm.complemento_endereco || '—'}
                              >
                                {displayVal(sForm.complemento_endereco)}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div>
                            <label className="text-[11px] font-semibold text-slate-600 mb-1 block">
                              Bairro:
                            </label>
                            {modoEdicao ? (
                              <Input
                                value={sForm.bairro_endereco || ''}
                                onChange={(e) =>
                                  setFormDataSocios((prev) => ({
                                    ...prev,
                                    [socio.id]: {
                                      ...prev[socio.id],
                                      bairro_endereco: e.target.value,
                                    },
                                  }))
                                }
                                className="h-8 text-xs"
                                placeholder="Mossunguê"
                              />
                            ) : (
                              <div
                                className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-slate-800"
                                data-rpa-field={`socio_${socio.id}_endereco_bairro`}
                                data-rpa-value={sForm.bairro_endereco || '—'}
                              >
                                {displayVal(sForm.bairro_endereco)}
                              </div>
                            )}
                          </div>

                          <div>
                            <label className="text-[11px] font-semibold text-slate-600 mb-1 block">
                              Cidade:
                            </label>
                            {modoEdicao ? (
                              <Input
                                value={sForm.cidade_endereco || ''}
                                onChange={(e) =>
                                  setFormDataSocios((prev) => ({
                                    ...prev,
                                    [socio.id]: {
                                      ...prev[socio.id],
                                      cidade_endereco: e.target.value,
                                    },
                                  }))
                                }
                                className="h-8 text-xs"
                                placeholder="Curitiba"
                              />
                            ) : (
                              <div
                                className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-slate-800"
                                data-rpa-field={`socio_${socio.id}_endereco_cidade`}
                                data-rpa-value={sForm.cidade_endereco || '—'}
                              >
                                {displayVal(sForm.cidade_endereco)}
                              </div>
                            )}
                          </div>

                          <div>
                            <label className="text-[11px] font-semibold text-slate-600 mb-1 block">
                              Estado (UF):
                            </label>
                            {modoEdicao ? (
                              <Input
                                value={sForm.uf_endereco || ''}
                                onChange={(e) =>
                                  setFormDataSocios((prev) => ({
                                    ...prev,
                                    [socio.id]: {
                                      ...prev[socio.id],
                                      uf_endereco: e.target.value.toUpperCase(),
                                    },
                                  }))
                                }
                                className="h-8 text-xs uppercase"
                                placeholder="PR"
                              />
                            ) : (
                              <div
                                className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-slate-800"
                                data-rpa-field={`socio_${socio.id}_endereco_uf`}
                                data-rpa-value={sForm.uf_endereco || '—'}
                              >
                                {displayVal(sForm.uf_endereco)}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Série GV/SCR, Série GVR/SCR */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="text-[11px] font-semibold text-slate-600 mb-1 block">
                              Série GV/SCR:
                            </label>
                            {modoEdicao ? (
                              <Input
                                value={sForm.serie_gv_scr || ''}
                                onChange={(e) =>
                                  setFormDataSocios((prev) => ({
                                    ...prev,
                                    [socio.id]: {
                                      ...prev[socio.id],
                                      serie_gv_scr: e.target.value,
                                    },
                                  }))
                                }
                                className="h-8 text-xs font-mono"
                                placeholder="Não informado"
                              />
                            ) : (
                              <div
                                className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 font-mono text-slate-800"
                                data-rpa-field={`socio_${socio.id}_serie_gv_scr`}
                                data-rpa-value={sForm.serie_gv_scr || '—'}
                              >
                                {displayVal(sForm.serie_gv_scr)}
                              </div>
                            )}
                          </div>

                          <div>
                            <label className="text-[11px] font-semibold text-slate-600 mb-1 block">
                              Série GVR/SCR:
                            </label>
                            {modoEdicao ? (
                              <Input
                                value={sForm.serie_gvr_scr || ''}
                                onChange={(e) =>
                                  setFormDataSocios((prev) => ({
                                    ...prev,
                                    [socio.id]: {
                                      ...prev[socio.id],
                                      serie_gvr_scr: e.target.value,
                                    },
                                  }))
                                }
                                className="h-8 text-xs font-mono"
                                placeholder="Não informado"
                              />
                            ) : (
                              <div
                                className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 font-mono text-slate-800"
                                data-rpa-field={`socio_${socio.id}_serie_gvr_scr`}
                                data-rpa-value={sForm.serie_gvr_scr || '—'}
                              >
                                {displayVal(sForm.serie_gvr_scr)}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Senha GOV.BR */}
                        <div className="max-w-md">
                          <label className="text-[11px] font-semibold text-slate-600 mb-1 block">
                            Senha GOV.BR:
                          </label>
                          {modoEdicao ? (
                            <Input
                              type="password"
                              value={sForm.senha_govbr || ''}
                              onChange={(e) =>
                                setFormDataSocios((prev) => ({
                                  ...prev,
                                  [socio.id]: {
                                    ...prev[socio.id],
                                    senha_govbr: e.target.value,
                                  },
                                }))
                              }
                              className="h-8 text-xs"
                              placeholder="Não informado"
                            />
                          ) : (
                            <div
                              className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 font-mono text-slate-800"
                              data-rpa-field={`socio_${socio.id}_senha_govbr`}
                              data-rpa-value={sForm.senha_govbr ? '••••••••' : '—'}
                            >
                              {sForm.senha_govbr ? '••••••••' : '—'}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Sub-bloco DOCUMENTOS DO SÓCIO */}
                      <div className="pt-4 border-t border-slate-200 space-y-3">
                        <div className="flex items-center justify-between">
                          <h5 className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                            <FileText className="h-3.5 w-3.5 text-[#0FA3A3]" />
                            <span>Documentos</span>
                          </h5>
                          {canEdit && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleUploadDocSocio(socio.id)}
                              className="h-7 text-xs gap-1 border-teal-300 text-teal-700 hover:bg-teal-50"
                            >
                              <Upload className="h-3 w-3" />
                              <span>Upload Documento</span>
                            </Button>
                          )}
                        </div>

                        {/* Tabela de Documentos do Sócio */}
                        <div className="rounded-xl border border-slate-200 overflow-hidden bg-slate-50/50">
                          <table className="w-full text-left text-xs">
                            <thead className="bg-slate-100 text-slate-700 font-bold text-[11px] border-b border-slate-200">
                              <tr>
                                <th className="py-2 px-3">Documento</th>
                                <th className="py-2 px-3 text-right">Ação</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-[11px]">
                              {(!sForm.documentos_socios_json ||
                                sForm.documentos_socios_json.length === 0) && (
                                <tr>
                                  <td colSpan={2} className="py-3 px-3 text-slate-400 italic">
                                    Nenhum documento anexado para este sócio.
                                  </td>
                                </tr>
                              )}
                              {sForm.documentos_socios_json?.map((doc, idx) => (
                                <tr key={doc.id || idx} className="hover:bg-slate-50">
                                  <td className="py-2 px-3 font-medium text-slate-800 flex items-center gap-2">
                                    <FileCheck className="h-3.5 w-3.5 text-[#0FA3A3]" />
                                    <span>{doc.nome}</span>
                                  </td>
                                  <td className="py-2 px-3 text-right">
                                    {canEdit && modoEdicao && (
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => handleRemoverDocSocio(socio.id, doc.id)}
                                        className="h-6 w-6 p-0 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-md"
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </Button>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })
          )}
        </CardContent>
      </Card>

      {/* ========================================================================================= */}
      {/* BLOCO 3 — PARAMETRIZAÇÃO */}
      {/* ========================================================================================= */}
      <Card className="rounded-2xl border-slate-200 shadow-xs bg-white overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-slate-50 to-white border-b border-slate-100 py-3 px-5">
          <CardTitle className="text-sm font-bold text-[#1A2333] flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Sliders className="h-4 w-4 text-[#0FA3A3]" />
              <span>Parametrização</span>
            </span>
            <span className="text-[11px] font-normal text-slate-400 font-mono">
              Bloco 3 • Telemetria Ativa
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-5 space-y-4 text-xs">
          {/* Regime Tributário, Segmento */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-semibold text-slate-600 mb-1 block">
                Regime Tributário:
              </label>
              {modoEdicao ? (
                <Input
                  value={formDataEmpresa.regime_tributario || ''}
                  onChange={(e) =>
                    setFormDataEmpresa({
                      ...formDataEmpresa,
                      regime_tributario: e.target.value as any,
                    })
                  }
                  className="h-8 text-xs font-semibold capitalize"
                  placeholder="Ex.: simples_nacional"
                />
              ) : (
                <div
                  className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 font-semibold text-slate-900 capitalize"
                  data-rpa-field="regime_tributario"
                  data-rpa-value={formDataEmpresa.regime_tributario || '—'}
                >
                  {displayVal(formDataEmpresa.regime_tributario?.replace('_', ' '))}
                </div>
              )}
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-600 mb-1 block">
                Segmento:
              </label>
              {modoEdicao ? (
                <Input
                  value={formDataEmpresa.segmento || ''}
                  onChange={(e) =>
                    setFormDataEmpresa({ ...formDataEmpresa, segmento: e.target.value })
                  }
                  className="h-8 text-xs"
                  placeholder="Serviços"
                />
              ) : (
                <div
                  className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-slate-800"
                  data-rpa-field="segmento"
                  data-rpa-value={formDataEmpresa.segmento || '—'}
                >
                  {displayVal(formDataEmpresa.segmento)}
                </div>
              )}
            </div>
          </div>

          {/* Subsegmento */}
          <div>
            <label className="text-[11px] font-semibold text-slate-600 mb-1 block">
              Subsegmento:
            </label>
            {modoEdicao ? (
              <Input
                value={formDataEmpresa.subsegmento || ''}
                onChange={(e) =>
                  setFormDataEmpresa({ ...formDataEmpresa, subsegmento: e.target.value })
                }
                className="h-8 text-xs"
                placeholder="Não informado"
              />
            ) : (
              <div
                className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-slate-800"
                data-rpa-field="subsegmento"
                data-rpa-value={formDataEmpresa.subsegmento || '—'}
              >
                {displayVal(formDataEmpresa.subsegmento)}
              </div>
            )}
          </div>

          {/* Natureza Jurídica, Capital Social */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-semibold text-slate-600 mb-1 block">
                Natureza Jurídica:
              </label>
              {modoEdicao ? (
                <Input
                  value={formDataEmpresa.natureza_juridica || ''}
                  onChange={(e) =>
                    setFormDataEmpresa({ ...formDataEmpresa, natureza_juridica: e.target.value })
                  }
                  className="h-8 text-xs font-semibold"
                  placeholder="Sociedade Empresária Limitada"
                />
              ) : (
                <div
                  className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 font-semibold text-slate-900"
                  data-rpa-field="natureza_juridica"
                  data-rpa-value={formDataEmpresa.natureza_juridica || '—'}
                >
                  {displayVal(formDataEmpresa.natureza_juridica)}
                </div>
              )}
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-600 mb-1 block">
                Capital Social:
              </label>
              {modoEdicao ? (
                <Input
                  type="number"
                  step="0.01"
                  value={formDataEmpresa.capital_social ?? ''}
                  onChange={(e) =>
                    setFormDataEmpresa({
                      ...formDataEmpresa,
                      capital_social: e.target.value ? Number(e.target.value) : undefined,
                    })
                  }
                  className="h-8 text-xs font-mono font-semibold"
                  placeholder="1000.00"
                />
              ) : (
                <div
                  className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 font-mono font-semibold text-slate-900"
                  data-rpa-field="capital_social"
                  data-rpa-value={
                    formDataEmpresa.capital_social !== undefined &&
                    formDataEmpresa.capital_social !== null
                      ? `R$ ${formDataEmpresa.capital_social.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                      : '—'
                  }
                >
                  {formDataEmpresa.capital_social !== undefined &&
                  formDataEmpresa.capital_social !== null
                    ? `R$ ${formDataEmpresa.capital_social.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                    : '—'}
                </div>
              )}
            </div>
          </div>

          {/* CNAE Principal */}
          <div>
            <label className="text-[11px] font-semibold text-slate-600 mb-1 block">CNAE:</label>
            {modoEdicao ? (
              <Input
                value={formDataEmpresa.cnae_principal || ''}
                onChange={(e) =>
                  setFormDataEmpresa({ ...formDataEmpresa, cnae_principal: e.target.value })
                }
                className="h-8 text-xs"
                placeholder="Atividades de contabilidade"
              />
            ) : (
              <div
                className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-slate-800"
                data-rpa-field="cnae"
                data-rpa-value={formDataEmpresa.cnae_principal || '—'}
              >
                {displayVal(formDataEmpresa.cnae_principal)}
              </div>
            )}
          </div>

          {/* CNAEs Secundários */}
          <div>
            <label className="text-[11px] font-semibold text-slate-600 mb-1 block">
              CNAEs Secundários:
            </label>
            {modoEdicao ? (
              <Textarea
                rows={2}
                value={formDataEmpresa.cnaes_secundarios || ''}
                onChange={(e) =>
                  setFormDataEmpresa({ ...formDataEmpresa, cnaes_secundarios: e.target.value })
                }
                className="text-xs resize-y"
                placeholder="Não informado"
              />
            ) : (
              <div
                className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-800 min-h-[48px] whitespace-pre-line"
                data-rpa-field="cnaes_secundarios"
                data-rpa-value={formDataEmpresa.cnaes_secundarios || '—'}
              >
                {displayVal(formDataEmpresa.cnaes_secundarios)}
              </div>
            )}
          </div>

          {/* Fator R, Alteração Automática do Pró-Labore, Anexo */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
            <div>
              <label className="text-[11px] font-semibold text-slate-600 mb-1 block">
                Fator R:
              </label>
              {modoEdicao ? (
                <div className="flex items-center gap-2 h-8">
                  <Checkbox
                    id="fator_r_optante"
                    checked={Boolean(formDataEmpresa.fator_r_optante)}
                    onCheckedChange={(checked) =>
                      setFormDataEmpresa({
                        ...formDataEmpresa,
                        fator_r_optante: Boolean(checked),
                      })
                    }
                  />
                  <label htmlFor="fator_r_optante" className="text-xs font-medium cursor-pointer">
                    Optante Fator R
                  </label>
                </div>
              ) : (
                <div
                  className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 font-semibold text-slate-800"
                  data-rpa-field="fator_r"
                  data-rpa-value={formDataEmpresa.fator_r_optante ? 'Sim' : 'Não'}
                >
                  {formDataEmpresa.fator_r_optante ? 'Sim' : 'Não'}
                </div>
              )}
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-600 mb-1 block">
                Alteração automática do Pró-Labore:
              </label>
              {modoEdicao ? (
                <div className="flex items-center gap-2 h-8">
                  <Checkbox
                    id="fator_r_alteracao"
                    checked={Boolean(formDataEmpresa.fator_r_alteracao_automatica_prolabore)}
                    onCheckedChange={(checked) =>
                      setFormDataEmpresa({
                        ...formDataEmpresa,
                        fator_r_alteracao_automatica_prolabore: Boolean(checked),
                      })
                    }
                  />
                  <label htmlFor="fator_r_alteracao" className="text-xs font-medium cursor-pointer">
                    Atender automaticamente
                  </label>
                </div>
              ) : (
                <div
                  className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 font-semibold text-slate-800"
                  data-rpa-field="alteracao_automatica_prolabore"
                  data-rpa-value={
                    formDataEmpresa.fator_r_alteracao_automatica_prolabore ? 'Sim' : 'Não'
                  }
                >
                  {formDataEmpresa.fator_r_alteracao_automatica_prolabore ? 'Sim' : 'Não'}
                </div>
              )}
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-600 mb-1 block">Anexo:</label>
              {modoEdicao ? (
                <Input
                  value={formDataEmpresa.anexo_simples || ''}
                  onChange={(e) =>
                    setFormDataEmpresa({ ...formDataEmpresa, anexo_simples: e.target.value })
                  }
                  className="h-8 text-xs font-mono"
                  placeholder="III"
                />
              ) : (
                <div
                  className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 font-mono font-bold text-slate-900"
                  data-rpa-field="anexo"
                  data-rpa-value={formDataEmpresa.anexo_simples || '—'}
                >
                  {displayVal(formDataEmpresa.anexo_simples)}
                </div>
              )}
            </div>
          </div>

          {/* Tipo de Nota */}
          <div>
            <label className="text-[11px] font-semibold text-slate-600 mb-1 block">
              Tipo de Nota:
            </label>
            {modoEdicao ? (
              <Input
                value={formDataEmpresa.tipo_de_nota || ''}
                onChange={(e) =>
                  setFormDataEmpresa({ ...formDataEmpresa, tipo_de_nota: e.target.value })
                }
                className="h-8 text-xs font-mono"
                placeholder="NF-e, NFS-e, CT-e"
              />
            ) : (
              <div
                className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 font-mono text-slate-800"
                data-rpa-field="tipo_de_nota"
                data-rpa-value={formDataEmpresa.tipo_de_nota || '—'}
              >
                {displayVal(formDataEmpresa.tipo_de_nota)}
              </div>
            )}
          </div>

          {/* Serviços: Grid com colunas Espécie, Modelo, Série */}
          <div className="pt-2 space-y-2">
            <label className="text-[11px] font-semibold text-slate-600 block">Serviços:</label>
            <div className="rounded-xl border border-slate-200 overflow-hidden bg-slate-50/50">
              <table className="w-full text-center text-xs">
                <thead className="bg-slate-100 text-slate-700 font-bold text-[11px] border-b border-slate-200">
                  <tr>
                    <th className="py-2 px-3">Espécie</th>
                    <th className="py-2 px-3">Modelo</th>
                    <th className="py-2 px-3">Série</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-[11px]">
                  {servicosLista.map((srv, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 font-medium text-slate-800">
                      <td className="py-2 px-3 font-semibold text-[#0FA3A3]">{srv.especie}</td>
                      <td className="py-2 px-3 font-mono text-slate-600">{srv.modelo}</td>
                      <td className="py-2 px-3 font-mono text-slate-600">{srv.serie}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
