const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const config = require('./ai-config.json');

const scriptDir = __dirname;
const rootDir = path.resolve(scriptDir, '../../..', '..');
const frontendDir = path.resolve(rootDir, config.frontendDir || '.');
const startupWaitMs = Number(config.startupWaitMs || 10000);
const runtimeBaseUrlPath = path.resolve(rootDir, config.runtimeBaseUrlPath || 'agent/verify/.runtime/vue-base-url.txt');
const devLogPath = path.resolve(rootDir, config.devLogPath || 'agent/verify/.runtime/vue-dev-server.log');
const pidPath = path.resolve(rootDir, '.ai-dev.pid');

// 运行时目录只保存本次校验产生的地址、日志、登录态等临时文件，不应提交。
function ensureRuntimeDir() {

    fs.mkdirSync(
        path.dirname(runtimeBaseUrlPath),
        {
            recursive: true
        }
    );
}

function writeRuntimeBaseUrl(url) {

    fs.writeFileSync(
        runtimeBaseUrlPath,
        url.replace(/\/$/, ''),
        'utf8'
    );
}

function appendLog(chunk) {

    fs.appendFileSync(
        devLogPath,
        chunk,
        'utf8'
    );
}

function extractBaseUrl(text) {

    // Vite/Vue CLI 等 dev server 通常会输出 Local/Network 地址；优先选本机可访问地址。
    const matches = text.match(/https?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0|\[[^\]]+\]|[a-zA-Z0-9.-]+):\d+\/?/g);

    if (!matches || !matches.length) {
        return '';
    }

    const localUrl = matches.find(url =>
        url.includes('localhost') ||
        url.includes('127.0.0.1')
    );

    return (localUrl || matches[0]).replace('0.0.0.0', 'localhost');
}

function waitForBaseUrl(child) {

    // 启动命令可能动态换端口，所以这里解析 stdout/stderr 并写入运行时 baseUrl。
    // 解析不到时才使用 ai-config.json 的 baseUrl 兜底。
    return new Promise(resolve => {

        let settled = false;
        let buffer = '';

        function finish(url, source) {

            if (settled) {
                return;
            }

            settled = true;

            if (url) {
                writeRuntimeBaseUrl(url);
                console.log(`dev server url detected from ${source}: ${url.replace(/\/$/, '')}`);
            } else if (config.baseUrl) {
                writeRuntimeBaseUrl(config.baseUrl);
                console.log(`dev server url fallback from ai-config.json: ${config.baseUrl}`);
            } else {
                console.log('dev server url not detected');
            }

            if (child.stdout) {
                child.stdout.destroy();
            }

            if (child.stderr) {
                child.stderr.destroy();
            }

            resolve();
        }

        function handleOutput(chunk) {

            const text = String(chunk);
            buffer += text;
            appendLog(text);

            const url = extractBaseUrl(buffer);

            if (url) {
                finish(url, 'dev output');
            }
        }

        child.stdout.on('data', handleOutput);
        child.stderr.on('data', handleOutput);

        child.on('exit', code => {

            if (!settled) {
                finish('', `process exit ${code}`);
            }
        });

        setTimeout(
            () => finish('', 'timeout'),
            startupWaitMs
        );
    });
}

ensureRuntimeDir();

fs.writeFileSync(devLogPath, '', 'utf8');

const devCommand = process.env.AI_VERIFY_DEV_COMMAND || config.devCommand;

// detached 让服务能在当前 node 进程退出后继续运行，stop-dev.js 负责按 pid 清理。
const child = spawn(
    devCommand,
    {
        cwd: frontendDir,
        detached: true,
        shell: true,
        stdio: ['ignore', 'pipe', 'pipe']
    }
);

fs.writeFileSync(
    pidPath,
    String(child.pid)
);

waitForBaseUrl(child).then(() => {

    child.unref();

    console.log('dev server started');
});
