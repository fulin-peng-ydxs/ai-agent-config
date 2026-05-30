# AI 验证脚本说明

本目录提供给 AI 代理和人工复用的统一验证入口。开发技能应只调用这里的脚本，不直接拼接 `mvn`、`pnpm`、`npm`、`tsc`、`eslint` 等自由命令做最终验证。

## 新项目接入步骤

1. 复制 `agent/verify` 到新项目根目录。
2. 先按项目原有方式安装前端依赖，例如在前端目录执行 `pnpm install`、`npm install` 或 `yarn install`。
3. 修改 `scripts/vue/ai-config.json`：
   - `frontendDir`：前端目录。前后端放一起时可填服务目录；前后端分开时填独立前端目录。
   - `devCommand`：前端开发服务启动命令。
   - `baseUrl`：动态地址解析失败时的兜底地址。
   - `routerConfigFiles`：Vue Router 配置文件路径。
   - `checks.lintScripts` 和 `checks.typecheckScripts`：项目已有检查脚本名。
   - `checks.lintRequired` 和 `checks.typecheckRequired`：找不到检查脚本和本地工具时是否失败。
   - `checks.buildRequired` 和 `checks.buildScripts`：是否默认执行构建校验，以及构建脚本名。
   - `auth`：认证方式，默认 `storage`，需要替换 token 名称和值。
   - `pageCheck`：是否默认执行页面自动化，以及页面等待、就绪选择器、白屏阈值和登录失效判断。
4. 如果需要页面自动化校验，安装前端浏览器校验依赖：
   `bash ./agent/verify/scripts/install-vue-check-deps.sh`
5. 生成页面映射：
   `node ./agent/verify/scripts/vue/update-page-map.js`
6. 人工补充公共影响映射：
   - 在 `scripts/vue/page-map.json` 中补充公共组件、hooks、store、工具函数等会影响的页面。
7. 执行配置自检：
   `node ./agent/verify/scripts/check-verify-config.js`
8. 用一个已知前端页面文件试跑：
   `node ./agent/verify/scripts/vue/ai-check.js <前端页面文件>`

### 补充说明

- 路径、目录、配置文件找不到等问题，先查看 [PATH-TROUBLESHOOTING.md](PATH-TROUBLESHOOTING.md)。

## 后端脚本

- `scripts/java/mvn-compile.sh`：编译后端代码。
  - 全量编译：`bash ./agent/verify/scripts/java/mvn-compile.sh`
  - 后端在子目录：`bash ./agent/verify/scripts/java/mvn-compile.sh -r 后端目录`
  - 指定模块：`bash ./agent/verify/scripts/java/mvn-compile.sh -m 模块名`
  - 清理后编译：`bash ./agent/verify/scripts/java/mvn-compile.sh --clean`
  - 指定 Maven settings：`bash ./agent/verify/scripts/java/mvn-compile.sh -s /path/to/settings.xml`
- `scripts/java/mvn-test.sh`：运行后端测试。
  - 全量测试：`bash ./agent/verify/scripts/java/mvn-test.sh`
  - 后端在子目录：`bash ./agent/verify/scripts/java/mvn-test.sh -r 后端目录`
  - 指定模块：`bash ./agent/verify/scripts/java/mvn-test.sh -m 模块名`
  - 指定测试类：`bash ./agent/verify/scripts/java/mvn-test.sh -c 测试类名`
  - 指定测试方法：`bash ./agent/verify/scripts/java/mvn-test.sh -c 测试类名 --method 方法名`
  - 指定模块和方法：`bash ./agent/verify/scripts/java/mvn-test.sh -m 模块名 -c 测试类名 --method 方法名`
  - 指定 Maven settings：`bash ./agent/verify/scripts/java/mvn-test.sh -s /path/to/settings.xml`

## 前端脚本

