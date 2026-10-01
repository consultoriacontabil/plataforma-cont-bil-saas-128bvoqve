FROM node:20-alpine

# Instalar openssl caso necessário para conversão de certificados
RUN apk add --no-cache openssl ca-certificates tzdata

ENV TZ=America/Sao_Paulo
WORKDIR /app

# Copiar manifesto de dependências
COPY package.json ./

# Como usamos apenas módulos nativos do Node (node:https, node:http, node:fs, node:crypto),
# não precisamos de npm install demorado, mas o comando garante conformidade.
RUN npm install --production || true

# Copiar código do servidor
COPY server.js ./

# Criar diretório para montagem de certificados com permissões restritas
RUN mkdir -p /certs && chmod 700 /certs

# Variáveis padrão
ENV PORT=8443
ENV HOST=0.0.0.0
ENV NODE_ENV=production
ENV SERPRO_UPSTREAM=https://gateway.apiserpro.serpro.gov.br

EXPOSE 8443

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-check-certificate -qO- http://localhost:8443/health || wget --no-check-certificate -qO- https://localhost:8443/health || exit 1

CMD ["node", "server.js"]
