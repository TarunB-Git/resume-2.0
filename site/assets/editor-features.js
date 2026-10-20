/* Editable Word document, in-page file actions and local compile checkpoints. */
let wordSelectionRange = null;
let wordDirty = false;
let wordOriginalPaths = new Set();
let fileMenuAnchor = null;

function jsonErrorSummary(message, source) {
  const position = /position\s+(\d+)/i.exec(message);
  const explicit = /line\s+(\d+)\s+column\s+(\d+)/i.exec(message);
  const offset = position
    ? Number(position[1])
    : /end of JSON/i.test(message)
      ? source.length
      : null;
  const before = offset == null ? "" : source.slice(0, offset);
  const line = explicit ? Number(explicit[1]) : offset == null ? null : before.split("\n").length;
  const column = explicit
    ? Number(explicit[2])
    : offset == null
      ? null
      : before.length - before.lastIndexOf("\n");
  const where = line ? `Line ${line}, column ${column}: ` : "";
  const explanation = /property name|double-quoted property/i.test(message)
    ? 'Use double quotes around the field name, for example "skills":. Remove any comma before a closing brace.'
    : /Expected ','|Expected.*after property value/i.test(message)
      ? "Add a comma between fields, or check the closing brace."
      : /end of JSON|Unterminated/i.test(message)
        ? "The JSON is unfinished. Close the quote, bracket or brace."
        : /Unexpected token/i.test(message)
          ? "Check the value here. Text needs double quotes; commas separate fields."
          : message.replace(/\s*· line.*$/i, "");
  return where + explanation;
}

function simpleNameDialog(title, label, value, action, accept) {
  const root = $("#modalRoot");
  root.innerHTML = `<div class="modal-backdrop" id="nameDialogBackdrop"><form class="modal name-dialog" role="dialog" aria-modal="true" aria-labelledby="nameDialogTitle"><h2 id="nameDialogTitle">${escapeHtml(title)}</h2><div class="form-field"><label for="nameDialogInput">${escapeHtml(label)}</label><input id="nameDialogInput" value="${escapeHtml(value)}" maxlength="100" required autocomplete="off"></div><div class="modal-actions"><button type="button" class="button quiet" id="cancelNameDialog">Cancel</button><button type="submit" class="button primary">${escapeHtml(action)}</button></div></form></div>`;
  $("#cancelNameDialog").onclick = () => root.replaceChildren();
  $(".name-dialog", root).onsubmit = (event) => {
    event.preventDefault();
    const name = $("#nameDialogInput").value.trim();
    if (!name) return;
    root.replaceChildren();
    accept(name);
  };
  $("#nameDialogBackdrop").onclick = (event) => {
    if (event.target.id === "nameDialogBackdrop") root.replaceChildren();
  };
  $("#nameDialogInput").focus();
  $("#nameDialogInput").select();
}
function showFolderDialog() {
  closeFileMenu();
  simpleNameDialog("Create folder", "Folder name", "New folder", "Create", (name) => {
    workspace.folders.push({ id: makeWorkspaceId("folder"), name, parentId: null });
    renderFolderTree();
    saveWorkspace();
    toast(`${name} created`);
  });
}
function showRenameDialog(item) {
  closeFileMenu();
  simpleNameDialog(
    "Rename resume",
    "Resume name",
    item.name || "Untitled resume",
    "Rename",
    (name) => {
      item.name = name;
      item.nameAuto = false;
      renderWorkspace();
    },
  );
}
function closeFileMenu() {
  $("#fileActionMenu")?.remove();
  fileMenuAnchor?.setAttribute("aria-expanded", "false");
  fileMenuAnchor = null;
}
function showFileMenu(id, anchor) {
  const alreadyOpen = fileMenuAnchor === anchor;
  closeFileMenu();
  if (alreadyOpen) return;
  const item = workspace.resumes.find((record) => record.id === id);
  if (!item) return;
  fileMenuAnchor = anchor;
  anchor.setAttribute("aria-expanded", "true");
  const menu = document.createElement("div");
  menu.id = "fileActionMenu";
  menu.className = "file-action-menu";
  menu.setAttribute("role", "menu");
  menu.innerHTML =
    '<button role="menuitem" data-file-action="rename">Rename</button><button role="menuitem" data-file-action="move">Move to folder…</button><button role="menuitem" data-file-action="delete" class="danger">Delete</button>';
  document.body.appendChild(menu);
  const bounds = anchor.getBoundingClientRect();
  menu.style.left = `${Math.max(8, Math.min(innerWidth - 168, bounds.right - 156))}px`;
  menu.style.top = `${Math.max(8, Math.min(innerHeight - menu.offsetHeight - 8, bounds.bottom + 5))}px`;
  menu.onclick = (event) => {
    const action = event.target.closest("[data-file-action]")?.dataset.fileAction;
    if (!action) return;
    const returnAnchor = fileMenuAnchor;
    closeFileMenu();
    returnAnchor?.focus();
    if (action === "rename") showRenameDialog(item);
    else if (action === "move") showMoveResumeDialog(item);
    else showDeleteResume(item);
  };
  menu.querySelector("button").focus();
}
function showMoveResumeDialog(item) {
  const label = (folder) => {
    const parts = [folder.name],
      seen = new Set([folder.id]);
    let parent = workspace.folders.find((value) => value.id === folder.parentId);
    while (parent && !seen.has(parent.id)) {
      seen.add(parent.id);
      parts.unshift(parent.name);
      parent = workspace.folders.find((value) => value.id === parent.parentId);
    }
    return parts.join(" / ");
  };
  const root = $("#modalRoot");
  root.innerHTML = `<div class="modal-backdrop"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="moveResumeTitle"><h2 id="moveResumeTitle">Move résumé</h2><p>${escapeHtml(item.name)}</p><div class="form-field"><label for="moveResumeFolder">Destination folder</label><select id="moveResumeFolder">${workspace.folders.map((folder) => `<option value="${escapeHtml(folder.id)}" ${folder.id === item.folderId ? "selected" : ""}>${escapeHtml(label(folder))}</option>`).join("")}</select></div><div class="modal-actions"><button class="button" id="cancelMoveResume">Cancel</button><button class="button primary" id="confirmMoveResume">Move</button></div></section></div>`;
  $("#cancelMoveResume").onclick = () => root.replaceChildren();
  $("#confirmMoveResume").onclick = () => {
    if (moveResumeToFolder(item.id, $("#moveResumeFolder").value)) {
      root.replaceChildren();
      toast("Résumé moved");
    }
  };
}
function showDeleteResume(item) {
  const root = $("#modalRoot");
  root.innerHTML = `<div class="modal-backdrop"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="deleteResumeTitle"><h2 id="deleteResumeTitle">Delete this resume?</h2><p>${escapeHtml(item.name)} will be removed from this device.</p><div class="modal-actions"><button class="button" id="cancelDeleteResume">Cancel</button><button class="button danger" id="confirmDeleteResume">Delete</button></div></section></div>`;
  $("#cancelDeleteResume").onclick = () => root.replaceChildren();
  $("#confirmDeleteResume").onclick = () => {
    root.replaceChildren();
    workspace.resumes = workspace.resumes.filter((record) => record.id !== item.id);
    workspace.openIds = workspace.openIds.filter((id) => id !== item.id);
    documentHistories.delete(item.id);
    if (!workspace.resumes.length) {
      const id = makeWorkspaceId("resume");
      workspace.resumes.push({
        id,
        name: "Tarun B",
        folderId: workspace.folders[0].id,
        nameAuto: false,
        data: {
          template: "modern",
          format: { font: "Arial", accent: "#496f91", bullet: "disc" },
          basics: { name: "Tarun B" },
          experience: [],
          education: [],
          skills: [],
        },
      });
      workspace.openIds = [id];
    }
    if (item.id === activeResumeId) switchResume(workspace.openIds[0] || workspace.resumes[0].id);
    else renderWorkspace();
    saveWorkspace();
  };
}

