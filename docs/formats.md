# Source and document formats

## One saved model

The workspace saves a JSON object. JSON and XML expose the same model, including custom fields and layout data. Markdown and LaTeX are editing views with linked fields. Switching source tabs preserves content, punctuation, empty values and field order.

Invalid source is stored as a draft. The last valid model remains available for preview and session backup. Conversion, document editing and ordinary exports are blocked until the draft is corrected. Session ZIP export remains available.

## XML version 1

This application uses a versioned XML representation of its saved model. The root is `<resume version="1">`. Object properties use `field` elements with `name` attributes; array entries use `item` elements. Every value has a `type`: `object`, `array`, `string`, `number`, `boolean` or `null`.

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

Order follows object insertion order and array order. Empty arrays, objects and strings remain distinct. XML entities escape markup characters. Strings with control characters, carriage returns or unpaired surrogates use `encoding="json"`; names can use `name-encoding="json"`. This preserves the original JSON string values.

The reader rejects DTDs, external entity declarations, duplicate fields, unsafe property names, unknown types and malformed elements. Limits are 80 nested levels and 100,000 elements. Parsing runs locally.

## JSON Resume

Import and export adapters map the app's `experience` to `work`, profile text to `basics.summary`, and skills to JSON Resume skill entries. Standard content fields follow the [JSON Resume schema](https://jsonresume.org/schema). Layout and exact custom app data are stored separately under `meta.resume20`.

When importing external JSON Resume data, unmapped collections and nested source details are retained in layout extensions for re-export. Review date labels when exchanging data with another résumé tool.

## Documents

| Format | Purpose | Restoration |
| --- | --- | --- |
| JSON / XML | Complete app model | Exact model |
| JSON Resume | Exchange with other résumé tools | App extension retains the original model |
| PDF | Fixed application document | Embedded JSON restores the app model |
| DOCX | Editable Word document | Native Word XML plus embedded app JSON |
| HTML | Web document | Inert JSON payload restores app content |
| Markdown / LaTeX | Readable source and supported field edits | Linked fields and formatting metadata; external documents require review |
| Text | Plain readable content | Heuristic extraction with review |
| ZIP | Full workspace backup | Merge folders, résumés, templates, drafts, checkpoints and settings |

Imports detect content before relying on the filename. HTML imports use an inert document parser. External PDF/DOCX imports extract selectable text and open a review step.

## Recorded application-form comparison

The two tabs compare JSON / Word / PDF and XML / Word / PDF. Each uses the same fictional Tarun B content and document copies. The 12 mapped fields include five intentionally empty values; preserving those blanks counts as a match.

Run `npm ci --ignore-scripts` and `npm run benchmark` to refresh the recorded result and the bundled data script. The runner calls the PDF/DOCX readers and field mapper in Node. Files are processed locally. JSON and XML use their structured readers. Embedded restoration data is bypassed when comparing document text.

One in-memory read, extraction, classification and mapping pass is timed per file. Fixed order is JSON, XML, Word, PDF; PDF includes cold worker startup. The report records each local measurement. Playback expands the longest duration to 16 seconds with the same multiplier for all formats. Gradual field filling is illustrative.

The current fixture’s “Résumé maker” job title needs correction after text classification. The highlighted Word/PDF values come from that actual extraction and classification; the source readers preserve their named fields. The downloadable files, hashes, extracted text and scores are included with the report.

`create-fixtures.py` regenerates PDF and DOCX from `tarun.json`; it optionally needs Python 3, `reportlab` and `python-docx`. The app and static build use Node.js.
