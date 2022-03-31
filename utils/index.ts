/**
 * A collection of helpful utilities
 *
 * ```js
 * // esm
 * import { utils } from '@paychex/platform-browser';
 *
 * // cjs
 * const { utils } = require('@paychex/platform-browser');
 *
 * // iife
 * const { utils } = window['@paychex/platform-browser'];
 *
 * // amd
 * require(['@paychex/platform-browser'], function({ utils }) { ... });
 * define(['@paychex/platform-browser'], function({ utils }) { ... });
 * ```
 *
 * @module utils
 */

/**
 * This function defines a regex pattern that matches the usages/definitions of ids in the <svg></svg> element
 * for replacement.
 * (?<=#?)      - Positive lookbehind capture group that optionally matches id usages.
 * (${idMatch}) - Capture group that matches the desired id.
 *
 * @param idMatch - The expression that matches the id.
 * @returns A regular expression for capturing id definitions/usages.
 */
const idReplacementPattern = (idMatch: string): RegExp => new RegExp(`(?<=#?)(${idMatch})`, "g");

/**
 * The svgId utility function processes a svg element as a string and ensures that the ids within are unique.
 * If there are multiple of the same inline SVGs that have elements in the <defs> block with linked IDs to those
 * symbols, this will assist in a11y compliance by making those IDs unique.
 *
 * @param svg - The SVG that should have unique IDs created
 * @returns An SVG element with unique IDs
 * @example
 * ```js
 * var svgElement = document.getElementById("some-id");
 * var modifiedSvgElement = utils.ensureUniqueIds(svgElement.outerHTML);
 * ```
 */
export function ensureUniqueIds(svg: string): string {
    // Only proceed if it's a svg element
    if (!svg.startsWith("<svg")) {
        return svg;
    }

    /**
     * This is a regex pattern that matches id attributes found in the <defs></defs> element.
     * (?<=<defs>\b.+id=") - Positive lookbehind capture group that matches id attributes after the start of the
     *                       <defs> element.
     * (.+?)               - Capture group that matches the desired value from the id attribute..
     * (?=".+</defs>)      - Positive lookahead capture group that matches id attributes before the end of the
     *                       <defs> element.
     */
    const idDefinitionPattern = new RegExp(`(?<=<defs\\b.+id=")(.+?)(?=".+<\\/defs)`, "gs");

    // Filter out ids so that only unique ids are present
    const ids = Array.from(new Set(svg.match(idDefinitionPattern)));
    const idMap = new Map<string, string>();

    return svg.replace(idReplacementPattern(ids.join('|')), (id: string): string => {
        const replacement = idMap.get(id) || `${id}-${Math.floor(Math.random() * 1e6).toString().padStart(6, "0")}`;
        idMap.set(id, replacement);
        return replacement;
    });
}
