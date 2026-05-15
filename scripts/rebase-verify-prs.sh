#!/usr/bin/env sh
set -eu

base_branch="${BASE_BRANCH:-main}"
label="${VERIFY_LABEL:-verify}"
remote="${REMOTE:-origin}"
limit="${PR_LIMIT:-100}"
dry_run="${DRY_RUN:-false}"

case "$limit" in
  '' | *[!0-9]*)
    echo "error: PR_LIMIT must be a positive integer." >&2
    exit 1
    ;;
esac

if [ "$limit" -le 0 ]; then
  echo "error: PR_LIMIT must be greater than 0." >&2
  exit 1
fi

if ! command -v gh >/dev/null 2>&1; then
  echo "error: gh is required." >&2
  exit 1
fi

if ! command -v git >/dev/null 2>&1; then
  echo "error: git is required." >&2
  exit 1
fi

repo_root="$(git rev-parse --show-toplevel)"
cd "$repo_root"

tmp_root="$(mktemp -d "${TMPDIR:-/tmp}/anti-trojan-source-diff-rebase-verify-prs.XXXXXX")"
all_pull_requests_file="${tmp_root}/all-pull-requests.tsv"
worktrees_file="${tmp_root}/worktrees.txt"
touch "$worktrees_file"

cleanup() {
  if [ -f "$worktrees_file" ]; then
    while IFS= read -r worktree; do
      [ -n "$worktree" ] || continue
      git worktree remove --force "$worktree" >/dev/null 2>&1 || true
    done < "$worktrees_file"
  fi

  rm -rf "$tmp_root"
}
trap cleanup EXIT INT TERM

echo "Fetching ${remote}/${base_branch}..."
git fetch --no-tags "$remote" "+refs/heads/${base_branch}:refs/remotes/${remote}/${base_branch}"

base_ref="refs/remotes/${remote}/${base_branch}"
base_sha="$(git rev-parse "$base_ref")"
fetch_limit=$((limit + 1))

if [ -n "${GH_REPO:-}" ]; then
  gh pr list \
    --repo "$GH_REPO" \
    --state open \
    --base "$base_branch" \
    --label "$label" \
    --limit "$fetch_limit" \
    --json number,headRefName,headRefOid,isCrossRepository \
    --jq '.[] | [.number, .headRefName, .headRefOid, .isCrossRepository] | @tsv' \
    > "$all_pull_requests_file"
else
  gh pr list \
    --state open \
    --base "$base_branch" \
    --label "$label" \
    --limit "$fetch_limit" \
    --json number,headRefName,headRefOid,isCrossRepository \
    --jq '.[] | [.number, .headRefName, .headRefOid, .isCrossRepository] | @tsv' \
    > "$all_pull_requests_file"
fi

tab="$(printf '\t')"
returned_count="$(wc -l < "$all_pull_requests_file" | tr -d '[:space:]')"
if [ "$returned_count" -gt "$limit" ]; then
  echo "error: found more than PR_LIMIT=${limit} open PRs with label '${label}' targeting '${base_branch}'." >&2
  echo "error: refusing to process a truncated set. Increase PR_LIMIT or narrow the label/base filters." >&2
  exit 1
fi

if ! grep -q "${tab}false$" "$all_pull_requests_file"; then
  echo "No open same-repository PRs with label '${label}' targeting '${base_branch}'."
  exit 0
fi

failed=0

while IFS="$tab" read -r number head_ref head_oid is_cross_repository; do
  [ -n "$number" ] || continue
  [ "$is_cross_repository" = "false" ] || continue

  remote_head_ref="refs/remotes/${remote}/${head_ref}"
  worktree="${tmp_root}/pr-${number}"

  echo
  echo "==> PR #${number}: ${head_ref}"
  git fetch --no-tags "$remote" "+refs/heads/${head_ref}:${remote_head_ref}"

  if git merge-base --is-ancestor "$base_sha" "$remote_head_ref"; then
    echo "Already contains ${remote}/${base_branch} at ${base_sha}."
    continue
  fi

  git worktree add --detach "$worktree" "$remote_head_ref" >/dev/null
  echo "$worktree" >> "$worktrees_file"

  if git -C "$worktree" rebase --no-update-refs "$base_sha"; then
    if [ "$dry_run" = "true" ] || [ "$dry_run" = "1" ]; then
      echo "DRY_RUN is enabled; not pushing ${head_ref}."
      continue
    fi

    if git -C "$worktree" push \
      --force-with-lease="refs/heads/${head_ref}:${head_oid}" \
      "$remote" \
      "HEAD:refs/heads/${head_ref}"; then
      echo "Rebased and pushed PR #${number} onto ${remote}/${base_branch}."
    else
      echo "error: failed to push PR #${number} (${head_ref})." >&2
      failed=1
    fi
  else
    echo "error: failed to rebase PR #${number} (${head_ref}). Resolve it manually." >&2
    git -C "$worktree" rebase --abort >/dev/null 2>&1 || true
    failed=1
  fi
done < "$all_pull_requests_file"

exit "$failed"