function sanitizeWordHtml(html) {
  const root = document.createElement("template");
  root.innerHTML = String(html || "");
  const allowed = new Set([
    "P",
    "DIV",
    "SPAN",
    "H1",
    "H2",
    "H3",
    "H4",
    "HEADER",
    "SECTION",
    "UL",
    "OL",
    "LI",
    "BR",
    "STRONG",
    "B",
    "EM",
    "I",
    "U",
    "S",
    "STRIKE",
    "A",
    "SUB",
    "SUP",
    "BLOCKQUOTE",
  ]);
  const properties = new Set([
    "font-family",
    "font-size",
    "font-weight",
    "font-style",
    "color",
    "background-color",
    "text-align",
    "text-decoration",
    "text-decoration-line",
    "text-transform",
    "text-indent",
    "line-height",
    "letter-spacing",
    "margin-top",
    "margin-bottom",
    "margin-left",
    "margin-right",
    "border-bottom",
    "border-bottom-style",
    "border-bottom-width",
    "border-bottom-color",
  ]);
  const walk = (parent) => {
    for (const node of [...parent.children]) {
      if (
        [
          "SCRIPT",
          "STYLE",
          "IFRAME",
          "OBJECT",
          "EMBED",
          "LINK",
          "META",
          "INPUT",
          "BUTTON",
          "SELECT",
          "TEXTAREA",
          "SVG",
        ].includes(node.tagName)
      ) {
        node.remove();
        continue;
      }
      if (node.tagName === "FONT") {
        const span = document.createElement("span");
        const sizes = {
          1: "8pt",
          2: "10pt",
          3: "12pt",
          4: "14pt",
          5: "18pt",
          6: "24pt",
          7: "36pt",
        };
        if (sizes[node.getAttribute("size")])
          span.style.fontSize = sizes[node.getAttribute("size")];
        if (node.getAttribute("face")) span.style.fontFamily = node.getAttribute("face");
        if (node.getAttribute("color")) span.style.color = node.getAttribute("color");
        span.append(...node.childNodes);
        node.replaceWith(span);
        walk(parent);
        continue;
      }
      walk(node);
      if (!allowed.has(node.tagName)) {
        node.replaceWith(...node.childNodes);
        continue;
      }
      const cleanStyle = [];
      for (const property of Array.from(node.style)) {
        const value = node.style.getPropertyValue(property);
        if (properties.has(property) && !/url\s*\(|expression|@import/i.test(value))
          cleanStyle.push(`${property}:${value}`);
      }
      for (const attribute of [...node.attributes]) {
        if (["class", "data-path", "data-section-key", "data-chunked"].includes(attribute.name))
          continue;
        if (
          attribute.name === "href" &&
          node.tagName === "A" &&
          /^(https?:|mailto:|tel:)/i.test(attribute.value)
        )
          continue;
        node.removeAttribute(attribute.name);
      }
      node.className = [...node.classList]
        .filter((name) =>
          /^(resume-|skill-chip$|bullet-|contact-item$|drop-zone$|rich-block$|inline-field$)/.test(
            name,
          ),
        )
        .join(" ");
      if (cleanStyle.length) node.setAttribute("style", cleanStyle.join(";"));
      else node.removeAttribute("style");
      if (node.tagName === "A") {
        node.setAttribute("rel", "noopener");
        node.setAttribute("target", "_blank");
      }
    }
  };
  walk(root.content);
  return root.innerHTML;
}
function richDocumentHtml() {
  const template = document.createElement("template");
  template.innerHTML = sanitizeWordHtml(resume.layout.richDocument);
  for (const node of template.content.querySelectorAll("[data-path]")) {
    const value = pathGet(resume, node.dataset.path);
    const copy = node.cloneNode(true);
    copy.querySelectorAll("br").forEach((br) => br.replaceWith("\n"));
    if (
      value != null &&
      typeof value !== "object" &&
      normalizeText(copy.textContent) !== String(value)
    )
      node.textContent = String(value);
    if (node.matches("a") && /\.(email|phone|tel|url|website|link)$/.test(node.dataset.path))
      node.setAttribute("href", safeLink(value, node.dataset.path.split(".").at(-1)));
  }
  return template.innerHTML;
}
function resumeHtml() {
  if (!resume.layout?.richDocument) return structuredResumeHtml();
  const content = document.createElement("div");
  content.innerHTML = richDocumentHtml();
  let number = 0;
  for (const node of [...content.childNodes]) {
    if (node.nodeType === Node.TEXT_NODE) {
      if (!node.textContent.trim()) {
        node.remove();
        continue;
      }
      const p = document.createElement("p");
      p.textContent = node.textContent;
      node.replaceWith(p);
    }
  }
  for (const node of [...content.children]) {
    if (node.matches(".resume-section[data-section-key]")) continue;
    const section = document.createElement("section");
    section.className = "resume-section rich-block";
    section.dataset.sectionKey = `word-block-${number++}`;
    node.replaceWith(section);
    section.appendChild(node);
  }
  content.querySelectorAll("li").forEach((node) => {
    if (node.querySelector(".bullet-marker")) return;
    const marker = document.createElement("span");
    marker.className = "bullet-marker";
    marker.textContent = node.parentElement.matches("ol")
      ? `${[...node.parentElement.children].indexOf(node) + 1}.`
      : "•";
    const text = document.createElement("span");
    text.className = "bullet-text";
    text.append(...node.childNodes);
    node.classList.add("rich-list-item");
    node.append(marker, text);
  });
  const font = escapeHtml(fontCss());
  const accent = /^#[0-9a-f]{6}$/i.test(resume.format?.accent || "")
    ? resume.format.accent
    : "#496f91";
  return `<article class="resume-paper rich-paper" data-template="word" style="--resume-accent:${accent};font-family:${font}"><div class="drop-zone" data-zone="main">${content.innerHTML}</div></article>`;
}
function renderWordOutput() {
  syncPaperSize();
  wordSelectionRange = null;
  wordDirty = false;
  let html;
  if (resume.layout?.richDocument) html = richDocumentHtml();
  else {
    const holder = document.createElement("div");
    holder.innerHTML = structuredResumeHtml();
    html = [...holder.querySelectorAll(".drop-zone")].map((zone) => zone.innerHTML).join("");
  }
  const host = $("#previewBody");
  host.setAttribute("aria-label", "Editable Word document");
  host.innerHTML = `<div class="preview-pages word-pages" id="previewPages"><article id="wordEditor" class="resume-paper word-sheet rich-paper" data-template="word" contenteditable="true" spellcheck="true" role="textbox" aria-multiline="true" aria-label="Word document" style="font-family:${escapeHtml(fontCss())};--resume-accent:${/^#[0-9a-f]{6}$/i.test(resume.format?.accent || "") ? resume.format.accent : "#496f91"}">${sanitizeWordHtml(html) || "<p><br></p>"}</article></div>`;
  applyFieldFormatting(host);
  wordOriginalPaths = new Set($$("[data-path]", $("#wordEditor")).map((node) => node.dataset.path));
  previewPageCount = 1;
  previewPage = 1;
  $("#pageNavigator").classList.add("hidden");
  $("#outputSubtitle").textContent = "Word document · type freely, add lines and format selections";
  fitPreview();
  renderSectionOutline();
  persistResume();
  updateHistoryControls();
}
function saveWordDocument() {
  const editor = $("#wordEditor");
  if (!editor || sourceDraftError() || !wordDirty) return;
  wordDirty = false;
  const found = new Set();
  const content = { ...(resume.layout?.wordContent || {}) };
  let nextContent = Math.max(
    0,
    ...Object.keys(content)
      .map((key) => Number(key) + 1)
      .filter(Number.isFinite),
  );
  for (const node of $$("p,h1,h2,h3,h4,li,div", editor)) {
    if (node.dataset.path || node.querySelector("[data-path],p,h1,h2,h3,h4,ul,ol,li,div")) continue;
    const key = String(nextContent++);
    node.dataset.path = `layout.wordContent.${key}`;
    content[key] = normalizeText(node.innerText);
  }
  resume.layout = { ...(resume.layout || {}), wordContent: content };
  for (const node of $$("[data-path]", editor)) {
    const path = node.dataset.path;
    if (found.has(path)) {
      node.removeAttribute("data-path");
      continue;
    }
    found.add(path);
    try {
      pathSet(resume, path, normalizeText(node.innerText));
    } catch {
      node.removeAttribute("data-path");
    }
  }
  for (const path of wordOriginalPaths)
    if (!found.has(path)) {
      try {
        pathSet(resume, path, "");
      } catch {}
    }
  wordOriginalPaths = found;
  resume.layout = {
    ...(resume.layout || {}),
    richDocument: sanitizeWordHtml(editor.innerHTML) || "<p><br></p>",
    // Field styles have been baked into the editor. Rich edits now own their formatting.
    fieldStyles: {},
  };
  updateJsonEditor();
  setJsonStatus("Word changes saved · JSON synced");
}
function appendRichSection(key) {
  const html = resume.layout.richDocument;
  resume.layout.richDocument =
    html +
    `<section class="resume-section" data-section-key="${key}"><h2 class="resume-section-title" data-path="layout.sectionTitles.${key}">${key}</h2><p data-path="${key}.0">New detail</p></section>`;
}
function wordCommand(command, value = null) {
  if (sourceDraftError()) return toast("Correct the source draft before formatting the document.");
  const editor = $("#wordEditor");
  if (!editor) return;
  editor.focus();
  const selection = getSelection();
  if (wordSelectionRange && editor.contains(wordSelectionRange.commonAncestorContainer)) {
    selection.removeAllRanges();
    selection.addRange(wordSelectionRange);
  }
  wordDirty = true;
  document.execCommand("styleWithCSS", false, true);
  document.execCommand(command, false, value);
  if (selection.rangeCount) wordSelectionRange = selection.getRangeAt(0).cloneRange();
  saveWordDocument();
}
function checkpointDiff(before, after) {
  const flatten = (value, path = "", result = {}) => {
    if (value && typeof value === "object" && Object.keys(value).length)
      for (const [key, child] of Object.entries(value))
        flatten(child, path ? `${path}.${key}` : key, result);
    else result[path] = JSON.stringify(value);
    return result;
  };
  const old = flatten(before || {}),
    next = flatten(after);
  return [...new Set([...Object.keys(old), ...Object.keys(next)])]
    .filter((path) => path && old[path] !== next[path])
    .map((path) => ({
      path,
      kind: !Object.hasOwn(old, path)
        ? "added"
        : !Object.hasOwn(next, path)
          ? "removed"
          : "changed",
    }));
}
function saveCheckpoint(build) {
  const item = workspace.resumes.find((record) => record.id === activeResumeId);
  if (!item) return;
  const versions = item.versions || [];
  const previous = versions.at(-1);
  build.changes = previous ? checkpointDiff(JSON.parse(previous.json), resume) : [];
  build.firstCheckpoint = !previous;
  if (!previous || previous.json !== build.json) {
    versions.push({
      id: makeWorkspaceId("version"),
      json: build.json,
      hash: build.hash,
      at: new Date().toISOString(),
    });
    item.versions = versions.slice(-12);
  }
  saveWorkspace();
}
function checkpointMarkup(build) {
  if (!build) return "";
  const versions = workspace.resumes.find((record) => record.id === activeResumeId)?.versions || [];
  const message = build.firstCheckpoint
    ? "First checkpoint saved."
    : build.changes.length
      ? `${build.changes.length} field${build.changes.length === 1 ? "" : "s"} changed since the previous checkpoint.`
      : "No changes since the previous checkpoint.";
  return `<div class="checkpoint-changes"><strong>${message}</strong>${
    build.changes.length
      ? `<ul>${build.changes
          .slice(0, 8)
          .map((change) => `<li><code>${escapeHtml(change.path)}</code> · ${change.kind}</li>`)
          .join("")}</ul>`
      : ""
  }</div><details class="checkpoint-history"><summary>Local version history · ${versions.length}</summary>${[
    ...versions,
  ]
    .reverse()
    .map(
      (version) =>
        `<div class="checkpoint-row"><span>${escapeHtml(new Date(version.at).toLocaleString())}</span><code>${version.hash}</code><button class="button quiet" data-restore-version="${version.id}">Restore</button></div>`,
    )
    .join("")}</details>`;
}
function registerEditorFeatures() {
  document.addEventListener("click", (event) => {
    if (!event.target.closest("#fileActionMenu,[data-file-menu]")) closeFileMenu();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeFileMenu();
  });
  document.addEventListener("selectionchange", () => {
    const editor = $("#wordEditor"),
      selection = getSelection();
    if (
      editor &&
      selection.rangeCount &&
      editor.contains(selection.anchorNode) &&
      editor.contains(selection.focusNode)
    )
      wordSelectionRange = selection.getRangeAt(0).cloneRange();
  });
  $("#wordToolbar").addEventListener("mousedown", (event) => {
    if (event.target.closest("button")) event.preventDefault();
  });
  $("#wordToolbar").addEventListener("click", (event) => {
    const button = event.target.closest("[data-word-command]");
    if (button) wordCommand(button.dataset.wordCommand);
  });
  for (const [id, command] of [
    ["wordFont", "fontName"],
    ["wordSize", "fontSize"],
    ["wordBlock", "formatBlock"],
    ["wordColor", "foreColor"],
  ])
    $("#" + id).onchange = (event) => {
      if (event.target.value) wordCommand(command, event.target.value);
    };
  $("#wordAlign").onchange = (event) => wordCommand(event.target.value);
  $("#previewBody").addEventListener("paste", (event) => {
    if (!event.target.closest("#wordEditor")) return;
    event.preventDefault();
    const html = event.clipboardData.getData("text/html");
    if (html) wordCommand("insertHTML", sanitizeWordHtml(html));
    else wordCommand("insertText", event.clipboardData.getData("text/plain"));
  });
  $("#previewBody").addEventListener("click", (event) => {
    if (event.target.closest("#wordEditor a") && !event.ctrlKey && !event.metaKey)
      event.preventDefault();
  });
}

function wordNumberingXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:abstractNum w:abstractNumId="0"><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="•"/><w:pPr><w:ind w:left="360" w:hanging="180"/></w:pPr></w:lvl></w:abstractNum><w:abstractNum w:abstractNumId="1"><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="decimal"/><w:lvlText w:val="%1."/><w:pPr><w:ind w:left="360" w:hanging="180"/></w:pPr></w:lvl></w:abstractNum><w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num><w:num w:numId="2"><w:abstractNumId w:val="1"/></w:num></w:numbering>`;
}
function sliceRichNode(node, start, end) {
  let position = 0;
  const copy = (source) => {
    if (source.nodeType === Node.TEXT_NODE) {
      const next = position + source.textContent.length;
      const text = source.textContent.slice(
        Math.max(0, start - position),
        Math.max(0, Math.min(source.textContent.length, end - position)),
      );
      position = next;
      return text ? document.createTextNode(text) : null;
    }
    if (source.nodeType !== Node.ELEMENT_NODE) return null;
    const clone = source.cloneNode(false);
    for (const child of source.childNodes) {
      const fragment = copy(child);
      if (fragment) clone.appendChild(fragment);
    }
    return clone.childNodes.length || (source.matches("br") && position >= start && position <= end)
      ? clone
      : null;
  };
  return copy(node) || node.cloneNode(false);
}
function plainDocumentText(data = resume) {
  const previous = resume;
  resume = data;
  try {
    const root = document.createElement("div");
    root.innerHTML = resumeHtml();
    root.querySelectorAll("br").forEach((node) => node.replaceWith("\n"));
    root.querySelectorAll(".bullet-marker").forEach((node) => node.append(" "));
    root
      .querySelectorAll("h1,h2,h3,h4,p,li,.resume-contact,.resume-entry-head,.resume-entry-sub")
      .forEach((node) => node.append("\n"));
    return root.textContent.replace(/\n\s*\n\s*\n/g, "\n\n").trim();
  } finally {
    resume = previous;
  }
}
function documentHtmlExport() {
  const font = escapeHtml(fontCss()),
    accent = /^#[0-9a-f]{6}$/i.test(resume.format?.accent || "") ? resume.format.accent : "#496f91";
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(resume.basics?.name || "Resume")}</title><style>body{margin:0;background:#eee;color:#26323c;font-family:${font};font-size:12px;line-height:1.5}.resume-paper{background:white;box-sizing:border-box;width:${PAGE.width}px;min-height:${PAGE.height}px;margin:24px auto;padding:55px 62px;overflow-wrap:anywhere;--resume-accent:${accent}}h1{font-size:32px;margin:0}.resume-section-title{font-size:11px;color:var(--resume-accent);border-bottom:1px solid #ddd;margin:24px 0 10px;text-transform:uppercase}.resume-contact{display:flex;gap:13px;flex-wrap:wrap;font-size:10px;margin:12px 0 24px}.resume-entry-head{display:flex;justify-content:space-between;gap:12px}.resume-entry-sub{font-size:11px}.resume-entry{margin-bottom:14px}.resume-bullets{padding-left:0;list-style:none}.resume-bullets li{display:flex;gap:7px}.resume-skills{display:flex;gap:8px;flex-wrap:wrap}a{color:inherit}.rich-list-item{display:flex;gap:7px;list-style:none}.resume-paper[data-template=executive]{display:grid;grid-template-columns:31% 1fr;padding:0}.resume-aside{background:${accent};color:white;padding:45px 22px}.resume-aside .resume-contact{display:block}.resume-aside .contact-item{display:block}.resume-main{padding:45px 32px}.sidebar-resizer{display:none}@media print{body{background:white}.resume-paper{margin:0}@page{size:${paperSize().width}mm ${paperSize().height}mm}}</style></head><body>${resumeHtml()}<script type="application/json" id="resume20-source">${JSON.stringify(resume).replace(/</g, "\\u003c")}</script></body></html>`;
}
function portableDocumentSnapshot() {
  const model = deepClone(resume);
  return {
    model,
    jsonResume: ResumeFormats.toJsonResume(model),
    documentHtml: documentHtmlExport(),
    filename: safeFilename(),
  };
}
function portableDocumentExport(pdfBytes, snapshot = portableDocumentSnapshot()) {
  return ResumePortable.build({ ...snapshot, pdfBytes });
}
function archiveSegment(value) {
  return (
    String(value || "untitled")
      .normalize("NFKD")
      .replace(/[^a-zA-Z0-9._ -]/g, "")
      .replace(/^\.+|\.+$/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .slice(0, 70) || "untitled"
  );
}
async function exportWorkspaceZip() {
  const original = resume;
  $(".app").inert = true;
  const snapshots = workspace.resumes.map((item) => ({ ...item, data: deepClone(item.data) }));
  const files = [],
    used = new Set();
  const button = $("#exportButton");
  button.disabled = true;
  button.setAttribute("aria-busy", "true");
  $("#modalRoot").innerHTML =
    '<div class="modal-backdrop"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="zipProgressTitle"><h2 id="zipProgressTitle">Exporting all resumes</h2><p id="zipProgressText" role="status">Preparing every format…</p></section></div>';
  try {
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    for (const item of snapshots) {
      resume = deepClone(item.data);
      const folderParts = [];
      let folder = workspace.folders.find((value) => value.id === item.folderId),
        seen = new Set();
      while (folder && !seen.has(folder.id)) {
        seen.add(folder.id);
        folderParts.unshift(archiveSegment(folder.name));
        folder = workspace.folders.find((value) => value.id === folder.parentId);
      }
      let stem = [...folderParts, archiveSegment(item.name)].join("/");
      if (used.has(stem.toLowerCase())) stem += `-${archiveSegment(item.id)}`;
      used.add(stem.toLowerCase());
      const status = $("#zipProgressText");
      if (status) status.textContent = `${item.name} · ${used.size} of ${snapshots.length}`;
      await new Promise((resolve) => requestAnimationFrame(resolve));
      const pdf = new Uint8Array(await makePdf().arrayBuffer()),
        docx = new Uint8Array(await makeDocx().arrayBuffer());
      files.push(
        [`${stem}.pdf`, pdf],
        [`${stem}.docx`, docx],
        [`${stem}.tex`, latexSource()],
        [`${stem}.md`, markdownSource()],
        [`${stem}.json`, JSON.stringify(resume, null, 2)],
        [`${stem}.xml`, ResumeFormats.toXml(resume)],
        [`${stem}.jsonresume.json`, JSON.stringify(ResumeFormats.toJsonResume(resume), null, 2)],
        [`${stem}.html`, portableDocumentExport(pdf)],
        [`${stem}.txt`, plainDocumentText()],
      );
      if (item.draftJson) files.push([`${stem}.draft.json`, item.draftJson]);
      if (item.sourceDrafts)
        files.push([`${stem}.source-drafts.json`, JSON.stringify(item.sourceDrafts)]);
      const template = customTemplates.find((value) => value.id === resume.template) || {
        ...templateById(resume.template),
        format: resume.format || {},
        layout: resume.layout || {},
      };
      files.push([`${stem}.template.json`, JSON.stringify(template, null, 2)]);
    }
    files.push(
      [
        "session.json",
        JSON.stringify(
          {
            format: "resume20.session",
            version: 1,
            workspace,
            templates: customTemplates,
            settings: collectViewSettings(),
          },
          null,
          2,
        ),
      ],
      ["workspace.json", JSON.stringify(workspace, null, 2)],
      ["templates.json", JSON.stringify(customTemplates, null, 2)],
      [
        "README.txt",
        "Résumé 2.0 workspace backup. Every resume includes PDF, Word, LaTeX, Markdown, JSON, XML, JSON Resume, HTML and plain text. JSON preserves structured data and rich Word edits. session.json preserves folders, templates, drafts, settings and local checkpoints. workspace.json and templates.json support older imports.",
      ],
    );
    download(makeZip(files), "resume-2.0-all-resumes.zip");
    toast(`${snapshots.length} resumes exported in every format`);
  } catch (error) {
    toast(`ZIP export failed: ${error.message}`);
  } finally {
    resume = original;
    $(".app").inert = false;
    syncPaperSize();
    button.disabled = false;
    button.removeAttribute("aria-busy");
    $("#modalRoot").replaceChildren();
    fitPreview();
  }
}
function richDocumentLines() {
  const root = document.createElement("div");
  root.innerHTML = richDocumentHtml();
  root.querySelectorAll("br").forEach((node) => node.replaceWith("\n"));
  const lines = [];
  const visit = (node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      if (node.textContent.trim())
        lines.push({ text: node.textContent.trim(), path: null, kind: "p" });
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE || node.matches(".bullet-marker,br")) return;
    if (node.dataset.path) {
      const kind = node.matches("h1,h2,h3,h4")
        ? node.tagName.toLowerCase()
        : node.closest("li")
          ? "li"
          : "p";
      lines.push({ text: node.textContent, path: node.dataset.path, kind });
      return;
    }
    if (node.matches("p,h1,h2,h3,h4,li") && !node.querySelector("[data-path]")) {
      lines.push({ text: node.textContent, path: null, kind: node.tagName.toLowerCase() });
      return;
    }
    node.childNodes.forEach(visit);
  };
  root.childNodes.forEach(visit);
  return lines;
}
function richMarkdownSource() {
  const metadata = {
    template: resume.template,
    format: { ...resume.format },
    layout: resume.layout,
    model: deepClone(resume),
  };
  delete metadata.format.latexTemplate;
  const prefixes = { h1: "# ", h2: "## ", h3: "### ", h4: "#### ", li: "- ", p: "" };
  return (
    `<!-- forma:metadata ${encodeURIComponent(JSON.stringify(metadata))} -->\n\n` +
    richDocumentLines()
      .map(
        (line) =>
          `${prefixes[line.kind] || ""}${line.text.replace(/\n/g, "<br>")}${line.path ? ` <!-- forma:field ${encodeURIComponent(line.path)} -->` : ""}`,
      )
      .join("\n\n") +
    "\n"
  );
}
function richLatexSource() {
  const snapshot = deepClone(resume);
  snapshot.format = { ...(snapshot.format || {}) };
  delete snapshot.format.latexTemplate;
  const lines = [
    `% Résumé 2.0 rich document · structured snapshot and editable CVField values.`,
    `% draft:resume ${encodeURIComponent(JSON.stringify(snapshot))}`,
    `\\documentclass[10pt,${paperSize().latex}]{article}`,
    "\\usepackage[margin=0.72in]{geometry}",
    "\\usepackage[T1]{fontenc}",
    "\\usepackage[utf8]{inputenc}",
    "\\usepackage{hyperref}",
    "\\newcommand{\\CVField}[2]{#2}",
    "\\begin{document}",
  ];
  for (const line of richDocumentLines()) {
    const value = line.path
      ? `\\CVField{${line.path}}{${latexEscape(line.text)}}`
      : latexEscape(line.text);
    lines.push(
      line.kind === "h1"
        ? `{\\LARGE\\textbf{${value}}}\\par`
        : line.kind === "h2"
          ? `\\section*{${value}}`
          : line.kind === "h3" || line.kind === "h4"
            ? `\\subsection*{${value}}`
            : line.kind === "li"
              ? `\\noindent\\textbullet\\ ${value}\\par`
              : `${value}\\par`,
    );
  }
  lines.push("\\end{document}");
  return lines.join("\n") + "\n";
}
function showWordLinkDialog() {
  simpleNameDialog("Insert link", "Web address", "https://", "Insert", (address) => {
    const href = safeLink(address);
    if (wordSelectionRange && !wordSelectionRange.collapsed) wordCommand("createLink", href);
    else wordCommand("insertHTML", `<a href="${escapeHtml(href)}">${escapeHtml(address)}</a>`);
  });
}