- `scripts/vue/ai-check.js`：前端统一校验入口。
  - 自动读取 Git 工作区前端改动：`node ./agent/verify/scripts/vue/ai-check.js`
  - 指定改动文件：`node ./agent/verify/scripts/vue/ai-check.js <frontendDir>/src/views/demo/index.vue`
  - 强制构建校验：`node ./agent/verify/scripts/vue/ai-check.js --build <frontendDir>/src/views/demo/index.vue`
  - 强制页面自动化：`node ./agent/verify/scripts/vue/ai-check.js --page <frontendDir>/src/views/demo/index.vue`
  - 默认校验内容：lint、类型检查；构建和页面自动化按配置或命令参数启用。
- `scripts/install-vue-check-deps.sh`：安装前端浏览器校验依赖。
  - 执行：`bash ./agent/verify/scripts/install-vue-check-deps.sh`
  - 作用：在 `ai-config.json` 指定的前端目录安装 `playwright`，并安装 Chromium 浏览器。
  - 注意：只有执行 `--page` 或 `pageCheck.required=true` 的页面自动化时才需要；该脚本不安装项目原有依赖，lint、typecheck、build、dev server 仍要求项目已先完成 `pnpm install`、`npm install` 或 `yarn install`。
- `scripts/vue/update-page-map.js`：更新文件到页面路由的映射。
  - 执行：`node ./agent/verify/scripts/vue/update-page-map.js`
  - 作用：扫描 `ai-config.json.routerConfigFiles` 中的路由组件，增量更新 `scripts/vue/page-map.json`。
- `scripts/check-verify-config.js`：验证脚本配置自检。
  - 执行：`node ./agent/verify/scripts/check-verify-config.js`
  - 作用：检查前端目录、启动命令、检查脚本、路由文件、认证配置、Playwright、Maven 等是否明显不合理。

## 前端脚本架构

前端验证以 `scripts/vue/ai-check.js` 为唯一入口，其它脚本和配置文件只作为它的依赖或维护工具。

```text
ai-check.js
├── 读取 ai-config.json
├── 读取 page-map.json
├── 识别本次前端改动文件
├── 执行 lint / 类型检查
├── 按需执行 build
└── 按需执行页面自动化
    ├── 调用 start-dev.js 启动前端服务并动态发现访问地址
    ├── 调用 login.js 按动态地址写入登录态
    ├── 调用 verify-pages.js 按动态地址访问受影响页面
    └── 调用 stop-dev.js 清理前端服务
```

各文件职责：

- `scripts/vue/ai-check.js`
  - 前端验证总入口，AI 和人工都应优先调用它。
  - 输入：可选的改动文件列表；未传时自动读取 Git 工作区前端改动。
  - 主要流程：过滤前端文件、执行 lint/类型检查、按需执行构建、按需执行页面自动化。
  - lint 会尽量把本次文件传给项目 lint 脚本或 eslint fallback。
  - typecheck 仍执行全项目类型检查；当 `typecheckOnlyFailOnSpecifiedFiles=true` 且命令显式传入文件时，只把命中本次文件的类型错误作为失败，未命中本次文件的历史类型错误只警告。
  - `--build` 或 `checks.buildRequired=true` 时，静态检查后执行构建校验。
  - `--page` 或 `pageCheck.required=true` 时，启动服务、认证、按页面映射访问页面并收集失败。
  - 失败条件：依赖缺失、lint/类型检查失败、构建失败、服务启动或认证失败、页面打开失败、控制台 error、页面异常、HTTP 500、白屏。
- `scripts/vue/ai-config.json`
  - 前端验证的项目级配置。
  - 维护内容：前端目录、启动命令、兜底访问地址、运行时地址文件、静态检查脚本候选名、启动等待时间、认证策略、页面就绪判断、登录态文件位置、截图目录。
  - 新项目接入时优先改这个文件，不要在脚本里写死项目路径、端口或账号选择器。
- `scripts/vue/page-map.json`
  - 文件路径到页面路由的影响范围映射。
  - `ai-check.js` 根据本次改动文件匹配 key，并访问对应页面。
  - 视图路由可由 `update-page-map.js` 生成；公共组件、公共 hooks、store、工具函数等间接影响范围需要人工补充。
