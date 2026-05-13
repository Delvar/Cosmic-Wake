# Flow: Main user flow

## Purpose

Describe what the user is trying to achieve.

## User path

1. User opens:
2. User clicks:
3. App loads:
4. App displays:
5. User completes:

## Main files

- `src/App.js`
- `src/pages/<page>.js`
- `src/components/<component>.js`
- `src/services/<service>.js`

## Data flow

1. Component calls service.
2. Service fetches data.
3. Result is stored in state.
4. UI renders based on loading, success, empty, or error state.

## Error states

- Network failure:
- Empty response:
- Invalid user input:

## Tests

- `<test file>`

## Change guidance

When changing this flow:

- Start with `<file>`.
- Check `<related component>`.
- Run `<test command>`.