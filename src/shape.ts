import assert from 'assert';
import _ from 'lodash';
import EJSON from 'ejson';
import Flatten from '@flatten-js/core';
import { Bezier } from "bezier-js";



type Point2D = {x: number, y: number};

namespace Point2D {
    export function fp(p: Point2D) { return Flatten.point(p.x, p.y); }
    export function fv(p: Point2D) { return Flatten.vector(p.x, p.y); }
    export function xy(p: Point2D) { return {x: p.x, y: p.y}; }
    export function scale(p: Point2D, scale: number) {
        return {x: p.x * scale, y: p.y * scale};
    }
    export const O = {x: 0, y: 0};
}

import xy = Point2D.xy;
import fp = Point2D.fp;


class Shape2D { }


class Polyline extends Shape2D {
    vertices: Vertex[] = []

    createVertex(at: Point2D, end = Direction.FORWARD, side?: Side) {
        var u = new Vertex(at);
        switch (end) {
        case Direction.FORWARD: this.addVertex(u, side); break;
        case Direction.BACKWARD: this.insertVertexBefore(u, null, side); break;
        default: assert(false);
        }
        return u;
    }

    addVertex(u: Vertex, side?: Side) {
        var after = this.vertices.slice(-1)[0];
        this.vertices.push(u);
        if (after) this.addSide(after, u, side);
    }

    weld(side?: Side) {
        var u = this.vertices.slice(-1)[0],
            v = this.vertices[0];
        if (u !== v) this.addSide(u, v, side);
    }

    toPath() {
        var vs = this.vertices;
        if (vs.length == 0) return "";

        return [`M${vs[0].toPath()}`,
                ...vs.map(u => u.sides[1]).filter(l => l).map(l => l.toPath()),
                vs[0].sides[0] ? 'z' : '']
            .join('');
    }

    addSide(u: Vertex, v: Vertex, side: Side = new StraightSide) {
        side.endpoints = [u, v];
        u.sides[1] = side;
        v.sides[0] = side;
        return side;
    }

    get sides() { return this.itersides(); }
    *itersides() {
        for (let v of this.vertices)
            if (v.sides[0]) yield v.sides[0];
    }

    hitTest(at: Point2D) {
        return _.minBy([...this.sides].map(l => ({side:l, ...l.hitTest(at)}))
                       .filter(x => x.at), h => h.dist)
    }

    insertVertexAfter(u: Vertex, after: Vertex, side?: Side) {
        if (after) {
            var idx = this.vertices.indexOf(after), existingSide: Side;
            if(idx >= 0) {
                if (existingSide = after.sides[1]) {
                    existingSide.endpoints[0] = u; u.sides[1] = existingSide;
                }
                this.vertices.splice(idx + 1, 0, u);
                this.addSide(after, u, side);
            }
            else throw Error("vertex is not on shape");
        }
        else this.addVertex(u, side);
    }

    insertVertexBefore(u: Vertex, before: Vertex, side?: Side) {
        if (before) {
            var idx = this.vertices.indexOf(before), existingSide: Side;
            if(idx >= 0) {
                if (existingSide = before.sides[0]) {
                    existingSide.endpoints[1] = u; u.sides[0] = existingSide;
                }
                this.vertices.splice(idx, 0, u);
                this.addSide(u, before, side);
            }
            else throw Error("vertex is not on shape");
        }
        else {
            var v = this.vertices[0];
            this.vertices.unshift(u);
            if (v) this.addSide(u, v, side);
        }
    }

    removeVertex(u: Vertex) {
        var idx = this.vertices.indexOf(u);
        if (idx >= 0) {
            var [before, after] = u.sides;
            if (before) {
                if (after)
                    (before.endpoints[1] = after.endpoints[1]).sides[0] = before;
                else
                    before.endpoints[0].sides[1] = null;
            }
            else if (after) {
                after.endpoints[1].sides[0] = null;
            }
            this.vertices.splice(idx, 1);
        }
    }

    splitSide(side: Side, at: Point2D, end = Direction.FORWARD, newSide?: Side) {
        var u = new Vertex(at);
        switch (end) {
        case Direction.FORWARD:
            this.insertVertexAfter(u, side.endpoints[0], newSide); break;
        case Direction.BACKWARD:
            this.insertVertexBefore(u, side.endpoints[1], newSide); break;
        default: assert(false);
        }
        return u;
    }

    replaceSide<S extends Side>(side: Side, newSide: S) {
        side.endpoints[0].sides[1] = side.endpoints[1].sides[0] = newSide;
        newSide.endpoints = side.endpoints.slice() as [Vertex, Vertex];
        return newSide;
    }

    /* Whole-shape transforms */

    scale(scale: number | Point2D, epicenter?: Point2D) {
        var o = epicenter || this.vertices[0]?.at || Point2D.O;
        if (typeof scale === 'number') scale = {x: scale, y: scale};
        var m = new Flatten.Matrix().translate(-o.x, -o.y)
                                    .scale(scale.x, scale.y)
                                    .translate(o.x, o.y);

        for (let obj of [...this.vertices, ...this.sides])
            obj.transform(m);
    }

    /* EJSON */
    typeName() { return Polyline.name; }
    toJSONValue() {
        return {
            vertices: this.vertices.map(u => EJSON.toJSONValue(u)),
            sides: this.vertices.map(u => EJSON.toJSONValue(u.sides[0]))
        };
    }
    static fromJSONValue(v: {vertices: Vertex[], sides: Side[]}) {
        v.vertices = v.vertices.map(EJSON.fromJSONValue);
        v.sides    = v.sides   .map(EJSON.fromJSONValue);
        var p = new Polyline();
        for (let [u, side] of _.zip(v.vertices, v.sides))
            p.addVertex(u, side);
        if (v.sides[0]) p.weld(v.sides[0]);
        return p;
    }
}