- `scripts/vue/update-page-map.js`
  - 页面映射维护脚本，不参与每次验证主流程。
  - 用于新项目首次接入、路由变化、页面新增或目录迁移后更新 `page-map.json`。
  - 默认扫描 `ai-config.json.routerConfigFiles` 指定的路由文件，从 `path` 和 `component import` 生成映射。
  - 适合显式 Vue Router 配置；其他项目路由写法不同时，优先调整 `routerConfigFiles`，不够时再调整该脚本。
- `scripts/vue/start-dev.js`
  - 按 `ai-config.json` 的 `devCommand` 在 `frontendDir` 中启动开发服务。
  - 会把进程 pid 写入仓库根目录 `.ai-dev.pid`，供清理脚本使用。
  - 会捕获开发服务输出，优先解析 `localhost` 或 `127.0.0.1` 访问地址，并写入 `runtimeBaseUrlPath`。
  - 如果在 `startupWaitMs` 内没有解析到地址，才回退使用 `ai-config.json` 的 `baseUrl`。
  - 临时调试时可用环境变量 `AI_VERIFY_DEV_COMMAND` 覆盖启动命令，不建议写入长期流程。
- `scripts/vue/stop-dev.js`
  - 根据 `.ai-dev.pid` 停止前端开发服务。
  - `ai-check.js` 在 `finally` 中调用它，避免校验失败后服务残留，并清理运行时访问地址文件。
- `scripts/vue/login.js`
  - 使用 Playwright 建立认证态，优先读取运行时动态地址。
  - 默认使用 `auth.mode=storage`，按配置写入 localStorage、sessionStorage 或 cookie。
  - 也支持 `auth.mode=form` 走账号密码表单登录，或 `auth.mode=none` 跳过认证。
  - 认证态生成后把 storage state 写入 `authStatePath`，供页面访问复用。
  - token 名称和值、cookie 属性、登录页结构、账号或成功跳转规则变化时，维护 `ai-config.json` 的 `auth` 节点。
- `scripts/vue/verify-pages.js`
  - 使用 Playwright 按运行时动态地址访问 `page-map.json` 解析出的页面列表。
  - 检查控制台错误、页面异常、HTTP 500、登录态失效和白屏。
  - 页面等待策略、就绪选择器、白屏文本阈值和登录跳转判断由 `pageCheck` 配置。
  - 将页面截图写入 `screenshotDir`，便于失败后人工查看。
- `scripts/install-vue-check-deps.sh`
  - 安装前端浏览器校验所需依赖。
  - 按前端目录中的 lock 文件选择 `pnpm`、`yarn` 或 `npm`，安装 `playwright` 和 Chromium。
  - 只在需要页面自动化且首次接入或依赖缺失时执行，不是每次验证都要执行。

前端脚本维护原则：

- `ai-check.js` 保持为唯一入口，不新增多个互相竞争的验证入口。
- 项目差异优先放到 `ai-config.json`，其次放到 `page-map.json`，最后才改脚本逻辑。
- lint/typecheck 优先调用 `package.json scripts` 中的项目标准脚本；候选脚本名由 `ai-config.json.checks` 维护。
- `checks.*Required=true` 时，如果找不到对应 package script 和本地工具，前端验证会失败；否则只警告或跳过。
- 页面自动化默认不执行；用户强制要求页面验证时使用 `--page`，或将 `pageCheck.required` 设为 `true`。
- 构建校验默认不执行；用户强制要求构建验证时使用 `--build`，或将 `checks.buildRequired` 设为 `true`。
- `page-map.json` 自动生成后要保留人工补充的公共影响映射，例如 `double-prevention-vue/src/components` 影响多个页面。
- 新项目复制本目录后，至少检查 `frontendDir`、`devCommand`、`baseUrl`、`auth`、`pageCheck`、`routerConfigFiles` 和路由映射生成逻辑。
- 访问地址尽量动态获取：优先由 `start-dev.js` 从开发服务输出中解析，`baseUrl` 只作为解析失败时的兜底配置。
- `agent/verify/.runtime/`、`agent/verify/.auth/`、`agent/verify/screenshots/` 是运行时产物目录，默认不提交。

