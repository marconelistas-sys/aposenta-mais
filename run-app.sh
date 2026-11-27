#!/usr/bin/env bash

set -Eeuo pipefail

project_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$project_dir"

if ! command -v node >/dev/null 2>&1; then
  echo "Erro: Node.js não foi encontrado. Instale o Node.js 24 ou superior." >&2
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "Erro: npm não foi encontrado." >&2
  exit 1
fi

node_major="$(node --version | sed -E 's/^v([0-9]+).*/\1/')"
if [[ ! "$node_major" =~ ^[0-9]+$ ]] || (( node_major < 24 )); then
  echo "Erro: use Node.js 24 ou superior. Versão atual: $(node --version)." >&2
  exit 1
fi

app_port="${PORT:-4173}"

# ./run-app.sh --rede abre o app para o celular na mesma rede Wi-Fi.
if [[ "${1:-}" == "--rede" ]]; then
  lan_ip="$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || true)"
  if [[ -z "$lan_ip" ]]; then
    echo "Erro: não encontrei o endereço deste Mac na rede. Confira se o Wi-Fi está conectado." >&2
    exit 1
  fi
  export HOST=0.0.0.0
  export APP_ORIGIN="http://${lan_ip}:${app_port}"
  export APP_ALLOWED_ORIGINS="http://127.0.0.1:${app_port}"
  echo "Iniciando Aposenta+ na rede local."
  echo "No celular, na mesma Wi-Fi, abra: ${APP_ORIGIN}"
  echo "Atenção: a conexão não é criptografada. Use só em uma rede Wi-Fi de confiança e encerre com Ctrl+C ao terminar."
else
  echo "Iniciando Aposenta+ em http://127.0.0.1:${app_port}"
fi
exec npm run dev
