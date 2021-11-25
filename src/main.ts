import $ from 'jquery';
import EJSON from 'ejson';
import { Polyline } from './shape';
import { SketchEditor } from '.';


function main() {
    var shape = new Polyline();
    shape.createVertex({x: -75, y: 75});
    shape.createVertex({x: -45, y: 25});
    shape.createVertex({x:   0, y: 50});
    //shape.weld();

    shape = load() || shape;

    var editor = new SketchEditor($<SVGSVGElement>('#panel svg')),
        p = editor.newPolyline(shape);

    window.addEventListener('beforeunload', () => save(shape));

    Object.assign(window, {p, EJSON});
}

function load() {
    var l = localStorage['editing-shape'];
    return l && EJSON.parse(l);
}

function save(p: any) {
    if (p)
        localStorage['editing-shape'] = EJSON.stringify(p);
}


$(main);