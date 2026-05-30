#!/usr/bin/env bash

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEFAULT_ROOT_DIR="$(cd "$SCRIPT_DIR/../../.." && pwd)"
ROOT_DIR=${ROOT_DIR:-$DEFAULT_ROOT_DIR}
CONFIG_FILE="$ROOT_DIR/agent/verify/scripts/vue/ai-config.json"

# 该脚本只负责安装浏览器巡检所需依赖，不参与每次验证主流程。
# 前端目录从 ai-config.json 读取，避免在脚本里写死具体项目结构。
if [ ! -f "$CONFIG_FILE" ]; then
  echo "Missing config: $CONFIG_FILE"
  exit 1
fi

FRONTEND_DIR=$(node -e "const path=require('path');const c=require(process.argv[1]);console.log(c.frontendDir || '.')" "$CONFIG_FILE")
cd "$ROOT_DIR/$FRONTEND_DIR"

# 按 lock 文件选择包管理器，确保依赖写入方式和项目原有工具链一致。
if [ -f "pnpm-lock.yaml" ] && command -v pnpm >/dev/null 2>&1; then
  pnpm add -D playwright
  pnpm exec playwright install chromium
elif [ -f "yarn.lock" ] && command -v yarn >/dev/null 2>&1; then
  yarn add -D playwright
  yarn playwright install chromium
else
  npm install -D playwright
  npx playwright install chromium
fi

echo "Vue check dependencies installed."
