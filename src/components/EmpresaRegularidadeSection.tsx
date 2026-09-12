import React, { useState } from 'react'
import {
  ShieldAlert,
  ShieldCheck,
  ShieldX,
  FileCheck2,
  Inbox,
  AlertTriangle,
  Mail,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { EmpresaCertidoesTab } from './EmpresaCertidoesTab'
import { EmpresaEcacTab } from './EmpresaEcacTab'
import { EmpresaConectorRfbTab } from './EmpresaConectorRfbTab'
import { EmpresaGuiasPagamentosTab } from './EmpresaGuiasPagamentosTab'
import { certidoesService } from '@/services/regularidade'
import type { Empresa, CertidaoRecord, EcacComunicacaoRecord } from '@/types'

interface EmpresaRegularidadeSectionProps {
  empresaId: string
  tenantId: string
  canEdit: boolean
  certidoes: CertidaoRecord[]
  comunicacoesEcac: EcacComunicacaoRecord[]
  temCertificadoA1: boolean
  empresa?: Empresa
  onRefresh: () => Promise<void>
}

export function EmpresaRegularidadeSection({
  empresaId,
  tenantId,
  canEdit,
  certidoes,
  comunicacoesEcac,
  temCertificadoA1,
  empresa,
  onRefresh,
}: EmpresaRegularidadeSectionProps) {
  const [subTab, setSubTab] = useState<'certidoes' | 'ecac' | 'conector_rfb' | 'guias_pagamentos'>(
    'certidoes',
  )

  // Contadores para os badges das sub-abas
  const certidoesVencendoOuVencidas = certidoes.filter((c) => {
    const s = certidoesService.calcularSaude(c)
    return s.saude === 'vencida' || s.saude === 'proximo_vencimento' || s.saude === 'sem_efeito'
  }).length

  const ecacNaoLidas = comunicacoesEcac.filter((c) => !c.lida).length
  const ecacAltasNaoLidas = comunicacoesEcac.filter(
    (c) => !c.lida && c.criticidade === 'alta',
  ).length

  return (
    <Card className="rounded-2xl border-[#E2E8F0] shadow-xs overflow-hidden">
      <div className="border-b border-slate-100 bg-slate-50/50 p-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-[#1A2333] flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-[#0FA3A3]" />
              <span>Módulo de Monitoramento de Regularidade Fiscal</span>
            </h3>
            <p className="text-xs text-[#64748B] mt-0.5">
              Gestão de Certidões Negativas de Débito (CND/CPEN) e Caixa Postal Eletrônica (e-CAC)
            </p>
          </div>

          <div className="flex items-center gap-2">
            {certidoesVencendoOuVencidas > 0 ? (
              <Badge
                variant="outline"
                className="bg-amber-50 text-amber-800 border-amber-300 text-xs font-semibold gap-1"
              >
                <ShieldAlert className="h-3 w-3 text-amber-600" />
                <span>{certidoesVencendoOuVencidas} certidão(ões) em alerta</span>
              </Badge>
            ) : certidoes.length > 0 ? (
              <Badge
                variant="outline"
                className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs font-semibold gap-1"
              >
                <ShieldCheck className="h-3 w-3 text-emerald-600" />
                <span>Certidões 100% Regulares</span>
              </Badge>
            ) : null}

            {ecacNaoLidas > 0 && (
              <Badge
                className={
                  ecacAltasNaoLidas > 0
                    ? 'bg-red-500 hover:bg-red-600 text-white text-xs font-semibold gap-1'
                    : 'bg-[#0FA3A3] text-white text-xs font-semibold gap-1'
                }
              >
                <Mail className="h-3 w-3" />
                <span>{ecacNaoLidas} E-CAC não lida(s)</span>
              </Badge>
            )}
          </div>
        </div>
      </div>

      <CardContent className="p-4 sm:p-6 space-y-6">
        <Tabs
          value={subTab}
          onValueChange={(val) => setSubTab(val as 'certidoes' | 'ecac' | 'conector_rfb')}
        >
          <TabsList className="bg-slate-100 p-1 rounded-xl h-10 w-full sm:w-auto justify-start">
            <TabsTrigger
              value="certidoes"
              className="rounded-lg text-xs font-semibold gap-2 data-[state=active]:bg-white data-[state=active]:text-[#0FA3A3]"
            >
              <FileCheck2 className="h-3.5 w-3.5" />
              <span>Certidões Negativas ({certidoes.length})</span>
              {certidoesVencendoOuVencidas > 0 && (
                <span className="inline-flex items-center justify-center px-1.5 py-0.2 text-[10px] font-bold rounded-full bg-amber-500 text-white">
                  {certidoesVencendoOuVencidas}
                </span>
              )}
            </TabsTrigger>

            <TabsTrigger
              value="ecac"
              className="rounded-lg text-xs font-semibold gap-2 data-[state=active]:bg-white data-[state=active]:text-[#0FA3A3]"
            >
              <Inbox className="h-3.5 w-3.5" />
              <span>Caixa Postal E-CAC ({comunicacoesEcac.length})</span>
              {ecacNaoLidas > 0 && (
                <span
                  className={`inline-flex items-center justify-center px-1.5 py-0.2 text-[10px] font-bold rounded-full text-white ${
                    ecacAltasNaoLidas > 0 ? 'bg-red-500' : 'bg-[#0FA3A3]'
                  }`}
                >
                  {ecacNaoLidas}
                </span>
              )}
            </TabsTrigger>

            <TabsTrigger
              value="conector_rfb"
              className="rounded-lg text-xs font-semibold gap-2 data-[state=active]:bg-white data-[state=active]:text-[#0FA3A3]"
            >
              <ShieldAlert className="h-3.5 w-3.5" />
              <span>Conector RFB / DTE</span>
            </TabsTrigger>

            <TabsTrigger
              value="guias_pagamentos"
              className="rounded-lg text-xs font-semibold gap-2 data-[state=active]:bg-white data-[state=active]:text-[#0FA3A3]"
            >
              <FileCheck2 className="h-3.5 w-3.5 text-[#0FA3A3]" />
              <span>Guias & Pagamentos (PAR/PER-DCOMP)</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="certidoes" className="pt-4">
            <EmpresaCertidoesTab
              empresaId={empresaId}
              tenantId={tenantId}
              canEdit={canEdit}
              certidoes={certidoes}
              onRefresh={onRefresh}
            />
          </TabsContent>

          <TabsContent value="ecac" className="pt-4">
            <EmpresaEcacTab
              empresaId={empresaId}
              tenantId={tenantId}
              canEdit={canEdit}
              comunicacoes={comunicacoesEcac}
              temCertificadoA1={temCertificadoA1}
              onRefresh={onRefresh}
            />
          </TabsContent>

          <TabsContent value="conector_rfb" className="pt-4">
            {empresa ? (
              <EmpresaConectorRfbTab empresa={empresa} onSyncCompleted={onRefresh} />
            ) : (
              <EmpresaConectorRfbTab
                empresa={{ id: empresaId } as Empresa}
                onSyncCompleted={onRefresh}
              />
            )}
          </TabsContent>

          <TabsContent value="guias_pagamentos" className="pt-4">
            <EmpresaGuiasPagamentosTab
              empresaId={empresaId}
              tenantId={tenantId}
              canEdit={canEdit}
              onRefreshParent={onRefresh}
            />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
