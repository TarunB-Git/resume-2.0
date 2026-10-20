(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.ResumePdf = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const encoder = new TextEncoder();
  const bytes = (value) => (value instanceof Uint8Array ? value : encoder.encode(value));
  function concat(parts) {
    const output = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
    let offset = 0;
    for (const part of parts) {
      output.set(part, offset);
      offset += part.length;
    }
    return output;
  }
  function text(value) {
    let hex = "feff";
    for (let i = 0; i < String(value).length; i++)
      hex += String(value).charCodeAt(i).toString(16).padStart(4, "0");
    return "<" + hex + ">";
  }
  function create({ streams, width, height, model, jsonResume }) {
    if (
      !Array.isArray(streams) ||
      !Number.isFinite(width) ||
      !Number.isFinite(height) ||
      width <= 0 ||
      height <= 0
    )
      throw new Error("PDF pages need content and valid dimensions.");
    const objects = [],
      add = (body) => {
        objects.push(bytes(body));
        return objects.length;
      };
    const stream = (content, entries = "") => {
      const data = bytes(content);
      return add(
        concat([
          bytes(`<< /Length ${data.length} ${entries} >>\nstream\n`),
          data,
          bytes("\nendstream"),
        ]),
      );
    };
    const catalog = add(""),
      pages = add("");
    const fonts = [
      ["HR", "Helvetica"],
      ["HB", "Helvetica-Bold"],
      ["HI", "Helvetica-Oblique"],
      ["HBI", "Helvetica-BoldOblique"],
      ["TR", "Times-Roman"],
      ["TB", "Times-Bold"],
      ["TI", "Times-Italic"],
      ["TBI", "Times-BoldItalic"],
    ];
    const fontMap = fonts
      .map(
        ([key, name]) =>
          `/${key} ${add(`<< /Type /Font /Subtype /Type1 /BaseFont /${name} /Encoding /WinAnsiEncoding >>`)} 0 R`,
      )
      .join(" ");
    const pageIds = (streams.length ? streams : [""]).map((content, index) => {
      const contentId = stream(content);
      const links = (streams.annotations?.[index] || []).flatMap((link) => {
        if (
          !Array.isArray(link.rect) ||
          link.rect.length !== 4 ||
          !link.rect.every(Number.isFinite)
        )
          throw new Error("PDF link bounds are invalid.");
        let url;
        try {
          url = new URL(String(link.url));
          if (!["http:", "https:", "mailto:", "tel:"].includes(url.protocol)) return [];
        } catch {
          return [];
        }
        const destination = "(" + url.href.replace(/[()\\]/g, "\\$&") + ")";
        return [
          add(
            `<< /Type /Annot /Subtype /Link /Rect [${link.rect.map((n) => n.toFixed(2)).join(" ")}] /Border [0 0 0] /A << /S /URI /URI ${destination} >> >>`,
          ),
        ];
      });
      return add(
        `<< /Type /Page /Parent ${pages} 0 R /MediaBox [0 0 ${width} ${height}] /Resources << /Font << ${fontMap} >> >> /Contents ${contentId} 0 R ${links.length ? `/Annots [${links.map((id) => id + " 0 R").join(" ")}]` : ""} >>`,
      );
    });
    const attachments = [];
    for (const [filename, data, relationship, description] of [
      ["resume.json", jsonResume, "Data", "JSON Resume data"],
      ["resume20-source.json", model, "Source", "Complete editable resume source"],
    ]) {
      if (!data) continue;
      const content = bytes(JSON.stringify(data, null, 2));
      const embedded = stream(
        content,
        `/Type /EmbeddedFile /Subtype /application#2Fjson /Params << /Size ${content.length} >>`,
      );
      const spec = add(
        `<< /Type /Filespec /F (${filename}) /UF ${text(filename)} /Desc ${text(description)} /AFRelationship /${relationship} /EF << /F ${embedded} 0 R /UF ${embedded} 0 R >> >>`,
      );
      attachments.push({ filename, spec });
    }
    attachments.sort((a, b) => (a.filename < b.filename ? -1 : a.filename > b.filename ? 1 : 0));
    const embeddedNames = attachments
      .map(({ filename, spec }) => `(${filename}) ${spec} 0 R`)
      .join(" ");
    objects[catalog - 1] = bytes(
      `<< /Type /Catalog /Pages ${pages} 0 R ${attachments.length ? `/AF [${attachments.map(({ spec }) => spec + " 0 R").join(" ")}] /Names << /EmbeddedFiles << /Names [${embeddedNames}] >> >>` : ""} >>`,
    );
    objects[pages - 1] = bytes(
      `<< /Type /Pages /Kids [${pageIds.map((id) => id + " 0 R").join(" ")}] /Count ${pageIds.length} >>`,
    );
    const info = add(
      `<< /Title ${text((model?.basics?.name || "Resume") + " — Resume")} /Producer (Resume 2.0) >>`,
    );
    const chunks = [bytes("%PDF-2.0\n"), new Uint8Array([37, 226, 227, 207, 211, 10])],
      offsets = [];
    let offset = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    objects.forEach((body, i) => {
      offsets.push(offset);
      const chunk = concat([bytes(`${i + 1} 0 obj\n`), body, bytes("\nendobj\n")]);
      chunks.push(chunk);
      offset += chunk.length;
    });
    chunks.push(
      bytes(
        `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((n) => String(n).padStart(10, "0") + " 00000 n \n").join("")}trailer\n<< /Size ${objects.length + 1} /Root ${catalog} 0 R /Info ${info} 0 R >>\nstartxref\n${offset}\n%%EOF\n`,
      ),
    );
    return concat(chunks);
  }
  return { create };
});
