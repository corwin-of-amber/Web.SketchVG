import { EventEmitter } from 'events';
import $ from 'jquery';

import $svg from '../dom';
import { Point2D, Polyline, Vertex, Side, BezierSide,
         Direction, Oval, Parallelogram } from '../shape';
import { SketchComponent, SketchEvent, Knob } from './sketch';

import fp = Point2D.fp;



abstract class ShapeComponent extends EventEmitter {
    abstract select(at?: Point2D): void
    abstract deselect(): void
    abstract hit(at: Point2D): boolean
    abstract edit(at: Point2D): boolean
}

interface ShapeComponent {
    on(type: 'click', h: (ev: SketchEvent<JQuery.ClickEvent>) => void): this;
    on(type: 'change', h: (t: this) => void): this;
}


/**
 * Abstract base class for shape components with constructor.
 */
abstract class ShapeComponentBase<Shape> extends ShapeComponent {
    onto: SketchComponent
    shape: Shape
    elements: JQuery<SVGElement>
    knobs: Knob[]

    constructor(onto: SketchComponent, shape: Shape) {
        super();
        this.onto = onto;
        this.shape = shape;
        this.elements = this._render();
    }

    abstract render(): JQuery<SVGElement>

    deselect(): void {
        if (this.knobs) this.knobs.forEach(k => this.onto.removeControl(k));
        this.knobs = undefined;        
    }

    hit(at: Point2D): boolean  { return false; }
    edit(at: Point2D): boolean { return false; }

    update() {
        this.emit('change');
    }

    /**
     * Low-level render function, calls `render()` and places result on drawing area.
     * @returns rendered SVG elements
     */
    _render() {
        return this.onto.addShape(this.render())
            .on('click', (ev) => this.emit('click', this.onto._mkMouseEvent(ev)));
    }
}


abstract class ShapeComponentBaseWithAttrs<Shape> extends ShapeComponentBase<Shape> {
    update() {
        for (let e of this.elements) {
            $(e).attr(this._attrs());
        }
        super.update();
    }

    abstract _attrs(): {}
}


class PolylineComponent extends ShapeComponentBase<Polyline> {
    knobs: Knob[]
    spot: SpotKnob<Side>
    addDir: Direction = Direction.FORWARD

    render() {
        return $svg('path').attr('d', this.shape.toPath());
    }

    update() {
        for (let e of this.elements) {
            $(e).attr('d', this.shape.toPath());
        }
        this.emit('change');
    }

    select() {
        this.knobs = this.shape.vertices.map(u => this._mkknob(u)).concat(
            ...[...this.shape.sides].map(s => this._mkctrls(s)));
    }

    deselect() {
        if (this.spot) this.onto.removeControl(this.spot);
        if (this.knobs) this.knobs.forEach(k => this.onto.removeControl(k));
        this.knobs = this.spot = undefined;
    }

    _mkknob(u: Vertex) {
        var knob = new VertexKnob(u.at);
        this.onto.addControl(knob);
        knob.on('move', ({at}) => {
            this.unhit();  /** @todo only if affected */
            u.at = at; this.update();
        });
        knob.on('mousedown', (ev) => {
            if (ev.altKey) {
                this.unhit();  /** @todo only if affected */
                this.onto.removeControl(knob);
                this.shape.removeVertex(u); this.update();
            }
            else {
                this.unhit(); this.addDir = Direction.BACKWARD;
            }
        });
        return knob;
    }

    _mkctrl(side: Side, at: Point2D, knob?: Knob) {
        var bside = side instanceof BezierSide ? side
            : this.shape.replaceSide(side, new BezierSide([at]));
        if (!knob) {
            this.onto.addControl(knob = new Knob(at, true, ['ephemeral']));
        }
        knob.on('move', ({at}) => {
            bside.ctrl[0] = at;
            this.update();
            if (this.spot && this.spot !== knob) this.unhit();
        });
        return knob;
    }

    _mkctrls(side: Side) {
        var at = side instanceof BezierSide ? side.ctrl : [];
        return at.map(p => this._mkctrl(side, p));
    }

    _mkspot(at: Point2D, side: Side) {
        var knob = new SpotKnob(at, side, !(side instanceof BezierSide),
                                ['ephemeral']);
        this.onto.addControl(knob);
        var moveh = ({at}) => {
            if (this.spot === knob) this.spot = undefined;
            knob.removeListener('move', moveh)
            this.knobs.push(this._mkctrl(side, at, knob));
        };
        knob.on('move', moveh);
        return knob;
    }

