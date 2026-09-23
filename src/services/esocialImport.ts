import pb from '@/lib/pocketbase/client'
import { isValidCpf } from '@/lib/formatters'
import { auditService } from '@/services/audit'
import type {
  Funcionario,
  FuncionarioTipo,
  FuncionarioStatus,
  GrauInstrucaoEsocial,
  RacaCorEsocial,
  EstadoCivilEsocial,
  Empresa,
} from '@/types'

export interface ColaboradorImportItem {
  id_temp: string
  nome_completo: string
  cpf: string
  cargo: string
  salario: number
  data_admissao: string
  tipo: FuncionarioTipo
  status: FuncionarioStatus
  centro_custo?: string
  cbo?: string
  nis_pis?: string
  ctps_numero?: string
  ctps_serie?: string
  ctps_uf?: string
  grau_instrucao?: GrauInstrucaoEsocial
  raca_cor?: RacaCorEsocial
  estado_civil?: EstadoCivilEsocial
  sexo?: 'M' | 'F'
  data_nascimento?: string
  nome_mae?: string
  pcd?: boolean
  tipo_deficiencia?: string
  dependentes_irrf?: number
  matricula_esocial?: string
  // Dados de diagnóstico/validação
  origem: 'xml_s2200' | 'xml_s2199' | 'csv' | 'json' | 'supervisao_esocial'
  status_validacao: 'valido' | 'duplicado' | 'erro'
  erros: string[]
  avisos: string[]
  acao_duplicidade?: 'atualizar' | 'pular'
  funcionario_existente_id?: string
}

export type RegraDuplicidade = 'atualizar' | 'pular'

export interface PreviaImportacaoColaboradores {
  itens: ColaboradorImportItem[]
  total: number
  validos: number
  duplicados: number
  erros: number
}

export interface ExecutarImportacaoResultado {
  sucesso: boolean
  totalProcessado: number
  criados: number
  atualizados: number
  ignorados: number
  falhas: { nome: string; cpf: string; motivo: string }[]
}

// Normaliza números de CPF
function cleanCpf(cpf: string): string {
  return (cpf || '').replace(/\D/g, '')
}

// Converte valores monetários
function parseSalario(val: unknown): number {
  if (typeof val === 'number') return isNaN(val) ? 0 : val
  if (!val) return 0
  const str = String(val).trim().replace('R$', '').trim()
  if (str.includes(',') && str.includes('.')) {
    // Ex: 3.500,50
    return parseFloat(str.replace(/\./g, '').replace(',', '.')) || 0
  }
  if (str.includes(',')) {
    return parseFloat(str.replace(',', '.')) || 0
  }
  return parseFloat(str) || 0
}

// Normaliza datas para ISO YYYY-MM-DD
function parseData(val: unknown): string {
  if (!val) return ''
  const str = String(val).trim()
  // DD/MM/AAAA
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(str)) {
    const [d, m, y] = str.split('/')
    return `${y}-${m}-${d}`
  }
  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    return str.slice(0, 10)
  }
  return str
}

// Normaliza grau de instrução
function parseGrauInstrucao(val: unknown): GrauInstrucaoEsocial | undefined {
  if (!val) return undefined
  const s = String(val).toLowerCase().trim()
  if (s.includes('superior') && s.includes('incomp')) return 'superior_incompleto'
  if (s.includes('superior') || s === '09' || s === '9') return 'superior_completo'
  if (s.includes('medio') && s.includes('incomp')) return 'medio_incompleto'
  if (s.includes('medio') || s === '07' || s === '7') return 'medio_completo'
  if (s.includes('fundamental') && s.includes('incomp')) return 'fundamental_incompleto'
  if (s.includes('fundamental')) return 'fundamental_completo'
  if (s.includes('pos') || s.includes('especial')) return 'pos_graduacao'
  if (s.includes('mestrado')) return 'mestrado'
  if (s.includes('doutorado')) return 'doutorado'
  return undefined
}

// Normaliza raça/cor
function parseRacaCor(val: unknown): RacaCorEsocial | undefined {
  if (!val) return undefined
  const s = String(val).toLowerCase().trim()
  if (s.includes('branc') || s === '1') return 'branca'
  if (s.includes('pret') || s === '2') return 'preta'
  if (s.includes('pard') || s === '3') return 'parda'
  if (s.includes('amarel') || s === '4') return 'amarela'
  if (s.includes('indigen') || s === '5') return 'indigena'
  return 'nao_informado'
}

