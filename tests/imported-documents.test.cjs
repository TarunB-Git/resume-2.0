const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
const root = path.join(__dirname, "..");
const imports = fs.readFileSync(path.join(root, "site/assets/imported-documents.js"), "utf8");
const studio = fs.readFileSync(path.join(root, "site/assets/studio.js"), "utf8");
const formats = require("../site/assets/formats.js");

function importReviewContext() {
  let sequence = 0;
  const stored = new Map([["old-upload", new Blob(["old"])]]);
  const dialog = { isConnected: true };
  const nodes = {
    "#modalRoot": {
      replaceChildren() {
        dialog.isConnected = false;
      },
    },
    "#importReviewJson": { closest: () => dialog },
    "#importReviewError": { hidden: true, textContent: "" },
    "#newImport": { disabled: false },
    "#replaceImport": { disabled: false },
    "#cancelImport": { disabled: false },
  };
  const context = {
    Blob,
    ResumeFormats: formats,
    activeResumeId: "current",
    activeMode: "word",
    pendingImportOptions: null,
    workspace: {
      resumes: [
        {
          id: "current",
          data: { basics: { name: "Original" } },
          sourceDocument: { id: "old-upload", format: "pdf" },
        },
      ],
      folders: [{ id: "folder" }],
      openIds: ["current"],
    },
    $: (id) => nodes[id],
    $$: () => [],
    escapeHtml: (value) => value,
    countScalarFields: () => 1,
    makeWorkspaceId: () => "file-" + ++sequence,
    switchResume() {},
    resetV2SourceState() {},
    updateDocumentStatus() {},
    syncControls() {},
    toast() {},
  };
  vm.createContext(context);
  vm.runInContext(imports, context);
  const files = vm.runInContext("OriginalFiles", context);
  files.put = async (id, blob) => stored.set(id, blob);
  files.remove = async (id) => stored.delete(id);
  vm.runInContext(
    studio.slice(
      studio.indexOf("function showImportReview("),
      studio.indexOf("let comparisonSource"),
    ),
    context,
  );
  return { context, files, nodes, stored };
}

test("Dismissing an upload review during storage cancels the import and removes its file", async () => {
  const { context, files, nodes, stored } = importReviewContext();
  let finish;
  files.put = async (id, blob) => {
    await new Promise((resolve) => {
      finish = resolve;
    });
    stored.set(id, blob);
  };
  context.showImportReview({ basics: { name: "Replacement" } }, "text", "resume.pdf", [], {
    file: new Blob(["%PDF-"]),
    format: "pdf",
  });
  const pending = nodes["#newImport"].onclick();
  nodes["#modalRoot"].replaceChildren();
  finish();
  await pending;
  assert.equal(context.workspace.resumes.length, 1);
  assert.equal(context.workspace.resumes[0].data.basics.name, "Original");
  assert.deepEqual([...stored.keys()], ["old-upload"]);
  assert.equal(context.activeMode, "word");
});

test("Replacing an upload removes the previous file and retains its replacement", async () => {
  const { context, nodes, stored } = importReviewContext();
  context.showImportReview({ basics: { name: "Replacement" } }, "text", "resume.pdf", [], {
    file: new Blob(["%PDF-"]),
    format: "pdf",
  });
  await nodes["#replaceImport"].onclick();
  assert.deepEqual([...stored.keys()], ["file-1"]);
  assert.equal(context.workspace.resumes[0].sourceDocument.id, "file-1");
  assert.equal(context.workspace.resumes[0].documentView, "original");
});

test("Original-file cleanup retains shared uploads and deletes each unused file once", async () => {
  const context = { workspace: { resumes: [{ sourceDocument: { id: "shared" } }] } };
  vm.createContext(context);
  vm.runInContext(imports, context);
  const removed = [];
  vm.runInContext("OriginalFiles", context).remove = async (id) => removed.push(id);
  await context.removeUnusedOriginalFiles([
    { id: "shared" },
    { id: "unused" },
    { id: "unused" },
    null,
  ]);
  assert.deepEqual(removed, ["unused"]);
});

test("Cancelling a PDF preview during file reading leaves the PDF worker unopened", async () => {
  let finish,
    opened = 0;
  const context = {
    Uint8Array,
    pdfjsLib: {
      getDocument() {
        opened++;
      },
    },
  };
  vm.createContext(context);
  vm.runInContext(imports, context);
  const state = { cancelled: false };
  const pending = context.renderUploadedPdf(
    {
      arrayBuffer: () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    },
    null,
    state,
  );
  state.cancelled = true;
  finish(new ArrayBuffer(0));
  await pending;
  assert.equal(opened, 0);
});

