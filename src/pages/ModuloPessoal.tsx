/**
 * Módulo Pessoal — Modelo Makro (Fatia 5).
 * Layout de 3 zonas: cabeçalho (Empresa + Competência), sidebar interna de
 * fases (Preparar, Movimentações, Obrigações, Relatórios) e conteúdo central.
 * Deep-link suportado: /modulo-pessoal?fase=movimentacoes
 */

import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CalendarCheck, ClipboardList, FileText, Loader2, Users } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { cn } from '@/lib/utils'
import { competenciaAtual } from '@/services/pessoalMakro'
import { FasePreparar } from '@/components/pessoal/FasePreparar'
import { FaseMovimentacoes } from '@/components/pessoal/FaseMovimentacoes'
import { FaseObrigacoes } from '@/components/pessoal/FaseObrigacoes'
import { FaseRelatorios } from '@/components/pessoal/FaseRelatorios'

const FASES = [
  { id: 'preparar', label: '1. Preparar', icon: Users },
  { id: 'movimentacoes', label: '2. Movimentações', icon: CalendarCheck },
  { id: 'obrigacoes', label: '3. Obrigações', icon: ClipboardList },
  { id: 'relatorios', label: '4. Relatórios', icon: FileText },
] as const

type FaseId = (typeof FASES)[number]['id']

function ehFase(v: string | null): v is FaseId {
  return FASES.some((f) => f.id === v)
}

/** "MM/YYYY" (formato dos serviços de Pessoal) -> "AAAA-MM" (input month) */
function competenciaParaInput(comp: string): string {
  const [mes, ano] = comp.split('/')
  return mes && ano ? `${ano}-${mes}` : comp
}

/** "AAAA-MM" -> "MM/YYYY" */
function competenciaDaInput(valor: string): string {
  const [ano, mes] = valor.split('-')
  return mes && ano ? `${mes}/${ano}` : valor
}

