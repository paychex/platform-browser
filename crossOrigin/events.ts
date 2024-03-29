import { events, errors, signals } from '@paychex/core';
import { CrossOriginConnectEvent, CrossOriginEnvelope, CrossOriginEvent, CrossOriginEventBus, CrossOriginEventBusOptions, CrossOriginMessage } from '.';

async function toTransferable(thing: any): Promise<ArrayBuffer> {
    const string = JSON.stringify(thing);
    if (typeof string !== 'string')
        throw errors.error('Message arguments must be serializable as JSON.', errors.fatal());
    return new Blob(string.split('')).arrayBuffer();
}

async function toTransferables(args: any[]): Promise<ArrayBuffer[]> {
    const promises = args.map(toTransferable);
    return Promise.all(promises);
}

async function fromTransferable(buffer: ArrayBuffer): Promise<any> {
    const array = new Uint8Array(buffer);
    const json = await new Blob([array]).text();
    return JSON.parse(json);
}

async function fromTransferables(objects: ArrayBuffer[]): Promise<any[]> {
    const promises = objects.map(fromTransferable);
    return Promise.all(promises);
}

async function toEnvelope(message: string, ...args: any[]): Promise<CrossOriginEnvelope> {
    args.unshift(globalThis.origin);
    const transfers = await toTransferables(args);
    return { message, transfers };
}

async function fromEnvelope(data: CrossOriginEnvelope): Promise<CrossOriginMessage> {
    const { message, transfers } = data;
    const args = await fromTransferables(transfers);
    const origin = args.shift();
    return { message, args, origin };
}

function asRegExp(host: string): RegExp {
    const pattern = host.replace(/\*/g, '.*');
    return new RegExp(`^${pattern}$`, 'i');
}

function matches(rx: RegExp): boolean {
    return rx.test(String(this));
}

async function sendMessageResponse(status: string, result: any): Promise<void> {
    const envelope = result === undefined ?
        await toEnvelope(status) :
        await toEnvelope(status, result);
    this.postMessage(envelope, envelope.transfers);
}

async function handleMessageResponse(e: CrossOriginEvent): Promise<void> {
    const { message, args } = await fromEnvelope(e.data);
    message === 'success' ?
        this.resolve(args[0]) :
        this.reject(args[0]);
}

function listenOnPort(port: MessagePort, callback: (e: CrossOriginEvent) => void): void {
    port.addEventListener('message', callback);
    port.start();
}

/**
 * Creates an EventBus to enable cross-origin communication.
 *
 * ```js
 * import { crossOrigin } from '@paychex/platform-browser';
 *
 * const bus = crossOrigin.bus({ url: 'http://some.other-domain.com' });
 *
 * // listen for messages from some.other-domain.com
 * bus.on('some-message', async function handle(arg1, arg2) { ... });
 *
 * // send messages to some.other-domain.com and process return values
 * await bus.fire('some-event', 'abc', 123)
 *   .then((results) => { ... });
 * ```
 *
 * **IMPORTANT!** Message arguments must be serializable as JSON. If not, the `fire`
 * method will return a rejected Promise. For example:
 *
 * ```js
 * await bus.fire('message', undefined); // throws error
 * await bus.fire('message', null); // okay
 * await bus.fire('message', { key: undefined }); // okay
 * ```
 * @param options Values used to customize the EventBus's behavior.
 * @returns An EventBus that can be used to send messages between the two origins. The
 * bus will have a new method, `dispose`, that can be used to tear down the connection.
 * @example
 * ```js
 * // parent (hosting) page
 * // http://my.domain.com
 *
 * const bus = crossOrigin.bus({ url: 'http://some.other-domain.com' });
 *
 * // listen for messages from other domain
 * bus.on('response', async function handler(arg1, arg2) {
 *   console.log(`received response: ${arg1}, ${arg2}`);
 * });
 *
 * // send messages to the other domain
 * await bus.fire('message', 'abc', 123).then(
 *   (results) => console.log(results),
 *   (error) => console.error(error),
 * );
 *
 * // destroy the connection at any time
 * bus.dispose();
 * ```
 * @example
 * ```js
 * // child (hosted) page
 * // http://some.other-domain.com
 *
 * const store = stores.localStore();
 * const bus = crossOrigin.bus({ origins: ['http://*.domain.com'] });
 *
 * // listen for messages from parent parge
 * bus.on('message', async function handler(key, param) {
 *   const arg1 = await store.get(key);
 *   const arg2 = await someAsyncOperation(arg1, param);
 *   await bus.fire('response', arg1, arg2);
 * });
 * ```
 */
export function bus(options: CrossOriginEventBusOptions = {}): CrossOriginEventBus {

    const key = options.key || '';
    const url = options.url || null;
    const origins = options.origins || ['*'];

    function SendMessagePromise(resolve: any, reject: any) {
        const transfers = [this.channel.port2].concat(this.envelope.transfers);
        const messageHandler = handleMessageResponse.bind({ resolve, reject });
        listenOnPort(this.channel.port1, messageHandler);
        port.postMessage(this.envelope, transfers);
    }

    async function fire(message: string, ...args: any[]): Promise<any[]> {
        await signal.ready();
        const channel = new MessageChannel();
        const envelope = await toEnvelope(message, ...args);
        return new Promise(SendMessagePromise.bind({ channel, envelope }));
    }

    async function receiveMessage(e: CrossOriginEvent) {
        await signal.ready();
        const { message, args, origin } = await fromEnvelope(e.data);
        if (verify(origin))
            await hub.fire(message, ...args).then(
                sendMessageResponse.bind(e.ports[0], 'success'),
                sendMessageResponse.bind(e.ports[0], 'failure'),
            );
    }

    async function connectChild(e: CrossOriginConnectEvent): Promise<void> {
        if (verify(e.origin) && e.data === CONNECT) {
            listenOnPort(port = e.ports[0], receiveMessage);
            signal.set();
        }
    }

    function dispose() {
        port && port.close();
        frame && frame.remove();
        globalThis.removeEventListener('message', connectChild);
    }

    let port: MessagePort,
        frame: HTMLIFrameElement;

    const hub = events.bus();
    const signal = signals.manualReset(false);
    const CONNECT = `connect:${key}`;
    const allowed = origins.map(asRegExp);
    const verify = (origin: string) => allowed.some(matches, origin);

    if (url) { // parent (hosting) page
        frame = globalThis.document.createElement('iframe');
        frame.setAttribute('hidden', '');
        frame.setAttribute('src', url);
        globalThis.addEventListener('message', connectChild);
        globalThis.document.body.appendChild(frame);
    } else { // child (hosted) iframe
        const channel = new MessageChannel();
        listenOnPort(port = channel.port1, receiveMessage);
        globalThis.parent.postMessage(CONNECT, '*', [channel.port2]);
        signal.set();
    }

    return { ...hub, fire, dispose, frame };

}