const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '../../..', '..');
const pidFile = path.resolve(rootDir, '.ai-dev.pid');
const config = require('./ai-config.json');
const runtimeBaseUrlPath = path.resolve(rootDir, config.runtimeBaseUrlPath || 'agent/verify/.runtime/vue-base-url.txt');

// start-dev.js 会写入 detached 进程 pid；这里统一清理，避免校验失败后端口残留。
if (!fs.existsSync(pidFile)) {

    console.log('no dev server');

    process.exit(0);
}

const pid = Number(
    fs.readFileSync(pidFile)
);

try {

    process.kill(-pid, 'SIGTERM');

} catch (e) {

    try {

        process.kill(pid, 'SIGTERM');

    } catch (innerError) {

        console.log('dev server already stopped');
    }
}

fs.unlinkSync(pidFile);

if (fs.existsSync(runtimeBaseUrlPath)) {
    fs.unlinkSync(runtimeBaseUrlPath);
}

console.log('dev server stopped');
