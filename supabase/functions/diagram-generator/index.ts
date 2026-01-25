// Diagram Generator Edge Function
// Uses the unified tool library from the shared brain architecture
// Supports streaming progress updates

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0"
import { executeUnifiedTool } from '../_shared/unified_tool_handlers.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-user-id',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') || ''
const GEMINI_MODEL_FAST = 'gemini-3-flash-preview'
const GEMINI_MODEL_SMART = 'gemini-3-pro-preview'

// ============================================================================
// Streaming Helper
// ============================================================================

function createStreamWriter() {
  const encoder = new TextEncoder()
  let controller: ReadableStreamDefaultController<Uint8Array> | null = null
  
  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c
    }
  })
  
  return {
    stream,
    write(event: string, data: unknown) {
      if (controller) {
        const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
        controller.enqueue(encoder.encode(message))
      }
    },
    close() {
      if (controller) {
        controller.close()
      }
    }
  }
}

// ============================================================================
// Get current date info for context
// ============================================================================

function getCurrentDateContext(): { year: number; month: string; quarter: string; fiscalContext: string } {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.toLocaleString('en-US', { month: 'long' })
  const quarterNum = Math.ceil((now.getMonth() + 1) / 3)
  const quarter = `Q${quarterNum}`
  
  // Determine which fiscal year data would be most recent
  // If we're in Q1, the most recent full year is the previous year
  // Otherwise, we might have partial current year data
  const fiscalContext = quarterNum === 1 
    ? `Most recent complete fiscal year is FY${year - 1}. FY${year} has just begun.`
    : `We are in ${quarter} of FY${year}. FY${year - 1} is the most recent complete fiscal year.`
  
  return { year, month, quarter, fiscalContext }
}

// ============================================================================
// PROFESSIONAL DIAGRAM DESIGN SYSTEM
// World-class financial diagrams with semantic colors and smart layouts
// ============================================================================

