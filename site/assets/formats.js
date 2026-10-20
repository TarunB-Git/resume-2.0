/* Portable data formats. No document rendering, storage or network access. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.ResumeFormats = api;
})(typeof globalThis === "object" ? globalThis : this, function () {
  "use strict";
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const object = (value) => value && typeof value === "object" && !Array.isArray(value);
  const forbidden = new Set(["__proto__", "prototype", "constructor"]);
  function assertModel(value) {
    if (!object(value)) throw new Error("Résumé data must be an object.");
    const walk = (item, depth = 0) => {
      if (depth > 80) throw new Error("Data is nested more than 80 levels.");
      if (typeof item === "number" && !Number.isFinite(item))
        throw new Error("Numbers must be finite.");
      if (item !== null && !["object", "string", "number", "boolean"].includes(typeof item))
        throw new Error("Only JSON values are supported.");
      if (item && typeof item === "object")
        for (const [key, child] of Object.entries(item)) {
          if (forbidden.has(key)) throw new Error("Unsupported field name: " + key);
          walk(child, depth + 1);
        }
    };
    walk(value);
    return value;
  }
  const escapeXml = (value) =>
    String(value).replace(
      /[&<>"']/g,
      (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c],
    );
  const specialString = (value) =>
    /[\u0000-\u0008\u000b\u000c\u000d\u000e-\u001f\ufffe\uffff]/.test(value) ||
    [...value].some(
      (c) => c.length === 1 && c.charCodeAt(0) >= 0xd800 && c.charCodeAt(0) <= 0xdfff,
    );
  const xmlJsonString = (value) =>
    JSON.stringify(value).replace(
      /[\ufffe\uffff]/g,
      (character) => "\\u" + character.charCodeAt(0).toString(16),
    );
  const specialName = (value) => specialString(value) || /[\n\t]/.test(value);
  function toXml(data) {
    assertModel(data);
    const encode = (value, tag, name, depth) => {
      const type = value === null ? "null" : Array.isArray(value) ? "array" : typeof value;
      if (!["null", "array", "object", "string", "number", "boolean"].includes(type))
        throw new Error("XML supports JSON values only.");
      let attrs =
        name == null
          ? ""
          : ` name="${escapeXml(specialName(name) ? xmlJsonString(name) : name)}"${specialName(name) ? ' name-encoding="json"' : ""}`;
      attrs += ` type="${type}"`;
      const indent = "  ".repeat(depth);
      if (type === "null") return `${indent}<${tag}${attrs}/>`;
      if (type === "object" || type === "array") {
        const values =
          type === "array"
            ? value.map((item) => encode(item, "item", null, depth + 1))
            : Object.entries(value).map(([key, item]) => encode(item, "field", key, depth + 1));
        return values.length
          ? `${indent}<${tag}${attrs}>\n${values.join("\n")}\n${indent}</${tag}>`
          : `${indent}<${tag}${attrs}/>`;
      }
      const text =
        type === "string" && specialString(value)
          ? xmlJsonString(value)
          : Object.is(value, -0)
            ? "-0"
            : String(value);
      if (type === "string" && specialString(value)) attrs += ' encoding="json"';
      return `${indent}<${tag}${attrs}>${escapeXml(text)}</${tag}>`;
    };
    return (
      '<?xml version="1.0" encoding="UTF-8"?>\n<resume version="1">\n' +
      Object.entries(data)
        .map(([key, value]) => encode(value, "field", key, 1))
        .join("\n") +
      "\n</resume>\n"
    );
  }
  function fromXml(input) {
    const source = String(input)
      .replace(/^\uFEFF/, "")
      .replace(/\r\n?/g, "\n");
    let offset = 0,
      count = 0;
    const fail = (message) => {
      const prefix = source.slice(0, offset),
        line = prefix.split("\n").length,
        column = prefix.length - prefix.lastIndexOf("\n");
      throw new Error(`Line ${line}, column ${column}: ${message}`);
    };
    if (/<!DOCTYPE|<!ENTITY/i.test(source))
      fail("Document types and external entities are not allowed.");
    if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffe\uffff]/.test(source))
      fail("XML contains an invalid literal control character.");
    if (
      [...source].some(
        (character) =>
          character.length === 1 &&
          character.charCodeAt(0) >= 0xd800 &&
          character.charCodeAt(0) <= 0xdfff,
      )
    )
      fail("XML contains an unpaired surrogate.");
    const decode = (text) =>
      text.replace(/&([^;\s]+);|&/g, (all, token) => {
        const named = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
        if (Object.hasOwn(named, token || "")) return named[token];
        if (/^#(?:x[\da-f]+|\d+)$/i.test(token || "")) {
          const point =
            token[1].toLowerCase() === "x" ? parseInt(token.slice(2), 16) : Number(token.slice(1));
          if (
            [9, 10, 13].includes(point) ||
            (point >= 32 &&
              point <= 0x10ffff &&
              !(point >= 0xd800 && point <= 0xdfff) &&
              point !== 0xfffe &&
              point !== 0xffff)
          )
            return String.fromCodePoint(point);
        }
        fail("Unknown or invalid XML entity.");
      });
    const skip = () => {
      while (true) {
        const whitespace = /^\s+/.exec(source.slice(offset));
        if (whitespace) offset += whitespace[0].length;
        if (!source.startsWith("<!--", offset)) break;
        const end = source.indexOf("-->", offset + 4);
        if (end < 0) fail("Unclosed comment.");
        if (source.slice(offset + 4, end).includes("--")) fail("Invalid XML comment.");
        offset = end + 3;
      }
    };
    skip();
    if (source.startsWith("<?xml ", offset)) {
      const end = source.indexOf("?>", offset);
      if (end < 0) fail("Unclosed XML declaration.");
      if (
        !/^<\?xml\s+version\s*=\s*(["'])1\.0\1(?:\s+encoding\s*=\s*(["'])utf-8\2)?(?:\s+standalone\s*=\s*(["'])(?:yes|no)\3)?\s*\?>$/i.test(
          source.slice(offset, end + 2),
        )
      )
        fail("Expected an XML 1.0 UTF-8 declaration.");
      offset = end + 2;
    }
    skip();
    const element = (depth = 0) => {
      if (depth > 80 || ++count > 100000)
        fail("XML is too deeply nested or has too many elements.");
      const open = /^<([A-Za-z][\w-]*)/.exec(source.slice(offset));
      if (!open) fail("Expected an XML element.");
      offset += open[0].length;
      const name = open[1],
        attrs = {};
      let closed = false;
      while (true) {
        const gap = /^\s*/.exec(source.slice(offset))[0];
        offset += gap.length;
        if (source.startsWith("/>", offset)) {
          offset += 2;
          closed = true;
          break;
        }
        if (source[offset] === ">") {
          offset++;
          break;
        }
        if (!gap.length) fail("Separate XML attributes with a space.");
        const attr = /^([\w-]+)\s*=\s*(["'])([^<>]*?)\2/.exec(source.slice(offset));
        if (!attr) fail("Expected a quoted attribute.");
        if (Object.hasOwn(attrs, attr[1])) fail("Duplicate attribute.");
        attrs[attr[1]] = decode(attr[3].replace(/[\n\t]/g, " "));
        offset += attr[0].length;
      }
      const node = { name, attrs, children: [], text: "" };
      if (closed) return node;
      while (offset < source.length) {
        if (source.startsWith("</", offset)) {
          const end = /^<\/([\w-]+)\s*>/.exec(source.slice(offset));
          if (!end || end[1] !== name) fail("Mismatched closing tag.");
          offset += end[0].length;
          return node;
        }
        if (source.startsWith("<!--", offset)) {
          const end = source.indexOf("-->", offset + 4);
          if (end < 0) fail("Unclosed comment.");
          if (source.slice(offset + 4, end).includes("--")) fail("Invalid XML comment.");
          offset = end + 3;
          continue;
        }
        if (source.startsWith("<![CDATA[", offset)) {
          const end = source.indexOf("]]>", offset + 9);
          if (end < 0) fail("Unclosed CDATA.");
          node.text += source.slice(offset + 9, end);
          offset = end + 3;
          continue;
        }
        if (source[offset] === "<") node.children.push(element(depth + 1));
        else {
          let end = source.indexOf("<", offset);
          if (end < 0) end = source.length;
          if (source.slice(offset, end).includes("]]>"))
            fail("CDATA closing sequence outside CDATA.");
          node.text += decode(source.slice(offset, end));
          offset = end;
        }
      }
      fail("Unclosed " + name + " element.");
    };
    const root = element();
    skip();
    if (offset !== source.length) fail("Unexpected content after the résumé.");
    if (
      root.name !== "resume" ||
      root.attrs.version !== "1" ||
      Object.keys(root.attrs).length !== 1
    )
      fail('Expected <resume version="1">.');
    const attrsOnly = (node, allowed) => {
      for (const name of Object.keys(node.attrs))
        if (!allowed.includes(name)) fail("Unsupported attribute " + name);
    };
    const readObject = (nodes) => {
      const result = {};
      for (const node of nodes) {
        if (node.name !== "field" || !Object.hasOwn(node.attrs, "name"))
          fail("Objects contain named field elements.");
        let key = node.attrs.name;
        if (node.attrs["name-encoding"] === "json") {
          try {
            key = JSON.parse(key);
          } catch {
            fail("Invalid encoded field name.");
          }
        }
        if (typeof key !== "string" || forbidden.has(key) || Object.hasOwn(result, key))
          fail("Duplicate or unsupported field name.");
        result[key] = read(node);
      }
      return result;
    };
    const read = (node) => {
      attrsOnly(node, [
        "type",
        ...(node.name === "field" ? ["name", "name-encoding"] : []),
        "encoding",
      ]);
      if (node.attrs["name-encoding"] && node.attrs["name-encoding"] !== "json")
        fail("Unknown field name encoding.");
      const type = node.attrs.type;
      if (["object", "array"].includes(type)) {
        if (node.text.trim() || node.attrs.encoding)
          fail("Object and array values contain elements only.");
        if (type === "object") return readObject(node.children);
        return node.children.map((child) => {
          if (child.name !== "item") fail("Arrays contain item elements.");
          return read(child);
        });
      }
      if (node.children.length) fail("Scalar values cannot contain elements.");
      if (type === "string") {
        if (!node.attrs.encoding) return node.text;
        if (node.attrs.encoding !== "json") fail("Unknown string encoding.");
        try {
          const value = JSON.parse(node.text);
          if (typeof value !== "string") fail("Expected an encoded string.");
          return value;
        } catch {
          fail("Invalid encoded string.");
        }
      }
      if (node.attrs.encoding) fail("Only strings can use an encoding.");
      if (type === "null" && !node.text.trim()) return null;
      if (type === "boolean" && /^(true|false)$/.test(node.text.trim()))
        return node.text.trim() === "true";
      if (
        type === "number" &&
        /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:e[+-]?\d+)?$/i.test(node.text.trim()) &&
        Number.isFinite(Number(node.text))
      )
        return Number(node.text);
      fail("Invalid " + (type || "missing") + " type or value.");
    };
    if (root.text.trim()) fail("Résumé contains named fields only.");
    return assertModel(readObject(root.children));
  }
  const dateParts = (value) => {
    const parts = String(value || "").split(/\s+(?:—|–|-)\s+/);
    return {
      startDate: parts[0] || "",
      endDate: /present|current|now/i.test(parts[1] || "") ? "" : parts[1] || "",
    };
  };
  const dates = (entry) =>
    [entry.startDate, entry.endDate || (entry.startDate ? "Present" : "")]
      .filter(Boolean)
      .join(" — ");
  const locationText = (value) =>
    object(value)
      ? [value.address, value.city, value.region, value.postalCode, value.countryCode]
          .filter(Boolean)
          .join(", ")
      : value || "";
  function isJsonResume(value) {
    if (!object(value)) return false;
    if (
      (typeof value.$schema === "string" && value.$schema.includes("jsonresume")) ||
      value.meta?.resume20
    )
      return true;
    if (value.template || value.format || value.layout || value.experience) return false;
    return (
      Array.isArray(value.work) ||
      object(value.basics?.location) ||
      value.basics?.summary != null ||
      Boolean(value.skills?.some?.(object))
    );
  }
  function toJsonResume(data) {
    assertModel(data);
    const extras = clone(data.layout?.jsonResumeExtras || {}),
      basics = data.basics || {},
      original = data.layout?.jsonResumeSource || {};
    const result = {
      ...extras,
      basics: {
        ...clone(original.basics || {}),
        name: basics.name || "",
        label: basics.label || "",
        email: basics.email || "",
        phone: basics.phone || "",
        url: basics.url || "",
        summary: data.summary || "",
        location: { city: locationText(basics.location) },
      },
    };
    if (
      data.layout?.jsonResumeLocation &&
      locationText(data.layout.jsonResumeLocation) === basics.location
    )
      result.basics.location = clone(data.layout.jsonResumeLocation);
    result.work = (data.experience || []).map((entry, index) => ({
      ...clone(original.work?.[index] || {}),
      name: entry.company || "",
      position: entry.role || "",
      location: entry.location || "",
      ...dateParts(entry.dates),
      summary: entry.summary || "",
      highlights: entry.highlights || [],
    }));
    result.education = (data.education || []).map((entry, index) => ({
      ...clone(original.education?.[index] || {}),
      institution: entry.institution || "",
      area: entry.area || "",
      studyType: entry.degree || "",
      ...dateParts(entry.dates),
    }));
    result.skills = (data.skills || []).map((item) =>
      object(item) ? clone(item) : { name: String(item), keywords: [] },
    );
    result.projects = clone(data.projects || []);
    result.languages = (data.languages || []).map((item) =>
      object(item) ? clone(item) : { language: String(item), fluency: "" },
    );
    if (
      original.skills &&
      JSON.stringify(data.skills) ===
        JSON.stringify(
          original.skills.flatMap((entry) =>
            typeof entry === "string"
              ? [entry]
              : entry.keywords?.length
                ? entry.keywords
                : [entry.name || ""],
          ),
        )
    )
      result.skills = clone(original.skills);
    if (
      original.languages &&
      JSON.stringify(data.languages) ===
        JSON.stringify(
          original.languages.map((entry) =>
            typeof entry === "string"
              ? entry
              : [entry.language, entry.fluency].filter(Boolean).join(" — "),
          ),
        )
    )
      result.languages = clone(original.languages);
    result.meta = { ...(extras.meta || {}), resume20: { version: 1, model: clone(data) } };
    return result;
  }
  function fromJsonResume(value) {
    assertModel(value);
    const embedded = value.meta?.resume20?.version === 1 ? value.meta.resume20.model : null;
    const base = embedded
      ? clone(assertModel(embedded))
      : {
          template: "modern",
          format: { font: "Arial", accent: "#1a73e8", bullet: "disc" },
          layout: {},
        };
    if (embedded) {
      const prior = toJsonResume(base);
      if (
        ["basics", "work", "education", "skills", "projects", "languages"].every(
          (key) => JSON.stringify(value[key]) === JSON.stringify(prior[key]),
        )
      )
        return base;
    }
    const known = new Set([
      "basics",
      "work",
      "education",
      "skills",
      "projects",
      "languages",
      "$schema",
    ]);
    const extras = Object.fromEntries(Object.entries(value).filter(([key]) => !known.has(key)));
    if (extras.meta) {
      extras.meta = clone(extras.meta);
      delete extras.meta.resume20;
    }
    base.layout = {
      ...(base.layout || {}),
      jsonResumeExtras: extras,
      jsonResumeSource: clone(
        Object.fromEntries(
          Object.entries(value).filter(([key]) => known.has(key) && key !== "$schema"),
        ),
      ),
    };
    const b = value.basics || {};
    base.basics = {
      ...(base.basics || {}),
      name: b.name || "",
      label: b.label || "",
      email: b.email || "",
      phone: b.phone || "",
      url: b.url || "",
      location: locationText(b.location),
    };
    base.summary = b.summary || "";
    if (object(b.location)) base.layout.jsonResumeLocation = clone(b.location);
    base.experience = (value.work || []).map((entry, index) => ({
      ...base.experience?.[index],
      company: entry.name || "",
      role: entry.position || "",
      location: entry.location || "",
      dates: dates(entry),
      summary: entry.summary || "",
      highlights: entry.highlights || [],
    }));
    base.education = (value.education || []).map((entry, index) => ({
      ...base.education?.[index],
      institution: entry.institution || "",
      degree: entry.studyType || entry.area || "",
      area: entry.area || "",
      dates: dates(entry),
    }));
    base.skills = (value.skills || []).flatMap((entry) =>
      typeof entry === "string"
        ? [entry]
        : entry.keywords?.length
          ? entry.keywords
          : [entry.name || ""],
    );
    base.projects = (value.projects || []).map((entry) => clone(entry));
    base.languages = (value.languages || []).map((entry) =>
      typeof entry === "string"
        ? entry
        : [entry.language, entry.fluency].filter(Boolean).join(" — "),
    );
    return assertModel(base);
  }
  function validateSession(session) {
    if (
      !object(session) ||
      !Array.isArray(session.resumes) ||
      !session.resumes.length ||
      !Array.isArray(session.folders)
    )
      throw new Error("A session needs résumés and folders.");
    if (session.resumes.length > 500 || session.folders.length > 500)
      throw new Error("A session can contain at most 500 résumés and 500 folders.");
    const ids = new Set();
    for (const item of session.resumes) {
      if (!item.id || ids.has(item.id)) throw new Error("Duplicate or missing résumé identifier.");
      ids.add(item.id);
      assertModel(item.data);
    }
    const folders = new Map();
    for (const folder of session.folders) {
      if (!folder.id || folders.has(folder.id))
        throw new Error("Duplicate or missing folder identifier.");
      folders.set(folder.id, folder);
    }
    for (const folder of folders.values()) {
      const seen = new Set();
      let current = folder;
      while (current) {
        if (seen.has(current.id)) throw new Error("Folders cannot contain a cycle.");
        seen.add(current.id);
        current = folders.get(current.parentId);
      }
    }
    return session;
  }
  function mergeSession(
    current,
    incoming,
    currentTemplates = [],
    incomingTemplates = [],
    idFactory,
  ) {
    validateSession(incoming);
    if (!Array.isArray(incomingTemplates)) throw new Error("Invalid template library.");
    const result = clone(current),
      templates = clone(currentTemplates),
      folderIds = new Map(),
      resumeIds = new Map(),
      templateIds = new Map();
    let counter = 0;
    const used = new Set(
      [...result.resumes, ...result.folders, ...templates].map((item) => item.id),
    );
    const makeId = (prefix) => {
      let id;
      do {
        id = idFactory ? idFactory(prefix) : `${prefix}-import-${++counter}`;
      } while (used.has(id));
      used.add(id);
      return id;
    };
    for (const template of incomingTemplates) {
      if (!object(template) || !template.id || !template.name)
        throw new Error("Invalid imported template.");
      const existing = templates.find((item) => item.id === template.id);
      if (existing && JSON.stringify(existing) === JSON.stringify(template)) {
        templateIds.set(template.id, existing.id);
        continue;
      }
      const id = makeId("template");
      templateIds.set(template.id, id);
      const copy = clone(template);
      copy.id = id;
      if (copy.css) copy.css = copy.css.split(template.id).join(id);
      templates.push(copy);
    }
    for (const template of templates)
      if (
        templateIds.has(template.base) &&
        incomingTemplates.some((item) => templateIds.get(item.id) === template.id)
      )
        template.base = templateIds.get(template.base);
    const sourceFolders = incoming.folders.length
      ? incoming.folders
      : [{ id: "import-root", name: "Imported résumés", parentId: null }];
    for (const folder of sourceFolders) folderIds.set(folder.id, makeId("folder"));
    for (const folder of sourceFolders)
      result.folders.push({
        ...clone(folder),
        id: folderIds.get(folder.id),
        parentId: folderIds.get(folder.parentId) || null,
      });
    for (const item of incoming.resumes) {
      const copy = clone(item),
        id = makeId("resume");
      resumeIds.set(item.id, id);
      copy.id = id;
      copy.folderId = folderIds.get(item.folderId) || folderIds.values().next().value;
      if (templateIds.has(copy.data.template))
        copy.data.template = templateIds.get(copy.data.template);
      if (copy.versions)
        for (const version of copy.versions) {
          version.id = makeId("version");
          if (version.json) {
            const data = JSON.parse(version.json);
            if (templateIds.has(data.template)) data.template = templateIds.get(data.template);
            version.json = JSON.stringify(data, null, 2);
          }
        }
      result.resumes.push(copy);
    }
    const importedOpen = (incoming.openIds || []).map((id) => resumeIds.get(id)).filter(Boolean);
    result.activeId = resumeIds.get(incoming.activeId) || resumeIds.values().next().value;
    result.openIds = [...new Set([...(result.openIds || []), ...importedOpen, result.activeId])];
    result.collapsedFolders = [
      ...(result.collapsedFolders || []),
      ...(incoming.collapsedFolders || []).map((id) => folderIds.get(id)).filter(Boolean),
    ];
    for (const key of [
      "view",
      "inputMode",
      "outputMode",
      "sourceFirst",
      "panelWeights",
      "layoutVersion",
      "collapsedPanels",
      "mobilePane",
    ])
      if (incoming[key] != null) result[key] = clone(incoming[key]);
    return { workspace: result, templates };
  }
  function compareFormats(data, mapper, clock = () => performance.now()) {
    const json = JSON.stringify(data, null, 2),
      xml = toXml(data),
      expected = mapper.fillForm(data);
    const parse = { json: () => assertModel(JSON.parse(json)), xml: () => fromXml(xml) },
      times = { json: [], xml: [] };
    for (let n = 0; n < 10; n++)
      for (const format of ["json", "xml"]) mapper.fillForm(parse[format]());
    for (let round = 0; round < 15; round++)
      for (const format of round % 2 ? ["xml", "json"] : ["json", "xml"]) {
        const start = clock();
        for (let n = 0; n < 20; n++) mapper.fillForm(parse[format]());
        times[format].push((clock() - start) / 20);
      }
    const results = ["json", "xml"].map((format) => {
      const sorted = times[format].sort((a, b) => a - b),
        evaluation = mapper.evaluate(mapper.fillForm(parse[format]()), expected);
      return {
        ...evaluation,
        format,
        sample_id: "tarun",
        elapsed_ms: Math.max(0.00001, Number(sorted[7].toFixed(5))),
        p95_ms: sorted[14],
        bytes: new TextEncoder().encode(format === "json" ? json : xml).length,
      };
    });
    return {
      samples: [{ id: "tarun", name: "Tarun B", expected, results }],
      timeScale: 6000 / Math.max(...results.map((row) => row.elapsed_ms)),
    };
  }

  return {
    assertModel,
    toXml,
    fromXml,
    isJsonResume,
    toJsonResume,
    fromJsonResume,
    validateSession,
    mergeSession,
    compareFormats,
  };
});
