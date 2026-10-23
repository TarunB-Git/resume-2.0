(function (root) {
  "use strict";
  const headings = {
    contact: "contact",
    "contact details": "contact",
    profile: "summary",
    "professional summary": "summary",
    summary: "summary",
    "work experience": "experience",
    employment: "experience",
    experience: "experience",
    education: "education",
    skills: "skills",
    "technical skills": "skills",
    projects: "projects",
    certifications: "certifications",
    languages: "languages",
    publications: "publications",
    volunteering: "volunteering",
  };
  const datePattern =
    /(?:\b(?:19|20)\d{2}|\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4})\s*(?:[-–—]|to)\s*(?:Present|Current|(?:[A-Za-z]+\s+)?\d{4})/i;
  const rolePattern =
    /\b(designer|engineer|developer|manager|analyst|researcher|director|consultant|architect|specialist|coordinator|scientist|lead|intern)\b/i;
  const degreePattern =
    /\b(BFA|BSc|B\.Sc\.?|BA|BS|MS|MSc|MA|MBA|PhD|B\.?Tech|M\.?Tech|BEng|MEng|B\.?E\.?|M\.?E\.?|Bachelor|Master|Doctor|Diploma|Certificate)\b/i;
  function parseText(source) {
    let text = String(source || "")
      .replace(/\r\n?/g, "\n")
      .replace(/\bPage\s+\d+\s+of\s+\d+\b/gi, "");
    if (/\\(?:documentclass|begin\{document\}|section)/.test(text))
      text = text
        .replace(/\\(?:begin|end)\{[^}]+\}/g, "\n")
        .replace(/\\(?:section\*?|subsection\*?)\{([^}]+)\}/g, "\n$1\n")
        .replace(/\\CVField\{[^}]+\}\{([^{}]*)\}/g, "$1")
        .replace(/%[^\n]*/g, "")
        .replace(/\\[A-Za-z@]+(?:\[[^\]]*\])?/g, " ")
        .replace(/[{}$]/g, " ");
    const lines = text
      .split("\n")
      .map((x) =>
        x
          .replace(/^[\s#>*•▪›]+/, "")
          .replace(/\*\*/g, "")
          .trim(),
      )
      .filter(Boolean);
    const email = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || "";
    const phone =
      [...text.matchAll(/\+?\d[\d ().-]{8,}\d/g)]
        .map((x) => x[0].trim())
        .find((x) => !datePattern.test(x) && x.replace(/\D/g, "").length >= 9) || "";
    const url =
      text
        .replace(email, "")
        .match(
          /(?:https?:\/\/|www\.)[^\s|·]+|\b[a-z0-9][a-z0-9.-]+\.(?:com|design|dev|io|net|org)(?:\/[^\s|·]*)?/i,
        )?.[0] || "";
    const firstSection = lines.findIndex((x) => headings[x.toLowerCase().replace(/:$/, "")]);
    const header = lines.slice(0, firstSection < 0 ? Math.min(6, lines.length) : firstSection);
    const contact = (x) =>
      x.includes("@") ||
      /https?:\/\/|www\./i.test(x) ||
      (phone && x.includes(phone)) ||
      (url && x.includes(url));
    const name =
      header
        .find((x) => !contact(x) && !headings[x.toLowerCase()])
        ?.split(/[|·]/)[0]
        ?.trim() || "";
    const headerFields = header.flatMap((line) => line.split(/[|·]/).map((value) => value.trim()));
    const afterName = headerFields[headerFields.indexOf(name) + 1] || "";
    const label =
      headerFields.find((x) => x !== name && !contact(x) && rolePattern.test(x)) ||
      (afterName.length < 100 &&
      !contact(afterName) &&
      !datePattern.test(afterName) &&
      !/[,|·]|^(?:resume|résumé|cv)\b/i.test(afterName)
        ? afterName
        : "");
    const contactIndex = lines.findIndex((x) => /^(contact|contact details)$/i.test(x));
    const contactBlock =
      contactIndex >= 0
        ? lines
            .slice(contactIndex + 1)
            .slice(
              0,
              lines.slice(contactIndex + 1).findIndex((x) => headings[x.toLowerCase()]) < 0
                ? lines.length
                : lines.slice(contactIndex + 1).findIndex((x) => headings[x.toLowerCase()]),
            )
        : header;
    const location =
      contactBlock
        .flatMap((x) => x.split(/[|·]/))
        .map((x) => x.trim())
        .find(
          (x) =>
            x !== name &&
            x !== label &&
            !contact(x) &&
            x.length < 70 &&
            /^[\p{L} .'-]+,\s*[\p{L} .'-]+$/u.test(x),
        ) || "";
    const result = {
      template: "modern",
      format: { font: "Arial", accent: "#496f91", bullet: "disc" },
      basics: { name, label, email, phone, location, url: url.replace(/^https?:\/\//i, "") },
      summary: "",
      experience: [],
      education: [],
      skills: [],
      projects: [],
    };
    const sections = {};
    let current = "intro";
    for (const line of lines) {
      const key = headings[line.toLowerCase().replace(/:$/, "")];
      if (key) {
        current = key;
        sections[key] ||= [];
      } else if (current !== "intro") (sections[current] ||= []).push(line);
    }
    result.summary = (sections.summary || []).join(" ");
    const exp = sections.experience || [];
    let entry = null;
    for (let i = 0; i < exp.length; i++) {
      const line = exp[i],
        parts = line.split(/\s+[|·]\s+/),
        date = line.match(datePattern)?.[0];
      const shortRole =
        line.length < 130 &&
        rolePattern.test(parts[0]) &&
        !/^(Led|Built|Designed|Managed|Improved|Reduced|Delivered|Worked|Supported|Created|Developed)\b/i.test(
          line,
        );
      if (shortRole) {
        entry = {
          role: parts[0].replace(datePattern, "").trim(),
          company: parts.find((x, n) => n > 0 && !datePattern.test(x)) || "",
          dates: date || "",
          highlights: [],
        };
        result.experience.push(entry);
      } else if (entry && date) {
        entry.dates = date;
        const rest = line
          .replace(datePattern, "")
          .replace(/[|·–—-]+$/, "")
          .trim();
        if (rest && !entry.company) entry.company = rest;
      } else if (entry && !entry.company && line.length < 85 && !/[.!?]$/.test(line)) {
        entry.company = line;
      } else if (entry) entry.highlights.push(line.replace(/^[-–—]+\s*/, ""));
      else {
        entry = { role: "", company: line, dates: "", highlights: [] };
        result.experience.push(entry);
      }
    }
    let education = null;
    for (const line of sections.education || []) {
      const parts = line.split(/\s+[|·]\s+/),
        degree = parts.find((x) => degreePattern.test(x)),
        date = line.match(datePattern)?.[0];
      if (degree) {
        if (!education || education.degree) {
          education = { institution: "", degree: "", dates: "" };
          result.education.push(education);
        }
        education.degree = degree.replace(datePattern, "").trim();
        const school = parts.find((x) => x !== degree && !datePattern.test(x));
        if (school) education.institution = school;
        if (date) education.dates = date;
      } else if (date && education) education.dates = date;
      else {
        education = { institution: line, degree: "", dates: "" };
        result.education.push(education);
      }
    }
    for (const [key, values] of Object.entries(sections)) {
      if (["intro", "contact", "summary", "experience", "education"].includes(key)) continue;
      if (key === "projects") result.projects = values.map((name) => ({ name }));
      else
        result[key] = values
          .join(values.some((x) => /[,;|]/.test(x)) ? " " : ",")
          .split(/[,;|]+/)
          .map((x) => x.trim())
          .filter(Boolean);
    }
    if (!name && !email && !result.experience.length)
      throw new Error("No resume details found. Scanned documents need OCR.");
    return result;
  }
  const fields = [
    ["name", "Full name"],
    ["email", "Email"],
    ["phone", "Phone"],
    ["location", "Current location"],
    ["website", "Website"],
    ["currentTitle", "Current job title"],
    ["currentEmployer", "Current employer"],
    ["currentDates", "Employment dates"],
    ["previousEmployer", "Previous employer"],
    ["institution", "School / university"],
    ["degree", "Degree"],
    ["skills", "Skills"],
  ];
  function fillForm(data) {
    const b = data.basics || {},
      work = data.experience || data.work || [],
      edu = data.education || [];
    return {
      name: b.name || "",
      email: b.email || "",
      phone: b.phone || "",
      location:
        typeof b.location === "object"
          ? [b.location.city, b.location.region].filter(Boolean).join(", ")
          : b.location || "",
      website: b.url || "",
      currentTitle: work[0]?.role || work[0]?.position || "",
      currentEmployer: work[0]?.company || work[0]?.name || "",
      currentDates:
        work[0]?.dates ||
        (work[0]?.startDate
          ? [work[0].startDate, work[0].endDate || "Present"].join(" — ")
          : work[0]?.endDate || ""),
      previousEmployer: work[1]?.company || work[1]?.name || "",
      institution: edu[0]?.institution || "",
      degree: edu[0]?.degree || [edu[0]?.studyType, edu[0]?.area].filter(Boolean).join(", "),
      skills: (data.skills || [])
        .flatMap((x) => (typeof x === "string" ? [x] : x.keywords || [x.name]))
        .filter(Boolean)
        .join(", "),
    };
  }
  function normalize(value, key) {
    let x = String(value || "")
      .normalize("NFKC")
      .toLowerCase()
      .replace(/[‐‑‒–—−]/g, "-")
      .replace(/\s+/g, " ")
      .trim();
    if (key === "phone") return x.replace(/\D/g, "");
    if (key === "website") return x.replace(/^https?:\/\//, "").replace(/\/$/, "");
    if (key === "skills")
      return x
        .split(/[,;|]/)
        .map((x) => x.trim())
        .filter(Boolean)
        .sort()
        .join("|");
    return x;
  }
  function evaluate(actual, expected) {
    const rows = fields.map(([key, label]) => ({
      key,
      label,
      expected: String(expected[key] || ""),
      actual: String(actual[key] || ""),
      status:
        normalize(actual[key], key) === normalize(expected[key], key)
          ? "correct"
          : !actual[key]
            ? "missing"
            : "wrong",
    }));
    return {
      fields: rows,
      correct: rows.filter((x) => x.status === "correct").length,
      total: rows.length,
      missing: rows.filter((x) => x.status === "missing").length,
      wrong: rows.filter((x) => x.status === "wrong").length,
    };
  }
  const api = { parseText, fillForm, evaluate, fields };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.ResumeParser = api;
})(typeof window === "undefined" ? globalThis : window);
