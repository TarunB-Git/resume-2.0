import { readFile, stat } from "node:fs/promises";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const portable = require("../site/assets/portable-resume.js");
const formats = require("../site/assets/formats.js");
const args = process.argv.slice(2);
if (args.includes("--help")) {
  console.log(
    "Usage: node scripts/read-resume.mjs FILE [--source]\nReads structured data from a portable résumé HTML, attached PDF, or JSON file. No OCR or HTML execution.",
  );
  process.exit(0);
}
const source = args.includes("--source"),
  files = args.filter((arg) => !arg.startsWith("--"));
try {
  if (files.length !== 1 || args.some((arg) => arg.startsWith("--") && arg !== "--source"))
    throw new Error("Usage: node scripts/read-resume.mjs FILE [--source]");
  const info = await stat(files[0]);
  if (!info.isFile() || info.size > 50 * 1024 * 1024)
    throw new Error("Input must be a file no larger than 50 MB.");
  const bytes = new Uint8Array(await readFile(files[0]));
  const text = new TextDecoder().decode(bytes);
  let value;
  if (text.startsWith("%PDF-")) {
    const pdfjs = require("../site/assets/pdf.min.js");
    pdfjs.GlobalWorkerOptions.workerSrc = require.resolve("../site/assets/pdf.worker.min.js");
    const task = pdfjs.getDocument({ data: bytes, isEvalSupported: false, verbosity: 0 });
    try {
      const pdf = await task.promise;
      const attachments = Object.values((await pdf.getAttachments()) || {});
      const find = (names) => attachments.find((item) => names.includes(item.filename));
      const app = find(["resume20-source.json", "forma-resume.json"]),
        standard = find(["resume.json"]);
      const attachment = source ? app || standard : standard || app;
      if (!attachment)
        throw new Error(
          "This PDF has no structured résumé attachment. Ordinary PDF text extraction is not a structured-data guarantee.",
        );
      value = JSON.parse(new TextDecoder().decode(attachment.content));
      formats.assertModel(value);
      if (source && attachment === standard) value = formats.fromJsonResume(value);
      if (!source && attachment !== standard) value = formats.toJsonResume(value);
    } finally {
      await task.destroy();
    }
  } else if (/^\s*\{/.test(text)) {
    value = formats.assertModel(JSON.parse(text));
    const standard = formats.isJsonResume(value);
    if (source && standard) value = formats.fromJsonResume(value);
    if (!source && !standard) value = formats.toJsonResume(value);
  } else {
    value = portable.extract(text, source ? "source" : "json");
  }
  formats.assertModel(value);
  process.stdout.write(JSON.stringify(value, null, 2) + "\n");
} catch (error) {
  process.stderr.write("Cannot read résumé: " + error.message + "\n");
  process.exitCode = 1;
}
