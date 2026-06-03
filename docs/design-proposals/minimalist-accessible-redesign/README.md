# Minimalist Accessible Redesign Proposal

This proposal applies the graphic designer agent persona from `docs/DESIGNER-AGENT.md` to the current Duplicate Reviewer and Salesforce Scheduler apps.

## Direction

- Keep the apps as operational tools, not landing pages.
- Use one shared app shell, title scale, subtitle scale, button sizing, and spacing system.
- Use bright, high-contrast semantic color:
  - Blue: primary action and focus.
  - Teal/green: connected, success, ready.
  - Amber: setup needed, caution, recoverable blocker.
  - Red: destructive or unrecoverable error.
- Keep controls compact but not crowded.
- Keep comparison and job data scannable with stable rows and clear status labels.
- Never hide required content below a non-scrollable viewport.

## Duplicate Reviewer Proposal

- Move toward a two-column operational workspace: controls and group list on the left, review/merge workspace on the right.
- Make merge blockers visible before the final submit button.
- For missing Contact IDs, show a single recovery action: `Load Latest Contacts`.
- Reduce visual weight in Label Status and Recent Files.
- Keep field comparison dense, but use stronger row labels and selected states.

## Scheduler Proposal

- Make the pull list/table the primary surface.
- Keep `New Pull` and job load status centered in the shared header.
- Treat the New Pull form as a compact step-based wizard.
- Keep Salesforce org and Report ID first.
- Keep schedule controls explicit: segmented schedule type, dropdown counts, and visible time selectors.

## Screenshots

Screenshots are generated from `index.html`:

- `duplicate-reviewer-redesign.png`
- `scheduler-redesign.png`

These are proposal screenshots, not production UI. Use them as design direction for future implementation passes and verify any built feature against the app-specific Hume review before release.
