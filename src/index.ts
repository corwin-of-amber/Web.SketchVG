import { Polyline, Oval, Point2D, Shape2D, Parallelogram } from './shape';
import { SketchComponent } from './components/sketch';
import { ShapeComponent, PolylineComponent, OvalComponent, ParallelogramComponent, ShapeComponentBase } from './components/shape';
import './editor.css';


class SketchEditor {
    sketch: SketchComponent
    shapes: ShapeComponent[]
    selection: Set<ShapeComponent> = new Set

    constructor(svg: JQuery<SVGSVGElement>) {
        this.sketch = new SketchComponent(svg);
        this.shapes = [];
        this._bindEvents();
    }

    _bindEvents() {
        this.sketch.on('mousedown', (ev) => {
            if (ev.altKey && this.selection.size > 0) {
                for (let p of this.selection) {
                    if (p.edit(ev.at)) break;
                }
            }
            else {
                this.deselectAll();
            }
        });
    }

    newShape(shape: Shape2D): ShapeComponent {
        if (shape instanceof Polyline) return this.newPolyline(shape);
        else if (shape instanceof Oval) return this.newOval(shape);
        else if (shape instanceof Parallelogram) return this.newParallelogram(shape);
        else throw new Error(`unrecognized shape for editing: '${shape.constructor.name}'`);
    }

    newPolyline(shape: Polyline) {
        return this.add(new PolylineComponent(this.sketch, shape));
    }

    newOval(shape: Oval) {
        return this.add(new OvalComponent(this.sketch, shape));
    }

    newParallelogram(shape: Parallelogram) {
        return this.add(new ParallelogramComponent(this.sketch, shape));
    }

    add<T extends ShapeComponent>(shape: T) {
        shape.on('click', (ev) => {
            if (this.selection.has(shape)) shape.hit(ev.at);
            else this.select(shape, ev.at); 
        });
        this.shapes.push(shape);
        return shape;
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