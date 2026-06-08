#!/usr/bin/env bash

set -euo pipefail
export PATH="/usr/bin:/bin:/usr/sbin:/sbin${PATH:+:$PATH}"

SCRIPT_PATH="${BASH_SOURCE[0]}"
if [[ "$SCRIPT_PATH" == */* ]]; then
  SCRIPT_DIR="$(cd "${SCRIPT_PATH%/*}" && pwd)"
else
  SCRIPT_DIR="$(pwd)"
fi
REPO_ROOT="$(cd "$SCRIPT_DIR/../../../.." && pwd)"
DEFAULT_JAVA_HOME="/Library/Java/JavaVirtualMachines/jdk-1.8.jdk/Contents/Home"
DEFAULT_SETTINGS="/Users/pengshuaifeng/works/applications/apache-maven-3.6.3/conf/settings_gzzn.xml"
DEFAULT_MAVEN_HOME="/Users/pengshuaifeng/works/applications/apache-maven-3.6.3"
PATH_WITHOUT_MVN="/usr/bin:/bin:/usr/sbin:/sbin"

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

WRAPPER_PROJECT="$TMP_DIR/project-with-wrapper"
NO_WRAPPER_PROJECT="$TMP_DIR/project-without-wrapper"
mkdir -p "$WRAPPER_PROJECT" "$NO_WRAPPER_PROJECT"

cat > "$WRAPPER_PROJECT/mvnw" <<'EOF'
#!/bin/bash
printf '%q ' "$@"
printf '\n'
EOF
chmod +x "$WRAPPER_PROJECT/mvnw"

custom_maven_home="$TMP_DIR/maven-home"
mkdir -p "$custom_maven_home/bin"
cat > "$custom_maven_home/bin/mvn" <<'EOF'
#!/bin/bash
printf '%q ' "$@"
printf '\n'
EOF
chmod +x "$custom_maven_home/bin/mvn"

assert_contains() {
  local text="$1"
  local expected="$2"
  if [[ "$text" != *"$expected"* ]]; then
    echo "Assertion failed: expected to find [$expected]"
    echo "Actual: $text"
    exit 1
  fi
}

assert_not_contains() {
  local text="$1"
  local unexpected="$2"
  if [[ "$text" == *"$unexpected"* ]]; then
    echo "Assertion failed: expected not to find [$unexpected]"
    echo "Actual: $text"
    exit 1
  fi
}

run_script() {
  local script_path="$1"
  local project_root="$2"
  shift
  shift
  ROOT_DIR="$REPO_ROOT" /bin/bash "$script_path" -r "$project_root" "$@"
}

compile_path_output="$(run_script "$REPO_ROOT/agent/verify/scripts/java/mvn-compile.sh" "$WRAPPER_PROJECT")"
assert_contains "$compile_path_output" "./mvnw"
assert_not_contains "$compile_path_output" "$DEFAULT_MAVEN_HOME/bin/mvn"
assert_contains "$compile_path_output" "-s $DEFAULT_SETTINGS"

compile_help_output="$(ROOT_DIR="$REPO_ROOT" /bin/bash "$REPO_ROOT/agent/verify/scripts/java/mvn-compile.sh" -h)"
assert_contains "$compile_help_output" "$DEFAULT_JAVA_HOME"
assert_contains "$compile_help_output" "$DEFAULT_MAVEN_HOME"

compile_custom_home_output="$(PATH="$PATH_WITHOUT_MVN" run_script "$REPO_ROOT/agent/verify/scripts/java/mvn-compile.sh" "$NO_WRAPPER_PROJECT" --maven-home "$custom_maven_home")"
assert_contains "$compile_custom_home_output" "$custom_maven_home/bin/mvn"
assert_contains "$compile_custom_home_output" "-s $DEFAULT_SETTINGS"

compile_java_override_output="$(PATH="$PATH_WITHOUT_MVN" run_script "$REPO_ROOT/agent/verify/scripts/java/mvn-compile.sh" "$NO_WRAPPER_PROJECT" --java-home /tmp/custom-jdk --maven-home "$custom_maven_home")"
assert_contains "$compile_java_override_output" "$custom_maven_home/bin/mvn"

compile_override_output="$(run_script "$REPO_ROOT/agent/verify/scripts/java/mvn-compile.sh" "$WRAPPER_PROJECT" -s /tmp/custom-settings.xml)"
assert_contains "$compile_override_output" "-s /tmp/custom-settings.xml"
assert_not_contains "$compile_override_output" "-s $DEFAULT_SETTINGS"

test_default_output="$(run_script "$REPO_ROOT/agent/verify/scripts/java/mvn-test.sh" "$WRAPPER_PROJECT")"
assert_contains "$test_default_output" "-s $DEFAULT_SETTINGS"

test_override_output="$(run_script "$REPO_ROOT/agent/verify/scripts/java/mvn-test.sh" "$WRAPPER_PROJECT" -s /tmp/custom-settings.xml)"
assert_contains "$test_override_output" "-s /tmp/custom-settings.xml"
assert_not_contains "$test_override_output" "-s $DEFAULT_SETTINGS"

test_help_output="$(ROOT_DIR="$REPO_ROOT" /bin/bash "$REPO_ROOT/agent/verify/scripts/java/mvn-test.sh" -h)"
assert_contains "$test_help_output" "$DEFAULT_JAVA_HOME"
assert_contains "$test_help_output" "$DEFAULT_MAVEN_HOME"

test_custom_home_output="$(PATH="$PATH_WITHOUT_MVN" run_script "$REPO_ROOT/agent/verify/scripts/java/mvn-test.sh" "$NO_WRAPPER_PROJECT" --maven-home "$custom_maven_home")"
assert_contains "$test_custom_home_output" "$custom_maven_home/bin/mvn"

echo "Maven settings default/override tests passed."
