import expect from 'expect';
import { errors } from '@paychex/core';
import { spy } from '@paychex/core/test/utils.mjs';

import { bus } from '../../crossOrigin/events.mjs';

describe('cross-origin', () => {

    describe('bus', () => {

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

        it('returns bus instance', () => {
            const hub = bus();
            ['fire', 'on', 'dispose'].forEach(method => {
                expect(hub[method]).toBeInstanceOf(Function);
            });
        });

        it('constructs iframe if given url', () => {
            bus({ url: 'test' });
            expect(document.createElement.args).toEqual(['iframe']);
            expect(document.body.appendChild.args).toEqual([frame]);
        });

        it('sends port to parent if not given url', () => {
            bus();
            expect(parent.postMessage.called).toBe(true);
            expect(parent.postMessage.args).toEqual([
                expect.any(String),
                '*',
                [channel.port2],
            ]);
        });

        it('parent listens for messages', () => {
            bus({ url: 'test' });
            const handler = globalThis.addEventListener.args[1];
            handler({
                origin: 'child',
                data: 'connect:',
                ports: [channel.port2],
            });
            expect(channel.port2.addEventListener.called).toBe(true);
        });

        it('handles received messages - with return values', (done) => {
            const hub = bus();
            const receiver = spy().returns(123);
            const handler = channel.port1.addEventListener.args[1];
            hub.on('message', receiver);
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
            bus();
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
                const hub = bus();
                hub.fire('event', 123, 'abc');
                setTimeout(() => {
                    expect(channel.port1.postMessage.called).toBe(true);
                    done();
                });
            });

            it('resolves if response message success', (done) => {
                bus().fire('event').then(done);
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
                bus().fire('event').catch(() => done());
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
                bus().fire('event', undefined).catch((e) => {
                    expect(e.severity).toBe(errors.FATAL);
                    expect(e.message).toMatch(/serializable/);
                    done();
                });
            });

        });

        describe('dispose', () => {

            it('cleans up parent', () => {
                const hub = bus({ url: 'test' });
                hub.dispose();
                expect(frame.remove.called).toBe(true);
            });

            it('cleans up child', () => {
                const hub = bus();
                hub.dispose();
                expect(channel.port1.close.called).toBe(true);
            });

        });

    });

});