/* One chronological edit history per resume, shared by every editor mode. */
function captureEditingSelection() {
  const active = document.activeElement;
  if (active?.matches("#jsonEditor,#xmlEditor,#latexEditor,#markdownInput"))
    return {
      kind: "source",
      id: active.id,
      start: active.selectionStart,
      end: active.selectionEnd,
    };
  const editor = $("#wordEditor");
  const field = active?.closest("[data-path][contenteditable=true]");
  const root = editor && editor.contains(active) ? editor : field;
  if (!root) return null;
  const selection = getSelection();
  if (
    !selection.rangeCount ||
    !root.contains(selection.anchorNode) ||
    !root.contains(selection.focusNode)
  )
    return null;
  const range = selection.getRangeAt(0),
    before = range.cloneRange();
  before.selectNodeContents(root);
  before.setEnd(range.startContainer, range.startOffset);
  const start = before.toString().length;
  return {
    kind: editor === root ? "word" : "pdf",
    path: field?.dataset.path,
    start,
    end: start + range.toString().length,
  };
}
function restoreEditingSelection(bookmark) {
  if (!bookmark) return;
  if (bookmark.kind === "source") {
    const source = $("#" + bookmark.id);
    if (!source || source.closest(".hidden")) return;
    source.focus();
    source.setSelectionRange(bookmark.start, bookmark.end);
    return;
  }
  const root =
    bookmark.kind === "word"
      ? $("#wordEditor")
      : $(
          `[data-path="${CSS.escape(bookmark.path || "")}"][contenteditable=true]`,
          $("#previewBody"),
        );
  if (!root) return;
  root.focus();
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT),
    nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  const point = (offset) => {
    for (const node of nodes) {
      if (offset <= node.textContent.length) return [node, offset];
      offset -= node.textContent.length;
    }
    return nodes.length ? [nodes.at(-1), nodes.at(-1).textContent.length] : [root, 0];
  };
  const range = document.createRange();
  range.setStart(...point(bookmark.start));
  range.setEnd(...point(bookmark.end));
  const selection = getSelection();
  selection.removeAllRanges();
  selection.addRange(range);
  if (bookmark.kind === "word") wordSelectionRange = range.cloneRange();
}
function recordWorkspaceHistory() {
  if (restoringHistory) return;
  const value = JSON.stringify({
    data: resume,
    json: jsonEditor.value,
    latex: latexEditor.value,
    markdown: $("#markdownInput").value,
    xml: $("#xmlEditor").value,
    sourceDrafts: collectSourceDrafts(),
  });
  const entry = { value, selection: captureEditingSelection() };
  let history = documentHistories.get(activeResumeId);
  if (!history) {
    history = { items: [entry], index: 0 };
    documentHistories.set(activeResumeId, history);
  } else if (history.items[history.index].value !== value) {
    history.items = history.items.slice(0, history.index + 1);
    history.items.push(entry);
    if (history.items.length > 100) history.items.shift();
    history.index = history.items.length - 1;
  }
  updateHistoryControls();
}
function restoreWorkspaceHistory(direction) {
  clearTimeout(markdownTimer);
  saveWordDocument();
  recordWorkspaceHistory();
  const history = documentHistories.get(activeResumeId);
  if (!history) return;
  const index = history.index + direction;
  if (index < 0 || index >= history.items.length) return;
  const currentSelection = captureEditingSelection();
  history.index = index;
  const entry = history.items[index],
    snapshot = JSON.parse(entry.value);
  restoringHistory = true;
  try {
    closeFormatPane();
    resume = snapshot.data;
    resetV2SourceState(snapshot.sourceDrafts);
    jsonEditor.value = snapshot.json;
    latestJsonError = null;
    try {
      const data = ResumeFormats.assertModel(JSON.parse(snapshot.json));
      if (!data || typeof data !== "object" || Array.isArray(data))
        throw new Error("Root value must be an object");
    } catch (error) {
      latestJsonError = error;
    }
    updateJsonEditor();
    syncControls();
    renderOutput();
    refreshMarkdownInput();
    jsonEditor.value = snapshot.json;
    latexEditor.value = snapshot.latex;
    latexSourceBeforeEdit = snapshot.latex;
    $("#markdownInput").value = snapshot.markdown;
    sourceState.markdownCommitted = snapshot.markdown;
    $("#xmlEditor").value = snapshot.xml || ResumeFormats.toXml(resume);
    sourceState.xmlCommitted = $("#xmlEditor").value;
    restoreV2Drafts(snapshot.sourceDrafts);
    highlightJson();
    highlightLatex();
    updateJsonStats();
    setJsonStatus(
      latestJsonError
        ? latestJsonError.message
        : `${direction < 0 ? "Undo" : "Redo"} · all editors synced`,
      Boolean(latestJsonError),
    );
    persistResume();
    const bookmark =
      currentSelection && entry.selection?.kind === currentSelection.kind
        ? entry.selection
        : currentSelection;
    restoreEditingSelection(bookmark);
  } finally {
    restoringHistory = false;
    updateHistoryControls();
  }
}