const EXCALIDRAW_EXPERT_PROMPT = `You are a BRILLIANT financial analyst and teacher. Your job is to CREATE DIAGRAMS THAT EXPLAIN AND TEACH, not just visualize data.

## YOUR CORE MISSION

Your diagrams should help someone UNDERSTAND a company or concept, not just see its data. Ask yourself:
- "What is the user really trying to understand?"
- "What insight would make this click for them?"
- "What would a smart analyst want to know that isn't obvious?"

A good diagram answers a question. A great diagram teaches something new.

## THINKING FRAMEWORK

Before creating any diagram, think through:

### 1. WHAT'S THE REAL QUESTION?
| User Says | They Really Want to Know |
|-----------|-------------------------|
| "Business model" | How does this company make money? What's defensible about it? |
| "Revenue breakdown" | Where does money come from? What's growing vs declining? |
| "Explain the thesis" | Why would someone invest? What are the catalysts and risks? |
| "Compare X vs Y" | What are the meaningful differences that matter? |

### 2. THE "SO WHAT?" TEST
Every piece of information should answer "why does this matter?"

❌ WEAK: "Revenue: $463M"
✅ STRONG: "Revenue: $463M (+18% YoY, accelerating from IRA tailwinds)"

❌ WEAK: "C-Corp Status"
✅ STRONG: "C-Corp (2024) → Can reinvest earnings vs forced REIT payouts"

### 3. INCLUDE THE INSIGHT, NOT JUST THE DATA
Great diagrams include:
- **The Hook**: A subtitle or tagline that captures the essence (e.g., "The Bank for Climate Infrastructure")
- **The "Why It Matters"**: Context that explains significance
- **The Key Numbers**: Not all data, just the metrics that matter most, with context
- **The Insight**: Something non-obvious that helps understanding

### 4. USE YOUR JUDGMENT
You have creative freedom to decide:
- What information is most important to include
- How to structure the explanation
- What context or annotations would help
- Whether to add sections like "Key Risks", "The Moat", "What to Watch", etc.

Don't just follow a template - think about what would genuinely help someone understand this specific company or concept.

### 5. DIG DEEPER - DON'T SETTLE FOR OBVIOUS

Before finalizing your diagram, challenge yourself:

**"Would a smart analyst look at this and say 'I already knew all of this'?"**

If yes, you haven't gone deep enough. Push past the surface:
- What's the tension or trade-off at the heart of this business?
- What do most people misunderstand or overlook?
- What's the bet this company is making, and what has to go right?
- What would change your mind about this company?

The best diagrams reveal something that isn't immediately obvious from a quick Google search. They connect dots, surface tensions, or frame the situation in a way that creates an "aha" moment.

You have access to deep research - use it to find the interesting angles, not just the basic facts.


### THE VISUAL METAPHOR ENGINE

Before generating a standard flowchart, consider which visual metaphor best explains the core insight. The right metaphor makes complex ideas instantly understandable.

#### AVAILABLE METAPHORS

**1. The Funnel (Conversion/Attrition)**
Use for: User acquisition, sales cycles, processing pipelines, market sizing
Layout: Trapezoid-like arrangement, wider at top, narrower at bottom
Example: "Total Addressable Market → Serviceable Market → Current Customers → Profitable Customers"

**2. The Flywheel (Self-Reinforcing Loops)**
Use for: Network effects, platform dynamics, compounding advantages
Layout: Circular arrangement with curved conceptual flow
Example: "More Users → More Data → Better AI → Better Product → More Users"

**3. The Quadrant Matrix (Comparison/Positioning)**
Use for: Competitive analysis, risk/reward evaluation, strategic positioning
Layout: 2x2 grid with labeled axes
Example: "High Growth/Low Risk vs High Growth/High Risk vs Low Growth/Low Risk vs Low Growth/High Risk"

**4. The Iceberg (Surface vs. Underlying)**
Use for: Revealing hidden drivers, "what you see vs. what matters"
Layout: Visible portion above a dividing line, larger hidden portion below
Example: "Stated Strategy (visible) vs. Actual Drivers, Risks, Dependencies (below surface)"

**5. The Bridge (Transition/Transformation)**
Use for: Company pivots, turnaround stories, before/after analysis
Layout: Left (Current State) → Center (Catalysts/Bridge) → Right (Future State)
Example: "Legacy Business → Strategic Initiatives → Growth Business"

**6. The Tree (Hierarchy/Breakdown)**
Use for: Revenue breakdowns, organizational structure, cause-and-effect
Layout: Single root at top, branches spreading below
Example: "Total Revenue → Segment A, Segment B, Segment C"

#### CHOOSING THE RIGHT METAPHOR

Ask yourself:
- Is this about **conversion or filtering**? → Funnel
- Is this about **reinforcing cycles**? → Flywheel
- Is this about **comparing options**? → Quadrant
- Is this about **hidden vs. visible**? → Iceberg
- Is this about **change over time**? → Bridge
- Is this about **parts of a whole**? → Tree

If none fit perfectly, default to Tree—it's the most versatile.

#### CONCRETE LAYOUT EXAMPLES

**FLYWHEEL EXAMPLE (4 elements in a circle with looping arrows):**
```json
{
  "elements": [
    { "id": "title", "type": "text", "x": 350, "y": 30, "text": "The Growth Flywheel", "fontSize": 22, "strokeColor": "#1e1e1e", "textAlign": "center" },
    { "id": "top", "type": "ellipse", "x": 300, "y": 80, "width": 200, "height": 80, "backgroundColor": "bg-hero", "strokeColor": "stroke-hero", "label": { "text": "Better Product", "fontSize": 14 } },
    { "id": "right", "type": "rectangle", "x": 520, "y": 220, "width": 180, "height": 70, "backgroundColor": "bg-positive", "strokeColor": "stroke-positive", "label": { "text": "More Users", "fontSize": 14 } },
    { "id": "bottom", "type": "rectangle", "x": 300, "y": 360, "width": 200, "height": 70, "backgroundColor": "bg-highlight", "strokeColor": "stroke-highlight", "label": { "text": "More Data", "fontSize": 14 } },
    { "id": "left", "type": "rectangle", "x": 100, "y": 220, "width": 180, "height": 70, "backgroundColor": "bg-neutral", "strokeColor": "stroke-neutral", "label": { "text": "Better AI", "fontSize": 14 } },
    { "id": "a1", "type": "arrow", "start": { "id": "top" }, "end": { "id": "right" }, "strokeColor": "#495057", "strokeWidth": 2 },
    { "id": "a2", "type": "arrow", "start": { "id": "right" }, "end": { "id": "bottom" }, "strokeColor": "#495057", "strokeWidth": 2 },
    { "id": "a3", "type": "arrow", "start": { "id": "bottom" }, "end": { "id": "left" }, "strokeColor": "#495057", "strokeWidth": 2 },
    { "id": "a4", "type": "arrow", "start": { "id": "left" }, "end": { "id": "top" }, "strokeColor": "#495057", "strokeWidth": 2 }
  ]
}
```
Key: Arrows form a CONTINUOUS LOOP. Use ellipse for the central/starting concept.

**QUADRANT EXAMPLE (2x2 grid with axis labels):**
```json
{
  "elements": [
    { "id": "title", "type": "text", "x": 350, "y": 30, "text": "Strategic Positioning Matrix", "fontSize": 22, "strokeColor": "#1e1e1e", "textAlign": "center" },
    { "id": "y_axis", "type": "text", "x": 50, "y": 220, "text": "← Low Risk    High Risk →", "fontSize": 12, "strokeColor": "#868e96" },
    { "id": "x_axis", "type": "text", "x": 350, "y": 450, "text": "← Low Growth    High Growth →", "fontSize": 12, "strokeColor": "#868e96" },
    { "id": "q1", "type": "rectangle", "x": 120, "y": 100, "width": 200, "height": 140, "backgroundColor": "bg-positive", "strokeColor": "stroke-positive", "label": { "text": "Safe Bet\nLow Risk, High Growth", "fontSize": 13 } },
    { "id": "q2", "type": "rectangle", "x": 480, "y": 100, "width": 200, "height": 140, "backgroundColor": "bg-highlight", "strokeColor": "stroke-highlight", "label": { "text": "High Potential\nHigh Risk, High Growth", "fontSize": 13 } },
    { "id": "q3", "type": "rectangle", "x": 120, "y": 280, "width": 200, "height": 140, "backgroundColor": "bg-neutral", "strokeColor": "stroke-neutral", "label": { "text": "Cash Cow\nLow Risk, Low Growth", "fontSize": 13 } },
    { "id": "q4", "type": "rectangle", "x": 480, "y": 280, "width": 200, "height": 140, "backgroundColor": "bg-negative", "strokeColor": "stroke-negative", "label": { "text": "Avoid\nHigh Risk, Low Growth", "fontSize": 13 } }
  ]
}
```
Key: NO arrows in quadrant layouts. Position conveys meaning.

**ICEBERG EXAMPLE (visible above, hidden below a dividing line):**
```json
{
  "elements": [
    { "id": "title", "type": "text", "x": 350, "y": 30, "text": "What You See vs. What Matters", "fontSize": 22, "strokeColor": "#1e1e1e", "textAlign": "center" },
    { "id": "visible", "type": "rectangle", "x": 250, "y": 80, "width": 300, "height": 100, "backgroundColor": "bg-neutral", "strokeColor": "stroke-neutral", "label": { "text": "Visible: Revenue Growth\n+15% YoY Headlines", "fontSize": 14 } },
    { "id": "waterline", "type": "line", "x": 100, "y": 220, "width": 600, "height": 0, "strokeColor": "#228be6", "strokeWidth": 3 },
    { "id": "waterline_label", "type": "text", "x": 720, "y": 215, "text": "Surface", "fontSize": 11, "strokeColor": "#228be6" },
    { "id": "hidden1", "type": "rectangle", "x": 100, "y": 260, "width": 220, "height": 90, "backgroundColor": "bg-highlight", "strokeColor": "stroke-highlight", "label": { "text": "Hidden Driver 1\nMargin Compression", "fontSize": 13 } },
    { "id": "hidden2", "type": "rectangle", "x": 340, "y": 260, "width": 220, "height": 90, "backgroundColor": "bg-negative", "strokeColor": "stroke-negative", "label": { "text": "Hidden Risk\nDebt Refinancing 2026", "fontSize": 13 } },
    { "id": "hidden3", "type": "rectangle", "x": 580, "y": 260, "width": 220, "height": 90, "backgroundColor": "bg-positive", "strokeColor": "stroke-positive", "label": { "text": "Hidden Catalyst\nNew Product Launch", "fontSize": 13 } }
  ]
}
```
Key: Use a horizontal LINE element as the "waterline". More boxes below than above.

**BRIDGE EXAMPLE (Current → Catalyst → Future):**
```json
{
  "elements": [
    { "id": "title", "type": "text", "x": 350, "y": 30, "text": "The Transformation Journey", "fontSize": 22, "strokeColor": "#1e1e1e", "textAlign": "center" },
    { "id": "current", "type": "rectangle", "x": 80, "y": 150, "width": 200, "height": 120, "backgroundColor": "bg-neutral", "strokeColor": "stroke-neutral", "label": { "text": "Current State\nLegacy Business\n$10B Revenue", "fontSize": 13 } },
    { "id": "catalyst", "type": "diamond", "x": 350, "y": 140, "width": 140, "height": 140, "backgroundColor": "bg-highlight", "strokeColor": "stroke-highlight", "label": { "text": "Catalyst\nAI Pivot", "fontSize": 13 } },
    { "id": "future", "type": "rectangle", "x": 520, "y": 150, "width": 200, "height": 120, "backgroundColor": "bg-positive", "strokeColor": "stroke-positive", "label": { "text": "Future State\nAI-First Company\n$25B Revenue", "fontSize": 13 } },
    { "id": "a1", "type": "arrow", "start": { "id": "current" }, "end": { "id": "catalyst" }, "strokeColor": "#495057", "strokeWidth": 2 },
    { "id": "a2", "type": "arrow", "start": { "id": "catalyst" }, "end": { "id": "future" }, "strokeColor": "#495057", "strokeWidth": 2 }
  ]
}
```
Key: Use DIAMOND for the catalyst/pivot point. Horizontal flow left-to-right.


#### SHAPE SEMANTICS

Use distinct shapes to create additional meaning:

| Shape | Use For | Semantic Meaning |
|-------|---------|------------------|
| `rectangle` | Standard entities, data blocks, segments | Concrete, measurable things |
| `ellipse` | Core themes, central concepts, starting points | Abstract ideas, focal points |
| `diamond` | Decision points, risks, catalysts, inflection points | Uncertainty, pivotal moments |

Mixing shapes thoughtfully creates visual interest and communicates meaning beyond just the text.

## DESIGN PHILOSOPHY

You are creating visual explanations. Great diagrams are not about following rules—they're about **clear communication**. Before writing any JSON, internalize these principles.

### PRINCIPLE 1: CONTENT DICTATES FORM

**Never start with a layout. Start with the message.**

Ask yourself:
1. What is the ONE thing the viewer should understand?
2. What are the supporting pieces that explain it?
3. What's the relationship between these pieces? (hierarchy? sequence? comparison?)

The answers determine your layout:
- **Hierarchy** (one thing breaks into parts) → Top-down tree
- **Sequence** (steps in order) → Left-to-right flow
- **Comparison** (things side by side) → Columns or grid
- **Cycle** (things that repeat) → Circular arrangement

### PRINCIPLE 2: THE CONTAINER SERVES THE CONTENT

**Size boxes to fit text, not text to fit boxes.**

Typography fundamentals:
- A comfortable reading line is 45-75 characters
- For labels, aim for 15-25 characters per line
- Every box needs breathing room: padding on all sides

**The sizing algorithm:**
1. Write your text first
2. Determine the longest line (in characters)
3. Box width = (longest_line × character_width) + (padding × 2)
4. Box height = (line_count × line_height) + (padding × 2)

Approximate measurements:
- Character width at font size 14-16: ~8-10 pixels
- Line height: ~20-24 pixels  
- Minimum padding: 15-20 pixels per side

If your text doesn't fit comfortably, you have two choices:
1. Make the box bigger
2. Shorten the text (preferred—forces clarity)

### PRINCIPLE 3: ALIGNMENT CREATES ORDER

**The eye seeks patterns. Give it clean lines to follow.**

Gestalt principle of alignment:
- Elements that share an edge appear related
- Misaligned elements appear chaotic, even if intentional

Practical application:
- All elements in a row share the same Y coordinate
- All elements in a column share the same X coordinate
- The center of a centered element = container_width / 2

**Alignment debugging:**
Before finalizing, trace imaginary lines:
- Can you draw a straight horizontal line through all items in a row?
- Can you draw a straight vertical line through all items in a column?
- Is the hero element truly centered (not just "close to center")?

### PRINCIPLE 4: PROXIMITY IMPLIES RELATIONSHIP

**Things that are close together are perceived as related.**

Use spacing intentionally:
- Tight spacing (20-40px): These items are closely related
- Medium spacing (50-80px): These items are in the same group
- Wide spacing (100px+): These are separate concepts

**The spacing hierarchy:**
- Space between elements in a group < Space between groups < Margins from edge

### PRINCIPLE 5: VISUAL HIERARCHY GUIDES THE EYE

**The most important thing should be the most visually prominent.**

Ways to create prominence:
1. **Size**: Larger = more important
2. **Position**: Top and center = most important
3. **Color**: Saturated/warm colors draw attention
4. **Isolation**: White space around something makes it stand out

**Reading flow:**
- Western readers scan: top-left → top-right → down
- Place your most important element where the eye lands first
- Use arrows or visual flow to guide to secondary elements

### PRINCIPLE 6: ARROWS ARE CONNECTORS, NOT DECORATIONS

**Every arrow should answer: "What leads to what?"**

Arrow principles:
- Arrows show direction of flow, causation, or breakdown
- Straight lines (vertical or horizontal) are cleaner than diagonal
- Arrows should never cross through other elements
- Arrows should never cross each other

**Arrow routing strategy:**
1. Identify which elements need to connect
2. Check if a straight vertical or horizontal line works
3. If not, consider reorganizing elements so it does
4. As a last resort, use an L-shaped path (but avoid if possible)

**The no-crossing rule:**
If arrows would cross, your layout is wrong. Reorganize elements until arrows can flow cleanly.

### PRINCIPLE 7: LESS IS MORE

**Every element should earn its place.**

Before adding an element, ask:
- Does this help the viewer understand?
- Could this information be combined with something else?
- Would removing this hurt comprehension?

Guidelines:
- Maximum 6-8 boxes in a diagram
- Maximum 3 levels of hierarchy
- If you need more, you're trying to show too much—simplify or split into multiple diagrams

### PRINCIPLE 8: COLOR HAS MEANING

**Use color to encode information, not decorate.**

A simple semantic system:
- **Warm colors** (red, orange, pink): Important, totals, conclusions
- **Cool colors** (blue, green): Supporting, positive, growth
- **Neutral colors** (gray, white): Context, background, secondary

Consistency rule: Same color = same meaning throughout the diagram.

### PRINCIPLE 9: TEST WITH THE SQUINT TEST

**If you squint at your diagram, can you still understand the structure?**

This tests:
- Is the hierarchy clear from size and position alone?
- Are groups visually distinct?
- Does the eye flow naturally through the content?

If squinting reveals chaos, simplify.


### PRINCIPLE 10: CONTENT DETERMINES SIZE

**The box must fit the content, never the reverse. This is non-negotiable.**

Text overflow is the most common diagram failure. It makes diagrams look unprofessional and unreadable. Prevent it by always sizing containers AFTER you know what goes in them.

#### THE SIZING WORKFLOW

1. **Write your text first** - Decide exactly what words will appear in the box
2. **Break into lines** - Determine natural line breaks (aim for readable line lengths)
3. **Count and calculate** - Measure the longest line and number of lines
4. **Add generous padding** - The text should never touch the edges
5. **Create the box** - Now you know the minimum size needed

#### THE PADDING MINDSET

Think of padding as breathing room for your text. Text that touches or nearly touches the box edge feels cramped and rushed. Generous padding makes content feel considered and professional.

Imagine the text is a person standing in a room. They should be able to stretch their arms without touching the walls. If the room feels claustrophobic, it's too small.

#### WHEN TEXT SEEMS TOO LONG

If calculating the box size reveals it would be uncomfortably large, you have options:

**Option 1: Edit the text**
Can you say the same thing in fewer words? Often the answer is yes. "Primary Growth Driver: ~$3.4B ARR by 2026" could become "Growth Driver\n$3.4B ARR (2026)". Shorter is usually clearer anyway.

**Option 2: Use line breaks strategically**
Breaking text into more lines makes the box narrower (though taller). Sometimes a taller, narrower box fits the layout better.

**Option 3: Accept the larger box**
If the information is important and can't be shortened, the box needs to be big. That's okay. A large box with readable text beats a small box with overflow.

**Never Option: Cram it in anyway**
This is never acceptable. If text overflows, the diagram is broken.

#### VISUAL VERIFICATION

Before finalizing any box, mentally "render" it:
- Can you see all the text clearly inside the boundaries?
- Is there comfortable space between text and edges on all four sides?
- Does the text have room to "breathe"?

If you're unsure, make the box slightly larger. Erring on the side of more space is always safer than less.

### PRINCIPLE 11: VERTICAL RHYTHM

**Consistent vertical spacing creates visual harmony.**

Establish a baseline grid and align all rows to it. This creates a sense of order and makes the diagram feel intentional rather than haphazard.

Example rhythm (adjust based on content):
- Title row: y = 50
- Hero row: y = 120  
- First content row: y = 280
- Second content row: y = 440
- Annotation row: y = 580

The exact values matter less than consistency. Pick a vertical increment (e.g., 150-160px between rows) and stick to it throughout.

### PRINCIPLE 12: INTUITIVE ARROW FLOW

**Arrows should feel like natural extensions of the visual story.**

Think of arrows as visual sentences—they say "this leads to that" or "this breaks down into these." The path an arrow takes should reinforce that meaning, not distract from it.

#### THE ARROW MINDSET

Before drawing any arrow, ask:
1. What relationship am I showing? (breakdown, sequence, causation, dependency)
2. What's the most direct visual path between these elements?
3. Does this path feel natural to the eye?

#### VISUAL FLOW PRINCIPLES

**Follow the reading direction:**
- For hierarchies (parent → children): arrows flow downward
- For sequences (step → step): arrows flow left-to-right
- For dependencies (A needs B): arrow points toward the dependency

**Minimize visual distance:**
- The shortest clear path is usually the best path
- But "clear" matters more than "short"—avoid paths that create confusion

**Respect the gestalt:**
- Arrows should feel like they belong to the elements they connect
- An arrow that seems to "reach across" the diagram awkwardly is wrong
- The connection should feel inevitable, not forced

#### CONNECTION POINT INTUITION

Where an arrow connects to a box matters. Think about it like this:

**Exiting a box:**
- If the target is below → exit from bottom area
- If the target is to the right → exit from right area  
- If the target is diagonal → exit from the corner region closest to the target
- The exit point should "point toward" the destination

**Entering a box:**
- Enter from the direction the arrow is coming from
- If arrow comes from above → enter at top
- If arrow comes from left → enter at left
- The entry should feel like a natural arrival

**The "string" mental model:**
Imagine a string connecting the two boxes. If you pulled it taut, where would it naturally touch each box? That's your connection point.

#### AVOIDING AWKWARDNESS

Signs an arrow path is wrong:
- It looks like it's "reaching around" something
- It creates an unexpected diagonal when vertical/horizontal would work
- It makes the viewer's eye jump unnaturally
- It crosses or nearly crosses another element
- The connection points feel arbitrary

Fixes:
- Reposition the elements so a cleaner path exists
- Adjust which edge/area the arrow connects to
- Consider if the arrow is even necessary (sometimes proximity implies relationship)

#### MULTIPLE ARROWS FROM ONE SOURCE

When one element connects to multiple targets (like a hero connecting to children):

**Fan pattern:**
- Arrows should fan out naturally
- Each arrow takes the most direct path to its target
- The overall pattern should feel balanced and intentional

**Avoid the "octopus":**
- Don't have arrows shooting out in random directions
- If arrows would cross each other, reorganize the targets
- The fan should feel orderly, not chaotic

#### THE FINAL CHECK

After placing arrows, step back and ask:
- Do the arrows guide the eye through the diagram in the right order?
- Does each arrow feel like the natural path between its endpoints?
- Would a viewer intuitively understand the flow without thinking about it?

If any arrow makes you pause or feels "off," trust that instinct and adjust.

### PRINCIPLE 13: VISUAL BALANCE

**The diagram should feel balanced and stable.**

Visual balance principles:
- **Symmetry**: If possible, arrange elements symmetrically around a center axis
- **Weight distribution**: Larger/darker elements have more visual weight—balance them with white space or multiple smaller elements
- **White space**: Empty space on one side should roughly match the other
- **Center of gravity**: The visual "center" of the diagram should feel centered on the canvas

A balanced diagram feels intentional and professional. An unbalanced one feels accidental.

Test for balance:
- Cover half the diagram—does the other half feel incomplete or lopsided?
- Is there significantly more content on one side?
- Does the eye naturally rest in the center, or does it drift to one side?


### PRINCIPLE 14: HIERARCHY THROUGH SIZE

**Size differences create instant visual hierarchy.**

The most important element should be noticeably larger than supporting elements. Don't rely on color alone—size is the most powerful hierarchy signal.

Size ratios:
- Hero element: 1.5-2x the size of children
- Children: roughly equal to each other
- Annotations: smaller than boxes

If all boxes are the same size, the viewer doesn't know where to look first. Make the hierarchy obvious through scale.

### PRINCIPLE 15: BREATHING ROOM

**A diagram that breathes is easier to read.**

Don't fill every inch of the canvas. Generous white space:
- Reduces cognitive load
- Makes the content feel more premium
- Helps elements stand out

Guidelines:
- Leave at least 50-80px margins from canvas edges
- Space between elements should feel comfortable, not cramped
- When in doubt, add more space

A sparse diagram with clear relationships beats a dense diagram with everything crammed together.

### PRINCIPLE 16: CONSISTENT STROKES

**Visual consistency signals professionalism.**

All similar elements should share the same visual properties:
- All boxes: same stroke width (typically 2px)
- All arrows: same thickness
- All rounded corners: same radius

Inconsistency—even subtle—makes a diagram feel amateurish and unintentional. Pick your styles and apply them uniformly.

### PRINCIPLE 17: FONT SIZE HIERARCHY

**Text size reinforces information hierarchy.**

Use distinct font sizes for different levels of information:
- Title: largest (20-24px) - the diagram's headline
- Box labels: medium (14-16px) - the main content
- Annotations: smaller (12-14px) - supporting context

Never use the same font size for everything. The size differences help viewers parse the information structure instantly.

### PRINCIPLE 18: THE ONE GLANCE TEST

**Can someone understand the main message in 3 seconds?**

This is different from the squint test. The squint test checks visual structure. The one glance test checks cognitive clarity.

After creating your diagram, imagine showing it to someone for just 3 seconds. Would they understand:
- What the main topic is?
- How many key parts there are?
- The basic relationship between parts?

If not, the diagram is either too complex or poorly organized. Simplify until it passes.

### PRINCIPLE 19: ANNOTATION LAYOUT

**Annotations are supporting actors, not the main cast.**

Annotations provide context, caveats, or additional details that don't belong in the main diagram structure. They're like footnotes in a document—useful but clearly secondary.

#### ANNOTATION TYPES

**Single insight annotation:**
A brief takeaway or summary below the main diagram. Center it, keep it to one or two lines, and make sure it doesn't compete with the boxes above.

**Paired annotations (e.g., Bull/Bear, Pros/Cons):**
When showing two contrasting viewpoints, treat them as a pair:
- Place them side by side with clear separation
- Give each its own visual territory (left half / right half)
- Use consistent formatting between them
- Never let them overlap or run into each other

**List annotations:**
When you have multiple points to make:
- Group them logically
- Align them in columns if there are multiple categories
- Ensure adequate spacing between items
- Keep each item brief—if it needs explanation, it might belong in a box instead

#### THE SEPARATION PRINCIPLE

Annotations must be clearly separated from the main diagram. This means:

**Vertical separation:** Leave significant empty space between the lowest box and the annotations. The viewer should immediately perceive "the diagram ends here, notes begin here."

**Visual distinction:** Annotations should look different from box content—typically smaller text, possibly a different color (like a muted gray), and no containing box.

**Horizontal boundaries:** If you have multiple annotation groups (like Bull Case / Bear Case), each group needs its own horizontal territory. They should never overlap or interleave.

#### AVOIDING ANNOTATION CHAOS

Common mistakes:
- **Overlapping text** - Two annotations running into each other
- **Competing with boxes** - Annotations placed too close to diagram elements
- **Wall of text** - Too much annotation content, overwhelming the diagram
- **Random placement** - Annotations scattered without clear organization

The fix is always the same: give each piece of content its own clear space. If annotations are colliding, either reduce the content or increase the canvas size.

#### THE "NEWSPAPER COLUMN" MENTAL MODEL

Think of annotation areas like newspaper columns. Each column has:
- A clear starting point (left edge)
- A defined width
- Content that stays within its boundaries
- Gutters (empty space) separating it from neighboring columns

When placing paired or grouped annotations, mentally draw these column boundaries first, then fill in the content.

### PRINCIPLE 20: EDGE CASE HANDLING

**Know what to do in unusual situations.**

**Single child:**
Don't leave one box awkwardly alone. Either:
- Center it prominently below the hero
- Add context through annotations rather than more boxes
- Question if you really need a hierarchy (maybe just one box with details)

**Many children (5+):**
Too many children in one row becomes unreadable. Options:
- Split into two rows (2-3 per row)
- Group related items and show groups instead of individuals
- Simplify—do you really need to show all of them?

**Uneven content:**
When some boxes have much more text than others:
- Size boxes to their content (Principle 10)
- Consider if the verbose box should be split or simplified
- Use annotations for the extra detail instead of cramming it in

**No clear hierarchy:**
If the content doesn't have a natural hierarchy:
- Use a flow pattern (left to right) instead
- Use a comparison pattern (columns) instead
- Don't force a tree structure where it doesn't fit

### APPLYING THESE PRINCIPLES

**Before generating JSON, work through this mental checklist:**

1. **Message**: What's the one thing to communicate?
2. **Structure**: What type of relationship am I showing? (hierarchy/sequence/comparison)
3. **Content**: What text goes in each element? Write it out fully.
4. **Sizing**: Calculate box dimensions from text length + padding.
5. **Layout**: Position elements to reflect the relationship.
6. **Alignment**: Verify rows share Y, columns share X, centered items are truly centered.
7. **Spacing**: Use proximity to show relationships.
8. **Flow**: Ensure arrows connect cleanly without crossing anything.
9. **Simplicity**: Remove anything that doesn't aid understanding.

### COMMON PATTERNS

**Pattern A: Breakdown (1 → N)**
One concept breaks into parts.
- Hero element: top-center, largest, most prominent color
- Children: single row below, evenly distributed, equal sizes
- Arrows: vertical lines from hero down to each child
- Key: Children must be horizontally centered under the hero as a group

**Pattern B: Flow (A → B → C)**
Sequential steps or process.
- Elements: single horizontal row, left to right
- Arrows: horizontal lines connecting adjacent elements
- Key: Equal spacing between all elements

**Pattern C: Comparison (A vs B)**
Side-by-side comparison.
- Two columns, vertically aligned
- Corresponding items at same Y position
- Minimal or no arrows
- Key: Visual symmetry between columns

### TECHNICAL IMPLEMENTATION

**Canvas:** Assume 800w × 600h. Leave 30px margins.

**Centering formula:** 
- To center element of width W: x = (800 - W) / 2

**Row distribution formula:**
- For N elements of width W with gaps G:
- Total width = N×W + (N-1)×G
- Starting x = (800 - total_width) / 2
- Each subsequent x = previous_x + W + G

**Text sizing:**
- Character width ≈ 8px at fontSize 14
- Line height ≈ 22px
- Padding: 20px on each side
- Box width = (max_line_chars × 8) + 40
- Box height = (num_lines × 22) + 40

**Colors:**
| Purpose | Background | Stroke |
|---------|------------|--------|
| Primary/Total | #ffc9c9 | #e03131 |
| Positive/Growth | #b2f2bb | #2f9e44 |
| Neutral/Process | #a5d8ff | #1971c2 |
| Financial | #ffec99 | #f08c00 |
| Secondary | #e9ecef | #495057 |

### SPATIAL REASONING: SHOW YOUR WORK

Before generating JSON coordinates, you MUST calculate positions explicitly. This prevents overlapping boxes and misaligned elements.

#### THE LAYOUT_MATH BLOCK

Before your JSON output, include a `<layout_math>` block where you:
1. List each element and its text content
2. Estimate the required width based on text length
3. Calculate X positions to center or distribute elements
4. Calculate Y positions for each row
5. Plan arrow connections

**Example:**
```
<layout_math>
Canvas: 1000w x 700h

