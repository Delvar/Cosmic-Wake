# Modules

Module docs explain implementation areas.

Create a module document when a folder or feature area is important enough that agents keep touching it.

When generating a new module document, use this structure:

- `Responsibility`
  - One short paragraph describing the module's purpose.
  - A concise bullet list of what it owns and coordinates.
- `Main files`
  - A short file list of the most important sources in the module.
- `Existing patterns`
  - Describe the recurring implementation patterns the module uses.
  - Include class/state conventions, common helpers, and interaction boundaries.
- `Things to avoid`
  - Call out anti-patterns and separations of concern to preserve.
- `Tests`
  - Note whether the module has coverage.
  - Suggest high-value test cases if tests are missing.
- `Change guidance`
  - Give practical advice for future edits.
  - Mention cross-module impacts and any stability concerns.
- `Open questions`
  - Add any uncertain design questions or areas needing review.

Examples:

- api-services.md
- routing.md
- forms.md
- state-management.md
- styling.md

> Keep module docs short, factual, and aligned with the actual code. Prefer the current codebase over assumed architecture.