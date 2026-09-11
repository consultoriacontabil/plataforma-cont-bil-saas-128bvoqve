/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    let defaultTenant = null
    try {
      const tenants = app.findRecordsByFilter('tenants', '', 'created', 1, 0)
      if (tenants && tenants.length > 0) {
        defaultTenant = tenants[0]
      }
    } catch (_) {}

    if (!defaultTenant) return

    let inovatech = null
    try {
      inovatech = app.findFirstRecordByData('empresas', 'cnpj', '33.456.789/0001-12')
    } catch (_) {}

    let certificadoInovatech = null
    if (inovatech) {
      try {
        certificadoInovatech = app.findFirstRecordByData(
          'certificados_digitais',
          'empresa',
          inovatech.id,
        )
      } catch (_) {}
    }

    let adminUser = null
    try {
      adminUser = app.findAuthRecordByEmail(
        '_pb_users_auth_',
        'rumo@rumoconsultoriacontabil.com.br',
      )
    } catch (_) {}

    // 1. Seed nfse_config para o tenant
    const cfgCol = app.findCollectionByNameOrId('nfse_config')
    let existingCfg = null
    try {
      existingCfg = app.findFirstRecordByData('nfse_config', 'tenant_id', defaultTenant.id)
    } catch (_) {}

    if (!existingCfg) {
      const cfg = new Record(cfgCol)
      cfg.set('tenant_id', defaultTenant.id)
      if (inovatech) cfg.set('empresa_padrao', inovatech.id)
      cfg.set('webhook_token', 'rumo_wa_live_' + $security.randomString(16))
      cfg.set('evolution_api_url', 'https://evolution.rumo.internal')
      cfg.set('evolution_api_key', 'evo_live_' + $security.randomString(20))
      cfg.set('evolution_instance', 'rumo-fiscal-inovatech')
      cfg.set('modo_operacao', 'simulacao')
      cfg.set('auto_aprovar_alta_confianca', false)
      cfg.set(
        'msg_saudacao',
        'Olá! Sou o assistente de Emissão Inteligente de NFS-e da Rumo Consultoria Contábil. Pode me enviar os dados da nota fiscal a emitir (Tomador, CNPJ/CPF, descrição do serviço e valor).',
      )
      cfg.set(
        'msg_recebimento',
        'Recebi seus dados com sucesso! 📝 Sua solicitação de NFS-e foi estruturada pela nossa IA e está na fila do Painel de Supervisão para conferência do contador responsável. Você receberá o PDF/XML assim que aprovada.',
      )
      cfg.set(
        'msg_aprovacao',
        'Ótima notícia! Sua solicitação de NFS-e foi aprovada pelo contador e está sendo enviada para o motor de emissão fiscal.',
      )
      cfg.set(
        'msg_rejeicao',
        'Olá. Sua solicitação de NFS-e precisou ser devolvida pelo contador com o seguinte apontamento: {{motivo}}. Por favor, responda com os dados corrigidos.',
      )
      cfg.set(
        'msg_nota_emitida',
        'Sua NFS-e Nº {{numero_nota}} foi emitida com sucesso! 🎉\nCódigo de Verificação: {{codigo_verificacao}}\nValor: R$ {{valor}}\n\nSegue o arquivo da nota fiscal para seus registros.',
      )
      cfg.set('telefone_suporte', '(11) 3214-5500')
      cfg.set('ativo', true)
      app.save(cfg)
    }

    // 2. Seed nfse_solicitacoes (3-4 mensagens representativas)
    const solCol = app.findCollectionByNameOrId('nfse_solicitacoes')
    const notasCol = app.findCollectionByNameOrId('nfse_notas_emitidas')

    // Solicitação 1: Alta confiança pronta para aprovar (Tomador Acme Brasil, CNPJ válido, valor R$ 3.850,00)
    let sol1 = null
    try {
      sol1 = app.findFirstRecordByData(
        'nfse_solicitacoes',
        'mensagem_id_externo',
        'evo_msg_seed_001',
      )
    } catch (_) {}

    if (!sol1) {
      sol1 = new Record(solCol)
      sol1.set('tenant_id', defaultTenant.id)
      if (inovatech) sol1.set('empresa', inovatech.id)
      sol1.set('contato_nome', 'Carlos Eduardo Silva (Inovatech Financeiro)')
      sol1.set('contato_telefone', '5511987654321')
      sol1.set('origem_chat_jid', '5511987654321@s.whatsapp.net')
      sol1.set(
        'mensagem_original',
        'Boa tarde equipe Rumo! Precisamos emitir uma NFS-e referente aos serviços de desenvolvimento de software e sustentação em nuvem prestados para a Acme Tecnologia Brasil Ltda, CNPJ 12.345.678/0001-90. Valor acordado: R$ 3.850,00. E-mail para envio: faturamento@acmebrasil.com.br. Código 01.07.',
      )
      sol1.set('mensagem_id_externo', 'evo_msg_seed_001')
      sol1.set('status', 'em_analise')
      sol1.set('score_confianca', 95)
      sol1.set('tomador_nome', 'Acme Tecnologia Brasil Ltda')
      sol1.set('tomador_documento', '12.345.678/0001-90')
      sol1.set('tomador_email', 'faturamento@acmebrasil.com.br')
      sol1.set(
        'tomador_endereco',
        'Av. das Nações Unidas, 12901 - Brooklin Paulista, São Paulo - SP',
      )
      sol1.set(
        'descricao_servico',
        'Serviços de desenvolvimento e sustentação de software em nuvem (SaaS/DevOps).',
      )
      sol1.set('valor_servico', 3850.0)
      sol1.set('codigo_servico', '01.07')
      sol1.set('dados_extraidos_json', {
        tomador_nome: 'Acme Tecnologia Brasil Ltda',
        tomador_documento: '12.345.678/0001-90',
        tipo_documento: 'CNPJ',
        documento_valido: true,
        valor_servico: 3850.0,
        descricao_servico:
          'Serviços de desenvolvimento e sustentação de software em nuvem (SaaS/DevOps).',
        codigo_servico: '01.07',
        tomador_email: 'faturamento@acmebrasil.com.br',
      })
      sol1.set('alertas_json', [])
      sol1.set('resposta_enviada_whatsapp', true)
      sol1.set('historico_mensagens_json', [
        {
          origem: 'cliente',
          texto:
            'Boa tarde equipe Rumo! Precisamos emitir uma NFS-e referente aos serviços de desenvolvimento de software e sustentação em nuvem prestados para a Acme Tecnologia Brasil Ltda, CNPJ 12.345.678/0001-90. Valor acordado: R$ 3.850,00. E-mail para envio: faturamento@acmebrasil.com.br. Código 01.07.',
          data: '2026-09-11 14:10:00',
        },
        {
          origem: 'bot',
          texto:
            'Recebi seus dados com sucesso! 📝 Sua solicitação de NFS-e foi estruturada pela nossa IA e está na fila do Painel de Supervisão para conferência do contador responsável.',
          data: '2026-09-11 14:10:05',
        },
      ])
      app.save(sol1)
    }

    // Solicitação 2: Alerta de CNPJ inválido (Dígito verificador incorreto e e-mail ausente)
    let sol2 = null
    try {
      sol2 = app.findFirstRecordByData(
        'nfse_solicitacoes',
        'mensagem_id_externo',
        'evo_msg_seed_002',
      )
    } catch (_) {}

    if (!sol2) {
      sol2 = new Record(solCol)
      sol2.set('tenant_id', defaultTenant.id)
      if (inovatech) sol2.set('empresa', inovatech.id)
      sol2.set('contato_nome', 'Mariana Lopes (Diretoria Comercial)')
      sol2.set('contato_telefone', '5511976543210')
      sol2.set('origem_chat_jid', '5511976543210@s.whatsapp.net')
      sol2.set(
        'mensagem_original',
        'Favor gerar nota de consultoria técnica em cibersegurança para a Delta Serviços, CNPJ 99.888.777/0001-00 no valor de R$ 2.400,00 reais.',
      )
      sol2.set('mensagem_id_externo', 'evo_msg_seed_002')
      sol2.set('status', 'em_analise')
      sol2.set('score_confianca', 60)
      sol2.set('tomador_nome', 'Delta Serviços')
      sol2.set('tomador_documento', '99.888.777/0001-00')
      sol2.set('tomador_email', '')
      sol2.set(
        'descricao_servico',
        'Consultoria técnica em cibersegurança e auditoria de vulnerabilidades.',
      )
      sol2.set('valor_servico', 2400.0)
      sol2.set('codigo_servico', '01.06')
      sol2.set('dados_extraidos_json', {
        tomador_nome: 'Delta Serviços',
        tomador_documento: '99.888.777/0001-00',
        tipo_documento: 'CNPJ',
        documento_valido: false,
        valor_servico: 2400.0,
        descricao_servico: 'Consultoria técnica em cibersegurança e auditoria de vulnerabilidades.',
        codigo_servico: '01.06',
        tomador_email: '',
      })
      sol2.set('alertas_json', [
        {
          campo: 'tomador_documento',
          tipo: 'erro_validacao',
          mensagem:
            'CNPJ 99.888.777/0001-00 possui dígito verificador inválido pela Receita Federal.',
          severidade: 'bloqueante',
        },
        {
          campo: 'tomador_email',
          tipo: 'campo_ausente',
          mensagem: 'E-mail do tomador não foi identificado na mensagem.',
          severidade: 'atencao',
        },
      ])
      sol2.set('resposta_enviada_whatsapp', true)
      sol2.set('historico_mensagens_json', [
        {
          origem: 'cliente',
          texto:
            'Favor gerar nota de consultoria técnica em cibersegurança para a Delta Serviços, CNPJ 99.888.777/0001-00 no valor de R$ 2.400,00 reais.',
          data: '2026-09-11 15:30:00',
        },
        {
          origem: 'bot',
          texto:
            'Recebi seus dados com sucesso! 📝 Sua solicitação de NFS-e foi estruturada pela nossa IA e está na fila do Painel de Supervisão para conferência do contador responsável.',
          data: '2026-09-11 15:30:03',
        },
      ])
      app.save(sol2)
    }

    // Solicitação 3: Já emitida com XML/PDF gerados e nota associada
    let sol3 = null
    try {
      sol3 = app.findFirstRecordByData(
        'nfse_solicitacoes',
        'mensagem_id_externo',
        'evo_msg_seed_003',
      )
    } catch (_) {}

    if (!sol3) {
      sol3 = new Record(solCol)
      sol3.set('tenant_id', defaultTenant.id)
      if (inovatech) sol3.set('empresa', inovatech.id)
      sol3.set('contato_nome', 'Renata Farias (Inovatech Ops)')
      sol3.set('contato_telefone', '5511998877665')
      sol3.set('origem_chat_jid', '5511998877665@s.whatsapp.net')
      sol3.set(
        'mensagem_original',
        'Olá! Emitir NFS-e para Nexus Soluções Integradas S/A, CNPJ 07.654.321/0001-44, valor R$ 5.200,00. Treinamento de equipes técnicas e suporte mensal. E-mail: financeiro@nexus.com.br.',
      )
      sol3.set('mensagem_id_externo', 'evo_msg_seed_003')
      sol3.set('status', 'emitida')
      sol3.set('score_confianca', 98)
      sol3.set('tomador_nome', 'Nexus Soluções Integradas S/A')
      sol3.set('tomador_documento', '07.654.321/0001-44')
      sol3.set('tomador_email', 'financeiro@nexus.com.br')
      sol3.set('tomador_endereco', 'Rua Bela Cintra, 1100 - Consolação, São Paulo - SP')
      sol3.set(
        'descricao_servico',
        'Treinamento de equipes técnicas e suporte operacional mensal a sistemas.',
      )
      sol3.set('valor_servico', 5200.0)
      sol3.set('codigo_servico', '01.07')
      sol3.set('dados_extraidos_json', {
        tomador_nome: 'Nexus Soluções Integradas S/A',
        tomador_documento: '07.654.321/0001-44',
        tipo_documento: 'CNPJ',
        documento_valido: true,
        valor_servico: 5200.0,
        descricao_servico:
          'Treinamento de equipes técnicas e suporte operacional mensal a sistemas.',
        codigo_servico: '01.07',
        tomador_email: 'financeiro@nexus.com.br',
      })
      sol3.set('alertas_json', [])
      if (adminUser) sol3.set('revisado_por', adminUser.id)
      sol3.set('data_revisao', '2026-09-11 16:00:00.000Z')
      sol3.set('resposta_enviada_whatsapp', true)
      sol3.set('historico_mensagens_json', [
        {
          origem: 'cliente',
          texto:
            'Olá! Emitir NFS-e para Nexus Soluções Integradas S/A, CNPJ 07.654.321/0001-44, valor R$ 5.200,00. Treinamento de equipes técnicas e suporte mensal. E-mail: financeiro@nexus.com.br.',
          data: '2026-09-11 15:50:00',
        },
        {
          origem: 'bot',
          texto:
            'Recebi seus dados com sucesso! 📝 Sua solicitação de NFS-e foi estruturada pela nossa IA e está na fila do Painel de Supervisão para conferência do contador responsável.',
          data: '2026-09-11 15:50:04',
        },
        {
          origem: 'bot',
          texto:
            'Sua NFS-e Nº 2026001 foi emitida com sucesso! 🎉\nCódigo de Verificação: A8F2-99B1-4C3D\nValor: R$ 5.200,00\n\nSegue o arquivo da nota fiscal para seus registros.',
          data: '2026-09-11 16:01:10',
        },
      ])
      app.save(sol3)
    }

    // 3. Seed nfse_notas_emitidas correspondente à solicitação 3
    let nota1 = null
    try {
      nota1 = app.findFirstRecordByData(
        'nfse_notas_emitidas',
        'codigo_verificacao',
        'A8F2-99B1-4C3D',
      )
    } catch (_) {}

    if (!nota1 && inovatech) {
      nota1 = new Record(notasCol)
      nota1.set('tenant_id', defaultTenant.id)
      nota1.set('empresa', inovatech.id)
      if (sol3) nota1.set('solicitacao', sol3.id)
      nota1.set('numero_nota', 2026001)
      nota1.set('serie', 'E')
      nota1.set('codigo_verificacao', 'A8F2-99B1-4C3D')
      nota1.set('chave_acesso', '352609334567890001125600100000202600188991122')
      nota1.set('data_emissao', '2026-09-11 16:01:00.000Z')
      nota1.set('competencia', '2026-09')
      nota1.set('tomador_nome', 'Nexus Soluções Integradas S/A')
      nota1.set('tomador_documento', '07.654.321/0001-44')
      nota1.set('tomador_email', 'financeiro@nexus.com.br')
      nota1.set(
        'discriminacao_servicos',
        'Treinamento de equipes técnicas e suporte operacional mensal a sistemas em nuvem. Conforme proposta comercial aprovada.',
      )
      nota1.set('codigo_servico_municipal', '01.07')
      nota1.set('valor_servicos', 5200.0)
      nota1.set('valor_deducoes', 0.0)
      nota1.set('valor_pis', 33.8)
      nota1.set('valor_cofins', 156.0)
      nota1.set('valor_inss', 0.0)
      nota1.set('valor_ir', 78.0)
      nota1.set('valor_csll', 52.0)
      nota1.set('valor_iss', 104.0)
      nota1.set('aliquota_iss', 2.0)
      nota1.set('valor_liquido', 4880.2)
      nota1.set('iss_retido', false)
      nota1.set('status', 'emitida')
      nota1.set('modo_emissao', 'simulacao')
      if (certificadoInovatech) nota1.set('certificado_usado', certificadoInovatech.id)
      if (adminUser) nota1.set('emitido_por', adminUser.id)
      nota1.set('whatsapp_destinatario', '5511998877665')
      nota1.set('whatsapp_enviado_em', '2026-09-11 16:01:10.000Z')

      const xmlExemplo = `<?xml version="1.0" encoding="UTF-8"?>
<CompNfse xmlns="http://www.abrasf.org.br/nfse.xsd">
  <Nfse versao="2.04">
    <InfNfse Id="NFE2026001">
      <Numero>2026001</Numero>
      <CodigoVerificacao>A8F2-99B1-4C3D</CodigoVerificacao>
      <DataEmissao>2026-09-11T16:01:00</DataEmissao>
      <NaturezaOperacao>1</NaturezaOperacao>
      <RegimeEspecialTributacao>6</RegimeEspecialTributacao>
      <OptanteSimplesNacional>1</OptanteSimplesNacional>
      <IncentivadorCultural>2</IncentivadorCultural>
      <Competencia>2026-09-01</Competencia>
      <PrestadorServico>
        <IdentificacaoPrestador>
          <Cnpj>33456789000112</Cnpj>
          <InscricaoMunicipal>987654-1</InscricaoMunicipal>
        </IdentificacaoPrestador>
        <RazaoSocial>Inovatech Soluções Digitais Ltda</RazaoSocial>
        <NomeFantasia>Inovatech Software</NomeFantasia>
        <Endereco>
          <Endereco>Avenida Paulista</Endereco>
          <Numero>1578</Numero>
          <Complemento>Conjunto 802</Complemento>
          <Bairro>Bela Vista</Bairro>
          <CodigoMunicipio>3550308</CodigoMunicipio>
          <Uf>SP</Uf>
          <Cep>01310100</Cep>
        </Endereco>
        <Contato>
          <Telefone>1132145500</Telefone>
          <Email>financeiro@inovatech.com.br</Email>
        </Contato>
      </PrestadorServico>
      <TomadorServico>
        <IdentificacaoTomador>
          <CpfCnpj>
            <Cnpj>07654321000144</Cnpj>
          </CpfCnpj>
        </IdentificacaoTomador>
        <RazaoSocial>Nexus Soluções Integradas S/A</RazaoSocial>
        <Endereco>
          <Endereco>Rua Bela Cintra</Endereco>
          <Numero>1100</Numero>
          <Bairro>Consolação</Bairro>
          <CodigoMunicipio>3550308</CodigoMunicipio>
          <Uf>SP</Uf>
          <Cep>01415000</Cep>
        </Endereco>
        <Contato>
          <Email>financeiro@nexus.com.br</Email>
        </Contato>
      </TomadorServico>
      <Servico>
        <Valores>
          <ValorServicos>5200.00</ValorServicos>
          <ValorDeducoes>0.00</ValorDeducoes>
          <ValorPis>33.80</ValorPis>
          <ValorCofins>156.00</ValorCofins>
          <ValorInss>0.00</ValorInss>
          <ValorIr>78.00</ValorIr>
          <ValorCsll>52.00</ValorCsll>
          <IssRetido>2</IssRetido>
          <ValorIss>104.00</ValorIss>
          <Aliquota>0.02</Aliquota>
          <ValorLiquidoNfse>4880.20</ValorLiquidoNfse>
        </Valores>
        <ItemListaServico>01.07</ItemListaServico>
        <CodigoTributacaoMunicipio>0107001</CodigoTributacaoMunicipio>
        <Discriminacao>Treinamento de equipes técnicas e suporte operacional mensal a sistemas em nuvem. Conforme proposta comercial aprovada.</Discriminacao>
        <CodigoMunicipio>3550308</CodigoMunicipio>
      </Servico>
    </InfNfse>
  </Nfse>
</CompNfse>`
      nota1.set('xml_conteudo', xmlExemplo)

      app.save(nota1)
    }

    // Solicitação 4: Solicitação com valor em texto/reais em análise
    let sol4 = null
    try {
      sol4 = app.findFirstRecordByData(
        'nfse_solicitacoes',
        'mensagem_id_externo',
        'evo_msg_seed_004',
      )
    } catch (_) {}

    if (!sol4) {
      sol4 = new Record(solCol)
      sol4.set('tenant_id', defaultTenant.id)
      if (inovatech) sol4.set('empresa', inovatech.id)
      sol4.set('contato_nome', 'Lucas Andrade (Gerente de Projetos)')
      sol4.set('contato_telefone', '5511988889999')
      sol4.set('origem_chat_jid', '5511988889999@s.whatsapp.net')
      sol4.set(
        'mensagem_original',
        'Oi Rumo, emitir nota para o cliente Rodrigo Mendes, CPF 123.456.789-00, serviço de configuração de servidor web e proxy reverso. Valor: mil e quinhentos reais (R$ 1.500,00). Enviar para rodrigo.mendes@email.com.',
      )
      sol4.set('mensagem_id_externo', 'evo_msg_seed_004')
      sol4.set('status', 'em_analise')
      sol4.set('score_confianca', 92)
      sol4.set('tomador_nome', 'Rodrigo Mendes')
      sol4.set('tomador_documento', '123.456.789-00')
      sol4.set('tomador_email', 'rodrigo.mendes@email.com')
      sol4.set('descricao_servico', 'Configuração de servidor web e proxy reverso em nuvem.')
      sol4.set('valor_servico', 1500.0)
      sol4.set('codigo_servico', '01.07')
      sol4.set('dados_extraidos_json', {
        tomador_nome: 'Rodrigo Mendes',
        tomador_documento: '123.456.789-00',
        tipo_documento: 'CPF',
        documento_valido: true,
        valor_servico: 1500.0,
        descricao_servico: 'Configuração de servidor web e proxy reverso em nuvem.',
        codigo_servico: '01.07',
        tomador_email: 'rodrigo.mendes@email.com',
      })
      sol4.set('alertas_json', [])
      sol4.set('resposta_enviada_whatsapp', true)
      sol4.set('historico_mensagens_json', [
        {
          origem: 'cliente',
          texto:
            'Oi Rumo, emitir nota para o cliente Rodrigo Mendes, CPF 123.456.789-00, serviço de configuração de servidor web e proxy reverso. Valor: mil e quinhentos reais (R$ 1.500,00). Enviar para rodrigo.mendes@email.com.',
          data: '2026-09-11 16:20:00',
        },
        {
          origem: 'bot',
          texto:
            'Recebi seus dados com sucesso! 📝 Sua solicitação de NFS-e foi estruturada pela nossa IA e está na fila do Painel de Supervisão para conferência do contador responsável.',
          data: '2026-09-11 16:20:04',
        },
      ])
      app.save(sol4)
    }
  },
  (app) => {
    // Reverter seeds se necessário
  },
)
