const fs = require('fs');
const path = require('path');
const { createRequire } = require('module');

const config = require('./ai-config.json');

function getBaseUrl() {

    // 访问地址优先来自 start-dev.js 动态探测结果；配置里的 baseUrl 只是兜底。
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

function getAuthConfig() {

    // 兼容旧 login 配置；新项目优先使用 auth.mode 配置认证策略。
    if (config.auth) {
        return config.auth;
    }

    return {
        mode: config.login && config.login.enabled === false ? 'none' : 'form',
        form: config.login || {}
    };
}

function assertConfiguredEntry(entry, type) {

    // storage/cookie 模式必须替换占位 token，防止拿无效认证态继续跑页面验证。
    if (!entry.name || !entry.value || entry.value === 'REPLACE_WITH_TOKEN') {
        throw new Error(`invalid ${type} auth entry: configure name and value in ai-config.json`);
    }
}

async function applyStorageAuth(page, browserContext, authConfig, baseUrl) {

    // storage 模式适合大多数后台系统：直接注入 token/cookie 后保存 Playwright storageState。
    const storage = authConfig.storage || {};
    const localStorageEntries = storage.localStorage || [];
    const sessionStorageEntries = storage.sessionStorage || [];
    const cookies = storage.cookies || [];

    if (!localStorageEntries.length && !sessionStorageEntries.length && !cookies.length) {
        throw new Error('storage auth requires localStorage, sessionStorage or cookies entries');
    }

    localStorageEntries.forEach(entry => assertConfiguredEntry(entry, 'localStorage'));
    sessionStorageEntries.forEach(entry => assertConfiguredEntry(entry, 'sessionStorage'));
    cookies.forEach(entry => assertConfiguredEntry(entry, 'cookie'));

    if (cookies.length) {

        await browserContext.addCookies(
            cookies.map(cookie => {

                const normalizedCookie = {
                    name: cookie.name,
                    value: cookie.value,
                    path: cookie.path || '/',
                    httpOnly: Boolean(cookie.httpOnly),
                    secure: Boolean(cookie.secure),
                    sameSite: cookie.sameSite || 'Lax'
                };

                if (cookie.domain) {
                    normalizedCookie.domain = cookie.domain;
                } else {
                    normalizedCookie.url = cookie.url || baseUrl;
                }

                if (cookie.expires) {
                    normalizedCookie.expires = cookie.expires;
                }

                return normalizedCookie;
            })
        );
    }

    await page.goto(baseUrl);

    await page.evaluate(
        ({ localStorageEntries, sessionStorageEntries }) => {

            localStorageEntries.forEach(entry => {
                window.localStorage.setItem(entry.name, entry.value);
            });

            sessionStorageEntries.forEach(entry => {
                window.sessionStorage.setItem(entry.name, entry.value);
            });
        },
        {
            localStorageEntries,
            sessionStorageEntries
        }
    );
}

async function applyFormAuth(page, formConfig, baseUrl) {

    // form 模式保留给必须走登录页的项目，选择器和成功跳转都从配置读取。
    await page.goto(
        baseUrl + formConfig.url
    );

    await page.fill(
        formConfig.usernameSelector,
        formConfig.username
    );

    await page.fill(
        formConfig.passwordSelector,
        formConfig.password
    );

    await page.click(
        formConfig.submitSelector
    );

    await page.waitForURL(
        `**${formConfig.successUrlContains}`
    );
}

async function login() {

    // 输出 authStatePath 后，verify-pages.js 会复用同一份登录态访问业务页面。
    const chromium = loadChromium();
    const authConfig = getAuthConfig();
    const baseUrl = getBaseUrl();

    const browser = await chromium.launch({
        headless: true
    });

    const context = await browser.newContext();
    const page = await context.newPage();

    const rootDir = path.resolve(__dirname, '../../..', '..');
    const authStatePath = path.resolve(rootDir, config.authStatePath || 'playwright/.auth/user.json');

    if (authConfig.mode === 'none') {

        console.log('auth skipped');
        await browser.close();
        return;
    }

    if (authConfig.mode === 'storage') {
        await applyStorageAuth(page, context, authConfig, baseUrl);
    } else if (authConfig.mode === 'form') {
        await applyFormAuth(page, authConfig.form || {}, baseUrl);
    } else {
        throw new Error(`unsupported auth mode: ${authConfig.mode}`);
    }

    fs.mkdirSync(
        path.dirname(authStatePath),
        {
            recursive: true
        }
    );

    await context.storageState({
        path: authStatePath
    });

    await browser.close();

    console.log(`auth success: ${authConfig.mode}`);
}

module.exports = login;

if (require.main === module) {
    login();
}
