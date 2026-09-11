import React, { useState, useEffect } from 'react'
import { Globe, CheckCircle2, ShieldCheck, Check } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import type { DadosConsultaPublicaCnpj } from '@/services/consultaCnpjPublico'
import type { Empresa } from '@/types'

interface ModalRevisaoCnpjPublicoProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  resultadoConsulta: DadosConsultaPublicaCnpj | null
  formAtual: Partial<Empresa>
  onAplicarDados: (dadosParaAplicar: Partial<Empresa>, badgeFonte: string) => void
}

interface CampoItemRevisao {
  chave: keyof Empresa | 'cnae' | 'natureza_juridica' | 'socios_qsa'
  rotulo: string
  valorAtual: string
  valorNovo: string
  selecionado: boolean
  categoria: 'cadastral' | 'endereco' | 'societario'
}

export function ModalRevisaoCnpjPublico({
  open,
  onOpenChange,
  resultadoConsulta,
  formAtual,
  onAplicarDados,
}: ModalRevisaoCnpjPublicoProps) {
  const d = resultadoConsulta?.dados

  // Montar lista de campos com valores atuais vs valores públicos
  const [campos, setCampos] = useState<CampoItemRevisao[]>([])

  // Atualizar campos sempre que resultadoConsulta mudar
  useEffect(() => {
    if (!d) {
      setCampos([])
      return
    }

    const lista: CampoItemRevisao[] = [
      {
        chave: 'razao_social',
        rotulo: 'Razão Social',
        valorAtual: formAtual.razao_social || '',
        valorNovo: d.razao_social || '',
        selecionado: true,
        categoria: 'cadastral',
      },
      {
        chave: 'nome_fantasia',
        rotulo: 'Nome Fantasia',
        valorAtual: formAtual.nome_fantasia || '',
        valorNovo: d.nome_fantasia || '',
        selecionado: true,
        categoria: 'cadastral',
      },
      {
        chave: 'data_abertura',
        rotulo: 'Data de Abertura',
        valorAtual: formAtual.data_abertura ? formAtual.data_abertura.split('T')[0] : '',
        valorNovo: d.data_abertura || '',
        selecionado: true,
        categoria: 'cadastral',
      },
      {
        chave: 'regime_tributario',
        rotulo: 'Regime Tributário Sugerido',
        valorAtual: formAtual.regime_tributario || '',
        valorNovo: d.regime_tributario_sugerido || '',
        selecionado: Boolean(d.regime_tributario_sugerido),
        categoria: 'cadastral',
      },
      {
        chave: 'porte',
        rotulo: 'Porte da Empresa',
        valorAtual: formAtual.porte || '',
        valorNovo: d.porte_sugerido || '',
        selecionado: Boolean(d.porte_sugerido),
        categoria: 'cadastral',
      },
      {
        chave: 'cep',
        rotulo: 'CEP',
        valorAtual: formAtual.cep || '',
        valorNovo: d.cep || '',
        selecionado: true,
        categoria: 'endereco',
      },
      {
        chave: 'logradouro',
        rotulo: 'Logradouro',
        valorAtual: formAtual.logradouro || '',
        valorNovo: d.logradouro || '',
        selecionado: true,
        categoria: 'endereco',
      },
      {
        chave: 'numero',
        rotulo: 'Número',
        valorAtual: formAtual.numero || '',
        valorNovo: d.numero || '',
        selecionado: true,
        categoria: 'endereco',
      },
      {
        chave: 'complemento',
        rotulo: 'Complemento',
        valorAtual: formAtual.complemento || '',
        valorNovo: d.complemento || '',
        selecionado: Boolean(d.complemento),
        categoria: 'endereco',
      },
      {
        chave: 'bairro',
        rotulo: 'Bairro',
        valorAtual: formAtual.bairro || '',
        valorNovo: d.bairro || '',
        selecionado: true,
        categoria: 'endereco',
      },
      {
        chave: 'cidade',
        rotulo: 'Cidade',
        valorAtual: formAtual.cidade || '',
        valorNovo: d.cidade || '',
        selecionado: true,
        categoria: 'endereco',
      },
      {
        chave: 'uf',
        rotulo: 'UF',
        valorAtual: formAtual.uf || '',
        valorNovo: d.uf || '',
        selecionado: true,
        categoria: 'endereco',
      },
      {
        chave: 'email',
        rotulo: 'E-mail Cadastral',
        valorAtual: formAtual.email || '',
        valorNovo: d.email || '',
        selecionado: Boolean(d.email),
        categoria: 'cadastral',
      },
      {
        chave: 'telefone',
        rotulo: 'Telefone Principal',
        valorAtual: formAtual.telefone || '',
        valorNovo: d.telefone || '',
        selecionado: Boolean(d.telefone),
        categoria: 'cadastral',
      },
    ]

    // Informações complementares se existirem
    if (d.cnae_principal_codigo || d.cnae_principal_descricao) {
      lista.push({
        chave: 'cnae',
        rotulo: 'CNAE Principal',
        valorAtual: '',
        valorNovo: `${d.cnae_principal_codigo || ''} - ${d.cnae_principal_descricao || ''}`.trim(),
        selecionado: true,
        categoria: 'cadastral',
      })
    }

    if (d.natureza_juridica) {
      lista.push({
        chave: 'natureza_juridica',
        rotulo: 'Natureza Jurídica',
        valorAtual: '',
        valorNovo: d.natureza_juridica,
        selecionado: true,
        categoria: 'cadastral',
      })
    }

    if (d.socios_qsa && d.socios_qsa.length > 0) {
      const sociosTexto = d.socios_qsa.map((s) => `${s.nome} (${s.qualificacao})`).join('; ')
      lista.push({
        chave: 'socios_qsa',
        rotulo: 'Quadro de Sócios e Administradores (QSA)',
        valorAtual: '',
        valorNovo: sociosTexto,
        selecionado: true,
        categoria: 'societario',
      })
    }

    setCampos(lista.filter((c) => c.valorNovo && c.valorNovo.trim().length > 0))
  }, [d, formAtual])

  if (!resultadoConsulta || !resultadoConsulta.dados) return null

  const toggleCampo = (chave: CampoItemRevisao['chave']) => {
    setCampos((prev) =>
      prev.map((c) => (c.chave === chave ? { ...c, selecionado: !c.selecionado } : c)),
    )
  }

  const handleSelecionarTodos = () => {
    setCampos((prev) => prev.map((c) => ({ ...c, selecionado: true })))
  }

  const handleDesmarcarTodos = () => {
    setCampos((prev) => prev.map((c) => ({ ...c, selecionado: false })))
  }

  const handleConfirmar = () => {
    const dadosParaAplicar: Partial<Empresa> = {}
    let observacoesAdicionais = ''

    campos.forEach((c) => {
      if (c.selecionado) {
        if (c.chave === 'cnae') {
          observacoesAdicionais += `\nCNAE Principal: ${c.valorNovo}`
        } else if (c.chave === 'natureza_juridica') {
          observacoesAdicionais += `\nNatureza Jurídica: ${c.valorNovo}`
        } else if (c.chave === 'socios_qsa') {
          observacoesAdicionais += `\nQuadro Societário: ${c.valorNovo}`
        } else {
          ;(dadosParaAplicar as Record<string, unknown>)[c.chave] = c.valorNovo
        }
      }
    })

    if (observacoesAdicionais) {
      const obsBase = formAtual.observacoes || ''
      const badgeLinha = `[Consulta Pública]: ${resultadoConsulta.fonte} em ${resultadoConsulta.dataConsulta}`
      dadosParaAplicar.observacoes = obsBase
        ? `${obsBase}\n\n${badgeLinha}${observacoesAdicionais}`
        : `${badgeLinha}${observacoesAdicionais}`
    }

    const badgeTexto = `Fonte: ${resultadoConsulta.fonte} em ${resultadoConsulta.dataConsulta}`
    onAplicarDados(dadosParaAplicar, badgeTexto)
    onOpenChange(false)
  }

  const totalSelecionados = campos.filter((c) => c.selecionado).length

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0 gap-0 rounded-2xl overflow-hidden border-[#E2E8F0]">
        <DialogHeader className="p-5 pb-4 border-b border-slate-100 bg-[#F8FAFC]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-teal-50 border border-teal-200 text-[#0FA3A3] flex items-center justify-center shrink-0">
                <Globe className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-[#1A2333]">
                  Revisão dos Dados Públicos do CNPJ
                </DialogTitle>
                <DialogDescription className="text-xs text-[#64748B]">
                  Verifique os dados oficiais retornados antes de aplicar ao cadastro da empresa
                </DialogDescription>
              </div>
            </div>

            <Badge
              variant="outline"
              className="border-emerald-200 bg-emerald-50 text-emerald-800 text-[11px] font-semibold gap-1 shrink-0"
            >
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
              <span>{resultadoConsulta.fonte}</span>
            </Badge>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className="flex items-center justify-between py-1 border-b border-slate-100 pb-2">
            <div className="flex items-center gap-2">
              <span className="text-xs text-[#64748B]">
                {totalSelecionados} de {campos.length} campos selecionados para preenchimento
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleSelecionarTodos}
                className="text-[11px] h-7 text-[#0FA3A3] hover:text-[#0C8585] p-1.5"
              >
                Selecionar Todos
              </Button>
              <span className="text-slate-300">|</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleDesmarcarTodos}
                className="text-[11px] h-7 text-slate-500 hover:text-slate-700 p-1.5"
              >
                Desmarcar Todos
              </Button>
            </div>
          </div>

          {/* Lista de campos com comparação */}
          <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
            {campos.map((c) => {
              const temAlteracao = c.valorAtual && c.valorAtual !== c.valorNovo

              return (
                <div
                  key={c.chave}
                  onClick={() => toggleCampo(c.chave)}
                  className={`p-3 rounded-xl border transition-all cursor-pointer flex items-start gap-3 ${
                    c.selecionado
                      ? 'bg-white border-teal-200 shadow-2xs'
                      : 'bg-slate-50/60 border-slate-200 opacity-60'
                  }`}
                >
                  <Checkbox
                    checked={c.selecionado}
                    onCheckedChange={() => toggleCampo(c.chave)}
                    className="mt-0.5"
                  />

                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[#1A2333]">{c.rotulo}</span>
                      {temAlteracao && (
                        <Badge
                          variant="outline"
                          className="border-amber-300 bg-amber-50 text-amber-800 text-[10px]"
                        >
                          Irá substituir valor atual
                        </Badge>
                      )}
                    </div>

                    <div className="text-xs">
                      <span className="font-semibold text-emerald-800 bg-emerald-50/80 px-2 py-0.5 rounded-md inline-block max-w-full truncate">
                        {c.valorNovo}
                      </span>
                    </div>

                    {temAlteracao && (
                      <p className="text-[11px] text-slate-400 line-through truncate">
                        Valor anterior: {c.valorAtual}
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-[11px] text-[#64748B] flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-[#0FA3A3] shrink-0" />
            <span>
              Nenhum dado é gravado no banco de dados imediatamente: os valores serão transferidos
              para o formulário para você revisar e salvar quando estiver pronto.
            </span>
          </div>
        </div>

        <DialogFooter className="p-4 border-t border-slate-100 bg-[#F8FAFC] flex flex-col sm:flex-row items-center justify-between gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="text-xs h-9 rounded-xl border-[#E2E8F0]"
          >
            Cancelar
          </Button>

          <Button
            type="button"
            onClick={handleConfirmar}
            disabled={totalSelecionados === 0}
            className="gap-2 rounded-xl bg-[#0FA3A3] hover:bg-[#0C8585] text-white font-semibold text-xs h-9 px-5 shadow-xs"
          >
            <Check className="h-4 w-4" />
            <span>Aplicar {totalSelecionados} Campo(s) Selecionado(s)</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
