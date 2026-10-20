# Contributing

Development requires Node.js 22 or later.

```sh
npm ci --ignore-scripts
npm run check
npm test
npm run build
```

Browser tests use Playwright:

```sh
npx playwright install --with-deps chromium webkit
npm run test:browser
```

Use synthetic résumé data for fixtures and screenshots. Personal résumés, session backups, browser profiles and credentials must stay out of commits.

Changes to conversion, session recovery or history need regression coverage. Existing storage keys and embedded restoration formats must remain compatible. Renderer changes also need a visual check of PDF/DOCX output and extracted reading order.

Pull requests should describe the change and its verification. Retain third-party license notices.
