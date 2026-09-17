migrate(
  (app) => {
    try {
      // Localiza o registro de demonstração pelo token ou id
      let demo = null
      try {
        demo = app.findFirstRecordByData(
          'company_onboarding_workflow',
          'token',
          'demo-abertura-2026-rumo-cliente',
        )
      } catch (_) {}

      if (demo) {
        // Ajusta o processo em andamento para refletir o novo comportamento:
        // Dados de identificação definitiva da empresa (natureza_juridica, razao_social_pretendida,
        // cliente_nome, cliente_telefone, empresa_id) vazios no início/durante o andamento.
        // O processo continua ativo/em andamento e o card exibirá "a definir na conclusão".
        // Armazenamos no dados_preliminares_json como sugestão/intenção preliminar,
        // enquanto os campos canônicos do registro só são definidos na conclusão.
        demo.set('razao_social_pretendida', '')
        demo.set('cliente_nome', '')
        demo.set('cliente_telefone', '')
        demo.set('cliente_email', '')
        demo.set('natureza_juridica', 'ltda')
        demo.set('empresa_id', '') // sem vínculo definitivo antes de concluir

        // Mantém dados preliminares para alimentar a sugestão no modal de conclusão
        demo.set('dados_preliminares_json', {
          sugestao_razao_social: 'CLINICA MEDICA INOVACAO LTDA',
          sugestao_cliente_nome: 'Dra. Mariana Rocha',
          sugestao_cliente_telefone: '(41) 98877-6655',
          sugestao_cliente_email: 'mariana.rocha@clinicainovacao.com.br',
          natureza_juridica: 'ltda',
          capital_social_pretendido: 50000,
          cnpj_pretendido: '',
          socios: [
            {
              nome: 'Dra. Mariana Rocha',
              cpf: '123.456.789-00',
              email: 'mariana.rocha@clinicainovacao.com.br',
              telefone: '(41) 98877-6655',
              percentual_cotas: 60,
            },
            {
              nome: 'Dr. Lucas Colato',
              cpf: '987.654.321-11',
              email: 'lucas.colato@clinicainovacao.com.br',
              telefone: '(41) 99988-1122',
              percentual_cotas: 40,
            },
          ],
        })

        app.save(demo)
      }
    } catch (err) {
      console.log('Erro ao atualizar seed de onboarding workflow 0079:', err)
    }
  },
  (app) => {
    // down
  },
)
