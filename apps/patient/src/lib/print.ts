export function printDocument(html: string) {
  const win = window.open('', '_blank');
  if (!win) {
    alert('Pop-ups are blocked. Please allow pop-ups for this site to print.');
    return;
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
}

function fmtDate(iso?: string | null): string {
  const d = iso ? new Date(iso) : new Date();
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtDateTime(iso?: string | null): string {
  const d = iso ? new Date(iso) : new Date();
  return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const BASE_CSS = `
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Times New Roman',Times,serif;font-size:11pt;color:#000;background:#fff}
.page{max-width:210mm;margin:0 auto;padding:12mm 14mm}
.header{text-align:center;border-bottom:2pt solid #000;padding-bottom:8px;margin-bottom:10px}
.hosp-name{font-size:17pt;font-weight:bold}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:4px 16px}
.label{font-size:9pt;color:#555}
.section-line{border-top:1pt solid #999;margin:8px 0}
.footer{font-size:8pt;color:#666;border-top:0.5pt solid #ccc;margin-top:12px;padding-top:6px;text-align:center}
@media print{body{padding:0}.page{padding:8mm 10mm;max-width:100%}@page{margin:8mm;size:A4}}`;

export interface LabReportData {
  hospitalName?: string;
  orderNumber: string;
  patient: { firstName: string; lastName?: string | null; uhid: string; phone: string };
  doctor?: { firstName: string; lastName: string } | null;
  priority?: string;
  collectedAt?: string | null;
  completedAt?: string | null;
  clinicalNotes?: string | null;
  items: Array<{
    name: string;
    result: string | null;
    unit: string | null;
    normalRange: string | null;
    flag: string | null;
    category?: string;
  }>;
}

export function generateLabReportHtml(d: LabReportData): string {
  const completedItems = d.items.filter(i => i.result);
  const hasCritical = completedItems.some(i => i.flag === 'CRITICAL');
  const flagColor = (f?: string | null) => f === 'CRITICAL' ? '#dc2626' : f === 'ABNORMAL' ? '#d97706' : '#16a34a';
  const flagBg = (f?: string | null) => f === 'CRITICAL' ? '#fef2f2' : f === 'ABNORMAL' ? '#fffbeb' : '#f0fdf4';

  const rows = completedItems.map(item => `
    <tr style="background:${item.flag === 'CRITICAL' ? '#fef2f2' : item.flag === 'ABNORMAL' ? '#fffbeb' : '#fff'}">
      <td style="padding:7px 10px;border-bottom:0.5pt solid #e5e7eb">
        <p style="font-weight:bold;font-size:10pt;margin:0">${item.name}</p>
        ${item.category ? `<p style="font-size:8pt;color:#666;margin:0">${item.category}</p>` : ''}
      </td>
      <td style="padding:7px 10px;border-bottom:0.5pt solid #e5e7eb;text-align:center;font-size:11pt;font-weight:bold;color:${flagColor(item.flag)}">
        ${item.result} ${item.unit ?? ''}
      </td>
      <td style="padding:7px 10px;border-bottom:0.5pt solid #e5e7eb;text-align:center;font-size:9pt;color:#555">
        ${item.normalRange ?? '—'}
      </td>
      <td style="padding:7px 10px;border-bottom:0.5pt solid #e5e7eb;text-align:center">
        ${item.flag ? `<span style="display:inline-block;padding:2px 8px;border-radius:10px;font-size:8.5pt;font-weight:bold;background:${flagBg(item.flag)};color:${flagColor(item.flag)}">${item.flag}</span>` : '<span style="color:#9ca3af;font-size:8.5pt">NORMAL</span>'}
      </td>
    </tr>`).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Lab Report — ${d.orderNumber}</title>
<style>${BASE_CSS}</style>
</head>
<body>
<div class="page">

  <div class="header">
    <h1 class="hosp-name">${d.hospitalName ?? 'Healthcare Centre'}</h1>
  </div>

  <div style="text-align:center;margin:8px 0">
    <span style="font-size:13pt;font-weight:bold;letter-spacing:1px">LABORATORY REPORT</span>
    ${hasCritical ? `<br><span style="color:#dc2626;font-size:9pt;font-weight:bold">⚠ Contains Critical Values — Contact Your Doctor Immediately</span>` : ''}
  </div>

  <div class="grid2" style="margin-bottom:8px;font-size:10pt">
    <div>
      <p><span class="label">Patient: </span><strong>${d.patient.firstName} ${d.patient.lastName ?? ''}</strong></p>
      <p><span class="label">UHID: </span><span style="font-family:monospace">${d.patient.uhid}</span></p>
      <p><span class="label">Phone: </span>${d.patient.phone}</p>
    </div>
    <div style="text-align:right">
      <p><span class="label">Order #: </span><strong style="font-family:monospace">${d.orderNumber}</strong></p>
      ${d.priority ? `<p><span class="label">Priority: </span>${d.priority}</p>` : ''}
      ${d.doctor ? `<p><span class="label">Ordered by: </span>Dr. ${d.doctor.firstName} ${d.doctor.lastName}</p>` : ''}
      <p><span class="label">Report Date: </span>${fmtDate(d.completedAt)}</p>
    </div>
  </div>

  ${(d.collectedAt || d.completedAt) ? `
  <div style="background:#f8fafc;border:0.5pt solid #e2e8f0;padding:5px 10px;margin-bottom:8px;font-size:9pt;display:flex;gap:16px;flex-wrap:wrap">
    ${d.collectedAt ? `<span><span class="label">Sample Collected: </span>${fmtDateTime(d.collectedAt)}</span>` : ''}
    ${d.completedAt ? `<span><span class="label">Reported: </span>${fmtDateTime(d.completedAt)}</span>` : ''}
  </div>` : ''}

  ${d.clinicalNotes ? `<p style="font-size:9pt;margin-bottom:8px;background:#eff6ff;border:0.5pt solid #bfdbfe;padding:5px 8px"><span class="label">Clinical Notes: </span>${d.clinicalNotes}</p>` : ''}

  <div class="section-line"></div>

  <table style="width:100%;border-collapse:collapse">
    <thead>
      <tr style="background:#1a1a1a;color:#fff">
        <th style="padding:6px 10px;text-align:left;font-size:9pt">Test</th>
        <th style="padding:6px 10px;text-align:center;font-size:9pt">Result</th>
        <th style="padding:6px 10px;text-align:center;font-size:9pt">Reference Range</th>
        <th style="padding:6px 10px;text-align:center;font-size:9pt">Status</th>
      </tr>
    </thead>
    <tbody>
      ${rows || '<tr><td colspan="4" style="text-align:center;color:#9ca3af;padding:16px">No results available</td></tr>'}
    </tbody>
  </table>

  ${hasCritical ? `
  <div style="margin-top:12px;border:1.5pt solid #dc2626;border-radius:4px;padding:8px 12px;background:#fef2f2">
    <p style="color:#dc2626;font-weight:bold;font-size:10pt">⚠ Critical Value Alert</p>
    <p style="color:#991b1b;font-size:9pt;margin-top:3px">One or more test results are critically abnormal. Please contact your doctor immediately.</p>
  </div>` : ''}

  <div class="footer">This is a computer-generated laboratory report for personal reference only. Consult your physician for medical advice.</div>
</div>
<script>window.onload=function(){window.print()}</script>
</body></html>`;
}
