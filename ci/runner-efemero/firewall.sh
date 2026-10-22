#!/usr/bin/env bash
#
# Isola a rede dos jobs (bridge br-lattes-ci) do resto da máquina: nada de LAN,
# Tailscale, WireGuard, outras redes do Docker nem o próprio host. Sobra só a
# internet pública. Roda como root, e é idempotente: o serviço
# lattes-ci-firewall roda de novo a cada início do Docker.
#
# O executar.sh confere o bloqueio antes de cada job e não pega job sem ele.

set -euo pipefail

BRIDGE=br-lattes-ci
BLOCKED=(
  10.0.0.0/8     # WireGuard (wg0) e redes privadas
  172.16.0.0/12  # outras redes do Docker
  192.168.0.0/16 # LAN
  100.64.0.0/10  # Tailscale
  169.254.0.0/16 # link-local e metadados de nuvem
  224.0.0.0/4    # multicast
)

iptables -N DOCKER-USER 2>/dev/null || true
for net in "${BLOCKED[@]}"; do
  iptables -C DOCKER-USER -i "$BRIDGE" -d "$net" -j DROP 2>/dev/null ||
    iptables -I DOCKER-USER -i "$BRIDGE" -d "$net" -j DROP
done
# Do container para o host (sshd, ollama, tudo o que escuta em 0.0.0.0).
iptables -C INPUT -i "$BRIDGE" -j DROP 2>/dev/null ||
  iptables -I INPUT -i "$BRIDGE" -j DROP

# Sem IPv6 na bridge: a rede é criada sem IPv6, e isto garante.
if command -v ip6tables >/dev/null; then
  ip6tables -C FORWARD -i "$BRIDGE" -j DROP 2>/dev/null ||
    ip6tables -I FORWARD -i "$BRIDGE" -j DROP
  ip6tables -C INPUT -i "$BRIDGE" -j DROP 2>/dev/null ||
    ip6tables -I INPUT -i "$BRIDGE" -j DROP
fi

echo "firewall de $BRIDGE aplicado"
