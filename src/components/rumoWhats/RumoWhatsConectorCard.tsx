import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Plug, Save } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/contexts/AuthContext'
import { rumoWhatsService } from '@/services/rumoWhats'
import type { WaCanalRecord } from '@/types'
import { useToast } from '@/hooks/use-toast'

/**
 * Campo "URL do conector" da aba Configurações. A URL fica em wa_canais.conector_url,
 * então trocá-la não exige recompilar o app: a página /extensao lê o canal a cada carga.
 * Sem canal ainda, o cartão também pede o número do WhatsApp para criá-lo (modo qr).
 */
export function RumoWhatsConectorCard() {
  const { tenant } = useAuth()
  const { toast } = useToast()
  const [canal, setCanal] = useState<WaCanalRecord | null>(null)
  const [url, setUrl] = useState('')
  const [telefone, setTelefone] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)

  const carregar = useCallback(async () => {
    if (!tenant?.id) return
    try {
      const c = await rumoWhatsService.carregarCanalPrincipal(tenant.id)
      setCanal(c)
      setUrl(c?.conector_url || '')
      setTelefone(c?.telefone || '')
    } catch (err) {
      console.error('Erro ao carregar o canal do conector:', err)
      toast({ title: 'Erro ao carregar o canal', variant: 'destructive' })
    } finally {
      setCarregando(false)
    }
  }, [tenant?.id, toast])

  useEffect(() => {
    carregar()
  }, [carregar])

  const handleSalvar = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!tenant?.id) return
    const urlNormalizada = rumoWhatsService.normalizarConectorUrl(url)
    if (!urlNormalizada) {
      toast({
        title: 'URL inválida',
        description: 'Use o endereço completo do túnel, começando com https://',
        variant: 'destructive',
      })
      return
    }
    const digitos = telefone.replace(/\D/g, '')
    if (!canal && !digitos) {
      toast({
        title: 'Informe o número',
        description: 'O número do WhatsApp do atendimento é necessário para criar o canal.',
        variant: 'destructive',
      })
      return
    }
    setSalvando(true)
    try {
      const salvo = canal
        ? await rumoWhatsService.atualizarCanal(canal.id, { conector_url: urlNormalizada })
        : await rumoWhatsService.criarCanal(tenant.id, {
            nome: 'Rumo Whats',
            telefone: digitos,
            conectorUrl: urlNormalizada,
          })
      setCanal(salvo)
      setUrl(urlNormalizada)
      toast({
        title: 'Conector salvo',
        description: 'A página /extensao passa a usar esta URL.',
      })
    } catch (err) {
      console.error('Erro ao salvar a URL do conector:', err)
      toast({ title: 'Erro ao salvar o conector', variant: 'destructive' })
    } finally {
      setSalvando(false)
    }
  }

  if (carregando) {
    return <div className="py-4 text-center text-sm text-[#64748B]">Carregando conector…</div>
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Plug className="h-5 w-5 text-[#0FA3A3]" />
          <div>
            <CardTitle className="text-base">Conector WhatsApp</CardTitle>
            <CardDescription>
              Endereço HTTPS do processo Node na máquina do escritório (túnel cloudflared ou ngrok).
              Veja o passo a passo no README em tools/conector-whatsapp.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSalvar} className="space-y-4" noValidate>
          {!canal && (
            <div className="space-y-1.5">
              <Label htmlFor="rumo-conector-telefone">Número do WhatsApp do atendimento</Label>
              <Input
                id="rumo-conector-telefone"
                type="tel"
                inputMode="tel"
                autoComplete="off"
                placeholder="5511999999999"
                value={telefone}
                onChange={(e) => setTelefone(e.target.value)}
              />
            </div>
          )}
          {canal && (
            <p className="text-sm text-[#64748B]">
              Canal: <span className="font-medium text-[#1A2333]">{canal.telefone}</span>
            </p>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="rumo-conector-url">URL do conector</Label>
            <Input
              id="rumo-conector-url"
              type="url"
              autoComplete="off"
              placeholder="https://conector.seu-dominio.com"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
            <p className="text-xs text-[#64748B]">
              Não use 127.0.0.1 aqui: a página publicada em HTTPS não alcança endereços locais.
            </p>
          </div>
          <Button type="submit" disabled={salvando}>
            <Save className="h-4 w-4 mr-1.5" />
            {salvando ? 'Salvando…' : 'Salvar conector'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
