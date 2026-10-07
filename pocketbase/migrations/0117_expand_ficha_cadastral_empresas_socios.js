migrate(
  (app) => {
    // Migration 0117: Estender `empresas` e `socios` com os campos da Ficha Cadastral Completa
    // Layout de referência: "Consulta de Empresa" (Identificação, Societário por sócio, Parametrização)
    const empresasCol = app.findCollectionByNameOrId('empresas')
    const sociosCol = app.findCollectionByNameOrId('socios')

    // 1. Campos em `empresas`
    const camposEmpresas = [
      // Identificação
      { name: 'tag', type: 'text' },
      { name: 'codigo_interno', type: 'text' },
      { name: 'percentual_contratual', type: 'number' },
      { name: 'codigo_externo', type: 'text' },
      { name: 'razao_social_2', type: 'text' },
      { name: 'razao_social_3', type: 'text' },
      { name: 'nire', type: 'text' },
      { name: 'cemail', type: 'text' },
      { name: 'naf_ecnpj', type: 'text' },
      // Localização
      { name: 'area_ocupada_m2', type: 'text' },
      { name: 'atuacao', type: 'text' },
      { name: 'unidade', type: 'text' },
      { name: 'unidade_auxiliar', type: 'text' },
      { name: 'atividade_descricao', type: 'text' },
      // Parametrização
      { name: 'segmento', type: 'text' },
      { name: 'subsegmento', type: 'text' },
      { name: 'natureza_juridica', type: 'text' },
      { name: 'capital_social', type: 'number' },
      { name: 'cnae_principal', type: 'text' },
      { name: 'cnaes_secundarios', type: 'text' },
      { name: 'fator_r_optante', type: 'bool' },
      { name: 'fator_r_alteracao_automatica_prolabore', type: 'bool' },
      { name: 'anexo_simples', type: 'text' },
      { name: 'tipo_de_nota', type: 'text' },
      { name: 'servicos_config_json', type: 'json' },
    ]

    for (const c of camposEmpresas) {
      if (!empresasCol.fields.getByName(c.name)) {
        if (c.type === 'text') {
          empresasCol.fields.add(new TextField({ name: c.name }))
        } else if (c.type === 'number') {
          empresasCol.fields.add(new NumberField({ name: c.name }))
        } else if (c.type === 'bool') {
          empresasCol.fields.add(new BoolField({ name: c.name }))
        } else if (c.type === 'json') {
          empresasCol.fields.add(new JSONField({ name: c.name }))
        }
      }
    }
    app.save(empresasCol)

    // 2. Campos em `socios`
    const camposSocios = [
      { name: 'data_nascimento', type: 'date' },
      { name: 'rg', type: 'text' },
      { name: 'data_expedicao_rg', type: 'date' },
      { name: 'orgao_expedicao_rg', type: 'text' },
      { name: 'uf_expedicao_rg', type: 'text' },
      { name: 'naturalidade', type: 'text' },
      { name: 'uf_nascimento', type: 'text' },
      { name: 'estado_civil', type: 'text' },
      { name: 'regime_bens', type: 'text' },
      { name: 'titulo_eleitor', type: 'text' },
      { name: 'recibo_irpf', type: 'text' },
      { name: 'registro_spc', type: 'text' },
      { name: 'nacionalidade', type: 'text' },
      // Endereço específico do sócio
      { name: 'cep_endereco', type: 'text' },
      { name: 'logradouro_endereco', type: 'text' },
      { name: 'numero_endereco', type: 'text' },
      { name: 'complemento_endereco', type: 'text' },
      { name: 'bairro_endereco', type: 'text' },
      { name: 'cidade_endereco', type: 'text' },
      { name: 'uf_endereco', type: 'text' },
      { name: 'serie_gv_scr', type: 'text' },
      { name: 'serie_gvr_scr', type: 'text' },
      { name: 'senha_govbr', type: 'text' },
      // Documentos anexados do sócio
      { name: 'documentos_socios_json', type: 'json' },
    ]

    for (const c of camposSocios) {
      if (!sociosCol.fields.getByName(c.name)) {
        if (c.type === 'text') {
          sociosCol.fields.add(new TextField({ name: c.name }))
        } else if (c.type === 'number') {
          sociosCol.fields.add(new NumberField({ name: c.name }))
        } else if (c.type === 'bool') {
          sociosCol.fields.add(new BoolField({ name: c.name }))
        } else if (c.type === 'date') {
          sociosCol.fields.add(new DateField({ name: c.name }))
        } else if (c.type === 'json') {
          sociosCol.fields.add(new JSONField({ name: c.name }))
        }
      }
    }
    app.save(sociosCol)
  },
  (app) => {
    // Reversão limpa se necessário
  },
)
