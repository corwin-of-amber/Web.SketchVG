import { EventEmitter } from 'events';
import $ from 'jquery';

import $svg, { DraggableEventUIParams } from '../dom';
import { Point2D } from '../shape';
import { ShapeComponent } from './shape';



class SketchComponent extends EventEmitter {
    svg: JQuery<SVGSVGElement>
    grid: JQuery<SVGGElement>
    draw: JQuery<SVGGElement>
    mark: JQuery<SVGGElement>
    ctrl: JQuery<SVGGElement>

    constructor(svg: JQuery<SVGSVGElement>) {
        super();
        this.svg = svg;
        this.grid = $svg('g'); svg.append(this.grid.addClass('grid'));
        this.draw = $svg('g'); svg.append(this.draw.addClass('draw'));
        this.mark = $svg('g'); svg.append(this.mark.addClass('mark'));
        this.ctrl = $svg('g'); svg.append(this.ctrl.addClass('ctrl'));

        this.createGridLines();
        this.createMarkShadows();
        this.bindEvents();
    }

    createGridLines() {
        var ln = [-75, -50, -25, 0, 25, 50, 75];

        var gridlines = 
              ln.map(y => $svg('path').attr('d', `M-100 ${y} l200 0`))
            .concat(
              ln.map(x => $svg('path').attr('d', `M${x} -100 l0 200`)));

        this.grid.append(...gridlines);
    }

    createMarkShadows() {
        for (let shape of this.draw.children()) {
            this.mark.append(<any>shape.cloneNode());
        }    
    }

    bindEvents() {
        this.svg.on('mousedown', ev => this.onMouseDown(ev));
    }

    addShape(shape: JQuery<SVGElement>) {
        var shadow = shape.clone();
        this.draw.append(shape);
        this.mark.append(shadow);
        return shape.add(<any>shadow);
    }

    addControl(widget: ControlWidget) {
        this.ctrl.append(widget.el);
        widget.mounted();
    }

    removeControl(widget: ControlWidget) {
        widget.el.remove();
    }

    onMouseDown(ev: JQuery.MouseDownEvent) {
        this.emit(ev.type, this._mkMouseEvent(ev));
    }

    _mkMouseEvent<E extends JQuery.MouseEventBase>(ev: E) {
        var evat: SketchEvent<E> = ev;
        evat.at = $svg.coordDOMToSVG(this.svg, ev.offsetX, ev.offsetY);
        return evat;
    }
}

interface SketchComponent {
    on(type: 'mousedown', h: (ev: SketchEvent<JQuery.MouseDownEvent>) => void): this;
}


abstract class ControlWidget extends EventEmitter {
    el: JQuery<SVGCircleElement>
    mounted() { }

    hide(tog = true) { this.el.toggleClass('ctrl--hide', tog); }
    unhide() { this.hide(false); }
}

class Knob extends ControlWidget {
    at: Point2D
    mobile: boolean

    constructor(at: Point2D, mobile = true, cssClasses: string[] = []) {
        super();
        this.at = at;
        this.mobile = mobile;
        this.el = $svg<SVGCircleElement>('circle').attr({cx: at.x, cy: at.y});
        this.el.addClass(['knob', ...cssClasses]);
        this.el.on('mousedown', ev => this.onMouseDown(ev));
    }

    mounted() {
        if (this.mobile) {
            $svg.draggable(this.el, {
                drag: (event, ui: DraggableEventUIParams) => {
                    this.at = ui.center;
                    this.emit('move', {target: this, at: this.at});
                }
            });
        }
    }

    move(to: Point2D, dispatch=true) {
        this.at = to;
        this.el.attr({cx: to.x, cy: to.y});
        if (dispatch)
            this.emit('move', {target: this, at: this.at});
    }

    onMouseDown(ev: JQuery.MouseDownEvent) {
        ev.stopPropagation();
        this.emit(ev.type, ev);
    }
}

type SketchEvent<E> = E & {at?: Point2D};



export { SketchComponent, ControlWidget, Knob, SketchEvent }
