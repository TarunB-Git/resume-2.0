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
| PDF | Fixed application document | This app embeds JSON; external readers may ignore it |
| DOCX | Editable Word document | Native Word XML plus embedded app JSON |
| HTML | Web document | Inert JSON payload restores app content |
| Markdown / LaTeX | Readable source and supported field edits | Linked fields and formatting metadata; external documents require review |
| Text | Plain readable content | Heuristic extraction with review |
| ZIP | Full workspace backup | Merge folders, résumés, templates, drafts, checkpoints and settings |

Imports detect content before relying on the filename. HTML is parsed without executing scripts. External PDF/DOCX extraction does not promise layout recovery; images and OCR are not supported.

## JSON/XML measurement

Run `node site/benchmark/benchmark.cjs` to refresh the saved Node report. The in-app demonstration measures the current browser independently.

The 12 mapped fields include five intentionally empty values; preservation of those blanks counts as a match. Both paths serialize the same Tarun B model with two-space indentation before measurement, warm up the readers, then alternate 15 batches of 20 parse-and-map operations. The report uses the median batch time per operation and reports payload bytes. File reading, rendering and scoring are excluded. Playback expands the slower median to six seconds using the same multiplier for both paths; gradual field filling is illustrative.

The native JSON reader and this app's typed XML reader are different implementations. These results justify the default for this app only. They do not establish a universal parsing advantage, better résumé design or an ATS score. The former PDF/Word recordings were historical demonstrations of parser failures that have since been fixed; they are no longer the comparison shown in the app.
