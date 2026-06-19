## 验证分层

- 第一层：脚本验证。所有代码改动的最终验证必须走 `agent/verify/scripts` 下的脚本。
- 第二层：脚本页面自动化。可选能力，默认不开启；仅在明确要求脚本页面自动化或配置开启时执行。
- 第三层：AI 浏览器截图复核。可选能力，默认不开启；仅在明确出现带有“AI”的页面自动化测试关键词时执行。
- 第四层：UI 规范验证。涉及 UI 改动时，对照项目根目录 `DESIGN.md` 做一致性验证。

## 脚本验证

- 总规则：任何 AI 代码改动验证只能调用 `agent/verify/scripts` 下的脚本
- 禁止：不得直接以 `mvn`、`pnpm`、`npm`、`tsc`、`eslint` 等自由命令作为最终验证
- 可选能力默认关闭：脚本页面自动化和 AI 浏览器截图复核都不是默认验证项，必须按各自触发条件显式开启
- 最终验证边界：AI 浏览器截图复核不能替代基础脚本验证；即使开启 AI 浏览器截图复核，也仍需按后端或前端改动类型执行对应的非页面脚本验证


### 后端验证

- 普通 Java 代码改动：`bash ./agent/verify/scripts/java/mvn-compile.sh`
- 涉及测试相关代码：`bash ./agent/verify/scripts/java/mvn-test.sh`
- 后端 `pom.xml` 不在项目根目录，或改动位于某个后端服务子目录时：追加 `-r/--root 后端目录`
- 多模块且能确定模块时：追加 `-m 模块名`
- 后端在子目录且能确定模块时：同时追加 `-r 后端目录 -m 模块名`

示例：

```bash
bash ./agent/verify/scripts/java/mvn-compile.sh -r 后端目录 -m 模块名
bash ./agent/verify/scripts/java/mvn-test.sh -r 后端目录 -m 模块名
```

### 前端验证

- 普通 Vue 页面、组件、样式改动：`node ./agent/verify/scripts/vue/ai-check.js 改动文件路径`
- 不传文件路径：脚本自动读取 Git 工作区中的前端改动
- 命令通常从项目根目录发起，便于使用 `./agent/...` 相对路径定位脚本
- 前端目录以 `agent/verify/scripts/vue/ai-config.json` 的 `frontendDir` 为准
- `package.json`、锁文件、`node_modules` 和本地 `.bin` 均按 `frontendDir` 解析，不要求位于项目根目录
- 前后端放一起时：`frontendDir` 可指向服务目录
- 前后端分开时：`frontendDir` 应指向实际前端目录
- 传入文件路径：必须相对项目根目录，且位于 `frontendDir` 下

- 命中以下任一情况，追加构建验证 `--build`
  - 用户明确要求 build、打包、构建验证
  - 修改 `package.json`、锁文件、`vite.config.*`、`.env*`
  - 修改 `main.ts`、`App.vue`
  - 修改路由懒加载、动态 import、别名、构建输出配置

- 命中以下任一情况，追加页面自动化验证 `--page`
  - 用户明确要求脚本页面自动化、`--page` 页面验证、Playwright 页面巡检

示例：

```bash
node ./agent/verify/scripts/vue/ai-check.js
node ./agent/verify/scripts/vue/ai-check.js 改动文件路径
node ./agent/verify/scripts/vue/ai-check.js --build 改动文件路径
node ./agent/verify/scripts/vue/ai-check.js --page 改动文件路径
node ./agent/verify/scripts/vue/ai-check.js --build --page 改动文件路径
```

- 注意：`pnpm build` 可能改写 `src/main/resources/static/`，不要直接执行；需要构建时统一使用 `ai-check.js --build`


## 脚本页面自动化验证

- 默认状态：不开启。
- 开启方式：
  - 用户明确要求脚本页面自动化、`--page` 页面验证、Playwright 页面巡检时，在前端验证命令中追加 `--page`
  - 项目将 `agent/verify/scripts/vue/ai-config.json` 的 `pageCheck.required` 配置为 `true`
- 执行入口：仍然只能使用 `node ./agent/verify/scripts/vue/ai-check.js --page ...`
- 验证范围：页面打开、登录态、控制台 error、页面异常、HTTP 500、白屏，以及脚本内置的截图产物。
- 截图产物：脚本写入 `ai-config.json` 配置的 `screenshotDir`，用于失败定位和人工查看。
- 依赖缺失：如果脚本提示缺少 Playwright，先执行 `bash ./agent/verify/scripts/install-vue-check-deps.sh`，再重新执行脚本验证。
- 禁止：不得绕过 `ai-check.js` 直接用自由命令启动前端服务作为最终验证流程。

## AI 浏览器截图复核

- 默认状态：不开启。
- 定位：AI 浏览器截图复核是 AI 自身能力驱动的页面视觉复核，不是脚本页面自动化的默认步骤。
- 开启条件：只有明确出现同时包含“AI”和页面自动化测试含义的关键词才执行，例如：
  - “AI 页面自动化测试”
  - “AI 浏览器截图验证”
  - “AI 截图复核”
  - “AI 用浏览器检查页面效果”
  - “AI 视觉页面验证”
- 不开启情形：
  - 只说“页面验证”“浏览器验证”“页面自动化”“截图”“看页面效果”时，不自动开启 AI 浏览器截图复核。
  - 只要求脚本页面自动化、`--page` 页面验证、Playwright 页面巡检时，不自动开启 AI 浏览器截图复核。
- 使用方式：
  - 使用当前 AI 环境提供的浏览器控制、截图、视觉检查能力完成复核。
  - AI 可使用当前环境提供的浏览器控制、截图、视觉检查能力，对关键页面进行截图并检查布局、遮挡、溢出、空白、错位、弹窗和核心交互状态。
- 结论要求：
  - 最终说明中区分“基础脚本验证结果”和“AI 浏览器截图复核结果”。
  - 若没有启用 AI 浏览器截图复核，不得暗示已经做过截图视觉检查。
  - 若当前环境没有可用浏览器能力，应说明未执行 AI 浏览器截图复核，不能把它记为通过。
- 边界：
  - AI 浏览器截图复核不能绕过 `agent/verify/scripts` 直接运行 `pnpm dev`、`npm run dev`、`vite` 等命令作为最终验证。
  - 截图复核发现问题时，应先修复，再重新执行基础脚本验证；若仍满足 AI 浏览器截图复核开启条件，可再次执行截图复核。

## UI 验证

- 涉及页面、组件、样式、布局、表格、列表、弹窗、抽屉等前端 UI 改动时，除常规脚本校验外，还必须对照项目根目录 `DESIGN.md` 做一致性验证。
- 如果 `DESIGN.md` 已定义相关规范，出现冲突实现时视为未通过，不直接交付。
- 如果 `DESIGN.md` 未覆盖当前 UI 场景，应先补齐规范或经用户确认后再交付，不再临时自创一套验证口径。
