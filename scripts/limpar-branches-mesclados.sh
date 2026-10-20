#!/usr/bin/env bash
#
# Remove os worktrees e as branches locais cujo PR já foi mesclado ou fechado
# no GitHub. O GitHub apaga a branch remota no merge, mas a local e o
# worktree ficam: em 20/10/2026 eram 58 branches e uns 50 worktrees parados.
#
# Uso:
#   scripts/limpar-branches-mesclados.sh          # ensaio: só lista
#   scripts/limpar-branches-mesclados.sh --yes    # remove
#
# Nunca mexe em:
#   - main, nem na branch em que o checkout principal está;
#   - branch com PR aberto;
#   - branch sem PR (pode ser trabalho que ainda não foi enviado);
#   - worktree com mudança não commitada;
#   - as branches de PROTEGIDAS (test/criar-item é o worktree
#     lattes-editor-criar-teste, que fica).
#
# O worktree sai com `git worktree remove` sem --force, que recusa um
# worktree sujo de qualquer forma. Requer o `gh` autenticado.

set -euo pipefail

PROTEGIDAS=('test/criar-item')

APPLY=0
case "${1:-}" in
  --yes) APPLY=1 ;;
  '') ;;
  *)
    echo "opção desconhecida: $1 (--yes para remover, nada para o ensaio)" >&2
    exit 2
    ;;
esac

cd "$(git rev-parse --path-format=absolute --git-common-dir)/.."
current=$(git branch --show-current)

# Uma chamada só ao gh, escopada ao repositório; a busca por branch é local.
repo=$(gh repo view --json nameWithOwner -q .nameWithOwner)
prs=$(gh pr list --repo "$repo" --state all --limit 500 --json headRefName,state,number \
  --jq '.[] | "\(.headRefName)\t\(.state)\t\(.number)"')

# branch -> caminho do worktree, de `git worktree list --porcelain`.
worktrees=$(git worktree list --porcelain | awk '
  /^worktree / { path = substr($0, 10) }
  /^branch /   { sub("refs/heads/", "", $2); print $2 "\t" path }')

removed=0
kept=0
failed=0

while IFS= read -r br; do
  if [[ "$br" == "main" || "$br" == "$current" ]]; then continue; fi
  for p in "${PROTEGIDAS[@]}"; do [[ "$br" == "$p" ]] && continue 2; done
  line=$(printf '%s\n' "$prs" | awk -F'\t' -v b="$br" '$1 == b { print $2 " #" $3; exit }')
  state=${line%% *}
  wt=$(printf '%s\n' "$worktrees" | awk -F'\t' -v b="$br" '$1 == b { print $2; exit }')
  case "$state" in
    MERGED | CLOSED) ;;
    OPEN)
      echo "mantém    $br (PR ${line#* } aberto)"
      kept=$((kept + 1))
      continue
      ;;
    *)
      echo "ignora    $br (sem PR: confira à mão)"
      kept=$((kept + 1))
      continue
      ;;
  esac
  if [[ -n "$wt" && -n "$(git -C "$wt" status --porcelain 2>/dev/null)" ]]; then
    echo "mantém    $br (PR ${line#* } $state, mas $wt tem mudanças)"
    kept=$((kept + 1))
    continue
  fi
  if [[ $APPLY -eq 0 ]]; then
    echo "removeria $br (PR ${line#* } $state)${wt:+ e $wt}"
    removed=$((removed + 1))
    continue
  fi
  if { [[ -z "$wt" ]] || git worktree remove "$wt"; } && git branch -D "$br" >/dev/null; then
    echo "removido  $br (PR ${line#* } $state)${wt:+ e $wt}"
    removed=$((removed + 1))
  else
    echo "FALHOU    $br: remova à mão"
    failed=$((failed + 1))
  fi
done < <(git for-each-ref --format='%(refname:short)' refs/heads/)

echo
if [[ $APPLY -eq 1 ]]; then
  git worktree prune
  echo "$removed removida(s), $kept mantida(s), $failed com falha."
  [[ $failed -eq 0 ]]
else
  echo "$removed seria(m) removida(s), $kept mantida(s). Rode com --yes para remover."
fi
