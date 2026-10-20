# Contributing

Use Node.js 22 or later. Start with `npm run check`, `npm test` and `npm run build`. Serve `dist/` with `npm start`.

For UI changes, install the locked browser test dependency with `npm ci --ignore-scripts`, install Playwright's Chromium/WebKit browsers, then run `npm run test:browser`. Check the affected workflow manually as well. Browser emulation does not replace real touch-device checks.

Keep résumé content local. Use fictional Tarun B data in fixtures, screenshots and bug reports. Do not commit real résumés, session backups, browser profiles, generated artifacts or credentials.

Preserve compatibility with existing storage keys and embedded source formats. Add regressions for conversion or recovery bugs. Do not claim ATS compatibility or format speed without a stated method and evidence. Keep code comments focused on behavior and constraints.

Describe what changed, why it changed and which checks passed. For export changes, inspect PDF/DOCX appearance and extracted text. Do not remove third-party license notices.
