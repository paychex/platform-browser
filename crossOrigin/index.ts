/**
 * Contains utilities to assist with cross-origin communication.
 *
 * ## Importing
 *
 * ```js
 * // esm
 * import { crossOrigin } from '@paychex/platform-browser';
 * ```
 *
 * ```js
 * // commonjs
 * const { crossOrigin } = require('@paychex/platform-browser');
 * ```
 *
 * ```js
 * // amd
 * define(['@paychex/platform-browser'], function({ crossOrigin }) { ... });
 * require(['@paychex/platform-browser'], function({ crossOrigin }) { ... });
 * ```
 *
 * ```js
 * // iife
 * const { crossOrigin } = window['@paychex/platform-browser'];
 * ```
 *
 * @module crossOrigin
 */

import { EventBus } from '@paychex/core/types/events';

export interface CrossOriginMessage {
    message: string,
    args: any[],
    origin: string,
}

export interface CrossOriginEnvelope {
    message: string,
    transfers: ArrayBuffer[],
}

export type CrossOriginConnectEvent = MessageEvent<string>;
export type CrossOriginEvent = MessageEvent<CrossOriginEnvelope>;

/**
 * An EventBus instance that can communicate across origins.
 */
export interface CrossOriginEventBus extends EventBus {

    /**
     * Permanently closes the connection between the parent and child iframes.
     */
    dispose(): void

    /**
     * The IFrame created for the cross-origin page. This is only available on
     * parent (container) instances.
     */
    frame?: HTMLIFrameElement

}

/**
 * Encapsulates information needed to create a cross-origin {@link CrossOriginEventBus}.
 */
export interface CrossOriginEventBusOptions {

    /**
     * The origins allowed to communicate with this bus.
     *
     * @default ['*']
     */
    origins?: string[],

    /**
     * A unique key to identify this bus. The child and parent values must match
     * in order for any messages to be sent.
     *
     * @default ''
     */
    key?: string,

    /** If provided, the URL of the iframe to load. */
    url?: string,

}

export { bus } from './events';