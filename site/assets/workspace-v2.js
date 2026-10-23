/* Source adapters, session recovery and touch-aware workspace controls. */
let mobilePane = "document";
let mobileWordFormattingOpen = false;
let sourcePreviewPending = false;
let mobileViewportBaseline = 0;
let mobileKeyboardOpen = false;
let virtualKeyboardInitialOverlay = null;
const sourceState = {
  xmlCommitted: "",
  xmlError: null,
  markdownCommitted: "",
  markdownError: null,
  latexError: null,
  pendingDrafts: null,
};
function isCompactLayout() {
  return window.matchMedia("(max-width: 900px)").matches;
}
function markdownHasChanges() {
  return $("#markdownInput").value !== sourceState.markdownCommitted;
}
function sourceDraftError() {
  return (
    latestJsonError || sourceState.xmlError || sourceState.markdownError || sourceState.latexError
  );
}
function sourceErrorMode() {
  return latestJsonError
    ? "json"
    : sourceState.xmlError
      ? "xml"
      : sourceState.markdownError
        ? "markdown"
        : sourceState.latexError
          ? "latex"
          : null;
}
function collectSourceDrafts() {
  if (sourceState.pendingDrafts) return sourceState.pendingDrafts;
  const drafts = {};
  for (const [mode, id] of [
    ["xml", "xmlEditor"],
    ["markdown", "markdownInput"],
    ["latex", "latexEditor"],
  ]) {
    const error = sourceState[mode + "Error"];
    if (error) drafts[mode] = { text: $("#" + id)?.value || "", message: error.message };
  }
  return Object.keys(drafts).length ? drafts : null;
}
function resetV2SourceState(drafts) {
  sourceState.xmlError = null;
  sourceState.markdownError = null;
  sourceState.latexError = null;
  sourceState.xmlCommitted = "";
  sourceState.markdownCommitted = "";
  sourceState.pendingDrafts = drafts || null;
}
function restoreV2Drafts(drafts) {
  if (!drafts) return;
  for (const [mode, id] of [
    ["xml", "xmlEditor"],
    ["markdown", "markdownInput"],
    ["latex", "latexEditor"],
  ]) {
    if (drafts[mode]?.text == null) continue;
    $("#" + id).value = drafts[mode].text;
    sourceState[mode + "Error"] = new Error(
      drafts[mode].message || "Recovered source draft. Correct it before converting.",
    );
    if (mode === "xml") $("#xmlStatus").textContent = sourceState.xmlError.message;
    if (mode === "markdown") $("#markdownStatus").textContent = sourceState.markdownError.message;
    if (mode === "latex") setJsonStatus(sourceState.latexError.message, true);
  }
}
function syncV2Source() {
  const editor = $("#xmlEditor");
  if (!editor) return;
  if (document.activeElement !== editor && !sourceState.xmlError) {
    try {
      editor.value = ResumeFormats.toXml(resume);
      sourceState.xmlCommitted = editor.value;
    } catch (error) {
      latestJsonError = error;
      setJsonStatus(error.message, true);
      $("#xmlStatus").textContent = "Correct the model in JSON before converting to XML.";
      return;
    }
  }
  $("#xmlStats").textContent =
    new TextEncoder().encode(editor.value).length.toLocaleString() + " B · XML";
  if (sourceState.pendingDrafts) {
    const drafts = sourceState.pendingDrafts;
    sourceState.pendingDrafts = null;
    restoreV2Drafts(drafts);
  }
  $("#xmlStatus").textContent = sourceState.xmlError?.message || "XML valid · preview synced";
  $("#panelXml .editor-foot")?.classList.toggle("has-error", Boolean(sourceState.xmlError));
  $("#xmlStatus").classList?.toggle("editor-error", Boolean(sourceState.xmlError));
  $("#markdownStatus").textContent = sourceState.markdownError?.message || "Markdown synced";
}
function parseXmlLive() {
  const editor = $("#xmlEditor");
  try {
    const parsed = ResumeFormats.fromXml(editor.value);
    resume = parsed;
    sourceState.xmlError = null;
    sourceState.xmlCommitted = editor.value;
    updateJsonEditor();
    syncControls();
    renderOutput();
    $("#xmlStatus").textContent = "XML valid · all editors synced";
  } catch (error) {
    sourceState.xmlError = error;
    $("#xmlStatus").textContent = error.message;
    persistResume();
  }
  $("#panelXml .editor-foot").classList.toggle("has-error", Boolean(sourceState.xmlError));
  $("#xmlStatus").classList.toggle("editor-error", Boolean(sourceState.xmlError));
}
function exportV2Format(format, stem) {
  const types = {
    xml: ["application/xml", ResumeFormats.toXml],
    "json-resume": [
      "application/json",
      (data) => JSON.stringify(ResumeFormats.toJsonResume(data), null, 2),
    ],
    html: ["text/html", () => documentHtmlExport()],
    text: ["text/plain", () => plainDocumentText()],
  };
  if (!types[format]) return false;
  const [type, convert] = types[format],
    extension = { xml: "xml", "json-resume": "jsonresume.json", html: "html", text: "txt" }[format];
  download(new Blob([convert(resume)], { type: type + ";charset=utf-8" }), stem + "." + extension);
  toast("Document exported");
  return true;
}
function importHtmlResume(source) {
  const parsed = new DOMParser().parseFromString(source, "text/html");
  const embedded = parsed.querySelector('script#resume20-source[type="application/json"]');
  if (embedded) return ResumeFormats.assertModel(JSON.parse(embedded.textContent));
  parsed
    .querySelectorAll("script,style,iframe,object,embed,template,nav")
    .forEach((node) => node.remove());
  parsed.querySelectorAll("br").forEach((node) => node.replaceWith("\n"));
  parsed
    .querySelectorAll("h1,h2,h3,h4,p,li,header,section,div")
    .forEach((node) => node.append("\n"));
  return parseResumeText(parsed.body.textContent);
}
async function inspectSessionArchive(file) {
  const manifest = await readArchiveEntry(file, (name) => name === "session.json");
  if (manifest) {
    const data = JSON.parse(manifest.text);
    if (data.format !== "resume20.session" || data.version !== 1)
      throw new Error("Unsupported session archive version.");
    showSessionImport(data.workspace, data.templates || [], file.name, data.settings, file);
    return true;
  }
  const entry = await readArchiveEntry(file, (name) => name === "workspace.json");
  if (!entry) return false;
  const templates = await readArchiveEntry(file, (name) => name === "templates.json");
  showSessionImport(
    JSON.parse(entry.text),
    templates ? JSON.parse(templates.text) : [],
    file.name,
    undefined,
    file,
  );
  return true;
}
function showSessionImport(incoming, templates, filename, settings, archive = null) {
  ResumeFormats.validateSession(incoming);
  const root = $("#modalRoot");
  root.innerHTML = `<div class="modal-backdrop"><section class="modal session-import" role="dialog" aria-modal="true" aria-labelledby="sessionImportTitle"><h2 id="sessionImportTitle">Restore a session</h2><p>${escapeHtml(filename)} contains ${incoming.resumes.length} résumé${incoming.resumes.length === 1 ? "" : "s"}, ${incoming.folders.length} folders and ${templates.length} templates.</p><p>The imported items will be added to this browser. Existing résumés stay intact. Duplicate identifiers are replaced with new ones.</p><div class="modal-actions"><button class="button" id="cancelSessionImport">Cancel</button><button class="button primary" id="confirmSessionImport">Add session</button></div></section></div>`;
  $("#cancelSessionImport").onclick = () => root.replaceChildren();
  const dialog = $("#sessionImportTitle").closest(".modal");
  $("#confirmSessionImport").onclick = async () => {
    if ($("#confirmSessionImport").disabled) return;
    const button = $("#confirmSessionImport");
    button.disabled = true;
    let restored,
      applied = false;
    try {
      saveWordDocument();
      persistResume();
      restored = incoming.resumes.some((item) => item.sourceDocument)
        ? await restoreOriginalFiles(incoming, archive)
        : incoming;
      if (!dialog.isConnected) return;
      const merged = ResumeFormats.mergeSession(
        workspace,
        restored,
        customTemplates,
        templates,
        makeWorkspaceId,
      );
      for (const template of merged.templates)
        if (template.css) template.css = sanitizeTemplateCss(template.css);
      workspace = merged.workspace;
      applied = true;
      customTemplates = merged.templates;
      persistTemplates();
      restoreViewSettings(settings);
      activeMode = workspace.outputMode === "word" ? "word" : "pdf";
      activeInput = ["json", "xml", "latex", "markdown"].includes(workspace.inputMode)
        ? workspace.inputMode
        : "json";
      workspaceLayout = workspace.view === "document" ? "document" : "split";
      sourceFirst = workspace.sourceFirst !== false;
      if (workspace.panelWeights) panelWeights = { ...panelWeights, ...workspace.panelWeights };
      collapsedPanels = workspace.collapsedPanels || { files: isCompactLayout() };
      root.replaceChildren();
      switchResume(workspace.activeId);
      activateInput(sourceErrorMode() || activeInput, false);
      $$(".mode-tab").forEach((tab) => {
        tab.classList.toggle("active", tab.dataset.mode === activeMode);
        tab.setAttribute("aria-selected", String(tab.dataset.mode === activeMode));
      });
      saveWorkspace();
      toast("Session restored · existing work kept");
    } catch (error) {
      toast("Session could not be restored: " + error.message);
    } finally {
      if (!applied && restored && restored !== incoming)
        await removeUnusedOriginalFiles(restored.resumes.map((item) => item.sourceDocument)).catch(
          () => {},
        );
      button.disabled = false;
    }
  };
}
function documentScale(stack) {
  return Number(stack?.dataset.displayScale) || 1;
}
function applyDocumentScale(stack, value, width) {
  const scale = Math.max(0.25, Math.min(3, value));
  let surface = stack.parentElement;
  if (!surface.classList.contains("document-zoom-surface")) {
    surface = document.createElement("div");
    surface.className = "document-zoom-surface";
    stack.before(surface);
    surface.append(stack);
  }
  stack.dataset.displayScale = String(scale);
  stack.style.transform = `scale(${scale})`;
  surface.style.width = `${width * scale}px`;
  surface.style.height = `${stack.offsetHeight * scale}px`;
}
function anchorDocumentScale(host, stack, scale, anchor, apply) {
  const before = stack.getBoundingClientRect(),
    old = documentScale(stack);
  const point = anchor || {
    x: host.getBoundingClientRect().left + host.clientWidth / 2,
    y: host.getBoundingClientRect().top + host.clientHeight / 2,
  };
  const content = { x: (point.x - before.left) / old, y: (point.y - before.top) / old };
  apply(scale);
  const after = stack.getBoundingClientRect();
  host.scrollLeft += after.left + content.x * scale - point.x;
  host.scrollTop += after.top + content.y * scale - point.y;
}
function setDocumentZoom(value, anchor) {
  const host = $("#previewBody"),
    stack = $("#previewPages");
  if (!stack) return;
  const newZoom = Math.max(0.25, Math.min(3, value));
  anchorDocumentScale(host, stack, newZoom, anchor, () => {
    previewZoom = String(newZoom);
    fitPreview();
  });
  safeStorageSet("forma.preview.zoom.v4", previewZoom);
  syncZoomControl();
}
function syncZoomControl() {
  const select = $("#previewZoom");
  select.value = previewZoom;
  if (!select.value) {
    let option = select.querySelector("[data-custom-zoom]");
    if (!option) {
      option = document.createElement("option");
      option.dataset.customZoom = "true";
      select.append(option);
    }
    option.value = previewZoom;
    option.textContent = Math.round(Number(previewZoom) * 100) + "%";
    select.value = previewZoom;
  }
}
function pdfPreviewOptions(data) {
  // Standard PDF fonts use the browser's text renderer, not unavailable glyph paths.
  return { data, isEvalSupported: false, useSystemFonts: true, disableFontFace: false };
}
function attachPinchZoom(host, getScale, setScale) {
  let touchGesture = null,
    webkitGesture = null,
    lastPoint = null;
  const pointers = new Map();
  const root = host.ownerDocument || host;
  const scope = host.closest?.(".right-pane,.pdf-proof") || host;
  const subscriptions = [];
  let cursor = null;
  const listen = (target, name, callback, options) => {
    target.addEventListener(name, callback, options);
    subscriptions.push(() => target.removeEventListener?.(name, callback, options));
  };
  const eventPoint = (event) => {
    if (
      Number.isFinite(event.clientX) &&
      Number.isFinite(event.clientY) &&
      (event.clientX !== 0 || event.clientY !== 0)
    )
      return { x: event.clientX, y: event.clientY };
    return cursor;
  };
  const belongsToDocument = (event) => {
    if (host.isConnected === false || host.getClientRects?.().length === 0) return false;
    // A root-targeted WebKit gesture needs a hit test; ordinary events retain their target.
    const target = event.target;
    if (root === host) return true;
    if (
      target &&
      target !== root &&
      target !== root.body &&
      target !== root.documentElement &&
      target !== root.defaultView
    )
      return scope.contains(target);
    const point = eventPoint(event);
    return point
      ? scope.contains(root.elementFromPoint(point.x, point.y))
      : scope.contains(root.activeElement);
  };
  for (const name of ["pointermove", "pointerdown", "mousemove"])
    listen(
      root,
      name,
      (event) => {
        if (event.pointerType === "touch") return;
        if (Number.isFinite(event.clientX) && Number.isFinite(event.clientY))
          cursor = { x: event.clientX, y: event.clientY };
      },
      { capture: true, passive: true },
    );
  let pointerGesture = null;
  const clamp = (value) => Math.max(0.25, Math.min(3, value));
  const options = { passive: false, capture: true };
  const consume = (event) => {
    if (event.cancelable !== false) event.preventDefault();
  };
  const point = (touches) => ({
    x: (touches[0].clientX + touches[1].clientX) / 2,
    y: (touches[0].clientY + touches[1].clientY) / 2,
  });
  const distance = (touches) =>
    Math.hypot(touches[1].clientX - touches[0].clientX, touches[1].clientY - touches[0].clientY);
  const center = (event) => {
    const position = eventPoint(event);
    if (position) return position;
    if (lastPoint) return lastPoint;
    const bounds = host.getBoundingClientRect();
    return { x: bounds.left + bounds.width / 2, y: bounds.top + bounds.height / 2 };
  };
  listen(
    host,
    "pointerdown",
    (event) => {
      if (event.pointerType !== "touch") return;
      pointers.set(event.pointerId, event);
      if (pointers.size !== 2 || touchGesture || webkitGesture) return;
      const touches = [...pointers.values()];
      pointerGesture = { distance: distance(touches), scale: getScale() };
      consume(event);
    },
    options,
  );
  listen(
    host,
    "pointermove",
    (event) => {
      if (!pointers.has(event.pointerId)) return;
      pointers.set(event.pointerId, event);
      if (!pointerGesture || pointers.size !== 2 || touchGesture || webkitGesture) return;
      consume(event);
      const touches = [...pointers.values()];
      lastPoint = point(touches);
      setScale(
        clamp((pointerGesture.scale * distance(touches)) / Math.max(1, pointerGesture.distance)),
        lastPoint,
      );
    },
    options,
  );
  for (const name of ["pointerup", "pointercancel", "lostpointercapture"])
    listen(
      host,
      name,
      (event) => {
        pointers.delete(event.pointerId);
        pointerGesture = null;
      },
      options,
    );
  listen(
    host,
    "touchstart",
    (event) => {
      if (event.touches.length !== 2) return;
      consume(event);
      pointerGesture = null;
      lastPoint = point(event.touches);
      touchGesture = { distance: distance(event.touches), scale: getScale() };
    },
    options,
  );
  listen(
    host,
    "touchmove",
    (event) => {
      if (!touchGesture || event.touches.length !== 2) return;
      consume(event);
      lastPoint = point(event.touches);
      if (!webkitGesture)
        setScale(
          clamp(
            (touchGesture.scale * distance(event.touches)) / Math.max(1, touchGesture.distance),
          ),
          lastPoint,
        );
    },
    options,
  );
  for (const name of ["touchend", "touchcancel"])
    listen(
      host,
      name,
      () => {
        touchGesture = null;
        lastPoint = null;
        if (name === "touchcancel") webkitGesture = null;
      },
      options,
    );
  // Safari exposes trackpad pinches as GestureEvents instead of ctrl-wheel.
  listen(
    root,
    "gesturestart",
    (event) => {
      if (!belongsToDocument(event)) return;
      consume(event);
      webkitGesture = { scale: getScale(), initial: event.scale || 1 };
    },
    options,
  );
  listen(
    root,
    "gesturechange",
    (event) => {
      if (!webkitGesture) return;
      consume(event);
      setScale(
        clamp((webkitGesture.scale * (event.scale || 1)) / webkitGesture.initial),
        center(event),
      );
    },
    options,
  );
  listen(
    root,
    "gestureend",
    (event) => {
      if (!webkitGesture) return;
      consume(event);
      webkitGesture = null;
      touchGesture = null;
    },
    options,
  );
  listen(
    root,
    "wheel",
    (event) => {
      if (!event.ctrlKey || !belongsToDocument(event)) return;
      consume(event);
      if (webkitGesture) return;
      const unit =
        event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? host.clientHeight || 600 : 1;
      setScale(clamp(getScale() * Math.exp(-event.deltaY * unit * 0.008)), eventPoint(event));
    },
    options,
  );
  return () => {
    subscriptions.forEach((remove) => remove());
    pointers.clear();
    touchGesture = webkitGesture = pointerGesture = null;
  };
}
function revealMobileEditingCaret() {
  if (!isCompactLayout() || !mobileKeyboardOpen) return;
  const focused = document.activeElement;
  if (focused?.matches("textarea") && Number.isFinite(focused.selectionEnd)) {
    const style = getComputedStyle(focused);
    const mirror = document.createElement("div"),
      marker = document.createElement("span");
    mirror.style.cssText =
      "position:fixed;left:-10000px;top:0;visibility:hidden;box-sizing:border-box;border:0;margin:0;height:auto";
    for (const property of [
      "font-family",
      "font-size",
      "font-weight",
      "font-style",
      "font-variant",
      "line-height",
      "letter-spacing",
      "tab-size",
      "padding-top",
      "padding-right",
      "padding-bottom",
      "padding-left",
      "direction",
      "text-align",
      "word-break",
      "overflow-wrap",
    ])
      mirror.style.setProperty(property, style.getPropertyValue(property));
    mirror.style.width = focused.clientWidth + "px";
    mirror.style.whiteSpace = focused.wrap === "off" ? "pre" : "pre-wrap";
    mirror.textContent = focused.value.slice(0, focused.selectionEnd);
    marker.textContent = focused.value[focused.selectionEnd] || "\u200b";
    mirror.append(marker);
    document.body.append(mirror);
    const lineHeight = parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.8;
    const paddingTop = parseFloat(style.paddingTop) || 0;
    const paddingBottom = parseFloat(style.paddingBottom) || 0;
    const top = marker.offsetTop,
      bottom = top + lineHeight;
    if (bottom + paddingBottom > focused.scrollTop + focused.clientHeight)
      focused.scrollTop = Math.max(0, bottom + paddingBottom - focused.clientHeight);
    else if (top - paddingTop < focused.scrollTop)
      focused.scrollTop = Math.max(0, top - paddingTop);
    if (focused.wrap === "off") {
      const left = marker.offsetLeft,
        right = left + marker.offsetWidth;
      if (right > focused.scrollLeft + focused.clientWidth)
        focused.scrollLeft = Math.max(0, right + 16 - focused.clientWidth);
      else if (left < focused.scrollLeft) focused.scrollLeft = Math.max(0, left - 16);
    }
    mirror.remove();
  } else if (focused?.isContentEditable) {
    const host = document.querySelector("#previewBody"),
      selection = document.getSelection();
    if (!host?.contains(focused) || !selection?.rangeCount) return;
    const range = selection.getRangeAt(0).cloneRange();
    range.collapse(false);
    const caret = range.getBoundingClientRect(),
      bounds = host.getBoundingClientRect();
    if (caret.bottom > bounds.bottom - 24) host.scrollTop += caret.bottom - bounds.bottom + 24;
    else if (caret.top < bounds.top + 16) host.scrollTop += caret.top - bounds.top - 16;
  }
}
function configureVirtualKeyboard() {
  const keyboard = window.navigator?.virtualKeyboard;
  if (!keyboard) return;
  if (virtualKeyboardInitialOverlay === null)
    virtualKeyboardInitialOverlay = keyboard.overlaysContent;
  try {
    keyboard.overlaysContent =
      isCompactLayout() && !document.querySelector(".app")?.classList.contains("hidden")
        ? true
        : virtualKeyboardInitialOverlay;
  } catch {
    // Viewport resize events continue to provide the available editor height.
  }
}
function syncViewportHeight() {
  const viewport = window.visualViewport;
  const focused = document.activeElement;
  const editing = Boolean(
    focused?.isContentEditable ||
      focused?.matches("textarea,input:not([type=button]):not([type=file])"),
  );
  const viewportHeight = Math.round(
    viewport ? viewport.height * viewport.scale : window.innerHeight,
  );
  const keyboard = window.navigator?.virtualKeyboard;
  const bounds = keyboard?.overlaysContent ? keyboard.boundingRect : null;
  const occluded = bounds && bounds.height > 0 && bounds.width > 0 && Number.isFinite(bounds.y);
  const visibleHeight = occluded ? Math.min(viewportHeight, bounds.y) : viewportHeight;
  mobileViewportBaseline = Math.max(mobileViewportBaseline, viewportHeight, window.innerHeight);
  mobileKeyboardOpen =
    isCompactLayout() &&
    Boolean(
      occluded || (mobileViewportBaseline - visibleHeight > 100 && (editing || mobileKeyboardOpen)),
    );
  document.querySelector(".app")?.classList.toggle("keyboard-open", mobileKeyboardOpen);
  if (viewport && viewport.scale !== 1) {
    if (focused?.isContentEditable || focused?.matches("textarea,input")) {
      // Keep browser zoom intact while allowing the keyboard to reduce layout height.
      document.documentElement.style.setProperty(
        "--app-height",
        Math.round(Math.min(window.innerHeight, visibleHeight)) + "px",
      );
    }
    return;
  }
  document.documentElement.style.setProperty(
    "--app-height",
    Math.round(
      occluded
        ? Math.min(viewport?.height || window.innerHeight, bounds.y)
        : viewport?.height || window.innerHeight,
    ) + "px",
  );
  if (Number.isFinite(viewport?.offsetTop)) {
    document.documentElement.style.setProperty(
      "--app-top",
      Math.max(0, Math.round(viewport.offsetTop)) + "px",
    );
  }
}
function createAnonymizedResume() {
  saveWordDocument();
  if (sourceDraftError()) {
    toast("Correct the source draft before creating an anonymized copy.");
    return;
  }
  persistResume();
  const original = workspace.resumes.find((item) => item.id === activeResumeId);
  const sourceTemplate = customTemplates.find((item) => item.id === resume.template);
  let data, copiedTemplate;
  try {
    const copy = ResumePrivacy.createCopy(resume, sourceTemplate || null);
    data = ResumeFormats.assertModel(copy.data);
    if (sourceTemplate) {
      const templateId = makeWorkspaceId("custom");
      const base =
        BUILTIN_TEMPLATES.find((item) => item.id === sourceTemplate.base) || BUILTIN_TEMPLATES[0];
      data.template = templateId;
      copiedTemplate = {
        id: templateId,
        name: "Anonymized template",
        base: base.id,
        variant: BUILTIN_TEMPLATES.some((item) => item.id === sourceTemplate.variant)
          ? sourceTemplate.variant
          : base.id,
        format: deepClone(data.format || {}),
        layout: deepClone(data.layout || {}),
        css: sanitizeTemplateCss(copy.template.css || ""),
        seed: deepClone(data),
      };
    }
  } catch (error) {
    toast("Could not create an anonymized copy: " + error.message);
    return;
  }
  const id = makeWorkspaceId("resume");
  let name = "Anonymized résumé",
    suffix = 2;
  while (workspace.resumes.some((item) => item.name === name))
    name = "Anonymized résumé " + suffix++;
  if (copiedTemplate) {
    customTemplates.push(copiedTemplate);
    persistTemplates();
  }
  workspace.resumes.push({
    id,
    name,
    nameAuto: false,
    folderId: original?.folderId || workspace.folders[0]?.id,
    data,
  });
  workspace.openIds.push(id);
  switchResume(id);
  toast("Anonymized copy created · review free text before sharing.");
}
function positionWorkspacePopover(popover, anchor) {
  const viewport = window.visualViewport;
  const left = viewport?.offsetLeft || 0;
  const top = viewport?.offsetTop || 0;
  const width = viewport?.width || window.innerWidth;
  const height = viewport?.height || window.innerHeight;
  const bounds = anchor.getBoundingClientRect();
  popover.style.left =
    Math.max(left + 8, Math.min(bounds.left, left + width - popover.offsetWidth - 8)) + "px";
  popover.style.top =
    Math.max(top + 8, Math.min(bounds.bottom + 6, top + height - popover.offsetHeight - 8)) + "px";
}
function syncWordToolbar() {
  const mobile = isCompactLayout();
  const visible = activeMode === "word" && (!mobile || mobileWordFormattingOpen);
  $("#wordToolbar").classList.toggle("hidden", !visible);
  const toggle = $("#toggleWordToolbar");
  toggle.classList.toggle("hidden", !mobile || activeMode !== "word");
  toggle.setAttribute("aria-expanded", String(visible));
  toggle.setAttribute("aria-label", visible ? "Hide Word formatting" : "Show Word formatting");
  toggle.title = visible ? "Hide Word formatting" : "Show Word formatting";
}
function showMobilePane(pane) {
  mobilePane = pane;
  $("#mobileSourceButton").classList.toggle("active", pane === "source");
  $("#mobileDocumentButton").classList.toggle("active", pane === "document");
  $("#mobileSourceButton").setAttribute("aria-pressed", String(pane === "source"));
  $("#mobileDocumentButton").setAttribute("aria-pressed", String(pane === "document"));
  renderPanelOrder();
  if (pane === "document" && sourcePreviewPending) renderOutput();
}
function initializeWorkspaceV2() {
  window.addEventListener("pagehide", stopOriginalPreview);
  window.addEventListener("pageshow", (event) => {
    if (event.persisted && viewingOriginal()) renderOutput();
  });
  configureVirtualKeyboard();
  syncViewportHeight();
  let viewportFrame = 0;
  const queueViewportSync = () => {
    cancelAnimationFrame(viewportFrame);
    viewportFrame = requestAnimationFrame(() => {
      syncViewportHeight();
      requestAnimationFrame(revealMobileEditingCaret);
    });
  };
  window.addEventListener("resize", queueViewportSync);
  window.visualViewport?.addEventListener("resize", queueViewportSync);
  window.visualViewport?.addEventListener("scroll", queueViewportSync);
  window.navigator?.virtualKeyboard?.addEventListener("geometrychange", queueViewportSync);
  document.addEventListener("focusin", queueViewportSync);
  document.addEventListener("focusout", queueViewportSync);
  window.addEventListener("orientationchange", () => {
    mobileViewportBaseline = 0;
    mobileKeyboardOpen = false;
    queueViewportSync();
  });
  for (const editor of [
    $("#jsonEditor"),
    $("#xmlEditor"),
    $("#latexEditor"),
    $("#markdownInput"),
  ]) {
    editor.setAttribute("autocorrect", "off");
    editor.setAttribute("autocapitalize", "off");
    editor.setAttribute("autocomplete", "off");
    editor.spellcheck = false;
    editor.addEventListener("compositionend", () =>
      editor.dispatchEvent(new Event("input", { bubbles: true })),
    );
    editor.addEventListener("blur", () =>
      requestAnimationFrame(() => {
        updateJsonEditor();
        if (sourcePreviewPending) renderOutput();
      }),
    );
  }
  $("#documentView").onchange = (event) => {
    saveWordDocument();
    const record = workspace.resumes.find((item) => item.id === activeResumeId);
    if (record?.sourceDocument) {
      record.documentView = event.target.value;
      if (event.target.value === "original") {
        activeMode = record.sourceDocument.format === "docx" ? "word" : "pdf";
        workspace.outputMode = activeMode;
        $$(".mode-tab").forEach((tab) => {
          tab.classList.toggle("active", tab.dataset.mode === activeMode);
          tab.setAttribute("aria-selected", String(tab.dataset.mode === activeMode));
        });
      }
      saveWorkspace();
      renderOutput();
    }
  };
  syncZoomControl();
  // Word paragraphs can grow without replacing the page stack.
  $("#previewBody").addEventListener("input", () => requestAnimationFrame(fitPreview));
  $("#xmlEditor").addEventListener("input", (event) => {
    if (!event.isComposing) parseXmlLive();
  });
  $("#previewBody").addEventListener("beforeinput", (event) => {
    if (sourceDraftError()) {
      event.preventDefault();
      toast("Correct the source draft before editing the document.");
    }
  });
  $("#toggleWordToolbar").addEventListener("mousedown", (event) => event.preventDefault());
  $("#toggleWordToolbar").onclick = () => {
    mobileWordFormattingOpen = !mobileWordFormattingOpen;
    syncWordToolbar();
    requestAnimationFrame(fitPreview);
  };
  const compileGuide = $(".compile-guide");
  compileGuide.addEventListener("toggle", () => {
    if (compileGuide.open && isCompactLayout())
      positionWorkspacePopover($("#compileHint"), compileGuide.querySelector("summary"));
  });
  const insertPopover = $("#insertOptions");
  insertPopover.addEventListener("toggle", (event) => {
    if (event.newState === "open") positionWorkspacePopover(insertPopover, $("#insertButton"));
  });
  $("#outputControls").addEventListener(
    "scroll",
    () => {
      if (insertPopover.matches(":popover-open")) insertPopover.hidePopover();
    },
    { passive: true },
  );
  insertPopover.addEventListener("click", (event) => {
    if (event.target.closest("button")) insertPopover.hidePopover();
  });
  $("#headerImportButton").onclick = () => $("#importResumeButton").click();
  $("#anonymizeButton").onclick = createAnonymizedResume;
  $("#mobileFilesButton").onclick = () => togglePanel("files");
  $("#mobileSourceButton").onclick = () => showMobilePane("source");
  $("#mobileDocumentButton").onclick = () => showMobilePane("document");
  $("#mobileUndoButton").onclick = () => restoreHistory(-1);
  $("#mobileRedoButton").onclick = () => restoreHistory(1);
  for (const id of ["mobileUndoButton", "mobileRedoButton"])
    $("#" + id).onmousedown = (event) => event.preventDefault();
  const closeMoreActions = () => {
    $("#secondaryActions").classList.remove("is-open");
    $("#moreActionsButton").setAttribute("aria-expanded", "false");
  };
  $("#moreActionsButton").onclick = () => {
    const open = $("#secondaryActions").classList.toggle("is-open");
    $("#moreActionsButton").setAttribute("aria-expanded", String(open));
    if (open) {
      positionWorkspacePopover($("#secondaryActions"), $("#moreActionsButton"));
      $("#secondaryActions").querySelector("button,a").focus();
    }
  };
  $("#secondaryActions").addEventListener("click", (event) => {
    if (event.target.closest("button,a") && !event.target.closest("#appearanceCycle"))
      closeMoreActions();
  });
  document.addEventListener("click", (event) => {
    if (!event.target.closest("#secondaryActions,#moreActionsButton")) {
      closeMoreActions();
    }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      const wasOpen = $("#secondaryActions").classList.contains("is-open");
      closeMoreActions();
      if (wasOpen) $("#moreActionsButton").focus();
    }
  });
  const media = window.matchMedia("(max-width: 900px)");
  const reportButton = $("#reportBugButton");
  const reportHome = reportButton.parentElement;
  const projectLinks = $(".desktop-project-links");
  const projectHome = projectLinks.parentElement;
  const syncCompactHeader = () => {
    (media.matches ? $("#secondaryActions") : reportHome).appendChild(reportButton);
    if (media.matches) $(".top-actions").prepend(projectLinks);
    else projectHome.appendChild(projectLinks);
    closeMoreActions();
    compileGuide.open = false;
    $("#compileHint").style.removeProperty("left");
    $("#compileHint").style.removeProperty("top");
  };
  window.addEventListener("resize", closeMoreActions);
  syncCompactHeader();
  media.addEventListener("change", () => {
    configureVirtualKeyboard();
    syncCompactHeader();
    syncWordToolbar();
    renderPanelOrder();
    syncSourceWrap();
    syncFilesPanel();
  });
  attachPinchZoom($("#previewBody"), () => documentScale($("#previewPages")), setDocumentZoom);
  sourceState.pendingDrafts =
    workspace.resumes.find((item) => item.id === activeResumeId)?.sourceDrafts || null;
  syncV2Source();
  if (sourceErrorMode()) activateInput(sourceErrorMode(), false);
  updateHistoryControls();
  showMobilePane(mobilePane);
}

