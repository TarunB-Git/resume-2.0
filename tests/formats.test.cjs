const { test } = require("node:test");
const assert = require("node:assert/strict");
const F = require("../site/assets/formats.js");
const sample = require("../examples/tarun.json");
test("XML preserves JSON types, order, Unicode, empty fields and custom keys", () => {
  const value = {
    ...sample,
    custom: {
      "a & b": [],
      "name with spaces": { empty: "", zero: 0, no: false, nil: null },
      multi: "a\nb\r\nc",
      unicode: "Résumé 中文 👋",
      control: "a\u0000b",
      surrogate: "\ud800",
      numbers: [-1, 0.5, 1e30],
    },
    emptyList: [""],
  };
  assert.deepEqual(F.fromXml(F.toXml(value)), value);
  assert.deepEqual(F.fromXml(F.toXml({})), {});
  for (let n = 0; n < 100; n++) {
    const data = { ["field " + n]: ["", n, n % 2 === 0, null, { "<key>": `A&B ${n}\n"Text"` }] };
    assert.deepEqual(F.fromXml(F.toXml(data)), data);
  }
});
test("XML rejects malformed, ambiguous and externally defined input", () => {
  for (const input of [
    '<resume version="2"/>',
    '<resume version="1"><field name="a" type="number">NaN</field></resume>',
    '<!DOCTYPE resume [<!ENTITY x SYSTEM "file:///etc/passwd">]><resume version="1"/>',
    '<resume version="1"><field name="__proto__" type="object"/></resume>',
    '<resume version="1"><field name="x" type="string">&bad;</field></resume>',
    '<resume version="1"><field name="x" type="boolean">yes</field></resume>',
    '<resume version="1"><field name="x" type="array"><field name="x" type="null"/></field></resume>',
    '<resume version="1"><field name="a" type="null"/><field name="a" type="null"/></resume>',
    '<resume version="1"><field name="x" type="string"></resume>',
  ])
    assert.throws(() => F.fromXml(input), /Line \d+, column \d+/);
});
test("JSON Resume maps standard fields and round-trips app data exactly", () => {
  const document = F.toJsonResume(sample);
  assert.equal(document.basics.name, "Tarun B");
  assert.equal(document.work[0].name, "Resume Studios");
  assert.deepEqual(F.fromJsonResume(document), sample);
  document.basics.name = "Edited";
  assert.equal(F.fromJsonResume(document).basics.name, "Edited");
  const external = {
    basics: {
      name: "Tarun B",
      summary: "Résumé maker",
      location: { city: "Example city", countryCode: "SE" },
    },
    work: [{ name: "Resume Studios", position: "Maker", startDate: "2024", highlights: [""] }],
    skills: [{ name: "Web", keywords: ["HTML", "CSS"] }],
    awards: [{ title: "Example" }],
    meta: { theme: "plain" },
  };
  const imported = F.fromJsonResume(external);
  assert.equal(imported.experience[0].company, "Resume Studios");
  assert.deepEqual(imported.skills, ["HTML", "CSS"]);
  assert.deepEqual(F.toJsonResume(imported).awards, external.awards);
  assert.equal(F.toJsonResume(imported).basics.location.countryCode, "SE");
});
test("Session merge remaps folder, résumé, template and checkpoint identities", () => {
  const current = {
    folders: [{ id: "f", name: "Existing" }],
    resumes: [{ id: "r", folderId: "f", data: sample }],
    openIds: ["r"],
    activeId: "r",
    collapsedFolders: [],
  };
  const incoming = {
    folders: [
      { id: "f", name: "Imported" },
      { id: "nested", name: "Nested", parentId: "f" },
    ],
    resumes: [
      {
        id: "r",
        folderId: "nested",
        name: "Tarun B",
        data: { ...sample, template: "t" },
        draftJson: "{",
        sourceDrafts: { xml: { text: "<", message: "Unclosed" } },
        versions: [{ id: "v", json: JSON.stringify({ ...sample, template: "t" }) }],
      },
    ],
    openIds: ["r"],
    activeId: "r",
    inputMode: "xml",
    outputMode: "word",
    view: "document",
    collapsedFolders: ["f"],
  };
  const original = JSON.stringify(current);
  const result = F.mergeSession(
    current,
    incoming,
    [{ id: "t", name: "Old" }],
    [{ id: "t", name: "New", css: '[data-template="t"] p{color:red}' }],
  );
  assert.equal(JSON.stringify(current), original);
  assert.equal(result.workspace.resumes.length, 2);
  assert.notEqual(result.workspace.activeId, "r");
  const added = result.workspace.resumes[1];
  assert.notEqual(added.folderId, "nested");
  assert.notEqual(added.data.template, "t");
  assert.equal(JSON.parse(added.versions[0].json).template, added.data.template);
  assert.equal(added.sourceDrafts.xml.text, "<");
  assert.equal(result.workspace.inputMode, "xml");
  assert.equal(result.workspace.outputMode, "word");
  assert.ok(result.templates[1].css.includes(added.data.template));
});
test("Invalid session fails before changes are made", () => {
  assert.throws(() => F.validateSession({ resumes: [], folders: [] }));
  assert.throws(
    () =>
      F.validateSession({
        resumes: [{ id: "a", data: sample }],
        folders: [
          { id: "a", parentId: "b" },
          { id: "b", parentId: "a" },
        ],
      }),
    /cycle/,
  );
});
test("JSON Resume retains unmapped nested standard details during re-export", () => {
  const external = {
    basics: {
      name: "Tarun B",
      image: "https://example.com/avatar.png",
      profiles: [{ network: "Example", username: "tarun" }],
    },
    work: [
      { name: "Resume Studios", position: "Maker", url: "https://example.com", startDate: "2024" },
    ],
    education: [{ institution: "Example", courses: ["A"], score: "4" }],
    skills: [{ name: "Web", level: "Working knowledge", keywords: ["HTML", "CSS"] }],
    languages: [{ language: "English", fluency: "Working" }],
  };
  const result = F.toJsonResume(F.fromJsonResume(external));
  assert.deepEqual(result.basics.profiles, external.basics.profiles);
  assert.equal(result.basics.image, external.basics.image);
  assert.equal(result.work[0].url, external.work[0].url);
  assert.deepEqual(result.education[0].courses, ["A"]);
  assert.deepEqual(result.skills, external.skills);
  assert.deepEqual(result.languages, external.languages);
  assert.equal(F.isJsonResume({ ...sample, skills: [{ name: "Custom" }] }), false);
});
test("XML writer rejects values outside JSON and encodes noncharacters safely", () => {
  assert.throws(() => F.toXml({ bad: Infinity }), /finite/);
  assert.throws(() => F.toXml({ bad: undefined }), /JSON values/);
  const data = { text: "A\ufffeB\uffff", number: -0 };
  const xml = F.toXml(data);
  assert.ok(!xml.includes("\ufffe"));
  const restored = F.fromXml(xml);
  assert.equal(restored.text, data.text);
  assert.ok(Object.is(restored.number, -0));
});
test("XML follows declaration, attribute whitespace and CDATA rules", () => {
  const data = { "line\nname\t": "first\r\nsecond" };
  assert.deepEqual(F.fromXml(F.toXml(data)), data);
  const xml =
    '<resume version="1"><field name="text" type="string"><![CDATA[A & <B>]]></field></resume>';
  assert.equal(F.fromXml(xml).text, "A & <B>");
  assert.throws(() => F.fromXml('<?xml bad?><resume version="1"/>'));
  assert.throws(() =>
    F.fromXml('<resume version="1"><field name="x" type="string">a]]>b</field></resume>'),
  );
  assert.throws(() => F.fromXml('<resume version="1"><!-- a--b --></resume>'));
});
