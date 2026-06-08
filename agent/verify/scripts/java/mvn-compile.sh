#!/usr/bin/env bash

set -e
export PATH="/usr/bin:/bin:/usr/sbin:/sbin${PATH:+:$PATH}"

############################################
# AI Compile Script
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
PROFILE=""
THREADS="1C"
SKIP_TESTS="true"
OFFLINE="false"
CLEAN="false"
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
  echo "  bash ./agent/verify/scripts/java/mvn-compile.sh [options]"
  echo ""
  echo "Options:"
  echo "  -r, --root          Maven 项目根目录，适用于后端在子目录的项目"
  echo "  -m, --module        指定模块"
  echo "  -p, --profile       Spring profile"
  echo "  -t, --threads       Maven线程数 (默认1C)"
  echo "  --skip-tests        是否跳过测试 (默认true)"
  echo "  --offline           离线模式"
  echo "  --clean             clean compile"
  echo "  --java-home         JDK 根目录（默认 /Library/Java/JavaVirtualMachines/jdk-1.8.jdk/Contents/Home）"
  echo "  --maven-home        Maven 安装根目录（默认 /Users/pengshuaifeng/works/applications/apache-maven-3.6.3）"
  echo "  -s, --settings      Maven settings.xml 路径（默认 /Users/pengshuaifeng/works/applications/apache-maven-3.6.3/conf/settings_gzzn.xml）"
  echo "  -v, --verbose       显示详细日志"
  echo "  --extra             额外Maven参数"
  echo ""
  echo "Examples:"
  echo "  bash ./agent/verify/scripts/java/mvn-compile.sh"
  echo "  bash ./agent/verify/scripts/java/mvn-compile.sh -r backend-service"
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
    -r|--root|--backend-dir)
      PROJECT_ROOT="$2"
      shift 2
      ;;
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
