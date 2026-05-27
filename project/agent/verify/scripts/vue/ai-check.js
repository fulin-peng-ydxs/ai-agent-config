const fs = require('fs');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');

const pageMap = require('./page-map.json');
const config = require('./ai-config.json');

const scriptDir = __dirname;
const rootDir = path.resolve(scriptDir, '../../..', '..');
const frontendDir = path.resolve(rootDir, config.frontendDir || '.');
let pageAutomationStarted = false;

function parseArgs() {

    const flags = {
        build: false,
        page: false,
        files: []
    };

    process.argv.slice(2).forEach(arg => {

        if (arg === '--build') {
            flags.build = true;
        } else if (arg === '--page' || arg === '--browser') {
            flags.page = true;
        } else {
            flags.files.push(arg);
        }
    });

    return flags;
}

// 统一执行入口：所有最终验证命令都从这里发出，便于日志里看到真实命令和工作目录。
function run(command, args, options = {}) {

    console.log(
        [command, ...args].join(' ')
    );

    execFileSync(
        command,
        args,
        {
            cwd: options.cwd || rootDir,
            stdio: 'inherit'
        }
    );
}

function runCapture(command, args, options = {}) {

    console.log(
        [command, ...args].join(' ')
    );

    const result = spawnSync(
        command,
        args,
        {
            cwd: options.cwd || rootDir,
            encoding: 'utf8'
        }
    );

    return {
        status: result.status,
        output: `${result.stdout || ''}${result.stderr || ''}`
    };
}

function output(command, args) {

    const result = spawnSync(
        command,
        args,
        {
            cwd: rootDir,
            encoding: 'utf8'
        }
    );

    if (result.status !== 0) {
        return '';
    }

    return result.stdout || '';
}

function normalizeFile(file) {

    const absolute = path.isAbsolute(file)
        ? file
        : path.resolve(rootDir, file);

    return path.relative(rootDir, absolute).replace(/\\/g, '/');
}

function getChangedFiles(explicitFiles) {

    // AI 可显式传入本次改动文件；未传时自动合并未暂存和已暂存的 Git 改动。
    if (explicitFiles.length) {
        return explicitFiles.map(normalizeFile);
    }

    const files = new Set();

    [
        ['diff', '--name-only', '--diff-filter=ACMR'],
        ['diff', '--name-only', '--cached', '--diff-filter=ACMR']
    ].forEach(args => {

        output('git', args)
            .split(/\r?\n/)
            .map(line => line.trim())
            .filter(Boolean)
            .forEach(file => files.add(normalizeFile(file)));
    });

    return [...files];
}

function isFrontendFile(file) {

    // 只让前端相关文件进入 Vue 校验，避免后端或文档改动误触发浏览器验证。
    const frontendRel = path.relative(rootDir, frontendDir).replace(/\\/g, '/');
    const inFrontend = frontendRel === ''
        ? true
        : file === frontendRel || file.startsWith(`${frontendRel}/`);

    return inFrontend && /\.(vue|ts|tsx|js|jsx|css|less|scss)$/.test(file);
}

function toFrontendPath(file) {

    return path.relative(
        frontendDir,
        path.resolve(rootDir, file)
    ).replace(/\\/g, '/');
}

function commandExists(command) {

    return spawnSync(
        command,
        ['--version'],
        {
            cwd: frontendDir,
            stdio: 'ignore'
        }
    ).status === 0;
}

function detectPackageRunner() {

    // Vue 项目优先尊重 lock 文件对应的包管理器；无 lock 文件时回退 npm。
    // runner 用于 package.json scripts，execArgs 用于执行本地 node_modules/.bin 工具。
    if (fs.existsSync(path.join(frontendDir, 'pnpm-lock.yaml')) && commandExists('pnpm')) {
        return {
            runner: 'pnpm',
            execArgs: ['exec']
        };
    }

    if (fs.existsSync(path.join(frontendDir, 'yarn.lock')) && commandExists('yarn')) {
        return {
            runner: 'yarn',
            execArgs: ['exec']
        };
    }

    return {
        runner: 'npm',
        execArgs: ['exec', '--']
    };
}

function getPackageScripts() {

    const packagePath = path.join(frontendDir, 'package.json');

    if (!fs.existsSync(packagePath)) {
        return {};
    }

    const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    return pkg.scripts || {};
}

