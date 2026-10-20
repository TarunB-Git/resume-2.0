# Back up and restore a workspace

Choose **Export → ZIP** to download all résumés and formats. The archive contains:

- `session.json`: version 1 manifest, workspace, template library and view settings.
- `workspace.json` and `templates.json`: compatibility files for older exports.
- Per résumé: PDF, DOCX, JSON, XML, JSON Resume, Markdown, LaTeX, HTML, text and template definition.
- Invalid JSON/source drafts, where present.

Folder paths in the archive are readable names. The manifest preserves identities, nesting, checkpoints, active résumé and open tabs. Duplicate filenames receive a suffix.

Use **Import** and choose the ZIP (up to 100 MB; individual document imports are limited to 15 MB). Review the counts, then choose **Add session**. The app adds the imported records and selects the imported active résumé. It does not overwrite existing records. Conflicting folder, résumé, template and checkpoint identifiers are remapped. Imported view and source/output modes become active. Compatible old archives with `workspace.json` are also supported.

A backup contains the information entered into the editor, including drafts and checkpoint history. Store and share it accordingly. A bug report never includes this archive automatically.

Browser storage does not move between `file://`, localhost and `https://resume.tarunb.me`. Export before changing origins. Import into the destination, inspect the restored files, and retain your backup until you have confirmed it.
