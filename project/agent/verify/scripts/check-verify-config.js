const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { createRequire } = require('module');

const rootDir = path.resolve(__dirname, '../../..');
const verifyDir = path.resolve(rootDir, 'agent/verify');
const vueScriptDir = path.resolve(verifyDir, 'scripts/vue');
const configPath = path.resolve(vueScriptDir, 'ai-config.json');

let failCount = 0;
let warnCount = 0;
const useColor = process.stdout.isTTY && process.env.NO_COLOR !== '1';

function color(text, code) {

    return useColor ? `\x1b[${code}m${text}\x1b[0m` : text;
}

function pass(message) {

    console.log(`${color('通过', '32')} ${message}`);
}

function warn(message) {

    warnCount += 1;
    console.log(`${color('警告', '33')} ${message}`);
}

function fail(message) {

    failCount += 1;
    console.log(`${color('失败', '31')} ${message}`);
}

function exists(filePath) {

    return fs.existsSync(filePath);
}

function readJson(filePath) {

    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (e) {
        fail(`JSON 格式无效：${path.relative(rootDir, filePath)}（${e.message}）`);
        return null;
    }
}

function commandExists(command, cwd = rootDir) {

    return spawnSync(
        command,
        ['--version'],
        {
            cwd,
            stdio: 'ignore'
        }
    ).status === 0;
}

function getPackageScripts(frontendDir) {

    const packagePath = path.resolve(frontendDir, 'package.json');

    if (!exists(packagePath)) {
        fail(`前端 package.json 不存在：${path.relative(rootDir, packagePath)}`);
        return {};
    }

    const pkg = readJson(packagePath);
    return pkg && pkg.scripts ? pkg.scripts : {};
}

function checkRequiredFiles() {

    // 先检查验证目录是否复制完整；缺核心脚本时后续配置检查没有意义。
    [
        'README.md',
        'scripts/install-vue-check-deps.sh',
        'scripts/java/mvn-compile.sh',
        'scripts/java/mvn-test.sh',
        'scripts/vue/ai-check.js',
        'scripts/vue/ai-config.json',
        'scripts/vue/login.js',
        'scripts/vue/page-map.json',
        'scripts/vue/start-dev.js',
        'scripts/vue/stop-dev.js',
        'scripts/vue/update-page-map.js',
        'scripts/vue/verify-pages.js'
    ].forEach(relativePath => {

        const filePath = path.resolve(verifyDir, relativePath);

        if (exists(filePath)) {
            pass(`验证文件存在：agent/verify/${relativePath}`);
        } else {
            fail(`验证文件缺失：agent/verify/${relativePath}`);
        }
    });
}

function checkPackageManager(frontendDir) {

    // 包管理器以 lock 文件为准，避免在 pnpm/yarn 项目里误用 npm 改写依赖。
    if (exists(path.resolve(frontendDir, 'pnpm-lock.yaml'))) {
        commandExists('pnpm', frontendDir)
            ? pass('包管理器可用：pnpm')
            : fail('存在 pnpm-lock.yaml，但当前环境找不到 pnpm 命令');
        return 'pnpm';
    }

    if (exists(path.resolve(frontendDir, 'yarn.lock'))) {
        commandExists('yarn', frontendDir)
            ? pass('包管理器可用：yarn')
            : fail('存在 yarn.lock，但当前环境找不到 yarn 命令');
        return 'yarn';
    }

    commandExists('npm', frontendDir)
        ? pass('包管理器可用：npm')
        : fail('当前环境找不到 npm 命令');
    return 'npm';
}