export default function ModuloPessoal() {
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const faseParam = searchParams.get('fase')
  const [fase, setFase] = useState<FaseId>(ehFase(faseParam) ? faseParam : 'preparar')

  const [empresaId, setEmpresaId] = useState('')
  const [empresaNome, setEmpresaNome] = useState('')
  const [competencia, setCompetencia] = useState(competenciaAtual())
  const [carregandoEmpresas, setCarregandoEmpresas] = useState(true)
  const [empresas, setEmpresas] = useState<Array<{ id: string; nome: string }>>([])

  const tenantId = user?.id
  const [versao, setVersao] = useState(0)
  const carregarFaseAtual = () => setVersao((v) => v + 1)

  useEffect(() => {
    if (ehFase(faseParam) && faseParam !== fase) setFase(faseParam)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [faseParam])

  const trocarFase = (id: FaseId) => {
    setFase(id)
    setSearchParams({ fase: id }, { replace: true })
  }

  useEffect(() => {
    let vivo = true
    ;(async () => {
      if (!tenantId) {
        setCarregandoEmpresas(false)
        return
      }
      setCarregandoEmpresas(true)
      try {
        const { empresasService } = await import('@/services/empresas')
        const lista = await empresasService.list(tenantId)
        if (!vivo) return
        setEmpresas(
          lista.map((e) => ({
            id: e.id,
            nome: e.nome_fantasia || e.razao_social || e.cnpj || 'Sem nome',
          })),
        )
      } catch {
        if (vivo) setEmpresas([])
      } finally {
        if (vivo) setCarregandoEmpresas(false)
      }
    })()
    return () => {
      vivo = false
    }
  }, [tenantId])

  useEffect(() => {
    if (!empresaId && empresas.length > 0) {
      setEmpresaId(empresas[0].id)
      setEmpresaNome(empresas[0].nome)
    }
  }, [empresas, empresaId])

  const conteudo = useMemo(() => {
    if (!tenantId) {
      return <p className="text-xs text-slate-500">Sessão inválida — faça login novamente.</p>
    }
    if (carregandoEmpresas) {
      return (
        <p className="text-xs text-slate-500 flex items-center gap-2 py-6 justify-center">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando empresas…
        </p>
      )
    }
    if (!empresaId) {
      return (
        <p className="text-xs text-slate-500 py-6 text-center">
          Nenhuma empresa na carteira. Cadastre uma empresa em <strong>Empresas</strong> para
          começar a usar o módulo Pessoal.
        </p>
      )
    }
    switch (fase) {
      case 'preparar':
        return (
          <FasePreparar
            tenantId={tenantId}
            usuarioId={tenantId}
            empresaId={empresaId}
            aoMudar={carregarFaseAtual}
          />
        )
      case 'movimentacoes':
        return (
          <FaseMovimentacoes
            tenantId={tenantId}
            empresaId={empresaId}
            competencia={competencia}
            aoMudar={carregarFaseAtual}
          />
        )
      case 'obrigacoes':
        return (
          <FaseObrigacoes tenantId={tenantId} empresaId={empresaId} competencia={competencia} />
        )
      case 'relatorios':
        return (
          <FaseRelatorios
            tenantId={tenantId}
            empresaId={empresaId}
            empresaNome={empresaNome}
            competencia={competencia}
          />
        )
    }
  }, [tenantId, carregandoEmpresas, fase, empresaId, empresaNome, competencia])

  return (
    <div className="min-h-dvh bg-[#F7F9FC] p-4 md:p-6 space-y-4">
      {/* Zona 1 — Cabeçalho */}
      <div className="rounded-2xl bg-white border border-[#E2E8F0] p-4 flex flex-col lg:flex-row lg:items-end gap-3 shadow-2xs">
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[#0FA3A3]">
            Modelo Makro · Fatia 5
          </p>
          <h2 className="text-lg font-bold text-[#1A2333] leading-tight">
            Pessoal{' '}
            <span className="text-xs font-normal text-slate-400">Departamento Pessoal e SST</span>
          </h2>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <label className="text-xs">
            <span className="block text-[10px] uppercase text-slate-400 mb-1 font-semibold">
              Empresa
            </span>
            <select
              className="h-9 w-full sm:w-64 rounded-md border border-[#E2E8F0] bg-white px-2 text-xs text-[#1A2333] focus-visible:outline-2 focus-visible:outline-[#0FA3A3]"
              value={empresaId}
              onChange={(e) => {
                setEmpresaId(e.target.value)
                setEmpresaNome(empresas.find((x) => x.id === e.target.value)?.nome || '')
              }}
              aria-label="Selecionar empresa"
            >
              {empresas.length === 0 && <option value="">Nenhuma empresa</option>}
              {empresas.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nome}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs">
            <span className="block text-[10px] uppercase text-slate-400 mb-1 font-semibold">
              Competência
            </span>
            <input
              type="month"
              className="h-9 w-full sm:w-40 rounded-md border border-[#E2E8F0] bg-white px-2 text-xs text-[#1A2333] focus-visible:outline-2 focus-visible:outline-[#0FA3A3]"
              value={competenciaParaInput(competencia)}
              onChange={(e) => e.target.value && setCompetencia(competenciaDaInput(e.target.value))}
              aria-label="Selecionar competência"
            />
          </label>
        </div>
      </div>

      <div className="grid lg:grid-cols-[220px_1fr] gap-4 items-start">
        {/* Zona 2 — Fases */}
        <nav
          aria-label="Fases do módulo pessoal"
          className="rounded-2xl bg-white border border-[#E2E8F0] p-2 flex lg:flex-col gap-1 overflow-x-auto"
        >
          {FASES.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => trocarFase(f.id)}
              aria-current={fase === f.id ? 'page' : undefined}
              className={cn(
                'flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-left whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-[#0FA3A3]',
                fase === f.id
                  ? 'bg-[#0FA3A3]/10 text-[#0FA3A3]'
                  : 'text-slate-500 hover:bg-slate-50',
              )}
            >
              <f.icon className="h-3.5 w-3.5" /> {f.label}
            </button>
          ))}
        </nav>

        {/* Zona 3 — Conteúdo */}
        <section className="rounded-2xl bg-white border border-[#E2E8F0] p-4 min-h-[320px] shadow-2xs">
          <div key={`${fase}-${versao}`}>{conteudo}</div>
        </section>
      </div>
    </div>
  )
}
