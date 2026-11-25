/**
 * Fase Obrigações do Módulo Contábil (Fatia 4 Makro).
 * ECD/ECF já são gerados no Módulo Fiscal (src/services/sped.ts) — esta fase
 * apenas direciona para lá, sem duplicar geração de SPED.
 */

import { BookCheck, ExternalLink, FileText, Info } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useNavigate } from 'react-router-dom'

interface Props {
  empresaNome: string
  competencia: string
}

const OBRIGACOES = [
  {
    id: 'ecd',
    sigla: 'ECD',
    titulo: 'Escrituração Contábil Digital',
    descricao:
      'Livro Diário e Razão em arquivo digital para transmissão ao SPED. Gerado no Módulo Fiscal, aba SPED.',
    icon: BookCheck,
  },
  {
    id: 'ecf',
    sigla: 'ECF',
    titulo: 'Escrituração Contábil Fiscal',
    descricao:
      'Informações socioeconômicas e fiscais da pessoa jurídica (IRPJ/CSLL). Gerado no Módulo Fiscal, aba SPED.',
    icon: FileText,
  },
] as const

export function FechamentoObrigacoes({ empresaNome, competencia }: Props) {
  const navigate = useNavigate()

  const abrirSped = () => navigate('/fiscal?tab=sped')

  return (
    <Card className="rounded-2xl border-[#E2E8F0] p-4 shadow-2xs">
      <h4 className="text-sm font-bold text-[#1A2333] flex items-center gap-2 mb-3">
        <BookCheck className="h-4 w-4 text-[#0FA3A3]" /> Obrigações contábeis acessórias
      </h4>

      <div className="flex items-start gap-2 rounded-lg bg-sky-50 border border-sky-100 p-3 mb-3">
        <Info className="h-4 w-4 text-sky-600 shrink-0 mt-0.5" />
        <p className="text-[11px] text-sky-700">
          ECD e ECF são escriturados e transmitidos a partir do{' '}
          <strong>Módulo Fiscal, aba SPED</strong>, usando os dados desta competência
          {empresaNome ? ` de ${empresaNome}` : ''} ({competencia}). Clique em um card abaixo para
          abrir a geração correspondente.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        {OBRIGACOES.map((o) => (
          <div
            key={o.id}
            className="rounded-xl border border-[#E2E8F0] p-3 flex flex-col gap-2 bg-white"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <o.icon className="h-4 w-4 text-[#0FA3A3]" />
                <span className="text-xs font-bold text-[#1A2333]">{o.sigla}</span>
                <Badge variant="outline" className="text-[10px] bg-slate-50 text-slate-500">
                  {o.titulo}
                </Badge>
              </div>
            </div>
            <p className="text-[11px] text-slate-500 flex-1">{o.descricao}</p>
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-[11px] w-fit"
              onClick={abrirSped}
            >
              <ExternalLink className="h-3 w-3" /> Abrir SPED no Módulo Fiscal
            </Button>
          </div>
        ))}
      </div>
    </Card>
  )
}
