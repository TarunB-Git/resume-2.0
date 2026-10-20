# Résumé 2.0

A browser-local résumé editor with portable source, direct document editing and complete session backups.

The app runs as a static site. Résumé content stays in the browser; there are no accounts, analytics or upload service.

## Use it locally

Requires Node.js 22 or later. The app itself has no runtime package dependencies.

```sh
npm run check
npm test
npm run build
npm start
```

Open `http://127.0.0.1:4173`. The build copies `site/` to `dist/`, which can be served by any static host. Local assets include the icon font, PDF viewer and its worker.

## Workflow

1. Start from the fictional Tarun B sample or import an existing document.
2. Edit JSON, XML, Markdown or the supported LaTeX fields. Switch to **Document** on a phone.
3. Edit PDF preview fields directly, or choose **Word** to add paragraphs, remove lines and format text freely.
4. Use **Compile** to save a local checkpoint and review changes. This does not invoke a TeX compiler or connect collaborators.
5. Export a PDF or DOCX for applications. Export a session ZIP to back up every résumé, source draft, folder and template.

Browser storage belongs to the current origin. Session ZIP files transfer work between origins and devices. Clearing site storage removes the local workspace.

## Capabilities

- JSON as the saved model, with a versioned XML view and JSON Resume adapters.
- Shared Undo/Redo across source editors and document editing.
- Recovery of invalid source drafts while retaining the last valid preview.
- PDF, DOCX, JSON, XML, JSON Resume, LaTeX, Markdown, HTML and text export; ZIP exports the whole workspace.
- Import review for external documents; exact embedded source recovery from this app's PDF, DOCX and HTML exports.
- Files and folders, drag-and-drop imports, a Move to folder menu, reusable templates and local checkpoints.
- Resizable desktop panes; Source / Document switching and a Files drawer on small screens.
- Fit width/page and document zoom from 25% to 300%, including pinch and ctrl-wheel gestures.

The Why JSON page has two comparison tabs: JSON / Word / PDF and XML / Word / PDF. Both use the same Tarun B content. Recorded timings come from a local run of the actual document readers and field mapper; they do not measure an ATS.

## Formats and limits

JSON is the default because the app already uses a JSON model and a native JSON reader. XML is equally capable of representing the saved content; the XML adapter adds conversion work and larger markup here. Neither format decides how the résumé looks or guarantees ATS compatibility.

External PDF and Word documents can lose ordering, grouping and layout during extraction. Scanned PDFs need OCR, which is not included. LaTeX support edits linked fields and selected styles; it is not a full typesetting engine. The compact PDF writer has limited font coverage; **Print / PDF** uses browser fonts for broader Unicode support.

For applications, inspect the exported document, select its text and check reading order. Embedded JSON helps restore this editor's content; ATS readers may ignore it. Keep a simple single-column application layout available alongside designed templates.

See [format details](docs/formats.md) and [session restoration](docs/sessions.md).

## Engineering

| Location | Purpose |
| --- | --- |
| `site/assets/studio.js` | Workspace, rendering, import and export orchestration |
| `site/assets/editor-features.js` | Rich document editing, history, checkpoints and archives |
| `site/assets/formats.js` | Portable XML, JSON Resume, session merge and format measurements |
| `site/assets/workspace-v2.js` | Source draft recovery, responsive controls and gesture zoom |
| `site/assets/resume-parser.js` | Local text extraction mapping and comparison fields |
| `tests/` | Data regressions, isolated editor callbacks and browser workflows |
| `examples/tarun.json` | The only bundled résumé example; all details are fictional |

No framework or backend is required. The pure format module also runs in Node. The build is a reproducible copy of static source rather than a server bundle.

### Checks

```sh
npm run check
npm test
npm run build
npm ci --ignore-scripts
npm run benchmark
```

To run browser workflows and produce screenshots with synthetic data:

```sh
npm ci --ignore-scripts
npx playwright install --with-deps chromium webkit
npm run test:browser
```

The comparison uses the downloadable files in `site/benchmark/`. To regenerate its PDF/DOCX fixtures, use `python3 site/benchmark/create-fixtures.py` with `reportlab` and `python-docx` installed, then run `npm run benchmark`. Fixture generation is optional; the static build uses the checked-in files.

The browser suite covers 320, 390, 768, 997 and 1280px in Chromium and WebKit. It is separate from the fast data tests. Real iOS/Android gestures and visual PDF/DOCX review remain manual release checks. Screenshots and exported fixtures go to ignored `artifacts/`. Automated gesture tests establish event handling and scale geometry; they do not establish physical-device behavior.


## Contributing and license

See [CONTRIBUTING.md](CONTRIBUTING.md). Licensed under [Apache 2.0](LICENSE). Bundled third-party components retain their own notices.
