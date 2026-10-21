#!/usr/bin/env bash
#
# Remove os worktrees e as branches locais cujo PR já foi mesclado no
# GitHub (e, com --incluir-fechados, os de PR fechado sem merge). O GitHub apaga a branch remota no merge, mas a local e o
# worktree ficam: em 20/10/2026 eram 58 branches e uns 50 worktrees parados.
#
# Uso:
#   scripts/limpar-branches-mesclados.sh          # ensaio: só lista
#   scripts/limpar-branches-mesclados.sh --yes    # remove
#   ... --incluir-fechados                        # também PR fechado sem merge
#
# Cada remoção imprime o commit da ponta, para recuperar a branch com
# `git branch <nome> <commit>` se preciso.
#
# Nunca mexe em:
#   - main, nem na branch em que o checkout principal está;
#   - branch com PR aberto, ou fechado sem merge (sem --incluir-fechados);
#   - branch sem PR (pode ser trabalho que ainda não foi enviado);
#   - branch cuja ponta não é a do PR (commit local depois do merge, ou o
#     nome reaproveitado para outro trabalho);
#   - worktree com mudança não commitada, ou cujo estado não se lê;
#   - as branches de PROTEGIDAS (test/criar-item é o worktree
#     lattes-editor-criar-teste, que fica).
#
# O worktree sai com `git worktree remove` sem --force, que recusa um
# worktree sujo de qualquer forma. Requer o `gh` autenticado.

set -euo pipefail

PROTEGIDAS=('test/criar-item')

APPLY=0
CLOSED_TOO=0
for arg in "$@"; do
  case "$arg" in
    --yes) APPLY=1 ;;
    --incluir-fechados) CLOSED_TOO=1 ;;
    *)
      echo "opção desconhecida: $arg (--yes para remover, --incluir-fechados para PR fechado)" >&2
      exit 2
      ;;
  esac
done

# O checkout principal é o primeiro de `git worktree list`.
main_wt=$(git worktree list --porcelain | awk '/^worktree / { print substr($0, 10); exit }')
cd "$main_wt"
current=$(git branch --show-current)

# Uma chamada só ao gh, escopada ao repositório e sem os PRs vindos de fork,
# que podem ter o nome de uma branch daqui; a busca por branch é local.
LIMIT=500
repo=$(gh repo view --json nameWithOwner -q .nameWithOwner)
all=$(gh pr list --repo "$repo" --state all --limit "$LIMIT" \
  --json headRefName,state,number,headRefOid,isCrossRepository \
  --jq '.[] | "\(.headRefName)\t\(.state)\t\(.number)\t\(.headRefOid)\t\(.isCrossRepository)"')
if [[ $(grep -c . <<<"$all") -ge $LIMIT ]]; then
  echo "aviso: o gh devolveu $LIMIT PRs, o limite; os mais antigos aparecem como sem PR" >&2
fi
prs=$(awk -F'\t' '$5 == "false"' <<<"$all")

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
  # O PR mais recente com o nome da branch (o gh lista do mais novo).
  line=$(awk -F'\t' -v b="$br" '!seen && $1 == b { print $2 " #" $3 " " $4; seen = 1 }' <<<"$prs")
  state=${line%% *}
  oid=${line##* }
  line=${line% *}
  wt=$(awk -F'\t' -v b="$br" '!seen && $1 == b { print $2; seen = 1 }' <<<"$worktrees")
  case "$state" in
    MERGED) ;;
    CLOSED)
      if [[ $CLOSED_TOO -eq 0 ]]; then
        echo "mantém    $br (PR ${line#* } fechado sem merge: --incluir-fechados para remover)"
        kept=$((kept + 1))
        continue
      fi
      ;;
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
  # A ponta local tem de ser a do PR: senão há commit que o PR não leva.
  if [[ "$(git rev-parse "refs/heads/$br")" != "$oid" ]]; then
    echo "mantém    $br (PR ${line#* } $state, mas a ponta local não é a do PR)"
    kept=$((kept + 1))
    continue
  fi
  if [[ -n "$wt" ]]; then
    if ! status=$(git -C "$wt" status --porcelain 2>/dev/null); then
      echo "mantém    $br (PR ${line#* } $state, mas o estado de $wt não se lê)"
      kept=$((kept + 1))
      continue
    fi
    if [[ -n "$status" ]]; then
      echo "mantém    $br (PR ${line#* } $state, mas $wt tem mudanças)"
      kept=$((kept + 1))
      continue
    fi
  fi
  tip=${oid:0:7}
  if [[ $APPLY -eq 0 ]]; then
    echo "removeria $br (PR ${line#* } $state, ponta $tip)${wt:+ e $wt}"
    removed=$((removed + 1))
    continue
  fi
  if [[ -n "$wt" ]] && ! git worktree remove "$wt"; then
    echo "FALHOU    $br: o worktree $wt não saiu; nada foi removido"
    failed=$((failed + 1))
    continue
  fi
  if ! git branch -D "$br" >/dev/null; then
    echo "FALHOU    $br: ${wt:+o worktree saiu, mas }a branch não saiu (git branch -D $br)"
    failed=$((failed + 1))
    continue
  fi
  echo "removido  $br (PR ${line#* } $state, ponta $tip)${wt:+ e $wt}"
  removed=$((removed + 1))
done < <(git for-each-ref --format='%(refname:short)' refs/heads/)

echo
if [[ $APPLY -eq 1 ]]; then
  git worktree prune
  echo "$removed removida(s), $kept mantida(s), $failed com falha."
  [[ $failed -eq 0 ]]
else
  echo "$removed seria(m) removida(s), $kept mantida(s). Rode com --yes para remover."
fi
