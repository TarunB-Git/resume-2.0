const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const vm = require("node:vm");
const P = require("../site/assets/portable-resume.js");
const PDF = require("../site/assets/pdf-container.js");
const F = require("../site/assets/formats.js");
const sample = require("../examples/tarun.json");
const model = {
  ...sample,
  custom: {
    empty: "",
    accents: "Résumé · 日本語",
    lines: "one\ntwo",
    false: false,
    number: 12,
    nil: null,
    hostile: '</script><script>alert("x")</script>',
  },
};
const standard = F.toJsonResume(model);
const streams = [
  "BT /HB 24 Tf 50 760 Td (Tarun B) Tj ET\nBT /HR 12 Tf 50 735 Td (Resume maker) Tj ET",
];
streams.annotations = [[{ rect: [50, 700, 160, 720], url: "https://tarunb.me/?q=résumé" }]];
const pdf = () =>
  PDF.create({ streams, width: 595.28, height: 841.89, model, jsonResume: standard });
const html = () =>
  P.build({
    model,
    jsonResume: standard,
    pdfBytes: pdf(),
    filename: "tarun-b",
    documentHtml:
      '<!doctype html><html><head></head><body><article class="resume-paper"><h1>Tarun B</h1></article><script>alert("untrusted")</script></body></html>',
  });
const scripts = (value) => [...value.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)];

test("Portable résumé holds exact JSON and full source without running a renderer", () => {
  const value = html();
  assert.deepEqual(P.extract(value), standard);
  assert.deepEqual(P.extract(value, "source"), model);
  assert.equal(scripts(value).length, 6, "Five inert blocks and one viewer script");
  assert.ok(!value.includes(model.custom.hostile));
  assert.ok(value.includes('id="human-tab"'));
  assert.ok(value.includes('id="pdf-tab"'));
  assert.ok(value.includes('id="json-tab"'));
  const embedded = scripts(value).find((match) => match[1].includes('id="resume-pdf"'))[2];
  assert.deepEqual(Buffer.from(embedded, "base64"), Buffer.from(pdf()));
  const manifest = JSON.parse(
    scripts(value).find((match) => match[1].includes('id="resume-manifest"'))[2],
  );
  assert.equal(manifest.format, "resume20.document");
  assert.equal(manifest.version, 1);
});

