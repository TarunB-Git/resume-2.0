const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const P = require("../site/assets/anonymize.js");
const F = require("../site/assets/formats.js");
const sample = require("../examples/tarun.json");
const clone = (value) => JSON.parse(JSON.stringify(value));

test("Anonymization creates a separate model and retains career content and empty values", () => {
  const source = clone(sample),
    before = JSON.stringify(source),
    result = P.anonymize(source);
  assert.equal(JSON.stringify(source), before);
  assert.equal(result.basics.name, "Full Name");
  assert.equal(result.basics.label, "Job title");
  assert.equal(result.basics.email, "name@example.com");
  assert.equal(result.basics.phone, "");
  assert.equal(result.experience[0].company, "Company 1");
  assert.equal(result.experience[0].role, source.experience[0].role);
  assert.deepEqual(result.skills, source.skills);
  assert.equal(result.projects[0].name, "Project 1");
});

test("Array entries inherit identifying fields, including nested custom records", () => {
  const source = {
    basics: {
      name: "Tarun B",
      phones: ["+44 7700 900123", 2025550123],
      emails: ["tarun@private.dev"],
    },
    companies: ["Private Studios", "Private Studios", "Secret Services"],
    schools: ["Private College"],
    custom: {
      authors: ["Tarun B"],
      addresses: [
        { streetAddress: "12 Personal Road", city: "Private City", postalCode: "AB1 2CD" },
      ],
    },
  };
  const result = P.anonymize(source);
  assert.deepEqual(result.companies, ["Company 1", "Company 1", "Company 2"]);
  assert.deepEqual(result.schools, ["University 1"]);
  assert.deepEqual(result.custom.authors, ["Full Name"]);
  assert.deepEqual(result.basics.phones, ["+1 (202) 555-0100", 2025550100]);
  assert.equal(result.custom.addresses[0].city, "City");
});

test("Dates, large performance numbers, skills and style values are not mistaken for contacts", () => {
  const source = {
    basics: { name: "May B", firstName: "May", phone: "+1 202 555 0144" },
    work: [
      {
        name: "Private Studios",
        startDate: "2024-01-01",
        endDate: "May 2025",
        highlights: [
          "Processed 12345678 records in May 2024.",
          "Dates 2020-01-01, 31/12/2024, 2020 - 2024.",
          "Call +44 7700 900123.",
        ],
      },
    ],
    skills: ["May", "HTML"],
    format: { font: "May", customScale: "12.123456789" },
    layout: { fieldStyles: { "basics.name": { fontSize: "12.123456789", color: "#123456" } } },
  };
  const result = P.anonymize(source);
  assert.equal(result.work[0].startDate, source.work[0].startDate);
  assert.equal(result.work[0].endDate, source.work[0].endDate);
  assert.equal(result.work[0].highlights[0], source.work[0].highlights[0]);
  assert.equal(result.work[0].highlights[1], source.work[0].highlights[1]);
  assert.equal(result.work[0].highlights[2], "Call +1 (202) 555-0100.");
  assert.deepEqual(result.skills, source.skills);
  assert.deepEqual(result.format, source.format);
  assert.deepEqual(result.layout, source.layout);
});

test("Generated replacements are stable on repeated anonymization", () => {
  const first = P.anonymize(sample);
  assert.deepEqual(P.anonymize(first), first);
  const result = P.anonymize({
    companies: ["Company 1", "Private Studios", "Company 3", "Other Studios"],
  });
  assert.deepEqual(result.companies, ["Company 1", "Company 2", "Company 3", "Company 4"]);
});

test("Free text substitutions do not cascade into generated generic values", () => {
  const source = {
    basics: { name: "Name Example", email: "name@private.dev", url: "https://private.dev" },
    summary: "Name Example: name@private.dev and https://private.dev/path, or www.private.dev.",
  };
  const result = P.anonymize(source);
  assert.equal(
    result.summary,
    "Full Name: name@example.com and https://example.com, or https://example.com.",
  );
  assert.equal(
    P.anonymize({ basics: { name: "Will B" }, summary: "I will lead. Will led." }).summary,
    "I will lead. First Name led.",
  );
});

