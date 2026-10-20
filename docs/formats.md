# Source and document formats

## One saved model

The workspace saves a JSON object. JSON and XML expose the same model, including custom fields and layout data. Markdown and LaTeX are editing views with linked fields. Switching source tabs without editing must leave content, punctuation, empty values and field order unchanged.

Invalid source is stored as a draft. The last valid model remains available for preview and session backup. Conversion, document editing and ordinary exports are blocked until the draft is corrected. Session ZIP export remains available.

## XML version 1

This is an application format, not HR-XML or an HR vendor's schema. The root is `<resume version="1">`. Object properties use `field` elements with `name` attributes; array entries use `item` elements. Every value has a `type`: `object`, `array`, `string`, `number`, `boolean` or `null`.

```xml
<?xml version="1.0" encoding="UTF-8"?>
<resume version="1">
  <field name="basics" type="object">
    <field name="name" type="string">Tarun B</field>
  </field>
  <field name="skills" type="array">
    <item type="string">HTML</item>
    <item type="string"></item>
  </field>
</resume>
```

Order follows object insertion order and array order. Empty arrays, objects and strings remain distinct. XML entities escape markup characters. Strings with control characters, carriage returns or unpaired surrogates use `encoding="json"`; names can use `name-encoding="json"`. This preserves values that XML text cannot represent directly.

The reader rejects DTDs, external entity declarations, duplicate fields, unsafe property names, unknown types and malformed elements. Limits are 80 nested levels and 100,000 elements. It never fetches external resources.

## JSON Resume

Import and export adapters map the app's `experience` to `work`, profile text to `basics.summary`, and skills to JSON Resume skill entries. Standard content fields follow the [JSON Resume schema](https://jsonresume.org/schema). Layout and exact custom app data are stored separately under `meta.resume20`.

When importing external JSON Resume data, unmapped collections and nested source details are retained in layout extensions for re-export. Free-form date labels are not guaranteed to satisfy every consumer's date validator. Import review is still required.

## Documents

| Format | Purpose | Restoration |
| --- | --- | --- |
| JSON / XML | Complete app model | Exact model |
| JSON Resume | Exchange with other résumé tools | App extension retains the original model |
| PDF | Fixed application document with associated JSON files | Exact source in compatible readers; other readers may ignore attachments |
| DOCX | Editable Word document | Native Word XML plus embedded app JSON |
| HTML | Portable Human / PDF / JSON document | Inert JSON payload restores app content |
| Markdown / LaTeX | Readable source and supported field edits | Linked fields and formatting metadata; external documents require review |
| Text | Plain readable content | Heuristic extraction with review |
| ZIP | Full workspace backup | Merge folders, résumés, templates, drafts, checkpoints and settings |

Imports detect content before relying on the filename. HTML is parsed without executing scripts. External PDF/DOCX extraction does not promise layout recovery; images and OCR are not supported.

## Portable résumé version 1

The `.resume.html` export is one offline HTML document. Human presentation is sandboxed in an iframe. The PDF is embedded as base64 and opened locally through the browser's PDF viewer. JSON is stored as inert script data, with `<` escaped as `\u003c` so user content cannot terminate a data block. The reader's content security policy blocks background network connections. Viewing it does not upload résumé data or send analytics.

| HTML block ID | Type | Meaning |
| --- | --- | --- |
| `resume-manifest` | `application/json` | `format: "resume20.document"`, `version: 1`, block identifiers and media types |
| `resume-data` | `application/json` | JSON Resume fields, with exact app data under `meta.resume20` |
| `resume20-source` | `application/json` | Complete editable app model |
| `resume-person` | `application/ld+json` | Basic schema.org Person discovery fields; not the full résumé |
| `resume-pdf` | `application/octet-stream` | Base64-encoded PDF bytes |

A reader selects `script#resume-data[type="application/json"]` and parses its text as JSON. It must not execute the document. `ResumePortable.extract(html)` implements this contract for generated files; pass `"source"` as its second argument for the app model. The command-line reader accepts generated HTML, PDF and JSON, with a 50 MB file limit:

```sh
node scripts/read-resume.mjs tarun-b.resume.html
node scripts/read-resume.mjs tarun-b.pdf --source
```

The JSON mode displays the same exchange data that the machine reader extracts. Human, PDF and JSON views share one export snapshot. Reader themes affect the interface, not the saved content or PDF pagination. Importing HTML restores the source model; it does not import the viewer as editable content.

PDF exports use PDF 2.0 associated files: `resume.json` has `/AFRelationship /Data`; `resume20-source.json` has `/AFRelationship /Source`. Both also appear in the embedded-file name tree for readers that support attachments but not associated-file relationships. Content lengths and cross-reference offsets are measured in bytes. Legacy `forma-resume.json` attachments remain importable. This is not a claim of PDF/A or PDF/UA conformance.

Readers need explicit support for these structured blocks or attachments. Their presence does not cause every PDF text extractor or ATS to return JSON. PDF text retains its visible résumé content; copy/paste and ordinary text extraction do not become JSON. The reader command fails clearly when a PDF has no structured attachment, rather than treating extracted text as exact source.

## Recorded application-form comparison

The two tabs compare JSON / Word / PDF and XML / Word / PDF. Each uses the same fictional Tarun B content and document copies. The 12 mapped fields include five intentionally empty values; preserving those blanks counts as a match.

Run `npm ci --ignore-scripts` and `npm run benchmark` to refresh the recorded result and the bundled data script. The runner calls the PDF/DOCX readers and field mapper in Node. Files are processed locally. JSON and XML use their structured readers. Embedded restoration data is bypassed when comparing document text.

One in-memory read, extraction, classification and mapping pass is timed per file. File loading from disk, dependency imports and scoring are excluded. Fixed order is JSON, XML, Word, PDF; PDF includes cold worker startup. These are recorded local measurements, not averages, a universal parsing comparison or an ATS score. Playback expands the longest duration to 16 seconds with the same multiplier for all formats. Gradual field filling is illustrative.

The current fixture's “Résumé maker” job title is not recognized by the text classifier's job-title rules. The highlighted Word/PDF values come from that actual extraction and classification; the source readers preserve their named fields. The downloadable files, hashes, extracted text and scores are included with the report.

`create-fixtures.py` regenerates PDF and DOCX from `tarun.json`; it optionally needs Python 3, `reportlab` and `python-docx`. The app and static build do not require Python.
