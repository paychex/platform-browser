import expect from 'expect';
import { spy } from '@paychex/core/test/utils.js';
import eventBus from '../../cross-origin/eventBus.js';
import { FATAL } from '@paychex/core/errors/index.js';

describe('cross-origin/eventBus', () => {

    let document, parent, blob, ael, rel, frame, channel, MessageChannel;

    beforeEach(() => {
        ael = globalThis.addEventListener;
        rel = globalThis.removeEventListener;
        parent = { postMessage: spy() };
        blob = spy().returns({
            text: spy().returns(Promise.resolve('""')),
            arrayBuffer: spy().returns(Promise.resolve(new Uint8Array())),
        });
        frame = {
            remove: spy(),
            setAttribute: spy(),
        };
        channel = {
            port1: {
                start: spy(),
                close: spy(),
                postMessage: spy(),
                addEventListener: spy(),
            },
            port2: {
                start: spy(),
                close: spy(),
                postMessage: spy(),
                addEventListener: spy(),
            },
        };
        document = {
            createElement: spy().returns(frame),
            body: { appendChild: spy() },
        };
        MessageChannel = spy().returns(channel);
        globalThis.parent = parent;
        globalThis.document = document;
        globalThis.Blob = blob;
        globalThis.MessageChannel = MessageChannel;
        globalThis.origin = 'http://test.com';
        globalThis.addEventListener = spy();
        globalThis.removeEventListener = spy();
    });

    afterEach(() => {
        delete globalThis.origin;
        globalThis.addEventListener = ael;
        globalThis.removeEventListener = rel;
    });

    it('returns EventBus instance', () => {
        const bus = eventBus();
        ['fire', 'on', 'dispose'].forEach(method => {
            expect(bus[method]).toBeInstanceOf(Function);
        });
    });

    it('constructs iframe if given url', () => {
        eventBus({ url: 'test' });
        expect(document.createElement.args).toEqual(['iframe']);
        expect(document.body.appendChild.args).toEqual([frame]);
    });

    it('sends port to parent if not given url', () => {
        eventBus();
        expect(parent.postMessage.called).toBe(true);
        expect(parent.postMessage.args).toEqual([
            expect.any(String),
            '*',
            [channel.port2],
        ]);
    });

    it('parent listens for messages', () => {
        eventBus({ url: 'test' });
        const handler = globalThis.addEventListener.args[1];
        handler({
            origin: 'child',
            data: 'connect:',
            ports: [channel.port2],
        });
        expect(channel.port2.addEventListener.called).toBe(true);
    });

    it('handles received messages - with return values', (done) => {
        const bus = eventBus();
        const receiver = spy().returns(123);
        const handler = channel.port1.addEventListener.args[1];
        bus.on('message', receiver);
        handler({
            origin: 'other',
            ports: [channel.port2],
            data: {
                message: 'message',
                transfers: [[], []],
            },
        }).then(() => {
            expect(receiver.called).toBe(true);
            done();
        });
    });

    it('handles received messages - without return values', (done) => {
        eventBus();
        const handler = channel.port1.addEventListener.args[1];
        handler({
            origin: 'other',
            ports: [channel.port2],
            data: {
                message: 'message',
                transfers: [[], []],
            },
        }).then(() => done());
    });

    describe('fire', () => {

        it('posts message on correct port', (done) => {
            const bus = eventBus();
            bus.fire('event', 123, 'abc');
            setTimeout(() => {
                expect(channel.port1.postMessage.called).toBe(true);
                done();
            });
        });

        it('resolves if response message success', (done) => {
            eventBus().fire('event').then(done);
            setTimeout(() => {
                const handler = channel.port1.addEventListener.args[1];
                handler({
                    data: {
                        message: 'success',
                        transfers: []
                    }
                });
            });
        });

        it('rejects if response message failed', (done) => {
            eventBus().fire('event').catch(() => done());
            setTimeout(() => {
                const handler = channel.port1.addEventListener.args[1];
                handler({
                    data: {
                        message: 'failure',
                        transfers: []
                    }
                });
            });
        });

        it('rejects if non-serializable arg passed', (done) => {
            eventBus().fire('event', undefined).catch((e) => {
                expect(e.severity).toBe(FATAL);
                expect(e.message).toMatch(/serializable/);
                done();
            });
        });

    });

    describe('dispose', () => {

        it('cleans up parent', () => {
            const bus = eventBus({ url: 'test' });
            bus.dispose();
            expect(frame.remove.called).toBe(true);
        });

        it('cleans up child', () => {
            const bus = eventBus();
            bus.dispose();
            expect(channel.port1.close.called).toBe(true);
        });

    });

});