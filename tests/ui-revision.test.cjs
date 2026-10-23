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
  const flags = [];
  const c = {
    window: { innerHeight: 800, visualViewport: { height: 500, scale: 1 } },
    mobileViewportBaseline: 0,
    mobileKeyboardOpen: false,
    isCompactLayout: () => true,
    document: {
      querySelector: () => ({ classList: { toggle: (...args) => flags.push(args) } }),
      documentElement: { style: { setProperty: (...args) => changes.push(args) } },
    },
  };
  vm.createContext(c);
  vm.runInContext(between(v2, "function syncViewportHeight(", "function showMobilePane("), c);
  c.syncViewportHeight();
  assert.deepEqual(changes[0], ["--app-height", "500px"]);
  c.window.visualViewport.height = 250;
  c.window.visualViewport.scale = 2;
  c.syncViewportHeight();
  assert.equal(changes.length, 1);
  c.document.activeElement = { matches: () => true };
  c.window.visualViewport.scale = 1;
  c.window.visualViewport.height = 350;
  c.syncViewportHeight();
  assert.deepEqual(flags.at(-1), ["keyboard-open", true]);
  assert.deepEqual(changes.at(-1), ["--app-height", "350px"]);
  c.document.activeElement = null;
  c.syncViewportHeight();
  assert.deepEqual(flags.at(-1), ["keyboard-open", true]);
  c.window.visualViewport.height = 800;
  c.syncViewportHeight();
  assert.deepEqual(flags.at(-1), ["keyboard-open", false]);
});
test("Android keyboard geometry leaves the editor above docked and floating keyboards", () => {
  const changes = [],
    flags = [];
  const keyboard = { overlaysContent: true, boundingRect: { y: 480, width: 390, height: 320 } };
  const context = {
    window: {
      innerHeight: 800,
      innerWidth: 390,
      visualViewport: { height: 800, scale: 1, offsetTop: 0 },
      navigator: { virtualKeyboard: keyboard },
    },
    document: {
      activeElement: { matches: () => true },
      querySelector: () => ({ classList: { toggle: (...args) => flags.push(args) } }),
      documentElement: { style: { setProperty: (...args) => changes.push(args) } },
    },
    mobileViewportBaseline: 0,
    mobileKeyboardOpen: false,
    isCompactLayout: () => true,
  };
  vm.createContext(context);
  vm.runInContext(between(v2, "function syncViewportHeight(", "function showMobilePane("), context);
  const height = () => changes.filter(([name]) => name === "--app-height").at(-1)[1];
  context.syncViewportHeight();
  assert.equal(height(), "480px");
  assert.deepEqual(flags.at(-1), ["keyboard-open", true]);
  keyboard.boundingRect = { y: 320, width: 220, height: 220 };
  context.syncViewportHeight();
  assert.equal(height(), "320px");
  keyboard.boundingRect = { y: 0, width: 0, height: 0 };
  context.syncViewportHeight();
  assert.equal(height(), "800px");
  assert.deepEqual(flags.at(-1), ["keyboard-open", false]);
  keyboard.overlaysContent = false;
  keyboard.boundingRect = { y: 480, width: 390, height: 320 };
  context.window.innerHeight = 480;
  context.window.visualViewport.height = 480;
  context.syncViewportHeight();
  assert.equal(height(), "480px");
});
test("Keyboard overlay control follows the compact editor and restores the browser setting", () => {
  let compact = true,
    hidden = false;
  const keyboard = { overlaysContent: false };
  const context = {
    window: { navigator: { virtualKeyboard: keyboard } },
    virtualKeyboardInitialOverlay: null,
    isCompactLayout: () => compact,
    document: { querySelector: () => ({ classList: { contains: () => hidden } }) },
  };
  vm.createContext(context);
  vm.runInContext(
    between(v2, "function configureVirtualKeyboard(", "function syncViewportHeight("),
    context,
  );
  context.configureVirtualKeyboard();
  assert.equal(keyboard.overlaysContent, true);
  hidden = true;
  context.configureVirtualKeyboard();
  assert.equal(keyboard.overlaysContent, false);
  hidden = false;
  compact = false;
  context.configureVirtualKeyboard();
  assert.equal(keyboard.overlaysContent, false);
});
test("Keyboard resizing reveals the textarea caret by scrolling its own text surface", () => {
  const focused = {
    matches: (selector) => selector === "textarea",
    selectionEnd: 2,
    value: "{}",
    wrap: "soft",
    clientWidth: 320,
    clientHeight: 200,
    scrollTop: 0,
  };
  let removed = 0;
  const context = {
    mobileKeyboardOpen: true,
    isCompactLayout: () => true,
    getComputedStyle: () => ({
      lineHeight: "28px",
      fontSize: "16px",
      paddingTop: "14px",
      paddingBottom: "14px",
      getPropertyValue: () => "",
    }),
    document: {
      activeElement: focused,
      body: { append() {} },
      createElement: (tag) =>
        tag === "span"
          ? { offsetTop: 600 }
          : {
              style: { setProperty() {} },
              append() {},
              remove() {
                removed++;
              },
            },
    },
  };
  vm.createContext(context);
  vm.runInContext(
    between(v2, "function revealMobileEditingCaret(", "function configureVirtualKeyboard("),
    context,
  );
  context.revealMobileEditingCaret();
  assert.equal(focused.scrollTop, 442);
  focused.scrollTop = 900;
  context.revealMobileEditingCaret();
  assert.equal(focused.scrollTop, 586);
  assert.equal(focused.value, "{}");
  assert.equal(focused.selectionEnd, 2);
  assert.equal(removed, 2);
});
test("Keyboard resizing scrolls a rich document caret into the output area", () => {
  const host = {
    scrollTop: 0,
    contains: () => true,
    getBoundingClientRect: () => ({ top: 0, bottom: 300 }),
  };
  const range = { collapse() {}, getBoundingClientRect: () => ({ top: 330, bottom: 350 }) };
  const context = {
    mobileKeyboardOpen: true,
    isCompactLayout: () => true,
    document: {
      activeElement: { matches: () => false, isContentEditable: true },
      querySelector: () => host,
      getSelection: () => ({ rangeCount: 1, getRangeAt: () => ({ cloneRange: () => range }) }),
    },
  };
  vm.createContext(context);
  vm.runInContext(
    between(v2, "function revealMobileEditingCaret(", "function configureVirtualKeyboard("),
    context,
  );
  context.revealMobileEditingCaret();
  assert.equal(host.scrollTop, 74);
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
test("Theme starts at Apple, then cycles through Material light and Dark without replacing saved choices", () => {
  const run = (saved) => {
    const c = { safeStorageGet: (key) => saved[key] ?? null };
    vm.createContext(c);
    vm.runInContext(between(studio, "let interfaceAppearance =", "let compiledArtifacts"), c);
    return vm.runInContext("({ appearanceStage, interfaceAppearance, darkMode })", c);
  };
  assert.equal(run({}).appearanceStage, "apple");
  assert.equal(run({ "forma.appearance.stage": "light" }).appearanceStage, "light");
  assert.equal(run({ "forma.dark.mode": "true" }).appearanceStage, "dark");
  const c = {
    $: () => ({}),
    safeStorageSet() {},
    syncControls() {},
  };
  vm.createContext(c);
  vm.runInContext('let appearanceStage="apple",interfaceAppearance="apple",darkMode=false;', c);
  const click = between(
    studio,
    '$("#appearanceCycle").onclick = () => {',
    '$("#inspectPdfButton").onclick',
  );
  // Keep the installed callback available in this isolated control context.
  c.$ = () => c.button;
  c.button = {};
  vm.runInContext(click, c);
  for (const expected of ["light", "dark", "apple"]) {
    c.button.onclick();
    assert.equal(vm.runInContext("appearanceStage", c), expected);
  }
});
test("Pointer-only touch devices can pinch both ways without consuming a single touch", () => {
  const handlers = {};
  let scale = 1,
    prevented = 0;
  const host = { addEventListener: (name, fn) => (handlers[name] = fn) };
  const c = {};
  vm.createContext(c);
  vm.runInContext(between(v2, "function attachPinchZoom(", "function syncViewportHeight("), c);
  c.attachPinchZoom(
    host,
    () => scale,
    (value) => (scale = value),
  );
  const event = (id, x) => ({
    pointerType: "touch",
    pointerId: id,
    clientX: x,
    clientY: 50,
    preventDefault() {
      prevented++;
    },
  });
  handlers.pointerdown(event(1, 0));
  handlers.pointermove(event(1, 20));
  assert.equal(prevented, 0);
  handlers.pointerdown(event(2, 120));
  handlers.pointermove(event(2, 220));
  assert.equal(scale, 2);
  handlers.pointermove(event(2, 70));
  assert.equal(scale, 0.5);
  handlers.pointercancel(event(2, 70));
  handlers.pointermove(event(1, 30));
  assert.equal(scale, 0.5);
});
test("Zoom scales the scroll surface, keeps paper layout fixed and updates Word content height", () => {
  const host = { classList: { contains: () => false } };
  const surface = {
    classList: { contains: () => true },
    style: {},
    append(node) {
      node.parentElement = this;
    },
  };
  const stack = {
    parentElement: host,
    dataset: {},
    style: {},
    offsetHeight: 1200,
    before(node) {
      assert.equal(node, surface);
    },
  };
  const c = { document: { createElement: () => surface } };
  vm.createContext(c);
  vm.runInContext(between(v2, "function documentScale(", "function anchorDocumentScale("), c);
  c.applyDocumentScale(stack, 0.5, 800);
  assert.equal(stack.style.transform, "scale(0.5)");
  assert.equal(surface.style.width, "400px");
  assert.equal(surface.style.height, "600px");
  assert.equal(c.documentScale(stack), 0.5);
  stack.offsetHeight = 1800;
  c.applyDocumentScale(stack, 2, 800);
  assert.equal(surface.style.width, "1600px");
  assert.equal(surface.style.height, "3600px");
  assert.equal(stack.style.width, undefined);
  assert.equal(stack.style.zoom, undefined);
});
test("Each pane owns its header and Word retains zoom outside PDF page navigation", () => {
  const html = source("site/index.html");
  assert.ok(!html.includes("workspaceTopline"));
  assert.ok(html.indexOf('id="panelJson"') < html.indexOf('id="resumeTabs"'));
  assert.ok(html.indexOf('id="panelOutput"') < html.indexOf('id="outputControls"'));
  assert.match(studio, /paneNodes\[activeInput\]\.prepend\(tabs\)/);
  assert.match(html, /class="document-view-actions"/);
  assert.match(html, /popovertarget="insertOptions"/);
  assert.match(html, /id="insertOptions"[^>]*popover="auto"/);
  const css = source("site/assets/resume-v2.css");
  assert.match(css, /\.document-primary-controls\s*\{\s*display: contents/);
  assert.match(css, /\.insert-label\s*\{\s*display: none/);
  assert.ok(!html.includes("mobile-project-links"));
});
function eventHub() {
  const listeners = new Map();
  return {
    listeners,
    addEventListener(name, callback, options) {
      if (!listeners.has(name)) listeners.set(name, []);
      listeners.get(name).push({ callback, options });
    },
    removeEventListener(name, callback) {
      listeners.set(
        name,
        (listeners.get(name) || []).filter((entry) => entry.callback !== callback),
      );
    },
    emit(name, event) {
      for (const { callback } of [...(listeners.get(name) || [])]) callback(event);
    },
  };
}
test("Trackpad events route at document capture across the output pane in PDF and Word", () => {
  for (const mode of ["pdf", "word"]) {
    const root = eventHub(),
      host = eventHub();
    const page = { mode },
      toolbar = {},
      source = {},
      body = {},
      html = {};
    root.body = body;
    root.documentElement = html;
    let underPointer = page,
      scale = 1;
    root.elementFromPoint = () => underPointer;
    const scope = { contains: (target) => [page, toolbar].includes(target) };
    Object.assign(host, {
      ownerDocument: root,
      closest: () => scope,
      isConnected: true,
      getClientRects: () => [{}],
    });
    const c = {};
    vm.createContext(c);
    vm.runInContext(between(v2, "function attachPinchZoom(", "function syncViewportHeight("), c);
    const detach = c.attachPinchZoom(
      host,
      () => scale,
      (value) => (scale = value),
    );
    const wheel = (target, deltaY, extra = {}) => {
      const event = {
        target,
        ctrlKey: true,
        deltaY,
        clientX: 200,
        clientY: 300,
        cancelable: true,
        prevented: false,
        preventDefault() {
          this.prevented = true;
        },
        ...extra,
      };
      root.emit("wheel", event);
      return event;
    };
    assert.equal(
      host.listeners.has("wheel"),
      false,
      "Trackpad input is not confined to the scroll element",
    );
    const options = root.listeners.get("wheel")[0].options;
    assert.equal(options.capture, true);
    assert.equal(options.passive, false);
    assert.equal(wheel(toolbar, -40).prevented, true);
    assert.ok(scale > 1);
    const bigger = scale;
    wheel(page, 80);
    assert.ok(scale < bigger);
    const before = scale;
    assert.equal(wheel(source, -40).prevented, false);
    assert.equal(wheel(page, -40, { ctrlKey: false }).prevented, false);
    assert.equal(scale, before);
    wheel(body, -40); // A browser can retarget the gesture to its root.
    assert.ok(scale > before);
    const resumed = scale;
    underPointer = source;
    assert.equal(wheel(html, -40).prevented, false);
    assert.equal(scale, resumed);
    underPointer = page;
    wheel(page, -10, { defaultPrevented: true });
    assert.ok(
      scale > resumed,
      "An existing browser default-prevention does not disable document zoom",
    );
    host.getClientRects = () => [];
    const hidden = scale;
    assert.equal(wheel(page, -40).prevented, false);
    assert.equal(scale, hidden);
    detach();
    assert.ok([...root.listeners.values()].every((entries) => entries.length === 0));
    assert.ok([...host.listeners.values()].every((entries) => entries.length === 0));
  }
});
test("Root-targeted Safari gestures use the last pointer location and ignore the source pane", () => {
  const root = eventHub(),
    host = eventHub(),
    page = {},
    source = {};
  root.body = {};
  let pointed = page,
    scale = 1;
  root.elementFromPoint = () => pointed;
  Object.assign(host, {
    ownerDocument: root,
    closest: () => ({ contains: (node) => node === page }),
    getClientRects: () => [{}],
  });
  const c = {};
  vm.createContext(c);
  vm.runInContext(between(v2, "function attachPinchZoom(", "function syncViewportHeight("), c);
  c.attachPinchZoom(
    host,
    () => scale,
    (value) => (scale = value),
  );
  root.emit("mousemove", { clientX: 200, clientY: 300 });
  const event = (factor) => ({
    target: root,
    clientX: 0,
    clientY: 0,
    scale: factor,
    preventDefault() {},
  });
  root.emit("gesturestart", event(1));
  root.emit("gesturechange", event(1.5));
  assert.equal(scale, 1.5);
  root.emit("gestureend", event(1.5));
  pointed = source;
  root.emit("gesturestart", event(1));
  root.emit("gesturechange", event(2));
  assert.equal(scale, 1.5);
});
test("PDF preview keeps standard font text paint enabled rather than requesting unavailable glyph paths", async () => {
  const c = {};
  vm.createContext(c);
  vm.runInContext(between(v2, "function pdfPreviewOptions(", "function attachPinchZoom("), c);
  const pdfjs = require("../site/assets/pdf.min.js");
  pdfjs.GlobalWorkerOptions.workerSrc = path.join(root, "site/assets/pdf.worker.min.js");
  const options = c.pdfPreviewOptions(
    new Uint8Array(fs.readFileSync(path.join(root, "site/benchmark/tarun.pdf"))),
  );
  assert.equal(options.disableFontFace, false);
  assert.equal(options.useSystemFonts, true);
  assert.equal(options.isEvalSupported, false);
  assert.match(studio, /pdfjsLib\.getDocument\(pdfPreviewOptions\(bytes\)\)/);
  const task = pdfjs.getDocument(options);
  try {
    const pdf = await task.promise,
      page = await pdf.getPage(1);
    const operators = await page.getOperatorList();
    const fontNames = new Set(
      operators.fnArray.flatMap((fn, i) =>
        fn === pdfjs.OPS.setFont ? [operators.argsArray[i][0]] : [],
      ),
    );
    assert.ok(fontNames.size > 0);
    for (const name of fontNames) {
      const font = page.commonObjs.get(name);
      assert.equal(font.disableFontFace, false);
      assert.equal(
        font.missingFile,
        true,
        "Fixture uses standard PDF fonts without embedded glyph paths",
      );
    }
    const text = await page.getTextContent();
    assert.ok(text.items.some((item) => item.str.includes("Tarun B")));
  } finally {
    await task.destroy();
  }
});
test("Native root gestures without coordinates use the focused output instead of the page corner", () => {
  const root = eventHub(),
    host = eventHub(),
    page = {},
    source = {};
  root.body = {};
  root.documentElement = {};
  root.defaultView = {};
  root.activeElement = page;
  root.elementFromPoint = () => page;
  let scale = 1,
    prevented = 0;
  Object.assign(host, {
    ownerDocument: root,
    closest: () => ({ contains: (node) => node === page }),
    getClientRects: () => [{}],
  });
  const c = {};
  vm.createContext(c);
  vm.runInContext(between(v2, "function attachPinchZoom(", "function syncViewportHeight("), c);
  c.attachPinchZoom(
    host,
    () => scale,
    (value) => (scale = value),
  );
  const pinch = (target) => ({
    target,
    ctrlKey: true,
    clientX: 0,
    clientY: 0,
    deltaY: -20,
    preventDefault() {
      prevented++;
    },
  });
  root.emit("wheel", pinch(root.body));
  assert.ok(scale > 1);
  const previous = scale;
  root.emit("wheel", pinch(root.defaultView));
  assert.ok(scale > previous);
  root.activeElement = source;
  const next = scale;
  root.emit("wheel", pinch(root));
  assert.equal(scale, next);
  assert.equal(prevented, 2);
});
test("Browser-native pinch remains allowed and draft reload waits for the hidden preview to attach", () => {
  const css = source("site/assets/resume-v2.css");
  assert.match(css, /touch-action:\s*pan-x pan-y pinch-zoom/);
  const browser = source("tests/browser.mjs");
  assert.match(
    browser,
    /await page\.reload\(\);\s*await page\.waitForSelector\("#previewPages",\s*\{\s*state:\s*"attached"/,
  );
});
