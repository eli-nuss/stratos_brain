# Excalidraw Style Reference

## Color Palette (Open Colors)
Excalidraw uses the Open Colors scheme with 13 colors, each with 10 brightness levels (0-9):
- Canvas background: lightest value (0)
- Strokes: darkest value (9)
- Element background fill: 6th or 7th value

### Open Colors Palette
Based on the screenshot, the colors are:
- Gray: #f8f9fa, #f1f3f5, #e9ecef, #dee2e6, #ced4da, #adb5bd, #868e96, #495057, #343a40, #212529
- Red: #fff5f5, #ffe3e3, #ffc9c9, #ffa8a8, #ff8787, #ff6b6b, #fa5252, #f03e3e, #e03131, #c92a2a
- Pink: #fff0f6, #ffdeeb, #fcc2d7, #faa2c1, #f783ac, #f06595, #e64980, #d6336c, #c2255c, #a61e4d
- Grape: #f8f0fc, #f3d9fa, #eebefa, #e599f7, #da77f2, #cc5de8, #be4bdb, #ae3ec9, #9c36b5, #862e9c
- Violet: #f3f0ff, #e5dbff, #d0bfff, #b197fc, #9775fa, #845ef7, #7950f2, #7048e8, #6741d9, #5f3dc4
- Indigo: #edf2ff, #dbe4ff, #bac8ff, #91a7ff, #748ffc, #5c7cfa, #4c6ef5, #4263eb, #3b5bdb, #364fc7
- Blue: #e7f5ff, #d0ebff, #a5d8ff, #74c0fc, #4dabf7, #339af0, #228be6, #1c7ed6, #1971c2, #1864ab
- Cyan: #e3fafc, #c5f6fa, #99e9f2, #66d9e8, #3bc9db, #22b8cf, #15aabf, #1098ad, #0c8599, #0b7285
- Teal: #e6fcf5, #c3fae8, #96f2d7, #63e6be, #38d9a9, #20c997, #12b886, #0ca678, #099268, #087f5b
- Green: #ebfbee, #d3f9d8, #b2f2bb, #8ce99a, #69db7c, #51cf66, #40c057, #37b24d, #2f9e44, #2b8a3e
- Lime: #f4fce3, #e9fac8, #d8f5a2, #c0eb75, #a9e34b, #94d82d, #82c91e, #74b816, #66a80f, #5c940d
- Yellow: #fff9db, #fff3bf, #ffec99, #ffe066, #ffd43b, #fcc419, #fab005, #f59f00, #f08c00, #e67700
- Orange: #fff4e6, #ffe8cc, #ffd8a8, #ffc078, #ffa94d, #ff922b, #fd7e14, #f76707, #e8590c, #d9480f

## Font
- Primary hand-drawn font: **Virgil** (succeeded by **Excalifont** for improved legibility)
- Font family: 'Virgil', 'Segoe UI Emoji', cursive

## Visual Style
- Hand-drawn/sketchy appearance
- Rounded corners with slight imperfections
- Light canvas background (#f8f9fa or similar)
- Dark strokes (#1e1e1e or similar)
- Soft shadows
- Slightly rough edges on shapes

## Key CSS Variables
```css
--color-primary: #6965db (violet/indigo)
--color-primary-darker: #5b57d1
--color-primary-darkest: #4a47a3
--color-primary-light: #8b87e0
```

## Recommended Colors for Diagrams
For treemaps and charts, use the 6th brightness level:
- Red: #fa5252
- Pink: #e64980
- Grape: #be4bdb
- Violet: #7950f2
- Indigo: #4c6ef5
- Blue: #228be6
- Cyan: #15aabf
- Teal: #12b886
- Green: #40c057
- Lime: #82c91e
- Yellow: #fab005
- Orange: #fd7e14
