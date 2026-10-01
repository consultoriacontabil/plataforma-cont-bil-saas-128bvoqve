# SERPRO Integra Contador — Proxy mTLS (Node.js + Docker)

Este serviço é um **proxy reverso HTTPS com autenticação TLS mútua (mTLS)** desenvolvido para conectar a plataforma SaaS (hospedada no Skip Cloud / PocketBase) ao gateway oficial do **SERPRO Integra Contador (Receita Federal / e-CAC)**.

---

## 🎯 Por que este proxy é necessário?

O runtime JavaScript do PocketBase (Goja) não suporta anexar certificados de cliente no handshake TLS (`Client Certificates / mTLS`). No entanto, o gateway do SERPRO exige apresentação do certificado digital **e-CNPJ A1** do escritório contábil credenciado para autorizar requisições aos serviços da Receita Federal (SITFIS, Caixa Postal DTE, DCTFWeb, PGDAS-D).

Este serviço Node.js recebe as requisições HTTPS e as encaminha ao `https://gateway.apiserpro.serpro.gov.br`, injetando automaticamente o certificado e-CNPJ A1 do escritório em cada conexão.

---

## 🔒 AVISO CRÍTICO DE SEGURANÇA

1. **O arquivo PFX e sua chave privada são o documento de identidade legal do seu escritório.**
2. **NUNCA** faça commit do arquivo `.pfx`, `.pem`, `.key` ou da senha em repositórios Git públicos ou privados.
3. No servidor VPS, ajuste sempre as permissões do diretório e dos certificados para acesso exclusivo do root/usuário do serviço:
   ```bash
   chmod 700 /opt/serpro-mtls/certs
   chmod 600 /opt/serpro-mtls/certs/*
   chmod 600 /opt/serpro-mtls/.env
   ```

---

## 📋 Pré-requisitos na sua VPS (Ubuntu 22.04 / 24.04 LTS — Contabo, Hostinger, Hetzner, etc.)

- Sistema Operacional: Ubuntu 20.04+ LTS
- Docker e Docker Compose instalados:
  ```bash
  sudo apt update && sudo apt install -y docker.io docker-compose-v2
  sudo systemctl enable --now docker
  ```
