import tempfile
from pathlib import Path
from datetime import datetime, timezone


def generate_quotation_pdf(work_order, company) -> str:
    from weasyprint import HTML

    ot = work_order
    q = ot.quotation
    client = ot.client

    logo_html = ""
    if company.logo_path and Path(company.logo_path).exists():
        logo_html = f'<img src="file://{Path(company.logo_path).resolve()}" class="logo" alt="Logo">'

    items_html = "".join(
        f"""<tr>
              <td>{i["description"]}</td>
              <td class="center">{i["qty"]}</td>
              <td class="right">${i["unit_price"]:,.0f}</td>
              <td class="right">${i["qty"] * i["unit_price"]:,.0f}</td>
            </tr>"""
        for i in q.items
    )

    visit_row = ""
    if ot.visit_type != "free" and ot.visit_cost > 0:
        label = "Cobro visita técnica"
        if ot.visit_type == "charged_deductible":
            label += " (descontable)"
        visit_row = f'<tr class="visit-row"><td colspan="3">{label}</td><td class="right">${ot.visit_cost:,.0f}</td></tr>'

    issued = datetime.now(timezone.utc).strftime("%d/%m/%Y")

    html_content = f"""<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
  * {{ margin: 0; padding: 0; box-sizing: border-box; }}
  body {{ font-family: Inter, Arial, sans-serif; color: #0F172A; font-size: 13px; }}
  .page {{ padding: 40px 48px; }}
  .header {{ display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px; }}
  .logo {{ max-height: 60px; max-width: 160px; }}
  .company-name {{ font-size: 22px; font-weight: 700; color: #0284C7; }}
  .company-info {{ color: #475569; font-size: 12px; margin-top: 4px; }}
  .doc-title {{ text-align: right; }}
  .doc-title h1 {{ font-size: 24px; font-weight: 700; color: #0284C7; }}
  .doc-title .doc-num {{ color: #64748B; font-size: 12px; margin-top: 4px; }}
  .divider {{ border: none; border-top: 2px solid #E0F2FE; margin: 20px 0; }}
  .two-col {{ display: flex; gap: 32px; margin-bottom: 24px; }}
  .col {{ flex: 1; }}
  .section-label {{ font-size: 10px; font-weight: 600; text-transform: uppercase; color: #0284C7;
                    letter-spacing: 0.08em; margin-bottom: 8px; }}
  .field {{ margin-bottom: 4px; }}
  .field strong {{ font-weight: 600; }}
  table {{ width: 100%; border-collapse: collapse; margin: 16px 0; }}
  thead tr {{ background: #0284C7; color: white; }}
  thead th {{ padding: 10px 12px; text-align: left; font-weight: 600; font-size: 12px; }}
  tbody tr:nth-child(even) {{ background: #F0F9FF; }}
  tbody td {{ padding: 9px 12px; }}
  .center {{ text-align: center; }}
  .right {{ text-align: right; }}
  .visit-row td {{ color: #64748B; font-style: italic; }}
  .totals {{ width: 260px; margin-left: auto; margin-top: 8px; }}
  .totals tr td {{ padding: 5px 8px; }}
  .totals .total-row td {{ font-weight: 700; font-size: 15px; color: #0284C7;
                            border-top: 2px solid #0284C7; padding-top: 8px; }}
  .badge {{ display: inline-block; background: #F0F9FF; border: 1px solid #0284C7;
             color: #0284C7; padding: 4px 10px; border-radius: 20px; font-size: 11px;
             font-weight: 600; margin-bottom: 16px; }}
  .diagnosis-box {{ background: #F8FAFC; border-left: 3px solid #0284C7; padding: 12px 16px;
                    border-radius: 4px; margin-bottom: 20px; }}
  .notes-section {{ margin-top: 24px; }}
  .notes-box {{ background: #F8FAFC; padding: 12px 16px; border-radius: 4px; font-size: 12px; color: #475569; }}
  .footer {{ margin-top: 40px; border-top: 1px solid #E0F2FE; padding-top: 16px;
             font-size: 11px; color: #94A3B8; text-align: center; }}
</style>
</head>
<body>
<div class="page">
  <div class="header">
    <div>
      {logo_html}
      <div class="company-name">{company.name}</div>
      <div class="company-info">
        {f"RUT: {company.rut}" if company.rut else ""}
        {f" | {company.phone}" if company.phone else ""}
        {f" | {company.email}" if company.email else ""}
      </div>
    </div>
    <div class="doc-title">
      <h1>COTIZACIÓN</h1>
      <div class="doc-num">N° OT-{ot.id:04d} · {issued}</div>
    </div>
  </div>
  <hr class="divider">
  <div class="two-col">
    <div class="col">
      <div class="section-label">Datos del Cliente</div>
      <div class="field"><strong>{client.name}</strong></div>
      {f'<div class="field">RUT: {client.rut}</div>' if client.rut else ""}
      {f'<div class="field">{client.phone}</div>' if client.phone else ""}
      {f'<div class="field">{client.address}</div>' if client.address else ""}
    </div>
    <div class="col">
      <div class="section-label">Detalles OT</div>
      <div class="field"><strong>{ot.title}</strong></div>
      {f'<div class="field">Equipo: {ot.equipment_info}</div>' if ot.equipment_info else ""}
      <div class="field">Vigencia: {q.validity_days} días</div>
      <div class="field">Emitida: {issued}</div>
    </div>
  </div>

  {"<div class='section-label'>Diagnóstico</div><div class='diagnosis-box'>" + ot.diagnosis_notes + "</div>" if ot.diagnosis_notes else ""}

  <div class="section-label">Detalle de Servicios y Materiales</div>
  <table>
    <thead>
      <tr>
        <th>Descripción</th>
        <th class="center">Cant.</th>
        <th class="right">P. Unitario</th>
        <th class="right">Total</th>
      </tr>
    </thead>
    <tbody>
      {items_html}
      {visit_row}
    </tbody>
  </table>

  <table class="totals">
    <tr><td>Subtotal</td><td class="right">${q.subtotal:,.0f}</td></tr>
    {"<tr><td>Descuento</td><td class='right'>-$" + f"{q.discount:,.0f}" + "</td></tr>" if q.discount > 0 else ""}
    <tr class="total-row"><td>TOTAL</td><td class="right">${q.total:,.0f}</td></tr>
  </table>

  <div class="notes-section">
    {f'<div class="section-label">Condiciones Comerciales</div><div class="notes-box">{q.conditions}</div>' if q.conditions else ""}
    {f'<div class="section-label" style="margin-top:12px">Garantía</div><div class="notes-box">{q.warranty}</div>' if q.warranty else ""}
  </div>

  <div class="footer">
    {company.name} · Cotización válida por {q.validity_days} días · Generado por OTClima – OTLabs
  </div>
</div>
</body>
</html>"""

    tmp = tempfile.NamedTemporaryFile(suffix=".pdf", delete=False)
    HTML(string=html_content).write_pdf(tmp.name)
    return tmp.name
