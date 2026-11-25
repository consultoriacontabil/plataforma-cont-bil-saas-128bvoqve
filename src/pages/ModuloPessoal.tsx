import MakroZonaModuloPlaceholder, { FASES_PESSOAL } from '@/components/MakroZonaModuloPlaceholder'

export default function ModuloPessoalPage() {
  return (
    <MakroZonaModuloPlaceholder
      titulo="Pessoal"
      subtitulo="Departamento pessoal por empresa e competência — folha, admissões, férias, rescisões e obrigações do eSocial."
      nomeModulo="Pessoal"
      descricaoFatia="As grades operacionais do módulo Pessoal (folha, admissões, férias, rescisões, eSocial) serão conectadas nas próximas fatias da adaptação Makro — o módulo atual do Departamento Pessoal continua disponível e todas as funcionalidades existentes são mantidas."
      fases={FASES_PESSOAL}
    />
  )
}
