# Conector Rumo Whats — sessão WhatsApp pareada por QR Code

Processo Node **separado** que segura a sessão do WhatsApp aberta (chaves
rotacionando) — um hook PocketBase é request/response e não suporta isso.
Roda na **máquina do escritório**, não no Skip Cloud.

## O que ele expõe

| Rota | O que faz |
| --- | --- |
| `GET /qr.png` | QR como imagem, para a Tela 01 do painel Rumo Whats |
| `GET /estado` | Conectado ou não, tem QR, número pareado, último erro |
| `POST /recarregar` | Descarta a sessão e gera um QR novo (botão "Recarregar" do painel) |

## Instalação

```bash
mkdir conector-rumo-whats && cd conector-rumo-whats
npm i @whiskeysockets/baileys qrcode pino @hapi/boom express
cp conector-whatsapp.js .
node conector-whatsapp.js
# QR disponível em http://127.0.0.1:8095/qr.png
```

Node 18+ (testado em node 26.12 + Baileys 6.7.18, QR real gerado e servido
como PNG 320×320).

## Variáveis de ambiente

| Variável | O que é |
| --- | --- |
| `RUMO_WEBHOOK_URL` | URL do webhook na plataforma: `https://SEU-PROJETO.goskip.app/backend/v1/rumo-whats/webhook` |
| `WA_WEBHOOK_TOKEN` | O mesmo token configurado na plataforma (set_env `WA_WEBHOOK_TOKEN`) |
| `RUMO_CANAL_ID` | Id do registro em `wa_canais` (modo `qr`, status `conectado`) |
| `WA_AUTH_DIR` | Pasta das credenciais pareadas — **fora do git** (ex. `/var/lib/rumo-whats/auth`). É a chave da conta: trate como senha. |

Na plataforma, o endereço do conector é apontado pela variável `WA_CONECTOR_URL`
(set_env), que o painel /extensao lê via `import.meta.env.VITE_WA_CONECTOR_URL`.

## Como parear

1. Escolha um número **dedicado** ao atendimento (nunca o principal do escritório —
   ban atinge histórico e verificação em dois fatores).
2. Suba o conector e abra `http://127.0.0.1:8095/qr.png`.
3. No celular: WhatsApp → Configurações → Dispositivos conectados → Conectar
   dispositivo → escanear. Alternativa sem câmera: "Conectar com número de
   telefone" (código de 8 dígitos).
4. Registre o número em `wa_canais` com `modo: "qr"` e `status: "conectado"` e
   use o id dele em `RUMO_CANAL_ID`. Sem esse registro o webhook descarta a
   mensagem.

## Risco documentado pela Meta

Pareamento por QR (Baileys e similares) é "app não oficial" para o WhatsApp —
o número pode ser temporária ou permanentemente banido. O que reduz o risco:
número dedicado, não insistir em reconexão após logout (o conector já distingue),
ritmo controlado de envio e respeito ao opt-out.

## Fluxo de mensagens

```
Cliente → WhatsApp → conector (sessão pareada)
              → POST /backend/v1/rumo-whats/webhook
              → wa_atendimento_conversas + wa_atendimento_mensagens
              → painel do atendente (/extensao)
```

O laço de envio: o conector lê `GET /backend/v1/rumo-whats/fila` (mensagens
`pendente`), despacha pelo socket e grava o `wamid` de volta em
`POST /backend/v1/rumo-whats/fila/{id}/confirmar`.

Manter vivo: supervisor de processo (systemd, pm2) e o mesmo disco para
`WA_AUTH_DIR`. Se a pasta de credenciais se perder, é QR novo.
