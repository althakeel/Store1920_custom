#!/usr/bin/env bash
# Run on your Linux server (as root or with sudo) to raise nginx upload limits.
# Usage: sudo bash deploy/apply-nginx-upload-limit.sh your-domain.com

set -euo pipefail

DOMAIN="${1:-}"
LIMIT="200M"
SNIPPET_PATH="/etc/nginx/conf.d/store1920-upload-limit.conf"

cat > "$SNIPPET_PATH" <<EOF
# Store1920 — allow large media uploads (fixes HTTP 413)
client_max_body_size ${LIMIT};
proxy_read_timeout 300s;
proxy_send_timeout 300s;
proxy_connect_timeout 300s;
client_body_timeout 300s;
EOF

echo "Wrote ${SNIPPET_PATH}"

if command -v nginx >/dev/null 2>&1; then
  nginx -t
  systemctl reload nginx || service nginx reload
  echo "Nginx reloaded. client_max_body_size is now ${LIMIT}."
else
  echo "nginx not found in PATH — install snippet manually."
fi

if [[ -n "$DOMAIN" ]]; then
  echo ""
  echo "Remember S3 CORS for direct uploads — see deploy/s3-cors.example.json"
  echo "Replace your-store-domain.com with: ${DOMAIN}"
fi
