import * as expect from 'expect';
import * as utils from '../../utils';
import {spy} from "@paychex/core/test";

describe('utils', () => {
    describe('svgId', () => {
        let random;

        beforeEach(() => {
            random = global.Math.random;
            global.Math.random = spy().returns(0);
        });

        afterEach(() => {
            global.Math.random = random;
        });

        it('should exist', () => {
            expect(utils.ensureUniqueIds).toBeDefined();
        });

        it('should return an unmodified string representation of the element if it\'s not an svg', () => {
            const element = `<div>
                                <defs>
                                    <radialGradient id="test"></radialGradient>
                                </defs>
                                <rect fill="url(#test)"/>
                             </div>`

            const res = utils.ensureUniqueIds(element);

            expect(res).toEqual(element);
        });

        it('should append a unique number to each id in the svg\'s defs element', () => {
            const id1 = "ID1",
                id2 = "ID2",
                svg = `<svg>
                           <defs>
                               <radialGradient id="${id1}"></radialGradient>
                               <radialGradient id="${id2}"></radialGradient>
                           </defs>
                           <rect fill="url(#${id1})"/>
                           <rect fill="url(#${id2}"/>
                       </svg>`
            // @ts-ignore
            // global.Math.random is a spy here so onCall does exist
            global.Math.random.onCall(0).returns(1e-6);
            // @ts-ignore
            // global.Math.random is a spy here so onCall does exist
            global.Math.random.onCall(1).returns(2e-6);

            const modifiedSvg = utils.ensureUniqueIds(svg);

            expect(modifiedSvg).toMatch(/id="ID1-000001"/);
            expect(modifiedSvg).toMatch(/id="ID2-000002"/);
            expect(modifiedSvg).toMatch(/#ID1-000001/);
            expect(modifiedSvg).toMatch(/#ID2-000002/);
        });
    });
});