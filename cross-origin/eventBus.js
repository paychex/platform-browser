import { eventBus } from '@paychex/core/index.js';
import { error, fatal } from '@paychex/core/errors/index.js';
import { manualReset } from '@paychex/core/signals/index.js';

/**
 * Contains utilities to assist with cross-origin communications.
 *
 * @module cross-origin
 */

function toTransferable(thing) {
    const string = JSON.stringify(thing);
    if (typeof string !== 'string')
        throw error('Message arguments must be serializable as JSON.', fatal());
    return new Blob(string.split('')).arrayBuffer();
}

async function toTransferables(args) {
    const promises = args.map(toTransferable);
    return await Promise.all(promises);
}

async function fromTransferable(buffer) {
    const array = new Uint8Array(buffer);
    const json = await new Blob([array]).text();
    return JSON.parse(json);
}

async function fromTransferables(objects) {
    const promises = objects.map(fromTransferable);
    return await Promise.all(promises);
}

async function toEnvelope(message, ...args) {
    args.unshift(globalThis.origin);
    const transfers = await toTransferables(args);
    return { message, transfers };
}

async function fromEnvelope(data) {
    const { message, transfers } = data;
    const args = await fromTransferables(transfers);
    const origin = args.shift();
    return { message, args, origin };
}

function asRegExp(host) {
    const pattern = host.replace(/\*/g, '.*');
    return new RegExp(`^${pattern}$`, 'i');
}

function matches(rx) {
    return rx.test(String(this));
}

async function sendMessageResponse(status, result) {
    const envelope = result === undefined ?
        await toEnvelope(status) :
        await toEnvelope(status, result);
    this.postMessage(envelope, envelope.transfers);
}

async function handleMessageResponse(e) {
    const { message, args } = await fromEnvelope(e.data);
    message === 'success' ?
        this.resolve(args[0]) :
        this.reject(args[0]);
}

function listenOnPort(port, callback) {
    port.addEventListener('message', callback);
    port.start();
}

/**
 * Creates an EventBus to enable cross-origin communication.
 *
 * **IMPORTANT!** Message arguments must be serializable as JSON. If not, the `fire`
 * method will return a rejected Promise. For example:
 *
 * ```js
 * await bus.fire('message', undefined); // throws error
 * await bus.fire('message', null); // okay
 * await bus.fire('message', { key: undefined }); // okay
 * ```
 * @function eventBus
 * @static
 * @param {object} [params] Values used to customize the EventBus's behavior.
 * @param {string} [params.url] If provided, the URL of the iframe to load.
 * @param {string[]} [params.origins=['*']] The origins allowed to communicate with this bus.
 * @param {string} [params.key=''] A unique key to identify this bus. The child and parent values must match
 * in order for any messages to be sent.
 * @returns {EventBus} An EventBus that can be used to send messages between the two origins. The
 * bus will have a new method, `dispose`, that can be used to tear down the connection.
 * @example
 * import eventBus from '@paychex/platform-browser/cross-origin/eventBus.js';
 *
 * // parent (hosting) page
 * // http://my.domain.com
 * const bus = eventBus({ url: 'http://some.other-domain.com' });
 * bus.on('response', async function handler(arg1, arg2) {
 *   console.log(`received response: ${arg1}, ${arg2}`);
 * });
 * bus.fire('message'); // can also send additional event args
 * bus.dispose(); // destroy the bus at any time
 *
 * // child (hosted) page
 * // http://some.other-domain.com
 * const store = localStore();
 * const bus = eventBus({ origins: ['http://*.domain.com'] });
 * bus.on('message', async function handler() {
 *   const arg1 = await store.get('key');
 *   const arg2 = await someAsyncOperation(arg1);
 *   await bus.fire('response', arg1, arg2);
 * });
 */
export default function crossOriginEventBus({
    key = '',
    url = null,
    origins = ['*'],
} = {}) {

    function SendMessagePromise(resolve, reject) {
        const transfers = [this.channel.port2].concat(this.envelope.transfers);
        const messageHandler = handleMessageResponse.bind({ resolve, reject });
        listenOnPort(this.channel.port1, messageHandler);
        port.postMessage(this.envelope, transfers);
    }

    async function fire(message, ...args) {
        await signal.ready();
        const channel = new MessageChannel();
        const envelope = await toEnvelope(message, ...args);
        return new Promise(SendMessagePromise.bind({ channel, envelope }));
    }

    async function receiveMessage(e) {
        await signal.ready();
        const { message, args, origin } = await fromEnvelope(e.data);
        if (verify(origin))
            await bus.fire(message, ...args).then(
                sendMessageResponse.bind(e.ports[0], 'success'),
                sendMessageResponse.bind(e.ports[0], 'failure'),
            );
    }

    async function connectChild(e) {
        if (verify(e.origin) && e.data === CONNECT) {
            listenOnPort(port = e.ports[0], receiveMessage);
            globalThis.removeEventListener('message', connectChild);
            signal.set();
        }
    }

    function dispose() {
        port && port.close();
        frame && frame.remove();
        globalThis.removeEventListener('message', connectChild);
    }

    let port,
        frame;

    const bus = eventBus();
    const signal = manualReset(false);
    const CONNECT = `connect:${key}`;
    const allowed = origins.map(asRegExp);
    const verify = (origin) => allowed.some(matches, origin);

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

    return { ...bus, fire, dispose };

}