// Normaliza estado civil
function parseEstadoCivil(val: unknown): EstadoCivilEsocial | undefined {
  if (!val) return undefined
  const s = String(val).toLowerCase().trim()
  if (s.includes('solteir') || s === '1') return 'solteiro'
  if (s.includes('casad') || s === '2') return 'casado'
  if (s.includes('divorc') || s === '3') return 'divorciado'
  if (s.includes('viuv') || s === '4') return 'viuvo'
  if (s.includes('uniao') || s === '5') return 'uniao_estavel'
  return 'outro'
}

/**
 * Parser de nós XML utilizando DOMParser nativo do navegador
 */
function getXmlText(parent: Element | Document, tag: string): string {
  const el = parent.getElementsByTagName(tag)[0]
  return el ? el.textContent?.trim() || '' : ''
}

export const esocialImportService = {
  /**
   * Faz o parse de arquivo XML do e-Social (eventos S-2200, S-2199 ou S-2300)
   */
  parseXmlEsocial(xmlContent: string): ColaboradorImportItem[] {
    const itens: ColaboradorImportItem[] = []
    const parser = new DOMParser()
    const xmlDoc = parser.parseFromString(xmlContent, 'application/xml')

    // Verificar se houve erro no parse
    const parseError = xmlDoc.getElementsByTagName('parsererror')[0]
    if (parseError) {
      throw new Error(`Arquivo XML com estrutura inválida: ${parseError.textContent || ''}`)
    }

    // Suporta múltiplos eventos no mesmo arquivo ou evento único S-2200 / S-2199
    const evtAdmis = xmlDoc.getElementsByTagName('evtAdmissao')
    const evtSemVinculos = xmlDoc.getElementsByTagName('evtTSVInicio') // S-2300 (estágio / pró-labore)
    const evtCadIniciais = xmlDoc.getElementsByTagName('evtCadInicial') // S-2199 / S-2200 legado

    const elementsToProcess: { el: Element; tipoEvt: 'xml_s2200' | 'xml_s2199' }[] = []

    for (let i = 0; i < evtAdmis.length; i++) {
      elementsToProcess.push({ el: evtAdmis[i], tipoEvt: 'xml_s2200' })
    }
    for (let i = 0; i < evtCadIniciais.length; i++) {
      elementsToProcess.push({ el: evtCadIniciais[i], tipoEvt: 'xml_s2199' })
    }
    for (let i = 0; i < evtSemVinculos.length; i++) {
      elementsToProcess.push({ el: evtSemVinculos[i], tipoEvt: 'xml_s2200' })
    }

    // Se a raiz for diretamente o elemento eSocial com evtAdmissao ou similar
    if (elementsToProcess.length === 0) {
      // Tentar pegar nós genéricos trabalhador e vinculo
      const trabalhadorEl = xmlDoc.getElementsByTagName('trabalhador')[0]
      if (trabalhadorEl) {
        elementsToProcess.push({ el: xmlDoc.documentElement, tipoEvt: 'xml_s2200' })
      }
    }

    elementsToProcess.forEach(({ el, tipoEvt }, idx) => {
      const trab = el.getElementsByTagName('trabalhador')[0] || el
      const vinc = el.getElementsByTagName('vinculo')[0] || el
      const infoCeletista = el.getElementsByTagName('infoCeletista')[0]
      const infoContrato = el.getElementsByTagName('infoContrato')[0]
      const remun = el.getElementsByTagName('remuneracao')[0]

      const cpfRaw = getXmlText(trab, 'cpfTrab')
      const nomeCompleto = getXmlText(trab, 'nmTrab')
      const sexoRaw = getXmlText(trab, 'sexo').toUpperCase()
      const sexo: 'M' | 'F' | undefined = sexoRaw === 'M' || sexoRaw === 'F' ? sexoRaw : undefined
      const racaCor = parseRacaCor(getXmlText(trab, 'racaCor'))
      const estCiv = parseEstadoCivil(getXmlText(trab, 'estCiv'))
      const grauInstr = parseGrauInstrucao(getXmlText(trab, 'grauInstr'))
      const dtNascto = parseData(getXmlText(trab, 'dtNascto'))
      const nmMae = getXmlText(trab, 'nmMae')
      const nisPis = getXmlText(trab, 'nisTrab')

      const matricula = getXmlText(vinc, 'matricula')
      const dtAdm = parseData(
        getXmlText(infoCeletista || vinc, 'dtAdm') || getXmlText(vinc, 'dtInicio'),
      )
      const cbo = getXmlText(infoContrato || vinc, 'codCargo') || getXmlText(vinc, 'codCBO')
      const cargo =
        getXmlText(infoContrato || vinc, 'nmCargo') || (cbo ? `Cargo CBO ${cbo}` : 'Colaborador')
      const salVal = parseSalario(getXmlText(remun || vinc, 'vrSalFx'))

      // Dependentes IRRF
      const dependentes = el.getElementsByTagName('dependente')
      let countDep = 0
      for (let d = 0; d < dependentes.length; d++) {
        const depIRRF = getXmlText(dependentes[d], 'depIRRF')
        if (depIRRF === 'S' || depIRRF === '1' || depIRRF === 'true') {
          countDep++
        }
      }

      // CTPS se disponível
      const ctpsNumero = getXmlText(trab, 'nrCtps')
      const ctpsSerie = getXmlText(trab, 'serieCtps')
      const ctpsUf = getXmlText(trab, 'ufCtps')

      itens.push({
        id_temp: `xml-${idx + 1}-${Date.now()}`,
        nome_completo: nomeCompleto,
        cpf: cleanCpf(cpfRaw),
        cargo: cargo || 'Colaborador',
        salario: salVal,
        data_admissao: dtAdm,
        tipo: 'clt',
        status: 'ativo',
        cbo: cbo || undefined,
        nis_pis: cleanCpf(nisPis) || undefined,
        ctps_numero: ctpsNumero || undefined,
        ctps_serie: ctpsSerie || undefined,
        ctps_uf: ctpsUf || undefined,
        grau_instrucao: grauInstr,
        raca_cor: racaCor,
        estado_civil: estCiv,
        sexo,
        data_nascimento: dtNascto || undefined,
        nome_mae: nmMae || undefined,
        dependentes_irrf: countDep,
        matricula_esocial: matricula || undefined,
        origem: tipoEvt,
        status_validacao: 'valido',
        erros: [],
        avisos: [],
      })
    })

    return itens
  },

  /**
   * Faz o parse de arquivo JSON exportado de sistemas de folha ou e-Social
   */
  parseJsonText(jsonContent: string): ColaboradorImportItem[] {
    const raw = JSON.parse(jsonContent)
    const list: Record<string, unknown>[] = Array.isArray(raw)
      ? raw
      : Array.isArray(raw.colaboradores)
        ? raw.colaboradores
        : Array.isArray(raw.funcionarios)
          ? raw.funcionarios
          : Array.isArray(raw.trabalhadores)
            ? raw.trabalhadores
            : [raw]

    return list.map((item, idx) => {
      const cpfRaw = String(item.cpf || item.cpfTrab || item.documento || '')
      const nome = String(
        item.nome || item.nome_completo || item.nmTrab || item.nomeCompleto || '',
      ).trim()
      const cargo = String(item.cargo || item.nmCargo || item.funcao || 'Colaborador').trim()
      const salario = parseSalario(item.salario || item.salario_base || item.vrSalFx)
      const dataAdm = parseData(item.data_admissao || item.dtAdm || item.admissao || '')
      const tipoRaw = String(item.tipo || 'clt').toLowerCase()
      const tipo: FuncionarioTipo =
        tipoRaw === 'pj' ? 'pj' : tipoRaw === 'estagio' ? 'estagio' : 'clt'

      return {
        id_temp: `json-${idx + 1}-${Date.now()}`,
        nome_completo: nome,
        cpf: cleanCpf(cpfRaw),
        cargo,
        salario,
        data_admissao: dataAdm,
        tipo,
        status: (item.status as FuncionarioStatus) || 'ativo',
        centro_custo: item.centro_custo ? String(item.centro_custo) : undefined,
        cbo: item.cbo ? String(item.cbo).replace(/\D/g, '') : undefined,
        nis_pis: item.nis_pis ? cleanCpf(String(item.nis_pis)) : undefined,
        ctps_numero: item.ctps_numero ? String(item.ctps_numero) : undefined,
        ctps_serie: item.ctps_serie ? String(item.ctps_serie) : undefined,
        ctps_uf: item.ctps_uf ? String(item.ctps_uf) : undefined,
        grau_instrucao: parseGrauInstrucao(item.grau_instrucao),
        raca_cor: parseRacaCor(item.raca_cor),
        estado_civil: parseEstadoCivil(item.estado_civil),
        sexo:
          String(item.sexo).toUpperCase() === 'F'
            ? 'F'
            : String(item.sexo).toUpperCase() === 'M'
              ? 'M'
              : undefined,
        data_nascimento: parseData(item.data_nascimento || item.dtNascto) || undefined,
        nome_mae: item.nome_mae ? String(item.nome_mae).trim() : undefined,
        dependentes_irrf: parseInt(String(item.dependentes_irrf || item.dependentes || 0), 10) || 0,
        matricula_esocial: item.matricula_esocial ? String(item.matricula_esocial) : undefined,
        origem: 'json',
        status_validacao: 'valido',
        erros: [],
        avisos: [],
      }
    })
  },

  /**
   * Faz o parse de arquivo CSV/TSV
   */
  parseCsvColaboradores(csvText: string): ColaboradorImportItem[] {
    // Normalização de delimitador e linhas
    const text = csvText.charCodeAt(0) === 0xfeff ? csvText.slice(1) : csvText
    const lineBreaksRegex = /\r\n|\n|\r/
    const rawLines = text.split(lineBreaksRegex).filter((l) => l.trim().length > 0)

    if (rawLines.length === 0) return []

    const firstLine = rawLines[0]
    const countSemi = (firstLine.match(/;/g) || []).length
    const countComma = (firstLine.match(/,/g) || []).length
    const countTab = (firstLine.match(/\t/g) || []).length

    let delimiter = ';'
    if (countTab > countSemi && countTab > countComma) delimiter = '\t'
    else if (countComma > countSemi) delimiter = ','

    const parseLine = (line: string): string[] => {
      const result: string[] = []
      let cur = ''
      let insideQuotes = false
      for (let i = 0; i < line.length; i++) {
        const char = line[i]
        if (char === '"') {
          if (insideQuotes && line[i + 1] === '"') {
            cur += '"'
            i++
          } else {
            insideQuotes = !insideQuotes
          }
        } else if (char === delimiter && !insideQuotes) {
          result.push(cur.trim())
          cur = ''
        } else {
          cur += char
        }
      }
      result.push(cur.trim())
      return result
    }

    const headers = parseLine(rawLines[0]).map((h) =>
      h
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]/g, '_')
        .replace(/^_+|_+$/g, ''),
    )

    const itens: ColaboradorImportItem[] = []

    for (let i = 1; i < rawLines.length; i++) {
      const cols = parseLine(rawLines[i])
      if (!cols.some((c) => c.length > 0)) continue

      const rowMap: Record<string, string> = {}
      headers.forEach((h, idx) => {
        if (cols[idx] !== undefined) {
          rowMap[h] = cols[idx].replace(/^["']|["']$/g, '').trim()
        }
      })

      // Encontrar campos por sinônimos
      const findVal = (keys: string[]): string => {
        for (const k of keys) {
          if (rowMap[k]) return rowMap[k]
          // Checagem parcial
          const matched = Object.keys(rowMap).find((h) => h.includes(k))
          if (matched && rowMap[matched]) return rowMap[matched]
        }
        return ''
      }

      const cpfVal = findVal(['cpf', 'nr_cpf', 'cpftrab', 'documento'])
      const nomeVal = findVal(['nome', 'nome_completo', 'funcionario', 'colaborador', 'nmtrab'])
      const cargoVal = findVal(['cargo', 'funcao', 'ocupacao', 'nmcargo']) || 'Colaborador'
      const salarioVal = findVal(['salario', 'salario_base', 'remuneracao', 'vrsalfx'])
      const admissaoVal = findVal(['data_admissao', 'admissao', 'dt_adm', 'dtadm', 'data_inicio'])
      const cboVal = findVal(['cbo', 'cod_cbo', 'codcargo', 'ocupacao_cbo'])
      const pisVal = findVal(['pis', 'nis', 'nis_pis', 'pasep', 'nistrab'])
      const matriculaVal = findVal(['matricula', 'matricula_esocial', 'matr'])
      const tipoVal = findVal(['tipo', 'vinculo', 'regime']).toLowerCase()
      const tipo: FuncionarioTipo = tipoVal.includes('pj')
        ? 'pj'
        : tipoVal.includes('estag')
          ? 'estagio'
          : 'clt'

      itens.push({
        id_temp: `csv-${i}-${Date.now()}`,
        nome_completo: nomeVal,
        cpf: cleanCpf(cpfVal),
        cargo: cargoVal,
        salario: parseSalario(salarioVal),
        data_admissao: parseData(admissaoVal),
        tipo,
        status: 'ativo',
        cbo: cboVal ? cboVal.replace(/\D/g, '') : undefined,
        nis_pis: pisVal ? cleanCpf(pisVal) : undefined,
        matricula_esocial: matriculaVal || undefined,
        origem: 'csv',
        status_validacao: 'valido',
        erros: [],
        avisos: [],
      })
    }

    return itens
  },

  /**
   * Valida lista de colaboradores importados contra o banco de dados existente e regras CLT/e-Social
   */
  async validarListaColaboradores(params: {
    tenantId: string
    empresaId: string
    itens: ColaboradorImportItem[]
    regraPadraoDuplicidade?: RegraDuplicidade
  }): Promise<PreviaImportacaoColaboradores> {
    const { tenantId, empresaId, itens, regraPadraoDuplicidade = 'atualizar' } = params

    // 1. Buscar todos os colaboradores existentes na empresa alvo
    const existentes = await pb.collection('funcionarios').getFullList<Funcionario>({
      filter: `tenant_id = "${tenantId}" && empresa = "${empresaId}"`,
    })

    const mapaExistentesPorCpf = new Map<string, Funcionario>()
    existentes.forEach((func) => {
      const c = cleanCpf(func.cpf)
      if (c) mapaExistentesPorCpf.set(c, func)
    })

    // Conjunto para detectar duplicidade interna no arquivo
    const cpfsVistosNoArquivo = new Set<string>()

    let validosCount = 0
    let duplicadosCount = 0
    let errosCount = 0

    const itensValidados = itens.map((item) => {
      const erros: string[] = []
      const avisos: string[] = []
      let statusValidacao: 'valido' | 'duplicado' | 'erro' = 'valido'
      let funcionarioExistenteId: string | undefined = undefined

      // Validação de Nome
      if (!item.nome_completo || item.nome_completo.trim().length < 3) {
        erros.push('Nome completo do colaborador não informado ou muito curto.')
      }

      // Validação de CPF
      const cpfLimpo = cleanCpf(item.cpf)
      if (!cpfLimpo) {
        erros.push('CPF ausente.')
      } else if (cpfLimpo.length !== 11) {
        erros.push(`CPF incompleto (${cpfLimpo.length} dígitos em vez de 11).`)
      } else if (!isValidCpf(cpfLimpo)) {
        erros.push('CPF inválido (dígitos verificadores incorretos).')
      }

      // Validação de Salário
      if (!item.salario || item.salario <= 0) {
        avisos.push('Salário base ausente ou zerado (exigirá preenchimento antes da folha).')
      }

      // Validação de Data de Admissão
      if (!item.data_admissao) {
        avisos.push('Data de admissão não informada. Será assumida a data de hoje.')
      }

      // Duplicidade no próprio arquivo
      if (cpfLimpo) {
        if (cpfsVistosNoArquivo.has(cpfLimpo)) {
          avisos.push('CPF repetido em múltiplas linhas deste mesmo arquivo.')
        } else {
          cpfsVistosNoArquivo.add(cpfLimpo)
        }
      }

      // Duplicidade com colaboradores existentes na mesma empresa
      if (cpfLimpo && mapaExistentesPorCpf.has(cpfLimpo)) {
        const funcExistente = mapaExistentesPorCpf.get(cpfLimpo)!
        statusValidacao = 'duplicado'
        funcionarioExistenteId = funcExistente.id
        avisos.push(
          `Colaborador já cadastrado nesta empresa (${funcExistente.nome_completo} - Cargo: ${funcExistente.cargo}).`,
        )
      }

      // Se houver erros impeditivos, o status final é erro
      if (erros.length > 0) {
        statusValidacao = 'erro'
        errosCount++
      } else if (statusValidacao === 'duplicado') {
        duplicadosCount++
      } else {
        validosCount++
      }

      return {
        ...item,
        status_validacao: statusValidacao,
        erros,
        avisos,
        acao_duplicidade: item.acao_duplicidade || regraPadraoDuplicidade,
        funcionario_existente_id: funcionarioExistenteId,
      }
    })

    return {
      itens: itensValidados,
      total: itensValidados.length,
      validos: validosCount,
      duplicados: duplicadosCount,
      erros: errosCount,
    }
  },

  /**
   * Executa a gravação dos colaboradores validados no PocketBase, respeitando anti-duplicidade e auditoria
   */
  async executarImportacao(params: {
    tenantId: string
    empresaId: string
    usuarioId: string
    itens: ColaboradorImportItem[]
    regraDuplicidadeGeral?: RegraDuplicidade
  }): Promise<ExecutarImportacaoResultado> {
    const { tenantId, empresaId, usuarioId, itens, regraDuplicidadeGeral = 'atualizar' } = params

    let criados = 0
    let atualizados = 0
    let ignorados = 0
    const falhas: { nome: string; cpf: string; motivo: string }[] = []

    const emp = await pb.collection('empresas').getOne<Empresa>(empresaId)

    for (const item of itens) {
      // Ignorar itens com erro fatal
      if (item.status_validacao === 'erro') {
        falhas.push({
          nome: item.nome_completo || 'Sem nome',
          cpf: item.cpf || 'Sem CPF',
          motivo: item.erros.join('; '),
        })
        continue
      }

      const acaoDup = item.acao_duplicidade || regraDuplicidadeGeral
      const dataAdmEfetiva = item.data_admissao
        ? new Date(`${item.data_admissao}T12:00:00Z`).toISOString()
        : new Date().toISOString()

      const payloadBase: Record<string, unknown> = {
        tenant_id: tenantId,
        empresa: empresaId,
        nome_completo: item.nome_completo.trim(),
        cpf: item.cpf,
        cargo: item.cargo.trim(),
        salario: item.salario || 0,
        data_admissao: dataAdmEfetiva,
        tipo: item.tipo || 'clt',
        status: item.status || 'ativo',
        centro_custo: item.centro_custo || undefined,
        nis_pis: item.nis_pis || undefined,
        ctps_numero: item.ctps_numero || undefined,
        ctps_serie: item.ctps_serie || undefined,
        ctps_uf: item.ctps_uf || undefined,
        cbo: item.cbo || undefined,
        grau_instrucao: item.grau_instrucao || undefined,
        raca_cor: item.raca_cor || undefined,
        estado_civil: item.estado_civil || undefined,
        sexo: item.sexo || undefined,
        data_nascimento: item.data_nascimento
          ? new Date(`${item.data_nascimento}T12:00:00Z`).toISOString()
          : undefined,
        nome_mae: item.nome_mae || undefined,
        pcd: item.pcd || false,
        tipo_deficiencia: item.tipo_deficiencia || undefined,
        dependentes_irrf: item.dependentes_irrf || 0,
        matricula_esocial: item.matricula_esocial || undefined,
      }

      try {
        if (item.status_validacao === 'duplicado' && item.funcionario_existente_id) {
          if (acaoDup === 'pular') {
            ignorados++
            continue
          }

          // Atualizar colaborador existente (mesclando campos preenchidos)
          await pb.collection('funcionarios').update(item.funcionario_existente_id, payloadBase)
          atualizados++
        } else {
          // Criar novo colaborador
          const novo = await pb.collection('funcionarios').create<Funcionario>(payloadBase)

          // Registrar automaticamente evento de admissão no DP
          try {
            await pb.collection('eventos_dp').create({
              tenant_id: tenantId,
              empresa: empresaId,
              funcionario: novo.id,
              tipo: 'admissao',
              data_evento: dataAdmEfetiva,
              descricao: `Importação e-Social: admissão de ${item.nome_completo} (Cargo: ${item.cargo})`,
            })
          } catch (eEvt) {
            console.warn('Erro ao criar evento admissão DP na importação:', eEvt)
          }

          criados++
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        falhas.push({
          nome: item.nome_completo,
          cpf: item.cpf,
          motivo: `Falha ao salvar no banco: ${msg}`,
        })
      }
    }

    // Registrar auditoria
    const totalSucesso = criados + atualizados
    try {
      await auditService.log(
        tenantId,
        usuarioId,
        'importacao_colaboradores_esocial',
        'funcionarios',
        empresaId,
        `Importação via e-Social concluída para "${emp.razao_social}". Criados: ${criados}, Atualizados: ${atualizados}, Ignorados: ${ignorados}, Falhas: ${falhas.length}. Total no lote: ${itens.length}.`,
      )
    } catch (eAudit) {
      console.warn('Erro ao registrar auditoria da importação:', eAudit)
    }

    return {
      sucesso: falhas.length === 0,
      totalProcessado: itens.length,
      criados,
      atualizados,
      ignorados,
      falhas,
    }
  },
}