    hit(at: Point2D) {
        this.unhit();

        let h = this.shape.hitTest(at);
        if (h) {
            var knob = this._mkspot(h.at, h.side);
            this.onto.addControl(knob);
            this.spot = knob;
            this.addDir = knob.residesOn.getDirection(h.at);
        }
        return !!h;
    }

    unhit() {
        if (this.spot) this.onto.removeControl(this.spot);
        this.spot = undefined;
    }

    edit(at: Point2D) {
        var u = this.spot ? this.shape.splitSide(this.spot.residesOn, at, this.addDir)
                          : this.shape.createVertex(at, this.addDir);
        this.spot?.hide?.();
        this.knobs.push(this._mkknob(u));
        this.update();
        return true;
    }
}


class OvalComponent extends ShapeComponentBaseWithAttrs<Oval> {

    render() {
        return $svg('ellipse').attr(this._attrs())
    }

    _attrs() { 
        return {cx: this.shape.center.x, cy: this.shape.center.y, 
                rx: this.shape.radii.x,  ry: this.shape.radii.y};
    }

    select(at?: Point2D) {
        var cknob = new Knob(this.shape.center), rx = this.shape.radii.x, ry = this.shape.radii.y,
            xknob = new Knob({x: this.shape.center.x + rx, y: this.shape.center.y}),
            yknob = new Knob({x: this.shape.center.x, y: this.shape.center.y - ry});
        this.knobs = [cknob, xknob, ...(rx == ry ? [] : [yknob])];
        for (let knob of this.knobs) {
            this._addKnob(knob);
        }
        if (at) this.hit(at);
    }

    _addKnob(knob) {
        knob.on('move', () => this._updateFromKnobs());
        knob.on('mousedown', (ev) => {
            if (ev.altKey && this.knobs.length == 3 && knob !== this.knobs[0]) {
                this.onto.removeControl(knob);
                this.knobs = this.knobs.filter(x => x !== knob);
                this._updateFromKnobs();
            }
        });
        this.onto.addControl(knob);
    }

    _updateFromKnobs() {
        var [cknob, xknob, yknob] = this.knobs;
        this.shape.center = cknob.at;

        this.shape.radii.x = fp(xknob.at).distanceTo(fp(cknob.at))[0];
        this.shape.radii.y = yknob ? fp(yknob.at).distanceTo(fp(cknob.at))[0]
                                   : this.shape.radii.x;

        this.update();
    }

    hit(at: Point2D) {
        if (this.knobs.length == 2) {
            var {at: kat} = this.shape.hitTest(at);
            this.knobs[1].move(kat);
        }
        return true;
    }

    edit(at: Point2D) {
        if (this.knobs.length == 2) {
            var knob = new Knob(at);
            this.knobs.push(knob);
            this._addKnob(knob);
            this._updateFromKnobs();
            return true;
        }
        else return false;
    }    
}


class ParallelogramComponent extends ShapeComponentBaseWithAttrs<Parallelogram> {
 
    render() {
        return $svg('path').attr(this._attrs())
    }

    _attrs() { 
        return {d: this.shape.toPath()};
    }

    select(at?: Point2D) {
        var [p0, p1, , p2] = this.shape.vertices,
            knobs = [p0, p1, p2].map(p => new Knob(p));
        for (let knob of knobs) {
            knob.on('move', () => {
                this.shape.fromTriage(knobs.map(k => k.at) as [Point2D, Point2D, Point2D]);
                this.update();
            });
            this.onto.addControl(knob);
        }
        this.knobs = knobs;
    }
}


/**
 * A knob representing a vertex in a PolylineComponent.
 */
class VertexKnob extends Knob {

}

/**
 * A knob used to highlight a point along a shape's outline.
 */
class SpotKnob<Obj> extends Knob {
    residesOn: Obj

    constructor(at: Point2D, residesOn: Obj, mobile?: boolean, cssClasses?: string[]) {
        super(at, mobile, cssClasses);
        this.residesOn = residesOn;
    }
}



export { ShapeComponent, ShapeComponentBase, ShapeComponentBaseWithAttrs,
         PolylineComponent, OvalComponent, ParallelogramComponent }
