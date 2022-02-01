const path = require('path');

const { nodeResolve } = require("@rollup/plugin-node-resolve");
const { terser } = require("rollup-plugin-terser");
const polyfills = require('rollup-plugin-node-polyfills');
const commonjs = require('@rollup/plugin-commonjs');
const { babel } = require("@rollup/plugin-babel");
const typescript = require('@rollup/plugin-typescript');

const pkg = require('./package.json');
const external = ['@paychex/core'];

const output = {
    format: "umd",
    name: pkg.name,
    esModule: false,
    exports: "named",
    sourcemap: true,
    banner: `/*! ${pkg.name} v${pkg.version} */`,
    sourcemapPathTransform: (relativeSourcePath, sourcemapPath) => {
        return `${pkg.name}/${path.relative(path.resolve('.'), path.resolve(path.dirname(sourcemapPath), relativeSourcePath))}`;
    },
    globals: {
        '@paychex/core': '@paychex/core',
    },
};

module.exports = [
    {
        // UMD
        external,
        input: 'index.ts',
        plugins: [
            nodeResolve({
                browser: true,
                preferBuiltins: false,
            }),
            commonjs({
                include: /node_modules/,
            }),
            typescript({
                tsconfig: './tsconfig.json',
            }),
            babel({
                babelHelpers: "bundled",
            }),
            polyfills(),
        ],
        output: [{
            ...output,
            plugins: [terser()],
            file: pkg.browser.replace('.js', '.min.js'),
        }, {
            ...output,
            file: pkg.browser,
        }],
    },
    // ESM
    {
        input: 'index.ts',
        treeshake: false,
        external,
        plugins: [
            typescript({
                tsconfig: './tsconfig.json',
            }),
            nodeResolve(),
            commonjs({
                include: /node_modules/,
            })
        ],
        output: {
            file: pkg.module,
            format: "esm",
            exports: "named",
            sourcemap: true,
            banner: `/*! ${pkg.name} v${pkg.version} */`,
        },
    },
    // CJS
    {
        input: 'index.ts',
        treeshake: false,
        external,
        plugins: [
            typescript({
                tsconfig: './tsconfig.json',
            }),
            nodeResolve(),
            commonjs({
                include: /node_modules/,
            })
        ],
        output: {
            file: pkg.main,
            format: "cjs",
            exports: "named",
            sourcemap: true,
            banner: `/*! ${pkg.name} v${pkg.version} */`,
        },
    },
];