test("Rich text redacts split names and encoded text while keeping bindings and styles", () => {
  const source = {
    basics: { name: "Tarun B", email: "tarun@private.dev" },
    experience: [{ company: "Private Studios" }],
    layout: {
      richDocument:
        '<h1 data-path="basics.name">Tarun <em>B</em></h1><p title="Tarun B" style="font-size:12.123456789px">Tar&#117;n&nbsp;B at Private <b>Studios</b>.</p><a data-path="basics.email" href="mailto:tarun@private.dev">tarun@private.dev</a><a href="/private/tarun">Site</a><!-- Tarun B --><img src="data:image/png;base64,PRIVATE">',
    },
  };
  const html = P.anonymize(source).layout.richDocument;
  assert.ok(html.includes('data-path="basics.name"'));
  assert.ok(html.includes('data-path="basics.email"'));
  assert.ok(html.includes('style="font-size:12.123456789px"'));
  assert.ok(html.includes('<h1 data-path="basics.name">Full Name<em></em></h1>'));
  assert.ok(html.includes('href="mailto:name@example.com"'));
  assert.ok(html.includes('href="https://example.com"'));
  assert.ok(!/Tarun|Tar&#117;|Private|PRIVATE|private\.dev/.test(html), html);
  assert.ok(!html.includes("<img"));
});

test("A shared template is redacted together with the source without mutating it", () => {
  const source = clone(sample),
    template = {
      id: "custom-tarun",
      name: "Tarun B template",
      base: "modern",
      css: '.resume-paper{color:blue;background:url("https://private.dev/photo.png")} .tag::before{content:"Tarun B"}',
      seed: clone(sample),
    };
  const before = JSON.stringify(template),
    result = P.createCopy(source, template);
  assert.equal(JSON.stringify(template), before);
  assert.equal(result.data.template, source.template);
  assert.equal(result.template.seed.basics.name, "Full Name");
  assert.ok(result.template.css.includes("color:blue"));
  assert.ok(result.template.css.includes("background:none"));
  assert.ok(!result.template.css.includes("Tarun"));
  assert.ok(!result.template.css.includes("private.dev"));
});

test("Creating a copy gives custom templates and tabs independent identities", () => {
  const source = fs.readFileSync(path.join(__dirname, "../site/assets/workspace-v2.js"), "utf8");
  const start = source.indexOf("function createAnonymizedResume("),
    end = source.indexOf("function positionWorkspacePopover(", start);
  const model = clone(sample);
  model.template = "custom-original";
  const originalTemplate = {
    id: "custom-original",
    name: "Personal template",
    base: "modern",
    css: '.name::before{content:"Tarun B"}',
    seed: clone(model),
  };
  const c = {
    resume: model,
    workspace: {
      folders: [{ id: "folder" }],
      openIds: ["original"],
      resumes: [
        {
          id: "original",
          name: "Tarun B",
          folderId: "folder",
          data: clone(model),
          versions: [{ json: JSON.stringify(model) }],
        },
      ],
    },
    activeResumeId: "original",
    customTemplates: [clone(originalTemplate)],
    BUILTIN_TEMPLATES: [{ id: "modern" }],
    ResumePrivacy: P,
    ResumeFormats: F,
    deepClone: clone,
    saveWordDocument() {},
    sourceDraftError: () => false,
    persistResume() {},
    sanitizeTemplateCss: (css) => css,
    makeWorkspaceId: (type) => type + "-copy",
    persistTemplates() {},
    switchResume(id) {
      c.selected = id;
    },
    toast() {},
  };
  const before = JSON.stringify(c.workspace.resumes[0]);
  vm.createContext(c);
  vm.runInContext(source.slice(start, end), c);
  c.createAnonymizedResume();
  assert.equal(JSON.stringify(c.workspace.resumes[0]), before);
  assert.deepEqual(c.customTemplates[0], originalTemplate);
  assert.equal(c.workspace.resumes[1].name, "Anonymized résumé");
  assert.equal(c.workspace.resumes[1].data.template, "custom-copy");
  assert.equal(c.customTemplates[1].seed.template, "custom-copy");
  assert.equal(c.customTemplates[1].seed.basics.name, "Full Name");
  assert.equal(c.customTemplates[1].name, "Anonymized template");
  assert.equal(c.selected, "resume-copy");
  assert.equal(c.workspace.resumes[1].versions, undefined);
});

test("Word formatting toggle is mobile-only, persistent through renders and visible on desktop", () => {
  const source = fs.readFileSync(path.join(__dirname, "../site/assets/workspace-v2.js"), "utf8"),
    start = source.indexOf("function syncWordToolbar("),
    end = source.indexOf("function showMobilePane(", start);
  const nodes = Object.fromEntries(
    ["#wordToolbar", "#toggleWordToolbar"].map((id) => [
      id,
      {
        classes: new Set(),
        classList: {
          toggle(name, hidden) {
            nodes[id].classes[hidden ? "add" : "delete"](name);
          },
        },
        setAttribute(name, value) {
          this[name] = value;
        },
      },
    ]),
  );
  const c = {
    activeMode: "word",
    mobileWordFormattingOpen: false,
    isCompactLayout: () => true,
    $: (id) => nodes[id],
  };
  vm.createContext(c);
  vm.runInContext(source.slice(start, end), c);
  c.syncWordToolbar();
  assert.equal(nodes["#wordToolbar"].classes.has("hidden"), true);
  assert.equal(nodes["#toggleWordToolbar"].classes.has("hidden"), false);
  c.mobileWordFormattingOpen = true;
  c.syncWordToolbar();
  assert.equal(nodes["#wordToolbar"].classes.has("hidden"), false);
  assert.equal(nodes["#toggleWordToolbar"]["aria-expanded"], "true");
  c.activeMode = "pdf";
  c.syncWordToolbar();
  assert.equal(nodes["#toggleWordToolbar"].classes.has("hidden"), true);
  c.isCompactLayout = () => false;
  c.activeMode = "word";
  c.mobileWordFormattingOpen = false;
  c.syncWordToolbar();
  assert.equal(nodes["#wordToolbar"].classes.has("hidden"), false);
  assert.equal(nodes["#toggleWordToolbar"].classes.has("hidden"), true);
});
