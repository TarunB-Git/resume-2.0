const fs = require("node:fs");
const path = require("node:path");
const formats = require("../assets/formats.js");
const mapper = require("../assets/resume-parser.js");
const example = require("./tarun.json");
const report = formats.compareFormats(example, mapper);
report.environment = { runtime: "Node.js", version: process.version };
report.method =
  "Median of 15 batches × 20 parse-and-map operations after warm-up; alternate execution order. No file reading, rendering or scoring is timed.";
fs.writeFileSync(path.join(__dirname, "result.json"), JSON.stringify(report, null, 2) + "\n");
for (const row of report.samples[0].results)
  console.log(
    `${row.format.toUpperCase()}: ${row.correct}/${row.total} fields; ${row.elapsed_ms} ms median; ${row.bytes} bytes`,
  );
