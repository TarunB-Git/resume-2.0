/* Uploaded documents live separately from the editable résumé model. */
const OriginalFiles = (() => {
  let database;
  const scripts = new Map();
  function open() {
    if (!database)
      database = new Promise((resolve, reject) => {
        const request = indexedDB.open("resume20-original-documents", 1);
        request.onupgradeneeded = () => request.result.createObjectStore("files");
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      }).catch((error) => {
        database = null;
        throw error;
      });
    return database;
  }
  async function transaction(mode, operation) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("files", mode);
      const request = operation(tx.objectStore("files"));
      let result;
      request.onsuccess = () => {
        result = request.result;
      };
      tx.oncomplete = () => resolve(result);
      tx.onerror = () => reject(tx.error || request.error);
      tx.onabort = () => reject(tx.error || new Error("Document storage interrupted."));
    });
  }
  function archivePath(source) {
    if (!source || !/^[\w-]{1,100}$/.test(source.id) || !["pdf", "docx"].includes(source.format))
      throw new Error("Invalid uploaded document reference.");
    return `originals/${source.id}.${source.format}`;
  }
  function loadScript(path) {
    if (!scripts.has(path))
      scripts.set(
        path,
        new Promise((resolve, reject) => {
          const script = document.createElement("script");
          script.src = path;
          script.onload = resolve;
          script.onerror = () => {
            scripts.delete(path);
            reject(new Error("Reload to load the document renderer."));
          };
          document.head.append(script);
        }),
      );
    return scripts.get(path);
  }
  async function wordLibraries() {
    await loadScript("assets/vendor/jszip-3.10.1.min.js");
    await loadScript("assets/vendor/docx-preview-0.4.0.min.js");
  }
  async function safeWordBytes(file) {
    await wordLibraries();
    const zip = await JSZip.loadAsync(await file.arrayBuffer());
    const entries = Object.values(zip.files);
    if (
      entries.length > 2000 ||
      entries.reduce((size, entry) => size + (entry._data?.uncompressedSize || 0), 0) >
        100 * 1024 * 1024
    )
      throw new Error("Choose a Word document with fewer embedded resources.");
    for (const entry of entries) {
      if (!entry.name.endsWith(".rels")) continue;
      const source = await entry.async("string");
      if (/<!DOCTYPE|<!ENTITY/i.test(source))
        throw new Error("Review the Word document’s relationships.");
      const xml = new DOMParser().parseFromString(source, "application/xml");
      if (xml.querySelector("parsererror"))
        throw new Error("Review the Word document’s relationships.");
      for (const relation of [...xml.getElementsByTagNameNS("*", "Relationship")]) {
        if (relation.getAttribute("TargetMode")?.toLowerCase() === "external") relation.remove();
      }
      zip.file(entry.name, new XMLSerializer().serializeToString(xml));
    }
    return zip.generateAsync({ type: "uint8array" });
  }
  return {
    async get(id) {
      const stored = await transaction("readonly", (store) => store.get(id));
      // Older sessions stored Blob values directly.
      return stored?.bytes instanceof ArrayBuffer
        ? new Blob([stored.bytes], { type: stored.type || "" })
        : stored;
    },
    async put(id, blob) {
      // WebKit private contexts support byte records but reject IDB Blob/File values.
      const record = { bytes: await blob.arrayBuffer(), type: blob.type };
      return transaction("readwrite", (store) => store.put(record, id));
    },
    remove: (id) => transaction("readwrite", (store) => store.delete(id)),
    archivePath,
    safeWordBytes,
  };
})();

async function removeUnusedOriginalFiles(sources) {
  const retained = new Set(workspace.resumes.map((item) => item.sourceDocument?.id));
  const ids = new Set(sources.filter(Boolean).map((source) => source.id));
  await Promise.all(
    [...ids].filter((id) => !retained.has(id)).map((id) => OriginalFiles.remove(id)),
  );
}

