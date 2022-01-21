const path = require('path');

const { nodeResolve } = require("@rollup/plugin-node-resolve");
const { terser } = require("rollup-plugin-terser");
const polyfills = require('rollup-plugin-node-polyfills');
const commonjs = require('@rollup/plugin-commonjs');
const { babel } = require("@rollup/plugin-babel");

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
    paths: {
        '@paychex/core': '@paychex/core'
    }
};

module.exports = [
    {
        // UMD
        external,
        input: 'index.mjs',
        plugins: [
            nodeResolve({
                browser: true,
                preferBuiltins: false,
            }),
            commonjs({
                include: /node_modules/,
            }),
            babel({
                babelHelpers: "bundled",
            }),
            polyfills(),
        ],
        output: [{
            ...output,
            plugins: [terser()],
            file: `dist/paychex.platform-browser.min.js`,
        }, {
            ...output,
            file: `dist/paychex.platform-browser.js`,
        }],
    },
    // ESM
    {
        input: 'index.mjs',
        treeshake: false,
        external,
        plugins: [
            nodeResolve(),
            commonjs({
                include: /node_modules/,
            })
        ],
        output: {
            dir: "dist/esm",
            format: "esm",
            exports: "named",
            sourcemap: true,
        },
    },
    // CJS
    {
        input: 'index.mjs',
        treeshake: false,
        external,
        plugins: [
            nodeResolve(),
            commonjs({
                include: /node_modules/,
            })
        ],
        output: {
            dir: "dist/cjs",
            format: "cjs",
            exports: "named",
            sourcemap: true,
        },
    },
];