/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    // 1. Atualizar a coleção tenants com dados do Responsável Técnico Contábil e CRC (NBC PP 01)
    const tenants = app.findCollectionByNameOrId('tenants')

    if (!tenants.fields.getByName('responsavel_tecnico')) {
      tenants.fields.add(
        new TextField({
          name: 'responsavel_tecnico',
          required: false,
        }),
      )
    }

    if (!tenants.fields.getByName('crc_responsavel')) {
      tenants.fields.add(
        new TextField({
          name: 'crc_responsavel',
          required: false,
        }),
      )
    }

    if (!tenants.fields.getByName('email_contato')) {
      tenants.fields.add(
        new EmailField({
          name: 'email_contato',
          required: false,
        }),
      )
    }

    if (!tenants.fields.getByName('endereco_completo')) {
      tenants.fields.add(
        new TextField({
          name: 'endereco_completo',
          required: false,
        }),
      )
    }

    app.save(tenants)

    // Preencher dados padrões do escritório existente
    try {
      const tenant = app.findFirstRecordByData('tenants', 'nome', 'Rumo Consultoria Contábil')
      tenant.set('responsavel_tecnico', 'Carlos Silva (Contador Responsável)')
      tenant.set('crc_responsavel', 'CRC/SP nº 2SP034821/O')
      tenant.set('email_contato', 'assessoria@rumoconsultoriacontabil.com.br')
      tenant.set(
        'endereco_completo',
        'Av. Paulista, 1578, Conjunto 802, Bela Vista - São Paulo / SP',
      )
      app.save(tenant)
    } catch (_) {}
  },
  (app) => {
    try {
      const tenants = app.findCollectionByNameOrId('tenants')
      if (tenants.fields.getByName('responsavel_tecnico')) {
        tenants.fields.removeByName('responsavel_tecnico')
      }
      if (tenants.fields.getByName('crc_responsavel')) {
        tenants.fields.removeByName('crc_responsavel')
      }
      if (tenants.fields.getByName('email_contato')) {
        tenants.fields.removeByName('email_contato')
      }
      if (tenants.fields.getByName('endereco_completo')) {
        tenants.fields.removeByName('endereco_completo')
      }
      app.save(tenants)
    } catch (_) {}
  },
)
