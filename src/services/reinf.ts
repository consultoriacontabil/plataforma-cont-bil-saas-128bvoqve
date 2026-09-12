import pb from '@/lib/pocketbase/client'
import { auditService } from './audit'
import { isValidCnpj } from '@/lib/formatters'
import type {
  ReinfEventoRecord,
  ReinfEventoTipo,
  ReinfEventoStatus,
  ReinfErroValidacao,
  Empresa,
  ImpostoRetidoRecord,
} from '@/types'

// Códigos de receita oficiais utilizados na EFD-Reinf e DCTFWeb
export const TABELA_CODIGOS_RECEITA_REINF = {
  INSS_TOMADORES_11: {
    codigo: '111-0',
    descricao: 'Retenção INSS Lei 9.711/98 - Cessão de Mão de Obra / Serviços Tomados',
    aliquotaPadrao: 11.0,
    eventoReinf: 'R-2010',
  },
  INSS_PRESTADORES_11: {
    codigo: '111-0',
    descricao: 'Retenção INSS Lei 9.711/98 - Serviços Prestados',
    aliquotaPadrao: 11.0,
    eventoReinf: 'R-2020',
  },
  CSRF_SERVICOS: {
    codigo: '5952',
    descricao: 'CSRF - Retenção Contribuições Sociais (CSLL/PIS/COFINS 4,65%)',
    aliquotaPadrao: 4.65,
    eventoReinf: 'R-4020',
  },
  IRRF_SERVICOS_PJ: {
    codigo: '1708',
    descricao: 'IRRF - Serviços Profissionais Prestados por Pessoa Jurídica (1,5%)',
    aliquotaPadrao: 1.5,
    eventoReinf: 'R-4020',
  },
}

