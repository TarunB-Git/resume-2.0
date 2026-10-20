const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
const F = require("../site/assets/formats.js");
const sample = require("../examples/tarun.json");
const source = (name) => fs.readFileSync(path.join(__dirname, "../site/assets", name), "utf8");
const studio = source("studio.js"),
  features = source("editor-features.js"),
  v2 = source("workspace-v2.js");
function between(text, start, end) {
  const a = text.indexOf(start),
    b = text.indexOf(end, a + start.length);
  assert.ok(a >= 0 && b > a, `${start} … ${end}`);
  return text.slice(a, b);
}
const clone = (value) => JSON.parse(JSON.stringify(value));
const plain = (value) => JSON.parse(JSON.stringify(value));
function modelContext(data = sample) {
  const nodes = {
    "#markdownInput": { value: "" },
    "#xmlEditor": { value: "" },
    "#markdownStatus": {},
    "#xmlStatus": {},
    "#xmlStats": {},
  };
  const c = {
    resume: clone(data),
    sourceState: { markdownCommitted: "", markdownError: null },
    deepClone: clone,
    titleCase: (x) => x.charAt(0).toUpperCase() + x.slice(1),
    $: (id) => nodes[id],
    ResumeFormats: F,
    TextEncoder,
    console,
  };
  vm.createContext(c);
  vm.runInContext(between(studio, "function pathGet(", "function fieldStyle("), c);
  vm.runInContext(between(studio, "function sectionKeys(", "function renderSectionOutline("), c);
  vm.runInContext(between(studio, "function markdownSource(", "function buildPreviewPages("), c);
  return { c, nodes };
}
test("Unchanged Markdown source preserves empty bullets, punctuation, types and field order", () => {
  const data = {
    ...sample,
    skills: ["", "-", "*", "A.", "- literal bullet", "two\nlines"],
    custom: { zero: 0, flag: false, nil: null, empty: [], nested: { text: "Résumé 中文 & < >" } },
  };
  const { c, nodes } = modelContext(data);
  for (let n = 0; n < 20; n++) {
    c.refreshMarkdownInput();
    const text = nodes["#markdownInput"].value;
    c.resume = c.markdownInputData(text);
    assert.equal(JSON.stringify(c.resume), JSON.stringify(data));
    c.resume = F.fromXml(F.toXml(c.resume));
    assert.equal(JSON.stringify(c.resume), JSON.stringify(data));
  }
});
test("Editing a Markdown field does not turn untouched empty bullets into punctuation", () => {
  const { c, nodes } = modelContext({ ...sample, skills: ["", "CSS", "- literal"] });
  c.refreshMarkdownInput();
  c.resume = c.markdownInputData(
    nodes["#markdownInput"].value.replace("# Tarun B", "# Tarun B edited"),
  );
  assert.equal(c.resume.basics.name, "Tarun B edited");
  assert.deepEqual(plain(c.resume.skills), ["", "CSS", "- literal"]);
  const linked = "-  <!-- forma:field skills.0 -->";
  assert.equal(c.parseLinkedMarkdown(linked, c.resume).skills[0], "");
});
test("Source activation does not commit unchanged Markdown and blocks invalid draft conversion", () => {
  const calls = [];
  const { c } = modelContext();
  c.activeInput = "markdown";
  c.latestJsonError = null;
  c.paneNodes = { json: {}, xml: {}, latex: {}, markdown: {} };
  c.sourceDraftError = () => c.error;
  c.sourceErrorMode = () => (c.error ? "markdown" : null);
  c.markdownHasChanges = () => false;
  c.commitMarkdown = () => {
    throw Error("Unchanged text must not be committed");
  };
  c.$$ = () => [];
  for (const name of ["renderPanelOrder", "highlightJson", "highlightLatex", "syncV2Source"])
    c[name] = () => {};
  c.toast = (text) => calls.push(text);
  const oldDollar = c.$;
  c.$ = (id) => (id === "#workspaceView" ? {} : oldDollar(id));
  vm.runInContext(between(studio, "function activateInput(", "function syncFilesPanel("), c);
  for (const mode of ["json", "latex", "xml", "markdown"]) c.activateInput(mode);
  assert.equal(c.activeInput, "markdown");
  c.error = new Error("draft");
  c.activateInput("json");
  assert.equal(c.activeInput, "markdown");
  assert.equal(calls.length, 1);
});
test("Paper dimensions agree across CSS pixels, PDF points, Word twips and LaTeX", () => {
  const { c } = modelContext();
  c.templateById = (id) => ({ id });
  c.effectiveTemplateId = (t) => t.id;
  c.safeLink = String;
  vm.runInContext(studio.slice(0, studio.indexOf("function syncPaperSize(")), c);
  vm.runInContext(between(studio, "function latexEscape(", "function updateFromLatex("), c);
  for (const [key, w, h, tex] of [
    ["a4", 210, 297, "a4paper"],
    ["letter", 215.9, 279.4, "letterpaper"],
    ["legal", 215.9, 355.6, "legalpaper"],
    ["a5", 148, 210, "a5paper"],
  ]) {
    c.resume.layout = { paperSize: key };
    assert.equal(vm.runInContext("PAGE.twipWidth", c), Math.round((w * 1440) / 25.4));
    assert.equal(vm.runInContext("PAGE.twipHeight", c), Math.round((h * 1440) / 25.4));
    assert.ok(Math.abs(vm.runInContext("PAGE.width/PAGE.pdfWidth", c) - 4 / 3) < 1e-12);
    const text = c.latexSource();
    assert.ok(text.includes(`10pt,${tex}`));
    assert.equal(c.parseLatexFields(text).data.layout.paperSize, key);
    assert.equal(c.parseLatexFields(text).data.basics.name, "Tarun B");
  }
});
test("Invalid XML and LaTeX drafts survive collection and restoration", () => {
  const nodes = {
    "#xmlEditor": { value: "<resume" },
    "#latexEditor": { value: "\\CVField{name}{" },
    "#markdownInput": { value: "" },
    "#xmlStatus": {},
    "#markdownStatus": {},
  };
  const c = { $: (id) => nodes[id], latestJsonError: null, setJsonStatus() {} };
  vm.createContext(c);
  vm.runInContext(v2.slice(0, v2.indexOf("function syncV2Source(")), c);
  vm.runInContext(
    "sourceState.xmlError=new Error('Unclosed XML');sourceState.latexError=new Error('Unclosed CVField')",
    c,
  );
  const drafts = c.collectSourceDrafts();
  c.resetV2SourceState(drafts);
  assert.deepEqual(plain(c.collectSourceDrafts()), plain(drafts));
  c.restoreV2Drafts(drafts);
  assert.equal(nodes["#xmlEditor"].value, "<resume");
  assert.equal(c.sourceErrorMode(), "xml");
  assert.ok(studio.includes("document.activeElement !== latexEditor && !sourceState.latexError"));
  assert.ok(
    studio.indexOf("resetV2SourceState(workspace.resumes") <
      studio.indexOf("renderWorkspace();\njsonEditor.value"),
  );
});
test("Undo/Redo shares model, rich document and invalid drafts with independent histories", () => {
  const nodes = {
    "#markdownInput": { value: "Tarun B" },
    "#xmlEditor": { value: F.toXml(sample) },
  };
  const c = {
    resume: clone(sample),
    jsonEditor: { value: JSON.stringify(sample) },
    latexEditor: { value: "source" },
    $: (id) => nodes[id],
    sourceState: {},
    documentHistories: new Map(),
    activeResumeId: "a",
    restoringHistory: false,
    latestJsonError: null,
    markdownTimer: null,
    clearTimeout,
    ResumeFormats: F,
    console,
  };
  for (const name of [
    "updateHistoryControls",
    "saveWordDocument",
    "restoreEditingSelection",
    "closeFormatPane",
    "syncControls",
    "renderOutput",
    "highlightJson",
    "highlightLatex",
    "updateJsonStats",
    "setJsonStatus",
    "refreshMarkdownInput",
  ])
    c[name] = () => {};
  c.captureEditingSelection = () => null;
  c.collectSourceDrafts = () => c.drafts || null;
  c.resetV2SourceState = (drafts) => {
    c.drafts = drafts;
  };
  c.restoreV2Drafts = (drafts) => {
    c.drafts = drafts;
  };
  c.updateJsonEditor = () => {
    if (!c.latestJsonError) c.jsonEditor.value = JSON.stringify(c.resume);
    c.recordWorkspaceHistory();
  };
  c.persistResume = () => c.recordWorkspaceHistory();
  vm.createContext(c);
  vm.runInContext(
    between(features, "function recordWorkspaceHistory(", "/* Files can be dropped"),
    c,
  );
  c.recordWorkspaceHistory();
  c.resume.basics.name = "Tarun B edited";
  c.updateJsonEditor();
  c.resume.layout = { richDocument: "<p>Extra line</p>" };
  c.updateJsonEditor();
  c.drafts = { xml: { text: "<", message: "Unclosed" } };
  nodes["#xmlEditor"].value = "<";
  c.recordWorkspaceHistory();
  c.restoreWorkspaceHistory(-1);
  assert.equal(c.drafts, null);
  assert.equal(c.resume.layout.richDocument, "<p>Extra line</p>");
  c.restoreWorkspaceHistory(-1);
  assert.equal(c.resume.layout, undefined);
  c.restoreWorkspaceHistory(-1);
  assert.equal(c.resume.basics.name, "Tarun B");
  c.restoreWorkspaceHistory(1);
  assert.equal(c.resume.basics.name, "Tarun B edited");
  c.restoreWorkspaceHistory(1);
  c.restoreWorkspaceHistory(1);
  assert.equal(c.drafts.xml.text, "<");
  c.restoreWorkspaceHistory(-1);
  c.resume.summary = "New branch";
  c.updateJsonEditor();
  c.restoreWorkspaceHistory(1);
  assert.equal(c.resume.summary, "New branch");
  c.activeResumeId = "b";
  for (let n = 0; n < 110; n++) {
    c.resume.summary = String(n);
    c.updateJsonEditor();
  }
  assert.equal(c.documentHistories.get("b").items.length, 100);
  assert.ok(c.documentHistories.get("a").items.length < 100);
});
test("Pinch only consumes two-finger gestures and ctrl-wheel; zoom stays between 25 and 300%", () => {
  const handlers = {},
    changes = [];
  let scale = 1;
  const host = { addEventListener: (name, fn) => (handlers[name] = fn) };
  const c = {};
  vm.createContext(c);
  vm.runInContext(between(v2, "function attachPinchZoom(", "function initializeWorkspaceV2("), c);
  c.attachPinchZoom(
    host,
    () => scale,
    (value, point) => {
      scale = value;
      changes.push([value, point]);
    },
  );
  const touch = (x) => ({ clientX: x, clientY: 20 });
  let prevented = 0;
  const event = (touches) => ({
    touches,
    preventDefault() {
      prevented++;
    },
  });
  handlers.touchstart(event([touch(0)]));
  handlers.touchmove(event([touch(20)]));
  assert.equal(prevented, 0);
  assert.equal(changes.length, 0);
  handlers.touchstart(event([touch(0), touch(100)]));
  handlers.touchmove(event([touch(0), touch(200)]));
  assert.equal(scale, 2);
  assert.equal(changes[0][1].x, 100);
  handlers.touchmove(event([touch(0), touch(1000)]));
  assert.equal(scale, 3);
  handlers.touchend();
  handlers.wheel({
    ctrlKey: false,
    deltaY: 100,
    preventDefault() {
      throw Error("Ordinary scroll consumed");
    },
  });
  handlers.wheel({ ctrlKey: true, deltaY: 1000, clientX: 20, clientY: 30, preventDefault() {} });
  assert.equal(scale, 0.25);
});
test("Desktop output resizing updates every source width, including XML", () => {
  const handlers = {},
    listeners = {};
  let saves = 0;
  const divider = {
    dataset: { leftPanel: "json", rightPanel: "output" },
    classList: { contains: () => false },
  };
  const c = {
    workspacePanels: {
      addEventListener: (name, fn) => (handlers[name] = fn),
      getBoundingClientRect: () => ({ width: 1000, height: 1000 }),
    },
    panelWeights: { json: 30, xml: 30, latex: 30, markdown: 30, output: 70 },
    workspace: {},
    panelResizeVertical: () => false,
    setPanelGrid() {},
    saveWorkspace() {
      saves++;
    },
    window: {
      addEventListener: (name, fn) => (listeners[name] = fn),
      removeEventListener: (name) => delete listeners[name],
    },
  };
  vm.createContext(c);
  vm.runInContext(
    between(studio, 'workspacePanels.addEventListener("pointerdown"', "let draggedPanel ="),
    c,
  );
  const e = { target: { closest: () => divider }, preventDefault() {}, clientX: 300, clientY: 300 };
  handlers.pointerdown(e);
  listeners.pointermove({ clientX: 450, clientY: 300 });
  listeners.pointerup();
  for (const mode of ["json", "xml", "latex", "markdown"]) assert.equal(c.panelWeights[mode], 45);
  assert.equal(c.panelWeights.output, 55);
  assert.equal(saves, 1);
  handlers.keydown({ ...e, key: "ArrowRight" });
  assert.equal(c.panelWeights.xml, 47);
});
test("The two-format comparison uses identical data and actual positive timings", () => {
  const mapper = require("../site/assets/resume-parser.js");
  const result = F.compareFormats(sample, mapper);
  assert.equal(result.samples.length, 1);
  assert.equal(result.samples[0].name, "Tarun B");
  for (const row of result.samples[0].results) {
    assert.equal(row.correct, 12);
    assert.equal(row.total, 12);
    assert.ok(row.elapsed_ms > 0);
    assert.ok(row.bytes > 0);
  }
  assert.deepEqual(
    result.samples[0].results.map((x) => x.format),
    ["json", "xml"],
  );
});
module.exports = { between };
test("Unrelated Markdown edits preserve nulls and trailing spaces; exported metadata keeps empty containers", () => {
  const data = { ...sample, skills: ["", "A.  "], custom: { nil: null, empty: [], nested: {} } };
  const { c, nodes } = modelContext(data);
  c.refreshMarkdownInput();
  const edited = c.markdownInputData(
    nodes["#markdownInput"].value.replace("# Tarun B", "# Tarun B edited"),
  );
  assert.equal(edited.custom.nil, null);
  assert.equal(edited.skills[1], "A.  ");
  const restored = c.parseLinkedMarkdown(c.markdownSource(), { basics: {} });
  assert.deepEqual(plain(restored.custom), data.custom);
  assert.deepEqual(plain(restored.skills), data.skills);
});
test("Document zoom keeps the content point beneath the gesture and clamps display scale", () => {
  let scale = 1;
  const host = {
    scrollLeft: 0,
    scrollTop: 0,
    clientWidth: 600,
    clientHeight: 600,
    getBoundingClientRect: () => ({ left: 0, top: 0 }),
  };
  const stack = {
    dataset: { displayScale: "1" },
    getBoundingClientRect: () => ({ left: 20 - host.scrollLeft, top: 20 - host.scrollTop }),
  };
  const select = { value: "1" };
  const c = {
    $: (id) => ({ "#previewBody": host, "#previewPages": stack, "#previewZoom": select })[id],
    safeStorageSet() {},
    fitPreview() {
      scale = Number(c.previewZoom);
      stack.dataset.displayScale = String(scale);
    },
  };
  vm.createContext(c);
  vm.runInContext(between(v2, "function documentScale(", "function attachPinchZoom("), c);
  c.setDocumentZoom(2, { x: 120, y: 220 });
  assert.equal(host.scrollLeft, 100);
  assert.equal(host.scrollTop, 200);
  assert.equal(stack.getBoundingClientRect().left + 100 * scale, 120);
  assert.equal(stack.getBoundingClientRect().top + 200 * scale, 220);
  c.setDocumentZoom(20, { x: 120, y: 220 });
  assert.equal(scale, 3);
  c.setDocumentZoom(0.01, { x: 120, y: 220 });
  assert.equal(scale, 0.25);
});
test("The app and comparison use the same sole bundled example", () => {
  const c = {};
  vm.createContext(c);
  vm.runInContext(
    between(studio, "const initialData =", "const $ =") + "\nthis.data=initialData",
    c,
  );
  assert.deepEqual(plain(c.data), sample);
  const comparison = JSON.parse(
    fs.readFileSync(path.join(__dirname, "../site/benchmark/tarun.json"), "utf8"),
  );
  assert.deepEqual(comparison, sample);
});
test("Syntactically valid but invalid JSON models keep the last valid preview and draft", () => {
  const c = {
    resume: clone(sample),
    jsonEditor: { value: "[]" },
    ResumeFormats: F,
    latestJsonError: null,
    renderOutput() {
      throw Error("Invalid model reached the preview");
    },
  };
  for (const name of [
    "setJsonStatus",
    "persistResume",
    "highlightJson",
    "updateJsonStats",
    "updateBuildState",
  ])
    c[name] = () => {};
  vm.createContext(c);
  vm.runInContext(between(studio, "function parseJsonLive()", "function showAddFieldModal("), c);
  c.parseJsonLive();
  assert.ok(c.latestJsonError);
  assert.equal(c.jsonEditor.value, "[]");
  assert.deepEqual(plain(c.resume), sample);
  c.restoredDraft = "[]";
  c.latestJsonError = null;
  vm.runInContext(
    between(
      studio,
      "jsonEditor.value = restoredDraft ||",
      "syncControls();\nupdateJsonEditor();\nrenderOutput();\nshowRecordedBenchmark();",
    ),
    c,
  );
  assert.ok(c.latestJsonError);
  assert.equal(c.jsonEditor.value, "[]");
  assert.deepEqual(plain(c.resume), sample);
});
