import { isValidCnpj, isValidCpf, maskCnpj, maskCep, maskPhone } from '@/lib/formatters'
import type { CampoExtraidoItem, AlertaValidacao, SocioExtraido, Empresa } from '@/types'

export interface ExtracaoResult {
  campos: Record<string, string>
  socios: SocioExtraido[]
  cnaePrincipal?: string
  naturezaJuridica?: string
  confiancaPorCampo: Record<string, 'alta' | 'media' | 'baixa'>
  documentoTipoDetectado: string
}

/**
 * Heurísticas e expressões regulares para extrair campos a partir do texto do documento.
 * Cobre Cartão CNPJ, Contrato Social, Ficha Cadastral da Junta, Comprovante de Endereço, etc.
 */
export function extrairDadosDocumento(texto: string, nomeArquivo: string): ExtracaoResult {
  const campos: Record<string, string> = {}
  const confiancaPorCampo: Record<string, 'alta' | 'media' | 'baixa'> = {}
  const socios: SocioExtraido[] = []
  let cnaePrincipal = ''
  let naturezaJuridica = ''

  // Limpeza inicial e normalização de quebras de linha e múltiplos espaços
  const textoNorm = texto.replace(/\r\n/g, '\n').replace(/\r/g, '\n')

  // 1. Detecção do tipo de documento
  let docTipo = 'outro'
  const textoLower = textoNorm.toLowerCase()
  if (
    textoLower.includes('cadastro nacional da pessoa jurídica') ||
    textoLower.includes('comprovante de inscrição e de situação cadastral') ||
    textoLower.includes('cartão cnpj')
  ) {
    docTipo = 'cartao_cnpj'
  } else if (
    textoLower.includes('contrato social') ||
    textoLower.includes('estatuto social') ||
    textoLower.includes('sociedade limitada') ||
    textoLower.includes('cláusula primeira') ||
    textoLower.includes('constituição de sociedade')
  ) {
    docTipo = 'contrato_social'
  } else if (
    textoLower.includes('junta comercial') ||
    textoLower.includes('ficha cadastral') ||
    textoLower.includes('certidão simplificada')
  ) {
    docTipo = 'ficha_cadastral'
  } else if (
    textoLower.includes('comprovante de residência') ||
    textoLower.includes('conta de energia') ||
    textoLower.includes('fatura de água') ||
    textoLower.includes('conta de luz') ||
    textoLower.includes('sabesp') ||
    textoLower.includes('enel') ||
    textoLower.includes('cpfl')
  ) {
    docTipo = 'comprovante_endereco'
  }

  // 2. Extração de CNPJ
  // Formatos: 00.000.000/0001-00 ou 14 dígitos seguidos
  const cnpjMatches = textoNorm.match(/\b(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})\b|\b(\d{14})\b/g)
  if (cnpjMatches && cnpjMatches.length > 0) {
    for (const match of cnpjMatches) {
      const clean = match.replace(/\D/g, '')
      if (isValidCnpj(clean)) {
        campos.cnpj = maskCnpj(clean)
        confiancaPorCampo.cnpj = 'alta'
        break
      }
    }
  }

  // 3. Razão Social / Nome Empresarial
  // Procura por rótulos: "NOME EMPRESARIAL", "RAZÃO SOCIAL", "DENOMINAÇÃO SOCIAL"
  const razaoRegexes = [
    /(?:NOME EMPRESARIAL|RAZÃO SOCIAL|DENOMINAÇÃO SOCIAL|EMPRESA)\s*[:\-\n|]+\s*([A-Z0-9À-Ú\s.\-&]{4,80})/i,
    /(?:sob a firma social|pela denominação social de|adota o nome empresarial de)\s*["“']?([A-Z0-9À-Ú\s.\-&]{4,80})["”']?/i,
  ]
  for (const reg of razaoRegexes) {
    const m = textoNorm.match(reg)
    if (m && m[1]) {
      const candidata = m[1].split('\n')[0].trim().replace(/[|#*]/g, '').trim()
      // Elimina se pegou texto genérico
      if (
        candidata.length > 3 &&
        !candidata.toLowerCase().includes('matriz') &&
        !candidata.toLowerCase().includes('comprovante')
      ) {
        campos.razao_social = candidata
        confiancaPorCampo.razao_social = docTipo === 'cartao_cnpj' ? 'alta' : 'media'
        break
      }
    }
  }

  // 4. Nome Fantasia / Título do Estabelecimento
  const fantasiaRegexes = [
    /(?:TÍTULO DO ESTABELECIMENTO \(NOME DE FANTASIA\)|NOME DE FANTASIA|NOME FANTASIA)\s*[:\-\n|]+\s*([^\n\r|]{2,60})/i,
  ]
  for (const reg of fantasiaRegexes) {
    const m = textoNorm.match(reg)
    if (m && m[1]) {
      const fantasia = m[1].replace(/[|#*]/g, '').trim()
      if (
        fantasia &&
        !fantasia.toLowerCase().includes('********') &&
        !fantasia.toLowerCase().includes('não informado')
      ) {
        campos.nome_fantasia = fantasia
        confiancaPorCampo.nome_fantasia = 'alta'
        break
      }
    }
  }

  // 5. Data de Abertura / Início de Atividade
  const dataAberturaRegexes = [
    /(?:DATA DE ABERTURA|DATA DE INÍCIO DE ATIVIDADE|INÍCIO DE ATIVIDADES)\s*[:\-\n|]+\s*(\d{2}\/\d{2}\/\d{4})/i,
    /(?:aberta em|constituída em)\s*(\d{2}\/\d{2}\/\d{4})/i,
  ]
  for (const reg of dataAberturaRegexes) {
    const m = textoNorm.match(reg)
    if (m && m[1]) {
      const [dia, mes, ano] = m[1].split('/')
      campos.data_abertura = `${ano}-${mes}-${dia}`
      confiancaPorCampo.data_abertura = 'alta'
      break
    }
  }

  // 6. CNAE Principal
  const cnaeRegex =
    /(?:CÓDIGO E DESCRIÇÃO DA ATIVIDADE ECONÔMICA PRINCIPAL|CNAE PRINCIPAL|ATIVIDADE PRINCIPAL)\s*[:\-\n|]+\s*([\d.\-/]{7,10})\s*[-–—]?\s*([^\n\r|]{3,120})/i
  const cnaeMatch = textoNorm.match(cnaeRegex)
  if (cnaeMatch) {
    cnaePrincipal = `${cnaeMatch[1].trim()} - ${cnaeMatch[2].trim()}`
    campos.cnae_principal = cnaePrincipal
    confiancaPorCampo.cnae_principal = 'alta'
  }

  // 7. Natureza Jurídica
  const natJurRegex =
    /(?:CÓDIGO E DESCRIÇÃO DA NATUREZA JURÍDICA|NATUREZA JURÍDICA)\s*[:\-\n|]+\s*([\d.-]{3,6})\s*[-–—]?\s*([^\n\r|]{3,80})/i
  const natMatch = textoNorm.match(natJurRegex)
  if (natMatch) {
    naturezaJuridica = `${natMatch[1].trim()} - ${natMatch[2].trim()}`
    campos.natureza_juridica = naturezaJuridica
    confiancaPorCampo.natureza_juridica = 'alta'

    // Dedução do regime ou porte aproximado
    const natLower = naturezaJuridica.toLowerCase()
    if (natLower.includes('microempreendedor') || natLower.includes('individual')) {
      if (!campos.regime_tributario) campos.regime_tributario = 'simples_nacional'
      if (!campos.porte) campos.porte = 'mei'
    } else if (natLower.includes('sociedade limitada') || natLower.includes('ltda')) {
      if (!campos.porte) campos.porte = 'me'
    }
  }

  // 8. Endereço: CEP
  const cepMatches = textoNorm.match(/\b\d{5}-\d{3}\b|\bCEP\s*[:-]?\s*(\d{8}|\d{5}-\d{3})\b/i)
  if (cepMatches) {
    const rawCep = cepMatches[0].replace(/\D/g, '')
    if (rawCep.length === 8) {
      campos.cep = maskCep(rawCep)
      confiancaPorCampo.cep = 'alta'
    }
  }

  // Logradouro, Número, Complemento, Bairro, Cidade, UF
  const logradouroMatch = textoNorm.match(
    /(?:LOGRADOURO|ENDEREÇO|RUA|AVENIDA|ALAMEDA|RODOVIA)\s*[:\-\n|]+\s*([^\n\r,|]{3,80})/i,
  )
  if (logradouroMatch && logradouroMatch[1]) {
    campos.logradouro = logradouroMatch[1].replace(/[|#*]/g, '').trim()
    confiancaPorCampo.logradouro = 'media'
  }

  const numeroMatch = textoNorm.match(/(?:NÚMERO|Nº|NUMERO)\s*[:\-\n|]+\s*([0-9A-Z\-/]{1,15})/i)
  if (numeroMatch && numeroMatch[1]) {
    campos.numero = numeroMatch[1].replace(/[|#*]/g, '').trim()
    confiancaPorCampo.numero = 'media'
  }

  const complementoMatch = textoNorm.match(/(?:COMPLEMENTO)\s*[:\-\n|]+\s*([^\n\r|]{2,40})/i)
  if (complementoMatch && complementoMatch[1]) {
    const comp = complementoMatch[1].replace(/[|#*]/g, '').trim()
    if (!comp.toLowerCase().includes('não informado')) {
      campos.complemento = comp
      confiancaPorCampo.complemento = 'media'
    }
  }

  const bairroMatch = textoNorm.match(/(?:BAIRRO\/DISTRITO|BAIRRO)\s*[:\-\n|]+\s*([^\n\r|]{2,50})/i)
  if (bairroMatch && bairroMatch[1]) {
    campos.bairro = bairroMatch[1].replace(/[|#*]/g, '').trim()
    confiancaPorCampo.bairro = 'media'
  }

  const munUfMatch = textoNorm.match(
    /(?:MUNICÍPIO|CIDADE)\s*[:\-\n|]+\s*([^\n\r|]{2,50})\s*(?:UF\s*[:\-\n|]+\s*([A-Z]{2}))?/i,
  )
  if (munUfMatch) {
    if (munUfMatch[1]) {
      campos.cidade = munUfMatch[1].replace(/[|#*]/g, '').trim()
      confiancaPorCampo.cidade = 'media'
    }
    if (munUfMatch[2]) {
      campos.uf = munUfMatch[2].trim().toUpperCase()
      confiancaPorCampo.uf = 'alta'
    }
  }

  if (!campos.uf) {
    const ufAvulsa = textoNorm.match(/(?:^|\s)UF\s*[:\-\n|]+\s*([A-Z]{2})\b/i)
    if (ufAvulsa && ufAvulsa[1]) {
      campos.uf = ufAvulsa[1].trim().toUpperCase()
      confiancaPorCampo.uf = 'alta'
    }
  }

  // 9. Contatos: E-mail e Telefone
  const emailMatch = textoNorm.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/)
  if (emailMatch) {
    const em = emailMatch[0].toLowerCase()
    if (!em.includes('receita.fazenda') && !em.includes('gov.br')) {
      campos.email = em
      confiancaPorCampo.email = 'alta'
    }
  }

  const phoneMatch = textoNorm.match(/(?:\(?\d{2}\)?\s*)?(?:9\d{4}|\d{4})[-.\s]?\d{4}\b/)
  if (phoneMatch) {
    campos.telefone = maskPhone(phoneMatch[0])
    confiancaPorCampo.telefone = 'media'
  }

  // 10. Quadro Societário (QSA / Sócios)
  // No Contrato Social ou Ficha Cadastral: sócios com CPF e quotas
  const socioBlockRegex =
    /(?:sócio|administrador|titular|quotista)\s*[:-]?\s*([A-ZÀ-Ú\s]{3,60})\s*,?\s*(?:portador do CPF|inscrito no CPF|CPF)?\s*[:\sºn]*(\d{3}\.\d{3}\.\d{3}-\d{2}|\d{11})?/gi
  let matchSocio: RegExpExecArray | null
  while ((matchSocio = socioBlockRegex.exec(textoNorm)) !== null) {
    const nome = matchSocio[1]?.trim()
    const cpfRaw = matchSocio[2]?.replace(/\D/g, '')
    if (
      nome &&
      nome.length > 5 &&
      !nome.toLowerCase().includes('nacional') &&
      !nome.toLowerCase().includes('receita')
    ) {
      socios.push({
        nome,
        cpf: cpfRaw ? (isValidCpf(cpfRaw) ? cpfRaw : undefined) : undefined,
      })
    }
  }

  // Se extraímos sócios e não há observação, podemos formatar em observações
  if (socios.length > 0) {
    const socioTxt = socios.map((s) => `${s.nome}${s.cpf ? ` (CPF: ${s.cpf})` : ''}`).join(', ')
    campos.socios_qsa = socioTxt
    confiancaPorCampo.socios_qsa = 'media'
  }

  return {
    campos,
    socios,
    cnaePrincipal,
    naturezaJuridica,
    confiancaPorCampo,
    documentoTipoDetectado: docTipo,
  }
}

/**
 * Validação rigorosa do cadastro e dos documentos para gerar alertas nas 3 categorias:
 * - Inconsistências (bloqueantes ou divergentes)
 * - Ausências (campos obrigatórios vazios)
 * - Atenções (formatações suspeitas ou dados parciais)
 */
export function validarConsistenciaCadastro(
  formAtual: Partial<Empresa>,
  camposExtraidos: Record<string, string>,
  origemDoc?: string,
): AlertaValidacao[] {
  const alertas: AlertaValidacao[] = []

  // === 1. INCONSISTÊNCIAS ===
  // 1.1 CNPJ divergente entre o formulário digitado e o documento
  const cnpjForm = (formAtual.cnpj || '').replace(/\D/g, '')
  const cnpjDoc = (camposExtraidos.cnpj || '').replace(/\D/g, '')
  if (cnpjForm && cnpjDoc && cnpjForm !== cnpjDoc) {
    alertas.push({
      id: 'inconsistencia-cnpj-divergente',
      categoria: 'inconsistencia',
      severidade: 'inconsistencia',
      campoRelacionado: 'cnpj',
      titulo: 'CNPJ divergente do documento',
      mensagem: `O CNPJ no formulário (${maskCnpj(cnpjForm)}) difere do CNPJ encontrado no documento ${origemDoc ? `(${origemDoc})` : ''}: ${maskCnpj(cnpjDoc)}.`,
      sugestao: 'Verifique se o documento anexado pertence à empresa correta ou atualize o CNPJ.',
    })
  }

  // 1.2 CNPJ com dígitos verificadores inválidos
  if (cnpjForm && !isValidCnpj(cnpjForm)) {
    alertas.push({
      id: 'inconsistencia-cnpj-invalido',
      categoria: 'inconsistencia',
      severidade: 'bloqueante',
      campoRelacionado: 'cnpj',
      titulo: 'Dígitos verificadores do CNPJ inválidos',
      mensagem: `O CNPJ ${maskCnpj(cnpjForm)} não passou no algoritmo de validação da Receita Federal.`,
      sugestao: 'Corrija os dígitos do CNPJ para prosseguir com o salvamento seguro.',
    })
  }

  // 1.3 Razão Social divergente
  if (
    formAtual.razao_social &&
    camposExtraidos.razao_social &&
    formAtual.razao_social.trim().toLowerCase() !==
      camposExtraidos.razao_social.trim().toLowerCase()
  ) {
    alertas.push({
      id: 'inconsistencia-razao-divergente',
      categoria: 'inconsistencia',
      severidade: 'inconsistencia',
      campoRelacionado: 'razao_social',
      titulo: 'Razão Social divergente',
      mensagem: `A Razão Social digitada ("${formAtual.razao_social}") é diferente da identificada no documento ("${camposExtraidos.razao_social}").`,
      sugestao: 'Considere adotar a Razão Social oficial do Cartão CNPJ ou Contrato Social.',
    })
  }

  // 1.4 Data de abertura no futuro
  const dataAbertura = formAtual.data_abertura || camposExtraidos.data_abertura
  if (dataAbertura) {
    const dataObj = new Date(dataAbertura)
    const hoje = new Date()
    if (dataObj > hoje) {
      alertas.push({
        id: 'inconsistencia-data-futuro',
        categoria: 'inconsistencia',
        severidade: 'inconsistencia',
        campoRelacionado: 'data_abertura',
        titulo: 'Data de abertura no futuro',
        mensagem: `A data de abertura informada (${dataAbertura}) é posterior à data atual.`,
        sugestao: 'Confira a data de constituição nos registros públicos.',
      })
    }
  }

  // 1.5 CEP com máscara incorreta ou incompleto
  const cepLimpo = (formAtual.cep || camposExtraidos.cep || '').replace(/\D/g, '')
  if (cepLimpo && cepLimpo.length !== 8) {
    alertas.push({
      id: 'inconsistencia-cep-invalido',
      categoria: 'inconsistencia',
      severidade: 'inconsistencia',
      campoRelacionado: 'cep',
      titulo: 'CEP com tamanho inválido',
      mensagem: `O CEP informado tem ${cepLimpo.length} dígitos (o padrão nacional é de 8 dígitos).`,
      sugestao: 'Insira um CEP válido para consulta do webservice ViaCEP.',
    })
  }

  // === 2. AUSÊNCIAS (Campos essenciais em branco) ===
  const camposObrigatorios: Array<{ key: keyof Empresa; label: string; campoRef: string }> = [
    { key: 'cnpj', label: 'CNPJ', campoRef: 'cnpj' },
    { key: 'razao_social', label: 'Razão Social', campoRef: 'razao_social' },
    { key: 'logradouro', label: 'Logradouro do Endereço', campoRef: 'logradouro' },
    { key: 'numero', label: 'Número do Endereço', campoRef: 'numero' },
    { key: 'bairro', label: 'Bairro', campoRef: 'bairro' },
    { key: 'cidade', label: 'Município / Cidade', campoRef: 'cidade' },
    { key: 'uf', label: 'UF (Estado)', campoRef: 'uf' },
    { key: 'cep', label: 'CEP', campoRef: 'cep' },
    { key: 'regime_tributario', label: 'Regime Tributário', campoRef: 'regime_tributario' },
  ]

  for (const item of camposObrigatorios) {
    const val = (formAtual[item.key] as string) || (camposExtraidos[item.key as string] as string)
    if (!val || !val.toString().trim()) {
      alertas.push({
        id: `ausencia-${item.campoRef}`,
        categoria: 'ausencia',
        severidade: 'ausencia',
        campoRelacionado: item.campoRef,
        titulo: `${item.label} não preenchido`,
        mensagem: `O campo obrigatório "${item.label}" está em branco no cadastro.`,
        sugestao: 'Preencha este dado diretamente ou extraia de um documento complementar.',
      })
    }
  }

  // Ausência de contato básico
  if (
    !formAtual.email &&
    !formAtual.telefone &&
    !camposExtraidos.email &&
    !camposExtraidos.telefone
  ) {
    alertas.push({
      id: 'ausencia-contato',
      categoria: 'ausencia',
      severidade: 'ausencia',
      campoRelacionado: 'email',
      titulo: 'Ausência de dados de contato',
      mensagem:
        'Não foi informado nenhum e-mail ou telefone para comunicação fiscal e operacional.',
      sugestao: 'Insira ao menos um e-mail de contato corporativo.',
    })
  }

  // Ausência de Inscrição Estadual (Atenção para quem não é MEI)
  if (
    !formAtual.inscricao_estadual &&
    !camposExtraidos.inscricao_estadual &&
    formAtual.regime_tributario !== 'mei'
  ) {
    alertas.push({
      id: 'atencao-ie-em-branco',
      categoria: 'atencao',
      severidade: 'atencao',
      campoRelacionado: 'ie',
      titulo: 'Inscrição Estadual em branco',
      mensagem:
        'A Inscrição Estadual (IE) não foi informada. Caso a empresa seja prestadora de serviços pura, informe "ISENTO".',
      sugestao: 'Digite o número da IE no Sintegra ou preencha com "ISENTO".',
    })
  }

  // === 3. ATENÇÕES ===
  if (
    camposExtraidos.natureza_juridica &&
    !formAtual.observacoes?.includes(camposExtraidos.natureza_juridica)
  ) {
    alertas.push({
      id: 'atencao-natureza-juridica',
      categoria: 'atencao',
      severidade: 'atencao',
      campoRelacionado: 'observacoes',
      titulo: 'Natureza Jurídica identificada',
      mensagem: `Documento indica Natureza Jurídica: "${camposExtraidos.natureza_juridica}".`,
      sugestao: 'Adicione aos registros complementares ou observações operacionais.',
    })
  }

  if (
    camposExtraidos.cnae_principal &&
    !formAtual.observacoes?.includes(camposExtraidos.cnae_principal)
  ) {
    alertas.push({
      id: 'atencao-cnae-principal',
      categoria: 'atencao',
      severidade: 'atencao',
      campoRelacionado: 'observacoes',
      titulo: 'CNAE Principal detectado',
      mensagem: `Atividade Econômica Principal encontrada: "${camposExtraidos.cnae_principal}".`,
      sugestao: 'Pode ser registrado no quadro de observações fiscais da empresa.',
    })
  }

  return alertas
}

/**
 * Constrói a lista de itens para a revisão prévia com o usuário.
 */
export function prepararCamposParaRevisao(
  extracao: ExtracaoResult,
  nomeArquivo: string,
): CampoExtraidoItem[] {
  const rotulos: Record<string, string> = {
    razao_social: 'Razão Social',
    nome_fantasia: 'Nome Fantasia',
    cnpj: 'CNPJ',
    data_abertura: 'Data de Abertura',
    cep: 'CEP',
    logradouro: 'Logradouro',
    numero: 'Número',
    complemento: 'Complemento',
    bairro: 'Bairro',
    cidade: 'Cidade / Município',
    uf: 'UF (Estado)',
    email: 'E-mail Corporativo',
    telefone: 'Telefone / WhatsApp',
    cnae_principal: 'CNAE Principal',
    natureza_juridica: 'Natureza Jurídica',
    socios_qsa: 'Sócios / QSA',
    porte: 'Porte da Empresa',
    regime_tributario: 'Regime Tributário Sugerido',
  }

  const itens: CampoExtraidoItem[] = []

  for (const [campo, valor] of Object.entries(extracao.campos)) {
    if (valor && valor.trim()) {
      itens.push({
        campo,
        rotulo: rotulos[campo] || campo,
        valor,
        valorOriginal: valor,
        origemDoc: nomeArquivo,
        confianca: extracao.confiancaPorCampo[campo] || 'media',
        status: 'aceito',
      })
    }
  }

  return itens
}
