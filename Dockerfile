# ============================================
# ETAPA 1: BUILDER - Compilar la aplicación Angular
# ============================================
FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json angular.json tsconfig*.json ngsw-config.json ./
COPY public ./public
RUN npm ci --prefer-offline --no-audit --no-fund

COPY src ./src

RUN npm run build -- \
    --output-path=./dist/out \
    --configuration=production \
    --source-map=false

# ============================================
# ETAPA 2: PRODUCTION - Servir con Nginx Alpine
# ============================================
FROM nginx:alpine AS final

LABEL maintainer="sergioizqdev"
LABEL description="Synap Frontend - Angular PWA"

# El application builder de Angular genera la salida bajo dist/out/browser.
COPY --from=builder /app/dist/out/browser /usr/share/nginx/html

COPY nginx.conf /etc/nginx/conf.d/default.conf

RUN chown -R nginx:nginx /usr/share/nginx/html && \
    chown -R nginx:nginx /var/cache/nginx && \
    chown -R nginx:nginx /var/log/nginx && \
    chmod -R 755 /usr/share/nginx/html

RUN touch /var/run/nginx.pid && \
    chown -R nginx:nginx /var/run/nginx.pid

USER nginx

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://localhost/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