test("Portable presentation is sandboxed and blocks background network requests", () => {
  const value = html();
  assert.ok(value.includes("connect-src 'none'"));
  assert.ok(
    value.includes(
      'sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-modals"',
    ),
  );
  assert.ok(!value.includes('sandbox="allow-scripts'));
  assert.ok(!value.includes("alert(&quot;untrusted&quot;)"));
  assert.ok(!/<(?:script|link)[^>]+(?:src|href)=/.test(value));
  assert.ok(!/localStorage|fetch\(|sendBeacon|document\.cookie/.test(value));
  const person = JSON.parse(
    scripts(value).find((match) => match[1].includes('id="resume-person"'))[2],
  );
  assert.equal(person["@type"], "Person");
  assert.equal(person.name, "Tarun B");
});

test("Structured reader rejects missing, duplicate, non-object and incorrectly typed blocks", () => {
  assert.throws(() => P.extract("<html></html>"), /No resume-data/);
  assert.throws(
    () => P.extract('<script data-id="resume-data" type="application/json">{}</script>'),
    /No resume-data/,
  );
  assert.throws(
    () => P.extract('<script id="resume-data" data-type="application/json">{}</script>'),
    /application\/json/,
  );
  assert.throws(
    () => P.extract('<script id="resume-data" type="application/json">[]</script>'),
    /JSON object/,
  );
  assert.throws(
    () => P.extract('<script id="resume-data" type="application/json">{}</script>'.repeat(2)),
    /Duplicate/,
  );
  assert.throws(() => P.extract("", "other"), /Choose/);
});

test("PDF cross-reference offsets and stream lengths use bytes, including Unicode source", () => {
  const bytes = Buffer.from(pdf()),
    latin = bytes.toString("latin1");
  assert.ok(latin.startsWith("%PDF-2.0"));
  const xrefOffset = Number(/startxref\n(\d+)\n%%EOF/.exec(latin)[1]);
  assert.equal(latin.slice(xrefOffset, xrefOffset + 4), "xref");
  const offsets = [...latin.slice(xrefOffset).matchAll(/(\d{10}) 00000 n/g)].map((match) =>
    Number(match[1]),
  );
  offsets.forEach((offset, i) => assert.ok(latin.slice(offset).startsWith(`${i + 1} 0 obj\n`)));
  for (const match of latin.matchAll(/<< \/Length (\d+) [^\n]*>>\nstream\n/g)) {
    const start = match.index + match[0].length;
    assert.ok(
      latin
        .slice(start + Number(match[1]), start + Number(match[1]) + 10)
        .startsWith("\nendstream"),
    );
  }
  assert.ok(latin.includes("/AFRelationship /Data"));
  assert.ok(latin.includes("/AFRelationship /Source"));
  assert.ok(latin.includes("/AF ["));
  assert.throws(() => PDF.create({ streams, width: 0, height: 800 }), /dimensions/);
});

test("PDF.js reads visible text, Unicode attachments and clickable links from the same PDF", async () => {
  const pdfjs = require("../site/assets/pdf.min.js");
  pdfjs.GlobalWorkerOptions.workerSrc = require.resolve("../site/assets/pdf.worker.min.js");
  const task = pdfjs.getDocument({ data: pdf(), isEvalSupported: false, verbosity: 0 });
  try {
    const doc = await task.promise;
    assert.equal(doc.numPages, 1);
    const page = await doc.getPage(1),
      content = await page.getTextContent();
    assert.match(content.items.map((item) => item.str).join(" "), /Tarun B.*Resume maker/);
    const attachments = Object.values(await doc.getAttachments());
    const data = (name) =>
      JSON.parse(
        new TextDecoder().decode(attachments.find((item) => item.filename === name).content),
      );
    assert.deepEqual(data("resume.json"), standard);
    assert.deepEqual(data("resume20-source.json"), model);
    assert.equal((await page.getAnnotations())[0].url, "https://tarunb.me/?q=r%C3%A9sum%C3%A9");
  } finally {
    await task.destroy();
  }
});

test("PDF writer retains multiple pages and supports attachment-free documents", async () => {
  const pdfjs = require("../site/assets/pdf.min.js");
  const task = pdfjs.getDocument({
    data: PDF.create({ streams: ["", ""], width: 600, height: 800 }),
    verbosity: 0,
  });
  try {
    const doc = await task.promise;
    assert.equal(doc.numPages, 2);
    assert.equal(await doc.getAttachments(), null);
  } finally {
    await task.destroy();
  }
});

test("Command-line reader extracts JSON and editable source from HTML, PDF and raw JSON", () => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), "resume-reader-"));
  try {
    const files = [
      ["resume.html", html()],
      ["resume.pdf", pdf()],
      ["resume.json", JSON.stringify(model)],
      ["resume.jsonresume.json", JSON.stringify(standard)],
    ];
    for (const [name, content] of files) {
      const file = path.join(folder, name);
      fs.writeFileSync(file, content);
      for (const source of [false, true]) {
        const result = spawnSync(
          process.execPath,
          [
            path.resolve(__dirname, "../scripts/read-resume.mjs"),
            file,
            ...(source ? ["--source"] : []),
          ],
          { encoding: "utf8" },
        );
        assert.ifError(result.error);
        assert.equal(result.status, 0, result.stderr);
        assert.deepEqual(JSON.parse(result.stdout), source ? model : standard, name);
      }
    }
    const file = path.join(folder, "plain.pdf");
    fs.writeFileSync(file, PDF.create({ streams: [""], width: 600, height: 800 }));
    const result = spawnSync(
      process.execPath,
      [path.resolve(__dirname, "../scripts/read-resume.mjs"), file],
      { encoding: "utf8" },
    );
    assert.equal(result.status, 1);
    assert.match(result.stderr, /no structured résumé attachment/);
  } finally {
    fs.rmSync(folder, { recursive: true, force: true });
  }
});

test("Portable viewer switches modes, lazy-loads PDF and downloads exact embedded JSON", async () => {
  // Exercise only the generated viewer callback, not the editor or a browser bootstrap.
  const value = html(),
    listeners = {},
    nodes = new Map(),
    downloads = [],
    blobs = [];
  const node = (id) => {
    if (!nodes.has(id))
      nodes.set(id, {
        dataset: {},
        attributes: {},
        addEventListener(event, fn) {
          this[event] = fn;
        },
        setAttribute(k, v) {
          this.attributes[k] = v;
        },
        getAttribute(k) {
          return this.attributes[k] || this[k];
        },
        focus() {
          document.activeElement = this;
        },
        click() {
          if (this.href) downloads.push(this);
          else this.clickHandler?.();
        },
      });
    return nodes.get(id);
  };
  const modes = ["human", "pdf", "json"].map((mode) => {
    const button = node(mode + "-tab");
    button.dataset.mode = mode;
    button.addEventListener = (event, fn) => {
      if (event === "click") button.clickHandler = fn;
    };
    return button;
  });
  const views = ["human", "pdf", "json"].map((mode) => {
    const section = node(mode + "-view");
    section.dataset.view = mode;
    return section;
  });
  for (const match of scripts(value)) {
    const id = /id="([^"]+)"/.exec(match[1]);
    if (id) node(id[1]).textContent = match[2];
  }
  const document = {
    querySelector: (selector) => node(selector.slice(1)),
    querySelectorAll: (selector) => (selector === "[data-mode]" ? modes : views),
    createElement: () => node("download" + downloads.length),
    documentElement: { dataset: {} },
  };
  const c = {
    document,
    navigator: {
      clipboard: {
        writeText: async (text) => {
          c.copied = text;
        },
      },
    },
    location: { hash: "#human" },
    history: { replaceState() {} },
    Blob,
    Uint8Array,
    atob,
    URL: {
      createObjectURL(blob) {
        blobs.push(blob);
        return "blob:" + blobs.length;
      },
      revokeObjectURL() {},
    },
    setTimeout() {},
    addEventListener(event, fn) {
      listeners[event] = fn;
    },
  };
  vm.runInNewContext(scripts(value).at(-1)[2], c);
  assert.equal(node("human-view").hidden, false);
  assert.equal(node("json-content").textContent, JSON.stringify(standard, null, 2));
  modes[1].click();
  assert.equal(node("human-view").hidden, true);
  assert.equal(node("pdf-view").hidden, false);
  assert.equal(node("pdf-frame").src, "blob:1");
  modes[1].click();
  assert.equal(blobs.length, 1, "PDF is decoded once");
  node("download-json").click();
  assert.equal(downloads[0].download, "tarun-b.json");
  assert.deepEqual(JSON.parse(await blobs[1].text()), standard);
  await node("copy-json").click();
  assert.deepEqual(JSON.parse(c.copied), standard);
  node("reader-theme").change({ target: { value: "dark" } });
  assert.equal(document.documentElement.dataset.theme, "dark");
  node("view-tabs").keydown({ key: "End", preventDefault() {} });
  assert.equal(node("json-view").hidden, false);
});

