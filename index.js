import * as stores from './stores/index.js';
import eventBus from './cross-origin/eventBus.js';

export default {
    ...stores,
    eventBus,
};