import * as expect from 'expect';
import { Spy, spy } from '@paychex/core/test';
import {
    localStore,
    sessionStore,
    indexedDB,
    Store,
} from '../../stores';
import { noop } from 'lodash';

describe('stores', () => {

    function delay() {
        return new Promise(resolve => setTimeout(resolve));
    }

    describe('localStore', () => {

        it('returns Store interface', () => {
            const store = localStore.call(null, {});
            ['get', 'set', 'delete'].every(method => {
                expect(typeof store[method]).toBe('function');
            });
        });

        it('allows optional provider', () => {
            (globalThis as any).localStorage = {};
            expect(localStore()).toBeDefined();
        });

    });

    describe('sessionStore', () => {

        it('returns Store interface', () => {
            const store = sessionStore.call(null, {});
            ['get', 'set', 'delete'].every(method => {
                expect(typeof store[method]).toBe('function');
            });
        });

        it('allows optional provider', () => {
            (globalThis as any).sessionStorage = {};
            expect(sessionStore()).toBeDefined();
        });

    });

    describe('indexedDB', () => {

        let db: any,
            os: any,
            txn: any,
            openRequest: any;

        beforeEach(() => {
            openRequest = {};
            os = {
                get: spy(),
                put: spy(),
                delete: spy()
            };
            txn = {
                objectStore: spy().returns(os)
            };
            db = {
                close: spy(),
                transaction: spy().returns(txn),
                createObjectStore: spy(),
                deleteObjectStore: spy(),
                objectStoreNames: []
            };
            Object.assign(global, {
                window: {
                    indexedDB: {
                        open: spy().returns(openRequest)
                    }
                }
            });
        });

        it('returns store interface', () => {
            const store = indexedDB({ store: 'test' });
            const isMethod = (method: keyof Store) => typeof store[method] === 'function';
            expect(['get', 'set', 'delete'].every(isMethod)).toBe(true);
        });

        describe('create/upgrade', () => {

            it('creates v1 if database does not exist', () => {
                indexedDB({ store: 'test' });
                const e = { target: { result: db } };
                openRequest.onupgradeneeded(e);
                expect(db.createObjectStore.called).toBe(true);
                expect(db.createObjectStore.args[0]).toBe('test@1');
            });

            it('keeps v1 if database and store exists', async () => {
                db.objectStoreNames[0] = 'test@1';
                const dbs = new Map();
                const e = { target: { result: db } };
                indexedDB.call(null, { store: 'test' }, dbs);
                openRequest.onsuccess(e);
                await delay();
                expect(dbs.size).toBe(1);
                expect(dbs.get('@paychex')).toBe(db);
            });

            it('creates v2 if database exists but store does not', async () => {
                const e = { target: { result: db } };
                indexedDB({ store: 'test' });
                openRequest.onsuccess(e);
                await delay();
                expect((window.indexedDB.open as Spy).callCount).toBe(2);
                expect((window.indexedDB.open as Spy).args).toEqual(['@paychex', 2]);
            });

            it('closes v1 if new store version needed', async () => {
                const e1 = { target: { result: db } };
                const e2 = { currentTarget: db };
                indexedDB({ store: 'test' });
                openRequest.onsuccess(e1);
                await delay();
                db.onversionchange(e2);
                expect(db.close.called).toBe(true);
            });

            it('deletes previous store versions', () => {
                db.objectStoreNames = ['test@1', 'test@9'];
                const e = { target: { result: db } };
                indexedDB({ store: 'test', version: 10 });
                openRequest.onupgradeneeded(e);
                expect(db.deleteObjectStore.called).toBe(true);
                expect(db.deleteObjectStore.callCount).toBe(2);
                expect(db.deleteObjectStore.args[0]).toEqual('test@9');
            });

            it('opens most recent version', async () => {
                const e = { target: { error: { name: 'VersionError' } } };
                indexedDB({ store: 'test' });
                expect((window.indexedDB.open as Spy).args[1]).toBe(1);
                openRequest.onerror(e);
                await delay();
                expect((window.indexedDB.open as Spy).args[1]).toBe(2);
            });

            it('rejects methods if error occurs during open', async () => {
                const error = new Error();
                const e = { target: { error } };
                const store = indexedDB({ store: 'test' });
                process.once('unhandledRejection', noop);
                openRequest.onerror(e);
                try {
                    await store.get('key')
                } catch (e) {
                    expect(e).toBe(error);
                }
            });

        });

        describe('get', () => {

            it('rejects if transaction fails', (done) => {
                const e = { target: { result: db } };
                const store = indexedDB({ store: 'test' });
                os.get.returns({});
                db.objectStoreNames = ['test@1'];
                openRequest.onsuccess(e);
                store.get('key').catch(e => {
                    expect(e).toBe(txn.error);
                    done();
                });
                setTimeout(() => {
                    txn.error = new Error();
                    txn.onerror();
                });
            });

            it('resolves with request result', (done) => {
                const result = { object: 'string' };
                const e = { target: { result: db } };
                const store = indexedDB({ store: 'test' });
                const request = { result };
                os.get.returns(request);
                db.objectStoreNames = ['test@1'];
                openRequest.onsuccess(e);
                store.get('key').then(value => {
                    expect(value).toBe(result);
                    done();
                });
                setTimeout(() => (request as any).onsuccess());
            });

            it('resolves with undefined if key does not exist', done => {
                const store = indexedDB({ store: 'test' });
                const request = { result: undefined } as any;
                os.get.returns(request);
                db.objectStoreNames = ['test@1'];
                openRequest.onsuccess({ target: { result: db } });
                store.get('key').then(value => {
                    expect(value).toBeUndefined();
                    done();
                });
                setTimeout(() => (request as any).onsuccess());
            });

        });

        describe('set', () => {

            it('opens transaction in readwrite mode', async () => {
                const e = { target: { result: db } };
                const store = indexedDB({ store: 'test' });
                os.put.returns({});
                db.objectStoreNames = ['test@1'];
                openRequest.onsuccess(e);
                store.set('key', 'value');
                await delay();
                expect(db.transaction.args[1]).toBe('readwrite');
            });

            it('puts value, key in store', async () => {
                const e = { target: { result: db } };
                const store = indexedDB({ store: 'test' });
                os.put.returns({});
                db.objectStoreNames = ['test@1'];
                openRequest.onsuccess(e);
                store.set('key', 'value');
                await delay();
                expect(os.put.args).toEqual(['value', 'key']);
            });

            it('resolves with key on success', (done) => {
                const e = { target: { result: db } };
                const store = indexedDB({ store: 'test' });
                const request = { result: 'key' };
                os.put.returns(request);
                db.objectStoreNames = ['test@1'];
                openRequest.onsuccess(e);
                store.set('key', 'value').then((result) => {
                    expect(result).toBe('key');
                    done();
                });
                setTimeout(() => (request as any).onsuccess());
            });

            it('rejects if transaction fails', (done) => {
                const e = { target: { result: db } };
                const store = indexedDB({ store: 'test' });
                os.put.returns({});
                db.objectStoreNames = ['test@1'];
                openRequest.onsuccess(e);
                store.set('key', 'value').catch(e => {
                    expect(e).toBe(txn.error);
                    done();
                });
                setTimeout(() => {
                    txn.error = new Error();
                    txn.onerror();
                });
            });

        });

        describe('delete', () => {

            it('opens transaction in readwrite mode', async () => {
                const e = { target: { result: db } };
                const store = indexedDB({ store: 'test' });
                os.delete.returns({});
                db.objectStoreNames = ['test@1'];
                openRequest.onsuccess(e);
                store.delete('key');
                await delay();
                expect(db.transaction.args[1]).toBe('readwrite');
            });

            it('deletes key from store', async () => {
                const e = { target: { result: db } };
                const store = indexedDB({ store: 'test' });
                os.delete.returns({});
                db.objectStoreNames = ['test@1'];
                openRequest.onsuccess(e);
                store.delete('key');
                await delay();
                expect(os.delete.args).toEqual(['key']);
            });

            it('resolves with undefined on success', (done) => {
                const e = { target: { result: db } };
                const store = indexedDB({ store: 'test' });
                const request = {};
                os.delete.returns(request);
                db.objectStoreNames = ['test@1'];
                openRequest.onsuccess(e);
                store.delete('key').then((result) => {
                    expect(result).toBeUndefined();
                    done();
                });
                setTimeout(() => (request as any).onsuccess());
            });

            it('rejects if transaction fails', (done) => {
                const e = { target: { result: db } };
                const store = indexedDB({ store: 'test' });
                os.delete.returns({});
                db.objectStoreNames = ['test@1'];
                openRequest.onsuccess(e);
                store.delete('key').catch(e => {
                    expect(e).toBe(txn.error);
                    done();
                });
                setTimeout(() => {
                    txn.error = new Error();
                    txn.onerror();
                });
            });

        });

    });

});
