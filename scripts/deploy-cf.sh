#!/usr/bin/env bash
# 部署到 Cloudflare Pages（需要先 npx wrangler login）
set -euo pipefail
cd "$(dirname "$0")/.."

pnpm build
npx wrangler pages deploy dist --project-name outfit-rewind --commit-dirty=true
