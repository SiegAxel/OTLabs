from datetime import datetime
from io import BytesIO
from textwrap import wrap

from app.db.base import WorkOrder


PAGE_WIDTH = 595
PAGE_HEIGHT = 842
MARGIN = 42


def _clean(value) -> str:
    if value is None:
        return ""
    text = str(value).replace("\r", " ").replace("\n", " ")
    return " ".join(text.split())


def _pdf_text(value) -> str:
    text = _clean(value)
    data = text.encode("cp1252", "replace")
    escaped = []
    for byte in data:
        if byte in (40, 41, 92) or byte < 32 or byte > 126:
            escaped.append(f"\\{byte:03o}")
        else:
            escaped.append(chr(byte))
    return "".join(escaped)


def _money(value: int | float | None) -> str:
    amount = int(value or 0)
    return "$" + f"{amount:,}".replace(",", ".")


def _date(value: datetime | None) -> str:
    if value is None:
        return ""
    return value.strftime("%d/%m/%Y")


class PdfCanvas:
    def __init__(self):
        self.pages: list[list[str]] = []
        self.commands: list[str] = []
        self.new_page()

    def new_page(self):
        if self.commands:
            self.pages.append(self.commands)
        self.commands = []

    def finish(self) -> bytes:
        if self.commands:
            self.pages.append(self.commands)
            self.commands = []

        objects: list[bytes] = []
        catalog_id = 1
        pages_id = 2
        font_regular_id = 3
        font_bold_id = 4
        next_id = 5
        page_ids: list[int] = []
        content_ids: list[int] = []

        for _page in self.pages:
            page_ids.append(next_id)
            content_ids.append(next_id + 1)
            next_id += 2

        objects.append(b"<< /Type /Catalog /Pages 2 0 R >>")
        kids = " ".join(f"{page_id} 0 R" for page_id in page_ids)
        objects.append(f"<< /Type /Pages /Kids [{kids}] /Count {len(page_ids)} >>".encode("ascii"))
        objects.append(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>")
        objects.append(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>")

        for page_id, content_id, page in zip(page_ids, content_ids, self.pages):
            page_obj = (
                f"<< /Type /Page /Parent {pages_id} 0 R /MediaBox [0 0 {PAGE_WIDTH} {PAGE_HEIGHT}] "
                f"/Resources << /Font << /F1 {font_regular_id} 0 R /F2 {font_bold_id} 0 R >> >> "
                f"/Contents {content_id} 0 R >>"
            )
            stream = "\n".join(page).encode("latin-1", "replace")
            content_obj = b"<< /Length " + str(len(stream)).encode("ascii") + b" >>\nstream\n" + stream + b"\nendstream"
            objects.append(page_obj.encode("ascii"))
            objects.append(content_obj)

        output = BytesIO()
        output.write(b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n")
        offsets = [0]
        for index, obj in enumerate(objects, start=1):
            offsets.append(output.tell())
            output.write(f"{index} 0 obj\n".encode("ascii"))
            output.write(obj)
            output.write(b"\nendobj\n")

        xref_offset = output.tell()
        output.write(f"xref\n0 {len(objects) + 1}\n".encode("ascii"))
        output.write(b"0000000000 65535 f \n")
        for offset in offsets[1:]:
            output.write(f"{offset:010d} 00000 n \n".encode("ascii"))
        output.write(
            (
                f"trailer\n<< /Size {len(objects) + 1} /Root {catalog_id} 0 R >>\n"
                f"startxref\n{xref_offset}\n%%EOF"
            ).encode("ascii")
        )
        return output.getvalue()

    def rect(self, x, y, w, h, fill=None, stroke=None):
        if fill:
            self.color(fill)
            self.commands.append(f"{x} {y} {w} {h} re f")
        if stroke:
            self.color(stroke)
            self.commands.append(f"{x} {y} {w} {h} re S")

    def line(self, x1, y1, x2, y2, color=(0.82, 0.86, 0.91), width=1):
        self.color(color)
        self.commands.append(f"{width} w {x1} {y1} m {x2} {y2} l S")

    def color(self, rgb):
        r, g, b = rgb
        self.commands.append(f"{r:.3f} {g:.3f} {b:.3f} rg {r:.3f} {g:.3f} {b:.3f} RG")

    def text(self, x, y, value, size=10, bold=False, color=(0.10, 0.13, 0.18), align="left"):
        self.color(color)
        font = "F2" if bold else "F1"
        text = _pdf_text(value)
        approx_width = len(text) * size * 0.48
        if align == "right":
            x -= approx_width
        elif align == "center":
            x -= approx_width / 2
        self.commands.append(f"BT /{font} {size} Tf 1 0 0 1 {x:.2f} {y:.2f} Tm ({text}) Tj ET")

    def wrapped_text(self, x, y, value, width_chars=80, size=10, bold=False, line_height=14, color=(0.10, 0.13, 0.18)):
        lines = wrap(_clean(value), width=width_chars) or [""]
        for line in lines:
            self.text(x, y, line, size=size, bold=bold, color=color)
            y -= line_height
        return y


def build_quotation_pdf(work_order: WorkOrder) -> bytes:
    quotation = work_order.quotation
    if quotation is None:
        raise ValueError("Work order has no quotation")

    pdf = PdfCanvas()
    company = work_order.company
    client = work_order.client
    y = PAGE_HEIGHT - MARGIN

    primary = (0.08, 0.28, 0.44)
    accent = (0.02, 0.53, 0.62)
    muted = (0.39, 0.45, 0.55)
    light = (0.94, 0.97, 0.98)
    border = (0.82, 0.86, 0.91)

    pdf.rect(0, PAGE_HEIGHT - 112, PAGE_WIDTH, 112, fill=light)
    pdf.rect(MARGIN, PAGE_HEIGHT - 90, 58, 58, fill=primary)
    initials = "".join(part[0] for part in _clean(company.name).split()[:2]).upper() or "OT"
    pdf.text(MARGIN + 29, PAGE_HEIGHT - 66, initials, size=18, bold=True, color=(1, 1, 1), align="center")

    pdf.text(MARGIN + 74, PAGE_HEIGHT - 50, company.name, size=17, bold=True, color=primary)
    pdf.text(MARGIN + 74, PAGE_HEIGHT - 68, f"RUT: {_clean(company.tax_id) or '-'}", size=9, color=muted)
    company_contact = " | ".join(filter(None, [_clean(company.email), _clean(company.phone), _clean(company.address)]))
    pdf.text(MARGIN + 74, PAGE_HEIGHT - 84, company_contact, size=9, color=muted)

    pdf.text(PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 50, "COTIZACIÓN", size=20, bold=True, color=primary, align="right")
    pdf.text(PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 70, f"Nro. OT-{work_order.id:04d}", size=10, bold=True, color=accent, align="right")
    pdf.text(PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 86, f"Fecha: {_date(quotation.created_at or work_order.created_at)}", size=9, color=muted, align="right")

    y = PAGE_HEIGHT - 142
    pdf.text(MARGIN, y, "Cliente", size=11, bold=True, color=primary)
    pdf.line(MARGIN, y - 8, PAGE_WIDTH - MARGIN, y - 8, color=border)
    y -= 28
    pdf.text(MARGIN, y, _clean(client.nombre), size=12, bold=True)
    pdf.text(MARGIN, y - 16, f"RUT: {_clean(client.rut) or '-'}", size=9, color=muted)
    pdf.text(MARGIN, y - 32, f"Teléfono: {_clean(client.telefono) or '-'}", size=9, color=muted)
    pdf.text(MARGIN, y - 48, f"Email: {_clean(client.email) or '-'}", size=9, color=muted)
    pdf.text(MARGIN, y - 64, f"Dirección: {_clean(client.direccion) or '-'}", size=9, color=muted)

    x2 = 335
    pdf.text(x2, y, "Orden de trabajo", size=12, bold=True)
    pdf.text(x2, y - 18, f"Trabajo: {_clean(work_order.title)}", size=9, color=muted)
    pdf.text(x2, y - 34, f"Equipo: {_clean(work_order.equipment_info) or '-'}", size=9, color=muted)
    pdf.text(x2, y - 50, f"Visita: {_clean(work_order.visit_type)} ({_money(work_order.visit_cost)})", size=9, color=muted)
    pdf.text(x2, y - 66, f"Vigencia: {quotation.validity_days} días", size=9, color=muted)

    y -= 102
    pdf.text(MARGIN, y, "Detalle de la cotizacion", size=11, bold=True, color=primary)
    y -= 20
    pdf.rect(MARGIN, y - 20, PAGE_WIDTH - (MARGIN * 2), 24, fill=primary)
    desc_x = MARGIN + 10
    qty_x = 360
    unit_x = 452
    total_x = PAGE_WIDTH - MARGIN - 10
    pdf.text(desc_x, y - 12, "Descripción", size=9, bold=True, color=(1, 1, 1))
    pdf.text(qty_x, y - 12, "Cant.", size=9, bold=True, color=(1, 1, 1), align="right")
    pdf.text(unit_x, y - 12, "P. unitario", size=9, bold=True, color=(1, 1, 1), align="right")
    pdf.text(total_x, y - 12, "Total", size=9, bold=True, color=(1, 1, 1), align="right")
    y -= 34

    for index, item in enumerate(quotation.items):
        if y < 155:
            pdf.text(PAGE_WIDTH - MARGIN, 24, f"OT-{work_order.id:04d}", size=8, color=muted, align="right")
            pdf.new_page()
            y = PAGE_HEIGHT - MARGIN
            pdf.text(MARGIN, y, f"Cotización OT-{work_order.id:04d}", size=14, bold=True, color=primary)
            y -= 34
        line_total = int(round(item.qty * item.unit_price))

        description_lines = wrap(_clean(item.description), width=38) or [""]
        row_height = max(24, len(description_lines) * 12 + 12)
        if index % 2 == 1:
            pdf.rect(MARGIN, y - row_height + 8, PAGE_WIDTH - (MARGIN * 2), row_height, fill=(0.98, 0.99, 1.0))

        line_y = y
        for description_line in description_lines:
            pdf.text(desc_x, line_y, description_line, size=9)
            line_y -= 12
        pdf.text(qty_x, y, f"{item.qty:g}", size=9, align="right")
        pdf.text(unit_x, y, _money(item.unit_price), size=9, align="right")
        pdf.text(total_x, y, _money(line_total), size=9, align="right")
        pdf.line(MARGIN, y - row_height + 7, PAGE_WIDTH - MARGIN, y - row_height + 7, color=border)
        y -= row_height

    y -= 10
    total_x = 365
    pdf.rect(total_x, y - 78, PAGE_WIDTH - MARGIN - total_x, 88, fill=(0.98, 0.99, 1.0), stroke=border)
    pdf.text(total_x + 12, y - 10, "Subtotal", size=10, color=muted)
    pdf.text(PAGE_WIDTH - MARGIN - 12, y - 10, _money(quotation.subtotal), size=10, align="right")
    pdf.text(total_x + 12, y - 30, "Descuento", size=10, color=muted)
    pdf.text(PAGE_WIDTH - MARGIN - 12, y - 30, f"- {_money(quotation.discount)}", size=10, align="right")
    pdf.line(total_x + 12, y - 44, PAGE_WIDTH - MARGIN - 12, y - 44, color=border)
    pdf.text(total_x + 12, y - 64, "TOTAL", size=13, bold=True, color=primary)
    pdf.text(PAGE_WIDTH - MARGIN - 12, y - 64, _money(quotation.total), size=13, bold=True, color=primary, align="right")

    notes_y = y - 112
    if notes_y > 70:
        if quotation.conditions:
            pdf.text(MARGIN, notes_y, "Condiciones comerciales", size=10, bold=True, color=primary)
            notes_y = pdf.wrapped_text(MARGIN, notes_y - 16, quotation.conditions, width_chars=78, size=9, color=muted)
            notes_y -= 8
        if quotation.warranty:
            pdf.text(MARGIN, notes_y, "Garantía", size=10, bold=True, color=primary)
            pdf.wrapped_text(MARGIN, notes_y - 16, quotation.warranty, width_chars=78, size=9, color=muted)

    pdf.line(MARGIN, 48, PAGE_WIDTH - MARGIN, 48, color=border)
    pdf.text(MARGIN, 30, "Documento generado por OTLabs", size=8, color=muted)
    pdf.text(PAGE_WIDTH - MARGIN, 30, f"OT-{work_order.id:04d}", size=8, color=muted, align="right")

    return pdf.finish()
