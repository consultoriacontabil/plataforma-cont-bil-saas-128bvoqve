import React from 'react'
import { Scale, BookOpen, AlertCircle, ExternalLink, ShieldCheck, FileCheck2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { BASE_LEGAL_CITACAO } from '@/lib/companyFormationLegal'

export const FormationBaseLegalPanel: React.FC = () => {
  return (
    <Card className="rounded-2xl border-[#E2E8F0] shadow-xs">
      <CardHeader className="pb-3 border-b border-slate-100">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-bold text-[#1A2333] flex items-center gap-2">
            <Scale className="h-4 w-4 text-[#0FA3A3]" />
            <span>Fundamentação e Base Legal Atualizada (Marco Regulatório 2026)</span>
          </CardTitle>
          <Badge className="bg-teal-50 text-teal-800 border-teal-200 text-xs">
            NBC PG 01 / Lei 13.874 / Redesim
          </Badge>
        </div>
        <p className="text-xs text-[#64748B] mt-0.5">
          Compêndio de normas legais aplicáveis à constituição societária no Brasil
        </p>
      </CardHeader>

      <CardContent className="pt-4 space-y-4 text-xs">
        {/* Aviso de Transparência e Rigor Técnico (NBC PG 01) */}
        <div className="rounded-xl bg-amber-50/70 border border-amber-200 p-3.5 text-amber-950 text-xs space-y-1.5">
          <div className="flex items-center gap-2 font-bold text-amber-900">
            <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
            <span>Aviso Legal e Diretriz de Conformidade Técnica (NBC PG 01)</span>
          </div>
          <p className="leading-relaxed">
            A legislação societária e os tetos/valores de enquadramento tributário vigentes devem
            ser conferidos na data exata do protocolo de abertura. Esta plataforma registra as
            citações normativas oficiais e parametrizações de boas práticas para conferência,{' '}
            <b>não substituindo parecer jurídico individualizado</b> em casos complexos de
            reestruturação de capital, cisão, incorporação ou holding.
          </p>
        </div>

        {/* Grade de Citações Normativas */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {BASE_LEGAL_CITACAO.map((item, index) => (
            <div
              key={index}
              className="p-3.5 rounded-xl border border-slate-200 bg-white hover:border-slate-300 transition-colors space-y-2 flex flex-col justify-between"
            >
              <div className="space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <h4 className="font-bold text-xs text-[#1A2333] flex items-center gap-1.5">
                    <BookOpen className="h-3.5 w-3.5 text-[#0FA3A3] shrink-0" />
                    <span>{item.titulo}</span>
                  </h4>
                </div>

                <p className="font-mono text-[11px] text-teal-800 bg-teal-50/70 px-2 py-0.5 rounded border border-teal-100">
                  {item.dispositivo}
                </p>

                <p className="text-[11px] text-[#64748B] leading-relaxed">{item.resumo}</p>
              </div>

              <div className="pt-2 border-t border-slate-100">
                <span className="text-[10px] text-slate-500 font-medium">Impacto prático: </span>
                <span className="text-[11px] text-[#1A2333] font-semibold">{item.importancia}</span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
