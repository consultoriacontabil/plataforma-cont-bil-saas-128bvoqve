import React from 'react'
import { Layers, Building2, Landmark, Mail, Info, Clock, Sparkles, ShieldCheck } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'

export default function Integracoes() {
  const integrations = [
    {
      id: 'bb',
      title: 'Contador / Banco do Brasil',
      description:
        'Sincronização de extratos bancários em formato OFX e conciliação automática de recebimentos PJ.',
      icon: Landmark,
      color: 'from-amber-500 to-yellow-600',
      tag: 'Open Finance',
    },
    {
      id: 'rfb',
      title: 'Receita Federal do Brasil (e-CAC)',
      description:
        'Consulta de pendências fiscais, débitos em aberto, parcelamentos e emissão de Certidão Negativa (CND).',
      icon: ShieldCheck,
      color: 'from-blue-600 to-indigo-700',
      tag: 'Governo Federal',
    },
    {
      id: 'imap',
      title: 'E-mail Corporativo (IMAP / SMTP)',
      description:
        'Captura automática de XMLs de notas fiscais e relatórios enviados por clientes via caixa postal contábil.',
      icon: Mail,
      color: 'from-teal-600 to-emerald-700',
      tag: 'GED Automático',
    },
  ]

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-[#1A2333]">Hub de Integrações</h2>
        <p className="text-xs text-[#64748B]">
          Conectores externos para automação contábil, bancária e fiscal
        </p>
      </div>

      {/* Banner Novo Módulo: Emissão Inteligente de NFS-e via WhatsApp */}
      <div className="rounded-2xl border border-[#0FA3A3] bg-gradient-to-r from-[#0FA3A3]/15 via-teal-500/5 to-transparent p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#0FA3A3] text-white">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-[#1A2333]">
                Emissão Inteligente de NFS-e via WhatsApp (Framework Integrado)
              </h3>
              <Badge className="bg-[#0FA3A3] text-white text-[10px]">ATIVO NOVO</Badge>
            </div>
            <p className="text-xs text-[#64748B] mt-0.5">
              Recepção via Webhook Evolution API, extração com Motor Cognitivo IA, Painel de
              Supervisão contábil e emissão com XML/DANFSE.
            </p>
          </div>
        </div>
        <a
          href="/nfse-whatsapp"
          className="inline-flex items-center justify-center rounded-lg bg-[#0FA3A3] px-4 py-2 text-xs font-semibold text-white hover:bg-[#0d8c8c] transition-colors shrink-0 shadow-sm"
        >
          Acessar Painel de Supervisão
        </a>
      </div>

      {/* Banner de Destaque da Extensão do WhatsApp */}
      <div className="rounded-2xl border border-teal-200 bg-gradient-to-r from-teal-500/10 via-emerald-500/5 to-transparent p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#123B6D] text-white">
            <Layers className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-[#1A2333]">
                Extensão Google Chrome para WhatsApp Web
              </h3>
              <Badge className="bg-[#123B6D] text-white text-[10px]">DISPONÍVEL</Badge>
            </div>
            <p className="text-xs text-[#64748B] mt-0.5">
              Envio assistivo de recibos e guias, mensagens rápidas com templates e captura de
              contatos em modo seguro anti-ban.
            </p>
          </div>
        </div>
        <a
          href="/extensao"
          className="inline-flex items-center justify-center rounded-lg bg-[#123B6D] px-4 py-2 text-xs font-semibold text-white hover:bg-[#0e2f57] transition-colors shrink-0"
        >
          Instalar Extensão
        </a>
      </div>

      {/* Info Banner */}
      <div className="flex items-start gap-3 rounded-2xl border border-teal-200 bg-teal-50/70 p-4 shadow-xs">
        <Info className="h-5 w-5 text-[#0FA3A3] shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <p className="text-xs font-bold text-[#0B1F3A]">Aviso Operacional</p>
          <p className="text-xs text-[#64748B]">
            Integrações bancárias automáticas serão habilitadas em fases futuras. A extensão Chrome
            para WhatsApp Web já se encontra totalmente operacional em modo assistivo.
          </p>
        </div>
      </div>

      {/* Grid of 3 Integration Cards */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {integrations.map((item) => {
          const Icon = item.icon
          return (
            <Card
              key={item.id}
              className="rounded-2xl border-[#E2E8F0] shadow-xs flex flex-col justify-between"
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div
                    className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr ${item.color} text-white shadow-sm`}
                  >
                    <Icon className="h-6 w-6" />
                  </div>
                  <Badge variant="outline" className="text-[10px] bg-slate-50 text-[#64748B]">
                    {item.tag}
                  </Badge>
                </div>
                <CardTitle className="text-sm font-bold text-[#1A2333] mt-3">
                  {item.title}
                </CardTitle>
                <CardDescription className="text-xs text-[#64748B] line-clamp-3">
                  {item.description}
                </CardDescription>
              </CardHeader>

              <CardContent className="pt-2 border-t border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs text-[#94A3B8]">
                  <Clock className="h-3.5 w-3.5" />
                  <span>Em breve (P1)</span>
                </div>
                <Switch disabled checked={false} aria-label={`Ativar ${item.title}`} />
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
