/// <reference path="../pb_data/types.d.ts" />

/**
 * Migration 0135 — Cofre de credenciais (schema).
 *
 * Cria `credenciais_cofre`, a única coleção autorizada a guardar segredo.
 * O valor vai cifrado em AES-256-GCM por `$security.encrypt`, com a chave
 * mestra em `$secrets.get('CREDENTIALS_VAULT_KEY')` — fora do banco.
 *
 * REGRAS: todas as cinco ficam `null` de propósito. Em PocketBase `null`
 * significa "somente superusuário". Nenhum usuário, nem administrador do
 * escritório, lê ou escreve o cofre pela API: só hooks server-side (`$app`).
 * Isso é intencional — ciphertext exposto não é segredo.
 *
 * A migration seguinte (0136) copia os valores que hoje estão em texto claro
 * para cá SEM apagar o original, o que permite conferir a decifragem contra o
 * valor original antes de qualquer remoção.
 *
 * Rollback: apaga a coleção. Nenhum dado de negócio depende dela ainda.
 */
migrate(
  (app) => {
    const tenantsId = app.findCollectionByNameOrId('tenants').id

    const collection = new Collection({
      name: 'credenciais_cofre',
      type: 'base',
      listRule: null,
      viewRule: null,
      createRule: null,
      updateRule: null,
      deleteRule: null,
      fields: [
        {
          name: 'tenant_id',
          type: 'relation',
          required: true,
          collectionId: tenantsId,
          cascadeDelete: true,
          maxSelect: 1,
        },
        // Coleção de origem do segredo (ex.: "nfse_config", "certificados_digitais")
        { name: 'escopo', type: 'text', required: true },
        // Id do registro de origem
        { name: 'registro_id', type: 'text', required: true },
        // Nome do campo de origem (ex.: "govbr_client_secret")
        { name: 'campo', type: 'text', required: true },
        // ciphertext base64 do AES-256-GCM
        { name: 'ciphertext', type: 'text', required: true },
        { name: 'key_version', type: 'number', required: true },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_cofre_escopo_reg_campo ON credenciais_cofre (escopo, registro_id, campo)',
        'CREATE INDEX idx_cofre_tenant ON credenciais_cofre (tenant_id)',
      ],
    })

    app.save(collection)
    console.log('[0135] cofre criado: credenciais_cofre (acesso somente via hook)')
  },
  (app) => {
    app.delete(app.findCollectionByNameOrId('credenciais_cofre'))
  },
)
