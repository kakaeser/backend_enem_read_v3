#!/usr/bin/env bash
set -euo pipefail

url="${RENDER_SERVICE_URL:-${1:-}}"
if [ -z "$url" ]; then
  echo "Defina RENDER_SERVICE_URL ou passe a URL como argumento." >&2
  echo "Ex.: RENDER_SERVICE_URL=https://app.onrender.com $0" >&2
  exit 1
fi

base="${url%/}"
code="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 120 "${base}/")"
echo "GET ${base}/ → HTTP ${code}"
if [ "$code" != "200" ]; then
  exit 1
fi