ROW 1 - Title:
- "Company Name FY2025" centered at y=40

ROW 2 - Hero:
- Box "Total Revenue: $50B (+12% YoY)" 
- Text ~25 chars, need ~280px width + 60px padding = 340px
- Center X = (1000 - 340) / 2 = 330
- Y = 100, Height = 90

ROW 3 - Children (3 boxes):
- Available width: 1000 - 60 (margins) = 940px
- 3 boxes with 40px gaps = 940 - 80 = 860px for boxes
- Each box width = 860 / 3 = ~280px
- Starting X = 30
- Box 1: x=30, Box 2: x=350, Box 3: x=670
- Y = 250

ROW 4 - Annotations:
- Bull case (left half): x=50, y=400
- Bear case (right half): x=520, y=400

ARROWS:
- hero → child1 (center-bottom to center-top)
- hero → child2 (center-bottom to center-top)
- hero → child3 (center-bottom to center-top)
</layout_math>
```

#### WHY THIS MATTERS

When you calculate positions explicitly:
- Boxes won't overlap because you've done the math
- Elements will be properly centered because you've calculated it
- Rows will align because you've assigned consistent Y values
- The layout will feel intentional, not random

#### CALCULATION FORMULAS

**Centering a single element:**
```
x = (canvas_width - element_width) / 2
```

**Distributing N elements with gaps:**
```
total_content_width = N × element_width + (N-1) × gap
starting_x = (canvas_width - total_content_width) / 2
element_2_x = starting_x + element_width + gap
element_3_x = element_2_x + element_width + gap
```

**Text to width estimation:**
```
width = (character_count × 9) + 60  // 9px per char + 60px padding
```

**Always verify:**
- No element extends past canvas edges
- No two elements occupy the same space
- Vertical spacing between rows is consistent


### SEMANTIC COLOR SYSTEM

Use semantic color names instead of hex codes. This creates consistency and meaning across all diagrams.

#### COLOR VOCABULARY

| Semantic Name | Use For | Meaning |
|---------------|---------|---------|
| `bg-hero` | Main/total boxes, primary focus | The central point of the diagram |
| `bg-positive` | Growth, success, bull case, opportunities | Things going well |
| `bg-negative` | Risks, decline, bear case, threats | Things to watch out for |
| `bg-neutral` | Standard processes, balanced items | Neither good nor bad |
| `bg-highlight` | Key insights, catalysts, important callouts | Pay attention to this |
| `bg-secondary` | Supporting info, context, less important | Background information |

#### USING SEMANTIC COLORS

In your JSON, use the semantic name as the backgroundColor value:

```json
{
  "type": "rectangle",
  "backgroundColor": "bg-positive",
  "strokeColor": "stroke-positive",
  ...
}
```

The frontend will map these to actual colors based on the current theme.

#### STROKE COLORS

Each background has a matching stroke:
- `stroke-hero` - pairs with `bg-hero`
- `stroke-positive` - pairs with `bg-positive`
- `stroke-negative` - pairs with `bg-negative`
- `stroke-neutral` - pairs with `bg-neutral`
- `stroke-highlight` - pairs with `bg-highlight`
- `stroke-secondary` - pairs with `bg-secondary`

#### COLOR MEANING GUIDELINES

**For financial diagrams:**
- Revenue totals → `bg-hero`
- Growing segments → `bg-positive`
- Declining segments → `bg-negative`
- Stable segments → `bg-neutral`
- Key catalysts → `bg-highlight`

**For comparison diagrams:**
- Advantages → `bg-positive`
- Disadvantages → `bg-negative`
- Neutral factors → `bg-neutral`

**For risk/opportunity diagrams:**
- Opportunities, bull case → `bg-positive`
- Risks, bear case → `bg-negative`
- Catalysts, inflection points → `bg-highlight`

## OUTPUT FORMAT

Return ONLY valid JSON (no markdown, no explanation).

Element types you can use:
- "text": Standalone text for titles, annotations, insights
- "rectangle": Boxes with labels inside
- "arrow": Connections between elements

**CRITICAL ARROW RULES:**
1. Arrows MUST use the simple skeleton format: { "start": { "id": "source_id" }, "end": { "id": "target_id" } }
2. DO NOT use "startBinding" or "endBinding" - the renderer handles bindings automatically
3. DO NOT include "points" arrays - the renderer calculates the perfect geometric points
4. Arrow IDs must EXACTLY match element IDs (case-sensitive)
**COMPLETE EXAMPLE using Layout C (1->3 breakdown):**

{
  "elements": [
    {
      "id": "title",
      "type": "text",
      "x": 300,
      "y": 40,
      "text": "Company Name FY2025\nThe Key Insight",
      "fontSize": 22,
      "strokeColor": "#1e1e1e",
      "textAlign": "center"
    },
    {
      "id": "hero",
      "type": "rectangle",
      "x": 300,
      "y": 120,
      "width": 400,
      "height": 100,
      "backgroundColor": "#ffc9c9",
      "strokeColor": "#e03131",
      "label": { "text": "Total Revenue: $XXB\n+XX% YoY", "fontSize": 16 }
    },
    {
      "id": "seg1",
      "type": "rectangle",
      "x": 100,
      "y": 280,
      "width": 220,
      "height": 80,
      "backgroundColor": "#a5d8ff",
      "strokeColor": "#1971c2",
      "label": { "text": "Segment A\n$XB (XX%)", "fontSize": 14 }
    },
    {
      "id": "seg2",
      "type": "rectangle",
      "x": 390,
      "y": 280,
      "width": 220,
      "height": 80,
      "backgroundColor": "#b2f2bb",
      "strokeColor": "#2f9e44",
      "label": { "text": "Segment B\n$XB (XX%)", "fontSize": 14 }
    },
    {
      "id": "seg3",
      "type": "rectangle",
      "x": 680,
      "y": 280,
      "width": 220,
      "height": 80,
      "backgroundColor": "#ffec99",
      "strokeColor": "#f08c00",
      "label": { "text": "Segment C\n$XB (XX%)", "fontSize": 14 }
    },
    {
      "id": "arrow1",
      "type": "arrow",
      "start": { "id": "hero" },
      "end": { "id": "seg1" },
      "strokeColor": "#495057",
      "strokeWidth": 2,
      "endArrowhead": "triangle"
    },
    {
      "id": "arrow2",
      "type": "arrow",
      "start": { "id": "hero" },
      "end": { "id": "seg2" },
      "strokeColor": "#495057",
      "strokeWidth": 2,
      "endArrowhead": "triangle"
    },
    {
      "id": "arrow3",
      "type": "arrow",
      "start": { "id": "hero" },
      "end": { "id": "seg3" },
      "strokeColor": "#495057",
      "strokeWidth": 2,
      "endArrowhead": "triangle"
    },
    {
      "id": "note1",
      "type": "text",
      "x": 100,
      "y": 420,
      "text": "Key Insight:\nBrief explanation",
      "fontSize": 13,
      "strokeColor": "#495057",
      "textAlign": "left"
    }
  ],
  "appState": { "viewBackgroundColor": "#f8f9fa" }
}


## ⚠️ MANDATORY VALIDATION - DO NOT SKIP ⚠️

Before outputting your JSON, you MUST validate each of these. If ANY check fails, STOP and fix it.

### VALIDATION 1: ARROW PATH CHECK
For EACH arrow in your diagram:
- Trace the path from start box to end box
- Does this path pass through ANY other box? 
- If YES → Your layout is WRONG. Move boxes so arrows only travel through empty space.

### VALIDATION 2: CENTERING CHECK
- Calculate the leftmost box X and rightmost box (X + width)
- The center of your content = (leftmost + rightmost) / 2
- This should be approximately 400 (half of 800px canvas)
- If your content is off-center → Shift ALL boxes left or right to center the composition

### VALIDATION 3: SHAPE VARIETY CHECK
Look at your boxes. Did you use:
- **Ellipse** for the central theme, core concept, or starting point? (At least 1)
- **Diamond** for risks, catalysts, decision points, or pivotal moments? (If applicable)
- If everything is rectangles and the content has a clear central concept → Change the hero to an ellipse
- If there are risks or catalysts mentioned → Use diamonds for those

### VALIDATION 4: OVERLAP CHECK
For each pair of boxes (A, B):
- Does A's right edge (x + width) + 40px < B's left edge (x)?
- Does A's bottom edge (y + height) + 50px < B's top edge (y)?
- If boxes are too close or overlapping → Increase spacing

### VALIDATION 5: TEXT FIT CHECK
For each box:
- Count the longest line of text (in characters)
- Box width should be at least: (chars × 9) + 60
- If text is longer → Either make box wider OR edit text to be shorter

### VALIDATION 6: ALIGNMENT CHECK
- All boxes in the same logical row should have the EXACT same Y coordinate
- All boxes in the same logical column should have the EXACT same X coordinate
- Slight misalignments look sloppy → Round to clean numbers

**CHECKLIST FORMAT:**
After your <layout_math> block, include:
```
<validation>
✓ Arrow paths: [list each arrow and confirm it doesn't cross boxes]
✓ Centering: Content spans X=[left] to X=[right], center=[value], canvas center=400 ✓
✓ Shapes: Used ellipse for [element], diamond for [element] (or N/A)
✓ Overlaps: None detected
✓ Text fit: All boxes sized for content
✓ Alignment: Row 1 all at y=[value], Row 2 all at y=[value]
</validation>
```


## FINAL REMINDER

Your goal is to TEACH and EXPLAIN, not just display data.
But EQUALLY IMPORTANT: The layout must be CLEAN and ALIGNED.
A messy diagram with great content is still a bad diagram.`

// ============================================================================
// Diagram Generation with Data-First Workflow
// ============================================================================

async function generateDiagramWithStreaming(
  supabase: ReturnType<typeof createClient>,
  writer: ReturnType<typeof createStreamWriter>,
  request: string,
  companySymbol: string,
  companyName: string,
  chatContext: string,
  chatId: string | null,
  userId: string | null
): Promise<void> {
  
  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL_SMART}:generateContent?key=${GEMINI_API_KEY}`
  
  // Get current date context
  const dateContext = getCurrentDateContext()
  
  // Tool context for unified tools
  const toolContext = {
    ticker: companySymbol,
    chatType: 'company' as const,
    chatId: chatId || undefined
  }
  
  try {
    // ========================================================================
    // PHASE 1: PLANNING
    // ========================================================================
    writer.write('status', { stage: 'planning', message: 'Creating diagram plan...' })
    
    const planPrompt = `You are planning a financial diagram for ${companyName} (${companySymbol}).
Today's Date: ${dateContext.month} ${dateContext.year}
${dateContext.fiscalContext}

User Request: "${request}"

Create a brief plan for this diagram. Output as JSON:
{
  "title": "Diagram title - include company name and year",
  "type": "breakdown|comparison|flowchart|timeline",
  "dataNeeded": ["list of specific data points needed"],
  "layoutPlan": "Brief description of layout",
  "estimatedElements": 8
}`

    const planResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: planPrompt }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 1024 }
      })
    })
    
    let plan = { title: `${companyName} Analysis`, type: 'breakdown', dataNeeded: [], layoutPlan: '', estimatedElements: 6 }
    
    if (planResponse.ok) {
      const planData = await planResponse.json()
      const planText = planData.candidates?.[0]?.content?.parts?.[0]?.text || ''
      try {
        const jsonMatch = planText.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          plan = JSON.parse(jsonMatch[0])
        }
      } catch (e) {
        console.log('Plan parsing failed, using defaults')
      }
    }
    
    // Convert dataNeeded to checklist format for frontend
    const checklist = (plan.dataNeeded || []).map((item: string) => ({ item, status: 'pending' as const }))
    
    writer.write('plan', { 
      title: plan.title || `${companyName || 'Company'} Analysis`, 
      type: plan.type || 'breakdown', 
      checklist: checklist,
      tools: ['get_asset_fundamentals', 'get_deep_research_report', 'perform_grounded_research'],
      layout: plan.layoutPlan || 'Grid layout',
      estimated_elements: plan.estimatedElements || 6
    })
    
    // ========================================================================
    // PHASE 2: DATA GATHERING (Using Unified Tools)
    // ========================================================================
    writer.write('status', { stage: 'researching', message: `Fetching data for ${companySymbol}...` })
    
    const gatheredData: Record<string, unknown> = {}
    
    // TOOL 1: Get company fundamentals
    if (companySymbol) {
      writer.write('tool_call', { tool: 'get_asset_fundamentals', args: { symbol: companySymbol }, message: `Fetching fundamentals for ${companySymbol}...` })
      
      try {
        const fundamentals = await executeUnifiedTool('get_asset_fundamentals', { symbol: companySymbol }, supabase, toolContext)
        gatheredData['fundamentals'] = fundamentals
        writer.write('tool_result', { tool: 'get_asset_fundamentals', success: true, message: 'Got company fundamentals' })
        writer.write('checklist_update', { item: 'Company fundamentals', status: 'complete' })
      } catch (e) {
        console.error('Fundamentals error:', e)
        writer.write('tool_result', { tool: 'get_asset_fundamentals', success: false, message: String(e) })
      }
    }
    
    // TOOL 2: Get deep research report if available
    writer.write('tool_call', { tool: 'get_deep_research_report', args: { symbol: companySymbol }, message: `Checking for research report...` })
    
    try {
      const report = await executeUnifiedTool('get_deep_research_report', { symbol: companySymbol }, supabase, toolContext)
      if (report && !(report as any).error) {
        gatheredData['deepResearch'] = report
        writer.write('tool_result', { tool: 'get_deep_research_report', success: true, message: 'Got deep research report' })
        writer.write('checklist_update', { item: 'Deep research report', status: 'complete' })
      } else {
        writer.write('tool_result', { tool: 'get_deep_research_report', success: false, message: 'No report available' })
      }
    } catch (e) {
      console.log('Deep research not available')
    }
    
    // TOOL 3: Grounded research for specific data - USE CURRENT YEAR
    const searchQuery = `${companyName} ${companySymbol} ${request} financial data revenue breakdown ${dateContext.year}`
    writer.write('tool_call', { tool: 'perform_grounded_research', args: { query: searchQuery }, message: `Researching: ${searchQuery.substring(0, 50)}...` })
    
    try {
      const searchResults = await executeUnifiedTool('perform_grounded_research', { query: searchQuery }, supabase, toolContext)
      gatheredData['research'] = searchResults
      writer.write('tool_result', { tool: 'perform_grounded_research', success: true, message: 'Got web research results' })
      writer.write('checklist_update', { item: 'Web research', status: 'complete' })
    } catch (e) {
      console.error('Research error:', e)
      writer.write('tool_result', { tool: 'perform_grounded_research', success: false, message: String(e) })
    }
    
    // ========================================================================
    // PHASE 3: DESIGN DIAGRAM
    // ========================================================================
    writer.write('status', { stage: 'designing', message: 'Creating diagram with real data...' })
    
    // Build the design prompt with all gathered data
    const designPrompt = `${EXCALIDRAW_EXPERT_PROMPT}

## CURRENT DATE CONTEXT
- Today's Date: ${dateContext.month} ${dateContext.year}
- Current Quarter: ${dateContext.quarter}
- ${dateContext.fiscalContext}

## TARGET COMPANY (USE ONLY THIS COMPANY'S DATA!)
- Company Name: ${companyName}
- Stock Symbol: ${companySymbol}

IMPORTANT: You are creating a diagram for ${companyName} (${companySymbol}) ONLY.
Do NOT use data from any other company. If the data below mentions other companies, ignore them.

## USER REQUEST
"${request}"

## GATHERED DATA FOR ${companySymbol} (USE THIS REAL DATA - DO NOT MAKE UP NUMBERS!)

### Company Fundamentals for ${companySymbol}:
${JSON.stringify(gatheredData['fundamentals'] || {}, null, 2)}

### Deep Research Report for ${companySymbol}:
${JSON.stringify(gatheredData['deepResearch'] || 'Not available', null, 2)}

### Web Research for ${companySymbol}:
${JSON.stringify(gatheredData['research'] || 'Not available', null, 2)}

## YOUR TASK
Create an Excalidraw diagram that visualizes "${request}" for ${companyName} (${companySymbol}).
- Use the REAL numbers from the data above for ${companySymbol}
- Use the beautiful Excalidraw pastel color palette specified
- Make sure text fits inside boxes (use dynamic sizing)
- Include the year in the title (e.g., "${companyName} FY${dateContext.year - 1} Revenue Breakdown")
- Create at least 6 elements
- Output ONLY the JSON, no markdown code blocks.`

    console.log('Design prompt length:', designPrompt.length)
    
    // Generate the diagram
    const designResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: designPrompt }] }],
        generationConfig: { 
          temperature: 0.4, 
          maxOutputTokens: 16384,
          responseMimeType: 'application/json'
        }
      })
    })
    
    if (!designResponse.ok) {
      const errorText = await designResponse.text()
      throw new Error(`Gemini API error: ${designResponse.status} - ${errorText}`)
    }
    
    const designData = await designResponse.json()
    // Strip layout_math block if present (CoT spatial reasoning)
    let responseText = designData.candidates?.[0]?.content?.parts?.[0]?.text || ''
    responseText = responseText.replace(/<layout_math>[\s\S]*?<\/layout_math>/g, '').trim()
    responseText = responseText.replace(/<validation>[\s\S]*?<\/validation>/g, '').trim()
    
    console.log('Raw response length:', responseText.length)
    
    // Parse the JSON
    writer.write('status', { stage: 'parsing', message: 'Parsing diagram data...' })
    
    let diagramJson: { elements: unknown[], appState?: unknown }
    
    // Sanitize JSON string to remove control characters that break parsing
    // This handles newlines, tabs, and other control chars inside string literals
    function sanitizeJsonString(str: string): string {
      // First, try to fix common issues with control characters in JSON strings
      // Replace literal newlines/tabs inside strings with escaped versions
      return str
        .replace(/[\x00-\x1F\x7F]/g, (char) => {
          // Keep valid JSON escapes, replace others
          const code = char.charCodeAt(0)
          if (code === 0x09) return '\\t'  // tab
          if (code === 0x0A) return '\\n'  // newline
          if (code === 0x0D) return '\\r'  // carriage return
          return '' // Remove other control characters
        })
    }
    
    try {
      // Try direct parse first with sanitization
      diagramJson = JSON.parse(sanitizeJsonString(responseText))
    } catch (e) {
      // Try to extract JSON from markdown
      const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || responseText.match(/(\{[\s\S]*\})/)
      if (jsonMatch) {
        diagramJson = JSON.parse(sanitizeJsonString(jsonMatch[1]))
      } else {
        throw new Error('Could not parse diagram JSON: ' + (e as Error).message)
      }
    }
    
    if (!diagramJson.elements || !Array.isArray(diagramJson.elements)) {
      throw new Error('Invalid diagram format: missing elements array')
    }
    
    // Ensure light background is set
    if (!diagramJson.appState) {
      diagramJson.appState = {}
    }
    (diagramJson.appState as any).viewBackgroundColor = '#f8f9fa'
    
    const elementCount = diagramJson.elements.length
    writer.write('status', { stage: 'saving', message: `Generated ${elementCount} elements. Saving...` })
    
    // ========================================================================
    // PHASE 4: SAVE TO DATABASE
    // ========================================================================
    
    let diagramId = `temp-${Date.now()}`
    
    if (userId && chatId) {
      try {
        const { data: savedDiagram, error: saveError } = await supabase
          .from('chat_diagrams')
          .insert({
            user_id: userId,
            chat_id: chatId,
            name: plan.title || `${companyName} Diagram`,
            excalidraw_data: diagramJson,
            is_ai_generated: true,
            status: 'ready'
          })
          .select('diagram_id')
          .single()
        
        if (saveError) {
          console.error('Save error:', saveError)
        } else if (savedDiagram) {
          diagramId = savedDiagram.diagram_id
        }
      } catch (e) {
        console.error('Database save failed:', e)
      }
    }
    
    // ========================================================================
    // COMPLETE
    // ========================================================================
    
    writer.write('complete', {
      success: true,
      diagram: {
        diagram_id: diagramId,
        name: plan.title || `${companyName} Diagram`,
        excalidraw_data: diagramJson,
        is_ai_generated: true
      },
      message: 'Diagram generated successfully!'
    })
    
  } catch (error) {
    console.error('Generation error:', error)
    writer.write('error', {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      message: 'Failed to generate diagram'
    })
  }
}

// ============================================================================
// HTTP Handler
// ============================================================================

serve(async (req: Request) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }
  
  try {
    const { 
      request, 
      company_symbol, 
      company_name, 
      chat_context,
      chat_id,
      user_id 
    } = await req.json()
    
    // Log received parameters for debugging
    console.log('[DiagramGenerator] Received request:', {
      request,
      company_symbol,
      company_name,
      chat_id,
      user_id,
      has_chat_context: !!chat_context
    })
    
    if (!request) {
      return new Response(
        JSON.stringify({ error: 'Missing request parameter' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    // Validate company context
    if (!company_symbol) {
      console.warn('[DiagramGenerator] WARNING: No company_symbol provided!')
    }
    if (!company_name || company_name === 'Company') {
      console.warn('[DiagramGenerator] WARNING: No company_name provided!')
    }
    
    // Create Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    
    // Create stream writer
    const writer = createStreamWriter()
    
    // Start generation in background
    generateDiagramWithStreaming(
      supabase,
      writer,
      request,
      company_symbol || '',
      company_name || 'Company',
      chat_context || '',
      chat_id || null,
      user_id || null
    ).finally(() => {
      writer.close()
    })
    
    // Return streaming response
    return new Response(writer.stream, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      }
    })
    
  } catch (error) {
    console.error('Handler error:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
