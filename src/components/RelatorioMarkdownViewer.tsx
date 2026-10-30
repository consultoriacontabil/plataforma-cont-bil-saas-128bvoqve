import React from 'react'

interface RelatorioMarkdownViewerProps {
  conteudo: string
}

export function RelatorioMarkdownViewer({ conteudo }: RelatorioMarkdownViewerProps) {
  if (!conteudo) {
    return <p className="text-xs text-slate-400 italic">Nenhum relatório técnico emitido.</p>
  }

  const linhas = conteudo.split('\n')

  return (
    <div className="space-y-2.5 text-xs text-slate-800 leading-relaxed font-sans">
      {linhas.map((linha, idx) => {
        const trimmed = linha.trim()

        if (trimmed.startsWith('# ')) {
          return (
            <h1
              key={idx}
              className="text-lg font-black text-slate-900 border-b border-slate-200 pb-1.5 pt-3 first:pt-0"
            >
              {trimmed.replace(/^#\s+/, '')}
            </h1>
          )
        }
        if (trimmed.startsWith('## ')) {
          return (
            <h2
              key={idx}
              className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-1 pt-2.5 first:pt-0 flex items-center gap-1.5"
            >
              <span className="w-1.5 h-3.5 bg-[#0FA3A3] rounded-xs inline-block" />
              {trimmed.replace(/^##\s+/, '')}
            </h2>
          )
        }
        if (trimmed.startsWith('### ')) {
          return (
            <h3
              key={idx}
              className="text-xs font-bold text-slate-800 pt-2 first:pt-0 uppercase tracking-wide text-[#123B6D]"
            >
              {trimmed.replace(/^###\s+/, '')}
            </h3>
          )
        }
        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
          const itemText = trimmed.replace(/^[-*]\s+/, '')
          return (
            <li key={idx} className="ml-4 list-disc pl-1 text-slate-700">
              {renderFormatacaoInline(itemText)}
            </li>
          )
        }
        if (/^\d+\.\s+/.test(trimmed)) {
          const numPrefix = trimmed.match(/^\d+\./)?.[0] || '1.'
          const itemText = trimmed.replace(/^\d+\.\s+/, '')
          return (
            <li key={idx} className="ml-4 list-decimal pl-1 text-slate-700">
              {renderFormatacaoInline(itemText)}
            </li>
          )
        }
        if (trimmed.startsWith('> ')) {
          return (
            <blockquote
              key={idx}
              className="border-l-4 border-teal-500 bg-teal-50/60 p-2.5 rounded-r-lg italic text-teal-950 font-medium"
            >
              {renderFormatacaoInline(trimmed.replace(/^>\s+/, ''))}
            </blockquote>
          )
        }
        if (trimmed === '---' || trimmed === '***') {
          return <hr key={idx} className="border-slate-200 my-2" />
        }
        if (!trimmed) {
          return <div key={idx} className="h-1" />
        }

        return (
          <p key={idx} className="text-slate-700">
            {renderFormatacaoInline(linha)}
          </p>
        )
      })}
    </div>
  )
}

function renderFormatacaoInline(texto: string): React.ReactNode {
  // Substitui negrito **texto** e código `codigo`
  const partes = texto.split(/(\*\*.*?\*\*|`.*?`)/g)

  return partes.map((parte, i) => {
    if (parte.startsWith('**') && parte.endsWith('**')) {
      return (
        <strong key={i} className="font-bold text-slate-900">
          {parte.slice(2, -2)}
        </strong>
      )
    }
    if (parte.startsWith('`') && parte.endsWith('`')) {
      return (
        <code
          key={i}
          className="bg-slate-100 text-slate-800 px-1 py-0.5 rounded text-[11px] font-mono border border-slate-200"
        >
          {parte.slice(1, -1)}
        </code>
      )
    }
    return parte
  })
}
