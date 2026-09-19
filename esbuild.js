const { build } = require('esbuild');
const { cp } = require('fs/promises');
const fs = require('fs/promises');
const path = require('path');
const { builtinModules } = require('module');
const objectHasOwnPolyfill = require.resolve('core-js/actual/object/has-own');

// 收集所有 Node.js 原生内置模块（包括带 node: 前缀和子路径，如 fs、fs/promises、node:tls 等）
const nodeBuiltins = [
    ...builtinModules,
    ...builtinModules.map((m) => `node:${m}`),
    'stream/promises',
    'stream/web',
    'fs/promises',
    'cron',
    'node:*',
];

const replaceOpenApiIsNode = {
    name: 'replace-open-api-is-node',
    setup(build) {
        build.onLoad(
            {
                filter: /open-api\.js$/,
            },
            async (args) => {
                let contents = await fs.readFile(args.path, 'utf8');

                if (args.path.includes(path.join('src', 'core', 'Sub-Store', 'backend', 'src', 'vendor'))) {
                    contents = contents.replace(/const\s+isNode\s*=\s*eval\(`typeof process !== "undefined"`\)\s*;/, 'const isNode = false;');
                }

                return {
                    contents,
                    loader: 'js',
                };
            },
        );
    },
};

!(async () => {
    const artifacts = [{ src: 'src/worker.js', dest: 'dist/_worker.js' }];
    for (const artifact of artifacts) {
        await build({
            entryPoints: [artifact.src],
            bundle: true,
            minify: true,
            sourcemap: false,
            platform: 'browser',
            format: 'esm',
            outfile: artifact.dest,
            inject: [objectHasOwnPolyfill],
            plugins: [replaceOpenApiIsNode],
            // 排除所有 Node 内置模块（包含 tls、net、fs、child_process 等）
            external: nodeBuiltins,
            // 消除 direct-eval 警告日志
            logOverride: {
                'direct-eval': 'silent',
            },
        });
        console.log(`✔️ 打包完成: ${artifact.src} → ${artifact.dest}`);
    }

    const verfacts = [{ src: 'src/vercel.js', dest: 'src/server.js' }];
    for (const artifact of verfacts) {
        await build({
            entryPoints: [artifact.src],
            bundle: true,
            minify: true,
            sourcemap: false,
            platform: 'node',
            format: 'cjs',
            outfile: artifact.dest,
            inject: [objectHasOwnPolyfill],
            plugins: [replaceOpenApiIsNode],
            logOverride: {
                'direct-eval': 'silent',
            },
        });
        console.log(`✔️ 打包完成: ${artifact.src} → ${artifact.dest}`);
    }

    const copyTasks = [
        ['./template', './dist/template'],
        ['./favicon.png', './dist/favicon.png'],
        ['./icon', './dist/icon'],
    ];

    await Promise.all(copyTasks.map(([src, dest]) => cp(src, dest, { recursive: true })));
})();
