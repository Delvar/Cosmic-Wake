# Module: UI

## Responsibility

The UI module provides DOM-based user interface components for the game, specifically managing various in-game windows that display information and allow player interaction. It handles window behaviors like resizing, dragging, visibility toggling, and faction-based tinting. The module separates UI logic from game logic, allowing for clean updates based on game state.

This module is responsible for:

- Base window management with resizing, dragging, and visibility controls (`UiDomWindow`)
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
  - Provides resizing (currently bottom-right corner), dragging, show/hide, and faction-based tinting.
  - Uses caching to avoid unnecessary DOM updates.
  - Enforces min/max width/height constraints.
- All specific windows extend `UiDomWindow` and override `update()` for state synchronization.
  - `UiDomWindowDocking`: Manages button states based on `DockingContext`, handles click events.
  - `UiDomWindowLog`: Adds log messages with fade-in/out animations, limits line count.
  - `UiDomWindowStats`: Updates player ship's hull/shield percentages and pulse effects.
  - `UiDomWindowTarget`: Displays target name, faction, hull/shield with tinting based on relationship.
- Button states use an enum (`ButtonState`) for type safety: HIDDEN, ACTIVE, DISABLED.
- DOM updates are diffed against last displayed values to minimize changes.
- Tint classes (`tint-allied`, `tint-neutral`, `tint-hostile`, `tint-disabled`) are applied based on `FactionRelationship`.
- Resizing affects associated components (cameras, HUDs, starfields) in target window.

## Things to avoid

- Avoid adding game logic or state management to UI classes.
  - UI should only reflect game state and forward events, not make decisions.
- Avoid direct DOM manipulation outside of update methods.
  - Use cached values and diffing to prevent unnecessary updates.
- Avoid extending resizing beyond bottom-right corner without updating base class.
  - Current implementation only supports bottom-right resizing.
- Avoid hardcoding element IDs; use constructor parameters for flexibility.