test("Dismissing a session import rolls back its restored upload files", async () => {
  const { context, files, nodes, stored } = importReviewContext();
  const dialog = { isConnected: true };
  nodes["#modalRoot"].replaceChildren = () => {
    dialog.isConnected = false;
  };
  nodes["#sessionImportTitle"] = { closest: () => dialog };
  nodes["#cancelSessionImport"] = {};
  nodes["#confirmSessionImport"] = { disabled: false };
  context.deepClone = (value) => structuredClone(value);
  context.readArchiveEntry = async () => ({ bytes: new Uint8Array([37, 80, 68, 70]) });
  context.saveWordDocument = () => {};
  context.persistResume = () => {};
  context.customTemplates = [];
  let finish;
  files.put = async (id, blob) => {
    await new Promise((resolve) => {
      finish = resolve;
    });
    stored.set(id, blob);
  };
  const v2 = fs.readFileSync(path.join(root, "site/assets/workspace-v2.js"), "utf8");
  vm.runInContext(
    v2.slice(v2.indexOf("function showSessionImport("), v2.indexOf("function documentScale(")),
    context,
  );
  context.showSessionImport(
    {
      folders: [{ id: "folder", name: "Imported" }],
      resumes: [
        {
          id: "new",
          folderId: "folder",
          data: { basics: { name: "Imported" } },
          sourceDocument: { id: "source", format: "pdf", name: "resume.pdf" },
        },
      ],
    },
    [],
    "session.zip",
    undefined,
    {},
  );
  const pending = nodes["#confirmSessionImport"].onclick();
  // The archive read completes before its file is written.
  await new Promise((resolve) => setImmediate(resolve));
  nodes["#modalRoot"].replaceChildren();
  finish();
  await pending;
  assert.deepEqual([...stored.keys()], ["old-upload"]);
  assert.equal(context.workspace.resumes.length, 1);
  assert.equal(nodes["#confirmSessionImport"].disabled, false);
});

test("Original documents restore with independent file identities and identical bytes", async () => {
  let sequence = 0;
  const stored = new Map(),
    bytes = new Uint8Array([37, 80, 68, 70, 45]);
  const incoming = {
    resumes: [
      { id: "a", sourceDocument: { id: "existing", name: "resume.pdf", format: "pdf" } },
      { id: "b", sourceDocument: { id: "existing", name: "resume.pdf", format: "pdf" } },
    ],
  };
  const context = {
    Blob,
    deepClone: (value) => structuredClone(value),
    makeWorkspaceId: () => "copy-" + ++sequence,
    readArchiveEntry: async (_, predicate) =>
      predicate("originals/existing.pdf") ? { bytes } : null,
  };
  vm.createContext(context);
  vm.runInContext(imports, context);
  const files = vm.runInContext("OriginalFiles", context);
  files.put = async (id, blob) => stored.set(id, blob);
  files.remove = async (id) => stored.delete(id);
  const restored = await context.restoreOriginalFiles(incoming, {});
  assert.equal(restored.resumes[0].sourceDocument.id, "copy-1");
  assert.equal(restored.resumes[1].sourceDocument.id, "copy-1");
  assert.equal(incoming.resumes[0].sourceDocument.id, "existing");
  assert.deepEqual(new Uint8Array(await stored.get("copy-1").arrayBuffer()), bytes);
  assert.throws(() => files.archivePath({ id: "../other", format: "pdf" }));
  assert.throws(() => files.archivePath({ id: "file", format: "html" }));
});

test("Incomplete original-file restoration rolls back installed files", async () => {
  const stored = new Map();
  const context = {
    Blob,
    deepClone: (value) => structuredClone(value),
    makeWorkspaceId: () => "copy",
    readArchiveEntry: async (_, predicate) =>
      predicate("originals/first.pdf") ? { bytes: new Uint8Array([1]) } : null,
  };
  vm.createContext(context);
  vm.runInContext(imports, context);
  const files = vm.runInContext("OriginalFiles", context);
  files.put = async (id, blob) => stored.set(id, blob);
  files.remove = async (id) => stored.delete(id);
  const incoming = {
    resumes: ["first", "missing"].map((id) => ({
      sourceDocument: { id, name: id + ".pdf", format: "pdf" },
    })),
  };
  await assert.rejects(context.restoreOriginalFiles(incoming, {}), /uploaded document/);
  assert.equal(stored.size, 0);
  await assert.rejects(context.restoreOriginalFiles(incoming, null), /session ZIP/);
});

test("PDF extraction follows line geometry when text runs arrive out of order", async () => {
  let destroyed = false;
  const item = (str, x, y, width) => ({
    str,
    width,
    height: 10,
    transform: [1, 0, 0, 1, x, y],
  });
  const pdf = {
    numPages: 1,
    getAttachments: async () => null,
    destroy: async () => {
      destroyed = true;
    },
    getPage: async () => ({
      getTextContent: async () => ({
        items: [
          item("2024", 200, 70, 25),
          item("Tarun", 20, 100, 28),
          item("B", 52, 100, 6),
          item("Experience", 20, 70, 60),
        ],
      }),
    }),
  };
  const library = { getDocument: () => ({ promise: Promise.resolve(pdf) }) };
  const context = { window: { pdfjsLib: library }, pdfjsLib: library, Uint8Array, TextDecoder };
  vm.createContext(context);
  vm.runInContext(
    studio.slice(
      studio.indexOf("async function extractTextFromPdf("),
      studio.indexOf("async function extractTextFromDocx("),
    ),
    context,
  );
  const result = await context.extractTextFromPdf(new Blob(["%PDF-"]));
  assert.equal(result.text, "Tarun B\nExperience 2024");
  assert.equal(destroyed, true);
});

