import React, { useState, useEffect } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import {
  ArrowLeft,
  Building2,
  MapPin,
  Phone,
  FileText,
  Save,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { empresasService } from '@/services/empresas'
import { certificadosService } from '@/services/certificados'
import {
  EmpresaCertificadoSection,
  type CertificadoFormState,
} from '@/components/EmpresaCertificadoSection'
import { maskCnpj, maskCep, maskPhone, isValidCnpj } from '@/lib/formatters'
import type { Empresa, EmpresaRegime, EmpresaPorte, EmpresaStatus } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'

const BRAZIL_UFS = [
  'AC',
  'AL',
  'AP',
  'AM',
  'BA',
  'CE',
  'DF',
  'ES',
  'GO',
  'MA',
  'MT',
  'MS',
  'MG',
  'PA',
  'PB',
  'PR',
  'PE',
  'PI',
  'RJ',
  'RN',
  'RS',
  'RO',
  'RR',
  'SC',
  'SP',
  'SE',
  'TO',
]

export default function EmpresaForm() {
  const { id } = useParams<{ id: string }>()
  const isEditing = Boolean(id)
  const { tenant, member } = useAuth()
  const navigate = useNavigate()
  const { toast } = useToast()

  const canEditCertificado = member?.perfil === 'administrador' || member?.perfil === 'contador'

  const [loading, setLoading] = useState(isEditing)
  const [saving, setSaving] = useState(false)
  const [lookingUpCep, setLookingUpCep] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Certificado digital state
  const [certData, setCertData] = useState<CertificadoFormState>({
    tipo: 'a1',
    titular: '',
    numero_serie: '',
    emissor: '',
    validade: '',
    senha: '',
    status: 'ativo',
    observacoes: '',
    arquivoFile: null,
    arquivoNomeAtual: '',
  })

  // Form state
  const [formData, setFormData] = useState<Partial<Empresa>>({
    razao_social: '',
    nome_fantasia: '',
    cnpj: '',
    inscricao_estadual: '',
    inscricao_municipal: '',
    regime_tributario: 'simples_nacional',
    porte: 'me',
    data_abertura: '',
    cep: '',
    logradouro: '',
    numero: '',
    complemento: '',
    bairro: '',
    cidade: '',
    uf: 'SP',
    pais: 'Brasil',
    email: '',
    telefone: '',
    site: '',
    observacoes: '',
    status: 'ativo',
  })

  // Load existing data if editing
  useEffect(() => {
    if (!id) return
    const fetchEmpresa = async () => {
      try {
        const data = await empresasService.getById(id)
        setFormData({
          razao_social: data.razao_social || '',
          nome_fantasia: data.nome_fantasia || '',
          cnpj: maskCnpj(data.cnpj || ''),
          inscricao_estadual: data.inscricao_estadual || '',
          inscricao_municipal: data.inscricao_municipal || '',
          regime_tributario: data.regime_tributario || 'simples_nacional',
          porte: data.porte || 'me',
          data_abertura: data.data_abertura ? data.data_abertura.split('T')[0] : '',
          cep: maskCep(data.cep || ''),
          logradouro: data.logradouro || '',
          numero: data.numero || '',
          complemento: data.complemento || '',
          bairro: data.bairro || '',
          cidade: data.cidade || '',
          uf: data.uf || 'SP',
          pais: data.pais || 'Brasil',
          email: data.email || '',
          telefone: maskPhone(data.telefone || ''),
          site: data.site || '',
          observacoes: data.observacoes || '',
          status: data.status || 'ativo',
        })

        // Buscar certificado existente da empresa
        try {
          const cert = await certificadosService.getByEmpresa(id)
          if (cert) {
            setCertData({
              id: cert.id,
              tipo: cert.tipo || 'a1',
              titular: cert.titular || '',
              numero_serie: cert.numero_serie || '',
              emissor: cert.emissor || '',
              validade: cert.validade ? cert.validade.split('T')[0] : '',
              senha: cert.senha || '',
              status: cert.status || 'ativo',
              observacoes: cert.observacoes || '',
              arquivoFile: null,
              arquivoNomeAtual: cert.arquivo_pfx || '',
            })
          }
        } catch (certErr) {
          console.error('Erro ao buscar certificado da empresa:', certErr)
        }
      } catch (err) {
        toast({
          variant: 'destructive',
          title: 'Erro ao carregar empresa',
          description: 'Não foi possível buscar as informações.',
        })
        navigate('/empresas')
      } finally {
        setLoading(false)
      }
    }
    fetchEmpresa()
  }, [id, navigate, toast])

  // ViaCEP auto-lookup
  const handleCepChange = async (cepInput: string) => {
    const masked = maskCep(cepInput)
    setFormData((prev) => ({ ...prev, cep: masked }))

    const raw = masked.replace(/\D/g, '')
    if (raw.length === 8) {
      setLookingUpCep(true)
      try {
        const res = await fetch(`https://viacep.com.br/ws/${raw}/json/`)
        const data = await res.json()
        if (!data.erro) {
          setFormData((prev) => ({
            ...prev,
            logradouro: data.logradouro || prev.logradouro,
            bairro: data.bairro || prev.bairro,
            cidade: data.localidade || prev.cidade,
            uf: data.uf || prev.uf,
          }))
          toast({
            title: 'Endereço localizado!',
            description: `${data.logradouro}, ${data.bairro} - ${data.localidade}/${data.uf}`,
          })
        }
      } catch (err) {
        console.error('ViaCEP lookup failed:', err)
      } finally {
        setLookingUpCep(false)
      }
    }
  }

  const validate = () => {
    const errs: Record<string, string> = {}
    if (!formData.razao_social?.trim()) {
      errs.razao_social = 'Razão Social é obrigatória.'
    }
    if (!formData.cnpj?.trim()) {
      errs.cnpj = 'CNPJ é obrigatório.'
    } else if (!isValidCnpj(formData.cnpj)) {
      errs.cnpj = 'CNPJ inválido (dígitos verificadores incorretos).'
    }
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) {
      toast({
        variant: 'destructive',
        title: 'Verifique o formulário',
        description: 'Existem campos com preenchimento incorreto.',
      })
      return
    }

    if (!tenant?.id) {
      toast({
        variant: 'destructive',
        title: 'Escritório não selecionado',
        description: 'Faça login novamente para vincular ao tenant.',
      })
      return
    }

    setSaving(true)
    try {
      const payload: Partial<Empresa> = {
        ...formData,
        tenant_id: tenant.id,
        cnpj: formData.cnpj?.replace(/\D/g, '') || '',
        data_abertura: formData.data_abertura ? `${formData.data_abertura} 00:00:00` : undefined,
      }

      let empresaIdSalva = id
      if (isEditing && id) {
        await empresasService.update(id, payload)
      } else {
        const created = await empresasService.create(payload)
        empresaIdSalva = created.id
      }

      // Persistir dados do Certificado Digital se preenchidos
      if (empresaIdSalva && certData.validade && certData.emissor && canEditCertificado) {
        try {
          const certFormData = new FormData()
          certFormData.append('tenant_id', tenant.id)
          certFormData.append('empresa', empresaIdSalva)
          certFormData.append('tipo', certData.tipo)
          certFormData.append(
            'titular',
            certData.titular ||
              `${formData.razao_social?.toUpperCase()}:${formData.cnpj?.replace(/\D/g, '')}`,
          )
          if (certData.numero_serie) certFormData.append('numero_serie', certData.numero_serie)
          certFormData.append('emissor', certData.emissor)
          certFormData.append('validade', new Date(`${certData.validade}T12:00:00Z`).toISOString())
          if (certData.senha) certFormData.append('senha', certData.senha)
          certFormData.append('status', certData.status)
          if (certData.observacoes) certFormData.append('observacoes', certData.observacoes)
          if (certData.arquivoFile) {
            certFormData.append('arquivo_pfx', certData.arquivoFile)
          }

          await certificadosService.save(certData.id || null, certFormData)
        } catch (certSaveErr) {
          console.error('Erro ao salvar certificado digital:', certSaveErr)
          toast({
            variant: 'destructive',
            title: 'Aviso sobre o Certificado',
            description:
              'A empresa foi salva, mas ocorreu uma falha ao gravar o certificado digital.',
          })
        }
      }

      toast({
        title: isEditing ? 'Empresa atualizada!' : 'Empresa cadastrada!',
        description: 'Os dados cadastrais e certificado foram gravados com sucesso.',
      })
      navigate(`/empresas/${empresaIdSalva}`)
    } catch (err: unknown) {
      console.error('Error saving empresa:', err)
      const msg = err instanceof Error ? err.message : 'Erro ao persistir cadastro.'
      toast({
        variant: 'destructive',
        title: 'Falha ao salvar empresa',
        description: msg,
      })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#0FA3A3]" />
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-5xl mx-auto">
      {/* Top Breadcrumb Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="icon"
            onClick={() => navigate('/empresas')}
            className="h-9 w-9 rounded-xl border-[#E2E8F0]"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h2 className="text-xl font-bold tracking-tight text-[#1A2333]">
              {isEditing ? 'Editar Empresa' : 'Nova Empresa'}
            </h2>
            <p className="text-xs text-[#64748B]">
              Preencha os dados cadastrais, endereço e parâmetros tributários
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate('/empresas')}
            className="text-xs h-9 rounded-xl"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={saving}
            className="gap-2 rounded-xl bg-[#0FA3A3] hover:bg-[#0C8585] text-white font-semibold text-xs h-9 shadow-xs"
          >
            {saving ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Salvando...</span>
              </>
            ) : (
              <>
                <Save className="h-3.5 w-3.5" />
                <span>Salvar Empresa</span>
              </>
            )}
          </Button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Section 1: Dados Cadastrais */}
        <Card className="rounded-2xl border-[#E2E8F0] shadow-xs">
          <CardHeader className="pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-[#0FA3A3]" />
              <CardTitle className="text-sm font-bold text-[#1A2333]">
                1. Dados Cadastrais & Tributação
              </CardTitle>
            </div>
            <CardDescription className="text-xs text-[#64748B]">
              Identificação formal da pessoa jurídica e enquadramento fiscal
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="razao_social" className="text-xs font-semibold text-[#1A2333]">
                Razão Social *
              </Label>
              <Input
                id="razao_social"
                required
                value={formData.razao_social}
                onChange={(e) => setFormData({ ...formData, razao_social: e.target.value })}
                placeholder="Ex: Rumo Soluções Contábeis e Financeiras Ltda"
                className="h-10 text-xs rounded-xl border-[#E2E8F0]"
              />
              {errors.razao_social && (
                <p className="text-[11px] text-[#EF4444]">{errors.razao_social}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="nome_fantasia" className="text-xs font-semibold text-[#1A2333]">
                Nome Fantasia
              </Label>
              <Input
                id="nome_fantasia"
                value={formData.nome_fantasia}
                onChange={(e) => setFormData({ ...formData, nome_fantasia: e.target.value })}
                placeholder="Ex: Rumo Contabilidade"
                className="h-10 text-xs rounded-xl border-[#E2E8F0]"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cnpj" className="text-xs font-semibold text-[#1A2333]">
                CNPJ (com validação) *
              </Label>
              <Input
                id="cnpj"
                required
                value={formData.cnpj}
                onChange={(e) => setFormData({ ...formData, cnpj: maskCnpj(e.target.value) })}
                placeholder="00.000.000/0001-00"
                className="h-10 text-xs font-mono rounded-xl border-[#E2E8F0]"
              />
              {errors.cnpj && <p className="text-[11px] text-[#EF4444]">{errors.cnpj}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ie" className="text-xs font-semibold text-[#1A2333]">
                Inscrição Estadual (IE)
              </Label>
              <Input
                id="ie"
                value={formData.inscricao_estadual}
                onChange={(e) => setFormData({ ...formData, inscricao_estadual: e.target.value })}
                placeholder="Ex: 123.456.789.001 ou Isento"
                className="h-10 text-xs rounded-xl border-[#E2E8F0]"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="im" className="text-xs font-semibold text-[#1A2333]">
                Inscrição Municipal (IM)
              </Label>
              <Input
                id="im"
                value={formData.inscricao_municipal}
                onChange={(e) => setFormData({ ...formData, inscricao_municipal: e.target.value })}
                placeholder="Ex: 987654-1"
                className="h-10 text-xs rounded-xl border-[#E2E8F0]"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-[#1A2333]">Regime Tributário</Label>
              <Select
                value={formData.regime_tributario}
                onValueChange={(val: EmpresaRegime) =>
                  setFormData({ ...formData, regime_tributario: val })
                }
              >
                <SelectTrigger className="h-10 text-xs rounded-xl border-[#E2E8F0]">
                  <SelectValue placeholder="Selecione o regime" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="simples_nacional">Simples Nacional</SelectItem>
                  <SelectItem value="lucro_presumido">Lucro Presumido</SelectItem>
                  <SelectItem value="lucro_real">Lucro Real</SelectItem>
                  <SelectItem value="mei">MEI (Microempreendedor Individual)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-[#1A2333]">Porte da Empresa</Label>
              <Select
                value={formData.porte}
                onValueChange={(val: EmpresaPorte) => setFormData({ ...formData, porte: val })}
              >
                <SelectTrigger className="h-10 text-xs rounded-xl border-[#E2E8F0]">
                  <SelectValue placeholder="Selecione o porte" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mei">MEI</SelectItem>
                  <SelectItem value="me">ME (Microempresa)</SelectItem>
                  <SelectItem value="epp">EPP (Empresa de Pequeno Porte)</SelectItem>
                  <SelectItem value="demais">Demais portes</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="data_abertura" className="text-xs font-semibold text-[#1A2333]">
                Data de Abertura
              </Label>
              <Input
                id="data_abertura"
                type="date"
                value={formData.data_abertura}
                onChange={(e) => setFormData({ ...formData, data_abertura: e.target.value })}
                className="h-10 text-xs rounded-xl border-[#E2E8F0]"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-[#1A2333]">Status Cadastral</Label>
              <Select
                value={formData.status}
                onValueChange={(val: EmpresaStatus) => setFormData({ ...formData, status: val })}
              >
                <SelectTrigger className="h-10 text-xs rounded-xl border-[#E2E8F0]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ativo">Ativo</SelectItem>
                  <SelectItem value="inativo">Inativo</SelectItem>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="encerrado">Encerrado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Section 2: Endereço (Auto ViaCEP) */}
        <Card className="rounded-2xl border-[#E2E8F0] shadow-xs">
          <CardHeader className="pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-[#0FA3A3]" />
              <CardTitle className="text-sm font-bold text-[#1A2333]">
                2. Endereço & Localização
              </CardTitle>
            </div>
            <CardDescription className="text-xs text-[#64748B]">
              Informe o CEP para preenchimento automático via webservice ViaCEP
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-1.5 sm:col-span-1">
              <div className="flex items-center justify-between">
                <Label htmlFor="cep" className="text-xs font-semibold text-[#1A2333]">
                  CEP (ViaCEP)
                </Label>
                {lookingUpCep && (
                  <span className="flex items-center gap-1 text-[10px] text-[#0FA3A3]">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Buscando...
                  </span>
                )}
              </div>
              <Input
                id="cep"
                value={formData.cep}
                onChange={(e) => handleCepChange(e.target.value)}
                placeholder="00000-000"
                className="h-10 text-xs font-mono rounded-xl border-[#E2E8F0]"
              />
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="logradouro" className="text-xs font-semibold text-[#1A2333]">
                Logradouro
              </Label>
              <Input
                id="logradouro"
                value={formData.logradouro}
                onChange={(e) => setFormData({ ...formData, logradouro: e.target.value })}
                placeholder="Avenida, Rua, Travessa..."
                className="h-10 text-xs rounded-xl border-[#E2E8F0]"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="numero" className="text-xs font-semibold text-[#1A2333]">
                Número
              </Label>
              <Input
                id="numero"
                value={formData.numero}
                onChange={(e) => setFormData({ ...formData, numero: e.target.value })}
                placeholder="123 ou S/N"
                className="h-10 text-xs rounded-xl border-[#E2E8F0]"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="complemento" className="text-xs font-semibold text-[#1A2333]">
                Complemento
              </Label>
              <Input
                id="complemento"
                value={formData.complemento}
                onChange={(e) => setFormData({ ...formData, complemento: e.target.value })}
                placeholder="Sala 101, Galpão A..."
                className="h-10 text-xs rounded-xl border-[#E2E8F0]"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="bairro" className="text-xs font-semibold text-[#1A2333]">
                Bairro
              </Label>
              <Input
                id="bairro"
                value={formData.bairro}
                onChange={(e) => setFormData({ ...formData, bairro: e.target.value })}
                placeholder="Bairro"
                className="h-10 text-xs rounded-xl border-[#E2E8F0]"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cidade" className="text-xs font-semibold text-[#1A2333]">
                Cidade
              </Label>
              <Input
                id="cidade"
                value={formData.cidade}
                onChange={(e) => setFormData({ ...formData, cidade: e.target.value })}
                placeholder="Cidade"
                className="h-10 text-xs rounded-xl border-[#E2E8F0]"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-[#1A2333]">UF (Estado)</Label>
              <Select
                value={formData.uf}
                onValueChange={(val) => setFormData({ ...formData, uf: val })}
              >
                <SelectTrigger className="h-10 text-xs rounded-xl border-[#E2E8F0]">
                  <SelectValue placeholder="UF" />
                </SelectTrigger>
                <SelectContent className="max-h-56">
                  {BRAZIL_UFS.map((uf) => (
                    <SelectItem key={uf} value={uf}>
                      {uf}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="pais" className="text-xs font-semibold text-[#1A2333]">
                País
              </Label>
              <Input
                id="pais"
                value={formData.pais}
                onChange={(e) => setFormData({ ...formData, pais: e.target.value })}
                placeholder="Brasil"
                className="h-10 text-xs rounded-xl border-[#E2E8F0]"
              />
            </div>
          </CardContent>
        </Card>

        {/* Section 3: Contatos & Observações */}
        <Card className="rounded-2xl border-[#E2E8F0] shadow-xs">
          <CardHeader className="pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-[#0FA3A3]" />
              <CardTitle className="text-sm font-bold text-[#1A2333]">
                3. Contatos & Observações
              </CardTitle>
            </div>
            <CardDescription className="text-xs text-[#64748B]">
              Canais de comunicação direta e notas operacionais do cliente
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="email_contato" className="text-xs font-semibold text-[#1A2333]">
                E-mail Corporativo
              </Label>
              <Input
                id="email_contato"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="contato@empresa.com.br"
                className="h-10 text-xs rounded-xl border-[#E2E8F0]"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="telefone" className="text-xs font-semibold text-[#1A2333]">
                Telefone / WhatsApp
              </Label>
              <Input
                id="telefone"
                value={formData.telefone}
                onChange={(e) => setFormData({ ...formData, telefone: maskPhone(e.target.value) })}
                placeholder="(11) 98765-4321"
                className="h-10 text-xs rounded-xl border-[#E2E8F0]"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="site" className="text-xs font-semibold text-[#1A2333]">
                Site Oficial
              </Label>
              <Input
                id="site"
                type="url"
                value={formData.site}
                onChange={(e) => setFormData({ ...formData, site: e.target.value })}
                placeholder="https://suaempresa.com.br"
                className="h-10 text-xs rounded-xl border-[#E2E8F0]"
              />
            </div>

            <div className="space-y-1.5 sm:col-span-3">
              <Label htmlFor="observacoes" className="text-xs font-semibold text-[#1A2333]">
                Observações Operacionais
              </Label>
              <Textarea
                id="observacoes"
                rows={3}
                value={formData.observacoes}
                onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                placeholder="Particularidades fiscais, regime de envio de notas, sócios responsáveis..."
                className="text-xs rounded-xl border-[#E2E8F0]"
              />
            </div>
          </CardContent>
        </Card>

        {/* Section 4: Certificado Digital (A1 / A3) */}
        <EmpresaCertificadoSection
          empresaId={id}
          razaoSocial={formData.razao_social}
          cnpj={formData.cnpj}
          canEdit={canEditCertificado}
          formState={certData}
          onChange={setCertData}
          onDeleteCertificado={
            certData.id
              ? async () => {
                  await certificadosService.delete(certData.id!)
                  setCertData({
                    tipo: 'a1',
                    titular: '',
                    numero_serie: '',
                    emissor: '',
                    validade: '',
                    senha: '',
                    status: 'ativo',
                    observacoes: '',
                    arquivoFile: null,
                    arquivoNomeAtual: '',
                  })
                }
              : undefined
          }
        />

        {/* Submit Actions Bottom */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate('/empresas')}
            className="text-xs h-10 px-5 rounded-xl"
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            disabled={saving}
            className="gap-2 rounded-xl bg-[#0FA3A3] hover:bg-[#0C8585] text-white font-semibold text-xs h-10 px-6 shadow-xs"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Persistindo...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4" />
                <span>Salvar Cadastro da Empresa</span>
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  )
}
