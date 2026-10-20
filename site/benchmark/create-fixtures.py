"""Rebuild the PDF and Word copies of the sole fictional Tarun B example.

Optional tooling: Python 3, reportlab and python-docx. The app and static build
need no Python runtime. Both document copies use the same content and reading
order; the comparison uses text extraction, without embedded restoration data.
"""
from pathlib import Path
import argparse
import json
from xml.sax.saxutils import escape

ROOT = Path(__file__).resolve().parent
DATA = json.loads((ROOT / "tarun.json").read_text(encoding="utf-8"))


def blocks():
    basics = DATA["basics"]
    yield "name", basics["name"]
    yield "label", basics["label"]
    yield "contact", " | ".join(basics[key] for key in ("email", "phone", "location", "url") if basics.get(key))
    if DATA.get("summary"):
        yield "heading", "Profile"
        yield "body", DATA["summary"]
    if DATA.get("experience"):
        yield "heading", "Experience"
        for item in DATA["experience"]:
            for key in ("role", "company", "dates"):
                if item.get(key):
                    yield "role" if key == "role" else "body", item[key]
            for text in item.get("highlights", []):
                yield "bullet", text
    if DATA.get("education"):
        yield "heading", "Education"
        for item in DATA["education"]:
            for key in ("institution", "degree", "dates"):
                if item.get(key):
                    yield "body", item[key]
    if DATA.get("projects"):
        yield "heading", "Projects"
        for item in DATA["projects"]:
            yield "role", item["name"]
            yield "body", item.get("description", "")
            if item.get("url"):
                yield "body", item["url"]
    if DATA.get("skills"):
        yield "heading", "Skills"
        yield "body", ", ".join(DATA["skills"])


def pdf():
    from reportlab.lib import colors
    from reportlab.lib.enums import TA_LEFT
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import ParagraphStyle
    from reportlab.platypus import SimpleDocTemplate, Paragraph

    style = {
        kind: ParagraphStyle(kind, fontName="Helvetica-Bold" if kind in ("name", "heading", "role") else "Helvetica", fontSize=size, leading=leading, spaceBefore=before, spaceAfter=after, textColor=colors.HexColor(color), alignment=TA_LEFT)
        for kind, size, leading, before, after, color in [
            ("name", 23, 29, 0, 3, "#172b4d"),
            ("label", 11, 16, 0, 6, "#1967d2"),
            ("contact", 8.5, 13, 0, 10, "#526078"),
            ("heading", 10, 15, 16, 6, "#1967d2"),
            ("role", 10, 15, 5, 2, "#172b4d"),
            ("body", 9.5, 14, 0, 4, "#26323c"),
            ("bullet", 9.5, 14, 0, 4, "#26323c"),
        ]
    }
    document = SimpleDocTemplate(str(ROOT / "tarun.pdf"), pagesize=A4, leftMargin=48, rightMargin=48, topMargin=42, bottomMargin=42, title="Tarun B résumé", author="Résumé 2.0 example")
    document.build([Paragraph(escape(text), style[kind], bulletText="•" if kind == "bullet" else None) for kind, text in blocks()])


def docx():
    from docx import Document
    from docx.shared import Inches, Pt, RGBColor

    document = Document()
    section = document.sections[0]
    section.page_width = Inches(8.2677)
    section.page_height = Inches(11.6929)
    section.left_margin = section.right_margin = Inches(2 / 3)
    section.top_margin = section.bottom_margin = Inches(0.5833)
    normal = document.styles["Normal"]
    normal.font.name = "Arial"
    normal.font.size = Pt(9.5)
    normal.paragraph_format.space_after = Pt(4)
    document.styles["Title"].font.color.rgb = RGBColor.from_string("172B4D")
    for kind, text in blocks():
        paragraph = document.add_paragraph(text, style={"name": "Title", "heading": "Heading 2", "bullet": "List Bullet"}.get(kind))
        if kind == "role":
            paragraph.runs[0].bold = True
        if kind == "label":
            paragraph.runs[0].font.color.rgb = RGBColor.from_string("1967D2")
        if kind == "contact":
            paragraph.runs[0].font.size = Pt(8.5)
    document.core_properties.title = "Tarun B résumé"
    document.core_properties.author = "Résumé 2.0 example"
    document.save(ROOT / "tarun.docx")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("format", choices=("pdf", "docx", "all"), default="all", nargs="?")
    choice = parser.parse_args().format
    if choice in ("pdf", "all"):
        pdf()
    if choice in ("docx", "all"):
        docx()