function collectViewSettings() {
  return {
    appearance: appearanceStage,
    mobilePane,
    zoom: previewZoom,
    sourceWrap,
    sidebarWidth: workspaceSidebarWidth,
  };
}
function restoreViewSettings(settings) {
  if (!settings || typeof settings !== "object") return;
  if (["source", "document"].includes(settings.mobilePane)) showMobilePane(settings.mobilePane);
  if (["light", "apple", "dark"].includes(settings.appearance)) {
    appearanceStage = settings.appearance;
    interfaceAppearance = appearanceStage === "light" ? "material" : "apple";
    darkMode = appearanceStage === "dark";
    safeStorageSet("forma.appearance.stage", appearanceStage);
    safeStorageSet("forma.interface.appearance", interfaceAppearance);
    safeStorageSet("forma.dark.mode", String(darkMode));
    syncControls();
  }
  if (
    settings.zoom === "fit" ||
    settings.zoom === "page" ||
    (Number(settings.zoom) >= 0.25 && Number(settings.zoom) <= 3)
  ) {
    previewZoom = String(settings.zoom);
    safeStorageSet("forma.preview.zoom.v4", previewZoom);
    syncZoomControl();
  }
  if (typeof settings.sourceWrap === "boolean") {
    sourceWrap = settings.sourceWrap;
    safeStorageSet("forma.source.wrap", String(sourceWrap));
    syncSourceWrap();
  }
  if (Number.isFinite(settings.sidebarWidth)) {
    workspaceSidebarWidth = Math.max(110, Math.min(240, settings.sidebarWidth));
    $(".main").style.setProperty("--workspace-sidebar-width", workspaceSidebarWidth + "px");
    safeStorageSet("forma.workspace.sidebar.width.v2", String(workspaceSidebarWidth));
  }
}
