import React from 'react'

interface RelatorioMarkdownViewerProps {
  conteudo?: string
  markdown?: string
}

export function RelatorioMarkdownViewer({ conteudo, markdown }: RelatorioMarkdownViewerProps) {
  const textoEfetivo = conteudo ?? markdown ?? ''
  if (!textoEfetivo) {
    return <p className="text-xs text-slate-400 italic">Nenhum relatório técnico emitido.</p>
  }

  const linhas = textoEfetivo.split('\n')
  const elementos: React.ReactNode[] = []

  let i = 0
  while (i < linhas.length) {
    const linha = linhas[i]
    const trimmed = linha.trim()

    // Detectar início de tabela Markdown (| col1 | col2 |)
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      const tabelaLinhas: string[] = []
      while (
        i < linhas.length &&
        linhas[i].trim().startsWith('|') &&
        linhas[i].trim().endsWith('|')
      ) {
        tabelaLinhas.push(linhas[i].trim())
        i++
      }

      if (tabelaLinhas.length >= 2) {
        const headerLinha = tabelaLinhas[0]
        const headerCols = headerLinha
          .slice(1, -1)
          .split('|')
          .map((c) => c.trim())

        // Ignorar linha separadora (|---|---|)
        const rowLinhas = tabelaLinhas.slice(1).filter((l) => !/^\|[\s\-:|]+\|$/.test(l))

        elementos.push(
          <div
            key={`table-${i}`}
            className="my-3 overflow-x-auto rounded-lg border border-slate-200 shadow-2xs"
          >
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100/90 border-b border-slate-200 text-slate-900 font-semibold">
                  {headerCols.map((col, cIdx) => (
                    <th
                      key={cIdx}
                      className="px-3 py-2 border-r last:border-r-0 border-slate-200 font-bold"
                    >
                      {renderFormatacaoInline(col)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {rowLinhas.map((rLinha, rIdx) => {
                  const cols = rLinha
                    .slice(1, -1)
                    .split('|')
                    .map((c) => c.trim())
                  return (
                    <tr key={rIdx} className="hover:bg-slate-50/80 transition-colors">
                      {cols.map((col, cIdx) => (
                        <td
                          key={cIdx}
                          className="px-3 py-2 border-r last:border-r-0 border-slate-200 text-slate-700"
                        >
                          {renderFormatacaoInline(col)}
                        </td>
                      ))}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>,
        )
        continue
      }
    }

    if (trimmed.startsWith('# ')) {
      elementos.push(
        <h1
          key={i}
          className="text-lg font-black text-slate-900 border-b border-slate-200 pb-1.5 pt-3 first:pt-0"
        >
          {trimmed.replace(/^#\s+/, '')}
        </h1>,
      )
    } else if (trimmed.startsWith('## ')) {
      elementos.push(
        <h2
          key={i}
          className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-1 pt-2.5 first:pt-0 flex items-center gap-1.5"
        >
          <span className="w-1.5 h-3.5 bg-[#0FA3A3] rounded-xs inline-block" />
          {trimmed.replace(/^##\s+/, '')}
        </h2>,
      )
    } else if (trimmed.startsWith('### ')) {
      elementos.push(
        <h3
          key={i}
          className="text-xs font-bold text-slate-800 pt-2 first:pt-0 uppercase tracking-wide text-[#123B6D]"
        >
          {trimmed.replace(/^###\s+/, '')}
        </h3>,
      )
    } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      const itemText = trimmed.replace(/^[-*]\s+/, '')
      elementos.push(
        <li key={i} className="ml-4 list-disc pl-1 text-slate-700">
          {renderFormatacaoInline(itemText)}
        </li>,
      )
    } else if (/^\d+\.\s+/.test(trimmed)) {
      const itemText = trimmed.replace(/^\d+\.\s+/, '')
      elementos.push(
        <li key={i} className="ml-4 list-decimal pl-1 text-slate-700">
          {renderFormatacaoInline(itemText)}
        </li>,
      )
    } else if (trimmed.startsWith('> ')) {
      elementos.push(
        <blockquote
          key={i}
          className="border-l-4 border-teal-500 bg-teal-50/60 p-2.5 rounded-r-lg italic text-teal-950 font-medium"
        >
          {renderFormatacaoInline(trimmed.replace(/^>\s+/, ''))}
        </blockquote>,
      )
    } else if (trimmed === '---' || trimmed === '***') {
      elementos.push(<hr key={i} className="border-slate-200 my-2" />)
    } else if (!trimmed) {
      elementos.push(<div key={i} className="h-1" />)
    } else {
      elementos.push(
        <p key={i} className="text-slate-700">
          {renderFormatacaoInline(linha)}
        </p>,
      )
    }

    i++
  }

  return (
    <div className="space-y-2.5 text-xs text-slate-800 leading-relaxed font-sans">{elementos}</div>
  )
}

function renderFormatacaoInline(texto: string): React.ReactNode {
  // Substitui negrito **texto** e código `codigo`
  const partes = texto.split(/(\*\*.*?\*\*|`.*?`)/g)

  return partes.map((parte, idx) => {
    if (parte.startsWith('**') && parte.endsWith('**')) {
      return (
        <strong key={idx} className="font-bold text-slate-900">
          {parte.slice(2, -2)}
        </strong>
      )
    }
    if (parte.startsWith('`') && parte.endsWith('`')) {
      const codigo = parte.slice(1, -1)
      let badgeClass = 'bg-slate-100 text-slate-800 border-slate-200'
      if (codigo === 'Ativo' || codigo === 'Piloto ativo') {
        badgeClass = 'bg-emerald-100 text-emerald-800 border-emerald-300 font-semibold'
      } else if (codigo === 'Planejado') {
        badgeClass = 'bg-amber-100 text-amber-800 border-amber-300 font-semibold'
      }
      return (
        <code
          key={idx}
          className={`${badgeClass} px-1.5 py-0.5 rounded text-[11px] font-mono border`}
        >
          {codigo}
        </code>
      )
    }
    return parte
  })
}
