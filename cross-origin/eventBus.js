import { eventBus } from '@paychex/core/index.js';
import { error, fatal } from '@paychex/core/errors/index.js';
import { manualReset } from '@paychex/core/signals/index.js';

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
    const transfers = await toTransferables(args);
    return { message, transfers };
}

async function fromEnvelope(data) {
    const { message, transfers } = data;
    const args = await fromTransferables(transfers);
    return { message, args };
}

function asRegExp(host) {
    return new RegExp(host.replace(/\*/g, '.*'), 'i');
}

function matches(rx) {
    return rx.test(String(this));
}

async function sendMessageResponse(status, res) {
    const envelope = await toEnvelope(status, res);
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
 * @param {string|string[]} urlOrHosts If called from a parent window, the URL of the iframe to load.
 * If called from that loaded iframe, the origins the parent is allowed to load the iframe from.
 * @returns {EventBus} An EventBus that can be used to send messages between the two origins.
 * @example
 * // parent (hosting) page
 * // http://my.domain.com
 * const bus = eventBus('http://some.other-domain.com');
 * bus.on('response', async function handler(arg1, arg2) {
 *   console.log(`received response: ${arg1}, ${arg2}`);
 * });
 * bus.fire('message'); // can also send additional event args
 *
 * // child (hosted) page
 * // http://some.other-domain.com
 * const store = localStore();
 * const bus = eventBus(['http://*.domain.com']);
 * bus.on('message', async function handler() {
 *   const arg1 = await store.get('key');
 *   const arg2 = await someAsyncOperation(arg1);
 *   await bus.fire('response', arg1, arg2);
 * });
 */
export default function crossOriginEventBus(urlOrHosts) {

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
        const { message, args } = await fromEnvelope(e.data);
        bus.fire(message, ...args).then(
            sendMessageResponse.bind(e.ports[0], 'success'),
            sendMessageResponse.bind(e.ports[0], 'failure'),
        );
    }

    function connectParent(e) {
        if (e.data === 'connected' && urlOrHosts.map(asRegExp).some(matches, e.origin)) {
            listenOnPort(port = e.ports[0], receiveMessage);
            signal.set();
        }
    }

    function connectChild() {
        const channel = new MessageChannel();
        const origin = new URL(urlOrHosts).origin;
        listenOnPort(port = channel.port1, receiveMessage);
        this.contentWindow.postMessage('connected', origin, [channel.port2]);
        signal.set();
    }

    let port;

    const bus = eventBus();
    const signal = manualReset(false);

    if (typeof urlOrHosts !== 'string') { // child iframe
        globalThis.addEventListener('message', connectParent);
    } else { // parent page
        const frame = globalThis.document.createElement('iframe');
        frame.setAttribute('src', urlOrHosts);
        frame.setAttribute('hidden', '');
        frame.addEventListener('load', connectChild);
        globalThis.document.body.appendChild(frame);
    }

    return { ...bus, fire };

}