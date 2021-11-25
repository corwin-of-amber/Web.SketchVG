import { Point2D } from '../shape';
import $svg from '../dom';
import { ShapeComponentBaseWithAttrs } from './shape';
import { Knob } from './sketch';



type StraightRule = {
    axis: 'x' | 'y',  // determines the axis of coordinate `at`;
    at: number,       // meaning: axis:'x' is a *vertical* rule, axis:'y' is *horizontal* (isn't math fun)
    role?: string
};


class StraightRuleComponent extends ShapeComponentBaseWithAttrs<StraightRule> {

    render() {
        return $svg('path').addClass(['rule']).attr(this._attrs());
    }

    _attrs() {
        var o = this.shape.at;
        switch (this.shape.axis) {
            case 'x': return {d: `M${o},-100 L${o},100`};
            case 'y': return {d: `M-100,${o} L100,${o}`};
        }
    }

    select(at: Point2D = {x: 0, y: 0}): void {
        var knob = new Knob({...Point2D.xy(at), [this.shape.axis]: this.shape.at});
        knob.on('move', (ev) => {
            this.shape.at = ev.at[this.shape.axis];
            this.update();
        });
        this.onto.addControl(knob);
        this.knobs = [knob];
    }

    edit(at: Point2D): boolean {
        if (this.knobs) { this.knobs[0].move(at); return true; }
        else return false;
    }
}



export { StraightRule, StraightRuleComponent }