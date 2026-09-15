import React, { useState, useEffect } from 'react'
import {
  AlertTriangle,
  Archive,
  Clock,
  Database,
  FileText,
  Loader2,
  Lock,
  ShieldAlert,
  Users,
  Wallet,
} from 'lucide-react'
import { maskCnpj } from '@/lib/formatters'
import type { Empresa } from '@/types'
import { exclusoesService, type ContagemVinculosEmpresa } from '@/services/exclusoes'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'

interface ModalExclusaoEmpresaProps {
  empresa: Empresa | null
  open: boolean
  onOpenChange: (open: boolean) => void
  usuarioId: string
  onExclusaoConcluida: () => void
}

export function ModalExclusaoEmpresa({
  empresa,
  open,
  onOpenChange,
  usuarioId,
  onExclusaoConcluida,
}: ModalExclusaoEmpresaProps) {
  const { toast } = useToast()
  const [confirmInput, setConfirmInput] = useState('')
  const [carregandoContagem, setCarregandoContagem] = useState(false)
  const [processando, setProcessando] = useState(false)
  const [vinculos, setVinculos] = useState<ContagemVinculosEmpresa | null>(null)

  useEffect(() => {
    if (open && empresa) {
      setConfirmInput('')
      setCarregandoContagem(true)
      exclusoesService
        .contarVinculos(empresa.id)
        .then((res) => setVinculos(res))
        .catch((err) => {
          console.error('Erro ao contar vinculos:', err)
          setVinculos(null)
        })
        .finally(() => setCarregandoContagem(false))
    } else {
      setConfirmInput('')
      setVinculos(null)
    }
  }, [open, empresa])

  if (!empresa) return null

  // Normalização para comparação robusta: remove acentuação, pontuação excessiva e múltiplos espaços
  const normalizarTexto = (texto?: string | null) => {
    if (!texto) return ''
    return texto
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ' ')
  }

  // Normalização de CNPJ (somente dígitos) de ambos os lados
  const cnpjEsperadoDigitos = (empresa.cnpj || '').replace(/\D/g, '')
  const inputDigitos = confirmInput.replace(/\D/g, '')

  // Verificação de CNPJ: confere se tem ao menos 11-14 dígitos e bate exatamente com os dígitos do CNPJ da empresa
  const confirmouPorCnpj =
    cnpjEsperadoDigitos.length > 0 &&
    inputDigitos.length === cnpjEsperadoDigitos.length &&
    inputDigitos === cnpjEsperadoDigitos

  // Normalização textual de razão social e nome fantasia
  const inputNormalizado = normalizarTexto(confirmInput)
  const razaoNormalizada = normalizarTexto(empresa.razao_social)
  const fantasiaNormalizada = normalizarTexto(empresa.nome_fantasia)

  const confirmouPorNome =
    inputNormalizado.length > 0 &&
    ((razaoNormalizada.length > 0 && inputNormalizado === razaoNormalizada) ||
      (fantasiaNormalizada.length > 0 && inputNormalizado === fantasiaNormalizada))

  const podeConfirmar = confirmouPorCnpj || confirmouPorNome
  const digitouAlgo = confirmInput.trim().length > 0
  const inputInvalido = digitouAlgo && !podeConfirmar

  const handleConfirmarExclusao = async () => {
    if (!podeConfirmar || processando) return
    setProcessando(true)
    try {
      const backup = await exclusoesService.solicitarExclusaoComBackup(empresa, usuarioId)
      toast({
        title: 'Exclusão iniciada com backup seguro',
        description: `A empresa ${empresa.nome_fantasia || empresa.razao_social} foi movida para retenção com backup de ${backup.total_registros || 1} registros. Você tem 24 horas para restaurá-la antes da purga definitiva.`,
      })
      onOpenChange(false)
      onExclusaoConcluida()
    } catch (err: any) {
      console.error('Erro ao excluir empresa:', err)
      toast({
        variant: 'destructive',
        title: 'Falha ao processar exclusão',
        description: err?.message || 'Não foi possível agendar a exclusão da empresa.',
      })
    } finally {
      setProcessando(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl max-w-lg border-red-200 shadow-xl overflow-hidden p-0">
        {/* Banner de Aviso Crítico */}
        <div className="bg-red-500 text-white p-5 flex items-start gap-3">
          <div className="h-10 w-10 rounded-xl bg-red-600 flex items-center justify-center shrink-0 shadow-xs">
            <AlertTriangle className="h-6 w-6 text-white" />
          </div>
          <div>
            <h3 className="font-bold text-base leading-snug">
              Exclusão de Cadastro com Retenção de 24h
            </h3>
            <p className="text-xs text-red-100 mt-0.5 leading-relaxed">
              Os dados da empresa sairão das consultas e rotinas do escritório imediatamente. Um
              backup completo será retido por 24 horas, após o qual ocorrerá a purga definitiva e
              irrecuperável.
            </p>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {/* Dados da Empresa Selecionada */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/75 p-3.5 space-y-1.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-[#64748B]">Empresa selecionada:</span>
              <Badge variant="outline" className="text-[11px] font-mono border-slate-300">
                CNPJ: {maskCnpj(empresa.cnpj)}
              </Badge>
            </div>
            <p className="font-bold text-[#1A2333] text-sm">
              {empresa.nome_fantasia || empresa.razao_social}
            </p>
            {empresa.nome_fantasia && (
              <p className="text-[#64748B] text-[11px]">Razão Social: {empresa.razao_social}</p>
            )}
          </div>

          {/* Volume de Registros Vinculados */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-[#1A2333] flex items-center gap-1.5">
                <Database className="h-4 w-4 text-[#0FA3A3]" />
                <span>Volume de dados vinculados a serem arquivados:</span>
              </label>
              {carregandoContagem && (
                <span className="flex items-center gap-1 text-[11px] text-[#64748B]">
                  <Loader2 className="h-3 w-3 animate-spin text-[#0FA3A3]" />
                  Contabilizando...
                </span>
              )}
            </div>

            {vinculos ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div className="rounded-xl border border-slate-200 bg-white p-2.5 text-center">
                  <span className="text-[10px] text-[#64748B] block">Colaboradores</span>
                  <span className="font-bold text-[#1A2333] text-sm">{vinculos.colaboradores}</span>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-2.5 text-center">
                  <span className="text-[10px] text-[#64748B] block">Documentos</span>
                  <span className="font-bold text-[#1A2333] text-sm">{vinculos.documentos}</span>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-2.5 text-center">
                  <span className="text-[10px] text-[#64748B] block">Títulos Fin.</span>
                  <span className="font-bold text-[#1A2333] text-sm">
                    {vinculos.titulosFinanceiros}
                  </span>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-2.5 text-center">
                  <span className="text-[10px] text-[#64748B] block">Lançamentos</span>
                  <span className="font-bold text-[#1A2333] text-sm">
                    {vinculos.lancamentosContabeis}
                  </span>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-2.5 text-center">
                  <span className="text-[10px] text-[#64748B] block">Obrigações/Fiscal</span>
                  <span className="font-bold text-[#1A2333] text-sm">{vinculos.obrigacoes}</span>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-2.5 text-center">
                  <span className="text-[10px] text-[#64748B] block">Guias/Parc.</span>
                  <span className="font-bold text-[#1A2333] text-sm">
                    {vinculos.guias + vinculos.parcelamentos}
                  </span>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-2.5 text-center">
                  <span className="text-[10px] text-[#64748B] block">Notas NF-e/NFS-e</span>
                  <span className="font-bold text-[#1A2333] text-sm">
                    {vinculos.nfe + vinculos.nfse}
                  </span>
                </div>
                <div className="rounded-xl border border-slate-200 bg-teal-50/50 p-2.5 text-center">
                  <span className="text-[10px] text-[#0FA3A3] font-semibold block">
                    Total Registros
                  </span>
                  <span className="font-bold text-[#0FA3A3] text-sm">{vinculos.total}</span>
                </div>
              </div>
            ) : null}
          </div>

          {/* Destaque do Backup de 24h */}
          <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3.5 space-y-2 text-xs">
            <div className="flex items-center gap-2 text-amber-900 font-bold">
              <Clock className="h-4 w-4 text-amber-600 shrink-0" />
              <span>Mecanismo de Salvaguarda de 24 Horas:</span>
            </div>
            <ul className="space-y-1 text-amber-800 text-[11px] list-disc list-inside">
              <li>
                O backup consolidado é criado na coleção segura{' '}
                <code className="bg-amber-100 px-1 py-0.5 rounded text-[10px] font-mono">
                  exclusoes_empresa_backup
                </code>
                .
              </li>
              <li>
                Durante 24 horas, você poderá <strong>Restaurar</strong> os registros em 1 clique na
                aba <em>Exclusões & Backups</em>.
              </li>
              <li>
                Após as 24h, o cron automatizado purgará física e definitivamente todos os dados
                vinculados.
              </li>
            </ul>
          </div>

          {/* Campo de confirmação estrita */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-[#1A2333] block">
              Para confirmar, digite o <strong className="text-red-700">CNPJ</strong> (
              <span className="font-mono">{maskCnpj(empresa.cnpj)}</span>) ou a{' '}
              <strong className="text-red-700">Razão Social</strong> da empresa:
            </label>
            <Input
              value={confirmInput}
              onChange={(e) => setConfirmInput(e.target.value)}
              placeholder="Digite o CNPJ (com ou sem pontuação) ou a Razão Social..."
              className={`h-10 text-xs rounded-xl transition-colors ${
                inputInvalido
                  ? 'border-red-400 focus-visible:ring-red-500 bg-red-50/20'
                  : podeConfirmar
                    ? 'border-emerald-500 focus-visible:ring-emerald-500 bg-emerald-50/20'
                    : 'border-slate-300 focus-visible:ring-red-500'
              }`}
              autoFocus
            />
            {inputInvalido ? (
              <p className="text-[11px] text-red-600 font-medium">
                O texto digitado não corresponde ao CNPJ ou à Razão Social da empresa.
              </p>
            ) : podeConfirmar ? (
              <p className="text-[11px] text-emerald-600 font-medium">
                Identificação confirmada ({confirmouPorCnpj ? 'por CNPJ' : 'por Razão Social/Nome'}
                ). O botão de exclusão foi habilitado.
              </p>
            ) : (
              <p className="text-[11px] text-[#64748B]">
                Dica: você pode colar o CNPJ formatado ou apenas os números, ou escrever a Razão
                Social / Nome Fantasia sem se preocupar com maiúsculas/minúsculas ou acentos.
              </p>
            )}
          </div>
        </div>

        <DialogFooter className="border-t border-slate-100 bg-slate-50 p-4 gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            disabled={processando}
            onClick={() => onOpenChange(false)}
            className="text-xs rounded-xl"
          >
            Cancelar
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={!podeConfirmar || processando}
            onClick={handleConfirmarExclusao}
            className="text-xs rounded-xl bg-red-600 hover:bg-red-700 font-semibold gap-2 shadow-xs"
          >
            {processando ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Gerando Backup & Excluindo...</span>
              </>
            ) : (
              <>
                <Archive className="h-4 w-4" />
                <span>Confirmar Exclusão (Backup 24h)</span>
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