let originalPreview = null;
function currentOriginal() {
  return workspace.resumes.find((item) => item.id === activeResumeId)?.sourceDocument;
}
function viewingOriginal() {
  const record = workspace.resumes.find((item) => item.id === activeResumeId);
  return Boolean(record?.sourceDocument && record.documentView !== "edited");
}
function stopOriginalPreview() {
  if (!originalPreview) return;
  originalPreview.cancelled = true;
  originalPreview.render?.cancel();
  originalPreview.task?.destroy().catch(() => {});
  originalPreview.resize?.disconnect();
  originalPreview.disposePinch?.();
  originalPreview.resolveFrameLoad?.();
  originalPreview = null;
}
function syncOriginalControl() {
  const source = currentOriginal(),
    select = $("#documentView");
  if (viewingOriginal()) {
    activeMode = source.format === "docx" ? "word" : "pdf";
    workspace.outputMode = activeMode;
    $$(".mode-tab").forEach((tab) => {
      tab.classList.toggle("active", tab.dataset.mode === activeMode);
      tab.setAttribute("aria-selected", String(tab.dataset.mode === activeMode));
    });
  }
  select.classList.toggle("hidden", !source);
  select.value = viewingOriginal() ? "original" : "edited";
  select.options[0].textContent = source?.format === "docx" ? "Uploaded Word" : "Uploaded PDF";
  $("#paperSize").classList.toggle("hidden", viewingOriginal());
  $("#insertButton").classList.toggle("hidden", viewingOriginal());
  $("#inspectPdfButton").classList.toggle("hidden", viewingOriginal() && source?.format === "docx");
}
function renderOriginalOutput() {
  if (!viewingOriginal()) {
    stopOriginalPreview();
    return false;
  }
  const source = currentOriginal(),
    host = $("#previewBody");
  $("#wordToolbar").classList.add("hidden");
  $("#toggleWordToolbar").classList.add("hidden");
  $("#outputSubtitle").textContent = source.name;
  host.setAttribute("aria-label", "Uploaded document");
  if (
    originalPreview?.id === source.id &&
    originalPreview.host === host &&
    host.querySelector(".original-document")
  ) {
    fitPreview();
    return true;
  }
  stopOriginalPreview();
  const state = { id: source.id, host, cancelled: false };
  originalPreview = state;
  host.innerHTML =
    '<div class="preview-pages original-document" id="previewPages"><p class="original-status" role="status">Loading uploaded document…</p></div>';
  const stack = $("#previewPages", host);
  stack.dataset.pageWidth = "320";
  stack.dataset.pageHeight = "200";
  previewPage = 1;
  previewPageCount = 1;
  $("#pageNavigator").classList.toggle("hidden", source.format === "docx");
  fitPreview();
  (async () => {
    const file = await OriginalFiles.get(source.id);
    if (state.cancelled) return;
    if (!file) throw new Error("Import the original document or restore its session ZIP.");
    if (source.format === "pdf") await renderUploadedPdf(file, stack, state);
    else await renderUploadedWord(file, stack, state);
    if (!state.cancelled) {
      renderSectionOutline();
      fitPreview();
    }
  })().catch((error) => {
    if (state.cancelled) return;
    stack.replaceChildren();
    stack.dataset.pageWidth = "320";
    stack.dataset.pageHeight = "200";
    const message = document.createElement("p");
    message.className = "original-status";
    message.textContent = error.message;
    const button = document.createElement("button");
    button.className = "button";
    button.textContent = "Show edited résumé";
    button.onclick = () => {
      $("#documentView").value = "edited";
      $("#documentView").dispatchEvent(new Event("change"));
    };
    stack.append(message, button);
    fitPreview();
  });
  return true;
}
async function renderUploadedPdf(file, stack, state) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (state.cancelled) return;
  state.task = pdfjsLib.getDocument(pdfPreviewOptions(bytes));
  const pdf = await state.task.promise;
  if (state.cancelled) return;
  stack.replaceChildren();
  previewPageCount = pdf.numPages;
  for (let number = 1; number <= pdf.numPages; number++) {
    const page = await pdf.getPage(number);
    if (state.cancelled) return;
    const viewport = page.getViewport({ scale: 96 / 72 });
    const card = document.createElement("div");
    card.className = "preview-page";
    card.dataset.previewPage = number;
    const paper = document.createElement("div");
    paper.className = "original-pdf-page";
    paper.style.width = viewport.width + "px";
    paper.style.height = viewport.height + "px";
    const canvas = document.createElement("canvas"),
      layer = document.createElement("div");
    const ratio = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.ceil(viewport.width * ratio);
    canvas.height = Math.ceil(viewport.height * ratio);
    canvas.setAttribute("aria-label", `Uploaded PDF page ${number}`);
    layer.className = "original-text-layer";
    layer.style.setProperty("--scale-factor", String(96 / 72));
    paper.append(canvas, layer);
    card.append(paper);
    stack.append(card);
    stack.dataset.pageWidth =
      number === 1 ? viewport.width : Math.max(Number(stack.dataset.pageWidth), viewport.width);
    if (number === 1) stack.dataset.pageHeight = String(viewport.height);
    state.render = page.render({
      canvasContext: canvas.getContext("2d"),
      viewport: page.getViewport({ scale: (96 / 72) * ratio }),
    });
    await state.render.promise;
    if (state.cancelled) return;
    const content = await page.getTextContent();
    if (state.cancelled) return;
    const textTask = pdfjsLib.renderTextLayer({
      textContentSource: content,
      container: layer,
      viewport,
      textDivs: [],
    });
    await textTask.promise;
    if (state.cancelled) return;
    updatePageControls(number === previewPage && previewPage > 1);
  }
}
async function renderUploadedWord(file, stack, state) {
  const data = await OriginalFiles.safeWordBytes(file);
  if (state.cancelled) return;
  const frame = document.createElement("iframe");
  frame.title = "Uploaded Word document";
  frame.className = "original-word-frame";
  frame.setAttribute("sandbox", "allow-same-origin");
  frame.style.width = "816px";
  const loaded = new Promise((resolve) => {
    frame.onload = resolve;
    state.resolveFrameLoad = resolve;
  });
  frame.srcdoc =
    "<!doctype html><html><head><meta charset=\"utf-8\"><meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'none'; img-src data: blob:; font-src data: blob:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'\"><style>html,body{margin:0;padding:0}main{display:flex;flex-direction:column;align-items:center;gap:16px}section.imported-docx{margin:0!important;flex-shrink:0;box-shadow:0 1px 4px #0003}</style></head><body></body></html>";
  stack.replaceChildren(frame);
  await loaded;
  if (state.cancelled) return;
  const doc = frame.contentDocument;
  const content = doc.createElement("main"),
    styles = doc.createElement("div");
  styles.hidden = true;
  doc.body.append(styles, content);
  await docx.renderAsync(data, content, styles, {
    className: "imported-docx",
    inWrapper: false,
    breakPages: true,
    ignoreLastRenderedPageBreak: false,
    renderHeaders: true,
    renderFooters: true,
    renderFootnotes: true,
    renderEndnotes: true,
    renderAltChunks: false,
    useBase64URL: true,
  });
  if (state.cancelled) return;
  doc.addEventListener("click", (event) => {
    if (event.target.closest("a")) event.preventDefault();
  });
  await doc.fonts.ready;
  if (state.cancelled) return;
  const sections = [...doc.querySelectorAll("section.imported-docx")];
  const width = Math.max(1, ...sections.map((section) => section.getBoundingClientRect().width));
  const resize = () => {
    if (state.cancelled) return;
    frame.style.height = doc.body.scrollHeight + "px";
    fitPreview();
  };
  frame.style.width = width + "px";
  stack.dataset.pageWidth = width;
  stack.dataset.pageHeight = sections[0]?.getBoundingClientRect().height || 1056;
  previewPageCount = Math.max(1, sections.length);
  state.resize = new ResizeObserver(resize);
  state.resize.observe(doc.body);
  state.disposePinch = attachPinchZoom(
    doc.body,
    () => documentScale(stack),
    (scale, point) => {
      const bounds = frame.getBoundingClientRect(),
        current = documentScale(stack);
      setDocumentZoom(
        scale,
        point
          ? { x: bounds.left + point.x * current, y: bounds.top + point.y * current }
          : undefined,
      );
    },
  );
  resize();
}
async function restoreOriginalFiles(incoming, archive) {
  const copy = deepClone(incoming),
    remapped = new Map(),
    installed = [];
  try {
    for (const record of copy.resumes) {
      const source = record.sourceDocument;
      if (!source) continue;
      if (!archive) throw new Error("Choose the session ZIP to restore uploaded documents.");
      const path = OriginalFiles.archivePath(source);
      if (!remapped.has(path)) {
        const entry = await readArchiveEntry(archive, (name) => name === path);
        if (!entry) throw new Error("The session needs its uploaded document: " + source.name);
        const id = makeWorkspaceId("original");
        await OriginalFiles.put(
          id,
          new Blob([entry.bytes], {
            type:
              source.format === "pdf"
                ? "application/pdf"
                : "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          }),
        );
        installed.push(id);
        remapped.set(path, id);
      }
      source.id = remapped.get(path);
    }
    return copy;
  } catch (error) {
    await Promise.all(installed.map((id) => OriginalFiles.remove(id).catch(() => {})));
    throw error;
  }
}
