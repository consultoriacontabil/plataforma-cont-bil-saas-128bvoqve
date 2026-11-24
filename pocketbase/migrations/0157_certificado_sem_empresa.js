/// <reference path="../pb_data/types.d.ts" />

// 0157 — Permite o certificado digital A1 sobreviver sem empresa.
//
// MOTIVO: `certificados_digitais.empresa` era relação OBRIGATÓRIA com
// cascadeDelete. Ao zerar a base (apagar `empresas`), o PocketBase arrastaria
// junto todos os 17 certificados A1 — incluindo o e-CNPJ do escritório — o que
// contradiz a instrução de PRESERVAR o certificado A1 (infraestrutura).
// Com o campo opcional e sem cascade, o certificado permanece, desvinculado da
// empresa, guardando titular/CNPJ/validade/senha (no cofre).
//
// Reversão: volta a exigir empresa e religa o cascade (só é seguro depois de
// recadastrar as empresas e revincular os certificados).
migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('certificados_digitais')
    const campo = col.fields.getByName('empresa')
    if (campo) {
      campo.required = false
      campo.cascadeDelete = false
    }
    app.save(col)
  },
  (app) => {
    const col = app.findCollectionByNameOrId('certificados_digitais')
    const campo = col.fields.getByName('empresa')
    if (campo) {
      campo.required = true
      campo.cascadeDelete = true
    }
    app.save(col)
  },
)
