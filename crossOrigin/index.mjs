/**
 * Contains utilities to assist with cross-origin communication.
 *
 * ## Importing
 *
 * ```es
 * import { crossOrigin } from '@paychex/platform-browser';
 * ```
 *
 * ```cjs
 * const { crossOrigin } = require('@paychex/platform-browser');
 * ```
 *
 * ```amd
 * define(['@paychex/platform-browser'], function({ crossOrigin }) { ... });
 * require(['@paychex/platform-browser'], function({ crossOrigin }) { ... });
 * ```
 *
 * ```iife
 * const { crossOrigin } = window['@paychex/platform-browser'];
 * ```
 *
 * @module crossOrigin
 */

export { bus } from './events.mjs';