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
     * @memberof CrossOriginEventBus#
     */
    dispose() { }

}
