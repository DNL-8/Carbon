#!/usr/bin/env bash
set -euo pipefail

: "${PGDATABASE:?Informe a conexão PostgreSQL direta.}"
: "${AGE_RECIPIENT:?Informe a chave pública age.}"
output="${1:?Informe o caminho do arquivo criptografado.}"

docker run --rm --network host -e PGDATABASE postgres:18 \
  sh -c 'exec pg_dump --dbname="$PGDATABASE" --format=custom --no-owner --no-acl' \
  | age --recipient "$AGE_RECIPIENT" --output "$output"
test -s "$output"