function checkDevCommand(config, scripts) {

    // devCommand 通常是 pnpm/yarn/npm run xxx，这里只做轻量合理性检查，不启动服务。
    if (!config.devCommand) {
        fail('devCommand 为空');
        return;
    }

    const parts = config.devCommand.trim().split(/\s+/);
    const runIndex = parts.indexOf('run');
    const scriptName = runIndex >= 0 ? parts[runIndex + 1] : parts[1];

    if (scriptName && scripts[scriptName]) {
        pass(`devCommand 对应的 package script 存在：${scriptName}`);
    } else {
        warn(`devCommand 对应的脚本未在 package.json scripts 中找到：${config.devCommand}`);
    }
}

function getPackageManagerInstallCommand(frontendDir) {

    if (exists(path.resolve(frontendDir, 'pnpm-lock.yaml'))) {
        return 'pnpm add -D';
    }

    if (exists(path.resolve(frontendDir, 'yarn.lock'))) {
        return 'yarn add -D';
    }

    return 'npm install -D';
}

function checkConfiguredScripts(label, candidates, scripts, fallbackTools, frontendDir, required, installPackages) {

    // 静态检查可以来自 package.json scripts，也可以回退本地工具；required=true 时两者都没有则 FAIL。
    const matched = (candidates || []).find(scriptName => scripts[scriptName]);

    if (matched) {
        pass(`${label} 对应的 package script 存在：${matched}`);
        return;
    }

    const fallback = fallbackTools.find(tool => exists(path.resolve(frontendDir, `node_modules/.bin/${tool}`)));

    if (fallback) {
        warn(`${label} 未配置 package script，但本地 fallback 工具存在：${fallback}`);
    } else {
        const installCommand = `${getPackageManagerInstallCommand(frontendDir)} ${installPackages.join(' ')}`;
        const message = `${label} 未配置 package script，且本地 fallback 工具也不存在；如需启用，请进入前端目录执行：${installCommand}，并按需在 package.json scripts 中配置 ${label} 脚本`;
        required ? fail(message) : warn(message);
    }
}

function checkBuildScript(config, scripts) {

    const checks = config.checks || {};
    const candidates = checks.buildScripts || ['build'];
    const matched = candidates.find(scriptName => scripts[scriptName]);

    if (matched) {
        pass(`build 对应的 package script 存在：${matched}`);
    } else if (checks.buildRequired) {
        fail('buildRequired=true，但未找到可用的构建脚本');
    } else {
        warn('未找到 build 脚本；构建校验当前为可选项');
    }
}

function checkRouterFiles(config, frontendDir) {

    // 路由文件不存在会导致 page-map.json 无法自动生成，是新项目接入时最常见的问题之一。
    const configured = config.routerConfigFiles || config.routerConfigFile || [];
    const files = Array.isArray(configured) ? configured : [configured];

    if (!files.length) {
        fail('routerConfigFiles 为空');
        return;
    }

    files.forEach(file => {

        const routerFile = path.resolve(frontendDir, file);

        if (exists(routerFile)) {
            pass(`路由配置文件存在：${path.relative(rootDir, routerFile)}`);
        } else {
            fail(`路由配置文件缺失：${path.relative(rootDir, routerFile)}`);
        }
    });
}

function checkPlaywright(frontendDir) {

    // Playwright 是页面自动化必需依赖；默认静态检查不需要它。
    const packagePath = path.resolve(frontendDir, 'package.json');

    try {
        createRequire(packagePath).resolve('playwright');
        pass('Playwright 依赖可解析');
    } catch (e) {
        warn('未安装 Playwright；只有执行页面自动化时才需要。如需启用页面自动化，请在项目根目录执行：bash ./agent/verify/scripts/install-vue-check-deps.sh');
    }
}

