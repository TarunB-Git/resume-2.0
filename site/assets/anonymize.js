(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.ResumePrivacy = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const normalize = (key) =>
    String(key)
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
  const fold = (text) => String(text).normalize("NFC").replace(/\s+/g, "").toLowerCase();
  const escapePattern = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const escapeHtml = (text) =>
    text.replace(
      /[&<>"']/g,
      (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char],
    );
  const generic =
    /^(?:Full Name|First Name|Last Name|Job title|City|Country|Region|City, Country|123 Example Street|REDACTED|username|name@example\.com|https:\/\/example\.com|\+1 \(202\) 555-0100|(?:Company|University|Project|Certification|Award|Publication|Name) \d+)$/;
  const structural = new Set([
    "template",
    "id",
    "base",
    "variant",
    "path",
    "datapath",
    "sectionkey",
    "sectionorder",
  ]);
  const dateFields =
    /^(?:date|dates|startdate|enddate|start|end|year|graduationdate|graduationyear|issuedate|expirydate)$/;
  const fileExtensions = new Set([
    "json",
    "pdf",
    "docx",
    "xml",
    "tex",
    "md",
    "js",
    "css",
    "html",
    "txt",
    "png",
    "jpg",
    "jpeg",
    "svg",
    "zip",
    "cjs",
    "mjs",
    "yaml",
    "py",
    "ts",
    "tsx",
    "jsx",
  ]);
  const fixedAttributes = new Set([
    "class",
    "id",
    "data-path",
    "data-section-key",
    "data-chunked",
    "role",
    "contenteditable",
    "spellcheck",
  ]);
  const numeric = (key) => /^\d+$/.test(key);
  const semanticKey = (path) => normalize([...path].reverse().find((key) => !numeric(key)) || "");
  const entityMap = {
    amp: "&",
    lt: "<",
    gt: ">",
    quot: '"',
    apos: "'",
    nbsp: "\u00a0",
    eacute: "é",
    Eacute: "É",
    aacute: "á",
    ouml: "ö",
    uuml: "ü",
    ntilde: "ñ",
    rsquo: "’",
    lsquo: "‘",
    ndash: "–",
    mdash: "—",
  };
  function decodeHtml(text) {
    if (!text.includes("&")) return text;
    if (typeof DOMParser !== "undefined") {
      // Escaping literal tags makes this an inert entity decode, with no resource elements.
      return new DOMParser().parseFromString(
        "<body>" + text.replace(/</g, "&lt;") + "</body>",
        "text/html",
      ).body.textContent;
    }
    return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity) => {
      if (entity.startsWith("#")) {
        const value =
          entity[1].toLowerCase() === "x" ? parseInt(entity.slice(2), 16) : Number(entity.slice(1));
        return value > 0 && value <= 0x10ffff && !(value >= 0xd800 && value <= 0xdfff)
          ? String.fromCodePoint(value)
          : "\ufffd";
      }
      return entityMap[entity] ?? match;
    });
  }
  function visit(value, callback, path = []) {
    if (Array.isArray(value))
      return value.map((item, i) => visit(item, callback, [...path, String(i)]));
    if (value && typeof value === "object") {
      for (const key of Object.keys(value))
        value[key] = visit(value[key], callback, [...path, key]);
      return value;
    }
    return callback(value, path);
  }
  function anonymize(input) {
    if (!input || typeof input !== "object" || Array.isArray(input))
      throw new Error("A résumé must be a JSON object.");
    const model = JSON.parse(JSON.stringify(input));
    const records = new Map(),
      replacements = new Map(),
      identities = new Map(),
      reserved = new Map();
    const fieldPaths = new Set();
    const reserve = (type, n) => {
      if (!reserved.has(type)) reserved.set(type, new Set());
      reserved.get(type).add(n);
    };
    visit(model, (value, path) => {
      for (let i = 1; i <= path.length; i++) fieldPaths.add(path.slice(0, i).join("."));
      const match =
        typeof value === "string" &&
        /^(Company|University|Project|Certification|Award|Publication|Name) (\d+)$/.exec(value);
      if (match) reserve(match[1], Number(match[2]));
      return value;
    });
    const numbered = (type, value) => {
      if (new RegExp("^" + type + " \\d+$").test(String(value))) return value;
      const key = type + ":" + fold(value);
      if (!identities.has(key)) {
        let n = 1;
        while (reserved.get(type)?.has(n)) n++;
        reserve(type, n);
        identities.set(key, type + " " + n);
      }
      return identities.get(key);
    };
    const isStyle = (path) =>
      path
        .map(normalize)
        .some((key) => ["format", "fieldstyles", "textstyles", "styles"].includes(key));
    const inSection = (path, ...names) => path.map(normalize).some((part) => names.includes(part));
    const identityValue = (value, path) => {
      if (value === "" || value == null || typeof value === "object") return undefined;
      const field = semanticKey(path);
      if (isStyle(path)) return undefined;
      if (/^(?:photo|photograph|avatar|image|picture|logo)(?:url|uri)?$/.test(field)) return "";
      if (/^(?:email|emails|emailaddress|contactemail)$/.test(field)) return "name@example.com";
      if (
        /^(?:phone|phones|phonenumber|telephone|mobile|mobilenumber|contactnumber|fax)$/.test(field)
      )
        return typeof value === "number" ? 2025550100 : "+1 (202) 555-0100";
      if (
        /^(?:url|urls|uri|website|websiteurl|web|link|href|linkedin|github|portfolio|homepage)$/.test(
          field,
        ) ||
        /url$/.test(field)
      ) {
        if (/^mailto:/i.test(String(value))) return "mailto:name@example.com";
        if (/^tel:/i.test(String(value))) return "tel:+12025550100";
        return "https://example.com";
      }
      if (/^(?:username|handle|userid)$/.test(field)) return "username";
      if (field === "label" && inSection(path, "basics", "personal")) return "Job title";
      if (
        /^(?:manager|supervisor|referee|recruiter|author|authors|owner|firstname|givenname|lastname|familyname|surname|maidenname|fullname|legalname|preferredname|displayname|contactname)$/.test(
          field,
        )
      ) {
        if (/^(?:firstname|givenname)$/.test(field)) return "First Name";
        if (/^(?:lastname|familyname|surname|maidenname)$/.test(field)) return "Last Name";
        return "Full Name";
      }
      if (/^(?:birthdate|dateofbirth|birthday|dob)$/.test(field)) return "2000-01-01";
      if (/^(?:nationality|citizenship|country)$/.test(field)) return "Country";
      if (field === "countrycode") return "XX";
      if (/^(?:city|hometown)$/.test(field)) return "City";
      if (/^(?:region|state|province)$/.test(field)) return "Region";
      if (/^(?:postalcode|postcode|zipcode|zip)$/.test(field))
        return typeof value === "number" ? 0 : "00000";
      if (/^(?:address|street|streetaddress|addressline1|addressline2)$/.test(field))
        return "123 Example Street";
      if (/^(?:location|residence|basedin)$/.test(field)) return "City, Country";
      if (
        /^(?:password|secret|apikey|accesstoken|ssn|passport|passportnumber|nationalid)$/.test(
          field,
        )
      )
        return "REDACTED";
      if (
        /^(?:company|companies|companyname|employer|employers|employername|organization|organisation|organizationname|organisationname|client|clientname)$/.test(
          field,
        )
      )
        return numbered("Company", value);
      if (
        /^(?:school|schools|schoolname|institution|institutions|institutionname|university|universities|universityname|college|collegename)$/.test(
          field,
        )
      )
        return numbered("University", value);
      if (field === "name" || field === "names") {
        if (inSection(path, "skills", "languages")) return undefined;
        if (inSection(path, "basics", "personal", "contact", "person")) return "Full Name";
        if (inSection(path, "education", "school", "institution", "university"))
          return numbered("University", value);
        if (
          inSection(
            path,
            "work",
            "experience",
            "employment",
            "volunteer",
            "company",
            "employer",
            "organization",
            "organisation",
          )
        )
          return numbered("Company", value);
        if (inSection(path, "projects")) return numbered("Project", value);
        if (inSection(path, "certifications", "certificates"))
          return numbered("Certification", value);
        if (inSection(path, "awards")) return numbered("Award", value);
        if (inSection(path, "publications")) return numbered("Publication", value);
        return numbered("Name", value);
      }
      if (
        field.endsWith("name") &&
        !/^(?:fontname|filename|templatename|classname|tagname)$/.test(field)
      )
        return numbered("Name", value);
      return undefined;
    };
    const remember = (value, replacement, fragment = false) => {
      if (typeof value !== "string" || !value.trim() || generic.test(value.trim()) || !replacement)
        return;
      const text = value.trim();
      if (text.length < 2 || text.length > 2000) return;
      const key = fold(text);
      if (!replacements.has(key)) replacements.set(key, replacement);
      for (const form of [text.normalize("NFC"), text.normalize("NFD")])
        if (!records.has(form)) records.set(form, { text: form, key, fragment });
    };
    const personalNames = [];
    visit(model, (value, path) => {
      const replacement = identityValue(value, path),
        field = semanticKey(path);
      // A generic header title must not replace the same job title throughout career history.
      if (replacement !== undefined && field !== "label") remember(value, replacement);
      if (replacement === "Full Name" && typeof value === "string") personalNames.push(value);
      return value;
    });
    for (const fullName of personalNames) {
      if (generic.test(fullName.trim())) continue;
      const parts = fullName.trim().split(/\s+/);
      if (parts.length > 1)
        parts.forEach((part, i) => {
          if (part.length >= 3) remember(part, i === 0 ? "First Name" : "Last Name", true);
        });
    }
    const entries = [...records.values()].sort((a, b) => b.text.length - a.text.length);
    const pattern = (text) => escapePattern(text).replace(/\s+/g, "\\s*");
    const known = entries.length
      ? new RegExp(
          "(?<![\\p{L}\\p{N}_])(?:" +
            entries.map((entry) => pattern(entry.text)).join("|") +
            ")(?![\\p{L}\\p{N}_])",
          "giu",
        )
      : null;
    function editsFor(text, { names = true, phones = true } = {}) {
      const edits = [];
      const add = (regex, replacement, priority = 0) => {
        for (const match of text.matchAll(regex)) {
          const result = replacement(match);
          if (result == null) continue;
          const [value, trim = 0] = Array.isArray(result) ? result : [result];
          edits.push({
            start: match.index,
            end: match.index + match[0].length - trim,
            value,
            priority,
          });
        }
      };
      add(
        /\b(?:https?:\/\/|ftp:\/\/|www\.)[^\s<>"'`]+/gi,
        (match) => ["https://example.com", match[0].match(/[),.;:!?]+$/)?.[0].length || 0],
        50,
      );
      add(
        /\b[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9-]+(?:\.[A-Z0-9-]+)+\b/gi,
        () => "name@example.com",
        50,
      );
      add(/\btel:[+\d][\d() .-]*/gi, () => "tel:+12025550100", 50);
      add(
        /\b(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,63}(?:\/[^\s<>"'`]*)?/gi,
        (match) => {
          const value = match[0],
            extension = value.split("/")[0].split(".").at(-1).toLowerCase();
          return fieldPaths.has(value) || fileExtensions.has(extension) ? null : "example.com";
        },
        40,
      );
      if (phones)
        add(
          /(?<![\p{L}\p{N}])\+?\d[\d ()\.\-]{6,}\d(?![\p{L}\p{N}])/gu,
          (match) => {
            const value = match[0].trim(),
              digits = value.replace(/\D/g, "");
            const date =
              /^(?:\d{4}[ /-]+)+\d{4}$/.test(value) ||
              /^\d{4}[-/.]\d{1,2}[-/.]\d{1,2}$/.test(value) ||
              /^(?:\d{1,2}[-/.]){2}\d{4}$/.test(value);
            const formatted =
              /^[+]/.test(value) ||
              /[()]/.test(value) ||
              value.split(/[ .-]+/).length >= 3 ||
              /^\d{3,5}[ -]\d{4,8}$/.test(value);
            return digits.length >= 8 && digits.length <= 15 && formatted && !date
              ? "+1 (202) 555-0100"
              : null;
          },
          30,
        );
      if (names && known)
        add(
          known,
          (match) => {
            const value = match[0],
              key = fold(value);
            const candidates = entries.filter((entry) => entry.key === key);
            if (
              value === value.toLowerCase() &&
              candidates.length &&
              candidates.every((entry) => entry.fragment)
            )
              return null;
            if (
              /^(?:may|june|july|august|march)$/i.test(value) &&
              /^\s*\d{2,4}\b/.test(text.slice(match.index + value.length))
            )
              return null;
            return (
              replacements.get(key) ??
              replacements.get(
                entries.find((entry) =>
                  new RegExp("^" + pattern(entry.text) + "$", "iu").test(value),
                )?.key,
              )
            );
          },
          20,
        );
      // Select matches before changing text, so generic replacements cannot be redacted again.
      edits.sort(
        (a, b) =>
          b.priority - a.priority || b.end - b.start - (a.end - a.start) || a.start - b.start,
      );
      const selected = [];
      for (const edit of edits)
        if (!selected.some((other) => edit.start < other.end && edit.end > other.start))
          selected.push(edit);
      return selected.sort((a, b) => a.start - b.start);
    }
    function applyEdits(text, edits) {
      for (let i = edits.length - 1; i >= 0; i--)
        text = text.slice(0, edits[i].start) + edits[i].value + text.slice(edits[i].end);
      return text;
    }
    const redactText = (text, options) => applyEdits(text, editsFor(text, options));
    function redactCss(css) {
      return css
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/url\(\s*(?:"[^"]*"|'[^']*'|[^)]*)\s*\)/gi, "none")
        .replace(
          /(["'])(?:\\.|(?!\1)[^\\])*?\1/g,
          (value) => value[0] + redactText(value.slice(1, -1), { phones: false }) + value[0],
        );
    }
    function redactHtml(html) {
      const clean = html
        .replace(/<(script|iframe|object|svg)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, "")
        .replace(/<(?:img|embed|source)\b(?:[^>"']|"[^"]*"|'[^']*')*>/gi, "");
      const tokens = clean.split(
        /(<style\b[^>]*>[\s\S]*?<\/style\s*>|<!--[\s\S]*?-->|<\/?[a-z](?:[^>"']|"[^"]*"|'[^']*')*>)/gi,
      );
      const segments = [];
      let flat = "";
      tokens.forEach((raw, index) => {
        if (!raw.startsWith("<")) {
          const text = decodeHtml(raw);
          segments.push({
            index,
            start: flat.length,
            end: flat.length + text.length,
            text,
            edits: [],
          });
          flat += text;
        } else if (/^<br\b|^<\/(?:p|h[1-6]|div|li|section|header|article)\b/i.test(raw))
          flat += "\n";
      });
      for (const edit of editsFor(flat)) {
        const affected = segments.filter(
          (segment) => segment.end > edit.start && segment.start < edit.end,
        );
        affected.forEach((segment, i) =>
          segment.edits.push({
            start: Math.max(edit.start, segment.start) - segment.start,
            end: Math.min(edit.end, segment.end) - segment.start,
            value: i === 0 ? edit.value : "",
          }),
        );
      }
      for (const segment of segments)
        if (segment.edits.length)
          tokens[segment.index] = escapeHtml(applyEdits(segment.text, segment.edits));
      return tokens
        .map((raw) => {
          if (/^<!--/.test(raw)) return "";
          if (/^<style\b/i.test(raw))
            return raw.replace(
              /(^<style\b[^>]*>)([\s\S]*?)(<\/style\s*>$)/i,
              (_, a, css, b) => a + redactCss(css) + b,
            );
          if (!/^<[a-z]/i.test(raw)) return raw;
          return raw.replace(
            /(\s)([\w:-]+)(\s*=\s*)(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g,
            (match, space, key, equals, a, b, c) => {
              const name = key.toLowerCase(),
                value = decodeHtml(a ?? b ?? c);
              if (fixedAttributes.has(name)) return match;
              let replacement;
              if (/^(?:href|src|action|poster|data)$/.test(name))
                replacement = value.startsWith("#")
                  ? value
                  : /^mailto:/i.test(value)
                    ? "mailto:name@example.com"
                    : /^tel:/i.test(value)
                      ? "tel:+12025550100"
                      : "https://example.com";
              else replacement = name === "style" ? redactCss(value) : redactText(value);
              return space + key + equals + '"' + escapeHtml(replacement) + '"';
            },
          );
        })
        .join("");
    }
    return visit(model, (value, path) => {
      const replacement = identityValue(value, path);
      if (replacement !== undefined) return replacement;
      if (typeof value !== "string") return value;
      const field = semanticKey(path);
      if (structural.has(field) || fieldPaths.has(value)) return value;
      if (field === "css" || field === "style") return redactCss(value);
      if (["richdocument", "html", "markup", "richtext"].includes(field)) return redactHtml(value);
      if (isStyle(path)) return redactText(value, { names: false, phones: false });
      const preserve = dateFields.test(field) || inSection(path, "skills", "languages");
      return redactText(value, { names: !preserve, phones: !preserve });
    });
  }
  function createCopy(input, template = null) {
    const result = anonymize({ resume: input, template });
    return { data: result.resume, template: result.template };
  }
  return { anonymize, createCopy };
});
