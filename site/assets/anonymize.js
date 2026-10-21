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
  const escapePattern = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const escapeHtml = (value) =>
    value.replace(
      /[&<>"']/g,
      (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char],
    );

  function anonymize(input) {
    if (!input || typeof input !== "object" || Array.isArray(input))
      throw new Error("A résumé must be a JSON object.");
    const model = JSON.parse(JSON.stringify(input));
    const replacements = new Map(),
      identities = new Map(),
      counts = new Map(),
      fieldPaths = new Set();
    const remember = (value, replacement) => {
      const text = String(value).trim();
      if (text.length < 2 || text.length > 2000) return;
      for (const variant of [text, escapeHtml(text)]) {
        const key = variant.toLowerCase();
        if (!replacements.has(key)) replacements.set(key, { text: variant, replacement });
      }
    };
    const numbered = (type, value) => {
      const identity = type + ":" + String(value).trim().toLowerCase();
      if (!identities.has(identity)) {
        const n = (counts.get(type) || 0) + 1;
        counts.set(type, n);
        identities.set(identity, type + " " + n);
      }
      return identities.get(identity);
    };
    const identityValue = (key, value, path) => {
      const field = normalize(key),
        parents = path.map(normalize);
      if (value === "" || value == null || typeof value === "object") return undefined;
      const inSection = (...names) => parents.some((part) => names.includes(part));
      if (/^(?:email|emailaddress|contactemail)$/.test(field)) return "name@example.com";
      if (/^(?:phone|phonenumber|telephone|mobile|mobilenumber|contactnumber|fax)$/.test(field))
        return typeof value === "number" ? 2025550100 : "+1 (202) 555-0100";
      if (
        /^(?:url|uri|website|websiteurl|web|link|href|linkedin|github|portfolio|homepage)$/.test(
          field,
        ) ||
        /url$/.test(field)
      )
        return "https://example.com";
      if (/^(?:username|handle|userid)$/.test(field)) return "username";
      if (field === "label" && inSection("basics", "personal")) return "Job title";
      if (/^(?:manager|supervisor|referee|recruiter|author|owner)$/.test(field)) return "Full Name";
      if (/^(?:firstname|givenname)$/.test(field)) return "First Name";
      if (/^(?:lastname|familyname|surname|maidenname)$/.test(field)) return "Last Name";
      if (/^(?:fullname|legalname|preferredname|displayname|contactname)$/.test(field))
        return "Full Name";
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
      if (/^(?:photo|photograph|avatar|image|picture|logo)$/.test(field)) return "";
      if (
        /^(?:password|secret|apikey|accesstoken|ssn|passport|passportnumber|nationalid)$/.test(
          field,
        )
      )
        return "REDACTED";
      if (
        /^(?:company|companyname|employer|employername|organization|organisation|organizationname|organisationname|client|clientname)$/.test(
          field,
        )
      )
        return numbered("Company", value);
      if (
        /^(?:school|schoolname|institution|institutionname|university|universityname|college|collegename)$/.test(
          field,
        )
      )
        return numbered("University", value);
      if (field === "name") {
        if (inSection("basics", "personal", "contact", "person")) return "Full Name";
        if (inSection("education", "school", "institution", "university"))
          return numbered("University", value);
        if (
          inSection(
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
        if (inSection("projects")) return numbered("Project", value);
        if (inSection("certifications", "certificates")) return numbered("Certification", value);
        if (inSection("awards")) return numbered("Award", value);
        if (inSection("publications")) return numbered("Publication", value);
        if (inSection("skills")) return undefined;
        return numbered("Name", value);
      }
      if (
        field.endsWith("name") &&
        !/^(?:fontname|filename|templatename|classname|tagname)$/.test(field)
      )
        return numbered("Name", value);
      return undefined;
    };
    const visit = (value, callback, path = []) => {
      if (Array.isArray(value))
        return value.map((item, i) => visit(item, callback, [...path, String(i)]));
      if (value && typeof value === "object") {
        for (const key of Object.keys(value))
          value[key] = visit(value[key], callback, [...path, key]);
        return value;
      }
      return callback(value, path.at(-1) || "", path.slice(0, -1));
    };
    visit(model, (value, key, path) => {
      const fullPath = [...path, key];
      for (let i = 1; i <= fullPath.length; i++) fieldPaths.add(fullPath.slice(0, i).join("."));
      const replacement = identityValue(key, value, path);
      if (replacement !== undefined && value !== replacement && typeof value === "string")
        remember(value, replacement);
      return value;
    });
    // Repeated personal-name fragments also occur in summaries and rich document text.
    const fullName = model.basics?.name;
    if (typeof fullName === "string") {
      const parts = fullName.trim().split(/\s+/);
      if (parts.length > 1)
        for (let i = 0; i < parts.length; i++)
          if (parts[i].length >= 3) remember(parts[i], i === 0 ? "First Name" : "Last Name");
    }
    const entries = [...replacements.values()].sort((a, b) => b.text.length - a.text.length);
    const known = entries.length
      ? new RegExp(
          "(?<![\\p{L}\\p{N}_])(?:" +
            entries.map((entry) => escapePattern(entry.text)).join("|") +
            ")(?![\\p{L}\\p{N}_])",
          "giu",
        )
      : null;
    const replaceText = (value) => {
      const protectedText = [];
      let marker = "\uE000";
      while (value.includes(marker)) marker += "\uE000";
      const protect = (text) => {
        const token = marker + protectedText.length + "\uE001";
        protectedText.push(text);
        return token;
      };
      let text = value.replace(/<img\b[^>]*>/gi, "");
      // Keep editor bindings intact while replacing the visible rich document text.
      text = text.replace(/\bdata-path\s*=\s*(["'])[^"']*\1/gi, (match) => protect(match));
      text = text.replace(/\b(?:https?:\/\/|ftp:\/\/|www\.)[^\s<>"'`]+/gi, (match) => {
        const trailing = match.match(/[),.;:!?]+$/)?.[0] || "";
        return protect("https://example.com") + trailing;
      });
      text = text.replace(/\b[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9-]+(?:\.[A-Z0-9-]+)+\b/gi, () =>
        protect("name@example.com"),
      );
      text = text.replace(
        /\b(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,63}(?:\/[^\s<>"'`]*)?/gi,
        (match) => {
          const extension = match.split("/")[0].split(".").at(-1).toLowerCase();
          if (
            fieldPaths.has(match) ||
            [
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
            ].includes(extension)
          )
            return match;
          return protect("example.com");
        },
      );
      text = text.replace(/\btel:[+\d][\d() .-]*/gi, () => protect("tel:+12025550100"));
      text = text.replace(/\+?\d[\d\s().-]{6,}\d/g, (match) => {
        const length = match.replace(/\D/g, "").length;
        const candidate = match.trim();
        const date =
          /^(?:\d{4}[\s/-]+)+\d{4}$/.test(candidate) ||
          /^\d{4}[-/.]\d{1,2}[-/.]\d{1,2}$/.test(candidate) ||
          /^(?:\d{1,2}[-/.]){2}\d{4}$/.test(candidate);
        return length >= 8 && length <= 15 && !date ? protect("+1 (202) 555-0100") : match;
      });
      if (known)
        text = text.replace(
          known,
          (match) => replacements.get(match.toLowerCase())?.replacement ?? match,
        );
      return text.replace(
        new RegExp(escapePattern(marker) + "(\\d+)\uE001", "g"),
        (_, index) => protectedText[Number(index)] ?? "",
      );
    };
    return visit(model, (value, key, path) => {
      const replacement = identityValue(key, value, path);
      if (replacement !== undefined) return replacement;
      return typeof value === "string" ? replaceText(value) : value;
    });
  }
  return { anonymize };
});
