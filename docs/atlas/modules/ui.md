# Module: UI

## Responsibility

The UI module provides DOM-based user interface components for the game, specifically managing various in-game windows that display information and allow player interaction. It handles advanced window behaviors like multi-directional resizing, dragging, automatic edge and center pinning, visibility toggling, and faction-based tinting. The module separates UI logic from game logic, allowing for clean updates based on game state.

This module is responsible for:

- Advanced window management with full 8-way resizing, dragging, pinning to screen edges/center, show/hide, and faction-based tinting (`UiDomWindow`)
- Docking interface with buttons for takeoff, repair, mining, and capture actions (`UiDomWindowDocking`)
- In-game log display with automatic message fading and line limits (`UiDomWindowLog`)
- Player ship status display (hull and shield bars) (`UiDomWindowStats`)
- Target information display with faction tinting and status bars (`UiDomWindowTarget`)

## Main files

- `src/ui/uiDomWindow.js`
- `src/ui/uiDomWindowDocking.js`
- `src/ui/uiDomWindowLog.js`
- `src/ui/uiDomWindowStats.js`
- `src/ui/uiDomWindowTarget.js`

## Existing patterns

- `UiDomWindow` is the abstract base class for all UI windows.
  - Provides full 8-way resizing (top-left, top, top-right, left, right, bottom-left, bottom, bottom-right) via dedicated handles, with min/max constraints and nested resizable element support.
  - Supports dragging for repositioning, with automatic evaluation and application of pinning states upon drag end.
  - Implements automatic pinning to screen edges (top, bottom, left, right) and center (horizontal/vertical/both) based on window position relative to defined zones (100px corner zones, 50px edge thickness, 25% central zone).
  - Resize handles are dynamically hidden when pinned to adjacent edges to prevent invalid resizes.
  - Uses CSS transforms for precise centring and absolute positioning for edges.
  - Handles browser window resizes to maintain pinned positions.
  - Provides show/hide functionality and faction-based tinting using CSS classes.
  - Uses caching and diffing to avoid unnecessary DOM updates (in subclasses).
- All specific windows extend `UiDomWindow` and override `update()` for state synchronization.
  - `UiDomWindowDocking`: Manages button states based on `DockingContext`, handles click events.
  - `UiDomWindowLog`: Adds log messages with fade-in/out animations, limits line count.
  - `UiDomWindowStats`: Updates player ship's hull/shield percentages and pulse effects.
  - `UiDomWindowTarget`: Displays target name, faction, hull/shield with tinting based on relationship.
- Button states use an enum (`ButtonState`) for type safety: HIDDEN, ACTIVE, DISABLED.
- DOM updates are diffed against last displayed values to minimize changes.
- Tint classes (`tint-allied`, `tint-neutral`, `tint-hostile`, `tint-disabled`) are applied based on `FactionRelationship`.
- Resizing and dragging affect associated components (cameras, HUDs, starfields) in target window via overridden `_onResize()` and `_onResizeEnd()` methods.

## Things to avoid

- Avoid adding game logic or state management to UI classes.
  - UI should only reflect game state and forward events, not make decisions.
- Avoid direct DOM manipulation outside of update methods.
  - Use cached values and diffing to prevent unnecessary updates.
- Avoid resizing pinned windows in ways that violate pin constraints; handles are hidden accordingly.
- Avoid hardcoding element IDs; use constructor parameters for flexibility.
- When overriding resize callbacks, ensure compatibility with pinning states.