function checkAuth(config) {

    // 默认 storage 认证必须替换占位 token；页面巡检可选时先给 WARN，强制页面巡检时给 FAIL。
    const auth = config.auth || {};
    const pageRequired = Boolean(config.pageCheck && config.pageCheck.required);

    if (!auth.mode) {
        fail('auth.mode 为空');
        return;
    }

    if (!['storage', 'form', 'none'].includes(auth.mode)) {
        fail(`不支持的 auth.mode：${auth.mode}`);
        return;
    }

    pass(`认证模式已配置：${auth.mode}`);

    if (auth.mode === 'storage') {

        const storage = auth.storage || {};
        const entries = [
            ...(storage.localStorage || []),
            ...(storage.sessionStorage || []),
            ...(storage.cookies || [])
        ];

        if (!entries.length) {
            fail('auth.mode=storage，但未配置 localStorage/sessionStorage/cookies 条目');
            return;
        }

        entries.forEach(entry => {

            if (!entry.name || !entry.value) {
                pageRequired ? fail('storage 认证条目必须包含 name 和 value') : warn('storage 认证条目必须包含 name 和 value');
            } else if (entry.value === 'REPLACE_WITH_TOKEN') {
                const message = `storage 认证条目仍使用占位 token：${entry.name}`;
                pageRequired ? fail(message) : warn(message);
            }
        });
    }
}

function checkPageCheck(config) {

    // 页面等待策略配置错误会导致 Playwright 在打开页面阶段直接失败。
    const pageCheck = config.pageCheck || {};
    const waitUntil = pageCheck.waitUntil || 'domcontentloaded';

    if (!['load', 'domcontentloaded', 'networkidle', 'commit'].includes(waitUntil)) {
        fail(`不支持的 pageCheck.waitUntil：${waitUntil}`);
    } else {
        pass(`pageCheck.waitUntil 已配置：${waitUntil}`);
    }

    Number(pageCheck.timeoutMs || 0) > 0
        ? pass(`pageCheck.timeoutMs 已配置：${pageCheck.timeoutMs}`)
        : fail('pageCheck.timeoutMs 必须大于 0');
}

function checkMaven() {

    // 后端脚本只依赖 mvn/mvnw 和 pom.xml；这里只判断是否具备基本执行条件。
    if (exists(path.resolve(rootDir, 'mvnw'))) {
        pass('Maven Wrapper 存在：mvnw');
    } else if (commandExists('mvn')) {
        pass('mvn 命令可用');
    } else {
        warn('当前环境找不到 mvn 命令，也未发现 mvnw');
    }

    exists(path.resolve(rootDir, 'pom.xml'))
        ? pass('pom.xml 存在')
        : warn('pom.xml 不存在；Java 验证脚本可能不适用于当前项目');
}

function main() {

    console.log('AI 验证配置自检');
    console.log(`项目根目录：${rootDir}`);

    checkRequiredFiles();

    const config = readJson(configPath);

    if (!config) {
        process.exit(1);
    }

    const frontendDir = path.resolve(rootDir, config.frontendDir || '.');

    exists(frontendDir)
        ? pass(`frontendDir 存在：${path.relative(rootDir, frontendDir) || '.'}`)
        : fail(`frontendDir 缺失：${path.relative(rootDir, frontendDir) || '.'}`);

    const scripts = getPackageScripts(frontendDir);

    checkPackageManager(frontendDir);
    checkDevCommand(config, scripts);
    checkConfiguredScripts(
        'lint',
        config.checks && config.checks.lintScripts,
        scripts,
        ['eslint'],
        frontendDir,
        Boolean(config.checks && config.checks.lintRequired),
        ['eslint']
    );
    checkConfiguredScripts(
        'typecheck',
        config.checks && config.checks.typecheckScripts,
        scripts,
        ['vue-tsc', 'tsc'],
        frontendDir,
        !(config.checks && config.checks.typecheckRequired === false),
        ['vue-tsc', 'typescript']
    );
    checkBuildScript(config, scripts);
    checkRouterFiles(config, frontendDir);
    checkPlaywright(frontendDir);
    checkAuth(config);
    checkPageCheck(config);
    checkMaven();

    console.log(`汇总：${failCount} 个失败，${warnCount} 个警告`);

    if (failCount > 0) {
        process.exit(1);
    }
}

main();
