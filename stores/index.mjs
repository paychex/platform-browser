import { stores } from '@paychex/core';

import '../types/stores.mjs';

/**
 * Provides methods for storing information on the client's
 * machine. The persistence period will vary based on the
 * storage type and configuration.
 *
 * ## Importing
 *
 * ```es
 * import { stores } from '@paychex/platform-browser';
 * ```
 *
 * ```cjs
 * const { stores } = require('@paychex/platform-browser');
 * ```
 *
 * ```amd
 * define(['@paychex/platform-browser'], function({ stores }) { ... });
 * require(['@paychex/platform-browser'], function({ stores }) { ... });
 * ```
 *
 * ```iife
 * const { stores } = window['@paychex/platform-browser'];
 * ```
 *
 * @module stores
 */

/**
 * A persistent store that keeps data between site visits.
 *
 * **NOTE**: Objects are serialized to JSON during storage to ensure
 * any modifications to the original object are not reflected in the
 * cached copy as a side-effect. Retrieving the cached version will
 * always reflect the object as it existed at the time of storage.
 * _However_, some property types cannot be serialized to JSON. For
 * more information, [read this](https://abdulapopoola.com/2017/02/27/what-you-didnt-know-about-json-stringify/).
 *
 * @function module:stores.localStore
 * @returns {Store} A Store backed by the browser's
 * localStorage Storage provider.
 * @example
 * import { user } from '~/currentUser';
 *
 * const store = browser.stores.localStore();
 * const persistentData = core.stores.utils.withPrefix(store, user.guid);
 *
 * export async function loadSomeData() {
 *   return await persistentData.get('some.key');
 * }
 */
export function localStore(provider = localStorage) {
    return stores.htmlStore(provider);
}

/**
 * A persistent store whose data will be deleted when the browser
 * window is closed. However, the data will remain during normal
 * navigation and refreshes.
 *
 * **NOTE**: Objects are serialized to JSON during storage to ensure
 * any modifications to the original object are not reflected in the
 * cached copy as a side-effect. Retrieving the cached version will
 * always reflect the object as it existed at the time of storage.
 * _However_, some property types cannot be serialized to JSON. For
 * more information, [read this](https://abdulapopoola.com/2017/02/27/what-you-didnt-know-about-json-stringify/).
 *
 * @function module:stores.sessionStore
 * @returns {Store} A Store backed by the browser's
 * sessionStorage Storage provider.
 * @example
 * import { user } from '~/currentUser';
 *
 * const store = browser.stores.sessionStore();
 * const data = core.stores.utils.withPrefix(store, user.guid);
 *
 * export async function loadSomeData() {
 *   return await data.get('some.key');
 * }
 */
export function sessionStore(provider = sessionStorage) {
    return stores.htmlStore(provider);
}

function promisify(object, success, error) {
    return new Promise((resolve, reject) => {
        object[error] = reject;
        object[success] = resolve;
    });
}

const dbs = new Map();

/**
 * A persistent store whose objects are retained between visits.
 *
 * **NOTE**: Objects are serialized to JSON during storage to ensure
 * any modifications to the original object are not reflected in the
 * cached copy as a side-effect. Retrieving the cached version will
 * always reflect the object as it existed at the time of storage.
 * _However_, some property types cannot be serialized to JSON. For
 * more information, [read this](https://abdulapopoola.com/2017/02/27/what-you-didnt-know-about-json-stringify/).
 *
 * @function module:stores.indexedDB
 * @param {IndexedDBConfiguration} config Configures
 * the IndexedDB store to be used.
 * @returns {Store} A Store backed by IndexedDB.
 * @example
 * const reports = stores.indexedDB({store: 'reports'});
 *
 * export async function loadReport(id) {
 *   const result = await someDataCall(id);
 *   await reports.set(id, result);
 *   return result;
 * }
 */
export function indexedDB({
    database = '@paychex',
    version = 1,
    store
}, databases = dbs) {

    let dbVersion = 1;
    const prefix = `${store}@`;
    const table = `${prefix}${version}`;

    function closePreviousVersion(e) {
        e.currentTarget.close()
    }

    function isLowerVersion(storeName) {
        return storeName.startsWith(prefix) &&
            Number(storeName.replace(prefix, '')) < version;
    }

    function increment() {
        dbVersion++;
        return openDatabase();
    }

    function handleVersionChange(e) {
        const db = e.target.result;
        db.onversionchange = closePreviousVersion;
        return db;
    }

    function handleOpenError(e) {
        if (e.target.error.name === 'VersionError') {
            return increment();
        }
        throw e.target.error;
    }

    function openDatabase() {
        return new Promise((resolve, reject) => {
            const request = window.indexedDB.open(database, dbVersion);
            request.onupgradeneeded = createStore;
            promisify(request, 'onsuccess', 'onerror')
                .then(handleVersionChange, handleOpenError)
                .then(resolve, reject);
        });
    }

    function createStore(e) {
        const db = e.target.result;
        db.createObjectStore(table);
        const names = db.objectStoreNames;
        Array.prototype.filter.call(names, isLowerVersion)
            .forEach(db.deleteObjectStore, db);
    }

    function upgradeIfStoreNotFound(db) {
        const names = db.objectStoreNames;
        if (Array.prototype.includes.call(names, table)) {
            databases.set(database, db);
        } else {
            return increment().then(upgradeIfStoreNotFound);
        }
    }

    async function performOperation(operation, args, mode = 'readonly') {
        await ready;
        const db = databases.get(database);
        const tx = db.transaction(table, mode);
        const os = tx.objectStore(table);
        const req = os[operation].apply(os, args);
        return new Promise((resolve, reject) => {
            tx.onerror = () => reject(tx.error);
            req.onsuccess = () => resolve(req.result);
        });
    }

    const ready = openDatabase()
        .then(upgradeIfStoreNotFound);

    return {

        async get(key) {
            return performOperation('get', [key]);
        },

        async set(key, value) {
            return performOperation('put', [value, key], 'readwrite');
        },

        async delete(key) {
            return performOperation('delete', [key], 'readwrite');
        }

    };

}
