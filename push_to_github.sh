#!/usr/bin/env bash
set -euo pipefail

REPO_URL="${1:-https://github.com/aitoolsau/evx_qrcode_redirector.git}"

git init
git checkout -b main
git add .
git commit -m "feat: initial Cloudflare Worker for EVX QR redirect"
git remote add origin "$REPO_URL"
git push -u origin main
