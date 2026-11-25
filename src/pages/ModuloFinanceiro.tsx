import MakroZonaModuloPlaceholder, {
  FASES_FINANCEIRO,
} from '@/components/MakroZonaModuloPlaceholder'

export default function ModuloFinanceiroPage() {
  return (
    <MakroZonaModuloPlaceholder
      titulo="Financeiro"
      subtitulo="Financeiro por empresa e competência — contas a pagar/receber, conciliação, cobranças e relatórios gerenciais."
      nomeModulo="Financeiro"
      descricaoFatia="As grades operacionais do módulo Financeiro (contas a pagar/receber, conciliação, cobranças, fluxo de caixa) serão conectadas nas próximas fatias da adaptação Makro — as páginas Financeiro, Fluxo de Caixa e Cobranças continuam disponíveis e todas as funcionalidades existentes são mantidas."
      fases={FASES_FINANCEIRO}
    />
  )
}
