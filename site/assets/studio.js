// Physical paper geometry shared by preview, pagination and exports.
const PAPER_SIZES = Object.freeze({
  a4: { label: "A4", width: 210, height: 297, latex: "a4paper" },
  letter: { label: "Letter", width: 215.9, height: 279.4, latex: "letterpaper" },
  legal: { label: "Legal", width: 215.9, height: 355.6, latex: "legalpaper" },
  a5: { label: "A5", width: 148, height: 210, latex: "a5paper" },
});
function paperSize(data = resume) {
  const key = data.layout?.paperSize;
  return Object.hasOwn(PAPER_SIZES, key) ? PAPER_SIZES[key] : PAPER_SIZES.a4;
}
const PAGE = Object.freeze({
  get width() {
    return (paperSize().width * 96) / 25.4;
  },
  get height() {
    return (paperSize().height * 96) / 25.4;
  },
  get pdfWidth() {
    return (paperSize().width * 72) / 25.4;
  },
  get pdfHeight() {
    return (paperSize().height * 72) / 25.4;
  },
  get twipWidth() {
    return Math.round((paperSize().width * 1440) / 25.4);
  },
  get twipHeight() {
    return Math.round((paperSize().height * 1440) / 25.4);
  },
});
function syncPaperSize() {
  const root = document.documentElement;
  root.style.setProperty("--resume-page-width", `${PAGE.width}px`);
  root.style.setProperty("--resume-page-height", `${PAGE.height}px`);
  $("#paperSize").value = Object.hasOwn(PAPER_SIZES, resume.layout?.paperSize)
    ? resume.layout.paperSize
    : "a4";
  let printStyle = $("#paperPrintStyle");
  if (!printStyle) {
    printStyle = document.createElement("style");
    printStyle.id = "paperPrintStyle";
    document.head.appendChild(printStyle);
  }
  printStyle.textContent = `@media print { @page { size: ${paperSize().width}mm ${paperSize().height}mm; } }`;
}
("use strict");
const initialData = {
  template: "modern",
  format: {
    font: "Arial",
    accent: "#1a73e8",
    bullet: "disc",
  },
  basics: {
    name: "Tarun B",
    label: "Résumé maker",
    email: "1234@example.com",
    phone: "",
    location: "",
    url: "https://example.com",
  },
  summary: "Résumé maker. This is generic example content to replace with your own details.",
  experience: [
    {
      company: "Resume Studios",
      role: "Résumé maker",
      dates: "2024 — Present",
      highlights: [
        "Create clear, editable résumés.",
        "Keep content separate from document styling.",
      ],
    },
  ],
  education: [],
  skills: ["HTML", "CSS", "JavaScript"],
  projects: [
    {
      name: "Résumé editor",
      description: "A sample project for editing and exporting résumé content.",
      url: "https://example.com",
    },
  ],
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const deepClone = (value) => JSON.parse(JSON.stringify(value));
const RESUME_STORAGE_KEY = "forma.resume.studio.v2";
const WORKSPACE_STORAGE_KEY = "forma.workspace.v1";
const TEMPLATE_STORAGE_KEY = "forma.custom.templates.v1";
function safeStorageGet(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function safeStorageSet(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}
const BUILTIN_TEMPLATES = [
  { id: "modern", name: "Modern" },
  { id: "classic", name: "Classic" },
  { id: "compact", name: "Compact · ATS" },
  { id: "executive", name: "Executive" },
  { id: "swiss", name: "Swiss" },
  { id: "minimal", name: "Minimal" },
  { id: "academic", name: "Academic" },
  { id: "creative", name: "Creative" },
  {
    id: "harvard",
    name: "Harvard inspired",
    base: "classic",
    format: { font: "Times New Roman", accent: "#26323c", bullet: "disc" },
    layout: { sectionSpacing: 20, borderStyle: "solid", borderWidth: 1 },
  },
  {
    id: "jake",
    name: "Jake inspired",
    base: "classic",
    format: { font: "Times New Roman", accent: "#26323c", bullet: "disc" },
    layout: { sectionSpacing: 16, borderStyle: "solid", borderWidth: 1 },
  },
  {
    id: "awesome",
    name: "Awesome CV inspired",
    base: "modern",
    format: { font: "Arial", accent: "#c24f4f", bullet: "disc" },
    layout: { sectionSpacing: 22, borderStyle: "solid", borderWidth: 1 },
  },
  {
    id: "altacv",
    name: "AltaCV inspired",
    base: "executive",
    format: { font: "Arial", accent: "#70587e", bullet: "disc" },
    layout: {
      sectionSpacing: 22,
      sidebarWidth: 34,
      sidebarSections: ["skills", "languages", "certifications"],
      borderStyle: "solid",
      borderWidth: 1,
    },
  },
];
function readStoredResume() {
  try {
    const stored = localStorage.getItem(RESUME_STORAGE_KEY);
    const parsed = stored && JSON.parse(stored);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed
      : deepClone(initialData);
  } catch {
    return deepClone(initialData);
  }
}
function readCustomTemplates() {
  try {
    const saved = JSON.parse(localStorage.getItem(TEMPLATE_STORAGE_KEY) || "[]");
    return Array.isArray(saved)
      ? saved
          .filter((item) => item && item.id && item.name)
          .map((item) => ({
            ...item,
            base: BUILTIN_TEMPLATES.some((template) => template.id === item.base)
              ? item.base
              : "modern",
          }))
      : [];
  } catch {
    return [];
  }
}
let resume = readStoredResume();
function makeWorkspaceId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}
function readWorkspace() {
  try {
    const saved = JSON.parse(safeStorageGet(WORKSPACE_STORAGE_KEY) || "null");
    if (!saved || !Array.isArray(saved.resumes) || !Array.isArray(saved.folders)) return null;
    saved.resumes = saved.resumes.filter(
      (item) => item && item.id && item.data && typeof item.data === "object",
    );
    saved.folders = saved.folders.filter((item) => item && item.id && item.name);
    if (!saved.resumes.length) return null;
    if (!saved.folders.length)
      saved.folders.push({ id: "folder-main", name: "My resumes", parentId: null });
    for (const item of saved.resumes)
      if (!saved.folders.some((folder) => folder.id === item.folderId))
        item.folderId = saved.folders[0].id;
    saved.openIds = Array.isArray(saved.openIds)
      ? saved.openIds.filter((id) => saved.resumes.some((item) => item.id === id))
      : [];
    saved.activeId = saved.resumes.some((item) => item.id === saved.activeId)
      ? saved.activeId
      : saved.resumes[0].id;
    if (!saved.openIds.includes(saved.activeId)) saved.openIds.push(saved.activeId);
    saved.collapsedFolders = Array.isArray(saved.collapsedFolders) ? saved.collapsedFolders : [];
    return saved;
  } catch {
    return null;
  }
}
let workspace = readWorkspace();
if (!workspace) {
  const id = makeWorkspaceId("resume");
  workspace = {
    folders: [{ id: "folder-main", name: "My resumes", parentId: null }],
    resumes: [
      {
        id,
        name: resume.basics?.name || "Tarun B",
        nameAuto: false,
        folderId: "folder-main",
        data: deepClone(resume),
      },
    ],
    openIds: [id],
    activeId: id,
    collapsedFolders: [],
  };
} else {
  const savedActive = workspace.resumes.find((item) => item.id === workspace.activeId);
  if (savedActive) resume = deepClone(savedActive.data);
}
const restoredDraft = workspace.resumes.find((item) => item.id === workspace.activeId)?.draftJson;
let activeResumeId = workspace.activeId;
if (["source", "document"].includes(workspace.mobilePane)) mobilePane = workspace.mobilePane;
resetV2SourceState(workspace.resumes.find((item) => item.id === activeResumeId)?.sourceDrafts);
const documentHistories = new Map();
let restoringHistory = false;
let customTemplates = readCustomTemplates();
let activeMode = workspace.outputMode === "word" ? "word" : "pdf";
let latestJsonError = null;
let compileCount = Number(safeStorageGet("forma.compile.count") || 0);
let interfaceAppearance =
  safeStorageGet("forma.interface.appearance") === "material" ? "material" : "apple";
let darkMode = safeStorageGet("forma.dark.mode") === "true";
let appearanceStage =
  safeStorageGet("forma.appearance.stage") ||
  (darkMode ? "dark" : interfaceAppearance === "apple" ? "apple" : "light");
if (!["apple", "light", "dark"].includes(appearanceStage)) appearanceStage = "apple";
interfaceAppearance = appearanceStage === "light" ? "material" : "apple";
darkMode = appearanceStage === "dark";
let compiledArtifacts = null;
let toastTimer;
let activeFormatPath = "";
let latexSourceBeforeEdit = "";
let sourceWrap = safeStorageGet("forma.source.wrap") !== "false";
const jsonEditor = $("#jsonEditor");
const latexEditor = document.createElement("textarea");
latexEditor.id = "latexEditor";
latexEditor.spellcheck = false;
latexEditor.wrap = "soft";
latexEditor.setAttribute("aria-label", "LaTeX source editor");
const latexHighlight = document.createElement("pre");
latexHighlight.id = "latexHighlight";
latexHighlight.setAttribute("aria-hidden", "true");

function escapeHtml(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch],
  );
}
function titleCase(key) {
  return String(key)
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
function saveWorkspace() {
  safeStorageSet(WORKSPACE_STORAGE_KEY, JSON.stringify(workspace));
}
function renderResumeTabs() {
  const bar = $("#resumeTabs");
  const tabs = workspace.openIds
    .map((id) => workspace.resumes.find((item) => item.id === id))
    .filter(Boolean);
  bar.innerHTML =
    tabs
      .map(
        (item) =>
          `<div class="resume-tab-shell${item.id === activeResumeId ? " active" : ""}" role="presentation"><button class="resume-tab${item.id === activeResumeId ? " active" : ""}" data-resume-tab="${escapeHtml(item.id)}" role="tab" aria-selected="${item.id === activeResumeId}"><span title="${escapeHtml(item.name || "Untitled resume")}">${escapeHtml(item.name || "Untitled resume")}</span></button>${tabs.length > 1 ? `<button class="resume-tab-close" data-close-tab="${escapeHtml(item.id)}" title="Close tab" aria-label="Close ${escapeHtml(item.name)}"><span class="material-symbols-rounded" aria-hidden="true">close</span></button>` : ""}</div>`,
      )
      .join("") +
    `<div class="resume-tab-actions"><button class="button quiet icon-button" id="newResumeButton" aria-label="New resume" title="New resume"><span class="material-symbols-rounded">add</span></button></div>`;
  $("#newResumeButton").addEventListener("click", createResume);
}
function renderFolderTree() {
  const host = $("#folderTree");
  const renderFolder = (folder) => {
    const collapsed = workspace.collapsedFolders.includes(folder.id);
    const childFolders = workspace.folders.filter((item) => item.parentId === folder.id);
    const files = workspace.resumes.filter((item) => item.folderId === folder.id);
    return `<div class="folder-branch"><button class="folder-row" data-folder-id="${escapeHtml(folder.id)}" title="${escapeHtml(folder.name)} · Drop files here"><span class="material-symbols-rounded" aria-hidden="true">${collapsed ? "chevron_right" : "expand_more"}</span><span class="material-symbols-rounded" aria-hidden="true">folder</span><span title="${escapeHtml(folder.name)}">${escapeHtml(folder.name)}</span></button>${collapsed ? "" : `<div class="folder-children">${files.map((item) => `<div class="file-entry${item.id === activeResumeId ? " active" : ""}"><button class="file-row${item.id === activeResumeId ? " active" : ""}" data-resume-file="${escapeHtml(item.id)}" draggable="true" title="${escapeHtml(item.name)}"><span class="material-symbols-rounded" aria-hidden="true">description</span><span>${escapeHtml(item.name || "Untitled resume")}</span></button><button class="file-menu-button" data-file-menu="${escapeHtml(item.id)}" aria-label="Actions for ${escapeHtml(item.name)}" aria-haspopup="menu" aria-expanded="false" title="Rename or delete">⋮</button></div>`).join("")}${childFolders.map(renderFolder).join("")}</div>`}</div>`;
  };
  host.innerHTML = workspace.folders
    .filter(
      (folder) =>
        !folder.parentId || !workspace.folders.some((parent) => parent.id === folder.parentId),
    )
    .map(renderFolder)
    .join("");
}
function renderWorkspace() {
  renderResumeTabs();
  renderFolderTree();
  saveWorkspace();
}
function switchResume(id) {
  saveWordDocument();
  const item = workspace.resumes.find((record) => record.id === id);
  if (!item) return;
  if (!workspace.openIds.includes(id)) workspace.openIds.push(id);
  workspace.activeId = id;
  compiledArtifacts = null;
  activeResumeId = id;
  resume = deepClone(item.data);
  resetV2SourceState(item.sourceDrafts);
  latestJsonError = null;
  jsonEditor.value = item.draftJson || JSON.stringify(resume, null, 2);
  if (item.draftJson) {
    try {
      ResumeFormats.assertModel(JSON.parse(item.draftJson));
    } catch (error) {
      latestJsonError = error;
    }
  }
  renderWorkspace();
  updateJsonEditor();
  syncControls();
  renderOutput();
  setJsonStatus(
    latestJsonError ? latestJsonError.message : "Resume opened · changes save locally",
    Boolean(latestJsonError),
  );
}
function createResume() {
  const activeRecord = workspace.resumes.find((x) => x.id === activeResumeId);
  $("#modalRoot").innerHTML =
    `<div class="modal-backdrop"><div class="modal new-resume-modal" role="dialog" aria-modal="true" aria-labelledby="newResumeTitle"><h2 id="newResumeTitle">New resume</h2><p>Choose a starting point. Changes save automatically on this device.</p><div class="creation-choices"><label><input type="radio" name="resumeStart" value="blank" checked> Blank resume</label><label><input type="radio" name="resumeStart" value="template"> Template defaults</label><label><input type="radio" name="resumeStart" value="duplicate"> Copy current resume</label><label><input type="radio" name="resumeStart" value="import"> Import a file</label></div><div class="form-field"><label for="newResumeName">Name</label><input id="newResumeName" value="Tarun B" maxlength="80"></div><div class="form-grid"><div class="form-field"><label for="newResumeFolder">Folder</label><select id="newResumeFolder">${workspace.folders.map((x) => `<option value="${escapeHtml(x.id)}" ${x.id === activeRecord?.folderId ? "selected" : ""}>${escapeHtml(x.name)}</option>`).join("")}</select></div><div class="form-field"><label for="newResumeTemplate">Template</label><select id="newResumeTemplate">${[...BUILTIN_TEMPLATES, ...customTemplates].map((x) => `<option value="${escapeHtml(x.id)}" ${x.id === resume.template ? "selected" : ""}>${escapeHtml(x.name)}</option>`).join("")}</select></div></div><p class="creation-note" id="creationNote">An empty resume with your selected layout.</p><div class="modal-actions"><button class="button quiet" id="cancelNewResume">Cancel</button><button class="button primary" id="confirmNewResume">Create resume</button></div></div></div>`;
  const close = () => $("#modalRoot").replaceChildren();
  $("#cancelNewResume").onclick = close;
  $$("[name=resumeStart]").forEach(
    (el) =>
      (el.onchange = () => {
        const mode = $("[name=resumeStart]:checked").value;
        $("#confirmNewResume").textContent = mode === "import" ? "Choose file" : "Create resume";
        $("#newResumeTemplate").disabled = mode === "duplicate" || mode === "import";
        $("#creationNote").textContent = {
          blank: "An empty resume with your selected layout.",
          template:
            "Personal templates include their saved text. Built-in templates start with an empty resume.",
          duplicate: "Copy the content and formatting into a separate resume.",
          import:
            "PDF, Word, JSON, XML, HTML, LaTeX, Markdown, text or a session ZIP. The content determines the format.",
        }[mode];
      }),
  );
  $("#confirmNewResume").onclick = () => {
    const mode = $("[name=resumeStart]:checked").value;
    const options = {
      name: $("#newResumeName").value.trim() || "Untitled resume",
      folderId: $("#newResumeFolder").value,
    };
    if (mode === "import") {
      pendingImportOptions = options;
      close();
      $("#resumeImportFile").click();
      return;
    }
    const preset = templateById($("#newResumeTemplate").value);
    let data = {
      template: preset.id,
      format: deepClone(preset.format || { font: "Arial", accent: "#496f91", bullet: "disc" }),
      layout: deepClone(preset.layout || {}),
      basics: { name: "Tarun B", label: "", email: "", phone: "", location: "", url: "" },
      summary: "",
      experience: [],
      education: [],
      skills: [],
      projects: [],
    };
    if (mode === "duplicate") data = deepClone(resume);
    else if (mode === "template" && preset.seed)
      data = { ...deepClone(preset.seed), template: preset.id };
    const id = makeWorkspaceId("resume");
    workspace.resumes.push({ id, ...options, nameAuto: options.name === "Untitled resume", data });
    workspace.openIds.push(id);
    close();
    switchResume(id);
  };
  $("#newResumeName").focus();
  $("#newResumeName").select();
}
let pendingImportOptions = null;

function persistResume() {
  updateBuildState();
  safeStorageSet(RESUME_STORAGE_KEY, JSON.stringify(resume));
  const item = workspace.resumes.find((record) => record.id === activeResumeId);
  let renamed = false;
  if (item) {
    item.draftJson = latestJsonError ? jsonEditor.value : null;
    item.sourceDrafts = collectSourceDrafts();
    recordHistory();
    item.data = deepClone(resume);
    if (item.nameAuto && resume.basics?.name) {
      const nextName = `${resume.basics.name} Resume`;
      if (item.name !== nextName) {
        item.name = nextName;
        renamed = true;
      }
    }
  }
  saveWorkspace();
  if (renamed) {
    renderResumeTabs();
    renderFolderTree();
  }
}
function persistTemplates() {
  safeStorageSet(TEMPLATE_STORAGE_KEY, JSON.stringify(customTemplates));
}
function templateById(id) {
  return (
    BUILTIN_TEMPLATES.find((template) => template.id === id) ||
    customTemplates.find((template) => template.id === id) ||
    BUILTIN_TEMPLATES[0]
  );
}
function effectiveTemplateId(template) {
  return (
    BUILTIN_TEMPLATES.find((item) => item.id === template.base)?.base ||
    template.base ||
    template.id
  );
}
function syncControls() {
  syncPaperSize();
  document.documentElement.style.setProperty("--accent", resume.format?.accent || "#496f91");
  const stages = ["apple", "light", "dark"];
  const stageLabels = { light: "Material light", apple: "Apple light", dark: "Dark" };
  const nextStage = stages[(stages.indexOf(appearanceStage) + 1) % stages.length];
  $("#appearanceCycle").innerHTML =
    appearanceStage === "apple"
      ? '<span class="material-symbols-rounded appearance-apple" aria-hidden="true">nutrition</span>'
      : `<span class="material-symbols-rounded" aria-hidden="true">${appearanceStage === "dark" ? "dark_mode" : "light_mode"}</span>`;
  $("#appearanceCycle").innerHTML +=
    `<span class="mobile-action-label">${stageLabels[appearanceStage]}</span>`;
  $("#appearanceCycle").setAttribute(
    "aria-label",
    `Appearance: ${stageLabels[appearanceStage]}. Switch to ${stageLabels[nextStage]}`,
  );
  $("#appearanceCycle").title = `${stageLabels[appearanceStage]} → ${stageLabels[nextStage]}`;
  document.body.dataset.appearance = interfaceAppearance;
  if (darkMode) document.body.classList.add("dark-mode");
  else document.body.classList.remove("dark-mode");
}
function pathGet(object, path) {
  return path.split(".").reduce((value, part) => (value == null ? undefined : value[part]), object);
}
function pathSet(object, path, value) {
  const parts = path.split(".");
  if (parts.some((part) => ["__proto__", "prototype", "constructor"].includes(part)))
    throw new Error("Unsupported field path");
  let cursor = object;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    const nextIsIndex = /^\d+$/.test(parts[i + 1]);
    if (cursor[part] == null || typeof cursor[part] !== "object")
      cursor[part] = nextIsIndex ? [] : {};
    cursor = cursor[part];
  }
  cursor[parts[parts.length - 1]] = value;
}
function fieldStyle(path) {
  return resume.layout?.fieldStyles?.[path] || {};
}
function applyFieldFormatting(root) {
  $$("[data-path]", root).forEach((node) => {
    const style = fieldStyle(node.dataset.path);
    if (!Object.keys(style).length) return;
    if (["normal", "title", "heading1", "heading2"].includes(style.role)) {
      node.classList.add("field-" + style.role);
      node.style.fontSize =
        { normal: 10, title: 26, heading1: 17, heading2: 13 }[style.role] + "pt";
      node.style.fontWeight = style.role === "normal" ? "400" : "700";
      node.style.textTransform = "none";
      node.style.letterSpacing = "normal";
    }
    if (["Arial", "Georgia", "Verdana", "Times New Roman"].includes(style.fontFamily))
      node.style.fontFamily = style.fontFamily;
    if (
      Number.isFinite(Number(style.fontSize)) &&
      Number(style.fontSize) >= 6 &&
      Number(style.fontSize) <= 72
    )
      node.style.fontSize = Number(style.fontSize) + "pt";
    if (/^#[0-9a-f]{6}$/i.test(style.color || "")) node.style.color = style.color;
    if (/^#[0-9a-f]{6}$/i.test(style.highlight || "")) node.style.backgroundColor = style.highlight;
    if (["bold", "normal"].includes(style.fontWeight)) node.style.fontWeight = style.fontWeight;
    if (["italic", "normal"].includes(style.fontStyle)) node.style.fontStyle = style.fontStyle;
    if (typeof style.underline === "boolean")
      node.style.textDecoration = style.underline ? "underline" : "none";
    if (
      Number.isFinite(Number(style.lineHeight)) &&
      Number(style.lineHeight) >= 1 &&
      Number(style.lineHeight) <= 2.5
    )
      node.style.lineHeight = String(style.lineHeight);
    const block = node.matches("h1,h2,p,li,header")
      ? node
      : node.closest("li,.resume-entry-head,.resume-entry-sub,.resume-header,.resume-section") ||
        node;
    if (Number.isFinite(Number(style.spaceBefore)))
      block.style.marginTop = Math.min(60, Math.max(0, Number(style.spaceBefore))) + "pt";
    if (Number.isFinite(Number(style.spaceAfter)))
      block.style.marginBottom = Math.min(60, Math.max(0, Number(style.spaceAfter))) + "pt";
    if (style.borderStyle === "none") block.style.borderBottom = "none";
    if (node.closest("li") && Number(style.fontSize) >= 6)
      node.closest("li").style.fontSize = Number(style.fontSize) + "pt";
    if (["solid", "double", "dashed"].includes(style.borderStyle))
      block.style.borderBottom = `1px ${style.borderStyle} ${/^#[0-9a-f]{6}$/i.test(style.color || "") ? style.color : "#aab7c1"}`;
    if (["left", "center", "right"].includes(style.textAlign)) {
      const alignBlock = node.closest(".resume-contact") || block;
      alignBlock.style.textAlign = style.textAlign;
      if (getComputedStyle(alignBlock).display === "flex")
        alignBlock.style.justifyContent =
          style.textAlign === "center"
            ? "center"
            : style.textAlign === "right"
              ? "flex-end"
              : "flex-start";
    }
  });
}
function fontCss() {
  const font = resume.format?.font || "Arial";
  if (font === "Georgia") return 'Georgia, "Times New Roman", serif';
  if (font === "Times New Roman") return '"Times New Roman", Georgia, serif';
  if (font === "Verdana") return "Verdana, Arial, sans-serif";
  return 'Arial, "Helvetica Neue", sans-serif';
}
function updateJsonEditor() {
  const value = JSON.stringify(resume, null, 2);
  if (document.activeElement !== jsonEditor && !latestJsonError) jsonEditor.value = value;
  highlightJson();
  updateJsonStats();
  if (
    isCompactLayout() &&
    document.activeElement?.matches("#jsonEditor,#xmlEditor,#latexEditor,#markdownInput")
  ) {
    persistResume();
    return;
  }
  if (document.activeElement !== latexEditor && !sourceState.latexError) {
    latexEditor.value = latexSource();
    latexSourceBeforeEdit = latexEditor.value;
    highlightLatex();
  }
  if (document.activeElement !== $("#markdownInput")) refreshMarkdownInput();
  syncV2Source();
  persistResume();
}
function syntaxHtml(source, language) {
  if (language === "json") {
    const regex =
      /(\s+|"(?:\\.|[^"\\])*"(?=\s*:)|"(?:\\.|[^"\\])*"|-?\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b|\b(?:true|false|null)\b|[{}\[\],:])/g;
    let result = "",
      cursor = 0;
    for (const match of source.matchAll(regex)) {
      const token = match[0],
        pos = match.index;
      result += escapeHtml(source.slice(cursor, pos));
      const isString = token.startsWith('"');
      const klass = isString
        ? /^\s*:/.test(source.slice(pos + token.length))
          ? "token-key"
          : "token-string"
        : /^-?\d/.test(token)
          ? "token-number"
          : /^(true|false|null)$/.test(token)
            ? "token-boolean"
            : /^[{}\[\],:]$/.test(token)
              ? "token-punc"
              : "";
      result += klass ? `<span class="${klass}">${escapeHtml(token)}</span>` : escapeHtml(token);
      cursor = pos + token.length;
    }
    return result + escapeHtml(source.slice(cursor));
  }
  let result = "",
    cursor = 0;
  const regex = /(%[^\n]*|\\[A-Za-z@]+|\\[^\sA-Za-z@])/g;
  for (const match of source.matchAll(regex)) {
    result += escapeHtml(source.slice(cursor, match.index));
    const token = match[0];
    const cls = token.startsWith("%") ? "token-comment" : "token-command";
    result += `<span class="${cls}">${escapeHtml(token)}</span>`;
    cursor = match.index + token.length;
  }
  return result + escapeHtml(source.slice(cursor));
}
function highlightSource(editor, layer, language, numbers) {
  const source = editor.value;
  editor.wrap = sourceWrap ? "soft" : "off";
  editor.classList.toggle("source-wrapped", sourceWrap);
  layer.classList.toggle("source-wrapped", sourceWrap);
  if (isCompactLayout()) return;
  layer.style.width = sourceWrap ? `${editor.clientWidth}px` : "max-content";
  const html = syntaxHtml(source, language);
  layer.innerHTML = sourceWrap
    ? html
        .split("\n")
        .map((line) => `<div class="source-code-line">${line || "&#8203;"}</div>`)
        .join("")
    : html + (source.endsWith("\n") ? " " : "");
  layer.style.height = `${Math.max(editor.scrollHeight, editor.parentElement.clientHeight)}px`;
  if (numbers) {
    const lines = sourceWrap ? [...layer.children] : source.split("\n");
    numbers.innerHTML = lines
      .map(
        (line, index) =>
          `<div style="height:${sourceWrap ? line.getBoundingClientRect().height : parseFloat(getComputedStyle(editor).lineHeight)}px">${index + 1}</div>`,
      )
      .join("");
  }
}
function highlightJson() {
  highlightSource(jsonEditor, $("#highlight"), "json", $("#lineNumbers"));
}
function highlightLatex() {
  highlightSource(latexEditor, latexHighlight, "latex");
}
function syncSourceWrap() {
  $$("[data-wrap-source]").forEach((button) =>
    button.setAttribute("aria-pressed", String(sourceWrap)),
  );
  $("#markdownInput").classList.toggle("source-wrapped", sourceWrap);
  $("#markdownInput").wrap = sourceWrap ? "soft" : "off";
  $("#xmlEditor").wrap = sourceWrap ? "soft" : "off";
  $("#xmlEditor").style.whiteSpace = sourceWrap ? "pre-wrap" : "pre";
  highlightJson();
  highlightLatex();
}
function updateJsonStats() {
  const bytes = new TextEncoder().encode(jsonEditor.value).length;
  $("#jsonStats").textContent = `${bytes} B · JSON`;
}
function setJsonStatus(message, error = false) {
  $("#jsonStatus").textContent = error ? jsonErrorSummary(message, jsonEditor.value) : message;
  $("#jsonStatus").title = message;
  $("#panelJson .editor-foot").classList.toggle("has-error", error);
  $("#jsonErrorDetails").hidden = !error;
  if (error) $("#jsonErrorRaw").textContent = message;
  $("#jsonStatusDot").classList.toggle("error", error);
  $("#jsonStatus").classList.toggle("editor-error", error);
}
function updateDocumentStatus() {
  if (latestJsonError) {
    syncControls();
    renderOutput();
    setJsonStatus(latestJsonError.message, true);
    return;
  }
  setJsonStatus("JSON valid · preview synced");
  updateJsonEditor();
  renderOutput();
}
let previewPage = 1;
let previewPageCount = 1;
let previewZoom = safeStorageGet("forma.preview.zoom.v4") || "fit";
const showAllPages = true;
let activeInput = ["json", "xml", "latex", "markdown"].includes(workspace.inputMode)
  ? workspace.inputMode
  : "json";
let workspaceView = activeInput;
let sourceFirst = workspace.sourceFirst !== false;
let panelWeights = {
  json: 30,
  xml: 30,
  latex: 30,
  markdown: 30,
  output: 70,
  ...(workspace.layoutVersion === 6 ? workspace.panelWeights : {}),
};
workspace.layoutVersion = 6;
let workspaceLayout = workspace.view === "document" ? "document" : "split";
let collapsedPanels = {
  files: workspace.collapsedPanels?.files ?? window.matchMedia("(max-width: 900px)").matches,
};
const paneNodes = {
  json: $("#panelJson"),
  xml: $("#panelXml"),
  latex: $("#panelLatex"),
  markdown: $("#panelMarkdown"),
  output: $("#panelOutput"),
};
function visiblePanelOrder() {
  if (isCompactLayout()) return [mobilePane === "source" ? activeInput : "output"];
  if (workspaceLayout === "document") return ["output"];
  return sourceFirst ? [activeInput, "output"] : ["output", activeInput];
}
function setPanelGrid() {
  const visible = visiblePanelOrder(),
    tracks = [];
  visible.forEach((id, index) => {
    tracks.push(
      panelResizeVertical() && workspaceLayout === "split"
        ? `minmax(310px, ${panelWeights[id]}fr)`
        : `minmax(0, ${panelWeights[id]}fr)`,
    );
    if (index < visible.length - 1) tracks.push("8px");
  });
  const vertical = panelResizeVertical();
  document.body.dataset.mobilePane = mobilePane;
  $("#workspacePanels").style.gridTemplateColumns = vertical ? "minmax(0,1fr)" : tracks.join(" ");
  $("#workspacePanels").style.gridTemplateRows = vertical ? tracks.join(" ") : "minmax(0,1fr)";
  $$(".pane-resizer[data-left-panel]", $("#workspacePanels")).forEach((divider) => {
    const left = Number(panelWeights[divider.dataset.leftPanel]);
    const right = Number(panelWeights[divider.dataset.rightPanel]);
    divider.setAttribute("aria-valuenow", String(Math.round((100 * left) / (left + right))));
  });
}
function renderPanelOrder() {
  const container = $("#workspacePanels");
  paneNodes[activeInput].prepend($("#resumeTabs"));
  container.replaceChildren();
  container.classList.toggle(
    "document-only",
    isCompactLayout() ? mobilePane === "document" : workspaceLayout === "document",
  );
  const visible = visiblePanelOrder();
  visible.forEach((id, index) => {
    const pane = paneNodes[id];
    pane.classList.remove("hidden");
    pane.classList.remove("collapsed");
    container.appendChild(pane);
    if (index < visible.length - 1) {
      const divider = document.createElement("div");
      divider.className = "pane-resizer";
      divider.dataset.leftPanel = id;
      divider.dataset.rightPanel = visible[index + 1];
      divider.setAttribute("role", "separator");
      divider.setAttribute("aria-label", "Resize source and document");
      divider.setAttribute("aria-orientation", panelResizeVertical() ? "horizontal" : "vertical");
      divider.tabIndex = 0;
      divider.title = "Drag to resize output · use arrow keys when focused";
      divider.setAttribute("aria-valuemin", "16");
      divider.setAttribute("aria-valuemax", "84");
      container.appendChild(divider);
    }
  });
  Object.keys(paneNodes)
    .filter((id) => !visible.includes(id))
    .forEach((id) => {
      paneNodes[id].classList.add("hidden");
      container.appendChild(paneNodes[id]);
    });
  syncFilesPanel();
  $("#splitViewButton").setAttribute("aria-pressed", String(workspaceLayout === "split"));
  $("#documentViewButton").setAttribute("aria-pressed", String(workspaceLayout === "document"));
  workspace.view = workspaceLayout;
  workspace.mobilePane = mobilePane;
  workspace.inputMode = activeInput;
  workspace.sourceFirst = sourceFirst;
  workspace.collapsedPanels = collapsedPanels;
  workspace.panelWeights = panelWeights;
  setPanelGrid();
  saveWorkspace();
  requestAnimationFrame(fitPreview);
}
function reorderPanels(draggedId, targetId) {
  if (!draggedId || draggedId === targetId) return;
  sourceFirst = !sourceFirst;
  renderPanelOrder();
}
function activateInput(mode, expand = true) {
  if (!paneNodes[mode] || mode === "output") return;
  if (activeInput === "markdown" && !latestJsonError && markdownHasChanges()) commitMarkdown();
  if (sourceDraftError() && mode !== activeInput && mode !== sourceErrorMode()) {
    toast("Fix the current source error before changing formats, or export a session backup.");
    return;
  }
  if (latestJsonError && mode !== "json") {
    toast("Fix the JSON draft before switching source modes");
    return;
  }
  activeInput = mode;
  workspaceView = mode;
  $("#workspaceView").value = mode;
  if (expand) workspaceLayout = "split";
  $$("[data-input]").forEach((tab) => {
    const selected = tab.dataset.input === mode;
    tab.classList.toggle("active", selected);
    tab.setAttribute("aria-selected", String(selected));
    tab.tabIndex = selected ? 0 : -1;
  });
  if (mode === "markdown") refreshMarkdownInput();
  renderPanelOrder();
  highlightJson();
  highlightLatex();
  syncV2Source();
}
function syncFilesPanel() {
  $(".main").classList.toggle("files-hidden", collapsedPanels.files);
  $("#sidebarCollapseButton").setAttribute("aria-expanded", String(!collapsedPanels.files));
  $("#sidebarCollapseButton").setAttribute(
    "aria-label",
    collapsedPanels.files ? "Expand file sidebar" : "Collapse file sidebar",
  );
  $("#sidebarCollapseButton").title = collapsedPanels.files ? "Expand files" : "Collapse files";
  $("#sidebarCollapseButton .material-symbols-rounded").textContent = collapsedPanels.files
    ? "chevron_right"
    : "chevron_left";
  $("#workspaceSidebarResizer").tabIndex = collapsedPanels.files ? -1 : 0;
  workspace.collapsedPanels = collapsedPanels;
  saveWorkspace();
  requestAnimationFrame(fitPreview);
}
function togglePanel(kind) {
  if (kind !== "files") return;
  collapsedPanels.files = !collapsedPanels.files;
  syncFilesPanel();
}
function commitMarkdown() {
  if (!markdownHasChanges()) return;
  try {
    resume = markdownInputData($("#markdownInput").value);
    sourceState.markdownCommitted = $("#markdownInput").value;
    sourceState.markdownError = null;
    latestJsonError = null;
    updateJsonEditor();
    syncControls();
    renderOutput();
    $("#markdownStatus").textContent = "Markdown synced";
  } catch (error) {
    sourceState.markdownError = error;
    $("#markdownStatus").textContent = error.message;
    persistResume();
    toast("Markdown could not be parsed: " + error.message);
  }
}
function updatePageControls(scroll = false) {
  const shown = viewingOriginal() ? currentOriginal().format === "pdf" : activeMode !== "word";
  $("#pageNavigator").classList.toggle("hidden", !shown);
  $("#pageNumber").max = String(previewPageCount);
  $("#pageNumber").value = String(previewPage);
  $("#pageTotal").textContent = `/ ${previewPageCount}`;
  $("#previousPage").disabled = previewPage <= 1;
  $("#nextPage").disabled = previewPage >= previewPageCount;
  $$(".preview-page", $("#previewBody")).forEach((page, index) =>
    page.classList.toggle("hidden", !showAllPages && index + 1 !== previewPage),
  );
  $("#documentStats").textContent = shown
    ? `${paperSize().label} · ${previewPageCount} page${previewPageCount === 1 ? "" : "s"}`
    : "Markdown";
  fitPreview();
  if (scroll && shown) {
    const host = $("#previewBody"),
      page = $(`[data-preview-page="${previewPage}"]`, host);
    if (page)
      host.scrollTop = Math.max(
        0,
        host.scrollTop + page.getBoundingClientRect().top - host.getBoundingClientRect().top - 20,
      );
  }
}
function fitPreview() {
  const host = $("#previewBody"),
    pages = $("#previewPages");
  if (!pages) return;
  const width = Number(pages.dataset.pageWidth) || PAGE.width;
  const height = Number(pages.dataset.pageHeight) || PAGE.height;
  const zoom =
    previewZoom === "fit"
      ? Math.max(0.25, Math.min(3, (host.clientWidth - 24) / width))
      : previewZoom === "page"
        ? Math.max(
            0.25,
            Math.min((host.clientWidth - 24) / width, (host.clientHeight - 40) / height),
          )
        : Math.max(0.25, Math.min(3, Number(previewZoom) || 1));
  applyDocumentScale(pages, Math.floor(zoom * 10000) / 10000, width);
  $("#documentStats").textContent = viewingOriginal()
    ? `Uploaded ${currentOriginal().format === "docx" ? "Word" : "PDF"} · ${Math.round(zoom * 100)}%`
    : activeMode === "word"
      ? `Word · ${Math.round(zoom * 100)}%`
      : `${paperSize().label} · ${previewPageCount} page${previewPageCount === 1 ? "" : "s"} · ${Math.round(zoom * 100)}%`;
}
function sectionKeys() {
  const keys = Object.keys(resume).filter(
    (key) =>
      !["basics", "template", "format", "layout"].includes(key) &&
      !key.startsWith("_") &&
      resume[key] != null &&
      resume[key] !== "" &&
      (!Array.isArray(resume[key]) || resume[key].length),
  );
  return [
    ...new Set([...(Array.isArray(resume.layout?.order) ? resume.layout.order : []), ...keys]),
  ].filter((key) => keys.includes(key));
}
function renderSectionOutline() {
  $("#sectionOutline").innerHTML = sectionKeys()
    .map(
      (key) =>
        `<button class="outline-item" draggable="true" data-outline-key="${escapeHtml(key)}">${escapeHtml(resume.layout?.sectionTitles?.[key] || (key === "summary" ? "Profile" : titleCase(key)))}</button>`,
    )
    .join("");
}

function markdownSource() {
  if (resume.layout?.richDocument) return richMarkdownSource();
  const metadata = {
    template: resume.template,
    format: { ...(resume.format || {}) },
    layout: resume.layout || {},
    model: deepClone(resume),
  };
  delete metadata.format.latexTemplate;
  const lines = [`<!-- forma:metadata ${encodeURIComponent(JSON.stringify(metadata))} -->`, ""];
  const field = (path, value, prefix = "") =>
    lines.push(
      `${prefix}${String(value ?? "").replace(/\n/g, "<br>")} <!-- forma:field ${encodeURIComponent(path)} -->`,
    );
  Object.entries(resume.basics || {}).forEach(([key, value]) => {
    if (value != null && typeof value !== "object")
      field("basics." + key, value, key === "name" ? "# " : key === "label" ? "### " : "");
  });
  const renderValue = (value, path, depth = 0) => {
    if (Array.isArray(value))
      value.forEach((item, index) => renderValue(item, path + "." + index, depth + 1));
    else if (value && typeof value === "object") {
      Object.entries(value).forEach(([key, child]) => {
        if (child && typeof child === "object") renderValue(child, path + "." + key, depth + 1);
        else
          field(
            path + "." + key,
            child,
            ["role", "name", "institution", "title"].includes(key) ? "### " : "",
          );
      });
      lines.push("");
    } else field(path, value, depth ? "- " : "");
  };
  sectionKeys().forEach((key) => {
    lines.push("");
    field(
      "layout.sectionTitles." + key,
      resume.layout?.sectionTitles?.[key] || (key === "summary" ? "Profile" : titleCase(key)),
      "## ",
    );
    renderValue(resume[key], key);
  });
  return lines.join("\n").trim() + "\n";
}
let markdownBindingBase = null;
let markdownBindings = [];
function refreshMarkdownInput() {
  if (sourceState.markdownError) return;
  const linked = markdownSource().split("\n");
  markdownBindings = [];
  markdownBindingBase = deepClone(resume);
  for (const line of linked) {
    if (line.startsWith("<!-- forma:metadata")) continue;
    const match = /^(.*?) ?<!-- forma:field (.*?) -->\s*$/.exec(line);
    markdownBindings.push({
      text: match ? match[1] : line,
      path: match ? decodeURIComponent(match[2]) : null,
    });
  }
  $("#markdownInput").value = markdownBindings
    .map((x) => x.text)
    .join("\n")
    .replace(/^\n/, "");
  if (markdownBindings[0]?.text === "") markdownBindings.shift();
  sourceState.markdownCommitted = $("#markdownInput").value;
}
function markdownInputData(source) {
  if (source.includes("<!-- forma:field "))
    return parseLinkedMarkdown(source, markdownBindingBase || resume);
  if (source === sourceState.markdownCommitted) return deepClone(markdownBindingBase || resume);
  const old = markdownBindings,
    newLines = source.split("\n");
  if (old.length > 1500 || newLines.length > 1500)
    throw new Error("For sources over 1,500 lines, use JSON or import the Markdown file.");
  const matrix = Array.from({ length: old.length + 1 }, () => new Uint16Array(newLines.length + 1));
  for (let i = old.length - 1; i >= 0; i--)
    for (let k = newLines.length - 1; k >= 0; k--)
      matrix[i][k] =
        old[i].text === newLines[k]
          ? matrix[i + 1][k + 1] + 1
          : Math.max(matrix[i + 1][k], matrix[i][k + 1]);
  const anchors = [];
  let i = 0,
    k = 0;
  while (i < old.length && k < newLines.length) {
    if (old[i].text === newLines[k]) {
      anchors.push([i, k]);
      i++;
      k++;
    } else if (matrix[i + 1][k] >= matrix[i][k + 1]) i++;
    else k++;
  }
  anchors.push([old.length, newLines.length]);
  const paths = new Array(newLines.length).fill(null);
  let oi = 0,
    ni = 0;
  const kind = (line) =>
    !line.trim()
      ? "blank"
      : /^##\s/.test(line)
        ? "section"
        : /^#/.test(line)
          ? "heading"
          : /^[-*]\s/.test(line)
            ? "bullet"
            : "text";
  for (const [o, n] of anchors) {
    const candidates = old.slice(oi, o).filter((x) => x.path);
    let used = new Set();
    for (let index = ni; index < n; index++) {
      const candidate = candidates.find(
        (x, c) => !used.has(c) && kind(x.text) === kind(newLines[index]),
      );
      if (candidate) {
        paths[index] = candidate.path;
        used.add(candidates.indexOf(candidate));
      }
    }
    if (n < newLines.length) paths[n] = old[o].path;
    oi = o + 1;
    ni = n + 1;
  }
  const linked = newLines
    .map((line, index) =>
      paths[index] ? `${line} <!-- forma:field ${encodeURIComponent(paths[index])} -->` : line,
    )
    .join("\n");
  const next = parseLinkedMarkdown(linked, markdownBindingBase || resume),
    present = new Set(paths.filter(Boolean));
  const removed = old
    .filter((x) => x.path && !present.has(x.path))
    .map((x) => x.path)
    .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
  for (const path of removed) {
    if (path.startsWith("layout.sectionTitles.")) continue;
    const parts = path.split("."),
      last = parts.pop(),
      parent = pathGet(next, parts.join("."));
    if (Array.isArray(parent) && /^\d+$/.test(last)) parent.splice(Number(last), 1);
    else if (parent && typeof parent === "object") delete parent[last];
  }
  return next;
}
function parseLinkedMarkdown(source, base = resume) {
  if (!source.includes("<!-- forma:field ")) return parseResumeText(source);
  const metadata = /<!-- forma:metadata ([^\n]*?) -->/.exec(source);
  let metadataValue;
  if (metadata) {
    metadataValue = JSON.parse(decodeURIComponent(metadata[1]));
    if (metadataValue.model) base = ResumeFormats.assertModel(metadataValue.model);
  }
  const next = deepClone(base),
    found = new Set();
  if (metadataValue) {
    next.template = metadataValue.template || next.template;
    next.format = { ...(next.format || {}), ...(metadataValue.format || {}) };
    next.layout = { ...(next.layout || {}), ...(metadataValue.layout || {}) };
  }
  let previousPath = "",
    newSection = "";
  for (const line of source.split("\n")) {
    const match = /^(.*?) ?<!-- forma:field ([^\n]*?) -->\s*$/.exec(line);
    if (match) {
      const path = decodeURIComponent(match[2]);
      found.add(path);
      previousPath = path;
      newSection = "";
      const raw = match[1]
        .replace(/^\s*(?:#{1,6}(?:\s+|$)|[-*](?:\s+|$))/, "")
        .replace(/<br\s*\/?\s*>/gi, "\n");
      const original = pathGet(base, path);
      if (original === undefined && path.startsWith("layout.sectionTitles.")) {
        const key = path.slice("layout.sectionTitles.".length);
        if (raw === (key === "summary" ? "Profile" : titleCase(key))) continue;
      }
      let value = original === null && raw === "" ? null : raw;
      if (typeof original === "number" && raw !== "" && Number.isFinite(Number(raw)))
        value = Number(raw);
      if (typeof original === "boolean" && /^(true|false)$/.test(raw)) value = raw === "true";
      pathSet(next, path, value);
    } else if (/^##\s+/.test(line)) {
      const title = line.replace(/^##\s+/, "").trim(),
        key = title
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "_")
          .replace(/^_|_$/g, "");
      if (
        key &&
        ![
          "__proto__",
          "constructor",
          "prototype",
          "basics",
          "layout",
          "format",
          "template",
        ].includes(key)
      ) {
        newSection = key;
        next[key] ||= [];
        next.layout ||= {};
        next.layout.sectionTitles ||= {};
        next.layout.sectionTitles[key] = title;
        previousPath = "";
      }
    } else if (/^\s*[-*]\s+/.test(line)) {
      const value = line.replace(/^\s*[-*]\s+/, "").trim();
      if (newSection && Array.isArray(next[newSection])) next[newSection].push(value);
      else if (/\.\d+$/.test(previousPath)) {
        const parent = pathGet(next, previousPath.slice(0, previousPath.lastIndexOf(".")));
        if (Array.isArray(parent)) parent.push(value);
      }
    } else if (newSection && line.trim() && !line.startsWith("<!--")) {
      if (Array.isArray(next[newSection])) next[newSection].push(line.trim());
    } else if (previousPath && line.trim() && !line.startsWith("<!--")) {
      const value = pathGet(next, previousPath);
      if (typeof value === "string") pathSet(next, previousPath, value + "\n" + line.trim());
    }
  }
  return next;
}

function buildPreviewPages() {
  syncPaperSize();
  const measurement = document.createElement("div");
  measurement.className = "measure-preview";
  measurement.style.cssText = `position:absolute;visibility:hidden;left:-20000px;top:0;width:${PAGE.width}px;pointer-events:none`;
  measurement.innerHTML = resumeHtml();
  document.body.appendChild(measurement);
  const source = $(".resume-paper", measurement);
  const activeTemplate = templateById(resume.template);
  if (customTemplates.some((item) => item.id === activeTemplate.id))
    measurement.dataset.template = activeTemplate.id;
  applyFieldFormatting(measurement);
  // Free-form Word blocks keep their exact order, including the name/header.
  const header = resume.layout?.richDocument ? null : $(".resume-header", source)?.cloneNode(true);
  const headerZone = $(".resume-header", source)?.closest(".drop-zone")?.dataset.zone || "main";
  const sections = $$(".resume-section[data-section-key]", source).map((node) => ({
    node: node.cloneNode(true),
    zone: node.closest(".drop-zone")?.dataset.zone || "main",
  }));
  const zones = new Map($$(".drop-zone", source).map((zone) => [zone.dataset.zone, zone]));
  zones.forEach((zone) => zone.replaceChildren());
  const capacities = {};
  zones.forEach((zone, key) => {
    const parent = zone.parentElement;
    const style = getComputedStyle(parent);
    capacities[key] =
      PAGE.height -
      parseFloat(style.paddingTop) -
      parseFloat(style.paddingBottom) -
      (parent === source
        ? parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth)
        : 0) -
      2;
  });
  const measure = (node, zoneKey) => {
    const zone = zones.get(zoneKey);
    zone.replaceChildren(node);
    const style = getComputedStyle(node);
    const height =
      node.getBoundingClientRect().height +
      (parseFloat(style.marginTop) || 0) +
      (parseFloat(style.marginBottom) || 0);
    node.remove();
    return height;
  };
  const pages = [];
  let page = { items: [], used: {} };
  if (header) page.used[headerZone] = measure(header.cloneNode(true), headerZone);
  const nextPage = () => {
    pages.push(page);
    page = { items: [], used: {} };
  };
  const sectionClone = (section, children) => {
    const clone = section.cloneNode(false),
      heading = section.querySelector(":scope > .resume-section-title");
    if (heading) clone.appendChild(heading.cloneNode(true));
    children.forEach((child) => clone.appendChild(child.cloneNode(true)));
    return clone;
  };
  // Split only oversized blocks; normal entries stay together.
  const splitText = (node, wrap, zoneKey, capacity) => {
    const textNode = node.matches("li") ? $(".bullet-text", node) || node : node;
    if (!textNode) return [node];
    const tokens = [...textNode.textContent.matchAll(/\S+/g)];
    const words = tokens.map((token) => token[0]),
      fragments = [];
    let offset = 0;
    while (offset < words.length) {
      let low = 1,
        high = words.length - offset,
        best = 1;
      const make = (count) => {
        const clone = node.cloneNode(true);
        const target = clone.matches("li") ? $(".bullet-text", clone) || clone : clone;
        const first = tokens[offset],
          last = tokens[offset + count - 1];
        const sliced = sliceRichNode(textNode, first.index, last.index + last[0].length);
        target.replaceChildren(...sliced.childNodes);
        target.dataset.chunked = "true";
        return clone;
      };
      while (low <= high) {
        const mid = Math.floor((low + high) / 2);
        if (measure(wrap(make(mid)), zoneKey) <= capacity) {
          best = mid;
          low = mid + 1;
        } else high = mid - 1;
      }
      fragments.push(make(best));
      offset += best;
    }
    return fragments;
  };
  for (const { node: section, zone: zoneKey } of sections) {
    const capacity = capacities[zoneKey];
    const remaining = capacity - (page.used[zoneKey] || 0);
    const fullHeight = measure(section.cloneNode(true), zoneKey);
    if (fullHeight <= remaining) {
      page.items.push({ node: section, zone: zoneKey });
      page.used[zoneKey] = (page.used[zoneKey] || 0) + fullHeight;
      continue;
    }
    if (fullHeight <= capacity) {
      nextPage();
      page.items.push({ node: section, zone: zoneKey });
      page.used[zoneKey] = fullHeight;
      continue;
    }
    const heading = section.querySelector(":scope > .resume-section-title");
    const children = [...section.children].filter((child) => child !== heading);
    const units = [];
    for (const child of children) {
      const wrapped = (value) => sectionClone(section, [value]);
      if (measure(wrapped(child), zoneKey) <= capacity) {
        units.push(child);
        continue;
      }
      const list = child.matches("ul,ol") ? child : $(".resume-bullets,ul,ol", child);
      if (list) {
        const entryFor = (items) => {
          const entry = child.cloneNode(true);
          const target = entry.matches("ul,ol") ? entry : $(".resume-bullets,ul,ol", entry);
          target.replaceChildren(...items.map((item) => item.cloneNode(true)));
          return entry;
        };
        let chunk = [];
        for (const bullet of [...list.children]) {
          const fragments =
            measure(wrapped(entryFor([bullet])), zoneKey) > capacity
              ? splitText(bullet, (value) => wrapped(entryFor([value])), zoneKey, capacity)
              : [bullet];
          for (const fragment of fragments) {
            if (
              chunk.length &&
              measure(wrapped(entryFor([...chunk, fragment])), zoneKey) > capacity
            ) {
              units.push(entryFor(chunk));
              chunk = [];
            }
            chunk.push(fragment);
          }
        }
        if (chunk.length) units.push(entryFor(chunk));
      } else if (
        child.matches("p,h1,h2,h3,h4,blockquote") ||
        (child.matches("div") && !child.querySelector("p,div,ul,ol,section,header"))
      )
        units.push(...splitText(child, wrapped, zoneKey, capacity));
      else if (child.matches(".resume-entry,.resume-skills")) {
        const prelude = child.querySelector(":scope > .resume-entry-head");
        const parts = [...child.children].filter((node) => node !== prelude);
        const containerFor = (items) => {
          const container = child.cloneNode(false);
          if (prelude) container.appendChild(prelude.cloneNode(true));
          items.forEach((item) => container.appendChild(item.cloneNode(true)));
          return container;
        };
        let chunk = [];
        for (const part of parts) {
          let fragments = [part];
          if (measure(wrapped(containerFor([part])), zoneKey) > capacity) {
            const candidates = [
              ...(part.matches("[data-path]") ? [part] : []),
              ...part.querySelectorAll("[data-path]"),
            ].sort((left, right) => right.textContent.length - left.textContent.length);
            const field = candidates[0];
            if (field) {
              const replaceField = (fragment) => {
                if (field === part) return fragment;
                const clone = part.cloneNode(true);
                clone
                  .querySelector(`[data-path="${CSS.escape(field.dataset.path)}"]`)
                  .replaceWith(fragment.cloneNode(true));
                return clone;
              };
              fragments = splitText(
                field,
                (fragment) => wrapped(containerFor([replaceField(fragment)])),
                zoneKey,
                capacity,
              ).map(replaceField);
            }
          }
          for (const fragment of fragments) {
            if (
              chunk.length &&
              measure(wrapped(containerFor([...chunk, fragment])), zoneKey) > capacity
            ) {
              units.push(containerFor(chunk));
              chunk = [];
            }
            chunk.push(fragment);
          }
        }
        if (chunk.length) units.push(containerFor(chunk));
      } else units.push(child);
    }
    let group = [];
    const flush = () => {
      if (!group.length) return;
      const node = sectionClone(section, group);
      const height = measure(node.cloneNode(true), zoneKey);
      page.items.push({ node, zone: zoneKey });
      page.used[zoneKey] = (page.used[zoneKey] || 0) + height;
      group = [];
    };
    for (const unit of units) {
      const available = capacity - (page.used[zoneKey] || 0);
      if (measure(sectionClone(section, [...group, unit]), zoneKey) > available) {
        flush();
        if (page.items.length || Object.values(page.used).some(Boolean)) nextPage();
      }
      group.push(unit);
    }
    flush();
  }
  if (page.items.length || !pages.length) pages.push(page);
  const result = pages.map((record, index) => {
    const paper = source.cloneNode(true);
    $$(".drop-zone", paper).forEach((zone) => zone.replaceChildren());
    if (index === 0 && header)
      $(`.drop-zone[data-zone="${headerZone}"]`, paper).appendChild(header.cloneNode(true));
    record.items.forEach((item) =>
      $(`.drop-zone[data-zone="${item.zone}"]`, paper).appendChild(item.node.cloneNode(true)),
    );
    const card = document.createElement("div");
    card.className = "preview-page";
    card.dataset.previewPage = String(index + 1);
    card.innerHTML = `<div class="preview-page-label">${index + 1} / ${pages.length}</div>`;
    card.appendChild(paper);
    return card;
  });
  measurement.remove();
  return result;
}

function renderOutput() {
  if (
    isCompactLayout() &&
    mobilePane === "source" &&
    document.activeElement?.matches("#jsonEditor,#xmlEditor,#latexEditor,#markdownInput")
  ) {
    sourcePreviewPending = true;
    return;
  }
  sourcePreviewPending = false;
  syncOriginalControl();
  if (renderOriginalOutput()) return;
  syncWordToolbar();
  $("#pageNavigator").classList.toggle("hidden", activeMode === "word");
  if (activeMode === "word") {
    renderWordOutput();
    return;
  }
  const host = $("#previewBody");
  $("#outputSubtitle").textContent = "Click to edit · right-click to format";
  host.innerHTML = `<div class="preview-pages" id="previewPages"></div>`;
  const pageStack = $("#previewPages", host);
  const pages = buildPreviewPages();
  pages.forEach((page) => pageStack.appendChild(page));
  previewPageCount = pages.length;
  previewPage = Math.max(1, Math.min(previewPage, previewPageCount));
  fitPreview();
  const activeTemplate = templateById(resume.template);
  if (customTemplates.some((item) => item.id === activeTemplate.id))
    pageStack.setAttribute("data-template", activeTemplate.id);
  host.setAttribute("aria-label", "Editable PDF document preview");
  $$("[data-path]", host).forEach((node) => (node.contentEditable = "true"));
  $$(".resume-section[data-section-key]", host).forEach((node) => (node.draggable = true));
  applyFieldFormatting(host);
  updatePageControls();
  renderSectionOutline();
  persistResume();
}
function htmlField(path, value, tag = "span", klass = "") {
  if (value == null || typeof value === "object") return "";
  return `<${tag} class="${klass}" data-path="${escapeHtml(path)}">${escapeHtml(value)}</${tag}>`;
}
function safeLink(value, key = "url") {
  const text = String(value ?? "").trim();
  if (!text) return "";
  if (/email/i.test(key)) return `mailto:${text}`;
  if (/phone|tel/i.test(key)) return `tel:${text.replace(/[^+\d]/g, "")}`;
  return /^(https?:|mailto:|tel:)/i.test(text) ? text : `https://${text}`;
}
function renderFieldByKey(path, key, value, tag = "span", klass = "") {
  if (value == null || typeof value === "object") return "";
  if (/^(url|website|link|email|phone|tel)$/i.test(key))
    return `<a class="${klass}" data-path="${escapeHtml(path)}" href="${escapeHtml(safeLink(value, key))}" target="_blank" rel="noopener">${escapeHtml(value)}</a>`;
  return htmlField(path, value, tag, klass);
}
function sectionHeading(key, title) {
  const shown = resume.layout?.sectionTitles?.[key] ?? title;
  return `<h2 class="resume-section-title" data-path="layout.sectionTitles.${escapeHtml(key)}">${escapeHtml(shown)}</h2>`;
}
function sectionFrame(key, title, content) {
  if (!content) return "";
  return `<section class="resume-section" data-section-key="${escapeHtml(key)}" draggable="true">${sectionHeading(key, title)}${content}</section>`;
}
function renderBulletList(values, basePath) {
  if (!Array.isArray(values) || !values.length) return "";
  const marker =
    resume.format?.bullet === "dash"
      ? "–"
      : resume.format?.bullet === "square"
        ? "▪"
        : resume.format?.bullet === "arrow"
          ? "›"
          : "•";
  return `<ul class="resume-bullets">${values
    .map((item, i) => {
      if (item && typeof item === "object")
        return `<li><span class="bullet-marker" aria-hidden="true">${marker}</span><span class="bullet-text">${renderObjectInline(item, `${basePath}.${i}`)}</span></li>`;
      return `<li><span class="bullet-marker" aria-hidden="true">${marker}</span><span class="bullet-text" data-path="${escapeHtml(`${basePath}.${i}`)}">${escapeHtml(item)}</span></li>`;
    })
    .join("")}</ul>`;
}
function renderObjectInline(object, basePath) {
  return Object.entries(object)
    .map(([key, value]) => {
      const path = `${basePath}.${key}`;
      if (Array.isArray(value))
        return `<span>${escapeHtml(titleCase(key))}: ${value.map((v, i) => htmlField(`${path}.${i}`, v)).join(", ")}</span>`;
      if (value && typeof value === "object") return "";
      return `<span>${renderFieldByKey(path, key, value)}</span>`;
    })
    .filter(Boolean)
    .join(" · ");
}
function renderGenericSection(key, value) {
  const path = key;
  if (value == null || key === "" || key.startsWith("_")) return "";
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const body = Object.entries(value)
      .map(([child, childValue]) => {
        const label = htmlField(
          "layout.fieldTitles." + key + "." + child,
          resume.layout?.fieldTitles?.[key]?.[child] ?? titleCase(child),
          "strong",
        );
        if (Array.isArray(childValue))
          return (
            '<div class="resume-entry">' +
            label +
            renderBulletList(childValue, path + "." + child) +
            "</div>"
          );
        return (
          "<p>" + label + ": " + renderFieldByKey(path + "." + child, child, childValue) + "</p>"
        );
      })
      .join("");
    return sectionFrame(
      key,
      titleCase(key),
      body || '<div class="resume-entry-sub">Add details in the JSON editor</div>',
    );
  }
  let body = "";
  if (Array.isArray(value)) {
    if (value.length && value.every((v) => typeof v !== "object" || v === null)) {
      body =
        key.toLowerCase() === "skills"
          ? `<div class="resume-skills">${value.map((v, i) => `<span class="skill-chip" data-path="${escapeHtml(`${path}.${i}`)}">${escapeHtml(v)}</span>`).join("")}</div>`
          : renderBulletList(value, path);
    } else {
      body = value
        .map((entry, i) => {
          if (entry == null) return "";
          const entryPath = `${path}.${i}`;
          if (typeof entry !== "object")
            return `<p data-path="${escapeHtml(entryPath)}">${escapeHtml(entry)}</p>`;
          const entries = Object.entries(entry).filter(([, v]) => v !== null && v !== "");
          if (!entries.length)
            return `<div class="resume-entry"><span class="resume-entry-sub" data-path="${escapeHtml(entryPath)}">Add details here</span></div>`;
          const titleKey = entries.find(([k]) =>
            /^(role|title|name|label|institution|company)$/i.test(k),
          )?.[0];
          const dateKey = entries.find(([k]) => /date|year/i.test(k))?.[0];
          const titleEntry = titleKey ? entries.find(([k]) => k === titleKey) : entries[0];
          const dateEntry = dateKey ? entries.find(([k]) => k === dateKey) : null;
          const excluded = new Set([titleEntry?.[0], dateEntry?.[0]]);
          const secondary = entries.filter(([k]) => !excluded.has(k) && !Array.isArray(entry[k]));
          const lists = entries.filter(([k]) => Array.isArray(entry[k]));
          return `<div class="resume-entry"><div class="resume-entry-head"><strong class="resume-entry-title">${titleEntry ? renderFieldByKey(`${entryPath}.${titleEntry[0]}`, titleEntry[0], titleEntry[1]) : ""}</strong>${dateEntry ? htmlField(`${entryPath}.${dateEntry[0]}`, dateEntry[1], "span", "resume-entry-date") : ""}</div>${secondary.map(([k, v]) => `<div class="resume-entry-sub">${renderFieldByKey(`${entryPath}.${k}`, k, v)}</div>`).join("")}${lists.map(([k, v]) => renderBulletList(v, `${entryPath}.${k}`)).join("")}</div>`;
        })
        .join("");
    }
  } else if (value && typeof value === "object") {
    body = Object.entries(value)
      .map(([child, v]) => {
        if (Array.isArray(v))
          return `<div class="resume-entry"><strong>${escapeHtml(titleCase(child))}</strong>${renderBulletList(v, `${path}.${child}`)}</div>`;
        return `<p>${escapeHtml(titleCase(child))}: ${renderFieldByKey(`${path}.${child}`, child, v)}</p>`;
      })
      .join("");
  } else
    body = `<p class="resume-summary" data-path="${escapeHtml(path)}">${escapeHtml(value)}</p>`;
  return sectionFrame(
    key,
    titleCase(key),
    body || `<div class="resume-entry-sub">Add details in the JSON editor</div>`,
  );
}
function additionalEntryFields(entry, path, excluded) {
  return Object.entries(entry)
    .filter(([key, value]) => !excluded.includes(key) && value != null && value !== "")
    .map(([key, value]) => {
      if (Array.isArray(value)) return renderBulletList(value, path + "." + key);
      if (value && typeof value === "object")
        return `<div class="resume-entry-sub">${renderObjectInline(value, path + "." + key)}</div>`;
      return `<div class="resume-entry-sub">${renderFieldByKey(path + "." + key, key, value)}</div>`;
    })
    .join("");
}
function structuredResumeHtml() {
  const basics = resume.basics && typeof resume.basics === "object" ? resume.basics : {};
  const selectedTemplate = templateById(resume.template);
  const template = effectiveTemplateId(selectedTemplate);
  const format = resume.format || {};
  const layout = resume.layout || {};
  const accent = /^#[0-9a-f]{6}$/i.test(format.accent || "") ? format.accent : "#496f91";
  const bullets = { disc: '"•"', dash: '"–"', square: '"▪"', arrow: '"›"' };
  const spacing = Math.min(48, Math.max(8, Number(layout.sectionSpacing) || 24));
  const sidebarWidth = Math.min(48, Math.max(22, Number(layout.sidebarWidth) || 31));
  const borderStyle = ["solid", "double", "dashed", "none"].includes(layout.borderStyle)
    ? layout.borderStyle
    : "solid";
  const pageBorder =
    layout.pageBorder === "accent"
      ? accent
      : layout.pageBorder === "hairline"
        ? "#dfe4e8"
        : "transparent";
  const font = escapeHtml(fontCss());
  const style = `--resume-accent:${accent};--resume-bullet:${bullets[format.bullet] || '"•"'};--resume-section-space:${spacing}px;--resume-border-width:${Math.min(4, Math.max(0, Number(layout.borderWidth) || 1))}px;--resume-border-style:${borderStyle};--resume-sidebar-width:${sidebarWidth}%;--resume-page-border:${pageBorder};font-family:${font};`;
  const contacts = ["email", "phone", "location", "url"]
    .filter((key) => basics[key])
    .map((key) =>
      key === "location"
        ? `<span class="contact-item" data-path="basics.${key}">${escapeHtml(basics[key])}</span>`
        : renderFieldByKey(`basics.${key}`, key, basics[key], "a", "contact-item"),
    )
    .join("");
  const header = `<header class="resume-header"><h1 class="resume-name" data-path="basics.name">${escapeHtml(basics.name || "Your Name")}</h1>${basics.label ? `<div class="resume-role" data-path="basics.label">${escapeHtml(basics.label)}</div>` : ""}<div class="resume-contact">${contacts}</div>${additionalEntryFields(basics, "basics", ["name", "label", "email", "phone", "location", "url"])}</header>`;
  const summary = sectionFrame(
    "summary",
    "Profile",
    resume.summary
      ? `<p class="resume-summary" data-path="summary">${escapeHtml(resume.summary)}</p>`
      : "",
  );
  const experienceBody = Array.isArray(resume.experience)
    ? resume.experience
        .map((entry, i) => {
          const path = `experience.${i}`;
          if (!entry || typeof entry !== "object")
            return `<div class="resume-entry"><p data-path="${escapeHtml(path)}">${escapeHtml(entry)}</p></div>`;
          const roleKey = entry.role != null ? "role" : entry.title != null ? "title" : "role";
          const dateKey = entry.dates != null ? "dates" : entry.date != null ? "date" : "dates";
          const highlightKey =
            entry.highlights != null
              ? "highlights"
              : entry.achievements != null
                ? "achievements"
                : "highlights";
          const companyLocation = [
            ["company", entry.company],
            ["location", entry.location],
          ]
            .filter(([, value]) => value)
            .map(([key, value]) => htmlField(`${path}.${key}`, value))
            .join(" · ");
          return `<div class="resume-entry"><div class="resume-entry-head"><strong class="resume-entry-title">${htmlField(`${path}.${roleKey}`, entry[roleKey] || "Role")}</strong>${htmlField(`${path}.${dateKey}`, entry[dateKey], "span", "resume-entry-date")}</div><div class="resume-entry-sub">${companyLocation}</div>${renderBulletList(entry[highlightKey] || [], `${path}.${highlightKey}`)}${additionalEntryFields(entry, path, ["role", "title", "company", "location", "dates", "date", "highlights", "achievements"])}</div>`;
        })
        .join("")
    : "";
  const experience = sectionFrame("experience", "Experience", experienceBody);
  const educationBody = Array.isArray(resume.education)
    ? resume.education
        .map((entry, i) => {
          const path = `education.${i}`;
          if (!entry || typeof entry !== "object")
            return `<div class="resume-entry"><p data-path="${escapeHtml(path)}">${escapeHtml(entry)}</p></div>`;
          const institutionKey =
            entry.institution != null
              ? "institution"
              : entry.school != null
                ? "school"
                : entry.name != null
                  ? "name"
                  : "institution";
          const dateKey = entry.dates != null ? "dates" : entry.date != null ? "date" : "dates";
          const degreeLocation = [
            ["degree", entry.degree],
            ["location", entry.location],
          ]
            .filter(([, value]) => value)
            .map(([key, value]) => htmlField(`${path}.${key}`, value))
            .join(" · ");
          return `<div class="resume-entry"><div class="resume-entry-head"><strong class="resume-entry-title">${htmlField(`${path}.${institutionKey}`, entry[institutionKey] || "Institution")}</strong>${htmlField(`${path}.${dateKey}`, entry[dateKey], "span", "resume-entry-date")}</div><div class="resume-entry-sub">${degreeLocation}</div>${additionalEntryFields(entry, path, ["institution", "school", "name", "dates", "date", "degree", "location"])}</div>`;
        })
        .join("")
    : "";
  const education = sectionFrame("education", "Education", educationBody);
  const skillsBody =
    Array.isArray(resume.skills) && resume.skills.length
      ? `<div class="resume-skills">${resume.skills.map((skill, i) => `<span class="skill-chip" data-path="skills.${i}">${escapeHtml(skill)}</span>`).join("")}</div>`
      : "";
  const skills = sectionFrame("skills", "Skills", skillsBody);
  const projectsBody = Array.isArray(resume.projects)
    ? resume.projects
        .map((item, i) => {
          const path = `projects.${i}`;
          if (!item || typeof item !== "object")
            return `<div class="resume-entry"><p data-path="${escapeHtml(path)}">${escapeHtml(item)}</p></div>`;
          const nameKey = item.name != null ? "name" : item.title != null ? "title" : "name";
          const descriptionKey =
            item.description != null
              ? "description"
              : item.summary != null
                ? "summary"
                : "description";
          return `<div class="resume-entry"><div class="resume-entry-head"><strong class="resume-entry-title">${htmlField(`${path}.${nameKey}`, item[nameKey] || "Project")}</strong>${item.url ? renderFieldByKey(`${path}.url`, "url", item.url, "span", "resume-entry-date") : ""}</div>${item[descriptionKey] ? `<div class="resume-entry-sub">${htmlField(`${path}.${descriptionKey}`, item[descriptionKey])}</div>` : ""}${additionalEntryFields(item, path, ["name", "title", "description", "summary", "url"])}</div>`;
        })
        .join("")
    : "";
  const projects = sectionFrame("projects", "Projects", projectsBody);
  const reserved = new Set([
    "template",
    "format",
    "layout",
    "basics",
    "summary",
    "experience",
    "education",
    "skills",
    "projects",
  ]);
  const extrasByKey = Object.fromEntries(
    Object.entries(resume)
      .filter(([key]) => !reserved.has(key) && !key.startsWith("_"))
      .map(([key, value]) => [key, renderGenericSection(key, value)])
      .filter(([, html]) => html),
  );
  const sectionHtml = { summary, experience, education, skills, projects, ...extrasByKey };
  const defaultOrder = [
    "summary",
    "experience",
    "education",
    "projects",
    "skills",
    ...Object.keys(extrasByKey),
  ];
  const savedOrder = Array.isArray(layout.order) ? layout.order : [];
  const order = [
    ...savedOrder.filter((key, i) => sectionHtml[key] && savedOrder.indexOf(key) === i),
    ...defaultOrder.filter((key) => !savedOrder.includes(key)),
  ];
  const orderedSections = order.map((key) => sectionHtml[key]).join("");
  const customTemplate = customTemplates.find((item) => item.id === selectedTemplate.id);
  const styleNode =
    $("#customTemplateStyle") ||
    (() => {
      const node = document.createElement("style");
      node.id = "customTemplateStyle";
      document.head.appendChild(node);
      return node;
    })();
  styleNode.textContent = customTemplate?.css || "";
  if (template === "executive") {
    const sidebarSections = new Set(
      Array.isArray(layout.sidebarSections) ? layout.sidebarSections : ["skills", "languages"],
    );
    const aside = order
      .filter((key) => sidebarSections.has(key))
      .map((key) => sectionHtml[key])
      .join("");
    const main = order
      .filter((key) => !sidebarSections.has(key))
      .map((key) => sectionHtml[key])
      .join("");
    return `<article class="resume-paper" data-template="${escapeHtml(template)}" data-variant="${escapeHtml(selectedTemplate.variant || selectedTemplate.id)}" style="${style}"><aside class="resume-aside"><div class="drop-zone" data-zone="sidebar">${header}${aside}</div></aside><div class="sidebar-resizer" role="separator" aria-label="Resize sidebar" tabindex="0"></div><div class="resume-main"><div class="drop-zone" data-zone="main">${main}</div></div></article>`;
  }
  return `<article class="resume-paper" data-template="${escapeHtml(template)}" data-variant="${escapeHtml(selectedTemplate.variant || selectedTemplate.id)}" style="${style}"><div class="drop-zone" data-zone="main">${header}${orderedSections}</div></article>`;
}

const latexScroll = $("#latexScroll");
latexScroll.appendChild(latexHighlight);
latexScroll.appendChild(latexEditor);
function latexEscape(value) {
  const escapes = {
    "\\": "\\textbackslash{}",
    "{": "\\{",
    "}": "\\}",
    "#": "\\#",
    $: "\\$",
    "%": "\\%",
    "&": "\\&",
    _: "\\_",
    "~": "\\textasciitilde{}",
    "^": "\\textasciicircum{}",
  };
  return String(value ?? "").replace(/[\\{}#$%&_~^]/g, (char) => escapes[char]);
}
function cvField(path, value) {
  return `\\CVField{${path}}{${latexEscape(value)}}`;
}
function refreshLatexTemplate(source, data) {
  const pattern = /\\CVField\{([^{}]+)\}\{/g;
  let match,
    cursor = 0,
    output = "";
  while ((match = pattern.exec(source))) {
    let scan = pattern.lastIndex,
      depth = 0,
      end = -1;
    for (; scan < source.length; scan++) {
      const char = source[scan];
      if (char === "\\") {
        scan++;
        continue;
      }
      if (char === "{") depth++;
      else if (char === "}") {
        if (depth === 0) {
          end = scan;
          break;
        }
        depth--;
      }
    }
    if (end < 0) continue;
    const currentValue = source.slice(pattern.lastIndex, end);
    const value = pathGet(data, match[1]);
    const replacement = value == null ? currentValue : latexEscape(value);
    output += source.slice(cursor, pattern.lastIndex) + replacement;
    cursor = end;
    pattern.lastIndex = end + 1;
  }
  let refreshed = output + source.slice(cursor);
  const paper = paperSize(data);
  refreshed = refreshed.replace(
    /(\\documentclass\[[^\]]*)\b(?:a4|a5|letter|legal)paper\b/g,
    (match, prefix) => {
      return prefix.replace(/(?:a4|a5|letter|legal)paper/g, paper.latex) + paper.latex;
    },
  );
  const accent = /^#[0-9a-f]{6}$/i.test(data.format?.accent || "")
    ? data.format.accent.slice(1).toUpperCase()
    : "496F91";
  const bulletLabel =
    data.format?.bullet === "dash"
      ? "\\textendash"
      : data.format?.bullet === "square"
        ? "$\\blacksquare$"
        : data.format?.bullet === "arrow"
          ? "$\\triangleright$"
          : "$\\bullet$";
  const font = data.format?.font || "Arial";
  const fontPackage =
    font === "Times New Roman"
      ? "\\usepackage{mathptmx}"
      : font === "Georgia"
        ? "\\usepackage{tgpagella}"
        : font === "Verdana"
          ? "\\usepackage{tgheros}"
          : "\\usepackage{helvet}";
  refreshed = refreshed.replace(
    /\\definecolor\{ResumeAccent\}\{HTML\}\{[0-9a-f]{6}\}/gi,
    "\\definecolor{ResumeAccent}{HTML}{" + accent + "}",
  );
  refreshed = refreshed.replace(
    /(\\setlist\[itemize\]\{[^\n]*?\blabel=)[^}]+/g,
    (match, prefix) => prefix + bulletLabel,
  );
  refreshed = refreshed.replace(
    /\\usepackage\{(?:mathptmx|tgpagella|helvet|tgheros)\}/,
    fontPackage,
  );
  refreshed = refreshed.replace(/\\renewcommand\{\\familydefault\}\{\\sfdefault\}\s*/g, "");
  if (font === "Arial" || font === "Verdana")
    refreshed = refreshed.replace(
      fontPackage,
      fontPackage + "\n\\renewcommand{\\familydefault}{\\sfdefault}",
    );
  const present = new Set(
    [...refreshed.matchAll(/\\CVField\{([^{}]+)\}/g)].map((match) => match[1]),
  );
  const missing = [];
  const visit = (value, path) => {
    if (value && typeof value === "object") {
      Object.entries(value).forEach(([key, child]) => visit(child, path ? path + "." + key : key));
    } else if (value != null && value !== "" && !present.has(path)) missing.push([path, value]);
  };
  Object.entries(data)
    .filter(([key]) => !["template", "format", "layout"].includes(key) && !key.startsWith("_"))
    .forEach(([key, value]) => visit(value, key));
  if (missing.length) {
    const extra =
      "\n\\section*{Additional fields}\n" +
      missing
        .map(
          ([path, value]) =>
            "\\textbf{" +
            latexEscape(titleCase(path.split(".").at(-1))) +
            "}: " +
            cvField(path, value) +
            "\\\\",
        )
        .join("\n") +
      "\n";
    refreshed = refreshed.replace(/\\end\{document\}/, () => extra + "\\end{document}");
  }
  return refreshed;
}
function latexSource() {
  if (resume.layout?.richDocument) return richLatexSource();
  if (typeof resume.format?.latexTemplate === "string" && resume.format.latexTemplate)
    return refreshLatexTemplate(resume.format.latexTemplate, resume);
  {
    const b = resume.basics || {};
    const format = resume.format || {};
    const layout = resume.layout || {};
    const accent = /^#[0-9a-f]{6}$/i.test(format.accent || "")
      ? format.accent.slice(1).toUpperCase()
      : "496F91";
    const fontPackage =
      format.font === "Times New Roman"
        ? "\\usepackage{mathptmx}"
        : format.font === "Georgia"
          ? "\\usepackage{tgpagella}"
          : format.font === "Verdana"
            ? "\\usepackage{tgheros}\n\\renewcommand{\\familydefault}{\\sfdefault}"
            : "\\usepackage{helvet}\n\\renewcommand{\\familydefault}{\\sfdefault}";
    const bulletLabel =
      format.bullet === "dash"
        ? "\\textendash"
        : format.bullet === "square"
          ? "$\\blacksquare$"
          : format.bullet === "arrow"
            ? "$\\triangleright$"
            : "$\\bullet$";
    const ruleWidth = Math.max(0.5, Math.min(4, Number(layout.borderWidth) || 1));
    const titleRule =
      layout.borderStyle === "none"
        ? ""
        : layout.borderStyle === "double"
          ? "[\\titlerule[" + ruleWidth + "pt]\\vspace{1pt}\\titlerule[" + ruleWidth + "pt]]"
          : layout.borderStyle === "dashed"
            ? "[\\makebox[\\linewidth]{\\leaders\\hbox{\\rule{2pt}{" +
              ruleWidth +
              "pt}\\hspace{2pt}}\\hfill}]"
            : "[\\titlerule[" + ruleWidth + "pt]]";
    const sectionSpacing = Math.max(8, Math.min(48, Number(layout.sectionSpacing) || 24));
    const sectionTitle = (key, label) =>
      "\\section*{\\textcolor{ResumeAccent}{" +
      cvField("layout.sectionTitles." + key, layout.sectionTitles?.[key] || label) +
      "}}";
    const linkedField = (path, key, value) => {
      const linkable = /^(url|website|link|email|phone|tel)$/i.test(key);
      if (!linkable) return cvField(path, value);
      const target = safeLink(value, key);
      return "\\href{" + latexEscape(target) + "}{" + cvField(path, value) + "}";
    };
    const lines = [
      `% draft:resume ${encodeURIComponent(JSON.stringify({ ...resume, format: { ...resume.format, latexTemplate: undefined } }))}`,
      "% Résumé 2.0 resume source — edit CVField values; changes sync back to resume.json.",
      `\\documentclass[10pt,${paperSize().latex}]{article}`,
      "\\usepackage[margin=0.72in]{geometry}",
      "\\usepackage[T1]{fontenc}",
      "\\usepackage[utf8]{inputenc}",
      "\\usepackage{xcolor}",
      "\\usepackage{enumitem}",
      "\\usepackage{hyperref}",
      "\\usepackage{titlesec}",
      "\\usepackage{eso-pic}",
      fontPackage,
      "\\definecolor{ResumeAccent}{HTML}{" + accent + "}",
      "\\titleformat{\\section}{\\large\\bfseries\\color{ResumeAccent}}{}{0pt}{}" + titleRule,
      "\\titlespacing*{\\section}{0pt}{" + sectionSpacing + "pt}{5pt}",
      "\\newcommand{\\CVField}[2]{#2}",
      "\\pagestyle{empty}",
      "\\setlength{\\parindent}{0pt}",
      "\\setlist[itemize]{leftmargin=1.2em,itemsep=1pt,topsep=3pt,label=" + bulletLabel + "}",
      "\\begin{document}",
      "\\begin{center}{\\LARGE\\bfseries " + cvField("basics.name", b.name || "") + "}\\\\[3pt]",
    ];
    if (["accent", "hairline"].includes(layout.pageBorder)) {
      const pageBorderColor = layout.pageBorder === "accent" ? "ResumeAccent" : "black!18";
      lines.splice(
        lines.indexOf("\\begin{document}"),
        0,
        "\\setlength{\\fboxrule}{" + ruleWidth + "pt}",
        "\\AddToShipoutPictureBG{\\AtPageLowerLeft{\\put(20,20){\\color{" +
          pageBorderColor +
          "}\\framebox(572,752){}}}}",
      );
    }
    if (b.label)
      lines.push("\\textcolor{ResumeAccent}{" + cvField("basics.label", b.label) + "}\\\\[4pt]");
    const contactKeys = ["email", "phone", "location", "url"].filter((key) => b[key]);
    lines.push(
      contactKeys.map((key) => linkedField("basics." + key, key, b[key])).join(" $\\cdot$ ") +
        "\\end{center}",
    );
    lines.push("\\vspace{3pt}\\hrule\\vspace{9pt}");
    const sectionBuilders = {};
    if (resume.summary)
      sectionBuilders.summary = () =>
        lines.push(
          sectionTitle("summary", "Profile"),
          cvField("summary", resume.summary),
          "\\vspace{3pt}",
        );
    const addEntries = (key, title, entries, fields, bulletKey) => {
      if (!Array.isArray(entries) || !entries.length) return;
      sectionBuilders[key] = () => {
        lines.push(sectionTitle(key, title));
        entries.forEach((entry, index) => {
          const path = key + "." + index;
          if (!entry || typeof entry !== "object") {
            lines.push(cvField(path, entry));
            return;
          }
          const titleKey = fields.find((field) => entry[field] != null) || fields[0];
          const titleValue =
            entry[titleKey] == null
              ? ""
              : linkedField(path + "." + titleKey, titleKey, entry[titleKey]);
          const dateKey = ["dates", "date", "year"].find((field) => entry[field] != null);
          const subtitleFields = fields.filter(
            (field) => field !== titleKey && entry[field] != null && entry[field] !== "",
          );
          lines.push(
            "\\textbf{" +
              titleValue +
              "}" +
              (dateKey
                ? "\\hfill " + linkedField(path + "." + dateKey, dateKey, entry[dateKey])
                : "") +
              "\\\\",
          );
          if (subtitleFields.length)
            lines.push(
              subtitleFields
                .map((field) => linkedField(path + "." + field, field, entry[field]))
                .join(" — ") + "\\\\",
            );
          const descriptionKey = ["description", "summary"].find((field) => entry[field] != null);
          if (descriptionKey)
            lines.push(cvField(path + "." + descriptionKey, entry[descriptionKey]) + "\\\\");
          const bullets = entry[bulletKey] || entry.achievements || [];
          if (Array.isArray(bullets) && bullets.length) {
            lines.push("\\begin{itemize}");
            bullets.forEach((item, itemIndex) =>
              lines.push(
                "\\item " +
                  cvField(
                    path + "." + (entry[bulletKey] ? bulletKey : "achievements") + "." + itemIndex,
                    item,
                  ),
              ),
            );
            lines.push("\\end{itemize}");
          } else lines.push("\\vspace{4pt}");
        });
      };
    };
    addEntries(
      "experience",
      "Experience",
      resume.experience,
      ["role", "title", "company", "location"],
      "highlights",
    );
    addEntries(
      "education",
      "Education",
      resume.education,
      ["institution", "school", "name", "degree", "location"],
      null,
    );
    addEntries("projects", "Projects", resume.projects, ["name", "title", "url"], null);
    if (Array.isArray(resume.skills) && resume.skills.length) {
      sectionBuilders.skills = () =>
        lines.push(
          sectionTitle("skills", "Skills"),
          resume.skills.map((skill, index) => cvField("skills." + index, skill)).join(" $\\cdot$ "),
        );
    }
    const reserved = new Set([
      "template",
      "format",
      "layout",
      "basics",
      "summary",
      "experience",
      "education",
      "skills",
      "projects",
    ]);
    for (const [key, value] of Object.entries(resume)) {
      if (reserved.has(key) || key.startsWith("_") || value == null || value === "") continue;
      if (typeof value === "string" || typeof value === "number") {
        sectionBuilders[key] = () =>
          lines.push(sectionTitle(key, titleCase(key)), cvField(key, value));
      } else if (Array.isArray(value) && value.length) {
        sectionBuilders[key] = () => {
          lines.push(sectionTitle(key, titleCase(key)), "\\begin{itemize}");
          value.forEach((item, index) => {
            const path = key + "." + index;
            if (item && typeof item === "object") {
              const fields = Object.entries(item).filter(
                ([, child]) => child != null && typeof child !== "object",
              );
              lines.push(
                "\\item " +
                  fields
                    .map(
                      ([childKey, child]) =>
                        cvField(
                          "layout.fieldTitles." + key + "." + childKey,
                          layout.fieldTitles?.[key]?.[childKey] || titleCase(childKey),
                        ) +
                        ": " +
                        linkedField(path + "." + childKey, childKey, child),
                    )
                    .join("; "),
              );
              for (const [childKey, child] of Object.entries(item))
                if (Array.isArray(child))
                  child.forEach((entry, childIndex) =>
                    lines.push(
                      "\\item " +
                        linkedField(path + "." + childKey + "." + childIndex, childKey, entry),
                    ),
                  );
            } else lines.push("\\item " + cvField(path, item));
          });
          lines.push("\\end{itemize}");
        };
      } else if (value && typeof value === "object") {
        sectionBuilders[key] = () => {
          lines.push(sectionTitle(key, titleCase(key)));
          for (const [childKey, child] of Object.entries(value))
            if (child == null || typeof child !== "object")
              lines.push(
                cvField(
                  "layout.fieldTitles." + key + "." + childKey,
                  layout.fieldTitles?.[key]?.[childKey] || titleCase(childKey),
                ) +
                  ": " +
                  linkedField(key + "." + childKey, childKey, child) +
                  "\\\\",
              );
        };
      }
    }
    const defaultOrder = [
      "summary",
      "experience",
      "education",
      "projects",
      "skills",
      ...Object.keys(sectionBuilders).filter(
        (key) => !["summary", "experience", "education", "projects", "skills"].includes(key),
      ),
    ];
    const savedOrder = Array.isArray(layout.order) ? layout.order : [];
    const order = [
      ...savedOrder.filter(
        (key, index) => sectionBuilders[key] && savedOrder.indexOf(key) === index,
      ),
      ...defaultOrder.filter((key) => !savedOrder.includes(key)),
    ];
    order.forEach((key) => sectionBuilders[key]?.());
    lines.push("\\end{document}");
    return lines.join("\n");
  }
}
function latexUnescape(value) {
  return value
    .replace(/\\textbackslash\{\}/g, "\\")
    .replace(/\\textasciitilde\{\}/g, "~")
    .replace(/\\textasciicircum\{\}/g, "^")
    .replace(/\\([{}#$%&_])/g, "$1");
}
function parseLatexFields(source, base = resume) {
  const snapshot = /^% draft:resume ([^\n]+)/m.exec(source);
  if (snapshot) {
    const value = JSON.parse(decodeURIComponent(snapshot[1]));
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw new Error("Invalid resume snapshot in LaTeX");
    base = value;
  }
  const pattern = /\\CVField\{([^{}]+)\}\{/g;
  let match,
    next = deepClone(base),
    count = 0;
  while ((match = pattern.exec(source))) {
    let cursor = pattern.lastIndex,
      depth = 0,
      end = -1;
    for (; cursor < source.length; cursor++) {
      const char = source[cursor];
      if (char === "\\") {
        cursor++;
        continue;
      }
      if (char === "{") depth++;
      else if (char === "}") {
        if (depth === 0) {
          end = cursor;
          break;
        }
        depth--;
      }
    }
    if (end < 0) throw new Error("Unclosed CVField value");
    const raw = latexUnescape(source.slice(pattern.lastIndex, end)),
      original = pathGet(next, match[1]);
    let value = raw;
    if (original === null && raw === "") value = null;
    else if (typeof original === "number" && raw !== "" && Number.isFinite(Number(raw)))
      value = Number(raw);
    else if (typeof original === "boolean" && /^(true|false)$/.test(raw)) value = raw === "true";
    pathSet(next, match[1], value);
    count++;
    pattern.lastIndex = end + 1;
  }
  const paperOptions =
    /\\documentclass\[([^\]]+)\]/
      .exec(source)?.[1]
      ?.split(",")
      .map((value) => value.trim()) || [];
  const parsedPaper = Object.entries(PAPER_SIZES).find(([, paper]) =>
    paperOptions.includes(paper.latex),
  );
  if (parsedPaper) next.layout = { ...(next.layout || {}), paperSize: parsedPaper[0] };
  const color = /\\definecolor\{ResumeAccent\}\{HTML\}\{([0-9a-f]{6})\}/i.exec(source);
  next.format = { ...(next.format || {}) };
  if (color) next.format.accent = "#" + color[1];
  const list = /\\setlist\[itemize\]\{([^\n]+)/.exec(source)?.[1] || "";
  if (list.includes("textendash")) next.format.bullet = "dash";
  else if (list.includes("blacksquare")) next.format.bullet = "square";
  else if (list.includes("triangleright")) next.format.bullet = "arrow";
  else if (list.includes("bullet")) next.format.bullet = "disc";
  const spacing = /\\titlespacing\*?\{\\section\}\{[^}]*\}\{([0-9.]+)pt\}/.exec(source);
  if (spacing) next.layout = { ...(next.layout || {}), sectionSpacing: Number(spacing[1]) };
  if (source.includes("\\usepackage{mathptmx}")) next.format.font = "Times New Roman";
  else if (source.includes("\\usepackage{tgpagella}")) next.format.font = "Georgia";
  else if (source.includes("\\usepackage{tgheros}")) next.format.font = "Verdana";
  else if (source.includes("\\usepackage{helvet}")) next.format.font = "Arial";
  next.format.latexTemplate = source;
  return { data: next, count };
}
function latexSkeleton(source) {
  return source.replace(/(\\CVField\{[^{}]+\}\{)(?:\\.|[^{}]|\{[^{}]*\})*\}/g, "$1VALUE}");
}
function updateFromLatex(source) {
  sourceState.latexError = null;
  try {
    const parsed = parseLatexFields(source);
    if (!parsed.count) return false;
    if (
      !resume.format?.latexTemplate &&
      latexSkeleton(source) === latexSkeleton(latexSourceBeforeEdit)
    )
      delete parsed.data.format.latexTemplate;
    resume = parsed.data;
    updateJsonEditor();
    renderOutput();
    setJsonStatus("LaTeX fields and supported styles synced");
    return true;
  } catch (error) {
    sourceState.latexError = error;
    setJsonStatus(error.message, true);
    persistResume();
    return false;
  }
}

function normalizeText(value) {
  return String(value ?? "")
    .replace(/\r/g, "")
    .trim();
}
function contentEditableChanged(node) {
  if (restoringHistory || !node.isConnected) return;
  const path = node.dataset.path;
  if (!path) return;
  if (sourceDraftError()) {
    renderOutput();
    toast("Correct the source draft before editing the document.");
    return;
  }
  const jsonError = latestJsonError;
  const value =
    node.dataset.chunked === "true"
      ? $$(`[data-path="${CSS.escape(path)}"][data-chunked="true"]`, $("#previewBody"))
          .map((piece) => normalizeText(piece.innerText))
          .join(" ")
      : normalizeText(node.innerText);
  const original = pathGet(resume, path);
  pathSet(
    resume,
    path,
    typeof original === "number" && value.trim() && Number.isFinite(Number(value))
      ? Number(value)
      : typeof original === "boolean" && /^(true|false)$/.test(value)
        ? value === "true"
        : value,
  );
  updateJsonEditor();
  renderOutput();
  if (jsonError) setJsonStatus(jsonError.message, true);
  else setJsonStatus("Output changes synced · JSON updated");
}
function saveFieldStyle(name, value) {
  if (sourceDraftError()) return toast("Correct the source draft before formatting the document.");
  if (!activeFormatPath) return;
  const layout = { ...(resume.layout || {}) };
  const fieldStyles = { ...(layout.fieldStyles || {}) };
  const current = { ...(fieldStyles[activeFormatPath] || {}) };
  if (value == null || value === "") delete current[name];
  else current[name] = value;
  if (Object.keys(current).length) fieldStyles[activeFormatPath] = current;
  else delete fieldStyles[activeFormatPath];
  if (Object.keys(fieldStyles).length) layout.fieldStyles = fieldStyles;
  else delete layout.fieldStyles;
  resume.layout = layout;
  updateJsonEditor();
  renderOutput();
  setJsonStatus("Formatting saved · PDF, Word, and JSON updated");
}
function showFormatPane(node) {
  if (!node?.dataset?.path) return;
  activeFormatPath = node.dataset.path;
  const style = fieldStyle(activeFormatPath);
  const computed = getComputedStyle(node);
  const rgb = computed.color.match(/\d+/g)?.slice(0, 3).map(Number) || [38, 50, 60];
  const hex = "#" + rgb.map((channel) => channel.toString(16).padStart(2, "0")).join("");
  const computedFamily = computed.fontFamily.split(",")[0].replace(/["']/g, "").trim();
  const lineRatio = parseFloat(computed.lineHeight) / Math.max(1, parseFloat(computed.fontSize));
  const lineOptions = [1.2, 1.45, 1.7, 2];
  const defaultLineHeight = lineOptions.reduce(
    (best, value) => (Math.abs(value - lineRatio) < Math.abs(best - lineRatio) ? value : best),
    lineOptions[0],
  );
  $("#formatTarget").textContent = activeFormatPath;
  $("#fieldRole").value =
    style.role || (node.matches("h1") ? "title" : node.matches("h2") ? "heading2" : "normal");
  $("#fieldFont").value =
    style.fontFamily ||
    (["Arial", "Georgia", "Verdana", "Times New Roman"].includes(computedFamily)
      ? computedFamily
      : resume.format?.font || "Arial");
  $("#fieldSize").value =
    style.fontSize || String(Math.round(parseFloat(computed.fontSize) * 0.75 * 2) / 2);
  $("#fieldColor").value = style.color || hex;
  $("#fieldHighlight").value = style.highlight || "#fff1a8";
  $("#fieldBorder").value = style.borderStyle || "none";
  $("#fieldAlign").value =
    style.textAlign ||
    (["left", "center", "right"].includes(computed.textAlign) ? computed.textAlign : "left");
  $("#fieldLineHeight").value = style.lineHeight || String(defaultLineHeight);
  $("#fieldBefore").value = style.spaceBefore ?? "";
  $("#fieldAfter").value = style.spaceAfter ?? "";
  $("#fieldBold").setAttribute(
    "aria-pressed",
    String(style.fontWeight ? style.fontWeight === "bold" : Number(computed.fontWeight) >= 600),
  );
  $("#fieldItalic").setAttribute(
    "aria-pressed",
    String(style.fontStyle ? style.fontStyle === "italic" : computed.fontStyle === "italic"),
  );
  $("#fieldUnderline").setAttribute(
    "aria-pressed",
    String(
      style.underline != null ? style.underline : computed.textDecorationLine.includes("underline"),
    ),
  );
  $("#formatPane").classList.remove("hidden");
  $("#formatPane").setAttribute("aria-hidden", "false");
}
function closeFormatPane() {
  $("#formatPane").classList.add("hidden");
  $("#formatPane").setAttribute("aria-hidden", "true");
  activeFormatPath = "";
}
function toggleFieldFormat(buttonId, name, onValue, offValue) {
  const button = $("#" + buttonId);
  const active = button.getAttribute("aria-pressed") === "true";
  const value = active ? offValue : onValue;
  button.setAttribute("aria-pressed", String(!active));
  saveFieldStyle(name, value);
}
function setWhyPage(show) {
  if (show) closeFormatPane();
  if (!show) {
    pauseWalkthrough();
    expandWalkthrough(false);
  }
  $(".app").classList.toggle("hidden", show);
  configureVirtualKeyboard();
  $("#whyJsonPage").classList.toggle("hidden", !show);
  document.title = show ? "Why JSON? — Résumé 2.0" : "Résumé 2.0";
}
function updateBenchmarkFileStatus() {
  const pdf = $("#benchmarkPdfFile").files[0];
  const json = $("#benchmarkJsonFile").files[0];
  $("#runBenchmarkButton").disabled = !pdf || !json;
  $("#benchmarkFileStatus").textContent =
    pdf && json
      ? `${pdf.name} + ${json.name} · local only`
      : "Choose a PDF or Word file and reference JSON";
}
async function extractTextFromPdf(file, restoreSource = true) {
  if (!window.pdfjsLib)
    throw new Error("PDF reader could not load. Keep the assets folder beside index.html.");
  const task = pdfjsLib.getDocument({
    data: new Uint8Array(await file.arrayBuffer()),
    isEvalSupported: false,
    useSystemFonts: true,
    disableFontFace: true,
  });
  let pdf;
  try {
    pdf = await task.promise;
    const pages = [];
    for (let index = 1; index <= pdf.numPages; index++) {
      const page = await pdf.getPage(index),
        content = await page.getTextContent();
      const rows = [];
      for (const item of content.items
        .filter((item) => item.str?.trim())
        .sort((a, b) => b.transform[5] - a.transform[5])) {
        const y = item.transform[5];
        let row = rows.at(-1);
        if (!row || Math.abs(row.y - y) > Math.max(2, item.height * 0.35)) {
          row = { y, items: [] };
          rows.push(row);
        }
        row.items.push(item);
      }
      pages.push(
        rows
          .map((row) =>
            row.items
              .sort((a, b) => a.transform[4] - b.transform[4])
              .map((item, i, items) => {
                const previous = items[i - 1];
                const gap = previous
                  ? item.transform[4] - previous.transform[4] - previous.width
                  : 0;
                return (previous && gap > Math.max(1, item.height * 0.12) ? " " : "") + item.str;
              })
              .join(""),
          )
          .join("\n"),
      );
    }
    const text = pages.join("\n\n").trim();
    let resumeData = null;
    const attachments = restoreSource ? await pdf.getAttachments() : null;
    const attached =
      attachments &&
      Object.values(attachments).find((item) => item.filename === "forma-resume.json");
    if (attached) {
      try {
        const value = JSON.parse(new TextDecoder().decode(attached.content));
        if (value && typeof value === "object" && !Array.isArray(value)) resumeData = value;
      } catch {}
    }
    return {
      text,
      resumeData,
      problems: text ? [] : ["No selectable text found. Scanned resumes need OCR."],
      pages: pdf.numPages,
    };
  } finally {
    if (pdf) await pdf.destroy();
    else await task.destroy();
  }
}

async function extractTextFromDocx(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const read32 = (offset) => view.getUint32(offset, true);
  let end = -1;
  for (let offset = bytes.length - 22; offset >= Math.max(0, bytes.length - 65558); offset--) {
    if (read32(offset) === 0x06054b50) {
      end = offset;
      break;
    }
  }
  if (end < 0) throw new Error("This file is not a readable .docx document.");
  const entries = view.getUint16(end + 10, true);
  let cursor = view.getUint32(end + 16, true);
  let xmlBytes = null,
    resumeData = null;
  const supplementaryParts = [];
  const decoder = new TextDecoder();
  for (let index = 0; index < entries; index++) {
    if (read32(cursor) !== 0x02014b50) break;
    const method = view.getUint16(cursor + 10, true);
    const compressedSize = read32(cursor + 20);
    const nameLength = view.getUint16(cursor + 28, true);
    const extraLength = view.getUint16(cursor + 30, true);
    const commentLength = view.getUint16(cursor + 32, true);
    const localOffset = read32(cursor + 42);
    const name = decoder.decode(bytes.subarray(cursor + 46, cursor + 46 + nameLength));
    if (
      name === "word/document.xml" ||
      name === "forma/resume.json" ||
      /^word\/(?:header\d+|footer\d+|footnotes|endnotes)\.xml$/.test(name)
    ) {
      const localName = view.getUint16(localOffset + 26, true);
      const localExtra = view.getUint16(localOffset + 28, true);
      const start = localOffset + 30 + localName + localExtra;
      const packed = bytes.subarray(start, start + compressedSize);
      let unpacked;
      if (method === 0) unpacked = packed;
      else if (method === 8 && typeof DecompressionStream !== "undefined") {
        unpacked = new Uint8Array(
          await new Response(
            new Blob([packed]).stream().pipeThrough(new DecompressionStream("deflate-raw")),
          ).arrayBuffer(),
        );
      } else
        throw new Error(
          "Save the Word file using standard DOCX compression, then import it again.",
        );
      if (name === "word/document.xml") xmlBytes = unpacked;
      else if (name === "forma/resume.json") {
        try {
          const value = JSON.parse(decoder.decode(unpacked));
          if (value && typeof value === "object" && !Array.isArray(value)) resumeData = value;
        } catch {}
      } else supplementaryParts.push({ name, bytes: unpacked });
    }
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  if (!xmlBytes) throw new Error("The .docx file does not contain a readable document body.");
  const documentXml = new DOMParser().parseFromString(decoder.decode(xmlBytes), "application/xml");
  if (documentXml.querySelector("parsererror"))
    throw new Error("The .docx document body is malformed.");
  return {
    text: [
      ...supplementaryParts.filter((part) => /^word\/header/.test(part.name)),
      { document: documentXml },
      ...supplementaryParts.filter((part) => !/^word\/header/.test(part.name)),
    ]
      .map(
        (part) =>
          part.document ||
          new DOMParser().parseFromString(decoder.decode(part.bytes), "application/xml"),
      )
      .flatMap((part) => [
        ...part.getElementsByTagNameNS(
          "http://schemas.openxmlformats.org/wordprocessingml/2006/main",
          "p",
        ),
      ])
      .map((paragraph) =>
        [
          ...paragraph.getElementsByTagNameNS(
            "http://schemas.openxmlformats.org/wordprocessingml/2006/main",
            "t",
          ),
        ]
          .map((node) => node.textContent)
          .join("")
          .trim(),
      )
      .filter(Boolean)
      .join("\n"),
    resumeData,
  };
}
function parseResumeText(source) {
  return ResumeParser.parseText(source);
}
async function readArchiveEntry(file, predicate) {
  const bytes = new Uint8Array(await file.arrayBuffer()),
    view = new DataView(bytes.buffer);
  if (bytes.length < 22) throw new Error("Incomplete ZIP archive");
  let end = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65558); i--)
    if (view.getUint32(i, true) === 0x06054b50) {
      end = i;
      break;
    }
  if (end < 0) throw new Error("Not a readable ZIP archive");
  let cursor = view.getUint32(end + 16, true);
  const count = view.getUint16(end + 10, true),
    decoder = new TextDecoder();
  for (let i = 0; i < count; i++) {
    if (cursor + 46 > bytes.length || view.getUint32(cursor, true) !== 0x02014b50)
      throw new Error("Invalid ZIP directory");
    const method = view.getUint16(cursor + 10, true),
      size = view.getUint32(cursor + 20, true),
      unpackedSize = view.getUint32(cursor + 24, true),
      nl = view.getUint16(cursor + 28, true),
      el = view.getUint16(cursor + 30, true),
      cl = view.getUint16(cursor + 32, true),
      offset = view.getUint32(cursor + 42, true),
      name = decoder.decode(bytes.subarray(cursor + 46, cursor + 46 + nl));
    if (predicate(name)) {
      if (unpackedSize > 20 * 1024 * 1024) throw new Error("Archive entry exceeds 20 MB");
      const start =
          offset + 30 + view.getUint16(offset + 26, true) + view.getUint16(offset + 28, true),
        packed = bytes.subarray(start, start + size);
      let result;
      if (method === 0) result = packed;
      else if (method === 8)
        result = new Uint8Array(
          await new Response(
            new Blob([packed]).stream().pipeThrough(new DecompressionStream("deflate-raw")),
          ).arrayBuffer(),
        );
      else throw new Error("Unsupported ZIP compression");
      if (result.length > 20 * 1024 * 1024) throw new Error("Archive entry exceeds 20 MB");
      return { name, bytes: result, text: decoder.decode(result) };
    }
    cursor += 46 + nl + el + cl;
  }
  return null;
}
async function detectResumeFormat(file) {
  const bytes = new Uint8Array(await file.slice(0, 4096).arrayBuffer()),
    text = new TextDecoder()
      .decode(bytes)
      .replace(/^\uFEFF/, "")
      .trimStart();
  if (text.startsWith("%PDF-")) return "pdf";
  if (bytes[0] === 0x50 && bytes[1] === 0x4b) {
    const entry = await readArchiveEntry(file, (name) => name === "word/document.xml");
    return entry ? "docx" : "zip";
  }
  if (text.startsWith("{")) return "json";
  if (/^(?:<!doctype\s+html|<html|<head|<body)/i.test(text) || /\.html?$/i.test(file.name))
    return "html";
  if (/^<\?xml|^<resume(?:\s|>)/i.test(text) || /\.xml$/i.test(file.name)) return "xml";
  if (/\\(?:documentclass|begin\{document\}|CVField\{|section\*?\{)/.test(text)) return "tex";
  if (/^#{1,6}\s|<!--\s*forma:|^[-*]\s/m.test(text) || /\.(md|markdown)$/i.test(file.name))
    return "md";
  if (/\.(tex|latex)$/i.test(file.name)) return "tex";
  if (/\.css$/i.test(file.name)) return "css";
  return "txt";
}
async function importResumeFile(file) {
  if (!file) return;
  if (file.size > 100 * 1024 * 1024) {
    toast("Choose a file under 100 MB");
    return;
  }
  const button = $("#importResumeButton");
  button.disabled = true;
  try {
    const extension = await detectResumeFormat(file);
    if (extension !== "zip" && file.size > 15 * 1024 * 1024)
      throw new Error(
        "Choose an individual document under 15 MB; session ZIPs can be up to 100 MB.",
      );
    let parsed,
      raw = "",
      notes = [`Detected ${extension.toUpperCase()} from file contents.`];
    const empty = {
      template: resume.template || "modern",
      format: deepClone(resume.format || {}),
      basics: {},
      layout: {},
    };
    delete empty.format.latexTemplate;
    if (extension === "zip") {
      if (await inspectSessionArchive(file)) return;
      const entry = await readArchiveEntry(
        file,
        (name) =>
          /(^|\/)resume\.json$/.test(name) ||
          (/\.json$/i.test(name) && !/(template|manifest)/i.test(name)),
      );
      if (!entry)
        throw new Error("No resume JSON found in the ZIP. Import a Résumé 2.0 export bundle.");
      raw = entry.text;
      parsed = JSON.parse(raw);
      notes.push("Restored the structured resume from the bundle.");
    } else if (extension === "json") {
      raw = await file.text();
      parsed = ResumeFormats.assertModel(JSON.parse(raw));
      if (parsed.format === "resume20.session") {
        showSessionImport(parsed.workspace, parsed.templates || [], file.name, parsed.settings);
        return;
      }
      if (ResumeFormats.isJsonResume(parsed)) {
        parsed = ResumeFormats.fromJsonResume(parsed);
        notes.push("Mapped JSON Resume fields; layout extensions are kept separately.");
      }
      if (parsed.seed && parsed.name && !parsed.basics) {
        parsed = parsed.seed;
        notes.push("Imported content defaults from template JSON.");
      }
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
        throw new Error("Resume JSON must contain an object.");
    } else if (extension === "xml") {
      raw = await file.text();
      parsed = ResumeFormats.fromXml(raw);
    } else if (extension === "html") {
      raw = await file.text();
      parsed = importHtmlResume(raw);
      notes.push("HTML content imported. Review the extracted layout.");
    } else if (["tex", "latex"].includes(extension)) {
      raw = await file.text();
      parsed = raw.includes("\\CVField{")
        ? parseLatexFields(raw, empty).data
        : parseResumeText(raw);
      notes.push("CVField data is mapped exactly. Other LaTeX is extracted as text.");
    } else if (extension === "pdf") {
      const result = await extractTextFromPdf(file);
      raw = result.text;
      parsed = result.resumeData || (raw ? parseResumeText(raw) : deepClone(empty));
      if (!result.resumeData) parsed.layout = { ...(parsed.layout || {}), importedText: raw };
      notes.push(
        ...result.problems,
        result.resumeData
          ? "Original Résumé 2.0 JSON restored from the document."
          : "Review names, dates, and entry grouping after PDF extraction.",
      );
    } else if (extension === "docx") {
      const result = await extractTextFromDocx(file);
      raw = result.text;
      parsed = result.resumeData || parseResumeText(raw);
      if (!result.resumeData) parsed.layout = { ...(parsed.layout || {}), importedText: raw };
      notes.push(
        result.resumeData
          ? "Original Résumé 2.0 JSON restored from the document."
          : "Review names, dates, and entry grouping after Word extraction.",
      );
    } else if (["md", "markdown", "txt"].includes(extension)) {
      raw = await file.text();
      parsed = extension === "txt" ? parseResumeText(raw) : parseLinkedMarkdown(raw, empty);
    } else
      throw new Error("Choose PDF, DOCX, JSON, XML, HTML, LaTeX, Markdown, text or a session ZIP.");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
      throw new Error("Resume must contain a JSON object.");
    showImportReview(
      parsed,
      raw,
      file.name,
      notes,
      ["pdf", "docx"].includes(extension) ? { file, format: extension } : null,
    );
  } catch (error) {
    toast(`Could not parse file: ${error.message}`);
  } finally {
    button.disabled = false;
  }
}
function showImportReview(parsed, raw, filename, notes, uploaded = null) {
  $("#modalRoot").innerHTML =
    `<div class="modal-backdrop"><div class="modal import-modal" role="dialog" aria-modal="true" aria-labelledby="importTitle"><h2 id="importTitle">Review imported resume</h2><p>${escapeHtml(filename)} · ${countScalarFields(parsed)} fields extracted. Edit the JSON below before saving. ${escapeHtml(notes.join(" "))}</p><textarea id="importReviewJson" spellcheck="false" autocapitalize="off" autocorrect="off" autocomplete="off" aria-label="Review imported JSON"></textarea><details><summary>Extracted source text</summary><pre>${escapeHtml(raw)}</pre></details><div class="modal-actions"><button class="button" id="cancelImport">Cancel</button><button class="button" id="replaceImport">Replace current</button><button class="button primary" id="newImport">Save as new</button></div></div></div>`;
  $("#importReviewJson").value = JSON.stringify(parsed, null, 2);
  const dialog = $("#importReviewJson").closest(".modal");
  const targetResumeId = activeResumeId;
  const close = () => $("#modalRoot").replaceChildren();
  $("#cancelImport").onclick = close;
  const accept = async (asNew) => {
    if ($("#newImport").disabled) return;
    const controls = [$("#newImport"), $("#replaceImport"), $("#cancelImport")];
    let sourceDocument;
    try {
      const data = ResumeFormats.assertModel(JSON.parse($("#importReviewJson").value));
      if (!data || typeof data !== "object" || Array.isArray(data))
        throw new Error("Use a JSON object");
      if (!asNew && activeResumeId !== targetResumeId)
        throw new Error("Open the intended résumé and import the document again.");
      controls.forEach((control) => {
        control.disabled = true;
      });
      if (uploaded) {
        sourceDocument = {
          id: makeWorkspaceId("original"),
          name: filename,
          format: uploaded.format,
          size: uploaded.file.size,
        };
        await OriginalFiles.put(sourceDocument.id, uploaded.file);
        if (!dialog.isConnected) return;
        activeMode = uploaded.format === "docx" ? "word" : "pdf";
        workspace.outputMode = activeMode;
        $$(".mode-tab").forEach((tab) => {
          tab.classList.toggle("active", tab.dataset.mode === activeMode);
          tab.setAttribute("aria-selected", String(tab.dataset.mode === activeMode));
        });
      }
      if (asNew) {
        const id = makeWorkspaceId("resume");
        workspace.resumes.push({
          id,
          name: pendingImportOptions?.name || filename.replace(/\.[^.]+$/, ""),
          nameAuto: false,
          folderId: pendingImportOptions?.folderId || workspace.folders[0]?.id,
          data,
          ...(sourceDocument ? { sourceDocument, documentView: "original" } : {}),
        });
        workspace.openIds.push(id);
        switchResume(id);
      } else {
        const record = workspace.resumes.find((item) => item.id === activeResumeId);
        const previousSource = record?.sourceDocument;
        if (record) {
          if (sourceDocument) {
            record.sourceDocument = sourceDocument;
            record.documentView = "original";
          } else {
            delete record.sourceDocument;
            delete record.documentView;
          }
        }
        resume = data;
        resetV2SourceState();
        latestJsonError = null;
        updateDocumentStatus();
        syncControls();
        if (previousSource)
          removeUnusedOriginalFiles([previousSource]).catch(() =>
            toast("Clear site storage to remove the replaced upload from this device."),
          );
      }
      pendingImportOptions = null;
      close();
      toast("Imported resume saved locally · all source formats available");
    } catch (error) {
      toast(error.message);
    } finally {
      if (sourceDocument) await removeUnusedOriginalFiles([sourceDocument]).catch(() => {});
      controls.forEach((control) => {
        control.disabled = false;
      });
    }
  };
  $("#replaceImport").onclick = () => accept(false);
  $("#newImport").onclick = () => accept(true);
}

let comparisonSource = "json";
function comparisonRows() {
  const sample = window.FormaBenchmark.samples[0];
  return [comparisonSource, "docx", "pdf"].map((format) =>
    sample.results.find((row) => row.format === format),
  );
}
function showRecordedBenchmark() {
  window.FormaBenchmark = window.ResumeComparisonReport;
  if (!window.FormaBenchmark) {
    $("#benchmarkRunMeta").textContent =
      "The recorded comparison could not load. Keep the assets folder beside this page.";
    return;
  }
  $("#benchmarkRunMeta").textContent =
    "Recorded local demonstration using the current import readers and fictional Tarun B files. PDF includes cold worker startup. Field filling illustrates the recorded result.";
  $$("[data-comparison-source]").forEach((tab) => {
    tab.onclick = () => {
      comparisonSource = tab.dataset.comparisonSource;
      $$("[data-comparison-source]").forEach((button) => {
        const active = button === tab;
        button.setAttribute("aria-selected", String(active));
        button.tabIndex = active ? 0 : -1;
      });
      buildWalkthrough();
    };
  });
  $(".comparison-tabs").onkeydown = (event) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const tabs = $$("[data-comparison-source]");
    const index =
      event.key === "Home" ? 0 : event.key === "End" ? 1 : comparisonSource === "json" ? 1 : 0;
    tabs[index].click();
    tabs[index].focus();
  };
  buildWalkthrough();
}
function recordedDuration(row) {
  return row.elapsed_ms * window.FormaBenchmark.timeScale;
}
function recordedProgress(row, elapsed) {
  return Math.max(0, Math.min(1, elapsed / recordedDuration(row)));
}
const walkthrough = {
  position: 0,
  duration: 0,
  playing: false,
  frame: 0,
  started: 0,
  lastPaint: 0,
  scrollEpoch: 0,
};
function buildWalkthrough() {
  pauseWalkthrough();
  walkthrough.position = 0;
  walkthrough.scrollEpoch++;
  const sample = window.FormaBenchmark.samples[0],
    rows = comparisonRows();
  walkthrough.duration = Math.max(...rows.map(recordedDuration));
  $("#walkthroughTimeline").max = String(walkthrough.duration);
  $("#walkthroughForms").innerHTML = rows
    .map((row) => {
      const format = row.format,
        label = format === "docx" ? "Word" : format.toUpperCase();
      return `<section class="walkthrough-form" data-walkthrough-format="${format}" aria-label="${label} application form"><header><span class="application-brand">Careers / Application</span><strong>${label}</strong></header><div class="walkthrough-file"><span class="material-symbols-rounded" aria-hidden="true">description</span><a href="benchmark/${escapeHtml(row.file)}" download>${escapeHtml(row.file)}</a><span class="walkthrough-file-state">Ready</span></div><progress class="walkthrough-progress" max="1" value="0" aria-label="${label} processing progress"></progress><div class="walkthrough-form-fields" tabindex="0" aria-label="${label} application fields">${row.fields.map((field, index) => `<div class="walkthrough-field" data-walkthrough-field="${index}"><span class="walkthrough-label">${escapeHtml(field.label)}</span><div class="walkthrough-value" title="${escapeHtml(field.actual || "Empty")}"><span></span></div><small class="walkthrough-correction">Expected: ${escapeHtml(field.expected || "Empty")}</small></div>`).join("")}</div><footer class="walkthrough-score"></footer></section>`;
    })
    .join("");
  renderWalkthrough();
  setWalkthroughPlaying(false);
}
function renderWalkthrough() {
  const pos = walkthrough.position,
    sample = window.FormaBenchmark.samples[0],
    rows = comparisonRows(),
    finished = pos >= walkthrough.duration;
  $("#walkthroughChapter").textContent = finished
    ? "Review results"
    : pos > 0
      ? "Processing files"
      : "Ready to compare";
  $("#walkthroughCaption").textContent = finished
    ? "Compare the highlighted fields with the source. Original local measurements appear below each form."
    : `All three files start together. Playback is ${Math.round(window.FormaBenchmark.timeScale).toLocaleString()}× slower than recorded processing. Field filling is illustrated across each file’s duration.`;
  $("#walkthroughTimeline").value = String(pos);
  const clock = (ms) =>
    `${Math.floor(ms / 60000)}:${((ms / 1000) % 60).toFixed(1).padStart(4, "0")}`;
  $("#walkthroughTime").textContent = `${clock(pos)} / ${clock(walkthrough.duration)}`;
  for (const form of $$("[data-walkthrough-format]")) {
    const row = rows.find((item) => item.format === form.dataset.walkthroughFormat),
      progress = recordedProgress(row, pos),
      complete = progress >= 1;
    form.querySelector(".walkthrough-file-state").textContent = complete
      ? "Complete"
      : pos > 0
        ? "Processing…"
        : "Ready";
    form.querySelector(".walkthrough-progress").value = progress;
    $$("[data-walkthrough-field]", form).forEach((node, index) => {
      const field = row.fields[index],
        p = Math.max(0, Math.min(1, progress * row.fields.length - index)),
        value = String(field.actual || "Empty"),
        span = node.querySelector(".walkthrough-value span");
      const text = p ? value.slice(0, Math.ceil(value.length * p)) : "";
      if (span.textContent !== text) span.textContent = text;
      node.classList.toggle("filling", p > 0 && p < 1);
      node.classList.toggle("filled", p === 1);
      node.classList.toggle("incorrect", p === 1 && field.status !== "correct");
      node.classList.toggle("show-correction", p === 1 && field.status !== "correct");
    });
    const scroller = form.querySelector(".walkthrough-form-fields"),
      seek = form.dataset.scrollEpoch !== String(walkthrough.scrollEpoch);
    if (seek) {
      delete scroller.dataset.userScroll;
      scroller.scrollTop = 0;
    }
    const focusIndex = complete
      ? Math.max(
          0,
          row.fields.findIndex((field) => field.status !== "correct"),
        )
      : Math.min(row.fields.length - 1, Math.floor(progress * row.fields.length));
    if (
      (seek || form.dataset.focusIndex !== String(focusIndex)) &&
      scroller.dataset.userScroll !== "true"
    )
      scroller.scrollTop = Math.max(
        0,
        scroller.children[focusIndex].offsetTop -
          scroller.children[0].offsetTop -
          scroller.clientHeight / 3,
      );
    form.dataset.focusIndex = String(focusIndex);
    form.dataset.complete = String(complete);
    form.dataset.scrollEpoch = String(walkthrough.scrollEpoch);
    form.querySelector(".walkthrough-score").textContent = complete
      ? `${row.correct} of ${row.total} details matched · ${row.elapsed_ms.toFixed(3)} ms recorded`
      : pos > 0
        ? `Processing · ${Math.round(progress * 100)}%`
        : "Ready";
  }
  $("#walkthroughResult").hidden = !finished;
  const mistakes = rows
    .filter((row) => row.format === "docx" || row.format === "pdf")
    .map(
      (row) =>
        `<section><h4>${row.format === "docx" ? "Word" : "PDF"}</h4><ul>${
          row.fields
            .filter((field) => field.status !== "correct")
            .map(
              (field) =>
                `<li><strong>${escapeHtml(field.label)}:</strong> ${escapeHtml(field.actual || "Not filled")}. Expected: ${escapeHtml(field.expected || "Empty")}.</li>`,
            )
            .join("") || "<li>All fields matched.</li>"
        }</ul></section>`,
    )
    .join("");
  const markup = `<h3>What needed correcting</h3><div class="comparison-mistakes">${mistakes}</div><p>${comparisonSource.toUpperCase()}: all ${rows[0].total} fields preserved, including ${Object.values(sample.expected).filter((value) => !String(value).trim()).length} empty fields. The highlighted values came from local document text extraction and classification. These results describe this local demonstration.</p>`;
  if ($("#walkthroughResult").innerHTML !== markup) $("#walkthroughResult").innerHTML = markup;
}
function setWalkthroughPlaying(playing) {
  walkthrough.playing = playing;
  $("#walkthroughStart").hidden = playing || walkthrough.position > 0;
  $("#walkthroughPlay .material-symbols-rounded").textContent = playing ? "pause" : "play_arrow";
  $("#walkthroughPlayLabel").textContent = playing
    ? "Pause"
    : walkthrough.position >= walkthrough.duration
      ? "Replay"
      : "Play";
  $("#walkthroughPlay").setAttribute(
    "aria-label",
    playing ? "Pause walkthrough" : "Play walkthrough",
  );
}
function pauseWalkthrough() {
  cancelAnimationFrame(walkthrough.frame);
  setWalkthroughPlaying(false);
}
function tickWalkthrough(now) {
  if (!walkthrough.playing) return;
  walkthrough.position = Math.min(walkthrough.duration, now - walkthrough.started);
  if (now - walkthrough.lastPaint >= 16 || walkthrough.position === walkthrough.duration) {
    renderWalkthrough();
    walkthrough.lastPaint = now;
  }
  if (walkthrough.position >= walkthrough.duration) pauseWalkthrough();
  else walkthrough.frame = requestAnimationFrame(tickWalkthrough);
}
$("#walkthroughPlay").onclick = () => {
  if (walkthrough.playing) return pauseWalkthrough();
  if (walkthrough.position >= walkthrough.duration) {
    walkthrough.position = 0;
    walkthrough.scrollEpoch++;
  }
  walkthrough.started = performance.now() - walkthrough.position;
  setWalkthroughPlaying(true);
  walkthrough.frame = requestAnimationFrame(tickWalkthrough);
};
$("#walkthroughStart").onclick = () => $("#walkthroughPlay").click();
function seekWalkthrough(position) {
  walkthrough.scrollEpoch++;
  walkthrough.position = Math.max(0, Math.min(walkthrough.duration, Number(position)));
  walkthrough.started = performance.now() - walkthrough.position;
  if (walkthrough.position === walkthrough.duration) pauseWalkthrough();
  renderWalkthrough();
  if (!walkthrough.playing) setWalkthroughPlaying(false);
}
$("#walkthroughTimeline").oninput = (event) => seekWalkthrough(event.target.value);
function expandWalkthrough(expanded) {
  const player = $("#benchmarkPlayer");
  const wasExpanded = player.classList.contains("expanded");
  if (expanded && !wasExpanded) {
    walkthroughFocusReturn = document.activeElement;
    player.setAttribute("role", "dialog");
    player.setAttribute("aria-modal", "true");
    $("#walkthroughFullscreen").focus();
  } else if (!expanded && wasExpanded) {
    player.removeAttribute("role");
    player.removeAttribute("aria-modal");
    walkthroughFocusReturn?.focus();
  }

  $("#benchmarkPlayer").classList.toggle("expanded", expanded);
  $("#walkthroughFullscreen").setAttribute(
    "aria-label",
    expanded ? "Close expanded walkthrough" : "Expand walkthrough",
  );
  $("#walkthroughFullscreen").title = expanded
    ? "Close expanded walkthrough"
    : "Expand walkthrough";
  $("#walkthroughFullscreen .material-symbols-rounded").textContent = expanded
    ? "fullscreen_exit"
    : "fullscreen";
}
$("#walkthroughFullscreen").onclick = () =>
  expandWalkthrough(!$("#benchmarkPlayer").classList.contains("expanded"));
document.addEventListener("visibilitychange", () => {
  if (document.hidden) pauseWalkthrough();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") expandWalkthrough(false);
});

$("#benchmarkPlayer").addEventListener("keydown", (event) => {
  if (event.key !== "Tab" || !$("#benchmarkPlayer").classList.contains("expanded")) return;
  const controls = [...$("#benchmarkPlayer").querySelectorAll("button,select,input")].filter(
    (node) => !node.disabled && node.getClientRects().length,
  );
  const first = controls[0],
    last = controls[controls.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
});
async function inspectPdf() {
  if (sourceDraftError()) return toast("Fix the source error before opening the PDF");
  const root = $("#modalRoot");
  root.innerHTML = `<div class="modal-backdrop pdf-proof-backdrop"><section class="pdf-proof" role="dialog" aria-modal="true" aria-labelledby="pdfProofTitle"><header class="pdf-proof-head"><h2 id="pdfProofTitle">PDF preview</h2><div class="proof-navigation"><button class="button quiet icon-button" id="proofPrevious" aria-label="Previous PDF page" disabled><span class="material-symbols-rounded">chevron_left</span></button><input id="proofPageNumber" type="number" min="1" value="1" aria-label="PDF page" disabled><span id="proofPageTotal">/ —</span><button class="button quiet icon-button" id="proofNext" aria-label="Next PDF page" disabled><span class="material-symbols-rounded">chevron_right</span></button><select id="proofZoom" aria-label="PDF view zoom"><option value="fit">Fit width</option><option value="page">Fit page</option><option value="1">100%</option><option value="1.25">125%</option><option value="1.5">150%</option></select></div><div><a id="pdfProofOpen" class="button quiet" target="_blank" rel="noopener">Open file</a><button id="pdfProofDownload" class="button" disabled>Download</button><button id="pdfProofClose" class="button quiet icon-button" aria-label="Close PDF preview"><span class="material-symbols-rounded" aria-hidden="true">close</span></button></div></header><div class="pdf-proof-pages" id="pdfProofPages"><p id="pdfProofStatus" role="status">Preparing PDF…</p><div class="pdf-proof-stack" id="proofStack"></div></div></section></div>`;
  const dialog = $(".pdf-proof", root),
    host = $("#pdfProofPages"),
    stack = $("#proofStack");
  let cancelled = false,
    task,
    rendering,
    blobUrl,
    count = 0,
    pageNumber = 1;
  const resize = () => {
    const value = $("#proofZoom")?.value;
    applyDocumentScale(
      stack,
      value === "fit"
        ? Math.min(1, Math.max(0.25, (host.clientWidth - 32) / PAGE.width))
        : value === "page"
          ? Math.max(
              0.25,
              Math.min(
                1,
                (host.clientWidth - 32) / PAGE.width,
                (host.clientHeight - 48) / PAGE.height,
              ),
            )
          : Number(value) || 1,
      PAGE.width,
    );
  };
  const disposePinch = attachPinchZoom(
    host,
    () => documentScale(stack),
    (scale, anchor) => {
      let option = $("#proofZoom").querySelector("[data-custom-zoom]");
      if (!option) {
        option = document.createElement("option");
        option.dataset.customZoom = "true";
        $("#proofZoom").appendChild(option);
      }
      option.value = String(scale);
      option.textContent = Math.round(scale * 100) + "%";
      $("#proofZoom").value = String(scale);
      anchorDocumentScale(host, stack, scale, anchor, resize);
    },
  );
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(host);
  const observer = new MutationObserver(() => {
    if (!dialog.isConnected) dispose();
  });
  const dispose = () => {
    if (cancelled) return;
    cancelled = true;
    disposePinch();
    rendering?.cancel();
    task?.destroy().catch(() => {});
    resizeObserver.disconnect();
    observer.disconnect();
    if (blobUrl) setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
  };
  observer.observe(root, { childList: true });
  const close = () => {
    dispose();
    root.replaceChildren();
  };
  $("#pdfProofClose").onclick = close;
  $(".pdf-proof-backdrop", root).onclick = (event) => {
    if (event.target.classList.contains("pdf-proof-backdrop")) close();
  };
  $("#proofZoom").onchange = resize;
  const go = (number) => {
    pageNumber = Math.max(1, Math.min(count, Number(number) || 1));
    $("#proofPageNumber").value = String(pageNumber);
    $("#proofPrevious").disabled = pageNumber <= 1;
    $("#proofNext").disabled = pageNumber >= count;
    const page = stack.children[pageNumber - 1];
    if (page)
      host.scrollTop += page.getBoundingClientRect().top - host.getBoundingClientRect().top - 16;
  };
  $("#proofPrevious").onclick = () => go(pageNumber - 1);
  $("#proofNext").onclick = () => go(pageNumber + 1);
  $("#proofPageNumber").onchange = (event) => go(event.target.value);
  try {
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    if (cancelled) return;
    const uploaded =
      viewingOriginal() && currentOriginal().format === "pdf" ? currentOriginal() : null;
    const filename = uploaded?.name || safeFilename() + ".pdf",
      blob = uploaded ? await OriginalFiles.get(uploaded.id) : makePdf();
    if (!blob) throw new Error("Import the original PDF or restore its session ZIP.");
    blobUrl = URL.createObjectURL(blob);
    $("#pdfProofOpen").href = blobUrl;
    $("#pdfProofDownload").disabled = false;
    $("#pdfProofDownload").onclick = () => download(blob, filename);
    $("#pdfProofStatus").textContent = "Rendering pages…";
    const bytes = new Uint8Array(await blob.arrayBuffer());
    if (cancelled) return;
    task = pdfjsLib.getDocument(pdfPreviewOptions(bytes));
    const pdf = await task.promise;
    if (cancelled) return;
    count = pdf.numPages;
    $("#proofPageTotal").textContent = `/ ${count}`;
    $("#proofPageNumber").max = String(count);
    $("#proofPageNumber").disabled = false;
    $("#proofNext").disabled = count <= 1;
    for (let number = 1; number <= count; number++) {
      if (cancelled) return;
      const page = await pdf.getPage(number);
      if (cancelled) return;
      const scale = PAGE.width / page.getViewport({ scale: 1 }).width;
      const canvas = document.createElement("canvas");
      const viewport = page.getViewport({ scale: scale * 2 });
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      canvas.setAttribute("role", "img");
      canvas.setAttribute("aria-label", `PDF page ${number} of ${count}`);
      rendering = page.render({ canvasContext: canvas.getContext("2d"), viewport });
      await rendering.promise;
      if (cancelled) return;
      const figure = document.createElement("figure"),
        caption = document.createElement("figcaption");
      caption.textContent = `Page ${number} of ${count}`;
      figure.append(caption, canvas);
      stack.append(figure);
      page.cleanup();
      resize();
      if (pageNumber === number && number > 1) go(pageNumber);
      $("#pdfProofStatus").textContent =
        number === count ? "" : `Rendered ${number} of ${count} pages…`;
      $("#pdfProofStatus").hidden = number === count;
    }
  } catch (error) {
    if (!cancelled)
      $("#pdfProofStatus").textContent =
        `The inline viewer could not render this PDF. Use Open file or Download. ${error.message}`;
  }
}

async function runLocalFileBenchmark() {
  const file = $("#benchmarkPdfFile").files[0],
    jsonFile = $("#benchmarkJsonFile").files[0],
    result = $("#benchmarkResult");
  if (!file || !jsonFile) return;
  const button = $("#runBenchmarkButton");
  button.disabled = true;
  result.textContent = "Reading and mapping application fields locally…";
  try {
    const source = await jsonFile.text(),
      jsonStart = performance.now(),
      reference = JSON.parse(source);
    if (!reference || typeof reference !== "object" || Array.isArray(reference))
      throw new Error("Reference JSON must contain a resume object.");
    const expected = ResumeParser.fillForm(reference),
      jsonMs = performance.now() - jsonStart;
    if (!Object.values(expected).some((value) => String(value || "").trim()))
      throw new Error(
        "Your JSON has no resume details to compare. Add your name, contact or employment information first.",
      );
    const format = await detectResumeFormat(file);
    if (!["pdf", "docx"].includes(format))
      throw new Error("Choose a PDF or Word document with selectable text.");
    const started = performance.now(),
      extracted =
        format === "docx" ? await extractTextFromDocx(file) : await extractTextFromPdf(file, false),
      actual = ResumeParser.fillForm(parseResumeText(extracted.text)),
      elapsed = performance.now() - started,
      score = ResumeParser.evaluate(actual, expected);
    const known = score.fields.filter((field) => String(field.expected || "").trim());
    const correct = known.filter((field) => field.status === "correct").length;
    const needsCorrection = known.length - correct;
    const emptyCount = score.total - known.length;
    result.innerHTML = `<h3>${known.length ? `${correct} of ${known.length} known resume details matched` : "Your JSON has no details to compare"}</h3><p>${known.length ? `${format === "docx" ? "Word" : "PDF"} filled ${correct} application fields correctly.${needsCorrection ? ` ${needsCorrection} need correction.` : ""}` : "Add your name, contact information and employment details to the reference JSON."} ${emptyCount ? `${emptyCount} blank reference fields were excluded from the score.` : ""}</p>${known.length <= 3 ? `<p class="reference-coverage">Your JSON contains only ${known.length} comparable detail${known.length === 1 ? "" : "s"}. Add the remaining resume information for a useful comparison.</p>` : ""}<div class="benchmark-table-wrap"><table class="benchmark-field-table"><thead><tr><th>Application field</th><th>Filled from ${format === "docx" ? "Word" : "PDF"}</th><th>Your JSON</th><th>Review</th></tr></thead><tbody>${known.map((field) => `<tr><th>${escapeHtml(field.label)}</th><td>${escapeHtml(field.actual || "Not filled")}</td><td>${escapeHtml(field.expected || "Not provided")}</td><td>${!String(field.expected || "").trim() ? "Not scored" : field.status === "correct" ? "Matches" : "Needs correction"}</td></tr>`).join("")}</tbody></table></div><details class="comparison-timing"><summary>Processing details</summary><p>Document: ${elapsed.toFixed(2)} ms. JSON: ${jsonMs.toFixed(2)} ms. These browser timings include each format’s reading costs. Files were processed in this tab using the current import parser.</p></details>`;
  } catch (error) {
    result.textContent = error.message || "Comparison failed";
  } finally {
    updateBenchmarkFileStatus();
  }
}
function updateLayoutFromDom() {
  const sections = $$(".resume-section[data-section-key]", $("#previewBody"));
  const order = [...new Set(sections.map((node) => node.dataset.sectionKey))];
  resume.layout = { ...(resume.layout || {}), order };
  const selectedTemplate = templateById(resume.template);
  if (effectiveTemplateId(selectedTemplate) === "executive")
    resume.layout.sidebarSections = [
      ...new Set(
        sections
          .filter((node) => node.closest(".drop-zone")?.dataset.zone === "sidebar")
          .map((node) => node.dataset.sectionKey),
      ),
    ];
  updateJsonEditor();
  renderOutput();
  setJsonStatus("Section layout saved in resume JSON");
}
let draggedSectionKey = null;
let draggedSectionNode = null;
function attachPreviewInteractions() {
  const preview = $("#previewBody");
  preview.addEventListener("dragstart", (event) => {
    if (event.target.closest("#wordEditor")) return;
    const section = event.target.closest(".resume-section[data-section-key]");
    if (
      !section ||
      (event.target.closest("[contenteditable=true]") && !event.target.closest("h2"))
    ) {
      event.preventDefault();
      return;
    }
    draggedSectionKey = section.dataset.sectionKey;
    draggedSectionNode = section;
    section.classList.add("dragging");
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", draggedSectionKey);
  });
  preview.addEventListener("dragend", (event) => {
    draggedSectionKey = null;
    draggedSectionNode = null;
    event.target.closest(".resume-section")?.classList.remove("dragging");
    $$(".drop-target", preview).forEach((node) => node.classList.remove("drop-target"));
  });
  preview.addEventListener("dragover", (event) => {
    if (!draggedSectionKey) return;
    const zone = event.target.closest(".drop-zone");
    if (!zone) return;
    event.preventDefault();
    const target = event.target.closest(".resume-section[data-section-key]");
    $$(".drop-target", preview).forEach((node) => node.classList.remove("drop-target"));
    if (target) target.classList.add("drop-target");
    event.dataTransfer.dropEffect = "move";
  });
  preview.addEventListener("drop", (event) => {
    if (!draggedSectionKey) return;
    const zone = event.target.closest(".drop-zone");
    const paper = event.target.closest(".resume-paper");
    if (!zone || !paper) return;
    event.preventDefault();
    const key = draggedSectionKey,
      target = event.target.closest(".resume-section[data-section-key]");
    if (resume.layout?.richDocument) {
      const after =
        target &&
        event.clientY >
          target.getBoundingClientRect().top + target.getBoundingClientRect().height / 2;
      reorderRichSection(key, target?.dataset.sectionKey, after);
      draggedSectionKey = null;
      draggedSectionNode = null;
      updateDocumentStatus();
      return;
    }
    const order = sectionKeys().filter((item) => item !== key);
    if (target && target.dataset.sectionKey !== key) {
      const box = target.getBoundingClientRect();
      const at = order.indexOf(target.dataset.sectionKey);
      order.splice(at + (event.clientY > box.top + box.height / 2 ? 1 : 0), 0, key);
    } else order.push(key);
    resume.layout = { ...(resume.layout || {}), order };
    if (effectiveTemplateId(templateById(resume.template)) === "executive") {
      const side = new Set(resume.layout.sidebarSections || ["skills", "languages"]);
      if (zone.dataset.zone === "sidebar") side.add(key);
      else side.delete(key);
      resume.layout.sidebarSections = [...side];
    }
    draggedSectionKey = null;
    draggedSectionNode = null;
    updateDocumentStatus();
  });
  preview.addEventListener("click", (event) => {
    if (event.altKey) {
      const node = event.target.closest("[data-path]");
      if (node) {
        event.preventDefault();
        activateInput("json");
        const needle = JSON.stringify(pathGet(resume, node.dataset.path));
        const offset = jsonEditor.value.indexOf(needle);
        if (offset >= 0) {
          jsonEditor.focus();
          jsonEditor.setSelectionRange(offset, offset + needle.length);
          const before = jsonEditor.value.slice(0, offset);
          const lineIndex = before.split("\n").length - 1;
          jsonEditor.scrollTop = sourceWrap
            ? Math.max(0, ($("#highlight").children[lineIndex]?.offsetTop || 0) - 72)
            : Math.max(0, (lineIndex - 3) * 21.6);
        }
      }
      return;
    }
    const link = event.target.closest("a[data-path]");
    if (link && !event.metaKey && !event.ctrlKey) event.preventDefault();
    if (link && (event.metaKey || event.ctrlKey)) event.stopPropagation();
  });
  preview.addEventListener("pointerdown", (event) => {
    const handle = event.target.closest(".sidebar-resizer");
    if (!handle) return;
    const paper = handle.closest(".resume-paper");
    const bounds = paper.getBoundingClientRect();
    const move = (moveEvent) => {
      const width = Math.max(
        22,
        Math.min(48, ((moveEvent.clientX - bounds.left) / bounds.width) * 100),
      );
      resume.layout = { ...(resume.layout || {}), sidebarWidth: Math.round(width) };
      paper.style.setProperty("--resume-sidebar-width", `${width}%`);
    };
    const finish = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", finish);
      updateJsonEditor();
      renderOutput();
      setJsonStatus("Sidebar width saved in resume JSON");
    };
    event.preventDefault();
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", finish, { once: true });
  });
  preview.addEventListener("keydown", (event) => {
    if (
      !event.target.matches(".sidebar-resizer") ||
      !["ArrowLeft", "ArrowRight"].includes(event.key)
    )
      return;
    event.preventDefault();
    const width = Math.max(
      22,
      Math.min(
        48,
        Number(resume.layout?.sidebarWidth || 31) + (event.key === "ArrowRight" ? 1 : -1),
      ),
    );
    resume.layout = { ...(resume.layout || {}), sidebarWidth: width };
    updateJsonEditor();
    renderOutput();
    setJsonStatus("Sidebar width saved in resume JSON");
  });
}
async function compileJson() {
  if (sourceDraftError()) {
    toast("Fix the source error before creating a checkpoint.");
    return false;
  }
  saveWordDocument();
  const started = performance.now();
  $("#compileButton").disabled = true;
  $("#compileButton").setAttribute("aria-busy", "true");
  $("#compileButton .compile-label").textContent = "Compiling…";
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  try {
    const active = document.activeElement;
    if (active?.id === "markdownInput") {
      resume = markdownInputData(active.value);
      updateJsonEditor();
    } else if (active?.matches("[data-path][contenteditable=true]")) contentEditableChanged(active);
    const parsed = ResumeFormats.assertModel(JSON.parse(jsonEditor.value));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
      throw new Error("Resume data must be a JSON object.");
    resume = parsed;
    latestJsonError = null;
    const diagnostics = [];
    if (!String(resume.basics?.name || "").trim())
      diagnostics.push("Add a name to the basic profile.");
    if (resume.basics?.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(resume.basics.email))
      diagnostics.push("The email address may be malformed.");
    if (!resume.summary)
      diagnostics.push("A short profile summary can help readers understand your focus.");
    if (!Array.isArray(resume.experience) || !resume.experience.length)
      diagnostics.push("No experience entries were found.");
    if (resume.format?.latexTemplate)
      diagnostics.push(
        "LaTeX content and supported style commands sync to the document. PDF export uses the document layout; arbitrary TeX commands require a TeX compiler.",
      );
    if (
      resumeTextValues(resume).some((value) =>
        [...value].some((char) => {
          const cp = char.codePointAt(0);
          return cp > 255 && !CP1252.has(cp);
        }),
      )
    )
      diagnostics.push(
        "The built-in PDF fonts support Latin text. Some characters need the browser Print to PDF export to preserve their glyphs.",
      );
    const fieldCount = countScalarFields(resume);
    const pages = pdfBuildPages();
    const pdf = makePdf(pages);
    const docx = makeDocx();
    const tex = latexSource();
    const json = JSON.stringify(resume, null, 2);
    const md = markdownSource();
    const selectedTemplate = customTemplates.find((item) => item.id === resume.template) || {
      id: resume.template,
      name: templateById(resume.template).name,
      variant: templateById(resume.template).id,
      base: templateById(resume.template).base || templateById(resume.template).id,
      css: "",
      format: resume.format || {},
      layout: resume.layout || {},
    };
    const hash = tinyHash(json + JSON.stringify(selectedTemplate));
    compiledArtifacts = {
      pdf,
      docx,
      tex,
      json,
      md,
      hash,
      fieldCount,
      pageCount: pages.length,
      compiledAt: new Date().toLocaleString(undefined, { timeZone: "Europe/Stockholm" }),
      elapsedMs: Math.round(performance.now() - started),
      diagnostics,
      filename: safeFilename(),
      template: deepClone(selectedTemplate),
    };
    saveCheckpoint(compiledArtifacts);
    compileCount++;
    safeStorageSet("forma.compile.count", String(compileCount));
    updateJsonEditor();
    renderOutput();
    syncControls();
    setJsonStatus(
      `Build #${compileCount} · ${fieldCount} fields · ${pages.length} page${pages.length === 1 ? "" : "s"}`,
    );
    showCompileReport(compiledArtifacts);
    return true;
  } catch (error) {
    if (error instanceof SyntaxError) latestJsonError = error;
    const detail = error.message;
    setJsonStatus(detail, true);
    showCompileReport(null, [detail]);
    return false;
  } finally {
    $("#compileButton").disabled = false;
    $("#compileButton").removeAttribute("aria-busy");
    $("#compileButton .compile-label").textContent = "Compile";
    updateBuildState();
  }
}
function resumeTextValues(value) {
  if (typeof value === "string") return [value];
  if (!value || typeof value !== "object") return [];
  return Object.entries(value)
    .filter(([key]) => !["template", "format", "layout"].includes(key) && !key.startsWith("_"))
    .flatMap(([, child]) => resumeTextValues(child));
}
function countScalarFields(value) {
  if (value == null || typeof value !== "object") return 1;
  return Object.values(value).reduce((total, child) => total + countScalarFields(child), 0);
}
function tinyHash(text) {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619);
  return (hash >>> 0).toString(16).padStart(8, "0");
}
function showCompileReport(build, errors = []) {
  const diagnostics = errors.length
    ? errors.map((error) => `<li class="diagnostic-error">${escapeHtml(error)}</li>`).join("")
    : build.diagnostics.length
      ? build.diagnostics.map((item) => `<li>${escapeHtml(item)}</li>`).join("")
      : `<li class="diagnostic-ok">No content or export warnings.</li>`;
  const summary = build
    ? `<div class="compile-summary"><div><strong>${build.fieldCount}</strong><span>data fields</span></div><div><strong>${build.pageCount}</strong><span>PDF page${build.pageCount === 1 ? "" : "s"}</span></div><div><strong>${Math.round((build.pdf.size + build.docx.size) / 1024)} KB</strong><span>PDF + Word</span></div></div><div class="compile-build-id">Build #${compileCount} · ${build.hash} · ${escapeHtml(build.compiledAt)}</div>`
    : "";
  $("#modalRoot").innerHTML =
    `<div class="modal-backdrop" id="compileBackdrop"><div class="modal compile-report" role="dialog" aria-modal="true" aria-labelledby="compileTitle"><h2 id="compileTitle">${build ? "Checkpoint & changes" : "Compile could not finish"}</h2><p>${build ? "Your local checkpoint preserves this version and its PDF, Word, JSON, LaTeX and Markdown downloads." : "Fix the issue below, then compile again."}</p>${checkpointMarkup(build)}${summary}<div class="diagnostics-title">Diagnostics</div><ul class="diagnostic-list">${diagnostics}</ul><div class="modal-actions"><button class="button" id="closeCompile">Close</button>${build ? `<button class="button primary" id="downloadBuild">Download ${activeMode === "word" ? "Word" : "PDF"}</button><button class="button" id="downloadBuildZip">Download checkpoint ZIP</button>` : ""}</div></div></div>`;
  const close = () => {
    $("#modalRoot").innerHTML = "";
  };
  $("#closeCompile").onclick = close;
  $("#compileBackdrop").addEventListener("click", (event) => {
    if (event.target.id === "compileBackdrop") close();
  });
  $$("[data-restore-version]").forEach(
    (button) =>
      (button.onclick = () => {
        const item = workspace.resumes.find((record) => record.id === activeResumeId);
        const version = item?.versions?.find(
          (record) => record.id === button.dataset.restoreVersion,
        );
        if (!version) return;
        resume = JSON.parse(version.json);
        latestJsonError = null;
        jsonEditor.value = JSON.stringify(resume, null, 2);
        $("#modalRoot").replaceChildren();
        updateDocumentStatus();
        syncControls();
        toast("Checkpoint restored");
      }),
  );
  if (build) {
    $("#downloadBuildZip").onclick = () => {
      close();
      downloadCompiledArtifact("zip");
    };
    $("#downloadBuild").onclick = () => {
      close();
      downloadCompiledArtifact(activeMode);
    };
  }
}
function parseJsonLive() {
  try {
    const parsed = ResumeFormats.assertModel(JSON.parse(jsonEditor.value));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
      throw new Error("Root value must be an object");
    resume = parsed;
    latestJsonError = null;
    setJsonStatus("JSON valid · preview synced");
    renderOutput();
    updateJsonEditor();
    syncControls();
  } catch (error) {
    latestJsonError = error;
    const match = /position\s+(\d+)/i.exec(error.message);
    let suffix = "";
    if (match) {
      const before = jsonEditor.value.slice(0, Number(match[1]));
      suffix = ` · line ${before.split("\n").length}`;
    }
    setJsonStatus(`${error.message}${suffix}`, true);
  }
  highlightJson();
  updateJsonStats();
  updateBuildState();
  persistResume();
}

function showAddFieldModal(fromOutput = false) {
  if (sourceDraftError()) {
    activateInput(sourceErrorMode(), false);
    toast("Correct the source error first so your draft is kept.");
    return;
  }
  let number = 1;
  while (Object.hasOwn(resume, `Name${number}`)) number++;
  const key = `Name${number}`;
  resume[key] = ["New detail"];
  jsonEditor.value = JSON.stringify(resume, null, 2);
  if (fromOutput) {
    const record = workspace.resumes.find((item) => item.id === activeResumeId);
    if (record?.sourceDocument) record.documentView = "edited";
  }
  if (resume.layout?.richDocument) appendRichSection(key);
  updateDocumentStatus();
  if (!fromOutput) {
    activateInput("json");
    jsonEditor.focus();
    const start = jsonEditor.value.indexOf(`"${key}"`);
    jsonEditor.setSelectionRange(start, start + key.length + 2);
    const line = jsonEditor.value.slice(0, start).split("\n").length;
    jsonEditor.scrollTop = Math.max(
      0,
      (line - 4) * parseFloat(getComputedStyle(jsonEditor).lineHeight),
    );
  }
  toast(`${key} added`);
}
function sanitizeTemplateCss(css) {
  return String(css || "")
    .replace(/@import[^;]*;?/gi, "")
    .replace(/url\s*\([^)]*\)/gi, "");
}
function showTemplateModal() {
  const all = [...BUILTIN_TEMPLATES, ...customTemplates];
  $("#modalRoot").innerHTML =
    `<div class="modal-backdrop"><div class="modal template-library" role="dialog" aria-modal="true" aria-labelledby="templateLibraryTitle"><div class="library-head"><div><h2 id="templateLibraryTitle">Templates</h2><p>Choose a layout. Your content stays with your resume.</p></div><button class="button quiet icon-button" id="closeTemplateLibrary" aria-label="Close templates"><span class="material-symbols-rounded">close</span></button></div><div class="template-library-tools"><input id="templateSearch" placeholder="Search templates" aria-label="Search templates"><button class="button primary" id="createPersonalTemplate"><span class="material-symbols-rounded">add</span>Create template</button><button class="button" id="importPersonalTemplate"><span class="material-symbols-rounded">upload_file</span>Import template</button></div><div class="template-gallery" id="templateLibraryGrid">${all.map((t) => `<article class="library-template ${t.id === resume.template ? "selected" : ""}" data-template-name="${escapeHtml(t.name.toLowerCase())}"><button class="template-card" data-use-template="${escapeHtml(t.id)}"><span class="template-mini" data-mini="${effectiveTemplateId(t)}"><i></i><i></i><i></i></span><strong>${escapeHtml(t.name)}</strong><span>${customTemplates.some((x) => x.id === t.id) ? "Personal template" : effectiveTemplateId(t) === "executive" ? "Sidebar layout" : "Single-column layout"}</span></button><button class="button quiet edit-template-defaults" data-edit-template="${escapeHtml(t.id)}">${customTemplates.some((x) => x.id === t.id) ? "Edit defaults" : "Customize a copy"}</button></article>`).join("")}</div><p class="library-note">Select a template to apply it. Customize a copy to save a reusable layout.</p></div></div>`;
  $("#closeTemplateLibrary").onclick = () => $("#modalRoot").replaceChildren();
  $("#templateSearch").oninput = (event) =>
    $$("[data-template-name]").forEach((card) =>
      card.classList.toggle(
        "hidden",
        !card.dataset.templateName.includes(event.target.value.toLowerCase()),
      ),
    );
  $$("[data-use-template]").forEach(
    (button) =>
      (button.onclick = () => {
        applyTemplate(button.dataset.useTemplate);
        $("#modalRoot").replaceChildren();
      }),
  );
  $$("[data-edit-template]").forEach(
    (button) =>
      (button.onclick = () => {
        applyTemplate(button.dataset.editTemplate);
        showTemplateEditor(!customTemplates.some((x) => x.id === button.dataset.editTemplate));
      }),
  );
  $("#createPersonalTemplate").onclick = () => showTemplateEditor(true);
  $("#importPersonalTemplate").onclick = () => {
    showTemplateEditor(true);
    $("#templateFile").click();
  };
}
function showTemplateEditor(forceNew = false) {
  const current = forceNew ? null : customTemplates.find((item) => item.id === resume.template);
  const name = current?.name || `${templateById(resume.template).name} Custom`;
  const layout = resume.layout || {};
  $("#modalRoot").innerHTML =
    `<div class="modal-backdrop" id="templateBackdrop"><div class="modal template-modal" role="dialog" aria-modal="true" aria-labelledby="templateModalTitle"><h2 id="templateModalTitle">${current ? "Edit personal template" : "Create personal template"}</h2><p>Save a reusable layout and content defaults. Your resume text stays editable.</p><div class="form-field"><label for="templateBase">Starting layout</label><select id="templateBase">${BUILTIN_TEMPLATES.map((t) => `<option value="${t.id}" ${(current?.variant || templateById(resume.template).variant || templateById(resume.template).id) === t.id ? "selected" : ""}>${escapeHtml(t.name)}</option>`).join("")}</select></div><label class="template-seed-choice"><input id="includeTemplateText" type="checkbox" ${current?.seed ? "checked" : ""}> Include this resume’s text as content defaults</label><div class="form-field"><label for="templateName">Template name</label><input id="templateName" maxlength="48" value="${escapeHtml(name)}"></div><div class="form-grid"><div class="form-field"><label for="sectionSpacing">Section spacing <output id="spacingValue">${layout.sectionSpacing || 24}px</output></label><input id="sectionSpacing" type="range" min="8" max="48" value="${layout.sectionSpacing || 24}"></div><div class="form-field"><label for="sidebarWidth">Sidebar width <output id="sidebarValue">${layout.sidebarWidth || 31}%</output></label><input id="sidebarWidth" type="range" min="22" max="48" value="${layout.sidebarWidth || 31}"></div></div><div class="form-grid"><div class="form-field"><label for="templateBorder">Section rule</label><select id="templateBorder"><option value="solid">Solid</option><option value="double">Double</option><option value="dashed">Dashed</option><option value="none">None</option></select></div><div class="form-field"><label for="pageBorder">Page border</label><select id="pageBorder"><option value="none">None</option><option value="hairline">Hairline</option><option value="accent">Accent color</option></select></div></div><details class="advanced-template"><summary>Advanced CSS</summary><div class="form-field"><label for="templateCss">Scoped template styles</label><textarea id="templateCss" rows="7" spellcheck="false" autocapitalize="off" autocorrect="off" placeholder='[data-template="my-template"] .resume-name { letter-spacing: .02em; }'>${escapeHtml(current?.css || "")}</textarea></div></details><div class="template-upload-area"><label for="templateFile">Import a template or use a document as a starting point</label><input id="templateFile" type="file" accept=".css,.json,.pdf,.docx,.tex,.latex,.md,.markdown,.txt,.zip,text/css,application/json"><p>CSS and template JSON preserve supported styling. PDF and Word provide extracted content for a new template.</p></div><div class="modal-actions"><button class="button" id="cancelTemplate">Cancel</button><button class="button" id="downloadTemplate">Download template</button><button class="button primary" id="saveTemplate">${current ? "Update template" : "Create template"}</button></div></div></div>`;
  $("#templateBorder").value = layout.borderStyle || "solid";
  $("#pageBorder").value = layout.pageBorder || "none";
  const borderWeightField = document.createElement("div");
  borderWeightField.className = "form-field";
  const borderWeightLabel = document.createElement("label");
  borderWeightLabel.htmlFor = "borderWidth";
  borderWeightLabel.textContent = "Section rule weight ";
  const borderWeightOutput = document.createElement("output");
  borderWeightOutput.textContent = String(layout.borderWidth || 1) + " px";
  borderWeightLabel.appendChild(borderWeightOutput);
  const borderWeightInput = document.createElement("input");
  borderWeightInput.type = "range";
  borderWeightInput.id = "borderWidth";
  borderWeightInput.min = "1";
  borderWeightInput.max = "4";
  borderWeightInput.step = "1";
  borderWeightInput.value = String(layout.borderWidth || 1);
  borderWeightField.append(borderWeightLabel, borderWeightInput);
  $("#templateBorder").closest(".form-grid").after(borderWeightField);
  borderWeightInput.addEventListener("input", (event) => {
    borderWeightOutput.textContent = event.target.value + " px";
  });
  const close = () => {
    $("#modalRoot").innerHTML = "";
  };
  $("#cancelTemplate").onclick = close;
  $("#templateBackdrop").addEventListener("click", (event) => {
    if (event.target.id === "templateBackdrop") close();
  });
  $("#sectionSpacing").addEventListener("input", (event) => {
    $("#spacingValue").value = `${event.target.value}px`;
  });
  $("#sidebarWidth").addEventListener("input", (event) => {
    $("#sidebarValue").value = `${event.target.value}%`;
  });
  $("#saveTemplate").onclick = () => {
    const templateName = $("#templateName").value.trim() || "My template";
    let id = current?.id;
    if (!id) {
      const base = `custom-${
        templateName
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "") || "template"
      }`;
      id = base;
      let suffix = 2;
      while (BUILTIN_TEMPLATES.some((t) => t.id === id) || customTemplates.some((t) => t.id === id))
        id = `${base}-${suffix++}`;
    }
    const baseTemplate = templateById($("#templateBase").value);
    const previousVariant =
      templateById(resume.template).variant || templateById(resume.template).id;
    const baseChanged = baseTemplate.id !== previousVariant;
    resume.format = { ...(resume.format || {}), ...(baseChanged ? baseTemplate.format || {} : {}) };
    resume.layout = {
      ...(resume.layout || {}),
      ...(baseChanged ? baseTemplate.layout || {} : {}),
      sectionSpacing: Number($("#sectionSpacing").value),
      sidebarWidth: Number($("#sidebarWidth").value),
      borderStyle: $("#templateBorder").value,
      borderWidth: Number($("#borderWidth").value),
      pageBorder: $("#pageBorder").value,
    };
    const record = {
      id,
      name: templateName,
      seed: $("#includeTemplateText").checked
        ? deepClone(resume)
        : {
            template: resume.template,
            format: deepClone(resume.format || {}),
            layout: deepClone(resume.layout || {}),
            basics: { name: "", label: "", email: "", phone: "", location: "", url: "" },
            summary: "",
            experience: [],
            education: [],
            skills: [],
            projects: [],
          },
      variant: $("#templateBase").value,
      base: effectiveTemplateId(templateById($("#templateBase").value)),
      css: sanitizeTemplateCss($("#templateCss").value),
      format: deepClone(resume.format || {}),
      layout: deepClone(resume.layout),
    };
    const index = customTemplates.findIndex((item) => item.id === id);
    if (index >= 0) customTemplates[index] = record;
    else customTemplates.push(record);
    resume.template = id;
    persistTemplates();
    latestJsonError ? renderOutput() : updateDocumentStatus();
    syncControls();
    close();
    toast(`${templateName} saved in this browser`);
  };
  $("#downloadTemplate").onclick = () => {
    const selectedTemplate = templateById(resume.template);
    const payload = {
      id: current?.id,
      name: $("#templateName").value.trim() || name,
      variant: $("#templateBase").value,
      base: effectiveTemplateId(templateById($("#templateBase").value)),
      css: sanitizeTemplateCss($("#templateCss").value),
      seed: $("#includeTemplateText").checked
        ? deepClone(resume)
        : {
            template: resume.template,
            format: deepClone(resume.format || {}),
            layout: deepClone(resume.layout || {}),
            basics: { name: "", label: "", email: "", phone: "", location: "", url: "" },
            summary: "",
            experience: [],
            education: [],
            skills: [],
            projects: [],
          },
      format: resume.format || {},
      layout: {
        ...layout,
        sectionSpacing: Number($("#sectionSpacing").value),
        sidebarWidth: Number($("#sidebarWidth").value),
        borderStyle: $("#templateBorder").value,
        borderWidth: Number($("#borderWidth").value),
        pageBorder: $("#pageBorder").value,
      },
    };
    download(
      new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }),
      "draft-template.json",
    );
  };
  $("#templateFile").addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) {
      toast("Choose a template file under 15 MB");
      return;
    }
    try {
      const extension = await detectResumeFormat(file);
      let imported;
      if (["pdf", "docx", "tex", "md", "txt"].includes(extension)) {
        let seed;
        if (extension === "pdf") {
          const result = await extractTextFromPdf(file);
          seed = result.resumeData || parseResumeText(result.text);
        } else if (extension === "docx") {
          const result = await extractTextFromDocx(file);
          seed = result.resumeData || parseResumeText(result.text);
        } else if (extension === "tex") {
          const text = await file.text();
          seed = text.includes("\\CVField{")
            ? parseLatexFields(text, { basics: {}, format: {}, layout: {} }).data
            : parseResumeText(text);
        } else
          seed = parseLinkedMarkdown(await file.text(), { basics: {}, format: {}, layout: {} });
        imported = {
          name: file.name.replace(/\.[^.]+$/, ""),
          seed,
          format: seed.format,
          layout: seed.layout,
          base: templateById(seed.template).base || templateById(seed.template).id,
        };
      } else {
        const archived =
          extension === "zip"
            ? await readArchiveEntry(file, (name) => /template\.json$/i.test(name))
            : null;
        if (extension === "zip" && !archived) throw new Error("No template JSON in bundle");
        const content = archived ? archived.text : await file.text();
        if (extension === "css")
          imported = { name: file.name.replace(/\.css$/i, ""), css: content };
        else imported = JSON.parse(content);
      }
      if (!imported || typeof imported !== "object")
        throw new Error("Template file must contain a JSON object or CSS text.");
      if (imported.basics)
        imported = {
          name: file.name.replace(/\.[^.]+$/, ""),
          seed: imported,
          format: imported.format,
          layout: imported.layout,
        };
      const templateName = imported.name || file.name.replace(/\.[^.]+$/, "");
      const idBase = `custom-${
        templateName
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "") || "template"
      }`;
      let id = imported.id && /^custom-[a-z0-9-]+$/.test(imported.id) ? imported.id : idBase;
      let suffix = 2;
      while (customTemplates.some((t) => t.id === id)) id = `${idBase}-${suffix++}`;
      const base = BUILTIN_TEMPLATES.some((item) => item.id === imported.base)
        ? imported.base
        : "modern";
      const record = {
        id,
        name: templateName,
        seed: imported.seed || null,
        variant: imported.variant || base,
        base,
        css: sanitizeTemplateCss(imported.css || ""),
        format: imported.format || deepClone(resume.format || {}),
        layout: imported.layout || deepClone(resume.layout || {}),
      };
      customTemplates.push(record);
      persistTemplates();
      resume.template = id;
      resume.format = { ...(resume.format || {}), ...record.format };
      resume.layout = { ...(resume.layout || {}), ...record.layout };
      updateDocumentStatus();
      syncControls();
      close();
      toast(`${templateName} imported`);
    } catch (error) {
      toast(`Could not import template: ${error.message}`);
    }
  });
}
function showAddLinkModal() {
  $("#modalRoot").innerHTML =
    `<div class="modal-backdrop" id="linkBackdrop"><div class="modal" role="dialog" aria-modal="true"><h2>Add a hyperlink</h2><p>Add a clickable link to the resume. The label and destination remain editable in JSON.</p><div class="form-field"><label for="linkLabel">Label</label><input id="linkLabel" placeholder="Portfolio"></div><div class="form-field"><label for="linkUrl">URL</label><input id="linkUrl" type="url" placeholder="https://example.com"></div><div class="modal-actions"><button class="button" id="cancelLink">Cancel</button><button class="button primary" id="createLink">Add link</button></div></div></div>`;
  const close = () => {
    $("#modalRoot").innerHTML = "";
  };
  $("#cancelLink").onclick = close;
  $("#linkBackdrop").addEventListener("click", (event) => {
    if (event.target.id === "linkBackdrop") close();
  });
  $("#createLink").onclick = () => {
    const label = $("#linkLabel").value.trim(),
      url = $("#linkUrl").value.trim();
    if (!label || !url) {
      $("#linkLabel").focus();
      return;
    }
    if (!Array.isArray(resume.links)) resume.links = [];
    resume.links.push({ label, url });
    updateDocumentStatus();
    close();
    toast("Hyperlink added to the resume");
  };
}
function toast(message) {
  const node = $("#toast");
  node.textContent = message;
  node.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => node.classList.remove("show"), 2100);
}

// PDF coordinates are derived from the document pages; source JSON is embedded for import.
const CP1252 = new Map([
  [0x20ac, 0x80],
  [0x201a, 0x82],
  [0x0192, 0x83],
  [0x201e, 0x84],
  [0x2026, 0x85],
  [0x2020, 0x86],
  [0x2021, 0x87],
  [0x02c6, 0x88],
  [0x2030, 0x89],
  [0x0160, 0x8a],
  [0x2039, 0x8b],
  [0x0152, 0x8c],
  [0x017d, 0x8e],
  [0x2018, 0x91],
  [0x2019, 0x92],
  [0x201c, 0x93],
  [0x201d, 0x94],
  [0x2022, 0x95],
  [0x2013, 0x96],
  [0x2014, 0x97],
  [0x02dc, 0x98],
  [0x2122, 0x99],
  [0x0161, 0x9a],
  [0x203a, 0x9b],
  [0x0153, 0x9c],
  [0x017e, 0x9e],
  [0x0178, 0x9f],
]);
function pdfBytes(text) {
  let hex = "";
  for (const char of String(text ?? "")) {
    const cp = char.codePointAt(0);
    const byte = CP1252.get(cp) ?? (cp <= 255 && !(cp >= 0x80 && cp <= 0x9f) ? cp : 0x3f);
    hex += byte.toString(16).padStart(2, "0");
  }
  return `<${hex}>`;
}
function hexRgb(hex) {
  const clean = /^#[0-9a-f]{6}$/i.test(hex || "") ? hex.slice(1) : "496f91";
  return [0, 2, 4].map((i) => parseInt(clean.slice(i, i + 2), 16) / 255);
}
function pdfColor(hex) {
  return hexRgb(hex)
    .map((n) => n.toFixed(3))
    .join(" ");
}
function withDocumentPages(callback) {
  const host = document.createElement("div");
  host.className = "measure-preview";
  host.style.cssText = `position:absolute;left:-20000px;top:0;width:${PAGE.width}px;visibility:hidden;pointer-events:none`;
  const template = templateById(resume.template);
  if (customTemplates.some((item) => item.id === template.id)) host.dataset.template = template.id;
  const pages = buildPreviewPages();
  pages.forEach((page) => host.appendChild(page));
  document.body.appendChild(host);
  try {
    return callback(pages.map((page) => $(".resume-paper", page)));
  } finally {
    host.remove();
  }
}
function cssColor(value) {
  const channels = String(value)
    .match(/[\d.]+/g)
    ?.map(Number);
  if (!channels || channels.length < 3 || channels[3] === 0) return null;
  return channels
    .slice(0, 3)
    .map((channel) => Math.round(channel).toString(16).padStart(2, "0"))
    .join("");
}
function pdfBuildPages() {
  return withDocumentPages((papers) => {
    const streams = [],
      annotations = [];
    papers.forEach((paper, index) => {
      const bounds = paper.getBoundingClientRect(),
        scale = 0.75,
        ops = [],
        links = [];
      const rect = (box, color) => {
        if (!color || !box.width || !box.height) return;
        ops.push(
          `q ${pdfColor("#" + color)} rg ${((box.left - bounds.left) * scale).toFixed(2)} ${((PAGE.height - (box.bottom - bounds.top)) * scale).toFixed(2)} ${(box.width * scale).toFixed(2)} ${(box.height * scale).toFixed(2)} re f Q`,
        );
      };
      const line = (x1, y1, x2, y2, color, width, dash = false) => {
        ops.push(
          `q ${pdfColor("#" + color)} RG ${width.toFixed(2)} w ${dash ? "[3 2] 0 d" : ""} ${x1.toFixed(2)} ${y1.toFixed(2)} m ${x2.toFixed(2)} ${y2.toFixed(2)} l S Q`,
        );
      };
      [paper, ...$$("*", paper)].forEach((node) => {
        if (node.matches(".sidebar-resizer")) return;
        const style = getComputedStyle(node),
          box = node.getBoundingClientRect();
        rect(box, cssColor(style.backgroundColor));
        for (const side of ["Top", "Right", "Bottom", "Left"]) {
          const width = parseFloat(style["border" + side + "Width"]),
            kind = style["border" + side + "Style"],
            color = cssColor(style["border" + side + "Color"]);
          if (!width || kind === "none" || !color) continue;
          const left = (box.left - bounds.left) * scale,
            right = (box.right - bounds.left) * scale,
            top = PAGE.pdfHeight - (box.top - bounds.top) * scale,
            bottom = PAGE.pdfHeight - (box.bottom - bounds.top) * scale;
          const coords =
            side === "Top"
              ? [left, top, right, top]
              : side === "Bottom"
                ? [left, bottom, right, bottom]
                : side === "Left"
                  ? [left, top, left, bottom]
                  : [right, top, right, bottom];
          line(...coords, color, width * scale, kind === "dashed");
          if (kind === "double") {
            const double = coords.slice();
            if (side === "Top" || side === "Bottom") {
              double[1] -= 2;
              double[3] -= 2;
            } else {
              double[0] += 2;
              double[2] += 2;
            }
            line(...double, color, Math.max(0.4, (width * scale) / 3));
          }
        }
      });
      const walker = document.createTreeWalker(paper, NodeFilter.SHOW_TEXT);
      let textNode;
      while ((textNode = walker.nextNode())) {
        if (!textNode.textContent.trim()) continue;
        const parent = textNode.parentElement,
          style = getComputedStyle(parent);
        if (
          style.display === "none" ||
          (style.visibility === "hidden" && parent.closest(".hidden"))
        )
          continue;
        const size = parseFloat(style.fontSize) * scale,
          color = cssColor(style.color) || "26323c";
        const family =
          /Georgia|Times|serif/.test(style.fontFamily) && !/sans-serif/.test(style.fontFamily)
            ? "T"
            : "H";
        const face =
          (Number(style.fontWeight) >= 600 ? "B" : "") +
            (/italic|oblique/.test(style.fontStyle) ? "I" : "") || "R";
        let run = "",
          runBox = null,
          lastTop = null;
        const flush = () => {
          if (!run.trim() || !runBox) return;
          let text =
            style.textTransform === "uppercase"
              ? run.toUpperCase()
              : style.textTransform === "lowercase"
                ? run.toLowerCase()
                : run;
          const x = (runBox.left - bounds.left) * scale,
            y = PAGE.pdfHeight - (runBox.top - bounds.top) * scale - size * 0.83;
          if (parent.matches(".bullet-marker") && text.includes("▪")) {
            rect(
              {
                left: runBox.left,
                top: runBox.top + (size * 0.5) / scale,
                width: (size * 0.32) / scale,
                height: (size * 0.32) / scale,
                bottom: runBox.top + (size * 0.82) / scale,
              },
              color,
            );
          } else
            ops.push(
              `BT /${family}${face} ${size.toFixed(2)} Tf ${pdfColor("#" + color)} rg 1 0 0 1 ${x.toFixed(2)} ${y.toFixed(2)} Tm ${pdfBytes(text)} Tj ET`,
            );
          if (style.textDecorationLine.includes("underline"))
            line(x, y - 1, x + runBox.width * scale, y - 1, color, 0.5);
          run = "";
          runBox = null;
        };
        const range = document.createRange();
        const addText = (text, start, end) => {
          range.setStart(textNode, start);
          range.setEnd(textNode, end);
          const box = range.getBoundingClientRect();
          if (!box.width && !text.trim()) return;
          if (lastTop !== null && Math.abs(box.top - lastTop) > 2) flush();
          if (!runBox)
            runBox = { left: box.left, top: box.top, width: box.width, right: box.right };
          else {
            runBox.right = Math.max(runBox.right, box.right);
            runBox.width = runBox.right - runBox.left;
          }
          run += text;
          lastTop = box.top;
        };
        for (const token of textNode.textContent.matchAll(/\S+\s*|\s+/g)) {
          range.setStart(textNode, token.index);
          range.setEnd(textNode, token.index + token[0].length);
          const rects = [...range.getClientRects()];
          if (rects.length > 1 && rects.some((box) => Math.abs(box.top - rects[0].top) > 2)) {
            let position = token.index;
            for (const char of token[0]) {
              addText(char, position, position + char.length);
              position += char.length;
            }
          } else addText(token[0], token.index, token.index + token[0].length);
        }
        flush();
      }
      $$("a[href]", paper).forEach((node) => {
        const box = node.getBoundingClientRect();
        links.push({
          url: node.getAttribute("href"),
          rect: [
            (box.left - bounds.left) * scale,
            PAGE.pdfHeight - (box.bottom - bounds.top) * scale,
            (box.right - bounds.left) * scale,
            PAGE.pdfHeight - (box.top - bounds.top) * scale,
          ],
        });
      });
      ops.push(
        `BT /HR 8 Tf 0.42 0.48 0.54 rg 1 0 0 1 535 773 Tm ${pdfBytes(`${index + 1} / ${papers.length}`)} Tj ET`,
      );
      streams.push(ops.join("\n"));
      annotations.push(links);
    });
    streams.annotations = annotations;
    return streams;
  });
}

function makePdf(streams = pdfBuildPages()) {
  const objects = [];
  const add = (body) => {
    objects.push(body);
    return objects.length;
  };
  const catalogId = add("");
  const pagesId = add("");
  const fontDefs = [
    ["HR", "Helvetica"],
    ["HB", "Helvetica-Bold"],
    ["HI", "Helvetica-Oblique"],
    ["HBI", "Helvetica-BoldOblique"],
    ["TR", "Times-Roman"],
    ["TB", "Times-Bold"],
    ["TI", "Times-Italic"],
    ["TBI", "Times-BoldItalic"],
  ];
  const fontIds = {};
  for (const [key, name] of fontDefs)
    fontIds[key] = add(
      `<< /Type /Font /Subtype /Type1 /BaseFont /${name} /Encoding /WinAnsiEncoding >>`,
    );
  const pageIds = [];
  streams.forEach((stream) => {
    const streamId = add(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
    const pageId = add("");
    const fontMap = Object.entries(fontIds)
      .map(([key, id]) => `/${key} ${id} 0 R`)
      .join(" ");
    objects[pageId - 1] =
      `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${PAGE.pdfWidth} ${PAGE.pdfHeight}] /Resources << /Font << ${fontMap} >> >> /Contents ${streamId} 0 R >>`;
    const annotationIds = (streams.annotations?.[pageIds.length] || []).map((link) =>
      add(
        "<< /Type /Annot /Subtype /Link /Rect [" +
          link.rect.map((value) => Number(value).toFixed(2)).join(" ") +
          "] /Border [0 0 0] /A << /S /URI /URI " +
          pdfBytes(link.url) +
          " >> >>",
      ),
    );
    if (annotationIds.length)
      objects[pageId - 1] = objects[pageId - 1].replace(
        "/Contents ",
        "/Annots [" + annotationIds.map((id) => id + " 0 R").join(" ") + "] /Contents ",
      );
    pageIds.push(pageId);
  });
  const sourceJson = JSON.stringify(resume).replace(
    /[\u007f-\uffff]/g,
    (char) => "\\u" + char.charCodeAt(0).toString(16).padStart(4, "0"),
  );
  const embeddedId = add(
    `<< /Type /EmbeddedFile /Subtype /application#2Fjson /Length ${sourceJson.length} >>\nstream\n${sourceJson}\nendstream`,
  );
  const fileId = add(`<< /Type /Filespec /F (forma-resume.json) /EF << /F ${embeddedId} 0 R >> >>`);
  objects[catalogId - 1] =
    `<< /Type /Catalog /Pages ${pagesId} 0 R /Names << /EmbeddedFiles << /Names [(forma-resume.json) ${fileId} 0 R] >> >> >>`;
  objects[pagesId - 1] =
    `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;
  let pdf = "%PDF-1.4\n%Résumé 2.0\n";
  const offsets = [0];
  objects.forEach((body, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new Blob([new TextEncoder().encode(pdf)], { type: "application/pdf" });
}

function xmlEscape(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
let wordRelationshipXml = "";
function wordXml() {
  const wordLinks = [];
  let nextLink = 1;
  const run = (text, node) => {
    const style = getComputedStyle(node),
      color = cssColor(style.color) || "26323c",
      highlight = cssColor(style.backgroundColor);
    const font = xmlEscape(style.fontFamily.split(",")[0].replace(/["']/g, "").trim());
    const size = Math.round(parseFloat(style.fontSize) * 0.75 * 2);
    const properties = `<w:rPr><w:rFonts w:ascii="${font}" w:hAnsi="${font}"/><w:sz w:val="${size}"/><w:color w:val="${color}"/>${Number(style.fontWeight) >= 600 ? "<w:b/>" : ""}${/italic|oblique/.test(style.fontStyle) ? "<w:i/>" : ""}${style.textDecorationLine.includes("underline") ? '<w:u w:val="single"/>' : ""}${highlight ? `<w:shd w:val="clear" w:fill="${highlight}"/>` : ""}</w:rPr>`;
    let value =
      style.textTransform === "uppercase"
        ? text.toUpperCase()
        : style.textTransform === "lowercase"
          ? text.toLowerCase()
          : text;
    const content = `<w:r>${properties}${value
      .split(/(\n|\t)/)
      .map((part) =>
        part === "\n"
          ? "<w:br/>"
          : part === "\t"
            ? "<w:tab/>"
            : `<w:t xml:space="preserve">${xmlEscape(part)}</w:t>`,
      )
      .join("")}</w:r>`;
    const anchor = node.closest("a[href]");
    if (!anchor) return content;
    const id = "rId" + nextLink++;
    wordLinks.push(
      `<Relationship Id="${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="${xmlEscape(anchor.getAttribute("href"))}" TargetMode="External"/>`,
    );
    return `<w:hyperlink r:id="${id}">${content}</w:hyperlink>`;
  };
  const inline = (node) => {
    if (node.nodeType === Node.TEXT_NODE) return run(node.textContent, node.parentElement);
    if (node.nodeType !== Node.ELEMENT_NODE) return "";
    if (node.matches("br")) return "<w:r><w:br/></w:r>";
    if (node.matches(".bullet-marker")) return "";
    const children = [...node.childNodes];
    return children
      .map(
        (child, index) =>
          inline(child) +
          (index < children.length - 1 && node.matches(".resume-contact,.resume-skills")
            ? run("   ·   ", node)
            : index < children.length - 1 && node.matches(".resume-entry-head")
              ? "<w:r><w:tab/></w:r>"
              : ""),
      )
      .join("");
  };
  const paragraph = (node) => {
    const style = getComputedStyle(node),
      heading = node.matches("h1,h2,h3,h4"),
      bullet = node.matches("li");
    const align =
      style.textAlign === "justify"
        ? "both"
        : ["left", "center", "right"].includes(style.textAlign)
          ? style.textAlign
          : "left";
    const before = Math.max(0, Math.round(parseFloat(style.marginTop) * 15)),
      after = Math.max(0, Math.round(parseFloat(style.marginBottom) * 15));
    const lineHeight = Math.round(parseFloat(style.lineHeight) * 15) || 240;
    const border =
      style.borderBottomStyle !== "none" && parseFloat(style.borderBottomWidth) > 0
        ? `<w:pBdr><w:bottom w:val="${style.borderBottomStyle === "double" ? "double" : style.borderBottomStyle === "dashed" ? "dashed" : "single"}" w:sz="${Math.max(2, Math.round(parseFloat(style.borderBottomWidth) * 6))}" w:color="${cssColor(style.borderBottomColor) || "aab7c1"}"/></w:pBdr>`
        : "";
    return `<w:p><w:pPr>${heading ? "<w:keepNext/>" : ""}${bullet ? `<w:numPr><w:ilvl w:val="0"/><w:numId w:val="${node.parentElement.matches("ol") ? 2 : 1}"/></w:numPr><w:ind w:left="240" w:hanging="150"/>` : ""}<w:spacing w:before="${before}" w:after="${after}" w:line="${lineHeight}" w:lineRule="atLeast"/><w:jc w:val="${align}"/>${node.matches(".resume-entry-head") ? `<w:tabs><w:tab w:val="right" w:pos="${Math.round(node.getBoundingClientRect().width * 15)}"/></w:tabs>` : ""}${border}</w:pPr>${inline(node)}</w:p>`;
  };
  const zoneContent = (zone) => {
    let html = "";
    const visit = (node) => {
      if (node.matches(".resume-section")) {
        const space = Math.max(0, Math.round(parseFloat(getComputedStyle(node).marginTop) * 15));
        html += `<w:p><w:pPr><w:spacing w:after="0" w:before="${space}" w:line="1" w:lineRule="exact"/></w:pPr></w:p>`;
      }
      if (
        node.matches(
          ".resume-name,.resume-role,.resume-contact,.resume-section-title,h1,h2,h3,h4,p,blockquote,.resume-entry-head,.resume-entry-sub,li,.resume-skills",
        ) ||
        (node.matches("div") && !node.querySelector("p,div,h1,h2,h3,h4,ul,ol,section,header"))
      ) {
        html += paragraph(node);
        return;
      }
      [...node.children].forEach(visit);
      if (node.matches(".resume-header,.resume-entry")) {
        const space = Math.max(0, Math.round(parseFloat(getComputedStyle(node).marginBottom) * 15));
        if (space)
          html += `<w:p><w:pPr><w:spacing w:after="${space}" w:before="0" w:line="1" w:lineRule="exact"/></w:pPr></w:p>`;
      }
    };
    [...zone.children].forEach(visit);
    return html || "<w:p/>";
  };
  let pageMargins = { top: 825, right: 930, bottom: 825, left: 930 };
  const body = withDocumentPages((papers) =>
    papers
      .map((paper, index) => {
        const pageStyle = getComputedStyle(paper);
        if (index === 0)
          pageMargins = Object.fromEntries(
            ["top", "right", "bottom", "left"].map((side) => [
              side,
              Math.round(
                parseFloat(pageStyle["padding" + side[0].toUpperCase() + side.slice(1)]) * 15,
              ),
            ]),
          );
        const sidebar = $(".resume-aside", paper);
        let content;
        if (sidebar) {
          const left = Math.round(sidebar.getBoundingClientRect().width * 15),
            right = PAGE.twipWidth - left;
          const cell = (zone, width, color) =>
            `<w:tc><w:tcPr><w:tcW w:w="${width}" w:type="dxa"/>${color ? `<w:shd w:val="clear" w:fill="${color}"/>` : ""}<w:tcMar><w:top w:w="500" w:type="dxa"/><w:bottom w:w="500" w:type="dxa"/><w:left w:w="330" w:type="dxa"/><w:right w:w="330" w:type="dxa"/></w:tcMar></w:tcPr>${zoneContent(zone)}</w:tc>`;
          content = `<w:tbl><w:tblPr><w:tblW w:w="${PAGE.twipWidth}" w:type="dxa"/><w:tblLayout w:type="fixed"/><w:tblBorders><w:top w:val="nil"/><w:bottom w:val="nil"/><w:left w:val="nil"/><w:right w:val="nil"/><w:insideV w:val="nil"/></w:tblBorders></w:tblPr><w:tblGrid><w:gridCol w:w="${left}"/><w:gridCol w:w="${right}"/></w:tblGrid><w:tr><w:trPr><w:cantSplit/></w:trPr>${cell($('.drop-zone[data-zone="sidebar"]', paper), left, cssColor(getComputedStyle(sidebar).backgroundColor))}${cell($('.drop-zone[data-zone="main"]', paper), right, null)}</w:tr></w:tbl><w:p/>`;
        } else content = zoneContent($(".drop-zone", paper));
        return (index ? '<w:p><w:r><w:br w:type="page"/></w:r></w:p>' : "") + content;
      })
      .join(""),
  );
  wordRelationshipXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${wordLinks.join("")}<Relationship Id="rIdNumbering" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/><Relationship Id="rIdPageHeader" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/></Relationships>`;
  const template = templateById(resume.template),
    executive = effectiveTemplateId(template) === "executive";

  const borderColor =
    resume.layout?.pageBorder === "accent"
      ? (resume.format?.accent || "#496f91").slice(1)
      : "dfe4e8";
  const border = ["accent", "hairline"].includes(resume.layout?.pageBorder)
    ? `<w:pgBorders w:offsetFrom="page">${["top", "left", "bottom", "right"].map((side) => `<w:${side} w:val="single" w:sz="6" w:space="18" w:color="${borderColor}"/>`).join("")}</w:pgBorders>`
    : "";
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>${body}<w:sectPr><w:headerReference w:type="default" r:id="rIdPageHeader"/><w:pgSz w:w="${PAGE.twipWidth}" w:h="${PAGE.twipHeight}"/><w:pgMar w:top="${pageMargins.top}" w:right="${pageMargins.right}" w:bottom="${pageMargins.bottom}" w:left="${pageMargins.left}" w:header="280" w:footer="280"/>${border}</w:sectPr></w:body></w:document>`;
}

const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();
function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
function u16(value) {
  return [value & 255, (value >>> 8) & 255];
}
function u32(value) {
  return [value & 255, (value >>> 8) & 255, (value >>> 16) & 255, (value >>> 24) & 255];
}
function makeZip(files, mime = "application/zip") {
  const encoder = new TextEncoder(),
    localParts = [],
    centralParts = [];
  let offset = 0;
  for (const [name, content] of files) {
    const nameBytes = encoder.encode(name),
      data =
        content instanceof Uint8Array
          ? content
          : content instanceof ArrayBuffer
            ? new Uint8Array(content)
            : encoder.encode(String(content)),
      crc = crc32(data);
    const local = new Uint8Array([
      ...u32(0x04034b50),
      ...u16(20),
      ...u16(0),
      ...u16(0),
      ...u16(0),
      ...u16(0),
      ...u32(crc),
      ...u32(data.length),
      ...u32(data.length),
      ...u16(nameBytes.length),
      ...u16(0),
      ...nameBytes,
      ...data,
    ]);
    localParts.push(local);
    const central = new Uint8Array([
      ...u32(0x02014b50),
      ...u16(20),
      ...u16(20),
      ...u16(0),
      ...u16(0),
      ...u16(0),
      ...u16(0),
      ...u32(crc),
      ...u32(data.length),
      ...u32(data.length),
      ...u16(nameBytes.length),
      ...u16(0),
      ...u16(0),
      ...u16(0),
      ...u16(0),
      ...u32(0),
      ...u32(offset),
      ...nameBytes,
    ]);
    centralParts.push(central);
    offset += local.length;
  }
  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const end = new Uint8Array([
    ...u32(0x06054b50),
    ...u16(0),
    ...u16(0),
    ...u16(files.length),
    ...u16(files.length),
    ...u32(centralSize),
    ...u32(offset),
    ...u16(0),
  ]);
  return new Blob([...localParts, ...centralParts, end], { type: mime });
}
function makeDocx() {
  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="json" ContentType="application/json"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/><Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/></Types>`;
  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`;
  const documentXml = wordXml();
  const headerXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p><w:pPr><w:jc w:val="right"/></w:pPr><w:r><w:rPr><w:color w:val="687681"/><w:sz w:val="16"/></w:rPr><w:t>Page </w:t></w:r><w:fldSimple w:instr="PAGE"><w:r><w:rPr><w:color w:val="687681"/><w:sz w:val="16"/></w:rPr><w:t>1</w:t></w:r></w:fldSimple><w:r><w:rPr><w:color w:val="687681"/><w:sz w:val="16"/></w:rPr><w:t xml:space="preserve"> of </w:t></w:r><w:fldSimple w:instr="NUMPAGES"><w:r><w:rPr><w:color w:val="687681"/><w:sz w:val="16"/></w:rPr><w:t>1</w:t></w:r></w:fldSimple></w:p></w:hdr>`;
  const files = [
    ["[Content_Types].xml", contentTypes],
    ["_rels/.rels", rels],
    ["word/document.xml", documentXml],
    ["word/header1.xml", headerXml],
    ["word/numbering.xml", wordNumberingXml()],
    ["word/_rels/document.xml.rels", wordRelationshipXml],
    ["forma/resume.json", JSON.stringify(resume, null, 2)],
  ];
  return makeZip(files, "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
}
function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function safeFilename() {
  const name = resume.basics?.name || "resume";
  return (
    String(name)
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "resume"
  );
}
async function exportFormat(format) {
  saveWordDocument();
  if (format === "print") return printDocument();
  if (format === "zip") return exportWorkspaceZip();
  const original = currentOriginal();
  if (viewingOriginal() && original.format === (format === "word" ? "docx" : format)) {
    try {
      const file = await OriginalFiles.get(original.id);
      if (!file) throw new Error("Import the uploaded document or restore its session ZIP.");
      download(file, original.name);
      toast("Uploaded document downloaded");
    } catch (error) {
      toast(error.message);
    }
    return;
  }
  if (sourceDraftError()) {
    toast("Fix the current source error before exporting, or save a session ZIP");
    return;
  }
  if (document.activeElement === latexEditor) updateFromLatex(latexEditor.value);
  const stem = safeFilename();
  if (exportV2Format(format, stem)) return;
  if (format === "latex") {
    download(new Blob([latexSource()], { type: "application/x-tex;charset=utf-8" }), `${stem}.tex`);
    toast("LaTeX source downloaded");
  } else if (format === "word") {
    download(makeDocx(), `${stem}.docx`);
    toast("Word document downloaded");
  } else if (format === "markdown") {
    download(new Blob([markdownSource()], { type: "text/markdown;charset=utf-8" }), `${stem}.md`);
    toast("Markdown resume downloaded");
  } else if (format === "json") {
    download(
      new Blob([JSON.stringify(resume, null, 2)], { type: "application/json;charset=utf-8" }),
      `${stem}.json`,
    );
    toast("Resume JSON downloaded");
  } else {
    download(makePdf(), `${stem}.pdf`);
    toast("PDF downloaded");
  }
}
async function downloadCompiledArtifact(format) {
  if (!compiledArtifacts) return exportFormat(format);
  const build = compiledArtifacts;
  const stem = build.filename;
  if (format === "latex")
    download(new Blob([build.tex], { type: "application/x-tex;charset=utf-8" }), stem + ".tex");
  else if (format === "word") download(build.docx, stem + ".docx");
  else if (format === "markdown")
    download(new Blob([build.md], { type: "text/markdown;charset=utf-8" }), stem + ".md");
  else if (format === "json")
    download(new Blob([build.json], { type: "application/json;charset=utf-8" }), stem + ".json");
  else if (format === "zip") {
    const pdfBytes = new Uint8Array(await build.pdf.arrayBuffer());
    const docxBytes = new Uint8Array(await build.docx.arrayBuffer());
    const bundle = makeZip([
      [stem + ".pdf", pdfBytes],
      [stem + ".tex", build.tex],
      [stem + ".docx", docxBytes],
      [stem + ".md", build.md],
      [stem + ".json", build.json],
      ["template.json", JSON.stringify(build.template, null, 2)],
    ]);
    download(bundle, stem + "-compiled-bundle.zip");
  } else download(build.pdf, stem + ".pdf");
  toast("Compiled " + format.toUpperCase() + " downloaded");
}

function printDocument() {
  const host = document.createElement("div");
  host.id = "printDocument";
  const template = templateById(resume.template);
  if (customTemplates.some((item) => item.id === template.id)) host.dataset.template = template.id;
  buildPreviewPages().forEach((page) => host.appendChild(page.querySelector(".resume-paper")));
  document.body.appendChild(host);
  const cleanup = () => host.remove();
  window.addEventListener("afterprint", cleanup, { once: true });
  window.print();
  setTimeout(cleanup, 60000);
}
function exportCurrent() {
  return exportFormat(activeMode);
}

jsonEditor.addEventListener("input", (event) => {
  if (!event.isComposing) parseJsonLive();
});
jsonEditor.addEventListener("scroll", () => {
  $("#highlight").style.transform =
    `translate(${-jsonEditor.scrollLeft}px, ${-jsonEditor.scrollTop}px)`;
  $("#lineNumbers").style.transform = `translateY(${-jsonEditor.scrollTop}px)`;
});
jsonEditor.addEventListener("keydown", (event) => {
  if (event.key === "Tab") {
    event.preventDefault();
    const start = jsonEditor.selectionStart,
      end = jsonEditor.selectionEnd;
    jsonEditor.setRangeText("  ", start, end, "end");
    parseJsonLive();
  }
});
latexEditor.addEventListener("input", (event) => {
  if (event.isComposing) return;
  highlightLatex();
  if (!updateFromLatex(latexEditor.value) && !sourceState.latexError) {
    resume.format = { ...(resume.format || {}), latexTemplate: latexEditor.value };
    updateJsonEditor();
    setJsonStatus("LaTeX template saved · CVField values sync to JSON");
  }
});
latexEditor.addEventListener("blur", () => {
  updateJsonEditor();
});
latexEditor.addEventListener("scroll", () => {
  latexHighlight.style.transform = `translate(${-latexEditor.scrollLeft}px, ${-latexEditor.scrollTop}px)`;
});
attachPreviewInteractions();
renderPanelOrder();
const workspacePanels = $("#workspacePanels");
function panelResizeVertical() {
  return false;
}
workspacePanels.addEventListener("pointerdown", (event) => {
  const divider = event.target.closest(".pane-resizer[data-left-panel]");
  if (!divider || divider.classList.contains("inactive")) return;
  event.preventDefault();
  const left = divider.dataset.leftPanel,
    right = divider.dataset.rightPanel;
  const bounds = workspacePanels.getBoundingClientRect();
  const vertical = panelResizeVertical();
  const origin = vertical ? event.clientY : event.clientX;
  const size = vertical ? bounds.height : bounds.width;
  const pairTotal = Number(panelWeights[left]) + Number(panelWeights[right]);
  const initialLeft = Number(panelWeights[left]);
  const move = (moveEvent) => {
    const current = vertical ? moveEvent.clientY : moveEvent.clientX;
    const delta = ((current - origin) / Math.max(1, size)) * 100;
    const nextLeft = Math.max(16, Math.min(pairTotal - 16, initialLeft + delta));
    panelWeights[left] = nextLeft;
    panelWeights[right] = pairTotal - nextLeft;
    ["json", "xml", "latex", "markdown"].forEach(
      (id) => (panelWeights[id] = panelWeights[left === "output" ? right : left]),
    );
    workspace.panelWeights = panelWeights;
    setPanelGrid();
  };
  const finish = () => {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", finish);
    window.removeEventListener("pointercancel", finish);
    saveWorkspace();
  };
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", finish, { once: true });
  window.addEventListener("pointercancel", finish, { once: true });
});
workspacePanels.addEventListener("keydown", (event) => {
  const divider = event.target.closest(".pane-resizer[data-left-panel]");
  if (!divider || divider.classList.contains("inactive")) return;
  const vertical = panelResizeVertical();
  const decrement = vertical ? event.key === "ArrowUp" : event.key === "ArrowLeft";
  const increment = vertical ? event.key === "ArrowDown" : event.key === "ArrowRight";
  if (!decrement && !increment) return;
  event.preventDefault();
  const left = divider.dataset.leftPanel,
    right = divider.dataset.rightPanel;
  const total = panelWeights[left] + panelWeights[right];
  const nextLeft = Math.max(16, Math.min(total - 16, panelWeights[left] + (increment ? 2 : -2)));
  panelWeights[left] = nextLeft;
  panelWeights[right] = total - nextLeft;
  ["json", "xml", "latex", "markdown"].forEach(
    (id) => (panelWeights[id] = panelWeights[left === "output" ? right : left]),
  );
  workspace.panelWeights = panelWeights;
  setPanelGrid();
  saveWorkspace();
});
let draggedPanel = "";
workspacePanels.addEventListener("dragstart", (event) => {
  const handle = event.target.closest("[data-panel-handle]");
  if (!handle) return;
  if (event.target.closest("button,input,select,textarea,summary")) {
    event.preventDefault();
    return;
  }
  draggedPanel = handle.dataset.panelHandle;
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData("text/plain", draggedPanel);
});
workspacePanels.addEventListener("dragover", (event) => {
  const pane = event.target.closest(".pane[data-panel-id]");
  if (!draggedPanel || !pane || pane.dataset.panelId === draggedPanel) return;
  event.preventDefault();
  pane.classList.add("drag-hover");
});
workspacePanels.addEventListener("dragleave", (event) =>
  event.target.closest(".pane")?.classList.remove("drag-hover"),
);
workspacePanels.addEventListener("drop", (event) => {
  const pane = event.target.closest(".pane[data-panel-id]");
  if (!draggedPanel || !pane || pane.dataset.panelId === draggedPanel) return;
  event.preventDefault();
  const box = pane.getBoundingClientRect();
  const after = panelResizeVertical()
    ? event.clientY > box.top + box.height / 2
    : event.clientX > box.left + box.width / 2;
  reorderPanels(draggedPanel, pane.dataset.panelId, after);
  $$(".pane.drag-hover", workspacePanels).forEach((node) => node.classList.remove("drag-hover"));
  draggedPanel = "";
});
workspacePanels.addEventListener("dragend", () => {
  draggedPanel = "";
  $$(".pane.drag-hover", workspacePanels).forEach((node) => node.classList.remove("drag-hover"));
});
window.addEventListener("resize", setPanelGrid);
let workspaceSidebarWidth = Math.max(
  130,
  Math.min(240, Number(safeStorageGet("forma.workspace.sidebar.width.v2")) || 150),
);
$(".main").style.setProperty("--workspace-sidebar-width", workspaceSidebarWidth + "px");
const workspaceSidebarResizer = $("#workspaceSidebarResizer");
workspaceSidebarResizer.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  const mainBounds = $(".main").getBoundingClientRect();
  const move = (moveEvent) => {
    workspaceSidebarWidth = Math.max(
      130,
      Math.min(240, Math.round(moveEvent.clientX - mainBounds.left - 12)),
    );
    $(".main").style.setProperty("--workspace-sidebar-width", workspaceSidebarWidth + "px");
  };
  const finish = () => {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", finish);
    safeStorageSet("forma.workspace.sidebar.width.v2", String(workspaceSidebarWidth));
  };
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", finish, { once: true });
});
workspaceSidebarResizer.addEventListener("keydown", (event) => {
  if (!["ArrowLeft", "ArrowRight"].includes(event.key)) return;
  event.preventDefault();
  workspaceSidebarWidth = Math.max(
    130,
    Math.min(240, workspaceSidebarWidth + (event.key === "ArrowRight" ? 12 : -12)),
  );
  $(".main").style.setProperty("--workspace-sidebar-width", workspaceSidebarWidth + "px");
  safeStorageSet("forma.workspace.sidebar.width.v2", String(workspaceSidebarWidth));
});
$("#resumeTabs").addEventListener("click", (event) => {
  const closeId = event.target.closest("[data-close-tab]")?.dataset.closeTab;
  if (closeId) {
    event.stopPropagation();
    if (workspace.openIds.length > 1) {
      const index = workspace.openIds.indexOf(closeId);
      workspace.openIds = workspace.openIds.filter((id) => id !== closeId);
      if (closeId === activeResumeId)
        switchResume(workspace.openIds[Math.max(0, index - 1)] || workspace.openIds[0]);
      else renderWorkspace();
    }
    return;
  }
  const tabId = event.target.closest("[data-resume-tab]")?.dataset.resumeTab;
  if (tabId && tabId !== activeResumeId) switchResume(tabId);
});
$("#resumeTabs").addEventListener("dblclick", (event) => {
  const tab = event.target.closest("[data-resume-tab]");
  if (!tab) return;
  const item = workspace.resumes.find((record) => record.id === tab.dataset.resumeTab);
  if (item) showRenameDialog(item);
});
$("#folderTree").addEventListener("click", (event) => {
  const menu = event.target.closest("[data-file-menu]");
  if (menu) {
    event.stopPropagation();
    showFileMenu(menu.dataset.fileMenu, menu);
    return;
  }
  const file = event.target.closest("[data-resume-file]");
  if (file) {
    switchResume(file.dataset.resumeFile);
    return;
  }
  const folder = event.target.closest("[data-folder-id]");
  if (folder) {
    const id = folder.dataset.folderId;
    workspace.collapsedFolders = workspace.collapsedFolders.includes(id)
      ? workspace.collapsedFolders.filter((value) => value !== id)
      : [...workspace.collapsedFolders, id];
    renderFolderTree();
    saveWorkspace();
  }
});
registerFileDragAndDrop();
$("#newFolderButton").addEventListener("click", showFolderDialog);
$("#importResumeButton").addEventListener("click", () => {
  pendingImportOptions = null;
  $("#resumeImportFile").click();
});
$("#resumeImportFile").addEventListener("change", (event) => {
  importResumeFile(event.target.files?.[0]);
  event.target.value = "";
});
$("#previousPage").addEventListener("click", () => {
  previewPage = Math.max(1, previewPage - 1);
  updatePageControls(true);
});
$("#nextPage").addEventListener("click", () => {
  previewPage = Math.min(previewPageCount, previewPage + 1);
  updatePageControls(true);
});
$("#pageNumber").addEventListener("change", (event) => {
  const value = Number(event.target.value);
  previewPage = Math.max(
    1,
    Math.min(previewPageCount, Number.isFinite(value) ? Math.round(value) : 1),
  );
  updatePageControls(true);
});
$("#previewZoom").value = String(previewZoom);
$("#previewZoom").addEventListener("change", (event) => {
  previewZoom = event.target.value;
  safeStorageSet("forma.preview.zoom.v4", previewZoom);
  fitPreview();
});
let previewFitFrame = 0;
new ResizeObserver(() => {
  cancelAnimationFrame(previewFitFrame);
  previewFitFrame = requestAnimationFrame(fitPreview);
}).observe($("#previewBody"));
$("#workspaceView").value = workspaceView;
$("#sidebarCollapseButton").addEventListener("click", () => togglePanel("files"));
$("#splitViewButton").onclick = () => {
  workspaceLayout = "split";
  renderPanelOrder();
};
$("#documentViewButton").onclick = () => {
  workspaceLayout = "document";
  renderPanelOrder();
};
$("#appearanceCycle").onclick = () => {
  const stages = ["apple", "light", "dark"];
  appearanceStage = stages[(stages.indexOf(appearanceStage) + 1) % stages.length];
  interfaceAppearance = appearanceStage === "light" ? "material" : "apple";
  darkMode = appearanceStage === "dark";
  safeStorageSet("forma.appearance.stage", appearanceStage);
  safeStorageSet("forma.interface.appearance", interfaceAppearance);
  safeStorageSet("forma.dark.mode", String(darkMode));
  syncControls();
};
$("#inspectPdfButton").onclick = inspectPdf;
$$("[data-input]").forEach((button) =>
  button.addEventListener("click", () => activateInput(button.dataset.input)),
);
$$(".input-tabs,.mode-tabs").forEach((list) =>
  list.addEventListener("keydown", (event) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    const tabs = [...list.querySelectorAll("[role=tab]")],
      index = tabs.indexOf(document.activeElement);
    if (index < 0) return;
    event.preventDefault();
    const next =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? tabs.length - 1
          : (index + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
    tabs[next].click();
    (tabs[next].dataset.input
      ? paneNodes[activeInput].querySelector(`[data-input="${activeInput}"]`)
      : tabs[next]
    ).focus();
  }),
);
$$("[data-copy-source]").forEach(
  (button) =>
    (button.onclick = async () => {
      try {
        await navigator.clipboard.writeText(
          activeInput === "json"
            ? jsonEditor.value
            : activeInput === "xml"
              ? $("#xmlEditor").value
              : activeInput === "latex"
                ? latexEditor.value
                : $("#markdownInput").value,
        );
        toast("Source copied");
      } catch {
        toast("Select the source text and copy it with Ctrl/Cmd+C");
      }
    }),
);
let markdownTimer;
$("#markdownInput").addEventListener("input", (event) => {
  if (event.isComposing) return;
  clearTimeout(markdownTimer);
  $("#markdownStatus").textContent = "Updating…";
  commitMarkdown();
});
$("#markdownInput").addEventListener("blur", () => {
  clearTimeout(markdownTimer);
  commitMarkdown();
});
$("#fieldRole").addEventListener("change", (event) => saveFieldStyle("role", event.target.value));
$("#compileButton").addEventListener("click", () => compileJson());
function applyTemplate(selected) {
  const custom = customTemplates.find((item) => item.id === selected);
  resume.template = selected;
  const preset = custom || templateById(selected);
  if (preset.format) resume.format = { ...(resume.format || {}), ...preset.format };
  if (preset.layout) resume.layout = { ...(resume.layout || {}), ...preset.layout };
  if (custom) {
    resume.format = { ...(resume.format || {}), ...(custom.format || {}) };
    resume.layout = { ...(resume.layout || {}), ...(custom.layout || {}) };
  }
  updateDocumentStatus();
  syncControls();
}
$("#paperSize").addEventListener("change", (event) => {
  resume.layout = { ...(resume.layout || {}), paperSize: event.target.value };
  previewPage = 1;
  syncPaperSize();
  updateDocumentStatus();
});
$("#editTemplateButton").addEventListener("click", showTemplateModal);
$("#addFieldButton").addEventListener("click", () => showAddFieldModal());
$("#addFieldButton").addEventListener("mousedown", (event) => event.preventDefault());
$("#addSectionButton").addEventListener("click", () => showAddFieldModal(true));
$("#addLinkButton").addEventListener("click", () =>
  activeMode === "word" ? showWordLinkDialog() : showAddLinkModal(),
);
$("#exportButton").addEventListener("click", () => {
  if (isCompactLayout()) $("#exportMenuToggle").click();
  else exportCurrent();
});
$("#exportMenuToggle").addEventListener("click", (event) => {
  const menu = $("#exportMenu");
  const open = menu.classList.toggle("hidden") === false;
  event.currentTarget.setAttribute("aria-expanded", String(open));
  if (isCompactLayout()) $("#exportButton").setAttribute("aria-expanded", String(open));
});
$$("#exportMenu [data-export]").forEach((button) =>
  button.addEventListener("click", () => {
    $("#exportMenu").classList.add("hidden");
    $("#exportMenuToggle").setAttribute("aria-expanded", "false");
    exportFormat(button.dataset.export);
  }),
);
document.addEventListener("click", (event) => {
  if (!event.target.closest(".export-wrap")) {
    $("#exportMenu").classList.add("hidden");
    $("#exportMenuToggle").setAttribute("aria-expanded", "false");
  }
});

$("#whyJsonButton").addEventListener("click", () => {
  location.hash = "why-json";
});
$("#whyBackButton").addEventListener("click", () => {
  if (location.hash) history.pushState(null, "", location.pathname + location.search);
  setWhyPage(false);
});
$("#closeFormatPane").addEventListener("click", closeFormatPane);
$("#fieldFont").addEventListener("change", (event) =>
  saveFieldStyle("fontFamily", event.target.value),
);
$("#fieldSize").addEventListener("change", (event) => {
  const size = Number(event.target.value);
  saveFieldStyle("fontSize", Number.isFinite(size) && size >= 6 && size <= 72 ? size : null);
});
$("#fieldColor").addEventListener("input", (event) => saveFieldStyle("color", event.target.value));
$("#fieldHighlight").addEventListener("input", (event) =>
  saveFieldStyle("highlight", event.target.value),
);
$("#fieldBorder").addEventListener("change", (event) =>
  saveFieldStyle("borderStyle", event.target.value),
);
$("#fieldAlign").addEventListener("change", (event) =>
  saveFieldStyle("textAlign", event.target.value),
);
$("#fieldLineHeight").addEventListener("change", (event) =>
  saveFieldStyle("lineHeight", Number(event.target.value)),
);
$("#fieldBefore").addEventListener("change", (event) => {
  const value = Number(event.target.value);
  saveFieldStyle("spaceBefore", event.target.value && value >= 0 && value <= 60 ? value : null);
});
$("#fieldAfter").addEventListener("change", (event) => {
  const value = Number(event.target.value);
  saveFieldStyle("spaceAfter", event.target.value && value >= 0 && value <= 60 ? value : null);
});
$("#fieldBold").addEventListener("click", () =>
  toggleFieldFormat("fieldBold", "fontWeight", "bold", "normal"),
);
$("#fieldItalic").addEventListener("click", () =>
  toggleFieldFormat("fieldItalic", "fontStyle", "italic", "normal"),
);
$("#fieldUnderline").addEventListener("click", () =>
  toggleFieldFormat("fieldUnderline", "underline", true, false),
);
$("#clearFieldFormat").addEventListener("click", () => {
  if (!activeFormatPath) return;
  const layout = { ...(resume.layout || {}) },
    fieldStyles = { ...(layout.fieldStyles || {}) };
  delete fieldStyles[activeFormatPath];
  if (Object.keys(fieldStyles).length) layout.fieldStyles = fieldStyles;
  else delete layout.fieldStyles;
  resume.layout = layout;
  updateJsonEditor();
  renderOutput();
  setJsonStatus("Formatting cleared · PDF, Word, and JSON updated");
});
$("#benchmarkPdfFile").addEventListener("change", updateBenchmarkFileStatus);
$("#benchmarkJsonFile").addEventListener("change", updateBenchmarkFileStatus);
$("#runBenchmarkButton").addEventListener("click", runLocalFileBenchmark);
window.addEventListener("hashchange", () => setWhyPage(location.hash === "#why-json"));
window.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeFormatPane();
});
$("#previewBody").addEventListener("contextmenu", (event) => {
  const node = event.target.closest('[data-path][contenteditable="true"]');
  if (!node) return;
  event.preventDefault();
  showFormatPane(node);
});
$("#previewBody").addEventListener(
  "blur",
  (event) => {
    if (restoringHistory) return;
    if (event.target.id === "wordEditor") {
      saveWordDocument();
      return;
    }
    if (event.target.matches("[data-path][contenteditable=true]"))
      contentEditableChanged(event.target);
  },
  true,
);
$("#previewBody").addEventListener("keydown", (event) => {
  if (
    event.target.matches("[data-path][contenteditable=true]") &&
    event.key === "Enter" &&
    !event.shiftKey &&
    !event.ctrlKey &&
    !event.metaKey &&
    !event.target.matches("p")
  ) {
    event.preventDefault();
    const path = event.target.dataset.path;
    event.target.blur();
    if (/\.\d+$/.test(path) && Array.isArray(pathGet(resume, path.slice(0, path.lastIndexOf(".")))))
      appendAtPath(path);
  }
});
$("#previewBody").addEventListener("input", (event) => {
  if (event.isComposing) return;
  if (event.target.closest("#wordEditor")) {
    wordDirty = true;
    saveWordDocument();
    return;
  }
  if (event.target.matches("[data-path][contenteditable=true]")) {
    if (!latestJsonError) {
      pathSet(
        resume,
        event.target.dataset.path,
        event.target.dataset.chunked === "true"
          ? $$(
              `[data-path="${CSS.escape(event.target.dataset.path)}"][data-chunked="true"]`,
              $("#previewBody"),
            )
              .map((node) => normalizeText(node.innerText))
              .join(" ")
          : normalizeText(event.target.innerText),
      );
      updateJsonEditor();
      setJsonStatus("Document changes saved · JSON synced");
    }
  }
});
$$(".mode-tab").forEach((button) =>
  button.addEventListener("click", () => {
    saveWordDocument();
    activeMode = button.dataset.mode;
    const record = workspace.resumes.find((item) => item.id === activeResumeId);
    if (
      record?.sourceDocument &&
      record.sourceDocument.format !== (activeMode === "word" ? "docx" : "pdf")
    )
      record.documentView = "edited";
    workspace.outputMode = activeMode;
    saveWorkspace();
    $$(".mode-tab").forEach((tab) => {
      tab.classList.toggle("active", tab === button);
      tab.setAttribute("aria-selected", String(tab === button));
      tab.tabIndex = tab === button ? 0 : -1;
    });

    renderOutput();
  }),
);
window.addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
    event.preventDefault();
    compileJson();
  }
});

function recordHistory() {
  recordWorkspaceHistory();
}
function updateHistoryControls() {
  const history = documentHistories.get(activeResumeId);
  $("#undoDocument").disabled = !history || history.index === 0;
  $("#redoDocument").disabled = !history || history.index >= history.items.length - 1;
  if ($("#mobileUndoButton")) $("#mobileUndoButton").disabled = $("#undoDocument").disabled;
  if ($("#mobileRedoButton")) $("#mobileRedoButton").disabled = $("#redoDocument").disabled;
}
function restoreHistory(direction) {
  restoreWorkspaceHistory(direction);
}
$("#undoDocument").addEventListener("click", () => restoreHistory(-1));
$("#redoDocument").addEventListener("click", () => restoreHistory(1));
for (const button of [$("#undoDocument"), $("#redoDocument")])
  button.addEventListener("mousedown", (event) => event.preventDefault());
window.addEventListener(
  "keydown",
  (event) => {
    if (!(event.ctrlKey || event.metaKey) || event.altKey || event.isComposing) return;
    const key = event.key.toLowerCase();
    if (key !== "z" && key !== "y") return;
    if (!event.target.closest(".workspace-content") || $("#modalRoot").children.length) return;
    event.preventDefault();
    restoreHistory(key === "y" || event.shiftKey ? 1 : -1);
  },
  true,
);
function updateBuildState() {
  const state = $("#buildState"),
    button = $("#compileButton");
  if (!state || !button) return;
  const checkpoint = workspace.resumes
    .find((record) => record.id === activeResumeId)
    ?.versions?.at(-1);
  const changed = Boolean(checkpoint && checkpoint.json !== JSON.stringify(resume, null, 2));
  button.classList.toggle("has-changes", changed);
  button.title = latestJsonError
    ? "Review the JSON error"
    : !checkpoint
      ? "Save the first local checkpoint"
      : changed
        ? "Changes since the last checkpoint · Compile to compare"
        : "No changes since the last checkpoint";
  state.textContent = latestJsonError
    ? "Invalid JSON"
    : !checkpoint
      ? "No checkpoint yet"
      : changed
        ? "Changes since last checkpoint"
        : "No changes since last checkpoint";
}
let outlineDrag = "";
$("#sectionOutline").addEventListener("dragstart", (event) => {
  outlineDrag = event.target.closest("[data-outline-key]")?.dataset.outlineKey || "";
  event.dataTransfer.setData("application/x-forma-section", outlineDrag);
  event.dataTransfer.effectAllowed = "move";
});
$("#sectionOutline").addEventListener("dragover", (event) => {
  const target = event.target.closest("[data-outline-key]");
  if (!target || !(outlineDrag || draggedSectionKey)) return;
  event.preventDefault();
  target.classList.add("drag-hover");
});
$("#sectionOutline").addEventListener("dragleave", (event) =>
  event.target.closest("[data-outline-key]")?.classList.remove("drag-hover"),
);
$("#sectionOutline").addEventListener("drop", (event) => {
  const target = event.target.closest("[data-outline-key]");
  const key = outlineDrag || draggedSectionKey;
  if (!target || !key) return;
  event.preventDefault();
  event.stopPropagation();
  const order = sectionKeys().filter((item) => item !== key);
  order.splice(order.indexOf(target.dataset.outlineKey), 0, key);
  resume.layout = { ...(resume.layout || {}), order };
  reorderRichSection(key, target.dataset.outlineKey);
  outlineDrag = "";
  draggedSectionKey = null;
  draggedSectionNode = null;
  updateDocumentStatus();
});
$("#sectionOutline").addEventListener("dragend", () => {
  outlineDrag = "";
  $$(".outline-item").forEach((node) => node.classList.remove("drag-hover"));
});
$("#sectionOutline").addEventListener("click", (event) => {
  const key = event.target.closest("[data-outline-key]")?.dataset.outlineKey;
  if (!key) return;
  const section = $(`[data-section-key="${CSS.escape(key)}"]`, $("#previewBody"));
  if (section) {
    const page = section.closest(".preview-page");
    if (page) {
      previewPage = Number(page.dataset.previewPage);
      updatePageControls(true);
      section.querySelector("[data-path]")?.focus();
    } else section.scrollIntoView({ block: "center", behavior: "smooth" });
  }
});
function appendAtPath(path) {
  const parts = path.split(".");
  const last = parts.pop();
  let parent = pathGet(resume, parts.join("."));
  if (!Array.isArray(parent)) return false;
  const index = Number(last) + 1;
  parent.splice(index, 0, "New bullet");
  reindexFieldStyles(parts.join("."), Number(last) + 1, 1);
  updateDocumentStatus();
  const node = $(`[data-path="${CSS.escape(parts.join(".") + "." + index)}"]`, $("#previewBody"));
  if (node) {
    previewPage = Number(node.closest(".preview-page").dataset.previewPage);
    updatePageControls(true);
    node.focus();
  }
  return true;
}
function reindexFieldStyles(base, index, delta) {
  const styles = resume.layout?.fieldStyles;
  if (!styles) return;
  const next = {};
  for (const [key, value] of Object.entries(styles)) {
    if (key.startsWith(base + ".")) {
      const rest = key.slice(base.length + 1).split(".");
      const n = Number(rest[0]);
      if (Number.isInteger(n) && n >= index) {
        if (delta < 0 && n === index) continue;
        rest[0] = String(n + delta);
        next[base + "." + rest.join(".")] = value;
        continue;
      }
    }
    next[key] = value;
  }
  resume.layout.fieldStyles = next;
}
$("#appendBullet").addEventListener("click", () => {
  if (appendAtPath(activeFormatPath)) return;
  const parts = activeFormatPath.split(".");
  const section = parts[0];
  if (
    /^\d+$/.test(parts[1] || "") &&
    pathGet(resume, section + "." + parts[1]) &&
    typeof pathGet(resume, section + "." + parts[1]) === "object"
  ) {
    const entry = pathGet(resume, section + "." + parts[1]);
    const key = Array.isArray(entry.achievements) ? "achievements" : "highlights";
    (entry[key] ||= []).push("New bullet");
  } else if (Array.isArray(resume[section])) resume[section].push("New bullet");
  else {
    toast("Select an entry or list to add a bullet");
    return;
  }
  updateDocumentStatus();
});
$("#appendEntry").addEventListener("click", () => {
  const section = activeFormatPath.startsWith("layout.sectionTitles.")
    ? activeFormatPath.split(".").slice(2).join(".")
    : activeFormatPath.split(".")[0];
  if (!Array.isArray(resume[section])) {
    toast("Select a list section to add an entry");
    return;
  }
  const seed = resume[section].find((item) => item && typeof item === "object");
  const item = seed
    ? Object.fromEntries(
        Object.entries(seed).map(([key, value]) => [
          key,
          Array.isArray(value) ? ["New bullet"] : typeof value === "object" ? {} : "New " + key,
        ]),
      )
    : "New detail";
  resume[section].push(item);
  updateDocumentStatus();
});
$("#removeSelection").addEventListener("click", () => {
  if (!activeFormatPath) return;
  if (activeFormatPath.startsWith("layout.sectionTitles.")) {
    const key = activeFormatPath.slice("layout.sectionTitles.".length);
    delete resume[key];
  } else {
    const parts = activeFormatPath.split(".");
    const last = parts.pop();
    const parent = parts.length ? pathGet(resume, parts.join(".")) : resume;
    if (Array.isArray(parent)) {
      parent.splice(Number(last), 1);
      reindexFieldStyles(parts.join("."), Number(last), -1);
    } else if (parent) delete parent[last];
  }
  closeFormatPane();
  updateDocumentStatus();
});

renderWorkspace();
jsonEditor.value = restoredDraft || JSON.stringify(resume, null, 2);
if (restoredDraft) {
  try {
    resume = ResumeFormats.assertModel(JSON.parse(restoredDraft));
  } catch (error) {
    latestJsonError = error;
    setJsonStatus(error.message, true);
  }
}
syncControls();
updateJsonEditor();
renderOutput();
showRecordedBenchmark();
setWhyPage(location.hash === "#why-json");

activateInput(latestJsonError ? "json" : activeInput, Boolean(latestJsonError));

document.addEventListener("click", (event) => {
  $$(".compile-guide[open]").forEach((menu) => {
    if (!menu.contains(event.target) || event.target.closest(".insert-options button"))
      menu.open = false;
  });
});
let modalFocusReturn = null;
new MutationObserver(() => {
  const dialog = $("#modalRoot [role=dialog]");
  if (dialog) {
    if (!modalFocusReturn) modalFocusReturn = document.activeElement;
    requestAnimationFrame(() => {
      if (!dialog.contains(document.activeElement))
        dialog
          .querySelector("input:not([type=radio]):not([type=file]),button,textarea,select")
          ?.focus();
    });
  } else if (modalFocusReturn) {
    if (modalFocusReturn.isConnected) modalFocusReturn.focus();
    modalFocusReturn = null;
  }
}).observe($("#modalRoot"), { childList: true });
window.addEventListener("keydown", (event) => {
  const dialog = $("#modalRoot [role=dialog]");
  if (event.key === "Escape") {
    if (dialog) {
      $("#modalRoot").replaceChildren();
      event.preventDefault();
    }
    $$(".compile-guide[open]").forEach((menu) => (menu.open = false));
    $("#exportMenu").classList.add("hidden");
    $("#exportMenuToggle").setAttribute("aria-expanded", "false");
  }
  if (dialog && event.key === "Tab") {
    const controls = [
      ...dialog.querySelectorAll('button,input,textarea,select,summary,[tabindex="0"]'),
    ].filter((el) => !el.disabled && el.getClientRects().length);
    if (!controls.length) return;
    const first = controls[0],
      last = controls[controls.length - 1];
    if (
      event.shiftKey &&
      (document.activeElement === first || !dialog.contains(document.activeElement))
    ) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
});

$$(".mode-tab").forEach((tab) => {
  const selected = tab.dataset.mode === activeMode;
  tab.classList.toggle("active", selected);
  tab.setAttribute("aria-selected", String(selected));
  tab.tabIndex = selected ? 0 : -1;
});

document.addEventListener("click", (event) => {
  if (
    !window.matchMedia("(max-width: 900px)").matches ||
    collapsedPanels.files ||
    event.target.closest("#mobileFilesButton")
  )
    return;
  if (
    event.target.closest(".workspace-content") ||
    event.target.closest("[data-resume-file],[data-outline-key]")
  ) {
    collapsedPanels.files = true;
    syncFilesPanel();
  }
});
document.addEventListener("keydown", (event) => {
  if (
    event.key === "Escape" &&
    window.matchMedia("(max-width: 900px)").matches &&
    !collapsedPanels.files &&
    !$("#modalRoot [role=dialog]") &&
    !$("details[open]") &&
    !$("#benchmarkPlayer").classList.contains("expanded")
  ) {
    collapsedPanels.files = true;
    syncFilesPanel();
    $("#mobileFilesButton").focus();
  }
});

$$("[data-wrap-source]").forEach(
  (button) =>
    (button.onclick = () => {
      sourceWrap = !sourceWrap;
      safeStorageSet("forma.source.wrap", String(sourceWrap));
      syncSourceWrap();
    }),
);
for (const eventName of ["wheel", "touchstart", "pointerdown", "keydown"]) {
  $("#walkthroughForms").addEventListener(
    eventName,
    (event) => {
      const scroller = event.target.closest(".walkthrough-form-fields");
      if (scroller) scroller.dataset.userScroll = "true";
    },
    { passive: true },
  );
}
new ResizeObserver(syncSourceWrap).observe($("#jsonEditor"));
new ResizeObserver(syncSourceWrap).observe(latexEditor);
syncSourceWrap();

registerEditorFeatures();

initializeWorkspaceV2();