- Subdomínio apontando para o IP da VPS (ex.: `mtls.rumoconsultoria.com.br`)
- Caddy Server (recomendado para HTTPS automático com Let's Encrypt)

---

## 🚀 Passo a Passo de Implantação na VPS

### Passo 1: Preparar a estrutura de diretórios na VPS

Acesse sua VPS via SSH e crie os diretórios:

```bash
sudo mkdir -p /opt/serpro-mtls/certs
cd /opt/serpro-mtls
```

### Passo 2: Copiar os arquivos do proxy para a VPS

Copie a pasta `serpro-mtls-proxy` do projeto para `/opt/serpro-mtls/` na VPS via `scp` ou `rsync`:

```bash
# Executado na sua máquina local:
scp -r ./serpro-mtls-proxy/* usuario@ip_da_sua_vps:/opt/serpro-mtls/
```

### Passo 3: Exportar o Certificado A1 do Cofre e Enviar para a VPS

O certificado digital e-CNPJ da Rumo Consultoria Contábil já se encontra no cofre digital da plataforma (`certificados_digitais`). 

1. Baixe o arquivo `.pfx` original do seu certificado A1 para sua máquina.
2. Envie-o para a VPS dentro de `/opt/serpro-mtls/certs/`:
   ```bash
   scp ./certificado_rumo.pfx usuario@ip_da_sua_vps:/opt/serpro-mtls/certs/certificado_a1.pfx
   ```
3. Na VPS, restrinja as permissões:
   ```bash
   sudo chmod 700 /opt/serpro-mtls/certs
   sudo chmod 600 /opt/serpro-mtls/certs/certificado_a1.pfx
   ```

#### (Opcional) Conversão de PFX para PEM (Cert + Key separados)
Caso prefira operar com certificados PEM em vez do PFX binário:

```bash
cd /opt/serpro-mtls/certs

# Extrair certificado público:
openssl pkcs12 -in certificado_a1.pfx -clcerts -nokeys -out cert.pem

# Extrair chave privada:
openssl pkcs12 -in certificado_a1.pfx -nocerts -nodes -out key.pem

# Ajustar permissões
chmod 600 cert.pem key.pem
```

### Passo 4: Criar o arquivo `.env` na VPS

Na VPS, copie o template de exemplo:

```bash
cd /opt/serpro-mtls
cp env-example.txt .env
nano .env
```

Preencha a variável `TLS_PFX_PASSPHRASE` com a senha real do seu certificado A1:

```ini
PORT=8443
HOST=0.0.0.0
SERPRO_UPSTREAM=https://gateway.apiserpro.serpro.gov.br

# Certificado PFX montado no container
TLS_PFX_PATH=/certs/certificado_a1.pfx
TLS_PFX_PASSPHRASE=sua_senha_secreta_a1_aqui
```

Salve o arquivo (`Ctrl+O`, `Enter`, `Ctrl+X`) e proteja-o:
```bash
chmod 600 .env
```

### Passo 5: Subir o Container com Docker Compose

```bash
cd /opt/serpro-mtls
sudo docker compose up -d --build
```

Verifique os logs:
```bash
sudo docker compose logs -f
```

Você deverá ver:
```text
==================================================================
🚀 SERPRO Integra Contador mTLS Proxy rodando em 0.0.0.0:8443
🎯 Upstream alvo: https://gateway.apiserpro.serpro.gov.br
🔐 Certificado cliente mTLS A1: ATIVO
🩺 Healthcheck disponível em: /health
==================================================================
```

### Passo 6: Validar Localmente na VPS

Execute o teste de healthcheck:
```bash
curl -k https://localhost:8443/health
```

Resposta esperada (HTTP 200):
```json
{
  "status": "ok",
  "servico": "serpro-mtls-proxy",
  "upstream": "https://gateway.apiserpro.serpro.gov.br",
  "mtls_a1_configurado": true,
  "uptime_segundos": 15,
  "timestamp": "2026-10-01T22:30:00.000Z"
}
```

---

## 🌐 Exposição Pública Segura com Caddy + Let's Encrypt (Porta 443)

Para que a plataforma Skip Cloud possa chamar seu proxy com certificado TLS válido e confiável na web, configure o **Caddy** como proxy reverso de borda. O Caddy obtém e renova certificados SSL Let's Encrypt de forma 100% automática.

### Instalação do Caddy no Ubuntu:
```bash
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install -y caddy
```

### Configurar `/etc/caddy/Caddyfile`:

Edite o arquivo `/etc/caddy/Caddyfile`:
```bash
sudo nano /etc/caddy/Caddyfile
```

Adicione a configuração abaixo (substitua `mtls.rumoconsultoria.com.br` pelo seu subdomínio):

```caddyfile
mtls.rumoconsultoria.com.br {
    # Encaminha para o container Node.js na porta 8443
    reverse_proxy https://127.0.0.1:8443 {
        transport http {
            tls_insecure_skip_verify
        }
    }

    # Logs de acesso
    log {
        output file /var/log/caddy/serpro_mtls_access.log
    }
}
```

Reinicie o Caddy:
```bash
sudo systemctl reload caddy
```

### Testar o endpoint público:
```bash
curl https://mtls.rumoconsultoria.com.br/health
```

---

## 🔗 Vincular na Plataforma Skip Cloud

1. Acesse o menu **Integrações** > **Integra Contador (SERPRO / e-CAC Oficial)**.
2. No campo **Túnel / Proxy mTLS URL**, informe a URL pública configurada:
   `https://mtls.rumoconsultoria.com.br`
3. Clique em **Testar Conexão**.
4. O backend Skip Cloud executará o handshake através do túnel, validando token e certificado cliente, promovendo o status para **Automático (credenciado)**!
