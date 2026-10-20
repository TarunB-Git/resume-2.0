const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const crypto = require("node:crypto");
const root = path.join(__dirname, "..");
const source = (file) => fs.readFileSync(path.join(root, file), "utf8");
const studio = source("site/assets/studio.js"),
  v2 = source("site/assets/workspace-v2.js");
const between = (text, a, b) => {
  const start = text.indexOf(a),
    end = text.indexOf(b, start + a.length);
  assert.ok(start >= 0 && end > start);
  return text.slice(start, end);
};
const report = JSON.parse(source("site/benchmark/result.json"));
test("Comparison tabs use JSON/Word/PDF and XML/Word/PDF with the same Tarun B data", () => {
  const c = { window: { FormaBenchmark: report } };
  vm.createContext(c);
  vm.runInContext(between(studio, "let comparisonSource =", "function showRecordedBenchmark("), c);
  assert.deepEqual(
    Array.from(c.comparisonRows(), (row) => row.format),
    ["json", "docx", "pdf"],
  );
  vm.runInContext('comparisonSource="xml"', c);
  assert.deepEqual(
    Array.from(c.comparisonRows(), (row) => row.format),
    ["xml", "docx", "pdf"],
  );
  vm.runInContext(between(studio, "function recordedDuration(", "const walkthrough ="), c);
  assert.equal(Math.round(Math.max(...c.comparisonRows().map(c.recordedDuration))), 16000);
  for (const row of c.comparisonRows()) {
    assert.equal(c.recordedProgress(row, 0), 0);
    assert.equal(c.recordedProgress(row, c.recordedDuration(row)), 1);
  }
  assert.equal(report.samples.length, 1);
  assert.equal(report.samples[0].name, "Tarun B");
});
test("Every recorded result matches a real bundled file and its extracted fields", () => {
  const mapper = require("../site/assets/resume-parser.js");
  for (const row of report.samples[0].results) {
    const bytes = fs.readFileSync(path.join(root, "site/benchmark", row.file));
    assert.equal(row.bytes, bytes.length);
    assert.equal(row.sha256, crypto.createHash("sha256").update(bytes).digest("hex"));
    assert.equal(row.correct, row.fields.filter((field) => field.status === "correct").length);
    assert.ok(row.elapsed_ms > 0);
    if (["pdf", "docx"].includes(row.format)) {
      assert.match(row.extracted_text, /Tarun B/);
      assert.match(row.extracted_text, /Résumé maker/);
      assert.deepEqual(
        mapper.evaluate(
          mapper.fillForm(mapper.parseText(row.extracted_text)),
          report.samples[0].expected,
        ).fields,
        row.fields,
      );
    }
  }
});
test("Safari gesture events scale once when touch and native events overlap", () => {
  const handlers = {},
    options = {},
    changes = [];
  let scale = 1,
    prevented = 0;
  const host = {
    clientHeight: 500,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 300, height: 500 }),
    addEventListener: (name, fn, opts) => {
      handlers[name] = fn;
      options[name] = opts;
    },
  };
  const c = {};
  vm.createContext(c);
  vm.runInContext(between(v2, "function attachPinchZoom(", "function syncViewportHeight("), c);
  c.attachPinchZoom(
    host,
    () => scale,
    (value, anchor) => {
      scale = value;
      changes.push([value, anchor]);
    },
  );
  const event = (extra) => ({
    cancelable: true,
    preventDefault() {
      prevented++;
    },
    ...extra,
  });
  const touches = [
    { clientX: 50, clientY: 100 },
    { clientX: 150, clientY: 100 },
  ];
  handlers.touchstart(event({ touches }));
  handlers.gesturestart(event({ scale: 1 }));
  handlers.touchmove(event({ touches: [touches[0], { clientX: 250, clientY: 100 }] }));
  assert.equal(changes.length, 0);
  handlers.gesturechange(event({ scale: 2, clientX: 150, clientY: 100 }));
  assert.equal(scale, 2);
  assert.equal(changes.length, 1);
  handlers.wheel(event({ ctrlKey: true, deltaY: -100 }));
  assert.equal(changes.length, 1);
  handlers.gestureend(event({}));
  handlers.wheel(event({ ctrlKey: true, deltaY: -10, clientX: 100, clientY: 100 }));
  assert.ok(scale > 2 && scale <= 3);
  assert.ok(prevented > 0);
  assert.equal(options.touchstart.capture, true);
  assert.equal(options.gesturechange.passive, false);
  handlers.gesturestart(event({ scale: 1 }));
  handlers.touchcancel();
  const count = changes.length;
  handlers.wheel(event({ ctrlKey: true, deltaY: 10 }));
  assert.equal(changes.length, count + 1);
});
test("One-finger scrolling stays native and wheel line/page units are handled", () => {
  const handlers = {};
  let scale = 1;
  const host = { clientHeight: 500, addEventListener: (name, fn) => (handlers[name] = fn) };
  const c = {};
  vm.createContext(c);
  vm.runInContext(between(v2, "function attachPinchZoom(", "function syncViewportHeight("), c);
  c.attachPinchZoom(
    host,
    () => scale,
    (value) => (scale = value),
  );
  const event = {
    touches: [{ clientX: 10, clientY: 20 }],
    preventDefault() {
      throw Error("Single-finger scroll consumed");
    },
  };
  handlers.touchstart(event);
  handlers.touchmove(event);
  handlers.wheel({
    ctrlKey: true,
    deltaMode: 1,
    deltaY: 1,
    clientX: 20,
    clientY: 20,
    preventDefault() {},
  });
  assert.ok(Math.abs(scale - Math.exp(-0.128)) < 1e-9);
});
test("Mobile viewport sizing follows the keyboard but preserves browser accessibility zoom", () => {
  const changes = [];
  const c = {
    window: { innerHeight: 800, visualViewport: { height: 500, scale: 1 } },
    document: { documentElement: { style: { setProperty: (...args) => changes.push(args) } } },
  };
  vm.createContext(c);
  vm.runInContext(between(v2, "function syncViewportHeight(", "function showMobilePane("), c);
  c.syncViewportHeight();
  assert.deepEqual(changes[0], ["--app-height", "500px"]);
  c.window.visualViewport.height = 250;
  c.window.visualViewport.scale = 2;
  c.syncViewportHeight();
  assert.equal(changes.length, 1);
});
test("Header order, restored subtext and removal of the 900px mobile minimum are explicit", () => {
  const html = source("site/index.html"),
    css = source("site/assets/resume-v2.css");
  const group = html.indexOf('class="compile-actions"');
  assert.ok(group >= 0);
  const compile = html.indexOf('id="compileButton"', group),
    help = html.indexOf('class="compile-guide"', group),
    bug = html.indexOf('id="reportBugButton"', group);
  assert.ok(compile < help && help < bug);
  assert.ok(html.replace(/\s+/g, " ").includes("The question is - Why not JSON?"));
  assert.ok(html.includes("JSON vs Word vs PDF"));
  assert.ok(html.includes("XML vs Word vs PDF"));
  assert.ok(!/minmax\(900px/.test(source("site/assets/studio.css")));
  assert.match(css, /touch-action:\s*pan-x pan-y/);
  assert.match(css, /#headerImportButton \.action-label/);
  assert.match(css, /#exportButton \.action-label/);
});
