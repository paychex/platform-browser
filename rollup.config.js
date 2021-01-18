const babel = require('rollup-plugin-babel');
const commonjs = require('rollup-plugin-commonjs');
const resolve = require('rollup-plugin-node-resolve');

module.exports = {
    input: 'index.js',
    preserveSymlinks: true,
    external: ['crypto'],
    output: [{
        dir: 'dist',
        format: 'iife',
        name: 'PlatformBrowser',
        file: 'platform-browser.iife.js'
    }, {
        dir: 'dist',
        format: 'umd',
        name: 'PlatformBrowser',
        file: 'platform-browser.umd.js'
    }],
    plugins: [
        babel({
            exclude: [/node_modules/, /\/core-js\//], // prevents dependency cycles
            presets: [
                ['@babel/preset-env', {
                    corejs: 2,
                    modules: false, // required by rollup
                    useBuiltIns: 'usage',
                    targets: 'last 2 versions, not dead, > 1% in US, IE 11'
                }],
            ]
        }),
        resolve({
            browser: true,
            preferBuiltins: true
        }),
        commonjs({
            include: /node_modules/,
        }),
    ],
};
