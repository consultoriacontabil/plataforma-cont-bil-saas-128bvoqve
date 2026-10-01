import React, { useState, useEffect, useCallback } from 'react'
import {
  Users,
  UserPlus,
  Trash2,
  Search,
  MessageSquare,
  CreditCard,
  FolderInput,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { portalService } from '@/services/portal'
import { empresasService } from '@/services/empresas'
import type { PortalAcesso, Empresa } from '@/types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { WhatsAppEnvioAtivoPanel } from '@/components/WhatsAppEnvioAtivoPanel'
import { CobrancasTab } from '@/components/CobrancasTab'
import { PedidosDocumentosTab } from '@/components/PedidosDocumentosTab'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { formatDatePtBr } from '@/lib/formatters'

export default function PortalAcessosPage() {
  const { tenant, member } = useAuth()
  const { toast } = useToast()

  const [acessos, setAcessos] = useState<PortalAcesso[]>([])
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')

  // Modal de Convite
  const [modalOpen, setModalOpen] = useState(false)
  const [conviteEmpresa, setConviteEmpresa] = useState('')
  const [conviteNome, setConviteNome] = useState('')
  const [conviteEmail, setConviteEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const canManage = member?.perfil === 'administrador' || member?.perfil === 'contador'

  const loadData = useCallback(async () => {
    if (!tenant?.id) return
    setLoading(true)
    try {
      const [acs, emps] = await Promise.all([
        portalService.listAcessos(tenant.id),
        empresasService.list(tenant.id),
      ])
      setAcessos(acs)
      setEmpresas(emps)
      if (emps.length > 0 && !conviteEmpresa) {
        setConviteEmpresa(emps[0].id)
      }
    } catch (err) {
      console.error('Erro ao carregar acessos do portal:', err)
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar',
        description: 'Não foi possível buscar a lista de acessos do portal.',
      })
    } finally {
      setLoading(false)
    }
  }, [tenant?.id, conviteEmpresa, toast])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleOpenModal = () => {
    setConviteNome('')
    setConviteEmail('')
    if (empresas.length > 0) setConviteEmpresa(empresas[0].id)
    setModalOpen(true)
  }

  const handleConvidar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!tenant?.id || !conviteEmpresa) return

    setSubmitting(true)
    try {
      await portalService.convidarContato({
        tenant_id: tenant.id,
        empresa: conviteEmpresa,
        email: conviteEmail.trim().toLowerCase(),
        nome_contato: conviteNome.trim(),
      })
      toast({
        title: 'Acesso liberado!',
        description: `O contato ${conviteNome} já pode acessar o Portal do Cliente com a credencial padrão Skip@Pass.`,
      })
      setModalOpen(false)
      loadData()
    } catch (err: unknown) {
      console.error('Erro ao convidar contato:', err)
      toast({
        variant: 'destructive',
        title: 'Erro ao criar acesso',
        description: 'Verifique se este e-mail já não possui acesso ao portal.',
      })
    } finally {
      setSubmitting(false)
    }
  }

  const handleToggle = async (id: string, currentStatus: boolean) => {
    try {
      await portalService.toggleAcesso(id, !currentStatus)
      toast({
        title: !currentStatus ? 'Acesso ativado' : 'Acesso desativado',
      })
      loadData()
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Erro ao alterar status',
      })
    }
  }

  const handleDelete = async (id: string, nome: string) => {
    if (!window.confirm(`Deseja remover o acesso de ${nome} ao portal?`)) return
    try {
      await portalService.deleteAcesso(id)
      toast({ title: 'Acesso excluído' })
      loadData()
    } catch (err) {
      toast({ variant: 'destructive', title: 'Erro ao remover' })
    }
  }

  const filteredAcessos = acessos.filter((a) => {
    if (!busca.trim()) return true
    const q = busca.toLowerCase()
    const nome = a.nome_contato.toLowerCase()
    const email = a.email.toLowerCase()
    const emp = (
      a.expand?.empresa?.nome_fantasia ||
      a.expand?.empresa?.razao_social ||
      ''
    ).toLowerCase()
    return nome.includes(q) || email.includes(q) || emp.includes(q)
  })

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold tracking-tight text-[#1A2333]">
              Portal & Acessos do Cliente
            </h2>
            <Badge className="bg-[#0FA3A3] text-white text-[11px] font-semibold">Clientes</Badge>
          </div>
          <p className="text-xs text-[#64748B]">
            Gerencie os logins dos contatos das empresas clientes e configure o envio ativo por
            WhatsApp de guias, avisos e demonstrativos
          </p>
        </div>

        {canManage && (
          <Button
            onClick={handleOpenModal}
            className="gap-2 rounded-xl text-xs font-semibold h-10 bg-[#0FA3A3] text-white hover:bg-[#0C8585]"
          >
            <UserPlus className="h-4 w-4" />
            <span>Convidar Contato da Empresa</span>
          </Button>
        )}
      </div>

      {/* Abas: Logins do Portal, Envio Ativo por WhatsApp & Cobrança Boleto/PIX */}
      <Tabs defaultValue="acessos" className="space-y-4">
        <TabsList className="bg-slate-100 p-1 rounded-2xl h-11 border border-slate-200">
          <TabsTrigger
            value="acessos"
            className="rounded-xl text-xs font-semibold data-[state=active]:bg-white data-[state=active]:text-[#0FA3A3] data-[state=active]:shadow-2xs gap-2 px-4"
          >
            <Users className="h-4 w-4" />
            <span>Acessos & Logins ({acessos.length})</span>
          </TabsTrigger>
          <TabsTrigger
            value="pedidos-documentos"
            className="rounded-xl text-xs font-semibold data-[state=active]:bg-white data-[state=active]:text-[#0FA3A3] data-[state=active]:shadow-2xs gap-2 px-4"
          >
            <FolderInput className="h-4 w-4" />
            <span>Pedidos de Documentos</span>
            <Badge className="bg-[#0FA3A3]/20 text-[#0FA3A3] text-[10px] ml-1 font-bold">
              NOVO
            </Badge>
          </TabsTrigger>
          <TabsTrigger
            value="whatsapp-ativo"
            className="rounded-xl text-xs font-semibold data-[state=active]:bg-white data-[state=active]:text-[#0FA3A3] data-[state=active]:shadow-2xs gap-2 px-4"
          >
            <MessageSquare className="h-4 w-4" />
            <span>Envio Ativo por WhatsApp</span>
          </TabsTrigger>
          <TabsTrigger
            value="cobrancas"
            className="rounded-xl text-xs font-semibold data-[state=active]:bg-white data-[state=active]:text-[#0FA3A3] data-[state=active]:shadow-2xs gap-2 px-4"
          >
            <CreditCard className="h-4 w-4" />
            <span>Cobrança Boleto/PIX</span>
          </TabsTrigger>
        </TabsList>

        {/* ABA 1: ACESSOS E LOGINS */}
        <TabsContent value="acessos" className="space-y-4">
          {/* Busca */}
          <div className="flex items-center bg-white p-3 rounded-2xl border border-[#E2E8F0] shadow-2xs">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#94A3B8]" />
              <Input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar por contato, e-mail ou empresa..."
                className="pl-9 h-9 text-xs rounded-xl border-[#E2E8F0]"
              />
            </div>
          </div>

          {/* Tabela de Acessos */}
          <div className="rounded-2xl border border-[#E2E8F0] bg-white shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F8FAFC] text-[#64748B] font-semibold border-b border-[#E2E8F0]">
                  <tr>
                    <th className="py-3 px-4">Nome do Contato</th>
                    <th className="py-3 px-4">E-mail de Login</th>
                    <th className="py-3 px-4">Empresa Vinculada</th>
                    <th className="py-3 px-4">Criado em</th>
                    <th className="py-3 px-4">Status</th>
                    {canManage && <th className="py-3 px-4 text-right">Ações</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-[#1A2333]">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-[#94A3B8]">
                        Carregando acessos do portal...
                      </td>
                    </tr>
                  ) : filteredAcessos.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-[#94A3B8]">
                        Nenhum acesso cadastrado. Clique em &quot;Convidar Contato&quot; para
                        liberar uma empresa.
                      </td>
                    </tr>
                  ) : (
                    filteredAcessos.map((a) => (
                      <tr key={a.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3.5 px-4 font-bold text-[#1A2333]">{a.nome_contato}</td>
                        <td className="py-3.5 px-4 font-mono text-[#0FA3A3]">{a.email}</td>
                        <td className="py-3.5 px-4 font-medium text-[#475569]">
                          {a.expand?.empresa?.nome_fantasia ||
                            a.expand?.empresa?.razao_social ||
                            '—'}
                        </td>
                        <td className="py-3.5 px-4 text-[#64748B]">{formatDatePtBr(a.created)}</td>
                        <td className="py-3.5 px-4">
                          {a.ativo ? (
                            <Badge className="bg-[#DCFCE7] text-[#16A34A] border-emerald-200">
                              Ativo
                            </Badge>
                          ) : (
                            <Badge className="bg-[#FEE2E2] text-[#DC2626] border-rose-200">
                              Bloqueado
                            </Badge>
                          )}
                        </td>
                        {canManage && (
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleToggle(a.id, a.ativo)}
                                className="h-7 text-[11px] font-semibold"
                              >
                                {a.ativo ? 'Bloquear' : 'Ativar'}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDelete(a.id, a.nome_contato)}
                                className="h-7 w-7 p-0 text-[#64748B] hover:text-[#EF4444]"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* ABA 2: PEDIDOS DE DOCUMENTOS */}
        <TabsContent value="pedidos-documentos">
          <PedidosDocumentosTab
            tenantId={tenant?.id || ''}
            empresas={empresas}
            canEdit={canManage}
          />
        </TabsContent>

        {/* ABA 3: ENVIO ATIVO POR WHATSAPP */}
        <TabsContent value="whatsapp-ativo">
          <WhatsAppEnvioAtivoPanel
            tenantId={tenant?.id || ''}
            empresas={empresas}
            canManage={canManage}
          />
        </TabsContent>

        {/* ABA 3: COBRANÇA BOLETO / PIX */}
        <TabsContent value="cobrancas">
          <CobrancasTab tenantId={tenant?.id || ''} empresas={empresas} canManage={canManage} />
        </TabsContent>
      </Tabs>

      {/* Modal Convidar Contato */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>Convidar Contato da Empresa</DialogTitle>
            <DialogDescription className="text-xs">
              O cliente receberá acesso restrito exclusivamente aos documentos e obrigações da sua
              empresa.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleConvidar} className="space-y-3 py-2 text-xs">
            <div>
              <Label className="text-xs font-semibold">Empresa do Cliente</Label>
              <Select value={conviteEmpresa} onValueChange={setConviteEmpresa} required>
                <SelectTrigger className="h-9 rounded-xl border-[#E2E8F0] mt-1 text-xs">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {empresas.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.nome_fantasia || e.razao_social}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs font-semibold">Nome do Responsável / Contato</Label>
              <Input
                value={conviteNome}
                onChange={(e) => setConviteNome(e.target.value)}
                placeholder="Ex: Ana Beatriz Silveira"
                required
                className="h-9 rounded-xl border-[#E2E8F0] mt-1 text-xs"
              />
            </div>

            <div>
              <Label className="text-xs font-semibold">E-mail Comercial (Login)</Label>
              <Input
                type="email"
                value={conviteEmail}
                onChange={(e) => setConviteEmail(e.target.value)}
                placeholder="contato@empresa.com.br"
                required
                className="h-9 rounded-xl border-[#E2E8F0] mt-1 text-xs"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setModalOpen(false)}
                className="rounded-xl text-xs"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={submitting}
                className="rounded-xl text-xs bg-[#0FA3A3] text-white hover:bg-[#0C8585]"
              >
                {submitting ? 'Criando...' : 'Liberar Acesso ao Portal'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
