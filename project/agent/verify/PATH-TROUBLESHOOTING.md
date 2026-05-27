# 路径问题排查说明

本文件用于排查 `agent/verify` 脚本中常见的路径、目录和配置错误。

## 1. 执行目录不对

推荐在项目根目录执行脚本：

```bash
node ./agent/verify/scripts/check-verify-config.js
node ./agent/verify/scripts/vue/ai-check.js
bash ./agent/verify/scripts/java/mvn-compile.sh
```

如果不在项目根目录执行，可能出现：

- 找不到 `agent/verify/scripts/vue/ai-config.json`
- 找不到 `pom.xml`
- 找不到前端目录
- Git 改动文件识别不准确

Shell 脚本可用 `ROOT_DIR` 指定项目根目录：

```bash
ROOT_DIR=/path/to/project bash ./agent/verify/scripts/java/mvn-compile.sh
ROOT_DIR=/path/to/project bash ./agent/verify/scripts/install-vue-check-deps.sh
```

## 2. `frontendDir` 配错

配置位置：

```json
"frontendDir": "double-prevention-vue"
```

该路径相对项目根目录。

如果目录不存在，会影响：

- `scripts/vue/ai-check.js`
- `scripts/install-vue-check-deps.sh`
- `scripts/vue/update-page-map.js`
- `scripts/check-verify-config.js`
- `scripts/vue/start-dev.js`
- `scripts/vue/login.js`
- `scripts/vue/verify-pages.js`

常见表现：

- 找不到 `package.json`
- 找不到 lock 文件
- 找不到 `node_modules/.bin/vue-tsc`
- 无法启动 dev server
- 自检输出 `FAIL frontendDir missing`

## 3. `routerConfigFiles` 配错

配置位置：

```json
"routerConfigFiles": [
  "src/router/config.ts"
]
```

路径相对 `frontendDir`。

如果路由文件不存在，执行：

```bash
node ./agent/verify/scripts/vue/update-page-map.js
```

可能失败并提示：

```text
No router config files found. Configure ai-config.json routerConfigFiles.
```

自检也会输出：

```text
FAIL router config missing
```

## 4. `page-map.json` 不存在或格式错误

`scripts/vue/ai-check.js` 会读取：

```text
agent/verify/scripts/vue/page-map.json
```

如果文件不存在或 JSON 格式错误，前端验证脚本会在启动阶段失败。

可重新生成：

```bash
node ./agent/verify/scripts/vue/update-page-map.js
```

如果公共组件、hooks、store、工具函数会影响页面，需要人工补充 `page-map.json` 中对应映射。

## 5. 运行时地址文件不可写

相关配置：

```json
"runtimeBaseUrlPath": "agent/verify/.runtime/vue-base-url.txt",
"devLogPath": "agent/verify/.runtime/vue-dev-server.log"
```

`start-dev.js` 会创建目录并写入运行时访问地址和 dev server 日志。

可能失败的情况：

- 当前用户没有项目目录写权限
- 路径配置到不可创建的位置
- 路径被配置成目录而不是文件

默认运行时目录已由 `.gitignore` 忽略：

```text
agent/verify/.runtime/
```

## 6. 登录态或截图目录不可写

相关配置：

```json
"authStatePath": "agent/verify/.auth/vue-user.json",
"screenshotDir": "agent/verify/screenshots/vue"
```

页面自动化验证时会写入登录态和页面截图。

可能失败的情况：

- 当前用户没有写权限
- 路径配置到不可创建的位置
- 路径被配置成文件/目录类型不匹配

默认这些目录已由 `.gitignore` 忽略：

```text
agent/verify/.auth/
agent/verify/screenshots/
```

## 7. Maven settings 路径错误

后端脚本支持可选 settings：

```bash
bash ./agent/verify/scripts/java/mvn-compile.sh -s /path/to/settings.xml
bash ./agent/verify/scripts/java/mvn-test.sh -s /path/to/settings.xml
```

默认不使用 settings 参数。

如果传入的 `settings.xml` 不存在，Maven 会报错。脚本只负责把 `-s` 参数传给 Maven，不提前校验文件存在性。

## 8. `ROOT_DIR` 配错

Shell 脚本支持：

```bash
ROOT_DIR=/path/to/project bash ./agent/verify/scripts/java/mvn-compile.sh
```

如果 `ROOT_DIR` 配错，可能导致：

- `cd "$ROOT_DIR"` 失败
- 找不到 `pom.xml`
- 找不到 `agent/verify/scripts/vue/ai-config.json`
- 前端目录解析错误

## 9. `ai-check.js` 文件参数传错

示例：

```bash
node ./agent/verify/scripts/vue/ai-check.js xxx.vue
```

如果传入文件不在 `frontendDir` 下，脚本会输出：

```text
no frontend changed files
```

这不一定是脚本错误，但表示本次没有匹配到需要执行前端验证的文件。

排查方式：

- 确认文件路径是否相对项目根目录
- 确认文件是否位于 `frontendDir` 下
- 确认扩展名是否属于脚本识别范围：`.vue`、`.ts`、`.tsx`、`.js`、`.jsx`、`.css`、`.less`、`.scss`

## 10. 建议排查顺序

1. 先执行配置自检：

```bash
node ./agent/verify/scripts/check-verify-config.js
```

2. 若自检提示前端配置问题，优先检查：

- `scripts/vue/ai-config.json`
- `frontendDir`
- `routerConfigFiles`
- `checks`
- `auth`
- `pageCheck`

3. 若页面自动化失败，继续检查：

- `runtimeBaseUrlPath`
- `devLogPath`
- `authStatePath`
- `screenshotDir`
- `page-map.json`

4. 若后端验证失败，检查：

- 是否在项目根目录执行
- `pom.xml` 是否存在
- 是否需要 `-s /path/to/settings.xml`
- 是否需要 `-m 模块名`