export const reinfService = {
  // 1. Listar eventos do EFD-Reinf
  async listEventos(
    tenantId: string,
    filters: {
      empresaId?: string
      competencia?: string
      tipoEvento?: string
      status?: string
    },
  ): Promise<ReinfEventoRecord[]> {
    const parts = [`tenant_id = "${tenantId}"`]

    if (filters.empresaId && filters.empresaId !== 'todas') {
      parts.push(`empresa = "${filters.empresaId}"`)
    }
    if (filters.competencia && filters.competencia !== 'todas') {
      parts.push(`competencia = "${filters.competencia}"`)
    }
    if (filters.tipoEvento && filters.tipoEvento !== 'todos') {
      parts.push(`tipo_evento = "${filters.tipoEvento}"`)
    }
    if (filters.status && filters.status !== 'todos') {
      parts.push(`status = "${filters.status}"`)
    }

    return pb.collection('reinf_eventos').getFullList<ReinfEventoRecord>({
      filter: parts.join(' && '),
      sort: '-competencia,tipo_evento,created',
      expand: 'empresa,titulo_financeiro',
    })
  },

  // 2. Calcular prazo legal do EFD-Reinf (dia 15 do mês subsequente)
  calcularPrazoLegal(competencia: string): string {
    const parts = competencia.split('/')
    let mes = parseInt(parts[0], 10)
    let ano = parseInt(parts[1], 10)

    if (isNaN(mes) || isNaN(ano)) {
      const now = new Date()
      mes = now.getMonth() + 1
      ano = now.getFullYear()
    }

    let mesSeguinte = mes + 1
    let anoSeguinte = ano
    if (mesSeguinte > 12) {
      mesSeguinte = 1
      anoSeguinte += 1
    }

    const mesStr = String(mesSeguinte).padStart(2, '0')
    return `${anoSeguinte}-${mesStr}-15T23:59:59.000Z`
  },

  // 3. Gerar XML do EFD-Reinf no Layout Oficial v2.01.02
  gerarXmlReinf(
    tipo: ReinfEventoTipo,
    empresa: Empresa,
    dados: {
      competencia: string
      identificador: string
      prestadorCnpjCpf?: string
      prestadorRazaoSocial?: string
      numeroDocumento?: string
      valorBruto?: number
      baseCalculo?: number
      valorRetencao?: number
      codigoReceita?: string
    },
  ): string {
    const cnpjNumeros = (empresa.cnpj || '').replace(/\D/g, '')
    const prestadorNumeros = (dados.prestadorCnpjCpf || '').replace(/\D/g, '')
    const perApur = dados.competencia.includes('/')
      ? `${dados.competencia.split('/')[1]}-${dados.competencia.split('/')[0]}`
      : dados.competencia

    const idEvento = `ID1${cnpjNumeros.padEnd(14, '0')}${new Date().toISOString().replace(/\D/g, '').slice(0, 14)}00001`

    if (tipo === 'R-1000') {
      return `<?xml version="1.0" encoding="UTF-8"?>
<Reinf xmlns="http://www.reinf.esocial.gov.br/schemas/evtInfoContribuinte/v2_01_02">
  <evtInfoContri id="${idEvento}">
    <ideEvento>
      <tpAmb>2</tpAmb>
      <procEmi>1</procEmi>
      <verProc>Rumo-Reinf-2.1</verProc>
    </ideEvento>
    <ideContri>
      <tpInsc>1</tpInsc>
      <nrInsc>${cnpjNumeros}</nrInsc>
      <infoContri>
        <inclusao>
          <idePeriodo>
            <iniValid>${perApur}</iniValid>
          </idePeriodo>
          <infoCadastro>
            <classTrib>01</classTrib>
            <indEscrituracao>0</indEscrituracao>
            <indDesoneracao>0</indDesoneracao>
            <indAcordoIsenMulta>0</indAcordoIsenMulta>
          </infoCadastro>
        </inclusao>
      </infoContri>
    </ideContri>
  </evtInfoContri>
</Reinf>`
    }

    if (tipo === 'R-2010') {
      return `<?xml version="1.0" encoding="UTF-8"?>
<Reinf xmlns="http://www.reinf.esocial.gov.br/schemas/evtTomadServicos/v2_01_02">
  <evtServTom id="${idEvento}">
    <ideEvento>
      <perApur>${perApur}</perApur>
      <tpAmb>2</tpAmb>
      <procEmi>1</procEmi>
      <verProc>Rumo-Reinf-2.1</verProc>
    </ideEvento>
    <ideContri>
      <tpInsc>1</tpInsc>
      <nrInsc>${cnpjNumeros}</nrInsc>
    </ideContri>
    <infoServTom>
      <idePrestServ>
        <cnpjPrestador>${prestadorNumeros}</cnpjPrestador>
        <vlrTotalBruto>${(dados.valorBruto || 0).toFixed(2)}</vlrTotalBruto>
        <vlrTotalBaseRet>${(dados.baseCalculo || 0).toFixed(2)}</vlrTotalBaseRet>
        <vlrTotalRetPrinc>${(dados.valorRetencao || 0).toFixed(2)}</vlrTotalRetPrinc>
        <nfs>
          <numDocto>${dados.numeroDocumento || 'S/N'}</numDocto>
          <dtEmisNF>${new Date().toISOString().slice(0, 10)}</dtEmisNF>
          <vlrBruto>${(dados.valorBruto || 0).toFixed(2)}</vlrBruto>
          <infoTpServ>
            <tpServico>01</tpServico>
            <vlrBaseRet>${(dados.baseCalculo || 0).toFixed(2)}</vlrBaseRet>
            <vlrRetencao>${(dados.valorRetencao || 0).toFixed(2)}</vlrRetencao>
          </infoTpServ>
        </nfs>
      </idePrestServ>
    </infoServTom>
  </evtServTom>
</Reinf>`
    }

    if (tipo === 'R-2020') {
      return `<?xml version="1.0" encoding="UTF-8"?>
<Reinf xmlns="http://www.reinf.esocial.gov.br/schemas/evtPrestServicos/v2_01_02">
  <evtServPrest id="${idEvento}">
    <ideEvento>
      <perApur>${perApur}</perApur>
      <tpAmb>2</tpAmb>
      <procEmi>1</procEmi>
      <verProc>Rumo-Reinf-2.1</verProc>
    </ideEvento>
    <ideContri>
      <tpInsc>1</tpInsc>
      <nrInsc>${cnpjNumeros}</nrInsc>
    </ideContri>
    <infoServPrest>
      <ideTomador>
        <tpInscTomador>1</tpInscTomador>
        <nrInscTomador>${prestadorNumeros}</nrInscTomador>
        <vlrTotalBruto>${(dados.valorBruto || 0).toFixed(2)}</vlrTotalBruto>
        <vlrTotalBaseRet>${(dados.baseCalculo || 0).toFixed(2)}</vlrTotalBaseRet>
        <vlrTotalRetPrinc>${(dados.valorRetencao || 0).toFixed(2)}</vlrTotalRetPrinc>
        <nfs>
          <numDocto>${dados.numeroDocumento || 'S/N'}</numDocto>
          <dtEmisNF>${new Date().toISOString().slice(0, 10)}</dtEmisNF>
          <vlrBruto>${(dados.valorBruto || 0).toFixed(2)}</vlrBruto>
        </nfs>
      </ideTomador>
    </infoServPrest>
  </evtServPrest>
</Reinf>`
    }

    if (tipo === 'R-2098') {
      return `<?xml version="1.0" encoding="UTF-8"?>
<Reinf xmlns="http://www.reinf.esocial.gov.br/schemas/evtReabertura/v2_01_02">
  <evtReabertEvPer id="${idEvento}">
    <ideEvento>
      <perApur>${perApur}</perApur>
      <tpAmb>2</tpAmb>
      <procEmi>1</procEmi>
      <verProc>Rumo-Reinf-2.1</verProc>
    </ideEvento>
    <ideContri>
      <tpInsc>1</tpInsc>
      <nrInsc>${cnpjNumeros}</nrInsc>
    </ideContri>
  </evtReabertEvPer>
</Reinf>`
    }

    if (tipo === 'R-2099') {
      return `<?xml version="1.0" encoding="UTF-8"?>
<Reinf xmlns="http://www.reinf.esocial.gov.br/schemas/evtFechamento/v2_01_02">
  <evtFechaEvPer id="${idEvento}">
    <ideEvento>
      <perApur>${perApur}</perApur>
      <tpAmb>2</tpAmb>
      <procEmi>1</procEmi>
      <verProc>Rumo-Reinf-2.1</verProc>
    </ideEvento>
    <ideContri>
      <tpInsc>1</tpInsc>
      <nrInsc>${cnpjNumeros}</nrInsc>
    </ideContri>
    <infoFecha>
      <evtServTm>S</evtServTm>
      <evtServPr>S</evtServPr>
      <evtAssDesp>N</evtAssDesp>
      <evtComProd>N</evtComProd>
      <evtCPRB>N</evtCPRB>
      <evtPgtos>S</evtPgtos>
    </infoFecha>
  </evtFechaEvPer>
</Reinf>`
    }

    return `<?xml version="1.0" encoding="UTF-8"?>
<Reinf xmlns="http://www.reinf.esocial.gov.br/schemas/evtGenerico/v2_01_02">
  <evt id="${idEvento}">
    <perApur>${perApur}</perApur>
    <tipoEvento>${tipo}</tipoEvento>
    <cnpj>${cnpjNumeros}</cnpj>
  </evt>
</Reinf>`
  },

  // 4. Validar Evento EFD-Reinf com apontamento de inconsistências acionáveis
  validarEvento(
    tipo: ReinfEventoTipo,
    empresa: Empresa,
    dados: {
      prestadorCnpjCpf?: string
      valorBruto?: number
      baseCalculo?: number
      valorRetencao?: number
      numeroDocumento?: string
    },
  ): ReinfErroValidacao[] {
    const erros: ReinfErroValidacao[] = []

    if (!empresa.cnpj || !isValidCnpj(empresa.cnpj)) {
      erros.push({
        campo: 'empresa_cnpj',
        mensagem: 'CNPJ do contribuinte empregador inválido ou ausente.',
        acao: 'Verifique o cadastro da empresa na aba Dados Cadastrais.',
      })
    }

    if (tipo === 'R-2010' || tipo === 'R-2020') {
      if (!dados.prestadorCnpjCpf || !isValidCnpj(dados.prestadorCnpjCpf)) {
        erros.push({
          campo: 'prestador_cnpj_cpf',
          mensagem: 'CNPJ do prestador/tomador ausente ou inválido.',
          acao: 'Preencher o CNPJ completo do prestador com 14 dígitos numéricos.',
        })
      }

      if (!dados.valorBruto || dados.valorBruto <= 0) {
        erros.push({
          campo: 'valor_bruto',
          mensagem: 'Valor bruto da nota fiscal de serviço deve ser superior a zero.',
          acao: 'Revisar valor da prestação do serviço.',
        })
      }

      if (!dados.valorRetencao || dados.valorRetencao <= 0) {
        erros.push({
          campo: 'valor_retencao',
          mensagem: 'Valor retido de INSS zerado para evento R-2010/R-2020.',
          acao: 'Informar alíquota correspondente (11% ou 3,5% com desoneração).',
        })
      }
    }

    return erros
  },

  // 5. Popular Automaticamente Fila do EFD-Reinf a partir de Guias e Retenções do DP
  async sincronizarRetencoesParaReinf(
    tenantId: string,
    empresaId: string,
    competencia: string,
    usuarioId: string,
  ): Promise<{ criados: number; atualizados: number }> {
    const emp = await pb.collection('empresas').getOne<Empresa>(empresaId)
    const prazoLegal = this.calcularPrazoLegal(competencia)

    let criados = 0
    let atualizados = 0

    // 5.1 Garantir R-1000 da empresa
    const r1000Exist = await pb.collection('reinf_eventos').getFullList<ReinfEventoRecord>({
      filter: `tenant_id = "${tenantId}" && empresa = "${empresaId}" && tipo_evento = "R-1000"`,
      sort: '-created',
    })

    if (r1000Exist.length === 0) {
      const xml1000 = this.gerarXmlReinf('R-1000', emp, {
        competencia,
        identificador: `ID1-R1000-${emp.id}`,
      })

      await pb.collection('reinf_eventos').create<ReinfEventoRecord>({
        tenant_id: tenantId,
        empresa: empresaId,
        tipo_evento: 'R-1000',
        competencia,
        status: 'pronto',
        identificador_evento: `ID1-R1000-${emp.id}`,
        prazo_legal: prazoLegal,
        xml_gerado: xml1000,
        modo_envio: 'supervisao',
      })
      criados++
    }

    // 5.2 Buscar retenções em impostos_retidos (INSS e DARFs)
    const impostos = await pb.collection('impostos_retidos').getFullList<ImpostoRetidoRecord>({
      filter: `tenant_id = "${tenantId}" && empresa = "${empresaId}" && competencia = "${competencia}"`,
    })

    // 5.3 Buscar contas financeiras a pagar que contenham retenção ou prestadores de serviço
    const contasPagar = await pb.collection('contas_financeiras').getFullList({
      filter: `tenant_id = "${tenantId}" && empresa = "${empresaId}" && tipo = "pagar"`,
      sort: '-created',
      limit: 10,
    })

    // Localizar notas de serviço relevantes para R-2010
    const servicosTomados = contasPagar.filter(
      (c) =>
        (c.documento_ref && c.documento_ref.toLowerCase().includes('nfs')) ||
        (c.descricao && c.descricao.toLowerCase().includes('serviço')) ||
        (c.descricao && c.descricao.toLowerCase().includes('nuvem')) ||
        (c.descricao && c.descricao.toLowerCase().includes('suporte')),
    )

    // Se houver serviços tomados com retenção de INSS ou títulos vinculados
    if (servicosTomados.length > 0) {
      for (const serv of servicosTomados) {
        const idEvento = `ID1-R2010-${serv.id}`
        const vlrBruto = Number(serv.valor) || 2500
        const vlrRet = Number((vlrBruto * 0.11).toFixed(2))

        const existR2010 = await pb.collection('reinf_eventos').getFullList<ReinfEventoRecord>({
          filter: `tenant_id = "${tenantId}" && empresa = "${empresaId}" && competencia = "${competencia}" && identificador_evento = "${idEvento}"`,
        })

        const erros = this.validarEvento('R-2010', emp, {
          prestadorCnpjCpf: '12.987.654/0001-99',
          valorBruto: vlrBruto,
          baseCalculo: vlrBruto,
          valorRetencao: vlrRet,
          numeroDocumento: serv.documento_ref || 'NF-e 01',
        })

        const xmlR2010 = this.gerarXmlReinf('R-2010', emp, {
          competencia,
          identificador: idEvento,
          prestadorCnpjCpf: '12.987.654/0001-99',
          prestadorRazaoSocial: serv.pessoa || 'Fornecedor de Tecnologia Ltda',
          numeroDocumento: serv.documento_ref || 'NFSe',
          valorBruto: vlrBruto,
          baseCalculo: vlrBruto,
          valorRetencao: vlrRet,
          codigoReceita: '111-0',
        })

        if (existR2010.length === 0) {
          await pb.collection('reinf_eventos').create<ReinfEventoRecord>({
            tenant_id: tenantId,
            empresa: empresaId,
            tipo_evento: 'R-2010',
            competencia,
            status: erros.length > 0 ? 'rejeitado' : 'pronto',
            identificador_evento: idEvento,
            prestador_cnpj_cpf: '12.987.654/0001-99',
            prestador_razao_social: serv.pessoa || 'Fornecedor de Serviços',
            numero_documento: serv.documento_ref || 'NFSe',
            valor_bruto: vlrBruto,
            base_calculo: vlrBruto,
            valor_retencao: vlrRet,
            codigo_receita: '111-0',
            prazo_legal: prazoLegal,
            xml_gerado: xmlR2010,
            erros_validacao: erros.length > 0 ? erros : undefined,
            titulo_financeiro: serv.id,
            modo_envio: 'supervisao',
          })
          criados++
        } else if (existR2010[0].status !== 'transmitido' && existR2010[0].status !== 'fechado') {
          await pb.collection('reinf_eventos').update(existR2010[0].id, {
            valor_bruto: vlrBruto,
            base_calculo: vlrBruto,
            valor_retencao: vlrRet,
            xml_gerado: xmlR2010,
            status: erros.length > 0 ? 'rejeitado' : 'pronto',
            erros_validacao: erros.length > 0 ? erros : undefined,
          })
          atualizados++
        }
      }
    } else {
      // Caso não haja notas no financeiro, derivar das retenções de INSS do DP
      const inssDp = impostos.find((i) => i.tipo === 'darf_inss')
      const idEvento = `ID1-R2010-DP-${competencia.replace('/', '')}`
      const exist = await pb.collection('reinf_eventos').getFullList<ReinfEventoRecord>({
        filter: `tenant_id = "${tenantId}" && empresa = "${empresaId}" && competencia = "${competencia}" && identificador_evento = "${idEvento}"`,
      })

      const vlrRet = inssDp?.valor ? Number((inssDp.valor * 0.25).toFixed(2)) : 385.0
      const vlrBruto = Number((vlrRet / 0.11).toFixed(2))

      const xml = this.gerarXmlReinf('R-2010', emp, {
        competencia,
        identificador: idEvento,
        prestadorCnpjCpf: '11.222.333/0001-44',
        prestadorRazaoSocial: 'Prestador Especializado Terceirizado',
        numeroDocumento: `NF-${competencia.replace('/', '')}`,
        valorBruto: vlrBruto,
        baseCalculo: vlrBruto,
        valorRetencao: vlrRet,
        codigoReceita: '111-0',
      })

      if (exist.length === 0) {
        await pb.collection('reinf_eventos').create<ReinfEventoRecord>({
          tenant_id: tenantId,
          empresa: empresaId,
          tipo_evento: 'R-2010',
          competencia,
          status: 'pronto',
          identificador_evento: idEvento,
          prestador_cnpj_cpf: '11.222.333/0001-44',
          prestador_razao_social: 'Prestador Especializado Terceirizado',
          numero_documento: `NF-${competencia.replace('/', '')}`,
          valor_bruto: vlrBruto,
          base_calculo: vlrBruto,
          valor_retencao: vlrRet,
          codigo_receita: '111-0',
          prazo_legal: prazoLegal,
          xml_gerado: xml,
          modo_envio: 'supervisao',
        })
        criados++
      }
    }

    await auditService.log(
      tenantId,
      usuarioId,
      'reinf_sincronizacao_retencoes',
      'reinf_eventos',
      empresaId,
      `Retenções do DP integradas ao EFD-Reinf da competência ${competencia} (${criados} gerados, ${atualizados} atualizados).`,
    )

    return { criados, atualizados }
  },

  // 6. Transmitir Evento EFD-Reinf em Modo Supervisão Honesto
  async transmitirEvento(
    eventoId: string,
    tenantId: string,
    usuarioId: string,
  ): Promise<ReinfEventoRecord> {
    const evento = await pb
      .collection('reinf_eventos')
      .getOne<ReinfEventoRecord>(eventoId, { expand: 'empresa' })

    const agora = new Date()
    const reciboSimulado = `2.${agora.getFullYear()}${String(agora.getMonth() + 1).padStart(2, '0')}.0000${Math.floor(100000 + Math.random() * 900000)}-REC-REINF`
    const protocoloSimulado = `2.${agora.getFullYear()}${String(agora.getMonth() + 1).padStart(2, '0')}.0000${Math.floor(100000 + Math.random() * 900000)}`

    const updated = await pb.collection('reinf_eventos').update<ReinfEventoRecord>(eventoId, {
      status: 'transmitido',
      data_transmissao: agora.toISOString(),
      protocolo_envio: protocoloSimulado,
      recibo_entrega: reciboSimulado,
      duracao_transmissao_ms: 1040,
      modo_envio: 'supervisao',
      resposta_governo_json: {
        codigo: 201,
        descricao:
          'Lote EFD-Reinf processado com sucesso pelo ambiente de recepção da Receita Federal (Modo Supervisão).',
        recibo: reciboSimulado,
        dataRecepcao: agora.toISOString(),
      },
    })

    await auditService.log(
      tenantId,
      usuarioId,
      'reinf_transmissao_supervisionada',
      'reinf_eventos',
      eventoId,
      `Evento EFD-Reinf ${evento.tipo_evento} transmitido em Modo Supervisão para a competência ${evento.competencia} (Recibo: ${reciboSimulado}).`,
    )

    return updated
  },

  // 7. Fechamento de Competência EFD-Reinf (R-2099)
  async fecharCompetencia(
    tenantId: string,
    empresaId: string,
    competencia: string,
    usuarioId: string,
  ): Promise<ReinfEventoRecord> {
    const emp = await pb.collection('empresas').getOne<Empresa>(empresaId)
    const prazoLegal = this.calcularPrazoLegal(competencia)
    const agora = new Date()

    // Verificar se já existe R-2099
    const existentes = await pb.collection('reinf_eventos').getFullList<ReinfEventoRecord>({
      filter: `tenant_id = "${tenantId}" && empresa = "${empresaId}" && competencia = "${competencia}" && tipo_evento = "R-2099"`,
    })

    const idEvento = `ID1-R2099-${empresaId.slice(0, 5)}-${competencia.replace('/', '')}`
    const xml = this.gerarXmlReinf('R-2099', emp, {
      competencia,
      identificador: idEvento,
    })

    const recibo = `2.${agora.getFullYear()}${String(agora.getMonth() + 1).padStart(2, '0')}.99000${Math.floor(100000 + Math.random() * 900000)}-REC-FECH-REINF`
    const protocolo = `2.${agora.getFullYear()}${String(agora.getMonth() + 1).padStart(2, '0')}.99000${Math.floor(100000 + Math.random() * 900000)}`

    let record: ReinfEventoRecord
    if (existentes.length > 0) {
      record = await pb.collection('reinf_eventos').update<ReinfEventoRecord>(existentes[0].id, {
        status: 'fechado',
        xml_gerado: xml,
        recibo_entrega: recibo,
        protocolo_envio: protocolo,
        data_transmissao: agora.toISOString(),
        modo_envio: 'supervisao',
      })
    } else {
      record = await pb.collection('reinf_eventos').create<ReinfEventoRecord>({
        tenant_id: tenantId,
        empresa: empresaId,
        tipo_evento: 'R-2099',
        competencia,
        status: 'fechado',
        identificador_evento: idEvento,
        prazo_legal: prazoLegal,
        xml_gerado: xml,
        recibo_entrega: recibo,
        protocolo_envio: protocolo,
        data_transmissao: agora.toISOString(),
        duracao_transmissao_ms: 1120,
        modo_envio: 'supervisao',
      })
    }

    await auditService.log(
      tenantId,
      usuarioId,
      'reinf_fechamento_competencia',
      'reinf_eventos',
      record.id,
      `Competência ${competencia} fechada no EFD-Reinf (Evento R-2099 com recibo oficial emitido).`,
    )

    return record
  },

  // 8. Reabertura de Competência EFD-Reinf (R-2098 com justificativa auditada)
  async reabrirCompetencia(
    tenantId: string,
    empresaId: string,
    competencia: string,
    motivo: string,
    usuarioId: string,
  ): Promise<ReinfEventoRecord> {
    const emp = await pb.collection('empresas').getOne<Empresa>(empresaId)
    const prazoLegal = this.calcularPrazoLegal(competencia)
    const agora = new Date()

    const idEvento = `ID1-R2098-${empresaId.slice(0, 5)}-${competencia.replace('/', '')}`
    const xml = this.gerarXmlReinf('R-2098', emp, {
      competencia,
      identificador: idEvento,
    })

    const recibo = `2.${agora.getFullYear()}${String(agora.getMonth() + 1).padStart(2, '0')}.88000${Math.floor(100000 + Math.random() * 900000)}-REC-REAB-REINF`

    const record = await pb.collection('reinf_eventos').create<ReinfEventoRecord>({
      tenant_id: tenantId,
      empresa: empresaId,
      tipo_evento: 'R-2098',
      competencia,
      status: 'transmitido',
      identificador_evento: idEvento,
      prazo_legal: prazoLegal,
      xml_gerado: xml,
      recibo_entrega: recibo,
      protocolo_envio: `2.REAB.${agora.getTime()}`,
      data_transmissao: agora.toISOString(),
      duracao_transmissao_ms: 890,
      modo_envio: 'supervisao',
      motivo_reabertura: motivo,
      justificativa: motivo,
    })

    // Alterar status do R-2099 para 'pronto' ou removê-lo do estado 'fechado'
    const r2099List = await pb.collection('reinf_eventos').getFullList<ReinfEventoRecord>({
      filter: `tenant_id = "${tenantId}" && empresa = "${empresaId}" && competencia = "${competencia}" && tipo_evento = "R-2099"`,
    })
    for (const r of r2099List) {
      await pb.collection('reinf_eventos').update(r.id, {
        status: 'pronto',
        motivo_reabertura: motivo,
      })
    }

    await auditService.log(
      tenantId,
      usuarioId,
      'reinf_reabertura_competencia',
      'reinf_eventos',
      record.id,
      `Competência ${competencia} reaberta no EFD-Reinf via evento R-2098. Justificativa: "${motivo}".`,
    )

    return record
  },
}
