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
| `WA_CORS_ORIGENS` | Opcional. Origens da página que podem chamar o conector, separadas por vírgula (ex. `https://SEU-APP.goskip.app`). Vazio = qualquer origem. |

**Endereço do conector na plataforma:** não é mais variável de build. A URL HTTPS
do túnel é colada na aba **Configurações** de `/extensao` (campo *URL do conector*)
e gravada em `wa_canais.conector_url`. Trocar a URL não exige recompilar o app.

## Túnel HTTPS (acesso pela página publicada)

A página publicada roda em HTTPS e chama o conector direto do navegador. O conector
fica em `127.0.0.1:8095` na máquina do escritório, que não é alcançável de fora —
por isso é preciso um túnel HTTPS até ele. O conector já responde ao preflight
`OPTIONS` com `Access-Control-Allow-Origin`, `Access-Control-Allow-Methods`,
`Access-Control-Allow-Headers` e `Access-Control-Allow-Private-Network: true`.

Com cloudflared (gratuito, sem conta para teste rápido):

```bash
cloudflared tunnel --url http://127.0.0.1:8095
# copie a linha https://<nome>.trycloudflare.com
```

Com ngrok:

```bash
ngrok http 8095
# copie a URL https://<id>.ngrok-free.app
```

Pontos de atenção:

- O túnel de teste **muda de endereço a cada execução**: atualize o campo na aba Configurações.
  Para endereço fixo, use um túnel nomeado com domínio próprio (cloudflared) ou um domínio reservado (ngrok).
- Quem tiver a URL do túnel alcança `/qr.png` e `POST /recarregar`. O CORS limita o
  **navegador**, não chamadas diretas (curl). Por isso prefira proteger o túnel com
  controle de acesso (ex. Cloudflare Access) e defina `WA_CORS_ORIGENS`.
- Não cole `127.0.0.1` no campo da plataforma: a página HTTPS não alcança endereços locais.

## Ordem de configuração

1. Na máquina do escritório, instale e suba o conector com `RUMO_WEBHOOK_URL`,
   `WA_WEBHOOK_TOKEN` e `WA_AUTH_DIR` (e, opcionalmente, `WA_CORS_ORIGENS`). Ainda sem `RUMO_CANAL_ID`.
2. Abra o túnel HTTPS para `127.0.0.1:8095` (seção acima) e copie a URL `https://…`.
3. Em `/extensao` → aba **Configurações**: informe o número do WhatsApp do atendimento
   (só na primeira vez, para criar o canal), cole a URL do túnel em *URL do conector* e salve.
   O aviso "Conector não configurado" some.
4. Pegue o id do registro criado em `wa_canais` (aba Collections do painel Skip Cloud),
   coloque em `RUMO_CANAL_ID` e reinicie o conector. Sem isso o webhook descarta as mensagens.
5. Em `/extensao` → aba **Atendimento** (QR): o conector mostra o QR. Pareie o aparelho.
6. Confirme em *Conectado* e em *Número pareado*.

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
