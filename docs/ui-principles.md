# Managed App UI Principles

- Keep app workflows task-first. Avoid marketing-style pages for operational tools.
- Use the shared base CSS for tokens, reset behavior, focus rings, and form defaults.
- Keep app-specific layouts, data density, and workflow affordances in the app's own CSS.
- Wherever possible, show, don't tell. Keep verbosity to a minimum, and communicate features and calls to action with visual language while preserving accessible labels.
- Ensure root or panel scrolling remains available whenever content exceeds the viewport.
- Use responsive constraints and stable dimensions for controls, grids, sidebars, cards, and toolbars.
- Move CPU-heavy browser work such as large-file parsing, duplicate matching, scoring, or export preparation into a Web Worker when the app runs from a local server. Keep simple network requests and DOM rendering on the main thread.
