import { Polyline, Oval, Point2D, Shape2D, Parallelogram } from './shape';
import { SketchComponent } from './components/sketch';
import { ShapeComponent, PolylineComponent, OvalComponent, ParallelogramComponent, ShapeComponentBase } from './components/shape';
import './editor.scss';


class SketchEditor {
    sketch: SketchComponent
    shapes: ShapeComponent[]
    selection: Set<ShapeComponent> = new Set

    constructor(svg: SVGSVGElement | JQuery<SVGSVGElement>) {
        this.sketch = new SketchComponent(svg);
        this.shapes = [];
        this._bindEvents();
    }

    _bindEvents() {
        this.sketch.on('mousedown', (ev) => {
            if (ev.$ev.altKey && this.selection.size > 0) {
                for (let p of this.selection) {
                    if (p.edit(ev.at)) break;
                }
            }
            else {
                this.deselectAll();
            }
        });
    }


    add<T extends ShapeComponent | Shape2D>(shape: T): (T extends ShapeComponent ? T : ShapeComponent) {
        let component = ShapeComponent.promote(shape, this.sketch);
        component.on('click', (ev) => {
            if (this.selection.has(component)) component.hit(ev.at);
            else this.select(component, ev.at); 
        });
        this.shapes.push(component);
        return component as any;
    }

    has(shape: ShapeComponent | Shape2D) {
        return this.shapes.some(s => s == shape ||
            (s instanceof ShapeComponentBase && s.shape == shape));
    }

    remove(shape: ShapeComponent | Shape2D) {
        let idx = this.shapes.findIndex(s => s == shape ||
            (s instanceof ShapeComponentBase && s.shape == shape));
        if (idx >= 0) {
            this.shapes[idx].remove();
            this.shapes.splice(idx, 1);
        }
    }

    select(component: ShapeComponent, at?: Point2D) {
        this.deselectAll();
        component.select(at);
        this.selection.add(component);
    }

    deselectAll() {
        for (let c of this.selection) c.deselect();
        this.selection.clear();
    }
}


export { SketchEditor }