EJSON.addType(Polyline.name, Polyline.fromJSONValue);

enum Direction { FORWARD, BACKWARD };


class Vertex {
    at: Point2D
    sides: [Side, Side]
    constructor(at: Point2D) {
        this.at = at;
        this.sides = [null, null];  // lone
    }

    toPath() { return `${this.at.x} ${this.at.y}`; }

    transform(m: Flatten.Matrix) { this.at = fp(this.at).transform(m); }

    /* EJSON */
    typeName() { return Vertex.name; }
    toJSONValue() { return xy(this.at); }
    static fromJSONValue(v: Point2D) { return new Vertex(v); }
}

EJSON.addType(Vertex.name, Vertex.fromJSONValue);


abstract class Side {
    endpoints: [Vertex, Vertex]
    toPath(includeStart = false) {
        return (includeStart ? this.endpoints[0].toPath() : '') + this._cmd();
    }
    abstract _cmd(): string
    abstract hitTest(at: Point2D): {dist: number, at: Point2D};
    abstract getDirection(toward: Point2D): Direction;
    abstract transform(m: Flatten.Matrix): void;
}


class StraightSide extends Side {
    _cmd() { return `L${this.endpoints[1].toPath()}`; }
    hitTest(at: Point2D) {
        let [d, seg] = fp(at).distanceTo(this._segment);
        return {dist: d, at: seg.pe};
    }
    get _segment() {
        let [p1, p2] = this.endpoints;
        return Flatten.segment(p1.at.x, p1.at.y, p2.at.x, p2.at.y);
    }

    /**
     * If point is closer to the start, Direction.FORWARD.
     * If closer to end, Direction.BACKWARD.
     * @param toward test point
     */
    getDirection(toward: Point2D) {
        var seg = this._segment, q = Flatten.point(toward.x, toward.y),
            [d0, d1] = seg.vertices.map(p => p.distanceTo(q)[0]);
        return d0 < d1 ? Direction.FORWARD : Direction.BACKWARD;
    }

    transform() { }

    /* EJSON */
    typeName() { return StraightSide.name; }
    toJSONValue() { return {}; }
    static fromJSONValue() { return new StraightSide; }
}

EJSON.addType(StraightSide.name, StraightSide.fromJSONValue);


class BezierSide extends Side {
    ctrl: Point2D[]
    constructor(ctrl: Point2D[]) {
        super();
        assert(ctrl.length == 1);
        this.ctrl = ctrl;
    }
    _cmd() { 
        var [c1] = this.ctrl, ep = this.endpoints[1];
        return `Q${c1.x} ${c1.y}, ${ep.toPath()}`;
    }
    hitTest(at: Point2D) {
        var p = this._curve.project(at),
            d = fp(p).distanceTo(fp(at));
        return {dist: d[0], at: xy(p)};
    }

    get _curve() {
        var [p0, p1] = this.endpoints;
        return new Bezier(p0.at, this.ctrl[0], p1.at);
    }

    getDirection(toward: Point2D) { return Direction.FORWARD; }

    transform(m: Flatten.Matrix) {
        this.ctrl = this.ctrl.map(p => fp(p).transform(m));
    }

    /* EJSON */
    typeName() { return BezierSide.name; }
    toJSONValue() { return {ctrl: this.ctrl.map(xy)}; }
    static fromJSONValue(v: {ctrl: Point2D[]}) {
        return new BezierSide(v.ctrl);
    }
}

EJSON.addType(BezierSide.name, BezierSide.fromJSONValue);


class Oval extends Shape2D {
    center: Point2D
    radii:  Point2D

    constructor(center: Point2D = Point2D.O,
                radii:  Point2D = {x: 1, y: 1}) {
        super();
        this.center = center;
        this.radii = radii;
    }

    get _circle() {
        return new Flatten.Circle(fp(this.center), this.radii.x);
    }

    hitTest(at: Point2D) {
        let [d, seg] = fp(at).distanceTo(this._circle);
        return {dist: d, at: seg.pe};
    }
}


/**
 * A convenient generalization of a rectangle.
 */
class Parallelogram extends Shape2D {
    origin: Point2D
    vectors: [Point2D, Point2D]

    constructor(origin: Point2D = Point2D.O,
                vectors: [Point2D, Point2D] = [{x: 1, y: 0}, {x: 0, y: 1}]) {
        super();
        this.origin = origin;
        this.vectors = vectors;
    }

    toPath() {
        var vs = this.vertices, xy = (p: Point2D) => `${p.x} ${p.y}`;
        return `M${vs.map(xy).join(" L")}Z`;
    }

    toPolyline() {
        var poly = new Polyline();
        for (let v of this.vertices) poly.createVertex(v);
        poly.weld();
        return poly;
    }

    get _def(): [Flatten.Point, [Flatten.Vector, Flatten.Vector]] {
        return [Point2D.fp(this.origin), <any/*sorry*/>this.vectors.map(Point2D.fv)]; 
    }

    get vertices() {
        let [p, [v1, v2]] = this._def, v3 = v1.add(v2);
        return [p, ...[v1, v3, v2].map(v => p.translate(v))]
    }

    fromTriage(p: [Point2D, Point2D, Point2D]) {
        this.origin = p[0];
        this.vectors = [p[1], p[2]].map(q => Point2D.fv(q).subtract(Point2D.fv(p[0]))) as
                       [Flatten.Vector, Flatten.Vector];
        return this;
    }
}



export { Point2D, Shape2D, Polyline, Vertex, Side, StraightSide, BezierSide,
         Direction, Oval, Parallelogram }