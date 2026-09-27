#!/bin/sh
# ============================================
# Proxy opcional de /api hacia la API (fix-notes-list design.md Decision 5)
# ============================================
# Lo ejecuta el entrypoint oficial de nginx antes de arrancar. Con SYNAP_API_UPSTREAM
# (p. ej. http://synap-api:80, en docker-compose) /api/ se reenvía a la API; sin ella el
# snippet queda vacío y el contenedor sirve solo la SPA, como detrás del proxy del VPS.
set -eu

SNIPPET=/etc/nginx/snippets/api-proxy.conf

if [ -z "${SYNAP_API_UPSTREAM:-}" ]; then
    : > "$SNIPPET"
    echo "$0: SYNAP_API_UPSTREAM no definido - /api no se reenvía"
    exit 0
fi

# Nombre resuelto por petición (resolver de Docker + variable), no al arrancar: una API
# caída o que cambia de IP nunca impide que arranque el frontend.
cat > "$SNIPPET" <<CONF
location /api/ {
    resolver 127.0.0.11 valid=10s ipv6=off;
    set \$synap_api ${SYNAP_API_UPSTREAM};
    proxy_pass \$synap_api;
    proxy_set_header Host \$host;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
}
CONF
echo "$0: /api/ se reenvía a ${SYNAP_API_UPSTREAM}"
