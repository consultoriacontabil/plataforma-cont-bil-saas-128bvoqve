migrate(
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('company_onboarding_workflow')

      // Verifica se já existe o registro de exemplo
      try {
        const existing = app.findFirstRecordByData(
          'company_onboarding_workflow',
          'token',
          'demo-abertura-2026-rumo-cliente',
        )
        if (existing) return
      } catch (_) {}

      const record = new Record(col)
      record.set('tenant_id', 'l91og8ybo9krtay')
      record.set('empresa_id', '8p0e1w9y7szvtyy')
      record.set('solicitante_id', '5loguqf8bqyguo3')
      record.set('titulo', 'Abertura de Empresa - Clínica Médica Inovação')
      record.set('razao_social_pretendida', 'CLINICA MEDICA INOVACAO LTDA')
      record.set('nome_fantasia_pretendido', 'INOVACAO MEDICINA INTEGRADA')
      record.set('natureza_juridica', 'ltda')
      record.set('porte_pretendido', 'me')
      record.set('regime_pretendido', 'simples_nacional')
      record.set('status', 'em_analise')
      record.set('token', 'demo-abertura-2026-rumo-cliente')
      record.set('link_ativo', true)
      record.set('cliente_nome', 'Dra. Mariana Rocha')
      record.set('cliente_email', 'mariana.rocha@clinicainovacao.com.br')
      record.set('cliente_telefone', '(41) 98877-6655')
      record.set(
        'observacoes',
        'Processo de abertura prioritário para atividade médica ambulatorial.',
      )

      const checklistItems = [
        {
          id: 'doc-rg-socio-1',
          titulo: 'Documento de Identificação Oficial dos Sócios (RG/CNH)',
          categoria: 'socios',
          obrigatorio: true,
          status: 'aprovado',
          detalhe: 'Documento oficial com foto e CPF legível de todos os sócios.',
          nome_arquivo: 'cnh_dra_mariana_rocha.pdf',
          enviado_em: '2026-09-15T14:30:00.000Z',
          revisado_em: '2026-09-15T15:10:00.000Z',
        },
        {
          id: 'doc-comprovante-residencia',
          titulo: 'Comprovante de Endereço Residencial dos Sócios',
          categoria: 'socios',
          obrigatorio: true,
          status: 'recusado',
          detalhe:
            'Conta de consumo recente (água, luz, gás ou telefone) emitida há menos de 90 dias.',
          nome_arquivo: 'comprovante_antigo_2024.pdf',
          enviado_em: '2026-09-15T14:35:00.000Z',
          revisado_em: '2026-09-15T15:15:00.000Z',
          motivo_recusa:
            'A conta de luz enviada data de outubro/2024 (vencida há mais de 90 dias). Por favor anexe uma fatura recente (julho ou agosto/2026).',
        },
        {
          id: 'doc-iptu-sede',
          titulo: 'Carnê de IPTU ou Contrato de Locação da Sede',
          categoria: 'empresa',
          obrigatorio: true,
          status: 'enviado',
          detalhe:
            'Cópia espelho do IPTU constando o número de inscrição imobiliária (SQL/Indicação Fiscal) para consulta prévia de viabilidade.',
          nome_arquivo: 'iptu_2026_curitiba_sala301.pdf',
          enviado_em: '2026-09-16T09:20:00.000Z',
        },
        {
          id: 'doc-registro-crm',
          titulo: 'Certidão de Quitação / Registro no Conselho de Classe (CRM/PR)',
          categoria: 'orgao_classe',
          obrigatorio: true,
          status: 'pendente',
          detalhe: 'Certidão de regularidade profissional no Conselho Regional de Medicina.',
        },
        {
          id: 'doc-procuracao',
          titulo: 'Procuração para Trâmites perante a Junta Comercial',
          categoria: 'societario',
          obrigatorio: false,
          status: 'pendente',
          detalhe:
            'Opcional caso os sócios assinem com certificado digital e-CPF A1/A3 diretamente pelo portal Empresa Fácil / Redesim.',
        },
      ]

      record.set('checklist_docs_json', checklistItems)

      record.set('dados_preliminares_json', {
        razao_social_pretendida: 'CLINICA MEDICA INOVACAO LTDA',
        nome_fantasia_pretendido: 'INOVACAO MEDICINA INTEGRADA',
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

      app.save(record)
    } catch (err) {
      console.log('Erro ao semear workflow de abertura:', err)
    }
  },
  (app) => {
    // down
  },
)
