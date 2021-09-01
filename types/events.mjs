import { EventBus } from '@paychex/core/types/events.mjs';

/**
 * An EventBus instance that can communicate across origins.
 *
 * Inherits from {@link https://paychex.github.io/core/EventBus.html EventBus}.
 *
 * @class
 * @global
 * @hideconstructor
 * @extends EventBus
 */
export class CrossOriginEventBus extends EventBus {

    /**
     * Permanently closes the connection between the parent and child iframes.
     *
     * @function CrossOriginEventBus#dispose
     */
    dispose() {}

    /**
     * The IFrame created for the cross-origin page. This is only available on
     * parent (container) instances.
     *
     * @type {Window|undefined}
     * @memberof CrossOriginEventBus#
     */
    frame = undefined

}
