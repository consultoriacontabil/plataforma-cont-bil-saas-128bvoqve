// Hook: documentos_extrair_empresa.js
// Rota para ler documento enviado (PDF, DOCX, etc.) via $documents.toMarkdown
// e extrair dados cadastrais para o Cadastro Assistido.
routerAdd(
  'POST',
  '/backend/v1/documentos/extrair-empresa',
  (e) => {
    try {
      const files = e.findUploadedFiles('arquivo')
      if (!files || files.length === 0) {
        throw new BadRequestError('Nenhum arquivo enviado para análise.')
      }

      const file = files[0]
      const fileName = file.originalName || file.name || 'documento'
      const isPdfOrOffice =
        fileName.match(/\.(pdf|docx|xlsx|pptx)$/i) ||
        (file.header &&
          file.header.get('Content-Type') &&
          file.header.get('Content-Type').includes('pdf'))

      let markdown = ''
      let isScanned = false

      if (isPdfOrOffice) {
        try {
          const docRes = $documents.toMarkdown({ file: file })
          markdown = (docRes && docRes.markdown) || ''
        } catch (docErr) {
          if (docErr && docErr.status === 422) {
            isScanned = true
            return e.json(422, {
              success: false,
              erro: 'documento_digitalizado_sem_ocr',
              mensagem:
                'O arquivo parece ser um documento digitalizado (imagem sem camada de texto selecionável). Por favor envie a versão digital original (ex: Cartão CNPJ gerado no site da Receita Federal) ou copie os dados.',
            })
          }
          if (docErr && docErr.status === 413) {
            return e.json(413, {
              success: false,
              erro: 'arquivo_muito_grande',
              mensagem: 'O arquivo excede o limite máximo permitido para conversão de texto.',
            })
          }
          throw docErr
        }
      }

      return e.json(200, {
        success: true,
        fileName: fileName,
        markdown: markdown,
        isScanned: isScanned,
      })
    } catch (err) {
      console.log('Erro ao processar documento para extrair empresa:', err)
      return e.json(err.status || 500, {
        success: false,
        erro: 'falha_extracao',
        mensagem: err.message || 'Falha ao processar o documento.',
      })
    }
  },
  $apis.requireAuth(),
)
