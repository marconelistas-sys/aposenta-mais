#!/usr/bin/env bash

set -Eeuo pipefail

project_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$project_dir"

if ! command -v node >/dev/null 2>&1; then
  echo "Erro: Node.js não foi encontrado. Instale o Node.js 20 ou superior." >&2
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "Erro: npm não foi encontrado." >&2
  exit 1
fi

node_major="$(node --version | sed -E 's/^v([0-9]+).*/\1/')"
if [[ ! "$node_major" =~ ^[0-9]+$ ]] || (( node_major < 20 )); then
  echo "Erro: use Node.js 20 ou superior. Versão atual: $(node --version)." >&2
  exit 1
fi

if [[ ! -f .env ]]; then
  echo "Erro: arquivo .env não encontrado." >&2
  echo "Copie .env.example para .env e configure o Supabase." >&2
  exit 1
fi

missing_variables=()
for variable in SUPABASE_URL SUPABASE_ANON_KEY; do
  if ! node --env-file=.env -e 'process.exit(process.env[process.argv[1]] ? 0 : 1)' "$variable"; then
    missing_variables+=("$variable")
  fi
done

if (( ${#missing_variables[@]} > 0 )); then
  echo "Erro: configure as seguintes variáveis no .env:" >&2
  printf '  %s\n' "${missing_variables[@]}" >&2
  exit 1
fi

app_port="${PORT:-4173}"
echo "Iniciando Aposenta+ em http://127.0.0.1:${app_port}"
exec npm run dev
