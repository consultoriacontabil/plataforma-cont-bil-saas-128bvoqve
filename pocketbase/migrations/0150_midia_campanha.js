/// <reference path="../pb_data/types.d.ts" />

/**
 * Migration 0150 — hospedagem de mídia para publicação no Instagram.
 *
 * O Instagram NÃO aceita upload de bytes: as rotas de container exigem uma
 * `image_url` / `video_url` pública que a Meta consegue buscar. O arquivo
 * gerado aqui mora no workspace, que não é público.
 *
 * Solução: uma coleção própria, com leitura pública SÓ do arquivo e dos
 * metadados. Serve para a Meta buscar a arte e para o histórico de campanha.
 *
 * Segurança:
 *  - `listRule`/`viewRule` abertas porque a Meta busca sem credencial. Não há
 *    dado de cliente aqui: só arte de marketing e o texto da legenda.
 *  - Escrita exige vínculo de tenant e perfil que não seja `cliente`.
 *  - Delete restrito a administrador.
 *  - Campo `arquivo` com `protected: false` de propósito — URL assinada
 *    expiraria antes de a Meta buscar.
 */
migrate(
  (app) => {
    const tenantsId = app.findCollectionByNameOrId('tenants').id

    const collection = new Collection({
      name: 'midia_campanha',
      type: 'base',
      // público: a Meta precisa baixar a imagem sem autenticação
      listRule: '',
      viewRule: '',
      createRule:
        "@request.auth.id != '' && @request.auth.tenant_members_via_user_id.tenant_id ?= tenant_id && @request.auth.tenant_members_via_user_id.perfil ?!= 'cliente'",
      updateRule:
        "@request.auth.id != '' && @request.auth.tenant_members_via_user_id.tenant_id ?= tenant_id && @request.auth.tenant_members_via_user_id.perfil ?!= 'cliente'",
      deleteRule:
        "@request.auth.id != '' && @request.auth.tenant_members_via_user_id.tenant_id ?= tenant_id && @request.auth.tenant_members_via_user_id.perfil ?= 'administrador'",
      fields: [
        {
          name: 'tenant_id',
          type: 'relation',
          required: true,
          collectionId: tenantsId,
          cascadeDelete: true,
          maxSelect: 1,
        },
        { name: 'campanha', type: 'text', required: true },
        { name: 'ordem', type: 'number', required: false },
        { name: 'legenda', type: 'text', required: false },
        {
          name: 'arquivo',
          type: 'file',
          required: false,
          maxSelect: 1,
          maxSize: 8388608,
          mimeTypes: ['image/jpeg', 'image/png'],
          protected: false,
          thumbs: [],
        },
        {
          name: 'status',
          type: 'select',
          required: false,
          maxSelect: 1,
          values: ['rascunho', 'aprovado', 'publicado', 'descartado'],
        },
        { name: 'publicado_em', type: 'date', required: false },
        { name: 'post_id', type: 'text', required: false },
        { name: 'permalink', type: 'text', required: false },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_midia_campanha_tenant ON midia_campanha (tenant_id)',
        'CREATE INDEX idx_midia_campanha_campanha ON midia_campanha (campanha, ordem)',
      ],
    })

    app.save(collection)
    console.log('[0150] midia_campanha criada (leitura publica para a Meta buscar)')
  },
  (app) => {
    app.delete(app.findCollectionByNameOrId('midia_campanha'))
  },
)
