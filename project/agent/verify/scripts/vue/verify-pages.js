const fs = require('fs');
const path = require('path');
const { createRequire } = require('module');

const config = require('./ai-config.json');

function getBaseUrl() {

    // 与 login.js 保持一致：优先使用 dev server 动态发现的真实访问地址。
    const rootDir = path.resolve(__dirname, '../../..', '..');
    const runtimeBaseUrlPath = path.resolve(rootDir, config.runtimeBaseUrlPath || 'agent/verify/.runtime/vue-base-url.txt');

    if (fs.existsSync(runtimeBaseUrlPath)) {
        return fs.readFileSync(runtimeBaseUrlPath, 'utf8').trim().replace(/\/$/, '');
    }

    if (process.env.AI_VERIFY_BASE_URL) {
        return process.env.AI_VERIFY_BASE_URL.replace(/\/$/, '');
    }

    if (config.baseUrl) {
        return config.baseUrl.replace(/\/$/, '');
    }

    throw new Error('missing frontend base url: start dev server first or configure ai-config.json baseUrl');
}

function loadChromium() {

    const rootDir = path.resolve(__dirname, '../../..', '..');
    const frontendDir = path.resolve(rootDir, config.frontendDir || '.');
    const frontendRequire = createRequire(path.join(frontendDir, 'package.json'));
    return frontendRequire('playwright').chromium;
}

async function verifyPages(pages) {

    // 页面巡检只关心用户真实访问风险：打不开、登录态失效、白屏、控制台异常、HTTP 500。
    const chromium = loadChromium();
    const rootDir = path.resolve(__dirname, '../../..', '..');
    const authStatePath = path.resolve(rootDir, config.authStatePath || 'playwright/.auth/user.json');
    const screenshotDir = path.resolve(rootDir, config.screenshotDir || 'screenshots');
    const baseUrl = getBaseUrl();
    const pageCheck = config.pageCheck || {};
    const waitUntil = pageCheck.waitUntil || 'domcontentloaded';
    const timeoutMs = Number(pageCheck.timeoutMs || 15000);
    const readySelector = pageCheck.readySelector || '';
    const whiteScreenMinTextLength = Number(pageCheck.whiteScreenMinTextLength || 10);
    const loginPathIncludes = pageCheck.loginPathIncludes || '/login';

    fs.mkdirSync(
        screenshotDir,
        {
            recursive: true
        }
    );

    const browser = await chromium.launch({
        headless: true
    });

    const context = await browser.newContext({
        storageState: fs.existsSync(authStatePath) ? authStatePath : undefined
    });

    let hasError = false;

    for (const routePath of pages) {

        console.log(`checking ${routePath}`);

        const page = await context.newPage();

        // 浏览器控制台错误通常对应运行时 JS 异常、资源加载失败或组件渲染问题。
        page.on('console', msg => {

            if (msg.type() === 'error') {

                hasError = true;

                console.log(
                    '[console error]',
                    msg.text()
                );
            }
        });

        page.on('pageerror', err => {

            hasError = true;

            console.log(
                '[page error]',
                err.message
            );
        });

        page.on('response', response => {

            // 后端接口 500 会直接影响页面可用性，即使页面本身没有抛 JS 异常也要失败。
            if (response.status() >= 500) {

                hasError = true;

                console.log(
                    '[http error]',
                    response.url(),
                    response.status()
                );
            }
        });

        try {

            await page.goto(
                baseUrl + routePath,
                {
                    waitUntil,
                    timeout: timeoutMs
                }
            );

            if (readySelector) {
                // 对地图、长轮询、WebSocket 页面，readySelector 比 networkidle 更稳定。
                await page.waitForSelector(
                    readySelector,
                    {
                        timeout: timeoutMs
                    }
                );
            }

            if (
                loginPathIncludes &&
                page.url().includes(loginPathIncludes)
            ) {

                hasError = true;

                console.log(
                    'login invalid'
                );
            }

            const bodyText =
                await page.textContent('body');

            if (
                !bodyText ||
                bodyText.trim().length < whiteScreenMinTextLength
            ) {

                hasError = true;

                console.log(
                    'white screen'
                );
            }

            const fileName =
                routePath.replace(/\\//g, '_') || '_home';

            await page.screenshot({
                path:
                    `${screenshotDir}/${fileName}.png`,
                fullPage: true
            });

            console.log(
                `page ok ${routePath}`
            );

        } catch (e) {

            hasError = true;

            console.log(
                'open page failed',
                e.message
            );
        }

        await page.close();
    }

    await browser.close();

    if (hasError) {
        process.exit(1);
    }
}

module.exports = verifyPages;
