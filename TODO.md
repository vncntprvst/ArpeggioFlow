* Add stretched shapes to the extended CAGED system.
* Add selector for system to use. 
* Flow from one chord to another:
    - Select closest chord tone (unison, 1/2 step, \w step).
    - Keep in direction: keep ascending or descending.
* Move frets one down on chord diagram (without changing position).  
* Display small chords diagrams over each chord name.
* Alternative exercise: Start each chord on a specific chord tone - Root, 3rd, 5th, 7th.
* Create licks by selecting less or more notes for each measure, with sustained or silent notes. 

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
