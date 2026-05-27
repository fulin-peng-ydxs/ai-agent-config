#!/usr/bin/env bash

set -e

############################################
# AI Test Script
############################################

ROOT_DIR=${ROOT_DIR:-$(pwd)}

cd "$ROOT_DIR"

############################################
# 默认参数
############################################

MODULE=""
TEST_CLASS=""
TEST_METHOD=""
PROFILE=""
THREADS="1C"
FAIL_FAST="false"
DEBUG="false"
RERUN_FAILING="false"
VERBOSE="false"
SETTINGS="/Users/pengshuaifeng/works/applications/apache-maven-3.6.3/conf/settings_gzzn.xml"
EXTRA_ARGS=""

############################################
# 帮助
############################################

usage() {
  echo ""
  echo "Usage:"
  echo "  bash ./agent/verify/scripts/java/mvn-test.sh [options]"
  echo ""
  echo "Options:"
  echo "  -m, --module        指定模块"
  echo "  -c, --class         测试类"
  echo "  --method            测试方法"
  echo "  -p, --profile       Spring profile"
  echo "  -t, --threads       Maven线程数"
  echo "  --fail-fast         遇错立即停止"
  echo "  --debug             开启debug日志"
  echo "  --rerun-failing     重跑失败测试"
  echo "  -s, --settings      Maven settings.xml 路径（默认不使用）"
  echo "  -v, --verbose       显示详细日志"
  echo "  --extra             额外Maven参数"
  echo ""
  echo "Examples:"
  echo "  bash ./agent/verify/scripts/java/mvn-test.sh"
  echo "  bash ./agent/verify/scripts/java/mvn-test.sh -m module-name"
  echo "  bash ./agent/verify/scripts/java/mvn-test.sh -c UserServiceTest"
  echo "  bash ./agent/verify/scripts/java/mvn-test.sh -c UserServiceTest --method testLogin"
  echo "  bash ./agent/verify/scripts/java/mvn-test.sh -s /path/to/settings.xml"
  echo "  bash ./agent/verify/scripts/java/mvn-test.sh -m module-name -c UserServiceTest"
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
    -c|--class)
      TEST_CLASS="$2"
      shift 2
      ;;
    --method)
      TEST_METHOD="$2"
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
    --fail-fast)
      FAIL_FAST="true"
      shift
      ;;
    --debug)
      DEBUG="true"
      shift
      ;;
    --rerun-failing)
      RERUN_FAILING="true"
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
# 构建测试目标
############################################

TEST_TARGET=""

if [ -n "$TEST_CLASS" ] && [ -n "$TEST_METHOD" ]; then
  TEST_TARGET="$TEST_CLASS#$TEST_METHOD"
elif [ -n "$TEST_CLASS" ]; then
  TEST_TARGET="$TEST_CLASS"
fi

############################################
# 构建命令
############################################

# 使用数组组装 Maven 命令，避免测试类、方法、模块参数中出现特殊字符时被 shell 误解析。
CMD=("$MVN" "test")

CMD+=("-T" "$THREADS")

if [ -n "$MODULE" ]; then
  CMD+=("-pl" "$MODULE" "-am")
fi

if [ -n "$TEST_TARGET" ]; then
  CMD+=("-Dtest=$TEST_TARGET")
fi

if [ -n "$PROFILE" ]; then
  CMD+=("-Dspring.profiles.active=$PROFILE")
fi

if [ -n "$SETTINGS" ]; then
  CMD+=("-s" "$SETTINGS")
fi

if [ "$FAIL_FAST" = "true" ]; then
  CMD+=("-Dsurefire.skipAfterFailureCount=1")
fi

if [ "$DEBUG" = "true" ]; then
  CMD+=("-X")
fi

if [ "$RERUN_FAILING" = "true" ]; then
  CMD+=("-Dsurefire.rerunFailingTestsCount=2")
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
echo "AI TEST START"
echo "======================================"
echo ""
printf '%q ' "${CMD[@]}"
echo ""
echo ""

"${CMD[@]}"

echo ""
echo "======================================"
echo "TEST SUCCESS"
echo "======================================"
echo ""
