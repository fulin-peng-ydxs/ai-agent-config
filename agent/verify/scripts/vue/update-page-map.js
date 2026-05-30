const fs = require('fs');
const path = require('path');

const config = require('./ai-config.json');

const scriptDir = __dirname;
const rootDir = path.resolve(scriptDir, '../../..', '..');
const frontendDir = path.resolve(rootDir, config.frontendDir || '.');
const pageMapFile = path.resolve(scriptDir, 'page-map.json');

function getRouterFiles() {

    // 支持单个或多个 Vue Router 配置文件，方便适配模块化路由项目。
    const configured = config.routerConfigFiles || config.routerConfigFile || 'src/router/config.ts';
    const files = Array.isArray(configured) ? configured : [configured];

    return files
        .map(file => path.resolve(frontendDir, file))
        .filter(file => {

            if (fs.existsSync(file)) {
                return true;
            }

            console.log(`router config skipped: ${file}`);
            return false;
        });
}

function toRepoPath(importPath, routerFile) {

    // 将 @/ 和相对 import 统一转换为仓库相对路径，便于和 Git 改动文件匹配。
    if (importPath.startsWith('@/')) {
        return path.join(
            path.relative(rootDir, frontendDir),
            'src',
            importPath.slice(2)
        ).replace(/\\/g, '/');
    }

    if (importPath.startsWith('./') || importPath.startsWith('../')) {
        return path.relative(
            rootDir,
            path.resolve(path.dirname(routerFile), importPath)
        ).replace(/\\/g, '/');
    }

    return importPath;
}

function readExistingMap() {

    if (!fs.existsSync(pageMapFile)) {
        return {};
    }

    return JSON.parse(fs.readFileSync(pageMapFile, 'utf8'));
}

function normalizeManualMap(existingMap) {

    // 自动生成的 views 映射会被重建；非 views 映射视为人工维护的公共影响范围并保留。
    const frontendRel = path.relative(rootDir, frontendDir).replace(/\\/g, '/');
    const normalized = {};

    Object.keys(existingMap)
        .forEach(key => {

            const normalizedKey = key.startsWith('src/')
                ? `${frontendRel}/${key}`
                : key;

            if (normalizedKey.startsWith(`${frontendRel}/src/views/`)) {
                return;
            }

            normalized[normalizedKey] = existingMap[key];
        });

    return normalized;
}

function sortMap(map) {

    return Object.keys(map)
        .sort()
        .reduce((sorted, key) => {

            sorted[key] = [...new Set(map[key])].sort();
            return sorted;

        }, {});
}

function updatePageMap() {

    // 当前解析目标是显式 Vue Router：path + component: () => import('*.vue')。
    // import.meta.glob 或后端动态菜单路由需要按项目扩展这里的解析规则。
    const routerFiles = getRouterFiles();
    const map = normalizeManualMap(readExistingMap());
    const routePattern = /path:\s*['"]([^'"]+)['"](?:(?!path:\s*['"]).)*?component:\s*\(\)\s*=>\s*import\(\s*['"]([^'"]+)['"]\s*\)/gs;

    if (!routerFiles.length) {
        throw new Error('No router config files found. Configure ai-config.json routerConfigFiles.');
    }

    routerFiles.forEach(routerFile => {

        const source = fs.readFileSync(routerFile, 'utf8');
        let match;

        routePattern.lastIndex = 0;

        while ((match = routePattern.exec(source)) !== null) {

            const routePath = match[1];
            const componentPath = toRepoPath(match[2], routerFile);

            if (!componentPath.endsWith('.vue')) {
                continue;
            }

            const key = componentPath.replace(/\/index\.vue$/, '');
            const pages = new Set(map[key] || []);
            pages.add(routePath);
            map[key] = [...pages];
        }
    });

    fs.writeFileSync(
        pageMapFile,
        `${JSON.stringify(sortMap(map), null, 2)}\n`,
        'utf8'
    );

    console.log(`page map updated: ${pageMapFile}`);
}

updatePageMap();
