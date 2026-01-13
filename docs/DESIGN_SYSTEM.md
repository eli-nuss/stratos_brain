# Stratos Brain Design System Specifications

> **UI/UX Audit & Comprehensive Redesign Guide**
> >
> > > This document provides detailed specifications for creating a more cohesive, professional design that avoids the "AI-generated" aesthetic.
> > >
> > > ---
> > >
> > > ## Table of Contents
> > >
> > > 1. [Global Issues Overview](#global-issues-overview)
> > > 2. 2. [Color System](#1-color-system)
> > >    3. 3. [Typography System](#2-typography-system)
> > >       4. 4. [Spacing System](#3-spacing-system)
> > >          5. 5. [Border & Shadow System](#4-border--shadow-system)
> > >             6. 6. [Component Specifications](#5-component-specifications)
> > >                7. 7. [Page-Specific Specifications](#6-page-specific-specifications)
> > >                  
> > >                   8. ---
> > >                  
> > >                   9. ## Global Issues Overview
> > >                  
> > >                   10. ### Problems Identified
> > >
> > > 1. **Color System Lacks Hierarchy & Restraint** - Too many accent colors (12+) competing simultaneously
> > > 2. 2. **Typography Inconsistencies** - Mixed case conventions, inconsistent weights
> > >    3. 3. **Spacing & Density Problems** - Cramped sidebar, inconsistent padding
> > >       4. 4. **Too Many Border Styles** - Mix of bordered and borderless cards
> > >         
> > >          5. ### Top 5 Changes for Maximum Impact
> > >         
> > >          6. 1. **Establish ONE primary accent color** and eliminate all others (except semantic green/red)
> > >             2. 2. **Create a unified component library** for badges, buttons, cards, and inputs
> > >                3. 3. **Simplify the Docs pipeline diagram** — the multi-colored cards are most obviously "AI-generated"
> > >                   4. 4. **Reduce information density** — more whitespace, larger click targets
> > >                      5. 5. **Standardize typography** — one case convention, one weight scale
> > >                        
> > >                         6. ---
> > >                        
> > >                         7. ## 1. Color System
> > >                        
> > >                         8. ### Recommended Color Palette
> > >
> > > #### Background Hierarchy (Dark Theme)
> > >
> > > | Token | Hex | Usage |
> > > |-------|-----|-------|
> > > | `--bg-base` | `#0a0a0f` | Page background |
> > > | `--bg-surface` | `#12121a` | Cards, modals, sidebars |
> > > | `--bg-elevated` | `#1a1a24` | Hover states, nested cards |
> > > | `--bg-overlay` | `#22222e` | Dropdowns, tooltips |
> > >
> > > #### Text Hierarchy
> > >
> > > | Token | Hex/Opacity | Usage |
> > > |-------|-------------|-------|
> > > | `--text-primary` | `#ffffff` | Headings, important data |
> > > | `--text-secondary` | `rgba(255,255,255,0.7)` | Body text, labels |
> > > | `--text-tertiary` | `rgba(255,255,255,0.5)` | Helper text, timestamps |
> > > | `--text-disabled` | `rgba(255,255,255,0.3)` | Disabled states |
> > >
> > > #### Primary Accent (Use the teal - ONE color only)
> > >
> > > | Token | Hex | Usage |
> > > |-------|-----|-------|
> > > | `--accent-primary` | `#22d3ee` | Primary buttons, links, active states |
> > > | `--accent-primary-hover` | `#06b6d4` | Hover state |
> > > | `--accent-primary-muted` | `rgba(34,211,238,0.15)` | Backgrounds, subtle highlights |
> > > | `--accent-primary-border` | `rgba(34,211,238,0.3)` | Borders when needed |
> > >
> > > #### Semantic Colors (Only These for Status)
> > >
> > > | Token | Hex | Usage |
> > > |-------|-----|-------|
> > > | `--semantic-positive` | `#22c55e` | Gains, success, bullish |
> > > | `--semantic-negative` | `#ef4444` | Losses, errors, bearish |
> > > | `--semantic-warning` | `#f59e0b` | Warnings only (use sparingly) |
> > > | `--semantic-neutral` | `rgba(255,255,255,0.5)` | Neutral/hold states |
> > >
> > > #### Border Colors
> > >
> > > | Token | Hex | Usage |
> > > |-------|-----|-------|
> > > | `--border-subtle` | `rgba(255,255,255,0.06)` | Card borders, dividers |
> > > | `--border-default` | `rgba(255,255,255,0.1)` | Input borders |
> > > | `--border-focus` | `var(--accent-primary)` | Focus states |
> > >
> > > ### Colors to REMOVE
> > >
> > > - Purple gradient (`#8b5cf6` → `#a855f7`) — "Generate All Documents" button
> > > - - Yellow badge color (`#eab308`) — Bug tags
> > >   - - Orange indicators — momentum
> > >     - - Multiple blues — standardize to one
> > >       - - Multi-color pipeline diagram colors
> > >        
> > >         - ---
> > >
> > > ## 2. Typography System
> > >
> > > ### Font Stack
> > >
> > > ```css
> > > --font-sans: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
> > > --font-mono: 'JetBrains Mono', 'SF Mono', Consolas, monospace;
> > > ```
> > >
> > > ### Type Scale
> > >
> > > | Token | Size | Weight | Line Height | Letter Spacing | Usage |
> > > |-------|------|--------|-------------|----------------|-------|
> > > | `--text-xs` | 11px | 500 | 16px | 0.02em | Small labels, badges |
> > > | `--text-sm` | 13px | 400 | 20px | 0 | Helper text, metadata |
> > > | `--text-base` | 14px | 400 | 22px | 0 | Body text, table cells |
> > > | `--text-md` | 15px | 500 | 24px | 0 | Emphasized body |
> > > | `--text-lg` | 17px | 600 | 26px | -0.01em | Section headers |
> > > | `--text-xl` | 20px | 600 | 28px | -0.01em | Page titles |
> > > | `--text-2xl` | 24px | 700 | 32px | -0.02em | Modal titles |
> > >
> > > ### Case Conventions
> > >
> > > | Element | Case | Example |
> > > |---------|------|---------|
> > > | Navigation items | Title Case | "Smart Money" |
> > > | Page titles | Title Case | "Research Library" |
> > > | Section headers | Title Case | "High Conviction Consensus" |
> > > | Column headers | ALL CAPS | "TICKER" "PRICE" "24H" |
> > > | Button labels | Title Case | "Add Investor" |
> > > | Form labels | Sentence case | "Search by fund name..." |
> > > | Helper text | Sentence case | "Holdings from 13F (Lagged)" |
> > > | Badge text | ALL CAPS | "BULLISH" "HOLD" |
> > >
> > > ### Typography CSS
> > >
> > > ```css
> > > /* Navigation */
> > > .nav-item {
> > >   font-size: 14px;
> > >   font-weight: 500;
> > >   letter-spacing: 0;
> > > }
> > > .nav-item.active {
> > >   font-weight: 600;
> > >   color: var(--text-primary);
> > > }
> > > .nav-item:not(.active) {
> > >   color: var(--text-secondary);
> > > }
> > >
> > > /* Sidebar */
> > > .sidebar-section-title {
> > >   font-size: 11px;
> > >   font-weight: 600;
> > >   letter-spacing: 0.05em;
> > >   text-transform: uppercase;
> > >   color: var(--text-tertiary);
> > > }
> > > .sidebar-item {
> > >   font-size: 14px;
> > >   font-weight: 400;
> > >   color: var(--text-secondary);
> > > }
> > > .sidebar-item.active {
> > >   font-weight: 500;
> > >   color: var(--text-primary);
> > > }
> > >
> > > /* Table Headers */
> > > .table-header-cell {
> > >   font-size: 11px;
> > >   font-weight: 600;
> > >   letter-spacing: 0.04em;
> > >   text-transform: uppercase;
> > >   color: var(--text-tertiary);
> > > }
> > >
> > > /* Table Cells */
> > > .table-cell {
> > >   font-size: 14px;
> > >   font-weight: 400;
> > >   color: var(--text-primary);
> > > }
> > > .table-cell-number {
> > >   font-family: var(--font-mono);
> > >   font-size: 13px;
> > >   font-weight: 500;
> > >   font-feature-settings: 'tnum' 1;
> > > }
> > > ```
> > >
> > > ---
> > >
> > > ## 3. Spacing System
> > >
> > > ### Base Grid (8px)
> > >
> > > | Token | Value | Usage |
> > > |-------|-------|-------|
> > > | `--space-1` | 4px | Tight internal spacing |
> > > | `--space-2` | 8px | Icon gaps, tight padding |
> > > | `--space-3` | 12px | Default gap between elements |
> > > | `--space-4` | 16px | Card padding (compact) |
> > > | `--space-5` | 20px | Card padding (default) |
> > > | `--space-6` | 24px | Section spacing |
> > > | `--space-8` | 32px | Large section gaps |
> > > | `--space-10` | 40px | Page-level spacing |
> > > | `--space-12` | 48px | Major section breaks |
> > >
> > > ### Component Spacing
> > >
> > > ```css
> > > /* Sidebar */
> > > .sidebar {
> > >   width: 240px;
> > >   padding: 16px 12px;
> > > }
> > > .sidebar-section {
> > >   margin-bottom: 24px;
> > > }
> > > .sidebar-item {
> > >   padding: 10px 12px;
> > >   margin-bottom: 2px;
> > >   border-radius: 6px;
> > > }
> > >
> > > /* Cards */
> > > .card {
> > >   padding: 20px;
> > >   border-radius: 8px;
> > >   background: var(--bg-surface);
> > > }
> > > .card-header {
> > >   margin-bottom: 16px;
> > > }
> > >
> > > /* Tables */
> > > .table-row {
> > >   height: 52px;
> > > }
> > > .table-cell {
> > >   padding: 0 16px;
> > > }
> > > .table-header-row {
> > >   height: 44px;
> > >   border-bottom: 1px solid var(--border-subtle);
> > > }
> > >
> > > /* Modals */
> > > .modal {
> > >   padding: 24px;
> > >   border-radius: 12px;
> > > }
> > > .modal-header {
> > >   margin-bottom: 20px;
> > > }
> > > .modal-footer {
> > >   margin-top: 24px;
> > >   padding-top: 16px;
> > >   border-top: 1px solid var(--border-subtle);
> > > }
> > > ```
> > >
> > > ---
> > >
> > > ## 4. Border & Shadow System
> > >
> > > ### Border Radius
> > >
> > > | Token | Value | Usage |
> > > |-------|-------|-------|
> > > | `--radius-sm` | 4px | Small badges, tags |
> > > | `--radius-md` | 6px | Buttons, inputs |
> > > | `--radius-lg` | 8px | Cards, dropdowns |
> > > | `--radius-xl` | 12px | Modals, large cards |
> > > | `--radius-full` | 9999px | Pills, avatars |
> > >
> > > ### Border Strategy
> > >
> > > **Remove most visible borders. Use background color differentiation instead.**
> > >
> > > ```css
> > > /* DO THIS */
> > > .card {
> > >   background: var(--bg-surface);
> > >   border: none;
> > >   border-radius: var(--radius-lg);
> > > }
> > >
> > > /* NOT THIS */
> > > .card {
> > >   background: var(--bg-surface);
> > >   border: 1px solid rgba(255,255,255,0.1);
> > > }
> > > ```
> > >
> > > **When to use borders:**
> > > - Input fields (subtle, `var(--border-default)`)
> > > - - Table header row bottom border
> > >   - - Dividers between major sections
> > >     - - Focus states
> > >      
> > >       - ### Shadows (Use Sparingly)
> > >      
> > >       - ```css
> > >         --shadow-sm: 0 1px 2px rgba(0,0,0,0.3);
> > >         --shadow-md: 0 4px 12px rgba(0,0,0,0.4);
> > >         --shadow-lg: 0 8px 24px rgba(0,0,0,0.5);
> > >         ```
> > >
> > > Only use shadows on: Modals, Dropdowns, Elevated tooltips
> > >
> > > ---
> > >
> > > ## 5. Component Specifications
> > >
> > > ### Buttons
> > >
> > > ```css
> > > /* Primary Button */
> > > .btn-primary {
> > >   height: 36px;
> > >   padding: 0 16px;
> > >   font-size: 14px;
> > >   font-weight: 500;
> > >   color: #000000;
> > >   background: var(--accent-primary);
> > >   border: none;
> > >   border-radius: var(--radius-md);
> > > }
> > > .btn-primary:hover {
> > >   background: var(--accent-primary-hover);
> > > }
> > >
> > > /* Secondary Button */
> > > .btn-secondary {
> > >   height: 36px;
> > >   padding: 0 16px;
> > >   font-size: 14px;
> > >   font-weight: 500;
> > >   color: var(--text-primary);
> > >   background: transparent;
> > >   border: 1px solid var(--border-default);
> > >   border-radius: var(--radius-md);
> > > }
> > > .btn-secondary:hover {
> > >   background: var(--bg-elevated);
> > >   border-color: var(--border-focus);
> > > }
> > >
> > > /* Ghost Button (icon buttons) */
> > > .btn-ghost {
> > >   width: 32px;
> > >   height: 32px;
> > >   padding: 0;
> > >   display: flex;
> > >   align-items: center;
> > >   justify-content: center;
> > >   color: var(--text-tertiary);
> > >   background: transparent;
> > >   border: none;
> > >   border-radius: var(--radius-md);
> > > }
> > > .btn-ghost:hover {
> > >   color: var(--text-primary);
> > >   background: var(--bg-elevated);
> > > }
> > > ```
> > >
> > > ### Badges / Tags (ONE Unified Component)
> > >
> > > ```css
> > > .badge {
> > >   display: inline-flex;
> > >   align-items: center;
> > >   height: 22px;
> > >   padding: 0 8px;
> > >   font-size: 11px;
> > >   font-weight: 600;
> > >   letter-spacing: 0.02em;
> > >   text-transform: uppercase;
> > >   border-radius: var(--radius-sm);
> > > }
> > >
> > > /* Only these 4 variants */
> > > .badge-default {
> > >   color: var(--text-secondary);
> > >   background: var(--bg-elevated);
> > > }
> > > .badge-primary {
> > >   color: var(--accent-primary);
> > >   background: var(--accent-primary-muted);
> > > }
> > > .badge-positive {
> > >   color: var(--semantic-positive);
> > >   background: rgba(34, 197, 94, 0.15);
> > > }
> > > .badge-negative {
> > >   color: var(--semantic-negative);
> > >   background: rgba(239, 68, 68, 0.15);
> > > }
> > > ```
> > >
> > > **Badge Usage:**
> > > - Quality scores → `.badge-default`
> > > - - AI Direction → `.badge-positive` or `.badge-negative`
> > >   - - "BULLISH"/"BEARISH" → `.badge-positive` or `.badge-negative`
> > >     - - "HOLD" → `.badge-default`
> > >       - - Bug/Improvement tags → `.badge-default`
> > >         - - Industry tags → `.badge-primary`
> > >          
> > >           - ### Input Fields
> > >          
> > >           - ```css
> > >             .input {
> > >               height: 40px;
> > >               padding: 0 12px;
> > >               font-size: 14px;
> > >               color: var(--text-primary);
> > >               background: var(--bg-base);
> > >               border: 1px solid var(--border-default);
> > >               border-radius: var(--radius-md);
> > >             }
> > >             .input::placeholder {
> > >               color: var(--text-disabled);
> > >             }
> > >             .input:focus {
> > >               outline: none;
> > >               border-color: var(--accent-primary);
> > >               box-shadow: 0 0 0 3px var(--accent-primary-muted);
> > >             }
> > >             .input-search {
> > >               padding-left: 40px;
> > >               background-image: url('search-icon.svg');
> > >               background-repeat: no-repeat;
> > >               background-position: 12px center;
> > >             }
> > >             ```
> > >
> > > ### Tabs
> > >
> > > ```css
> > > .tabs {
> > >   display: flex;
> > >   gap: 4px;
> > >   padding: 4px;
> > >   background: var(--bg-base);
> > >   border-radius: var(--radius-md);
> > > }
> > > .tab {
> > >   padding: 8px 16px;
> > >   font-size: 13px;
> > >   font-weight: 500;
> > >   color: var(--text-secondary);
> > >   background: transparent;
> > >   border: none;
> > >   border-radius: var(--radius-sm);
> > > }
> > > .tab:hover {
> > >   color: var(--text-primary);
> > > }
> > > .tab.active {
> > >   color: var(--text-primary);
> > >   background: var(--bg-surface);
> > > }
> > > ```
> > >
> > > ### Toggle Groups
> > >
> > > ```css
> > > .toggle-group {
> > >   display: inline-flex;
> > >   padding: 2px;
> > >   background: var(--bg-base);
> > >   border-radius: var(--radius-md);
> > > }
> > > .toggle-option {
> > >   padding: 6px 12px;
> > >   font-size: 12px;
> > >   font-weight: 500;
> > >   color: var(--text-secondary);
> > >   background: transparent;
> > >   border: none;
> > >   border-radius: var(--radius-sm);
> > > }
> > > .toggle-option.active {
> > >   color: var(--text-primary);
> > >   background: var(--accent-primary);
> > > }
> > > ```
> > >
> > > ### Cards
> > >
> > > ```css
> > > .card {
> > >   background: var(--bg-surface);
> > >   border-radius: var(--radius-lg);
> > >   padding: 20px;
> > > }
> > > .card-hoverable {
> > >   transition: background 0.15s ease;
> > >   cursor: pointer;
> > > }
> > > .card-hoverable:hover {
> > >   background: var(--bg-elevated);
> > > }
> > > ```
> > >
> > > ### Avatars
> > >
> > > ```css
> > > .avatar {
> > >   width: 36px;
> > >   height: 36px;
> > >   display: flex;
> > >   align-items: center;
> > >   justify-content: center;
> > >   font-size: 13px;
> > >   font-weight: 600;
> > >   color: var(--text-primary);
> > >   background: var(--bg-elevated);
> > >   border-radius: var(--radius-full);
> > > }
> > > .avatar-sm { width: 28px; height: 28px; font-size: 11px; }
> > > .avatar-md { width: 36px; height: 36px; font-size: 13px; }
> > > .avatar-lg { width: 44px; height: 44px; font-size: 15px; }
> > > ```
> > >
> > > ---
> > >
> > > ## 6. Page-Specific Specifications
> > >
> > > ### Dashboard / Watchlist
> > >
> > > ```css
> > > /* Table Header Row */
> > > .table-header-row {
> > >   height: 44px;
> > >   background: var(--bg-surface);
> > >   border-bottom: 1px solid var(--border-subtle);
> > >   position: sticky;
> > >   top: 0;
> > >   z-index: 10;
> > > }
> > >
> > > /* Summary Rows */
> > > .table-summary-row {
> > >   background: var(--bg-elevated);
> > >   font-style: italic;
> > > }
> > > .table-summary-row .label {
> > >   color: var(--text-secondary);
> > > }
> > >
> > > /* Quality Score - Neutral styling */
> > > .quality-score {
> > >   display: inline-flex;
> > >   align-items: center;
> > >   justify-content: center;
> > >   min-width: 32px;
> > >   height: 24px;
> > >   padding: 0 8px;
> > >   font-family: var(--font-mono);
> > >   font-size: 12px;
> > >   font-weight: 600;
> > >   color: var(--text-primary);
> > >   background: var(--bg-elevated);
> > >   border-radius: var(--radius-sm);
> > > }
> > >
> > > /* Action Buttons - Show on hover */
> > > .table-action-btn {
> > >   width: 32px;
> > >   height: 32px;
> > >   opacity: 0;
> > >   transition: all 0.15s ease;
> > > }
> > > .table-row:hover .table-action-btn {
> > >   opacity: 1;
> > > }
> > > ```
> > >
> > > ### Research Chat
> > >
> > > ```css
> > > /* Chat List Items */
> > > .chat-list-item {
> > >   display: flex;
> > >   align-items: flex-start;
> > >   gap: 12px;
> > >   padding: 12px;
> > >   border-radius: var(--radius-md);
> > > }
> > > .chat-list-item:hover {
> > >   background: var(--bg-elevated);
> > > }
> > > .chat-list-item.active {
> > >   background: var(--accent-primary-muted);
> > > }
> > >
> > > /* Remove mini chart icons - not readable at this size */
> > > .chat-list-item .mini-chart {
> > >   display: none;
> > > }
> > >
> > > /* Panel Tabs */
> > > .panel-tabs {
> > >   display: flex;
> > >   background: var(--bg-base);
> > >   border-radius: var(--radius-md);
> > >   padding: 4px;
> > > }
> > > .panel-tab {
> > >   flex: 1;
> > >   padding: 10px 16px;
> > >   font-size: 13px;
> > >   font-weight: 500;
> > >   text-align: center;
> > >   color: var(--text-secondary);
> > >   background: transparent;
> > >   border-radius: var(--radius-sm);
> > > }
> > > .panel-tab.active {
> > >   color: var(--text-primary);
> > >   background: var(--bg-surface);
> > > }
> > >
> > > /* Trade Plan */
> > > .trade-plan {
> > >   background: var(--bg-surface);
> > >   padding: 16px;
> > >   border-radius: var(--radius-lg);
> > > }
> > > .trade-plan-value.entry { color: var(--text-primary); }
> > > .trade-plan-value.target { color: var(--semantic-positive); }
> > > .trade-plan-value.stop { color: var(--semantic-negative); }
> > > ```
> > >
> > > ### Stratos Brain
> > >
> > > ```css
> > > /* Analyst Note - Use primary accent, not purple */
> > > .analyst-note {
> > >   padding: 12px 16px;
> > >   background: var(--accent-primary-muted);
> > >   border-left: 3px solid var(--accent-primary);
> > >   border-radius: 0 var(--radius-md) var(--radius-md) 0;
> > >   margin: 16px 0;
> > > }
> > > .analyst-note-icon {
> > >   color: var(--accent-primary);
> > > }
> > > ```
> > >
> > > ### Smart Money Tracker
> > >
> > > ```css
> > > /* AI Direction - Simplified */
> > > .ai-direction {
> > >   display: inline-flex;
> > >   align-items: center;
> > >   gap: 6px;
> > >   padding: 4px 10px;
> > >   font-family: var(--font-mono);
> > >   font-size: 12px;
> > >   font-weight: 600;
> > >   border-radius: var(--radius-sm);
> > > }
> > > .ai-direction.positive {
> > >   color: var(--semantic-positive);
> > >   background: rgba(34, 197, 94, 0.15);
> > > }
> > > .ai-direction.negative {
> > >   color: var(--semantic-negative);
> > >   background: rgba(239, 68, 68, 0.15);
> > > }
> > > .ai-direction.neutral {
> > >   color: var(--text-secondary);
> > >   background: var(--bg-elevated);
> > > }
> > >
> > > /* Fund Cards */
> > > .fund-card {
> > >   padding: 16px;
> > >   background: var(--bg-surface);
> > >   border-radius: var(--radius-lg);
> > >   margin-bottom: 8px;
> > > }
> > > .fund-card-ticker {
> > >   padding: 4px 8px;
> > >   font-size: 11px;
> > >   font-weight: 500;
> > >   color: var(--text-secondary);
> > >   background: var(--bg-elevated);
> > >   border-radius: var(--radius-sm);
> > > }
> > > ```
> > >
> > > ### Research Library (Memos)
> > >
> > > ```css
> > > /* Date Header - Simplified */
> > > .date-header {
> > >   display: flex;
> > >   align-items: center;
> > >   gap: 8px;
> > >   margin-bottom: 16px;
> > >   padding-bottom: 8px;
> > >   border-bottom: 1px solid var(--border-subtle);
> > > }
> > > .date-header-text {
> > >   font-size: 13px;
> > >   font-weight: 500;
> > >   color: var(--text-secondary);
> > >   text-transform: uppercase;
> > >   letter-spacing: 0.03em;
> > > }
> > >
> > > /* Memo Cards - No border, hover only */
> > > .memo-card {
> > >   padding: 20px;
> > >   background: var(--bg-surface);
> > >   border-radius: var(--radius-lg);
> > >   border: none;
> > > }
> > > .memo-card:hover {
> > >   background: var(--bg-elevated);
> > > }
> > > ```
> > >
> > > ### Docs Page - Pipeline Diagram (CRITICAL)
> > >
> > > **This is the most "AI-generated" looking element. Simplify dramatically.**
> > >
> > > ```css
> > > /* All cards same color - differentiate by icon only */
> > > .pipeline-card {
> > >   display: flex;
> > >   flex-direction: column;
> > >   align-items: center;
> > >   gap: 8px;
> > >   padding: 16px 20px;
> > >   min-width: 120px;
> > >   background: var(--bg-surface);
> > >   border-radius: var(--radius-lg);
> > >   text-align: center;
> > > }
> > >
> > > /* ALL icons same color */
> > > .pipeline-card-icon {
> > >   width: 32px;
> > >   height: 32px;
> > >   display: flex;
> > >   align-items: center;
> > >   justify-content: center;
> > >   color: var(--accent-primary);
> > >   background: var(--accent-primary-muted);
> > >   border-radius: var(--radius-md);
> > > }
> > >
> > > .pipeline-card-title {
> > >   font-size: 13px;
> > >   font-weight: 500;
> > >   color: var(--text-primary);
> > > }
> > >
> > > .pipeline-card-subtitle {
> > >   font-size: 11px;
> > >   color: var(--text-tertiary);
> > > }
> > >
> > > .pipeline-arrow {
> > >   color: var(--text-disabled);
> > > }
> > > ```
> > >
> > > ### To-Do Page
> > >
> > > ```css
> > > /* Stat Cards */
> > > .stat-card {
> > >   padding: 20px;
> > >   background: var(--bg-surface);
> > >   border-radius: var(--radius-lg);
> > > }
> > > .stat-value {
> > >   font-size: 28px;
> > >   font-weight: 700;
> > >   color: var(--text-primary);
> > > }
> > > .stat-value.highlight { color: var(--accent-primary); }
> > > .stat-value.positive { color: var(--semantic-positive); }
> > >
> > > /* Task Status */
> > > .task-status {
> > >   display: inline-flex;
> > >   align-items: center;
> > >   gap: 6px;
> > >   padding: 6px 12px;
> > >   font-size: 12px;
> > >   font-weight: 500;
> > >   background: var(--bg-elevated);
> > >   border-radius: var(--radius-md);
> > > }
> > > .task-status[data-status="open"] { color: var(--text-secondary); }
> > > .task-status[data-status="in-progress"] {
> > >   color: var(--accent-primary);
> > >   background: var(--accent-primary-muted);
> > > }
> > > .task-status[data-status="done"] {
> > >   color: var(--semantic-positive);
> > >   background: rgba(34, 197, 94, 0.15);
> > > }
> > > ```
> > >
> > > ### Templates Page
> > >
> > > ```css
> > > /* Sidebar Selection */
> > > .template-list-item {
> > >   padding: 12px 16px;
> > >   border-radius: var(--radius-md);
> > > }
> > > .template-list-item:hover {
> > >   background: var(--bg-elevated);
> > > }
> > > .template-list-item.active {
> > >   background: var(--accent-primary-muted);
> > >   border-left: 3px solid var(--accent-primary);
> > >   margin-left: -3px;
> > > }
> > >
> > > /* Editor Toolbar */
> > > .editor-toolbar {
> > >   display: flex;
> > >   align-items: center;
> > >   gap: 4px;
> > >   padding: 8px;
> > >   background: var(--bg-base);
> > >   border-radius: var(--radius-md);
> > > }
> > > .toolbar-btn {
> > >   width: 32px;
> > >   height: 32px;
> > >   color: var(--text-secondary);
> > >   background: transparent;
> > >   border-radius: var(--radius-sm);
> > > }
> > > .toolbar-btn:hover {
> > >   color: var(--text-primary);
> > >   background: var(--bg-surface);
> > > }
> > > .toolbar-btn.active {
> > >   color: var(--accent-primary);
> > >   background: var(--accent-primary-muted);
> > > }
> > > ```
> > >
> > > ### Asset Detail Modal
> > >
> > > ```css
> > > /* Header */
> > > .asset-modal {
> > >   max-width: 1100px;
> > >   max-height: 85vh;
> > >   overflow: hidden;
> > >   display: grid;
> > >   grid-template-columns: 1fr 320px;
> > > }
> > >
> > > /* BULLISH/BEARISH - Simplified */
> > > .direction-indicator {
> > >   display: flex;
> > >   align-items: center;
> > >   gap: 8px;
> > >   padding: 12px 16px;
> > >   border-radius: var(--radius-lg);
> > > }
> > > .direction-indicator.bullish {
> > >   color: var(--semantic-positive);
> > >   background: rgba(34, 197, 94, 0.1);
> > > }
> > > .direction-indicator.bearish {
> > >   color: var(--semantic-negative);
> > >   background: rgba(239, 68, 68, 0.1);
> > > }
> > > .direction-indicator-label {
> > >   font-size: 14px;
> > >   font-weight: 600;
> > >   text-transform: uppercase;
> > >   letter-spacing: 0.02em;
> > > }
> > >
> > > /* Generate Documents - Match primary button */
> > > .generate-docs-btn {
> > >   /* Use .btn-primary styles, remove purple gradient */
> > >   background: var(--accent-primary);
> > >   color: #000000;
> > > }
> > > ```
> > >
> > > ### Feedback Modal
> > >
> > > ```css
> > > /* Type Selection - Status neutral */
> > > .feedback-type {
> > >   display: flex;
> > >   gap: 8px;
> > > }
> > > .feedback-type-option {
> > >   flex: 1;
> > >   padding: 12px;
> > >   text-align: center;
> > >   background: var(--bg-elevated);
> > >   border: 1px solid transparent;
> > >   border-radius: var(--radius-md);
> > > }
> > > .feedback-type-option.selected {
> > >   border-color: var(--accent-primary);
> > >   background: var(--accent-primary-muted);
> > > }
> > > /* Use consistent icon styling - outline OR filled, not both */
> > > ```
> > >
> > > ---
> > >
> > > ## CSS Variables Summary
> > >
> > > ```css
> > > :root {
> > >   /* Backgrounds */
> > >   --bg-base: #0a0a0f;
> > >   --bg-surface: #12121a;
> > >   --bg-elevated: #1a1a24;
> > >   --bg-overlay: #22222e;
> > >
> > >   /* Text */
> > >   --text-primary: #ffffff;
> > >   --text-secondary: rgba(255,255,255,0.7);
> > >   --text-tertiary: rgba(255,255,255,0.5);
> > >   --text-disabled: rgba(255,255,255,0.3);
> > >
> > >   /* Primary Accent */
> > >   --accent-primary: #22d3ee;
> > >   --accent-primary-hover: #06b6d4;
> > >   --accent-primary-muted: rgba(34,211,238,0.15);
> > >   --accent-primary-border: rgba(34,211,238,0.3);
> > >
> > >   /* Semantic */
> > >   --semantic-positive: #22c55e;
> > >   --semantic-negative: #ef4444;
> > >   --semantic-warning: #f59e0b;
> > >   --semantic-neutral: rgba(255,255,255,0.5);
> > >
> > >   /* Borders */
> > >   --border-subtle: rgba(255,255,255,0.06);
> > >   --border-default: rgba(255,255,255,0.1);
> > >   --border-focus: var(--accent-primary);
> > >
> > >   /* Radius */
> > >   --radius-sm: 4px;
> > >   --radius-md: 6px;
> > >   --radius-lg: 8px;
> > >   --radius-xl: 12px;
> > >   --radius-full: 9999px;
> > >
> > >   /* Shadows */
> > >   --shadow-sm: 0 1px 2px rgba(0,0,0,0.3);
> > >   --shadow-md: 0 4px 12px rgba(0,0,0,0.4);
> > >   --shadow-lg: 0 8px 24px rgba(0,0,0,0.5);
> > >
> > >   /* Spacing */
> > >   --space-1: 4px;
> > >   --space-2: 8px;
> > >   --space-3: 12px;
> > >   --space-4: 16px;
> > >   --space-5: 20px;
> > >   --space-6: 24px;
> > >   --space-8: 32px;
> > >   --space-10: 40px;
> > >   --space-12: 48px;
> > >
> > >   /* Fonts */
> > >   --font-sans: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
> > >   --font-mono: 'JetBrains Mono', 'SF Mono', Consolas, monospace;
> > > }
> > > ```
> > >
> > > ---
> > >
> > > ## Implementation Checklist
> > >
> > > - [ ] Replace all color values with CSS variables
> > > - [ ] - [ ] Remove purple gradient from "Generate All Documents"
> > > - [ ] - [ ] Standardize all badges to one component
> > > - [ ] - [ ] Simplify pipeline diagram to single color
> > > - [ ] - [ ] Increase sidebar item padding
> > > - [ ] - [ ] Remove card borders, use background differentiation
> > > - [ ] - [ ] Standardize all button colors to primary accent
> > > - [ ] - [ ] Fix typography case conventions
> > > - [ ] - [ ] Increase icon button hit areas to 32x32px
> > > - [ ] - [ ] Remove or enlarge sparklines
> > >
> > > - [ ] ---
> > >
> > > - [ ] *Generated from UI/UX audit conducted January 2026*
