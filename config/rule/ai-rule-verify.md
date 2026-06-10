## 自动验证脚本

- 总规则：任何 AI 代码改动验证只能调用 `agent/verify/scripts` 下的脚本
- 禁止：不得直接以 `mvn`、`pnpm`、`npm`、`tsc`、`eslint` 等自由命令作为最终验证


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
  - 用户明确要求页面验证、浏览器验证

示例：

```bash
node ./agent/verify/scripts/vue/ai-check.js
node ./agent/verify/scripts/vue/ai-check.js 改动文件路径
node ./agent/verify/scripts/vue/ai-check.js --build 改动文件路径
node ./agent/verify/scripts/vue/ai-check.js --page 改动文件路径
node ./agent/verify/scripts/vue/ai-check.js --build --page 改动文件路径
```

- 注意：`pnpm build` 可能改写 `src/main/resources/static/`，不要直接执行；需要构建时统一使用 `ai-check.js --build`


## UI 改动验证

- 涉及页面、组件、样式、布局、表格、列表、弹窗、抽屉等前端 UI 改动时，除常规脚本校验外，还必须对照项目根目录 `DESIGN.md` 做一致性验证。
- 如果 `DESIGN.md` 已定义相关规范，出现冲突实现时视为未通过，不直接交付。
- 如果 `DESIGN.md` 未覆盖当前 UI 场景，应先补齐规范或经用户确认后再交付，不再临时自创一套验证口径。
