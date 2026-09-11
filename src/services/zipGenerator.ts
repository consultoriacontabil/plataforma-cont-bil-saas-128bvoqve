/**
 * Gerador de arquivo ZIP client-side em JavaScript puro (compatível com navegadores modernos)
 * Sem dependências externas pesadas. Gera formato PKZip padrão reconhecido pelo Chrome, Windows e macOS.
 */

interface ZipFileEntry {
  name: string
  content: string | Uint8Array
}

// Tabela de CRC32 pré-calculada
const crcTable: number[] = (() => {
  const table: number[] = []
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    }
    table[n] = c >>> 0
  }
  return table
})()

function calculateCRC32(bytes: Uint8Array): number {
  let crc = 0 ^ -1
  for (let i = 0; i < bytes.length; i++) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ bytes[i]) & 0xff]
  }
  return (crc ^ -1) >>> 0
}

export function createZipBlob(files: ZipFileEntry[]): Blob {
  const fileEntries: {
    nameBytes: Uint8Array
    contentBytes: Uint8Array
    crc: number
    offset: number
  }[] = []

  let currentOffset = 0
  const localHeadersAndData: Uint8Array[] = []
  const textEncoder = new TextEncoder()

  for (const file of files) {
    const nameBytes = textEncoder.encode(file.name)
    const contentBytes =
      typeof file.content === 'string' ? textEncoder.encode(file.content) : file.content
    const crc = calculateCRC32(contentBytes)
    const offset = currentOffset

    // Local file header (30 bytes + name length + content length)
    const localHeader = new Uint8Array(30 + nameBytes.length)
    const view = new DataView(localHeader.buffer)

    view.setUint32(0, 0x04034b50, true) // Signature
    view.setUint16(4, 20, true) // Version needed (2.0)
    view.setUint16(6, 0x0800, true) // General purpose bit flag (UTF-8)
    view.setUint16(8, 0, true) // Compression method: 0 (store/sem compressão para máxima compatibilidade)
    view.setUint16(10, 0, true) // File mod time
    view.setUint16(12, 0, true) // File mod date
    view.setUint32(14, crc, true) // CRC32
    view.setUint32(18, contentBytes.length, true) // Compressed size
    view.setUint32(22, contentBytes.length, true) // Uncompressed size
    view.setUint16(26, nameBytes.length, true) // File name length
    view.setUint16(28, 0, true) // Extra field length

    localHeader.set(nameBytes, 30)

    localHeadersAndData.push(localHeader)
    localHeadersAndData.push(contentBytes)

    fileEntries.push({
      nameBytes,
      contentBytes,
      crc,
      offset,
    })

    currentOffset += localHeader.length + contentBytes.length
  }

  // Central Directory Records
  const centralDirectoryStart = currentOffset
  const centralDirectoryParts: Uint8Array[] = []

  for (const entry of fileEntries) {
    const cdHeader = new Uint8Array(46 + entry.nameBytes.length)
    const view = new DataView(cdHeader.buffer)

    view.setUint32(0, 0x02014b50, true) // Signature
    view.setUint16(4, 20, true) // Version made by
    view.setUint16(6, 20, true) // Version needed
    view.setUint16(8, 0x0800, true) // Bit flag (UTF-8)
    view.setUint16(10, 0, true) // Compression: 0 (stored)
    view.setUint16(12, 0, true) // File mod time
    view.setUint16(14, 0, true) // File mod date
    view.setUint32(16, entry.crc, true) // CRC32
    view.setUint32(20, entry.contentBytes.length, true) // Compressed size
    view.setUint32(24, entry.contentBytes.length, true) // Uncompressed size
    view.setUint16(28, entry.nameBytes.length, true) // File name length
    view.setUint16(30, 0, true) // Extra field length
    view.setUint16(32, 0, true) // File comment length
    view.setUint16(34, 0, true) // Disk number start
    view.setUint16(36, 0, true) // Internal file attributes
    view.setUint32(38, 0, true) // External file attributes
    view.setUint32(42, entry.offset, true) // Relative offset of local header

    cdHeader.set(entry.nameBytes, 46)
    centralDirectoryParts.push(cdHeader)
    currentOffset += cdHeader.length
  }

  const centralDirectorySize = currentOffset - centralDirectoryStart

  // End of Central Directory Record (22 bytes)
  const eocd = new Uint8Array(22)
  const eocdView = new DataView(eocd.buffer)
  eocdView.setUint32(0, 0x06054b50, true) // EOCD signature
  eocdView.setUint16(4, 0, true) // Number of this disk
  eocdView.setUint16(6, 0, true) // Disk where CD starts
  eocdView.setUint16(8, fileEntries.length, true) // Total entries on this disk
  eocdView.setUint16(10, fileEntries.length, true) // Total entries
  eocdView.setUint32(12, centralDirectorySize, true) // Size of CD
  eocdView.setUint32(16, centralDirectoryStart, true) // Offset of start of CD
  eocdView.setUint16(20, 0, true) // ZIP comment length

  const allParts: BlobPart[] = [
    ...localHeadersAndData.map((arr) => arr.buffer as ArrayBuffer),
    ...centralDirectoryParts.map((arr) => arr.buffer as ArrayBuffer),
    eocd.buffer as ArrayBuffer,
  ]
  return new Blob(allParts, { type: 'application/zip' })
}