test("PDF import restores new source, standard JSON Resume and legacy source attachments", async () => {
  const source = fs.readFileSync(path.join(__dirname, "../site/assets/studio.js"), "utf8");
  const start = source.indexOf("async function extractTextFromPdf("),
    end = source.indexOf("async function extractTextFromDocx(", start);
  for (const [filename, data] of [
    ["resume20-source.json", model],
    ["resume.json", standard],
    ["forma-resume.json", model],
  ]) {
    const reader = {
      getDocument() {
        return {
          promise: Promise.resolve({
            numPages: 1,
            async getPage() {
              return {
                async getTextContent() {
                  return {
                    items: [
                      { str: "Tarun B", transform: [1, 0, 0, 1, 0, 700], height: 12, hasEOL: true },
                    ],
                  };
                },
              };
            },
            async getAttachments() {
              return {
                data: { filename, content: new TextEncoder().encode(JSON.stringify(data)) },
              };
            },
            async destroy() {},
          }),
        };
      },
    };
    const c = {
      window: { pdfjsLib: reader },
      pdfjsLib: reader,
      ResumeFormats: F,
      Uint8Array,
      TextDecoder,
    };
    vm.createContext(c);
    vm.runInContext(source.slice(start, end), c);
    const result = await c.extractTextFromPdf(new Blob(["PDF"]));
    assert.deepEqual(JSON.parse(JSON.stringify(result.resumeData)), model, filename);
    assert.equal(result.text, "Tarun B");
    const textOnly = await c.extractTextFromPdf(new Blob(["PDF"]), false);
    assert.equal(textOnly.resumeData, null, "Comparison still bypasses restoration data");
  }
});

test("Portable snapshot keeps all views aligned if the editor changes during export", () => {
  const features = fs.readFileSync(
    path.join(__dirname, "../site/assets/editor-features.js"),
    "utf8",
  );
  const start = features.indexOf("function portableDocumentSnapshot("),
    end = features.indexOf("function archiveSegment(", start);
  const c = {
    resume: structuredClone(sample),
    ResumeFormats: F,
    ResumePortable: P,
    deepClone: structuredClone,
    safeFilename: () => "tarun-b",
    documentHtmlExport: () => "<html><head></head><body>Tarun B</body></html>",
  };
  vm.createContext(c);
  vm.runInContext(features.slice(start, end), c);
  const snapshot = c.portableDocumentSnapshot();
  c.resume.basics.name = "Edited after snapshot";
  c.resume.experience[0].highlights.push("An edit after export started");
  const output = c.portableDocumentExport(pdf(), snapshot);
  assert.equal(P.extract(output).basics.name, "Tarun B");
  assert.deepEqual(P.extract(output).work[0].highlights, sample.experience[0].highlights);
  assert.equal(P.extract(output, "source").basics.name, "Tarun B");
});

test("Portable PDF encoding preserves binary data across chunk boundaries", () => {
  const bytes = Uint8Array.from({ length: 24583 }, (_, i) => i % 256);
  const output = P.build({
    model,
    jsonResume: standard,
    documentHtml: "<html><head></head><body></body></html>",
    pdfBytes: bytes,
  });
  const embedded = scripts(output).find((match) => match[1].includes('id="resume-pdf"'))[2];
  assert.deepEqual(Buffer.from(embedded, "base64"), Buffer.from(bytes));
});
