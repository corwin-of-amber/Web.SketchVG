import $ from 'jquery';
import 'jquery-ui-dist/jquery-ui.css';

import './editor.css';

// @ts-ignore
window.$ = window.jQuery = $;
require('jquery-ui-dist/jquery-ui');



const SVG_NS = 'http://www.w3.org/2000/svg';

function $svg<T extends SVGElement = SVGElement>(tagName: string) {
    return $(<unknown>document.createElementNS(SVG_NS, tagName) as T);
}

$svg.point = function($el: JQuery<SVGSVGElement>, x: number, y: number) {
    var pt = $el[0].createSVGPoint();
    pt.x = x; pt.y = y;
    return pt;
};

$svg.coordDOMToSVG = function($el: JQuery<SVGSVGElement>, x: number, y: number) {
    var pt = $svg.point($el, x, y),
        matrix = $el[0].getCTM().inverse();
    return pt.matrixTransform(matrix);
}

/**
 * Adjust dragging functionality for SVG elements.
 * (currently only works for `<circle>`...)
 * @param $el element that should be draggable
 * @param options jQueryUI Draggable options
 */
$svg.draggable = function($el: JQuery<SVGElement>, options?: JQueryUI.DraggableOptions) {
    const svg = $($el[0].ownerSVGElement);
    var start: {x: number, y: number};
    return $el.draggable({
        ...options,
        start(event, ui: DraggableEventUIParams) {
            start = {x: parseFloat($el.attr('cx')),
                     y: parseFloat($el.attr('cy'))};
            ui.center = start;
            if (options?.start) options.start(event, ui);
        },
        drag(event, ui: DraggableEventUIParams) {
            var pt1 = $svg.coordDOMToSVG(svg, ui.position.left, ui.position.top),
                pt0 = $svg.coordDOMToSVG(svg, ui.originalPosition.left, ui.originalPosition.top),
                c = {x: start.x + pt1.x - pt0.x, y: start.y + pt1.y - pt0.y};
            $el.attr({cx: c.x, cy: c.y});
            ui.center = c;
            if (options?.drag) options.drag(event, ui);
        }
    });
};

type DraggableEventUIParams = JQueryUI.DraggableEventUIParams & {
    originalPosition: {top: number, left: number}  // missing in @types/jqueryui
    center: {x: number, y: number}   // added for circles
}


export { DraggableEventUIParams }
export default $svg;