function findPackageScript(candidates) {

    // 静态检查优先走项目自己的 package.json scripts，脚本候选名由 ai-config.json 维护。
    const scripts = getPackageScripts();

    return candidates.find(scriptName => Boolean(scripts[scriptName])) || '';
}

function runPackageScript(runner, scriptName, extraArgs = []) {

    run(
        runner,
        ['run', scriptName, ...extraArgs],
        {
            cwd: frontendDir
        }
    );
}

function collectRelatedTypecheckOutput(outputText, frontendRelativeFiles) {

    const relatedPaths = frontendRelativeFiles.flatMap(file => {

        const absolute = path.resolve(frontendDir, file).replace(/\\/g, '/');
        const rootRelative = path.relative(rootDir, path.resolve(frontendDir, file)).replace(/\\/g, '/');

        return [
            file,
            `./${file}`,
            absolute,
            rootRelative,
            `./${rootRelative}`
        ];
    });

    const lines = outputText.split(/\r?\n/);
    const selected = new Set();

    lines.forEach((line, index) => {

        if (!relatedPaths.some(file => line.includes(file))) {
            return;
        }

        // TypeScript/Vue errors often put the location on the first line and details on the next few lines.
        for (let offset = 0; offset <= 3; offset += 1) {
            const currentIndex = index + offset;

            if (currentIndex < lines.length && lines[currentIndex].trim()) {
                selected.add(currentIndex);
            }
        }
    });

    return [...selected]
        .sort((a, b) => a - b)
        .map(index => lines[index])
        .join('\n');
}