/* Files can be dropped on a whole folder branch or imported from the desktop. */
let droppedFileQueue = [];
let droppedFileBusy = false;
function folderForDrop(target) {
  const branch = target.closest(".folder-branch");
  return branch?.querySelector(":scope > .folder-row") || null;
}
function moveResumeToFolder(resumeId, folderId) {
  const record = workspace.resumes.find((item) => item.id === resumeId);
  if (!record || !workspace.folders.some((folder) => folder.id === folderId)) return false;
  record.folderId = folderId;
  workspace.collapsedFolders = workspace.collapsedFolders.filter((id) => id !== folderId);
  renderFolderTree();
  saveWorkspace();
  return true;
}
function clearFileDropTargets() {
  $$(".file-drop-target").forEach((node) => node.classList.remove("file-drop-target"));
}
async function importNextDroppedFile() {
  if (droppedFileBusy || !droppedFileQueue.length || $("#modalRoot").children.length) return;
  droppedFileBusy = true;
  const next = droppedFileQueue.shift();
  pendingImportOptions = { folderId: next.folderId };
  try {
    await importResumeFile(next.file);
  } finally {
    droppedFileBusy = false;
    if (!$("#importReviewJson")) {
      pendingImportOptions = null;
      if (droppedFileQueue.length) requestAnimationFrame(importNextDroppedFile);
    }
  }
}
function queueDroppedFiles(files, folderId) {
  for (const file of files) droppedFileQueue.push({ file, folderId });
  importNextDroppedFile();
}
function registerFileDragAndDrop() {
  const tree = $("#folderTree"),
    main = $(".main");
  tree.addEventListener("dragstart", (event) => {
    const file = event.target.closest("[data-resume-file]");
    if (!file) return;
    closeFileMenu();
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("application/x-forma-resume", file.dataset.resumeFile);
    event.dataTransfer.setData("text/plain", file.dataset.resumeFile);
  });
  main.addEventListener(
    "dragover",
    (event) => {
      const types = Array.from(event.dataTransfer?.types || []);
      const external = types.includes("Files"),
        internal = types.includes("application/x-forma-resume");
      const folder = folderForDrop(event.target);
      if (!external && !internal) return;
      event.preventDefault();
      if (external) event.stopPropagation();
      event.dataTransfer.dropEffect = external ? "copy" : folder ? "move" : "none";
      clearFileDropTargets();
      if (internal && !folder) return;
      (folder?.closest(".folder-branch") || $("#fileSidebar")).classList.add("file-drop-target");
    },
    true,
  );
  main.addEventListener("dragleave", (event) => {
    const zone = event.target.closest(".file-drop-target");
    if (zone && !zone.contains(event.relatedTarget)) zone.classList.remove("file-drop-target");
  });
  main.addEventListener(
    "drop",
    (event) => {
      const files = Array.from(event.dataTransfer?.files || []);
      const folder = folderForDrop(event.target);
      const resumeId = event.dataTransfer?.getData("application/x-forma-resume");
      clearFileDropTargets();
      if (files.length) {
        event.preventDefault();
        event.stopPropagation();
        const folderId =
          folder?.dataset.folderId ||
          workspace.resumes.find((item) => item.id === activeResumeId)?.folderId ||
          workspace.folders[0].id;
        queueDroppedFiles(files, folderId);
      } else if (resumeId) {
        event.preventDefault();
        event.stopPropagation();
        if (folder && moveResumeToFolder(resumeId, folder.dataset.folderId)) toast("Resume moved");
      }
    },
    true,
  );
  document.addEventListener("dragend", clearFileDropTargets);
  new MutationObserver(() => {
    if (!$("#modalRoot").children.length) importNextDroppedFile();
  }).observe($("#modalRoot"), { childList: true });
  // Prevent an accidental desktop drop outside the workspace from navigating away.
  window.addEventListener("dragover", (event) => {
    if (Array.from(event.dataTransfer?.types || []).includes("Files")) event.preventDefault();
  });
  window.addEventListener("drop", (event) => {
    if (event.dataTransfer?.files?.length) {
      event.preventDefault();
      clearFileDropTargets();
    }
  });
}

function reorderRichSection(key, targetKey, after = false) {
  if (!resume.layout?.richDocument) return false;
  const holder = document.createElement("div");
  holder.innerHTML = resumeHtml();
  const zone = holder.querySelector(".drop-zone"),
    blocks = [...zone.children];
  const block = blocks.find((node) => node.dataset.sectionKey === key);
  const target = blocks.find((node) => node.dataset.sectionKey === targetKey);
  if (!block || block === target) return false;
  if (target) target[after ? "after" : "before"](block);
  else zone.appendChild(block);
  // Generated PDF markers are restored to native lists for Word editing.
  zone.querySelectorAll("li.rich-list-item").forEach((node) => {
    node.querySelector(":scope > .bullet-marker")?.remove();
    const text = node.querySelector(":scope > .bullet-text");
    if (text) text.replaceWith(...text.childNodes);
    node.classList.remove("rich-list-item");
  });
  resume.layout.richDocument = sanitizeWordHtml(zone.innerHTML);
  return true;
}
