import '@paychex/core/types/stores.mjs';

/**
 * Contains information used to construct an IndexedDB instance.
 *
 * @class
 * @global
 * @hideconstructor
 */
export class IndexedDBConfiguration {

    /**
     * The database to open. Will be created if it doesn't exist.
     *
     * @type {string}
     * @default '@paychex'
     * @memberof IndexedDBConfiguration#
     */
    database = '@paychex'

    /**
     * The version of the store to access. You can overwrite a
     * previously created store by increasing the version number.
     *
     * @type {number}
     * @default 1
     * @memberof IndexedDBConfiguration#
     */
    version = 1

    /**
     * The store name to use. Will be created if it doesn't exist.
     *
     * @type {string}
     * @memberof IndexedDBConfiguration#
     */
    store = ''

}
