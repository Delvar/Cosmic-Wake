# Testing

## Current state

- This repository has no automated runtime tests for the game.
- `npm test` is currently a placeholder and will fail.
- `npm run lint` is available for source validation.

## Recommended practice

- Use manual browser testing by opening or refreshing `index.html`.
- Validate gameplay, rendering, and AI behaviour in the browser.
- Use `npm run lint` to catch JavaScript/ESLint issues.

## Practical guidance

- For bug fixes, reproduce the issue in the browser and verify the fix manually.
- For rendering changes, inspect the canvas output visually.
- For AI and behaviour changes, test the relevant ship or job flows in-game.
- Add automated tests only when the project adopts a test framework.