## 配置与数据维护

- `scripts/vue/ai-config.json`
  - `frontendDir`：前端目录。
    - 前后端同目录时填类似 `service-a`。
    - 前后端分目录时填类似 `service-a/web` 或 `frontend-app`。
  - `devCommand`：启动开发服务的命令，执行目录为 `frontendDir`。
  - `baseUrl`：页面校验兜底访问地址；正常情况下优先使用动态解析出的地址。
  - `runtimeBaseUrlPath`：`start-dev.js` 写入动态访问地址的位置。
  - `devLogPath`：前端开发服务输出日志位置，用于排查地址解析和启动失败。
  - `startupWaitMs`：启动服务后的等待时间。
  - `authStatePath`：登录态保存位置。
  - `screenshotDir`：页面截图输出位置。
  - `routerConfigFiles`：用于生成页面映射的路由配置文件，可配置一个或多个相对前端目录的路径。
  - `checks.lintRequired`：找不到 lint 脚本和本地 eslint 时是否失败。
  - `checks.typecheckRequired`：找不到类型检查脚本和本地 `vue-tsc`/`tsc` 时是否失败。
  - `checks.typecheckOnlyFailOnSpecifiedFiles`：显式传入文件时，typecheck 全量执行但只用本次文件相关错误阻断，适合存在历史类型债的项目。
  - `checks.buildRequired`：是否默认执行构建校验。
  - `checks.lintScripts`：按顺序尝试的 lint 脚本名，例如 `lint`、`lint:check`。
  - `checks.typecheckScripts`：按顺序尝试的类型检查脚本名，例如 `type-check`、`typecheck`。
  - `checks.buildScripts`：按顺序尝试的构建脚本名，例如 `build`、`build:prod`。
  - `auth.mode`：认证策略，支持 `storage`、`form`、`none`。
  - `auth.storage.localStorage`：需要写入 localStorage 的键值列表。
  - `auth.storage.sessionStorage`：需要写入 sessionStorage 的键值列表。
  - `auth.storage.cookies`：需要写入 cookie 的键值和属性列表。
  - `auth.form`：表单登录配置，包括登录页路径、账号、选择器和成功跳转判断。
  - `pageCheck.required`：是否默认执行页面自动化校验。
  - `pageCheck.waitUntil`：页面跳转等待策略，例如 `domcontentloaded`、`load`、`networkidle`。
  - `pageCheck.timeoutMs`：页面打开和就绪等待超时时间。
  - `pageCheck.readySelector`：页面就绪选择器，留空则不额外等待。
  - `pageCheck.whiteScreenMinTextLength`：白屏判断的最小正文长度。
  - `pageCheck.loginPathIncludes`：访问后 URL 包含该片段时视为登录态失效。
- `scripts/vue/page-map.json`
  - key 是仓库相对文件或目录路径。
  - value 是这些文件变更后需要访问验证的页面路径。
  - 新项目首次接入或路由大规模变化时，执行 `update-page-map.js`。
  - 自动生成无法覆盖组件间接影响时，人工补充公共组件映射，例如组件目录影响首页、看板或业务页面。

## 给 AI 使用的提示

如果你手动使用，可以把下面这段直接给 AI：

```text
开发完成后只能使用 ./agent/verify 下的脚本验证。后端改动按是否写测试选择 mvn-compile.sh 或 mvn-test.sh；若后端 pom.xml 不在项目根目录，使用 -r/--root 指定后端目录；前端改动执行 node ./agent/verify/scripts/vue/ai-check.js，可传入本次改动文件，前端目录以 ai-config.json 的 frontendDir 为准。用户强制要求构建验证时追加 --build；用户强制要求页面自动化验证时追加 --page。若前端脚本提示缺少 Playwright，先执行 bash ./agent/verify/scripts/install-vue-check-deps.sh。不要直接运行 mvn、pnpm、npm、tsc、eslint 作为最终验证命令。
```
