#!/usr/bin/env bash

set -e
export PATH="/usr/bin:/bin:/usr/sbin:/sbin${PATH:+:$PATH}"

############################################
# AI Test Script
############################################

SCRIPT_PATH="${BASH_SOURCE[0]}"
if [[ "$SCRIPT_PATH" == */* ]]; then
  SCRIPT_DIR="$(cd "${SCRIPT_PATH%/*}" && pwd)"
else
  SCRIPT_DIR="$(pwd)"
fi
DEFAULT_ROOT_DIR="$(cd "$SCRIPT_DIR/../../../.." && pwd)"
ROOT_DIR=${ROOT_DIR:-$DEFAULT_ROOT_DIR}

cd "$ROOT_DIR"

############################################
# 默认参数
############################################

MODULE=""
PROJECT_ROOT="$ROOT_DIR"
TEST_CLASS=""
TEST_METHOD=""
PROFILE=""
THREADS="1C"
FAIL_FAST="false"
DEBUG="false"
RERUN_FAILING="false"
VERBOSE="false"
JAVA_HOME="/Library/Java/JavaVirtualMachines/jdk-1.8.jdk/Contents/Home"
MAVEN_HOME="/Users/pengshuaifeng/works/applications/apache-maven-3.6.3"
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
  echo "  -r, --root          Maven 项目根目录，适用于后端在子目录的项目"
  echo "  -m, --module        指定模块"
  echo "  -c, --class         测试类"
  echo "  --method            测试方法"
  echo "  -p, --profile       Spring profile"
  echo "  -t, --threads       Maven线程数"
  echo "  --fail-fast         遇错立即停止"
  echo "  --debug             开启debug日志"
  echo "  --rerun-failing     重跑失败测试"
  echo "  --java-home         JDK 根目录（默认 /Library/Java/JavaVirtualMachines/jdk-1.8.jdk/Contents/Home）"
  echo "  --maven-home        Maven 安装根目录（默认 /Users/pengshuaifeng/works/applications/apache-maven-3.6.3）"
  echo "  -s, --settings      Maven settings.xml 路径（默认 /Users/pengshuaifeng/works/applications/apache-maven-3.6.3/conf/settings_gzzn.xml）"
  echo "  -v, --verbose       显示详细日志"
  echo "  --extra             额外Maven参数"
  echo ""
  echo "Examples:"
  echo "  bash ./agent/verify/scripts/java/mvn-test.sh"
  echo "  bash ./agent/verify/scripts/java/mvn-test.sh -r backend-service"
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
    -r|--root|--backend-dir)
      PROJECT_ROOT="$2"
      shift 2
      ;;
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
    --java-home)
      JAVA_HOME="$2"
      shift 2
      ;;
    --maven-home)
      MAVEN_HOME="$2"
      shift 2
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

if [[ "$PROJECT_ROOT" != /* ]]; then
  PROJECT_ROOT="$ROOT_DIR/$PROJECT_ROOT"
fi

export JAVA_HOME
export PATH="$JAVA_HOME/bin:$MAVEN_HOME/bin:/usr/bin:/bin:/usr/sbin:/sbin${PATH:+:$PATH}"

############################################
# 自动识别 Maven
############################################

cd "$PROJECT_ROOT"

if [ -f "./mvnw" ]; then
  MVN="./mvnw"
elif [ -x "$MAVEN_HOME/bin/mvn" ]; then
  MVN="$MAVEN_HOME/bin/mvn"
elif command -v mvn >/dev/null 2>&1; then
  MVN="mvn"
else
  echo "Maven executable not found. Checked ./mvnw, PATH mvn, and $MAVEN_HOME/bin/mvn"
  exit 1
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
