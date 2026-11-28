#!/usr/bin/env bash
# Executado somente após a CI, em projeto/serviços já provisionados.
set -Eeuo pipefail
: "${GCP_PROJECT_ID:?Configure GCP_PROJECT_ID}"
: "${GCP_REGION:?Configure GCP_REGION}"
: "${GITHUB_SHA:?}"
: "${GITHUB_RUN_ID:?}"
: "${GITHUB_RUN_ATTEMPT:?}"
[[ "$GCP_PROJECT_ID" =~ ^[a-z][a-z0-9-]{4,28}[a-z0-9]$ ]]
[[ "$GCP_REGION" == southamerica-east1 ]]
[[ "$GITHUB_SHA" =~ ^[a-f0-9]{40}$ ]]
[[ "$GITHUB_RUN_ID" =~ ^[0-9]+$ && "$GITHUB_RUN_ATTEMPT" =~ ^[0-9]+$ ]]
gc=(gcloud --quiet --project="$GCP_PROJECT_ID" run)
describe() { "${gc[@]}" services describe "$1" --region="$GCP_REGION" --format=json; }
# Nunca criar automaticamente, alterar IAM ou substituir configurações/segredos.
revision() {
  describe "$1" | jq -er '[.status.traffic[] | select((.percent // 0) > 0)] | if length == 1 and .[0].percent == 100 then .[0].revisionName else error("Tráfego dividido: publicação manual necessária") end'
}
old_api="$(revision carbon-api)"
old_web="$(revision carbon-web)"
web_url="$(describe carbon-web | jq -er .status.url)"
api_url="$(describe carbon-api | jq -er .status.url)"
[[ "$web_url" =~ ^https://[a-z0-9-]+\.run\.app$ && "$api_url" =~ ^https://[a-z0-9-]+\.run\.app$ ]]
probe() {
  curl --fail --silent --show-error --max-time 25 --retry 4 --retry-delay 3 "$web_url/api/health" | jq -e '.status == "ok"' >/dev/null
  curl --fail --silent --show-error --max-time 25 --retry 4 --retry-delay 3 "$web_url/api/ready" | jq -e '.ready == true' >/dev/null
}
# Exige ambiente existente saudável; a primeira publicação é manual.
probe
registry="$GCP_REGION-docker.pkg.dev"
tag="$GITHUB_SHA-$GITHUB_RUN_ID-$GITHUB_RUN_ATTEMPT"
base="$registry/$GCP_PROJECT_ID/carbon"
gcloud --quiet auth configure-docker "$registry"
for service in carbon-api carbon-web; do
  image="$base/$service:$tag"
  docker tag "$service:ci" "$image"
  docker push "$image"
  digest="$(docker image inspect "$image" --format '{{index .RepoDigests 0}}')"
  [[ "$digest" == "$base/$service@sha256:"* ]]
  "${gc[@]}" deploy "$service" --region="$GCP_REGION" --image="$digest" --no-traffic
done
new_api="$(describe carbon-api | jq -er '.status.latestReadyRevisionName')"
new_web="$(describe carbon-web | jq -er '.status.latestReadyRevisionName')"
[[ "$new_api" != "$old_api" && "$new_web" != "$old_web" ]]
# Reconfirma tráfego antes de promover. Não executar deploy manual simultâneo.
[[ "$(revision carbon-api)" == "$old_api" && "$(revision carbon-web)" == "$old_web" ]]
traffic() { "${gc[@]}" services update-traffic "$1" --region="$GCP_REGION" --to-revisions="$2=100"; }
rollback() {
  rc=$?
  trap - EXIT
  if (( rc != 0 )); then
    echo "::error::Falha na promoção; tentando restaurar as revisões anteriores."
    traffic carbon-web "$old_web" || echo "::error::Restaure carbon-web manualmente."
    traffic carbon-api "$old_api" || echo "::error::Restaure carbon-api manualmente."
  fi
  exit "$rc"
}
trap rollback EXIT
traffic carbon-api "$new_api"
traffic carbon-web "$new_web"
probe
trap - EXIT
echo "Publicação concluída: $new_api / $new_web"
