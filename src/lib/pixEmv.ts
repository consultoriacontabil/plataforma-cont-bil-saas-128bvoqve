/**
 * Gerador EMV BR Code (PIX Estático) em conformidade com o Banco Central do Brasil.
 *
 * Utiliza o padrão TLV (Tag-Length-Value) e CRC16-CCITT (polinômio 0x1021, init 0xFFFF).
 */

/**
 * Calcula o CRC16-CCITT no padrão BACEN (polinômio 0x1021, valor inicial 0xFFFF).
 */
export function calcularCrc16Pix(payload: string): string {
  let crc = 0xffff
  const polynomial = 0x1021

  for (let i = 0; i < payload.length; i++) {
    const byte = payload.charCodeAt(i)
    crc ^= byte << 8
    for (let bit = 0; bit < 8; bit++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ polynomial) & 0xffff
      } else {
        crc = (crc << 1) & 0xffff
      }
    }
  }

  return crc.toString(16).toUpperCase().padStart(4, '0')
}

/**
 * Formata um campo no padrão EMV TLV (ID com 2 dígitos + Tamanho com 2 dígitos + Valor).
 */
function formatTlv(id: string, value: string): string {
  const len = value.length.toString().padStart(2, '0')
  return `${id}${len}${value}`
}

/**
 * Remove acentuações e caracteres especiais para compatibilidade com o padrão EMV BR Code.
 */
function normalizarTexto(txt: string, maxLen = 25): string {
  return txt
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9 ]/g, '')
    .trim()
    .slice(0, maxLen)
}

export interface GerarPixEmvParams {
  chavePix: string
  nomeRecebedor: string
  cidadeRecebedor?: string
  valor?: number
  identificador?: string // txid (ex: COB123)
  descricao?: string
}

/**
 * Gera o payload PIX copia-e-cola válido no formato EMV BR Code estático.
 */
export function gerarPayloadPixEmv(params: GerarPixEmvParams): string {
  const chave = (params.chavePix || '').trim()
  if (!chave) {
    return ''
  }

  const nomeRaw = params.nomeRecebedor?.trim() || 'RUMO CONTABIL'
  const nome = normalizarTexto(nomeRaw, 25) || 'RECEBEDOR'
  const cidade = normalizarTexto(params.cidadeRecebedor || 'CURITIBA', 15) || 'CURITIBA'
  const txid = normalizarTexto(params.identificador || '***', 25) || '***'

  // Tag 00: Payload Format Indicator (fixo "01")
  let payload = formatTlv('00', '01')

  // Tag 26: Merchant Account Information - PIX
  // Sub-tag 00: GUI ("br.gov.bcb.pix")
  // Sub-tag 01: Chave PIX
  // Sub-tag 02: Descrição (opcional)
  let maiPix = formatTlv('00', 'br.gov.bcb.pix') + formatTlv('01', chave)
  if (params.descricao) {
    const descNorm = normalizarTexto(params.descricao, 40)
    if (descNorm) {
      maiPix += formatTlv('02', descNorm)
    }
  }
  payload += formatTlv('26', maiPix)

  // Tag 52: Merchant Category Code (fixo "0000")
  payload += formatTlv('52', '0000')

  // Tag 53: Transaction Currency (fixo "986" para Real BRL)
  payload += formatTlv('53', '986')

  // Tag 54: Transaction Amount (opcional, formatado com 2 casas decimais)
  if (params.valor !== undefined && params.valor > 0) {
    const valorStr = params.valor.toFixed(2)
    payload += formatTlv('54', valorStr)
  }

  // Tag 58: Country Code (fixo "BR")
  payload += formatTlv('58', 'BR')

  // Tag 59: Merchant Name (nome do recebedor, max 25 chars)
  payload += formatTlv('59', nome)

  // Tag 60: Merchant City (cidade do recebedor, max 15 chars)
  payload += formatTlv('60', cidade)

  // Tag 62: Additional Data Field Template
  // Sub-tag 05: Reference Label / txid
  const additionalData = formatTlv('05', txid)
  payload += formatTlv('62', additionalData)

  // Tag 63: CRC16 (Tag "63" + Tamanho "04")
  const payloadSemCrc = payload + '6304'
  const crc = calcularCrc16Pix(payloadSemCrc)

  return payloadSemCrc + crc
}
