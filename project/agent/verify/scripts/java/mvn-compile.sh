#!/usr/bin/env bash

set -e

############################################
# AI Compile Script
############################################

ROOT_DIR=${ROOT_DIR:-$(pwd)}

cd "$ROOT_DIR"

############################################
# 默认参数
############################################

MODULE=""
PROFILE=""
THREADS="1C"
SKIP_TESTS="true"
OFFLINE="false"
CLEAN="false"
VERBOSE="false"
SETTINGS="/Users/pengshuaifeng/works/applications/apache-maven-3.6.3/conf/settings_gzzn.xml"
EXTRA_ARGS=""

############################################
# 帮助
############################################

usage() {
  echo ""
  echo "Usage:"
  echo "  bash ./agent/verify/scripts/java/mvn-compile.sh [options]"
  echo ""
  echo "Options:"
  echo "  -m, --module        指定模块"
  echo "  -p, --profile       Spring profile"
  echo "  -t, --threads       Maven线程数 (默认1C)"
  echo "  --skip-tests        是否跳过测试 (默认true)"
  echo "  --offline           离线模式"
  echo "  --clean             clean compile"
  echo "  -s, --settings      Maven settings.xml 路径（默认不使用）"
  echo "  -v, --verbose       显示详细日志"
  echo "  --extra             额外Maven参数"
  echo ""
  echo "Examples:"
  echo "  bash ./agent/verify/scripts/java/mvn-compile.sh"
  echo "  bash ./agent/verify/scripts/java/mvn-compile.sh -m module-name"
  echo "  bash ./agent/verify/scripts/java/mvn-compile.sh --clean"
  echo "  bash ./agent/verify/scripts/java/mvn-compile.sh -p dev"
  echo "  bash ./agent/verify/scripts/java/mvn-compile.sh -s /path/to/settings.xml"
  echo "  bash ./agent/verify/scripts/java/mvn-compile.sh -m module-name -p test"
  echo ""
}

############################################
# 参数解析
############################################

while [[ $# -gt 0 ]]; do
  case $1 in
    -m|--module)
      MODULE="$2"
      shift 2
      ;;
    -p|--profile)
      PROFILE="$2"
      shift 2
      ;;
    -t|--threads)
      THREADS="$2"
      shift 2
      ;;
    --skip-tests)
      SKIP_TESTS="$2"
      shift 2
      ;;
    --offline)
      OFFLINE="true"
      shift
      ;;
    --clean)
      CLEAN="true"
      shift
      ;;
    -s|--settings)
      SETTINGS="$2"
      shift 2
      ;;
    -v|--verbose)
      VERBOSE="true"
      shift
      ;;
    --extra)
      EXTRA_ARGS="$2"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1"
      usage
      exit 1
      ;;
  esac
done

############################################
# 自动识别 Maven
############################################

if [ -f "./mvnw" ]; then
  MVN="./mvnw"
else
  MVN="mvn"
fi

############################################
# 构建命令
############################################

# 使用数组组装 Maven 命令，避免 eval 拼接带来的参数转义和注入风险。
CMD=("$MVN")

if [ "$CLEAN" = "true" ]; then
  CMD+=("clean")
fi

CMD+=("compile")

CMD+=("-T" "$THREADS")

if [ "$SKIP_TESTS" = "true" ]; then
  CMD+=("-DskipTests")
fi

if [ -n "$MODULE" ]; then
  CMD+=("-pl" "$MODULE" "-am")
fi

if [ -n "$PROFILE" ]; then
  CMD+=("-Dspring.profiles.active=$PROFILE")
fi

if [ -n "$SETTINGS" ]; then
  CMD+=("-s" "$SETTINGS")
fi

if [ "$OFFLINE" = "true" ]; then
  CMD+=("-o")
fi

if [ "$VERBOSE" = "false" ]; then
  CMD+=("-q")
fi

if [ -n "$EXTRA_ARGS" ]; then
  read -r -a EXTRA_ARGS_ARRAY <<< "$EXTRA_ARGS"
  CMD+=("${EXTRA_ARGS_ARRAY[@]}")
fi

############################################
# 执行
############################################

echo ""
echo "======================================"
echo "AI COMPILE START"
echo "======================================"
echo ""
printf '%q ' "${CMD[@]}"
echo ""
echo ""

"${CMD[@]}"

echo ""
echo "======================================"
echo "COMPILE SUCCESS"
echo "======================================"
echo ""
