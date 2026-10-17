#!/usr/bin/env bash
# 一键部署：把 dist 推到 gh-pages 分支（不需要 Actions）
set -euo pipefail

cd "$(dirname "$0")/.."
REPO="${REPO:-https://github.com/Ch9loe-2/outfit-rewind.git}"

pnpm build

TMP="$(mktemp -d)"
cp -R dist/. "$TMP/"
cd "$TMP"
git init -q -b gh-pages
git add -A
git -c user.name="deploy" -c user.email="deploy@local" commit -q -m "deploy: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
git push -f "$REPO" gh-pages
cd /
rm -rf "$TMP"
echo "已推送到 gh-pages 分支。首次使用请在仓库 Settings → Pages 选择 gh-pages 分支。"