test("Add field inserts into the focused source before selecting its editable name", () => {
  const editor = {
    value: '{"basics":{}}',
    focus() {},
    setSelectionRange(start, end) {
      this.selection = [start, end];
    },
  };
  const context = {
    resume: { basics: {}, Name1: ["Existing"] },
    jsonEditor: editor,
    sourceDraftError: () => false,
    updateDocumentStatus() {},
    activateInput() {},
    toast() {},
    getComputedStyle: () => ({ lineHeight: "28" }),
  };
  vm.createContext(context);
  vm.runInContext(
    studio.slice(
      studio.indexOf("function showAddFieldModal("),
      studio.indexOf("function sanitizeTemplateCss("),
    ),
    context,
  );
  context.showAddFieldModal();
  assert.deepEqual(JSON.parse(editor.value).Name2, ["New detail"]);
  assert.equal(editor.value.slice(...editor.selection), '"Name2"');
});

test("Upload storage errors remain visible and preserve the review for retry", async () => {
  const { context, files, nodes, stored } = importReviewContext();
  files.put = async () => {
    throw new Error("Document storage is full.");
  };
  context.showImportReview({ basics: { name: "Replacement" } }, "text", "resume.pdf", [], {
    file: new Blob(["%PDF-"]),
    format: "pdf",
  });
  await nodes["#newImport"].onclick();
  assert.equal(nodes["#importReviewError"].hidden, false);
  assert.equal(nodes["#importReviewError"].textContent, "Document storage is full.");
  assert.equal(context.workspace.resumes.length, 1);
  assert.equal(nodes["#importReviewJson"].closest().isConnected, true);
  assert.equal(nodes["#newImport"].disabled, false);
  assert.deepEqual([...stored.keys()], ["old-upload"]);
  files.put = async (id, blob) => stored.set(id, blob);
  await nodes["#newImport"].onclick();
  assert.equal(nodes["#importReviewError"].hidden, true);
  assert.equal(nodes["#importReviewJson"].closest().isConnected, false);
});

function originalStorageContext() {
  const stored = new Map();
  let nextFailure = null;
  const context = {
    Blob,
    ArrayBuffer,
    indexedDB: {
      open() {
        const request = {};
        queueMicrotask(() => {
          request.result = {
            transaction() {
              const tx = {
                objectStore: () => ({
                  put(value, key) {
                    assert.ok(!(value instanceof Blob), "IDB receives bytes, not Blob/File");
                    const write = {};
                    queueMicrotask(() => {
                      if (nextFailure) {
                        tx.error = nextFailure;
                        nextFailure = null;
                        tx.onabort();
                      } else {
                        stored.set(key, structuredClone(value));
                        write.result = key;
                        write.onsuccess();
                        tx.oncomplete();
                      }
                    });
                    return write;
                  },
                  get(key) {
                    const read = {};
                    queueMicrotask(() => {
                      read.result = stored.get(key);
                      read.onsuccess();
                      tx.oncomplete();
                    });
                    return read;
                  },
                }),
              };
              return tx;
            },
          };
          request.onsuccess();
        });
        return request;
      },
    },
  };
  vm.createContext(context);
  vm.runInContext(imports, context);
  return {
    files: vm.runInContext("OriginalFiles", context),
    stored,
    failNext(error) {
      nextFailure = error;
    },
  };
}

test("Original storage writes cloneable bytes and restores exact PDF/DOCX data and MIME types", async () => {
  const { files, stored } = originalStorageContext();
  for (const type of [
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ]) {
    const blob = new Blob([new Uint8Array([0, 255, 1, 10, 13, 0, 128])], { type });
    await files.put(type, blob);
    assert.ok(stored.get(type).bytes instanceof ArrayBuffer);
    const result = await files.get(type);
    assert.equal(result.type, type);
    assert.deepEqual(await result.arrayBuffer(), await blob.arrayBuffer());
  }
  assert.equal(await files.get("missing"), undefined);
});

test("Original storage reads legacy Blob records and propagates transaction aborts", async () => {
  const { files, stored, failNext } = originalStorageContext();
  const legacy = new Blob(["existing original"], { type: "application/pdf" });
  stored.set("legacy", legacy);
  assert.equal(await files.get("legacy"), legacy);
  failNext(new Error("Quota exceeded"));
  await assert.rejects(files.put("new", legacy), /Quota exceeded/);
  assert.equal(await files.get("new"), undefined);
  await files.put("new", legacy);
  assert.equal(await (await files.get("new")).text(), "existing original");
});
