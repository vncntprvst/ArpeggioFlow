
* Add two more constraints to the arpeggio exercise generation:
    - the notes have to stay within the first 16 frets, as displayed on the fretboard diagram. Meaning if the notes ascend beyond that, then they should reverse direction and go down. 
    - the notes for the root chord should be within the scale for that chord outlined in the scale diagram on top of the page. All the other notes for the other chords can be outside that scale, but the root chord notes should be within that scale. That means we need to know which notes are in the scale for that chord, so drawing those notes first, then proceeding to the other notes. That could mean that notes for the measures located before the root chord measure may be assigned going backward from the root chord measure (to preserve the flow direction) 
<!-- * Move frets one down on chord diagram (without changing position).   -->
* Display small chords diagrams over each chord name.
* Alternative exercise: Start each chord on a specific chord tone - Root, 3rd, 5th, 7th.
* Create licks by selecting less or more notes for each measure, with sustained or silent notes. 

* [X] Flow from one chord to another:
    - Select closest chord tone (unison, 1/2 step, \w step).
    - Keep in direction: keep ascending or descending.

Now we need to update that function so that there's an actual flow from one chord to another, with three constraints:
    - the progression for a given chord should be ascending or descending. When hitting the highest note (in pitch), reverse direction, and vice-versa.
    - for each measure except the first, the first note should be the closest chord tone from the last note from the previous measure (unison, 1/2 step, or whole step).
    - Keep in direction from one measure to the next: keep ascending or descending.

We may need to create auxiliary functions for that. 

In each measure, the notes should be either ascending or descending the arpeggio for that measure's chord, and reverse direction when they reach the highest (or lowest) note. THe direction should continue onto the next measure. Going from one measure to the next, we find the closest chord tone (unison, 1/2 step, \w step). The very first note is drawn randomly from the chord's arpeggio notes. 
Right now the notes seem restricted to a narrow range. They should go higher and lower. And it looks like when reaching the supposed highest note (which is not that high), then they jump directly to the lowest note (which is not that low), instead of reversing direction. 

* [x] Fix issue of scale diagram width 
* [X] Position of background scale area is wrong. Root is not always at "0" on position. 
* [X] Add extended CAGED system to conform to Chris' system
    Forked fretboard.js and modify + extend CAGED system to conform to Chris' system, and include stretch patterns. See: 
    https://github.com/moonwave99/fretboard.js/blob/d0afe2d7bc8e8beb397d3269d78567dcf3546523/src/fretboardSystem/systems/systems.ts#L28 
    e.g., 
        {
            box: [
                '-6-71',
                '-34-5',
                '71-2-',
                '-5-6-',
                '-2-34',
                '-6-71'
            ],
            baseChroma: getChroma('G#'),
            baseOctave: 2
        },        

    becomes 

        {
            box: [
                '6-71-',
                '34-5-',
                '1-2--',
                '5-6-7',
                '2-34-',
                '6-71-'
            ],
            baseChroma: getChroma('G#'),
            baseOctave: 2
        },        

    Tried it, it failed (colors and positions are wrong). Instead, used the cagedShapes.js code. It works. 
    But then the highlight bow is shifted. And notes outside the box are not greyed out.
    So created a bew function computeDotClasses to compute the classes for each dot.

* [x] Add stretched shapes to the extended CAGED system.
* [x] Add selector for system to use. 