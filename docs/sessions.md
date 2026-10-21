# Back up and restore a workspace

Choose **Export → ZIP** to download all résumés and formats. The archive contains:

- `session.json`: version 1 manifest, workspace, template library and view settings.
- `workspace.json` and `templates.json`: compatibility files for older exports.
- Per résumé: PDF, DOCX, JSON, XML, JSON Resume, Markdown, LaTeX, HTML, text and template definition.
- Invalid JSON/source drafts, where present.

Folder paths in the archive are readable names. The manifest preserves identities, nesting, checkpoints, active résumé and open tabs. Duplicate filenames receive a suffix.

Use **Import** and choose the ZIP (up to 100 MB; individual document imports are limited to 15 MB). Review the counts, then choose **Add session**. The app adds the imported records and selects the imported active résumé. Existing records are retained. Conflicting folder, résumé, template and checkpoint identifiers are remapped. Imported view and source/output modes become active. Compatible old archives with `workspace.json` are also supported.

A backup contains the information entered into the editor, including drafts and checkpoint history. Store and share it accordingly. Bug reports use the information entered into the issue form.

Browser storage is isolated by origin. A session ZIP transfers the workspace between local files, local servers and hosted versions. The original backup remains independent of the restored copy.
