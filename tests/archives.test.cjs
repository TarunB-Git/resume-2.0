const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
const F = require("../site/assets/formats.js");
const P = require("../site/assets/portable-resume.js");
const sample = require("../examples/tarun.json");
const studio = fs.readFileSync(path.join(__dirname, "../site/assets/studio.js"), "utf8");
const features = fs.readFileSync(path.join(__dirname, "../site/assets/editor-features.js"), "utf8");
const v2 = fs.readFileSync(path.join(__dirname, "../site/assets/workspace-v2.js"), "utf8");
const between = (s, a, b) => {
  const start = s.indexOf(a),
    end = s.indexOf(b, start + a.length);
  assert.ok(start >= 0 && end > start);
  return s.slice(start, end);
};
function archiveContext() {
  const nodes = {
    ".app": {},
    "#exportButton": { setAttribute() {}, removeAttribute() {} },
    "#modalRoot": { replaceChildren() {} },
    "#zipProgressText": {},
  };
  const c = {
    Uint8Array,
    Uint32Array,
    ArrayBuffer,
    TextEncoder,
    TextDecoder,
    DataView,
    Blob,
    Response,
    DecompressionStream,
    ResumeFormats: F,
    console,
    deepClone: (x) => JSON.parse(JSON.stringify(x)),
    requestAnimationFrame: (fn) => fn(),
    $: (id) => nodes[id],
    resume: sample,
    workspace: {
      folders: [{ id: "f", name: "Resumes" }],
      resumes: [
        { id: "a", name: "Tarun B", folderId: "f", data: sample },
        {
          id: "b",
          name: "Tarun B",
          folderId: "f",
          data: sample,
          draftJson: "{",
          sourceDrafts: { xml: { text: "<", message: "Incomplete" } },
        },
      ],
    },
    customTemplates: [],
    templateById: (id) => ({ id, name: "Modern" }),
    syncPaperSize() {},
    fitPreview() {},
    toast() {},
    collectViewSettings: () => ({ zoom: "1.5", sourceWrap: false }),
  };
  c.makePdf = () => new Blob(["synthetic PDF bytes"]);
  c.makeDocx = () => new Blob(["synthetic DOCX bytes"]);
  for (const name of ["latexSource", "markdownSource", "plainDocumentText"])
    c[name] = () => c.resume.basics.name;
  c.portableDocumentExport = (pdfBytes) =>
    P.build({
      model: c.resume,
      jsonResume: F.toJsonResume(c.resume),
      pdfBytes,
      filename: "tarun-b",
      documentHtml: "<html><head></head><body>Tarun B</body></html>",
    });
  c.download = (blob) => {
    c.bundle = blob;
  };
  vm.createContext(c);
  vm.runInContext(between(studio, "const crcTable =", "function makeDocx()"), c);
  vm.runInContext(
    between(studio, "async function readArchiveEntry", "async function importResumeFile"),
    c,
  );
  return { c, nodes };
}
test("Session ZIP contains every résumé, nine output variants, templates and recoverable drafts", async () => {
  const { c, nodes } = archiveContext();
  vm.runInContext(between(features, "function archiveSegment(", "function richDocumentLines("), c);
  const before = c.resume;
  await c.exportWorkspaceZip();
  assert.equal(c.resume, before);
  assert.equal(nodes[".app"].inert, false);
  assert.equal(nodes["#exportButton"].disabled, false);
  for (const stem of ["Resumes/Tarun-B", "Resumes/Tarun-B-b"])
    for (const extension of [
      "pdf",
      "docx",
      "tex",
      "md",
      "json",
      "xml",
      "jsonresume.json",
      "html",
      "txt",
      "template.json",
    ])
      assert.ok(
        await c.readArchiveEntry(c.bundle, (name) => name === stem + "." + extension),
        stem + "." + extension,
      );
  const portable = await c.readArchiveEntry(c.bundle, (name) => name === "Resumes/Tarun-B.html");
  assert.deepEqual(P.extract(portable.text, "source"), sample);
  assert.deepEqual(P.extract(portable.text), F.toJsonResume(sample));
  const manifest = JSON.parse(
    (await c.readArchiveEntry(c.bundle, (name) => name === "session.json")).text,
  );
  assert.equal(manifest.format, "resume20.session");
  assert.equal(manifest.version, 1);
  assert.equal(manifest.workspace.resumes.length, 2);
  assert.equal(manifest.settings.zoom, "1.5");
  assert.equal(manifest.workspace.resumes[1].sourceDrafts.xml.text, "<");
  assert.ok(await c.readArchiveEntry(c.bundle, (name) => name === "workspace.json"));
  assert.ok(await c.readArchiveEntry(c.bundle, (name) => name === "templates.json"));
  const model = (await c.readArchiveEntry(c.bundle, (name) => name === "Resumes/Tarun-B.xml")).text;
  assert.deepEqual(F.fromXml(model), sample);
});
test("Current and legacy session manifests are detected before importing a single file", async () => {
  const { c } = archiveContext();
  let restored = [];
  c.showSessionImport = (...args) => restored.push(args);
  vm.runInContext(
    between(v2, "async function inspectSessionArchive(", "function showSessionImport("),
    c,
  );
  const current = c.makeZip([
    [
      "session.json",
      JSON.stringify({
        format: "resume20.session",
        version: 1,
        workspace: c.workspace,
        templates: [],
        settings: { zoom: "page" },
      }),
    ],
  ]);
  await c.inspectSessionArchive(current);
  assert.equal(restored[0][0].resumes.length, 2);
  assert.equal(restored[0][3].zoom, "page");
  const legacy = c.makeZip([
    ["workspace.json", JSON.stringify(c.workspace)],
    ["templates.json", "[]"],
  ]);
  assert.equal(await c.inspectSessionArchive(legacy), true);
  assert.equal(restored.length, 2);
  const other = c.makeZip([["resume.json", JSON.stringify(sample)]]);
  assert.equal(await c.inspectSessionArchive(other), false);
});
test("Content detection accepts all exported formats and ignores misleading file extensions", async () => {
  const { c } = archiveContext();
  const file = (text, name) => Object.assign(new Blob([text]), { name });
  for (const [text, name, type] of [
    ["%PDF-1.4", "old.txt", "pdf"],
    [JSON.stringify(sample), "resume.txt", "json"],
    [F.toXml(sample), "resume.txt", "xml"],
    ["<!doctype html><html></html>", "resume.txt", "html"],
    ["\\documentclass{article}", "resume.txt", "tex"],
    ["# Tarun B", "resume.txt", "md"],
    ["Tarun B\nRésumé maker", "resume.txt", "txt"],
  ])
    assert.equal(await c.detectResumeFormat(file(text, name)), type);
  assert.equal(
    await c.detectResumeFormat(c.makeZip([["word/document.xml", "<w:document/>"]])),
    "docx",
  );
  assert.equal(await c.detectResumeFormat(c.makeZip([["session.json", "{}"]])), "zip");
});
test("DOCX is a native Word package with numbered lists and exact source restoration", async () => {
  const { c } = archiveContext();
  c.wordXml = () =>
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p/></w:body></w:document>';
  c.wordRelationshipXml = "<Relationships/>";
  vm.runInContext(between(features, "function wordNumberingXml(", "function sliceRichNode("), c);
  vm.runInContext(between(studio, "function makeDocx()", "function download("), c);
  const docx = c.makeDocx();
  for (const name of [
    "[Content_Types].xml",
    "word/document.xml",
    "word/numbering.xml",
    "word/_rels/document.xml.rels",
    "forma/resume.json",
  ])
    assert.ok(await c.readArchiveEntry(docx, (x) => x === name));
  const model = JSON.parse((await c.readArchiveEntry(docx, (x) => x === "forma/resume.json")).text);
  assert.deepEqual(model, sample);
});
test("HTML restoration data safely escapes closing script tags", () => {
  const c = {
    resume: { basics: { name: "Tarun B" }, custom: "</script><img src=x onerror=alert(1)>" },
    escapeHtml: () => "",
    fontCss: () => "",
    PAGE: { width: 794, height: 1123 },
    paperSize: () => ({ width: 210, height: 297 }),
    resumeHtml: () => "<article></article>",
  };
  vm.createContext(c);
  vm.runInContext(between(features, "function documentHtmlExport(", "function archiveSegment("), c);
  const html = c.documentHtmlExport();
  const embedded = /<script type="application\/json" id="resume20-source">(.*?)<\/script>/.exec(
    html,
  )[1];
  assert.ok(!embedded.includes("<"));
  assert.equal(JSON.parse(embedded).custom, c.resume.custom);
});
test("Folder moves validate their destination and reveal the moved record", () => {
  const c = {
    workspace: {
      resumes: [{ id: "r", folderId: "old" }],
      folders: [{ id: "old" }, { id: "new" }],
      collapsedFolders: ["new"],
    },
    renderFolderTree() {},
    saveWorkspace() {},
  };
  vm.createContext(c);
  vm.runInContext(
    between(features, "function moveResumeToFolder(", "function clearFileDropTargets("),
    c,
  );
  assert.equal(c.moveResumeToFolder("r", "new"), true);
  assert.equal(c.workspace.resumes[0].folderId, "new");
  assert.equal(c.workspace.collapsedFolders.length, 0);
  assert.equal(c.moveResumeToFolder("r", "missing"), false);
});
