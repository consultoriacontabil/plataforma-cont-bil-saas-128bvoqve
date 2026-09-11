// Hook: empresas_migracao_lote.js
// Endpoint seguro para processar importação de empresas em lote para migração de outro sistema
// Suporta anti-duplicidade (atualizar ou pular), auditoria no audit_log e histórico na empresas_migracoes_lote.
routerAdd(
  'POST',
  '/backend/v1/empresas/migracao-lote',
  (e) => {
    try {
      const authUser = e.get('authRecord')
      if (!authUser) {
        return e.json(401, {
          success: false,
          mensagem: 'Autenticação necessária.',
        })
      }

      const body = e.requestInfo().body || {}
      const tenantId = body.tenant_id
      const nomeArquivo = body.nome_arquivo || 'planilha_migracao.csv'
      const modoDuplicidade = body.modo_duplicidade === 'atualizar' ? 'atualizar' : 'pular'
      const empresasInput = body.empresas || []

      if (!tenantId) {
        return e.json(400, {
          success: false,
          mensagem: 'tenant_id é obrigatório.',
        })
      }

      // Validar permissão de membro no tenant
      let memberRecord = null
      try {
        memberRecord = $app.findFirstRecordByFilter(
          'tenant_members',
          `tenant_id = {:tenantId} && user_id = {:userId} && status = 'ativo'`,
          { tenantId: tenantId, userId: authUser.id },
        )
      } catch (_) {
        return e.json(403, {
          success: false,
          mensagem: 'Usuário não tem acesso a este escritório.',
        })
      }

      const perfil = memberRecord.getString('perfil')
      if (perfil !== 'administrador' && perfil !== 'contador') {
        return e.json(403, {
          success: false,
          mensagem:
            'Apenas Administradores e Contadores podem importar dados de empresas para migração.',
        })
      }

      if (!empresasInput || !Array.isArray(empresasInput) || empresasInput.length === 0) {
        return e.json(400, {
          success: false,
          mensagem: 'Nenhuma empresa fornecida para importação.',
        })
      }

      // Helper inline para validação de dígitos verificadores de CNPJ
      const validarCnpjInline = (cnpjStr) => {
        if (!cnpjStr) return false
        const clean = String(cnpjStr).replace(/\D/g, '')
        if (clean.length !== 14) return false
        if (/^(\d)\1{13}$/.test(clean)) return false

        let size = clean.length - 2
        let numbers = clean.substring(0, size)
        const digits = clean.substring(size)
        let sum = 0
        let pos = size - 7

        for (let i = size; i >= 1; i--) {
          sum += parseInt(numbers.charAt(size - i), 10) * pos--
          if (pos < 2) pos = 9
        }

        let result = sum % 11 < 2 ? 0 : 11 - (sum % 11)
        if (result !== parseInt(digits.charAt(0), 10)) return false

        size = size + 1
        numbers = clean.substring(0, size)
        sum = 0
        pos = size - 7
        for (let i = size; i >= 1; i--) {
          sum += parseInt(numbers.charAt(size - i), 10) * pos--
          if (pos < 2) pos = 9
        }
        result = sum % 11 < 2 ? 0 : 11 - (sum % 11)
        return result === parseInt(digits.charAt(1), 10)
      }

      // Helper inline para normalizar regime tributário
      const normalizarRegime = (reg) => {
        if (!reg) return 'simples_nacional'
        const lower = String(reg).toLowerCase().trim()
        if (lower.includes('mei') || lower === 'microempreendedor') return 'mei'
        if (lower.includes('presumido')) return 'lucro_presumido'
        if (lower.includes('real')) return 'lucro_real'
        return 'simples_nacional'
      }

      // Helper inline para normalizar porte
      const normalizarPorte = (porte) => {
        if (!porte) return 'me'
        const lower = String(porte).toLowerCase().trim()
        if (lower === 'mei') return 'mei'
        if (lower === 'me' || lower.includes('microempresa')) return 'me'
        if (lower === 'epp' || lower.includes('pequeno')) return 'epp'
        return 'demais'
      }

      // Buscar empresas já cadastradas neste tenant para anti-duplicidade rápida
      const empresasExistentes = $app.findRecordsByFilter(
        'empresas',
        `tenant_id = {:tenantId}`,
        '-created',
        0,
        0,
        { tenantId: tenantId },
      )

      const mapCnpjExistente = {}
      for (let i = 0; i < empresasExistentes.length; i++) {
        const emp = empresasExistentes[i]
        const cleanCnpj = emp.getString('cnpj').replace(/\D/g, '')
        if (cleanCnpj) {
          mapCnpjExistente[cleanCnpj] = emp
        }
      }

      let totalImportadas = 0
      let totalAtualizadas = 0
      let totalPuladas = 0
      let totalErros = 0

      const relatorioLinhas = []
      const empresasCol = $app.findCollectionByNameOrId('empresas')

      for (let index = 0; index < empresasInput.length; index++) {
        const item = empresasInput[index]
        const linhaNum = item.linha || index + 1
        const rawCnpj = item.cnpj ? String(item.cnpj).replace(/\D/g, '') : ''
        const razaoSocial = item.razao_social ? String(item.razao_social).trim() : ''
        const nomeFantasia = item.nome_fantasia ? String(item.nome_fantasia).trim() : ''

        if (!razaoSocial) {
          totalErros++
          relatorioLinhas.push({
            linha: linhaNum,
            cnpj: rawCnpj || 'Não informado',
            razao_social: '(Vazio)',
            status: 'erro',
            motivo: 'Razão Social é obrigatória.',
          })
          continue
        }

        if (!rawCnpj) {
          totalErros++
          relatorioLinhas.push({
            linha: linhaNum,
            cnpj: 'Não informado',
            razao_social: razaoSocial,
            status: 'erro',
            motivo: 'CNPJ ausente ou vazio.',
          })
          continue
        }

        if (!validarCnpjInline(rawCnpj)) {
          totalErros++
          relatorioLinhas.push({
            linha: linhaNum,
            cnpj: rawCnpj,
            razao_social: razaoSocial,
            status: 'erro',
            motivo: 'CNPJ inválido (dígitos verificadores incorretos).',
          })
          continue
        }

        const existe = mapCnpjExistente[rawCnpj]

        if (existe) {
          if (modoDuplicidade === 'pular') {
            totalPuladas++
            relatorioLinhas.push({
              linha: linhaNum,
              cnpj: rawCnpj,
              razao_social: razaoSocial,
              empresa_id: existe.id,
              status: 'pulada',
              motivo:
                'Empresa com este CNPJ já cadastrada no escritório (opção de pular selecionada).',
            })
            continue
          }

          // Atualizar empresa existente
          try {
            if (razaoSocial) existe.set('razao_social', razaoSocial)
            if (nomeFantasia) existe.set('nome_fantasia', nomeFantasia)
            if (item.inscricao_estadual)
              existe.set('inscricao_estadual', String(item.inscricao_estadual).trim())
            if (item.inscricao_municipal)
              existe.set('inscricao_municipal', String(item.inscricao_municipal).trim())
            if (item.regime_tributario)
              existe.set('regime_tributario', normalizarRegime(item.regime_tributario))
            if (item.porte) existe.set('porte', normalizarPorte(item.porte))
            if (item.data_abertura) {
              const dt = String(item.data_abertura).split('T')[0]
              existe.set('data_abertura', `${dt} 00:00:00`)
            }
            if (item.cep) existe.set('cep', String(item.cep).replace(/\D/g, ''))
            if (item.logradouro) existe.set('logradouro', String(item.logradouro).trim())
            if (item.numero) existe.set('numero', String(item.numero).trim())
            if (item.complemento) existe.set('complemento', String(item.complemento).trim())
            if (item.bairro) existe.set('bairro', String(item.bairro).trim())
            if (item.cidade) existe.set('cidade', String(item.cidade).trim())
            if (item.uf) existe.set('uf', String(item.uf).trim().toUpperCase().slice(0, 2))
            if (item.email) existe.set('email', String(item.email).trim().toLowerCase())
            if (item.telefone) existe.set('telefone', String(item.telefone).replace(/\D/g, ''))
            if (item.site) existe.set('site', String(item.site).trim())

            // Concatenar observações caso existam sócios ou honorários
            let obsExtras = item.observacoes ? String(item.observacoes).trim() : ''
            if (item.cnae) obsExtras += (obsExtras ? '\n' : '') + `CNAE: ${item.cnae}`
            if (item.natureza_juridica)
              obsExtras += (obsExtras ? '\n' : '') + `Natureza Jurídica: ${item.natureza_juridica}`
            if (item.socios) obsExtras += (obsExtras ? '\n' : '') + `Sócios: ${item.socios}`
            if (item.honorarios_mensais)
              obsExtras +=
                (obsExtras ? '\n' : '') + `Honorários Migrados: R$ ${item.honorarios_mensais}`

            if (obsExtras) {
              const atualObs = existe.getString('observacoes')
              existe.set(
                'observacoes',
                atualObs ? `${atualObs}\n\n[Migração]: ${obsExtras}` : `[Migração]: ${obsExtras}`,
              )
            }

            $app.save(existe)

            // Processar metadados do certificado se informados
            let temCert = false
            let certInfo = ''
            if (item.certificado_validade) {
              try {
                let valIso = ''
                const v = String(item.certificado_validade).trim()
                if (/^\d{2}\/\d{2}\/\d{4}$/.test(v)) {
                  const parts = v.split('/')
                  valIso = `${parts[2]}-${parts[1]}-${parts[0]} 23:59:59`
                } else if (/^\d{4}-\d{2}-\d{2}/.test(v)) {
                  valIso = `${v.slice(0, 10)} 23:59:59`
                }

                if (valIso) {
                  const certCol = $app.findCollectionByNameOrId('certificados_digitais')
                  // Verifica se já tem certificado para esta empresa
                  let certExistente = null
                  try {
                    certExistente = $app.findFirstRecordByFilter(
                      'certificados_digitais',
                      `tenant_id = {:tenantId} && empresa = {:empresaId}`,
                      { tenantId: tenantId, empresaId: existe.id },
                    )
                  } catch (_) {}

                  const certRecord = certExistente || new Record(certCol)
                  certRecord.set('tenant_id', tenantId)
                  certRecord.set('empresa', existe.id)
                  certRecord.set('tipo', 'a1')
                  certRecord.set('titular', `${razaoSocial.toUpperCase()}:${rawCnpj}`)
                  certRecord.set(
                    'emissor',
                    item.certificado_emissor
                      ? String(item.certificado_emissor).trim()
                      : 'Autoridade Certificadora ICP-Brasil',
                  )
                  if (item.certificado_serie)
                    certRecord.set('numero_serie', String(item.certificado_serie).trim())
                  certRecord.set('validade', valIso)
                  certRecord.set('status', 'ativo')
                  certRecord.set(
                    'observacoes',
                    'Certificado migrado via planilha. Senha deve ser configurada na ficha da empresa.',
                  )
                  $app.save(certRecord)
                  temCert = true
                  certInfo = `Certificado A1 gravado (Validade: ${item.certificado_validade}, Emissor: ${item.certificado_emissor || 'ICP-Brasil'})`
                }
              } catch (certSaveErr) {
                console.log('Aviso ao persistir metadados do certificado:', certSaveErr)
              }
            }

            totalAtualizadas++
            relatorioLinhas.push({
              linha: linhaNum,
              cnpj: rawCnpj,
              razao_social: razaoSocial,
              empresa_id: existe.id,
              status: 'atualizada',
              motivo: 'Cadastro existente atualizado com sucesso.',
              tem_certificado: temCert,
              certificado_info: certInfo,
            })
          } catch (errUp) {
            totalErros++
            relatorioLinhas.push({
              linha: linhaNum,
              cnpj: rawCnpj,
              razao_social: razaoSocial,
              status: 'erro',
              motivo: `Falha ao atualizar registro existente: ${errUp.message || 'Erro desconhecido'}`,
            })
          }
          continue
        }

        // Criar nova empresa
        try {
          const novaEmpresa = new Record(empresasCol)
          novaEmpresa.set('tenant_id', tenantId)
          novaEmpresa.set('razao_social', razaoSocial)
          novaEmpresa.set('nome_fantasia', nomeFantasia || razaoSocial)
          novaEmpresa.set('cnpj', rawCnpj)
          novaEmpresa.set(
            'inscricao_estadual',
            item.inscricao_estadual ? String(item.inscricao_estadual).trim() : '',
          )
          novaEmpresa.set(
            'inscricao_municipal',
            item.inscricao_municipal ? String(item.inscricao_municipal).trim() : '',
          )
          novaEmpresa.set('regime_tributario', normalizarRegime(item.regime_tributario))
          novaEmpresa.set('porte', normalizarPorte(item.porte))
          if (item.data_abertura) {
            const dt = String(item.data_abertura).split('T')[0]
            novaEmpresa.set('data_abertura', `${dt} 00:00:00`)
          }
          novaEmpresa.set('cep', item.cep ? String(item.cep).replace(/\D/g, '') : '')
          novaEmpresa.set('logradouro', item.logradouro ? String(item.logradouro).trim() : '')
          novaEmpresa.set('numero', item.numero ? String(item.numero).trim() : '')
          novaEmpresa.set('complemento', item.complemento ? String(item.complemento).trim() : '')
          novaEmpresa.set('bairro', item.bairro ? String(item.bairro).trim() : '')
          novaEmpresa.set('cidade', item.cidade ? String(item.cidade).trim() : '')
          novaEmpresa.set('uf', item.uf ? String(item.uf).trim().toUpperCase().slice(0, 2) : 'SP')
          novaEmpresa.set('pais', 'Brasil')
          if (item.email) novaEmpresa.set('email', String(item.email).trim().toLowerCase())
          novaEmpresa.set('telefone', item.telefone ? String(item.telefone).replace(/\D/g, '') : '')
          novaEmpresa.set('site', item.site ? String(item.site).trim() : '')
          novaEmpresa.set('status', 'ativo')

          let obsExtras = item.observacoes ? String(item.observacoes).trim() : ''
          if (item.cnae) obsExtras += (obsExtras ? '\n' : '') + `CNAE: ${item.cnae}`
          if (item.natureza_juridica)
            obsExtras += (obsExtras ? '\n' : '') + `Natureza Jurídica: ${item.natureza_juridica}`
          if (item.socios) obsExtras += (obsExtras ? '\n' : '') + `Sócios: ${item.socios}`
          if (item.honorarios_mensais)
            obsExtras +=
              (obsExtras ? '\n' : '') + `Honorários Migrados: R$ ${item.honorarios_mensais}`

          novaEmpresa.set('observacoes', obsExtras ? `[Migração Inicial]:\n${obsExtras}` : '')

          $app.save(novaEmpresa)

          // Processar metadados do certificado se informados na planilha
          let temCert = false
          let certInfo = ''
          if (item.certificado_validade) {
            try {
              let valIso = ''
              const v = String(item.certificado_validade).trim()
              if (/^\d{2}\/\d{2}\/\d{4}$/.test(v)) {
                const parts = v.split('/')
                valIso = `${parts[2]}-${parts[1]}-${parts[0]} 23:59:59`
              } else if (/^\d{4}-\d{2}-\d{2}/.test(v)) {
                valIso = `${v.slice(0, 10)} 23:59:59`
              }

              if (valIso) {
                const certCol = $app.findCollectionByNameOrId('certificados_digitais')
                const certRecord = new Record(certCol)
                certRecord.set('tenant_id', tenantId)
                certRecord.set('empresa', novaEmpresa.id)
                certRecord.set('tipo', 'a1')
                certRecord.set('titular', `${razaoSocial.toUpperCase()}:${rawCnpj}`)
                certRecord.set(
                  'emissor',
                  item.certificado_emissor
                    ? String(item.certificado_emissor).trim()
                    : 'Autoridade Certificadora ICP-Brasil',
                )
                if (item.certificado_serie)
                  certRecord.set('numero_serie', String(item.certificado_serie).trim())
                certRecord.set('validade', valIso)
                certRecord.set('status', 'ativo')
                certRecord.set(
                  'observacoes',
                  'Certificado migrado via planilha. Senha e arquivo .pfx devem ser configurados na ficha da empresa.',
                )
                $app.save(certRecord)
                temCert = true
                certInfo = `Certificado A1 gravado (Validade: ${item.certificado_validade}, Emissor: ${item.certificado_emissor || 'ICP-Brasil'})`
              }
            } catch (certSaveErr) {
              console.log('Aviso ao persistir metadados do certificado novo:', certSaveErr)
            }
          }

          // Adicionar no mapa local para evitar duplicidade de linhas na mesma planilha
          mapCnpjExistente[rawCnpj] = novaEmpresa

          totalImportadas++
          relatorioLinhas.push({
            linha: linhaNum,
            cnpj: rawCnpj,
            razao_social: razaoSocial,
            empresa_id: novaEmpresa.id,
            status: 'importada',
            motivo: 'Nova empresa importada e integrada com sucesso.',
            tem_certificado: temCert,
            certificado_info: certInfo,
          })
        } catch (errCr) {
          totalErros++
          relatorioLinhas.push({
            linha: linhaNum,
            cnpj: rawCnpj,
            razao_social: razaoSocial,
            status: 'erro',
            motivo: `Erro ao salvar empresa: ${errCr.message || 'Erro de validação'}`,
          })
        }
      }

      // Se importou ao menos 1 empresa, atualiza checklist de onboarding caso necessário
      if (totalImportadas > 0) {
        try {
          const tenantRecord = $app.findRecordById('tenants', tenantId)
          const checklist = tenantRecord.get('onboarding_checklist') || {}
          if (!checklist.primeira_empresa) {
            checklist.primeira_empresa = true
            tenantRecord.set('onboarding_checklist', checklist)
            $app.save(tenantRecord)
          }
        } catch (onbErr) {
          console.log('Aviso ao atualizar onboarding:', onbErr)
        }
      }

      // 1. Gravar registro no lote de migração
      let migracaoRecordId = ''
      try {
        const migCol = $app.findCollectionByNameOrId('empresas_migracoes_lote')
        const migRecord = new Record(migCol)
        migRecord.set('tenant_id', tenantId)
        migRecord.set('usuario_id', authUser.id)
        migRecord.set('nome_arquivo', nomeArquivo)
        migRecord.set('modo_duplicidade', modoDuplicidade)
        migRecord.set('total_linhas', empresasInput.length)
        migRecord.set('total_importadas', totalImportadas)
        migRecord.set('total_atualizadas', totalAtualizadas)
        migRecord.set('total_puladas', totalPuladas)
        migRecord.set('total_erros', totalErros)
        migRecord.set('relatorio_json', relatorioLinhas)
        $app.save(migRecord)
        migracaoRecordId = migRecord.id
      } catch (migErr) {
        console.log('Erro ao salvar registro de lote de migração:', migErr)
      }

      // 2. Gravar auditoria no audit_log
      try {
        const auditCol = $app.findCollectionByNameOrId('audit_log')
        const auditRecord = new Record(auditCol)
        auditRecord.set('tenant_id', tenantId)
        auditRecord.set('usuario_id', authUser.id)
        auditRecord.set('acao', 'Importação em Lote de Empresas (Migração)')
        auditRecord.set('entidade_tipo', 'empresas_migracoes_lote')
        auditRecord.set('entidade_id', migracaoRecordId || tenantId)
        auditRecord.set(
          'detalhes',
          `Arquivo: "${nomeArquivo}" | Modo: ${modoDuplicidade} | Total: ${empresasInput.length} | Importadas: ${totalImportadas} | Atualizadas: ${totalAtualizadas} | Puladas: ${totalPuladas} | Erros: ${totalErros}`,
        )
        $app.save(auditRecord)
      } catch (audErr) {
        console.log('Erro ao registrar auditoria de migração:', audErr)
      }

      const comCertCount = relatorioLinhas.filter((r) => r.tem_certificado).length
      const semCertCount = totalImportadas + totalAtualizadas - comCertCount

      return e.json(200, {
        success: true,
        resumo: {
          totalLinhas: empresasInput.length,
          importadas: totalImportadas,
          atualizadas: totalAtualizadas,
          puladas: totalPuladas,
          erros: totalErros,
          comCertificado: comCertCount,
          semCertificado: semCertCount,
        },
        relatorio: relatorioLinhas,
        migracaoId: migracaoRecordId,
      })
    } catch (err) {
      console.log('Falha fatal na rota de migração em lote:', err)
      return e.json(500, {
        success: false,
        mensagem: err.message || 'Erro interno ao processar migração em lote de empresas.',
      })
    }
  },
  $apis.requireAuth(),
)