function hasTypecheckDiagnostics(outputText) {

    return /error TS\d+|\.vue[:(]\d+|\.tsx?[:(]\d+|\.jsx?[:(]\d+/.test(outputText);
}

function runTypecheck(command, args, options) {

    const result = runCapture(command, args, { cwd: frontendDir });

    if (result.status === 0) {
        return;
    }

    const relatedOutput = options.onlyFailOnSpecifiedFiles
        ? collectRelatedTypecheckOutput(result.output, options.frontendRelativeFiles)
        : result.output;

    if (options.onlyFailOnSpecifiedFiles && !relatedOutput && hasTypecheckDiagnostics(result.output)) {
        console.log('typecheck warning: full project typecheck failed, but no errors matched explicitly specified files');
        return;
    }

    if (relatedOutput) {
        console.error(relatedOutput);
    }

    throw new Error('typecheck failed');
}

function runStaticChecks(runner, runnerPrefixArgs, frontendRelativeFiles, hasExplicitFiles) {

    // 先执行项目标准脚本；项目没有定义时再回退到本地 eslint/vue-tsc/tsc。
    // 这样可以兼容不同 Vue 项目对 lint/typecheck 的命名差异。
    const checks = config.checks || {};
    const lintRequired = Boolean(checks.lintRequired);
    const typecheckRequired = checks.typecheckRequired !== false;
    const onlyFailOnSpecifiedFiles = hasExplicitFiles && Boolean(checks.typecheckOnlyFailOnSpecifiedFiles);
    const lintScript = findPackageScript(checks.lintScripts || ['lint', 'lint:check']);
    const typecheckScript = findPackageScript(checks.typecheckScripts || ['type-check', 'typecheck', 'vue-tsc']);

    if (lintScript) {

        console.log(`lint script: ${lintScript}`);
        runPackageScript(runner, lintScript, ['--', ...frontendRelativeFiles]);

    } else if (fs.existsSync(path.join(frontendDir, 'node_modules/.bin/eslint'))) {

        console.log('eslint fallback');
        run(runner, [...runnerPrefixArgs, 'eslint', ...frontendRelativeFiles, '--fix'], { cwd: frontendDir });

    } else {

        const message = 'lint unavailable: no configured lint script or local eslint';

        if (lintRequired) {
            throw new Error(message);
        }

        console.log(`lint skipped: ${message}`);
    }

    if (typecheckScript) {

        console.log(`typecheck script: ${typecheckScript}`);
        runTypecheck(
            runner,
            ['run', typecheckScript],
            {
                onlyFailOnSpecifiedFiles,
                frontendRelativeFiles
            }
        );

    } else if (fs.existsSync(path.join(frontendDir, 'node_modules/.bin/vue-tsc'))) {

        console.log('vue-tsc fallback');
        runTypecheck(
            runner,
            [...runnerPrefixArgs, 'vue-tsc', '--noEmit', '--pretty', 'false'],
            {
                onlyFailOnSpecifiedFiles,
                frontendRelativeFiles
            }
        );

    } else if (fs.existsSync(path.join(frontendDir, 'node_modules/.bin/tsc'))) {

        console.log('typescript fallback');
        runTypecheck(
            runner,
            [...runnerPrefixArgs, 'tsc', '--noEmit', '--pretty', 'false'],
            {
                onlyFailOnSpecifiedFiles,
                frontendRelativeFiles
            }
        );

    } else {

        const message = 'typecheck unavailable: no configured typecheck script, local vue-tsc or local tsc';

        if (typecheckRequired) {
            throw new Error(message);
        }

        console.log(`type check skipped: ${message}`);
    }
}

function runBuildCheck(runner) {

    const checks = config.checks || {};
    const buildScript = findPackageScript(checks.buildScripts || ['build']);

    if (!buildScript) {
        throw new Error('build unavailable: no configured build script found in package.json');
    }

    console.log(`build script: ${buildScript}`);
    runPackageScript(runner, buildScript);
}

function canResolveFromFrontend(moduleName) {

    const packagePath = path.join(frontendDir, 'package.json');

    try {

        const { createRequire } = require('module');
        createRequire(packagePath).resolve(moduleName);
        return true;

    } catch (e) {

        return false;
    }
}

function assertBrowserDependencies() {

    // 浏览器页面验证是前端校验的核心步骤，Playwright 缺失时明确失败并提示安装脚本。
    if (!canResolveFromFrontend('playwright')) {

        throw new Error(
            'missing frontend verify dependency: playwright. Run: bash ./agent/verify/scripts/install-vue-check-deps.sh'
        );
    }
}

function getPages(files) {

    // 将改动文件映射到需要打开验证的页面；公共组件等间接影响范围由 page-map.json 维护。
    const pages = new Set();

    files.forEach(file => {

        Object.keys(pageMap)
            .forEach(key => {

                if (file.includes(key)) {

                    pageMap[key]
                        .forEach(pagePath =>
                            pages.add(pagePath)
                        );
                }
            });
    });

    if (!pages.size) {
        pages.add('/');
    }

    return [...pages];
}

async function runCheck() {

    // 主流程：筛选前端文件 -> 静态检查 -> 可选构建 -> 可选页面巡检。
    const args = parseArgs();
    const changedFiles = getChangedFiles(args.files);
    const frontendFiles = changedFiles.filter(isFrontendFile);
    const frontendRelativeFiles = frontendFiles.map(toFrontendPath);
    const packageRunner = detectPackageRunner();
    const checks = config.checks || {};
    const pageCheck = config.pageCheck || {};
    const shouldBuild = args.build || Boolean(checks.buildRequired);
    const shouldVerifyPage = args.page || Boolean(pageCheck.required);

    if (!frontendFiles.length) {

        console.log('no frontend changed files');
        return;
    }

    console.log('frontend files:', frontendFiles);

    runStaticChecks(packageRunner.runner, packageRunner.execArgs, frontendRelativeFiles, Boolean(args.files.length));

    if (shouldBuild) {
        runBuildCheck(packageRunner.runner);
    } else {
        console.log('build skipped: not required');
    }

    if (!shouldVerifyPage) {
        console.log('page automation skipped: not required');
        console.log('AI CHECK PASS');
        return;
    }

    assertBrowserDependencies();

    console.log('start dev');
    run('node', [path.join(scriptDir, 'start-dev.js')]);
    pageAutomationStarted = true;

    const login = require('./login');
    const verifyPages = require('./verify-pages');

    const authMode = config.auth ? config.auth.mode : (config.login && config.login.enabled === false ? 'none' : 'form');

    if (authMode !== 'none') {

        console.log('auth');
        await login();
    }

    const pages = getPages(frontendFiles);
    console.log('verify pages:', pages);
    await verifyPages(pages);

    console.log('AI CHECK PASS');
    return pageAutomationStarted;
}

async function main() {

    try {

        await runCheck();

    } catch (e) {

        console.log('AI CHECK FAIL');
        console.log(e.message);
        process.exitCode = 1;

    } finally {

        if (pageAutomationStarted) {
            run('node', [path.join(scriptDir, 'stop-dev.js')]);
        }
    }
}

main();
