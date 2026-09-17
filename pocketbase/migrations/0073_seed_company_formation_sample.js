migrate(
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('company_formation')
      const empresa = app.findCollectionByNameOrId('empresas')

      // Verificar se a empresa COLATO & ROCHA existe
      let colato
      try {
        colato = app.findFirstRecordByData('empresas', 'cnpj', '59696561000110')
      } catch (_) {
        return // se não existir, pula o seed
      }

      // Idempotência
      try {
        app.findFirstRecordByData('company_formation', 'empresa', colato.id)
        return // Já possui processo semeado
      } catch (_) {}

      const record = new Record(col)
      record.set('tenant_id', colato.getString('tenant_id'))
      record.set('empresa', colato.id)
      record.set('natureza_juridica', 'ltda')
      record.set('porte_pretendido', 'me')
      record.set('regime_pretendido', 'simples_nacional')
      record.set('status_processo', 'protocolado_junta')
      record.set('capital_social_total', 50000)
      record.set('quotas_total', 50000)
      record.set('valor_nominal_quota', 1)

      const socios = [
        {
          id: 'socio_1',
          tipo_pessoa: 'PF',
          nome_razao: 'Dra. Camila Colato',
          cpf_cnpj: '048.912.439-82',
          percentual_cotas: 60,
          quantidade_cotas: 30000,
          valor_participacao: 30000,
          data_entrada: '2025-01-15',
          pais_residencia: 'Brasil',
          residente_exterior: false,
          cargo_funcao: 'Sócio-Administrador',
          representante_legal: '',
          qualificacao: '49 - Sócio-Administrador',
          pro_labore: true,
        },
        {
          id: 'socio_2',
          tipo_pessoa: 'PF',
          nome_razao: 'Dr. Lucas Rocha',
          cpf_cnpj: '315.821.908-11',
          percentual_cotas: 40,
          quantidade_cotas: 20000,
          valor_participacao: 20000,
          data_entrada: '2025-01-15',
          pais_residencia: 'Brasil',
          residente_exterior: false,
          cargo_funcao: 'Sócio Cotista',
          representante_legal: '',
          qualificacao: '22 - Sócio',
          pro_labore: false,
        },
      ]
      record.set('socios_json', socios)

      const cnaes = {
        principal: {
          codigo: '8630-5/03',
          descricao: 'Atividade médica ambulatorial restrita a consultas',
          exigeConselho: true,
          orgaoRegistro: 'CRM (Conselho Regional de Medicina)',
          impedidoMei: true,
          anexoSimples: 'Anexo III ou V (Fator R)',
        },
        secundarios: [
          {
            codigo: '8630-5/02',
            descricao: 'Atividades de reprodução humana assistida',
            exigeConselho: true,
            orgaoRegistro: 'CRM',
            impedidoMei: true,
            anexoSimples: 'Anexo III ou V (Fator R)',
          },
          {
            codigo: '8640-2/08',
            descricao:
              'Serviços de diagnóstico por registro gráfico - ECG, EEG e outros exames análogos',
            exigeConselho: true,
            orgaoRegistro: 'CRM / Vigilância Sanitária',
            impedidoMei: true,
            anexoSimples: 'Anexo III ou V',
          },
        ],
      }
      record.set('cnaes_json', cnaes)

      const etapas = [
        {
          id: 'etapa_1',
          nome: 'Viabilidade Locacional & Consulta Prévia de Endereço',
          status: 'concluido',
          data_inicio: '2025-01-16',
          data_conclusao: '2025-01-18',
          responsavel: 'Equipe de Abertura',
          observacao:
            'Aprovada viabilidade na Prefeitura Municipal de Curitiba sem restrições de zoneamento.',
          protocolo: 'VIB-2025-00192',
        },
        {
          id: 'etapa_2',
          nome: 'Pesquisa e Reserva de Nome Empresarial (Junta Comercial)',
          status: 'concluido',
          data_inicio: '2025-01-18',
          data_conclusao: '2025-01-20',
          responsavel: 'Equipe de Abertura',
          observacao: 'Nome "COLATO & ROCHA SERVICOS MEDICOS LTDA" deferido na JUCEPAR.',
          protocolo: 'JUCEPAR-NOM-88219',
        },
        {
          id: 'etapa_3',
          nome: 'Elaboração e Assinatura do Ato Constitutivo (Contrato Social)',
          status: 'concluido',
          data_inicio: '2025-01-20',
          data_conclusao: '2025-01-25',
          responsavel: 'Contador Responsável',
          observacao:
            'Contrato Social assinado digitalmente ICP-Brasil e GOV.BR pelos dois sócios.',
          protocolo: 'CONTRATO-V1-OK',
        },
        {
          id: 'etapa_4',
          nome: 'Registro na Junta Comercial & DBE (Documento Básico de Entrada)',
          status: 'em_andamento',
          data_inicio: '2025-01-26',
          data_conclusao: '',
          responsavel: 'Equipe Paralegal',
          observacao:
            'Protocolado DBE via Redesim/JUCEPAR. Aguardando conferência final de chancela digital.',
          protocolo: 'PRP2025-9921448',
        },
        {
          id: 'etapa_5',
          nome: 'Inscrição no CNPJ, Inscrição Estadual (se aplicável) e Municipal (CCM)',
          status: 'pendente',
          data_inicio: '',
          data_conclusao: '',
          responsavel: 'Equipe Fiscal',
          observacao: 'Depende da homologação do registro mercantil da JUCEPAR.',
          protocolo: '',
        },
        {
          id: 'etapa_6',
          nome: 'Registro no Órgão de Classe (CRM-PR) & Licenciamento Sanitário',
          status: 'pendente',
          data_inicio: '',
          data_conclusao: '',
          responsavel: 'Dra. Camila Colato / Paralegal',
          observacao: 'Exigência legal do art. 1º da Lei 6.839/80 e Resoluções CFM.',
          protocolo: '',
        },
        {
          id: 'etapa_7',
          nome: 'Opção pelo Enquadramento Tributário (Simples Nacional / Fator R)',
          status: 'pendente',
          data_inicio: '',
          data_conclusao: '',
          responsavel: 'Departamento Fiscal',
          observacao:
            'Prazo fatal: até 30 dias do deferimento do último registro municipal/estadual.',
          protocolo: '',
        },
        {
          id: 'etapa_8',
          nome: 'Abertura de Contas Bancárias PJ & Filiações Finais',
          status: 'pendente',
          data_inicio: '',
          data_conclusao: '',
          responsavel: 'Sócios',
          observacao: 'Contas bancárias, certificado digital e-CNPJ A1 e credenciamentos.',
          protocolo: '',
        },
      ]
      record.set('etapas_json', etapas)

      const checklist = [
        {
          id: 'doc_1',
          categoria: 'socios',
          titulo: 'Documento Pessoal dos Sócios (RG/CNH + CPF)',
          obrigatorio: true,
          status: 'recebido',
          data_recebimento: '2025-01-16',
          detalhe: 'Dra. Camila Colato e Dr. Lucas Rocha (CNH digital anexada)',
          ged_documento_id: '',
        },
        {
          id: 'doc_2',
          categoria: 'socios',
          titulo: 'Comprovante de Endereço Residencial dos Sócios',
          obrigatorio: true,
          status: 'recebido',
          data_recebimento: '2025-01-16',
          detalhe: 'Contas de consumo recentes (menos de 90 dias)',
          ged_documento_id: '',
        },
        {
          id: 'doc_3',
          categoria: 'empresa',
          titulo: 'Espelho do IPTU do Imóvel Sede ou Contrato de Locação',
          obrigatorio: true,
          status: 'recebido',
          data_recebimento: '2025-01-17',
          detalhe: 'Inscrição imobiliária e viabilidade cadastral do imóvel',
          ged_documento_id: '',
        },
        {
          id: 'doc_4',
          categoria: 'viabilidade',
          titulo: 'Consulta Prévia de Viabilidade Municipal Deferida',
          obrigatorio: true,
          status: 'recebido',
          data_recebimento: '2025-01-18',
          detalhe: 'Prefeitura Municipal de Curitiba',
          ged_documento_id: '',
        },
        {
          id: 'doc_5',
          categoria: 'societario',
          titulo: 'Minuta do Contrato Social Aprovada e Assinada',
          obrigatorio: true,
          status: 'recebido',
          data_recebimento: '2025-01-25',
          detalhe: 'Adequado ao Código Civil arts. 997 e 1.052 c/ Lei 13.874/19',
          ged_documento_id: '',
        },
        {
          id: 'doc_6',
          categoria: 'orgao_classe',
          titulo: 'Certidão de Quitação / Registro Profissional no Conselho (CRM)',
          obrigatorio: true,
          status: 'recebido',
          data_recebimento: '2025-01-26',
          detalhe: 'CRM-PR dos médicos responsáveis',
          ged_documento_id: '',
        },
        {
          id: 'doc_7',
          categoria: 'mercantil',
          titulo: 'Protocolo e Capa de Processo Junta Comercial / Redesim',
          obrigatorio: true,
          status: 'em_andamento',
          data_recebimento: '',
          detalhe: 'Taxa DARE recolhida e processo aguardando chancela da JUCEPAR',
          ged_documento_id: '',
        },
        {
          id: 'doc_8',
          categoria: 'licencas',
          titulo: 'Alvará Sanitário / Licença da Vigilância Sanitária',
          obrigatorio: true,
          status: 'pendente',
          data_recebimento: '',
          detalhe: 'Necessário para consultório e clínicas médicas (CNAE 8630-5)',
          ged_documento_id: '',
        },
      ]
      record.set('documentos_checklist_json', checklist)
      record.set(
        'base_legal_versao',
        'Marco Legal 2026 (Lei 13.874/19, CC arts. 982-1087, LC 123/06, Lei 14.195/21)',
      )
      record.set('integracao_gerada', false)
      record.set(
        'observacoes',
        'Processo de abertura em estágio avançado na Junta Comercial do Paraná (JUCEPAR). Médicos possuem registro ativo no CRM-PR.',
      )

      app.save(record)
    } catch (e) {
      console.log('Erro ao semear processo de abertura da empresa:', e)
    }
  },
  (app) => {
    try {
      const record = app.findFirstRecordByData(
        'company_formation',
        'status_processo',
        'protocolado_junta',
      )
      app.delete(record)
    } catch (_) {}
  },
)
