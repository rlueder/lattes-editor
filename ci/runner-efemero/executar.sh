#!/usr/bin/env bash
#
# Uma vaga de runner efêmero do lattes-editor. Em laço: confere o isolamento
# de rede, pede ao GitHub uma configuração JIT (vale para um job só), sobe um
# container novo que pega um job e some. Nada sobrevive de um job para o
# outro: nem workspace, nem cache, nem processo deixado para trás.
#
# Uso: executar.sh <vaga>   (o serviço lattes-ci@<vaga> chama assim)
#
# O token fica em ~/.config/lattes-ci/token (chmod 600): fine-grained, só o
# repositório rlueder/lattes-editor, permissão Administration: read and write.
# Ele nunca entra no container; o container recebe só a configuração JIT.

set -uo pipefail

SLOT=${1:?uso: executar.sh <vaga>}
REPO=rlueder/lattes-editor
IMAGE=lattes-ci-runner:latest
NETWORK=lattes-ci
LABELS='["self-hosted","linux","x64","lattes-efemero"]'
TOKEN_FILE=${XDG_CONFIG_HOME:-$HOME/.config}/lattes-ci/token
MAX_JOB=6h
PREFIX="lattes-efemero-$(hostname -s)-$SLOT"

log() { echo "[vaga $SLOT] $*"; }

cleanup() {
  docker ps -aq --filter "name=^$PREFIX-" | xargs -r docker rm -f >/dev/null 2>&1
}
trap 'cleanup; exit 0' INT TERM

# Fecha em falha: o job só começa se o container NÃO alcança o host nem a LAN.
# Com o DROP do firewall a conexão fica pendurada até o timeout (124); sem ele,
# ela conecta ou é recusada na hora. Também exige DNS e HTTPS para o GitHub.
isolated() {
  local targets
  # Cada IP do host na porta 22, e o gateway da LAN na 53.
  targets=$(ip -4 -o addr show | awk '$2 != "lo" { split($4, a, "/"); print a[1] ":22" }')
  targets+=" $(ip -4 route show default | awk '{ print $3 ":53"; exit }')"
  docker run --rm --network "$NETWORK" --dns 1.1.1.1 --dns 8.8.8.8 \
    -e TARGETS="$targets" --entrypoint bash "$IMAGE" -c '
      for t in $TARGETS; do
        timeout 3 bash -c "</dev/tcp/${t%:*}/${t#*:}" 2>/dev/null
        [ $? -eq 124 ] || { echo "alcança $t"; exit 1; }
      done
      curl -fsS -o /dev/null --max-time 10 https://api.github.com || { echo "sem saída para o GitHub"; exit 1; }
    ' 2>&1 | grep -v '^\[RUNNER'
  return "${PIPESTATUS[0]}"
}

cleanup
while true; do
  if ! isolated; then
    log "isolamento de rede ausente ou quebrado; sem job. Rode o firewall.sh como root."
    sleep 60
    continue
  fi
  if [[ ! -r "$TOKEN_FILE" ]]; then
    log "sem token em $TOKEN_FILE"
    sleep 300
    continue
  fi
  name="$PREFIX-$(date +%s)"
  body=$(jq -nc --arg n "$name" --argjson l "$LABELS" \
    '{name: $n, runner_group_id: 1, labels: $l, work_folder: "_work"}')
  if ! jit=$(curl -fsS -X POST \
    -H "Authorization: Bearer $(cat "$TOKEN_FILE")" \
    -H "Accept: application/vnd.github+json" \
    "https://api.github.com/repos/$REPO/actions/runners/generate-jitconfig" \
    -d "$body" | jq -er .encoded_jit_config); then
    log "o GitHub recusou a configuração JIT; nova tentativa em 60 s"
    sleep 60
    continue
  fi

  # Sem sudo (no-new-privileges), sem capabilities, sem socket do Docker, sem
  # volume do host; memória, CPU e processos limitados.
  envfile=$(mktemp)
  chmod 600 "$envfile"
  printf 'RUNNER_JIT=%s\n' "$jit" >"$envfile"
  docker run -d --rm --name "$name" \
    --network "$NETWORK" --dns 1.1.1.1 --dns 8.8.8.8 \
    --security-opt no-new-privileges --cap-drop ALL \
    --memory 6g --memory-swap 6g --cpus 8 --pids-limit 4096 \
    --env-file "$envfile" \
    --entrypoint bash "$IMAGE" -c 'exec ./run.sh --jitconfig "$RUNNER_JIT"' >/dev/null
  rm -f "$envfile"
  log "pronta: $name"
  timeout "$MAX_JOB" docker wait "$name" >/dev/null 2>&1
  [[ $? -eq 124 ]] && log "$name passou de $MAX_JOB; removendo"
  docker rm -f "$name" >/dev/null 2>&1
done
