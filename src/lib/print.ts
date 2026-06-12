/**
 * Browser print utility — generates styled HTML documents and opens them
 * in a new window with window.print() auto-triggered.
 *
 * No external dependencies. Works across all modern browsers.
 * Use @media print CSS to control layout.
 */

export interface TenantProfile {
  name: string;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  phone?: string | null;
  email?: string | null;
  logoUrl?: string | null;
  printHeader?: string | null;
  registrationNo?: string | null;
  tagline?: string | null;
  drugLicenseNo?: string | null;
  pharmacyName?: string | null;
}

export interface PrintVitals {
  bpSystolic?: number;
  bpDiastolic?: number;
  pulseRate?: number;
  temperature?: number;
  weightKg?: number;
  heightCm?: number;
  bmi?: number;
  spo2?: number;
  rbsMgDl?: number;
  respiratoryRate?: number;
}

export interface PrintMedItem {
  medicineName: string;
  genericName?: string;
  dosage: string;
  frequency: string;
  duration: string;
  quantity?: number;
  instructions?: string;
}

export interface PrescriptionPrintData {
  tenant: TenantProfile;
  doctor: { firstName: string; lastName: string; qualification?: string; registrationNo?: string; specialty?: string };
  patient: { firstName: string; lastName: string; uhid: string; dob?: string; gender?: string; bloodGroup?: string; phone: string };
  appointment: { id?: string; tokenNumber?: number; chiefComplaint?: string; scheduledAt?: string; department?: string };
  vitals: PrintVitals;
  diagnosis?: string;
  observations?: string;
  doctorNotes?: string;
  icdCodes?: string[];
  medicines: PrintMedItem[];
  rxNotes?: string;
  followUpDate?: string;
  followUpNotes?: string;
}

export interface ReceiptPrintData {
  tenant: TenantProfile;
  receiptNo: string;
  date: string;
  patient: { firstName: string; lastName: string; uhid: string; phone: string };
  doctor: { firstName: string; lastName: string };
  department?: string;
  chiefComplaint?: string;
  amount: number;
  paymentMethod: string;
  tokenNumber: number;
  consultationFee?: number;
  cashierName?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function age(dob?: string): string {
  if (!dob) return '—';
  const yrs = Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 3600 * 1000));
  return `${yrs} yrs`;
}

function fmtDate(iso?: string): string {
  if (!iso) return new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtDateTime(iso?: string): string {
  const d = iso ? new Date(iso) : new Date();
  return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function hospitalHeader(tenant: TenantProfile): string {
  if (tenant.printHeader) {
    // Custom multiline header set by admin
    return `<div class="hosp-header">${tenant.printHeader.replace(/\n/g, '<br>')}</div>`;
  }
  const parts: string[] = [];
  if (tenant.logoUrl) parts.push(`<img src="${tenant.logoUrl}" alt="logo" style="max-height:56px;margin-bottom:4px">`);
  parts.push(`<h1 class="hosp-name">${tenant.name}</h1>`);
  if (tenant.tagline) parts.push(`<p class="hosp-sub">${tenant.tagline}</p>`);
  const addr = [tenant.address, tenant.city, tenant.state, tenant.pincode].filter(Boolean).join(', ');
  if (addr) parts.push(`<p class="hosp-sub">${addr}</p>`);
  const contacts: string[] = [];
  if (tenant.phone) contacts.push(`☎ ${tenant.phone}`);
  if (tenant.email) contacts.push(`✉ ${tenant.email}`);
  if (contacts.length) parts.push(`<p class="hosp-sub">${contacts.join('  |  ')}</p>`);
  if (tenant.registrationNo) parts.push(`<p class="hosp-sub">Reg. No: ${tenant.registrationNo}</p>`);
  return `<div class="hosp-header">${parts.join('')}</div>`;
}

const BASE_CSS = `
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Times New Roman',Times,serif;font-size:11pt;color:#000;background:#fff;padding:0}
.page{max-width:210mm;margin:0 auto;padding:12mm 14mm}
.hosp-header{text-align:center;border-bottom:2pt solid #000;padding-bottom:8px;margin-bottom:10px}
.hosp-name{font-size:17pt;font-weight:bold;letter-spacing:0.5px}
.hosp-sub{font-size:9pt;color:#333;margin-top:2px}
.section-line{border-top:1pt solid #999;margin:8px 0}
.double-line{border-top:2pt double #000;margin:8px 0}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:4px 16px}
.grid3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:4px 12px}
.label{font-size:9pt;color:#555;font-weight:normal}
.value{font-size:10pt;font-weight:bold}
.vitals-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:4px;background:#f5f5f5;border:1px solid #ccc;padding:6px;border-radius:2px}
.vital-box{text-align:center}
.vital-val{font-size:11pt;font-weight:bold}
.vital-lbl{font-size:7.5pt;color:#555}
table.rx{width:100%;border-collapse:collapse;margin-top:6px}
table.rx th{background:#000;color:#fff;font-size:9pt;padding:4px 6px;text-align:left}
table.rx td{font-size:9.5pt;padding:4px 6px;border-bottom:0.5pt solid #ddd;vertical-align:top}
table.rx tr:nth-child(even) td{background:#fafafa}
.rx-num{font-weight:bold;font-size:11pt}
.sig-row{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-top:20px}
.sig-box{text-align:center;border-top:1pt solid #000;padding-top:4px;font-size:9pt}
.footer-note{font-size:8pt;color:#666;border-top:0.5pt solid #ccc;margin-top:10px;padding-top:6px;text-align:center}
@media print{
  body{padding:0}
  .page{padding:8mm 10mm;max-width:100%}
  @page{margin:8mm;size:A4}
}`;

// ── Prescription ──────────────────────────────────────────────────────────────

export function generatePrescriptionHtml(d: PrescriptionPrintData): string {
  const vitalsHtml = (() => {
    const v = d.vitals;
    const items: { lbl: string; val: string }[] = [];
    if (v.bpSystolic && v.bpDiastolic) items.push({ lbl: 'BP', val: `${v.bpSystolic}/${v.bpDiastolic}` });
    if (v.pulseRate) items.push({ lbl: 'Pulse', val: `${v.pulseRate} /min` });
    if (v.temperature) items.push({ lbl: 'Temp', val: `${v.temperature}°C` });
    if (v.spo2) items.push({ lbl: 'SpO₂', val: `${v.spo2}%` });
    if (v.rbsMgDl) items.push({ lbl: 'RBS', val: `${v.rbsMgDl} mg/dL` });
    if (v.weightKg) items.push({ lbl: 'Wt', val: `${v.weightKg} kg` });
    if (v.heightCm) items.push({ lbl: 'Ht', val: `${v.heightCm} cm` });
    if (v.bmi) items.push({ lbl: 'BMI', val: String(v.bmi) });
    if (v.respiratoryRate) items.push({ lbl: 'RR', val: `${v.respiratoryRate} /min` });
    if (!items.length) return '';
    return `
      <p style="font-size:9pt;font-weight:bold;margin-bottom:4px">VITALS</p>
      <div class="vitals-grid" style="grid-template-columns:repeat(${Math.min(items.length, 5)},1fr)">
        ${items.map(i => `<div class="vital-box"><div class="vital-val">${i.val}</div><div class="vital-lbl">${i.lbl}</div></div>`).join('')}
      </div>`;
  })();

  const medsHtml = d.medicines.length === 0 ? '<p style="color:#999;font-size:9pt">No medicines prescribed</p>' : `
    <table class="rx">
      <thead><tr>
        <th>#</th><th>Medicine</th><th>Dosage</th><th>Frequency</th><th>Duration</th><th>Qty</th><th>Instructions</th>
      </tr></thead>
      <tbody>
        ${d.medicines.map((m, i) => `
          <tr>
            <td class="rx-num">${i + 1}</td>
            <td><strong>${m.medicineName}</strong>${m.genericName ? `<br><span style="font-size:8.5pt;color:#555">(${m.genericName})</span>` : ''}</td>
            <td>${m.dosage}</td>
            <td>${m.frequency}</td>
            <td>${m.duration}</td>
            <td>${m.quantity ?? 1}</td>
            <td style="font-size:8.5pt">${m.instructions || '—'}</td>
          </tr>`).join('')}
      </tbody>
    </table>
    ${d.rxNotes ? `<p style="font-size:9pt;margin-top:6px"><em>Note: ${d.rxNotes}</em></p>` : ''}`;

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Prescription</title>
<style>${BASE_CSS}</style>
</head>
<body>
<div class="page">

  ${hospitalHeader(d.tenant)}

  <!-- Patient + Doctor info -->
  <div class="grid2" style="margin-bottom:8px">
    <div>
      <p><span class="label">Patient: </span><span class="value">${d.patient.firstName} ${d.patient.lastName}</span></p>
      <p><span class="label">UHID: </span>${d.patient.uhid}
         &nbsp;|&nbsp; <span class="label">Age/Sex: </span>${age(d.patient.dob)} / ${d.patient.gender ?? '—'}
         ${d.patient.bloodGroup ? `&nbsp;|&nbsp; <span class="label">Blood: </span>${d.patient.bloodGroup}` : ''}
      </p>
      <p><span class="label">Phone: </span>${d.patient.phone}</p>
      ${d.appointment.chiefComplaint ? `<p><span class="label">Complaint: </span>${d.appointment.chiefComplaint}</p>` : ''}
    </div>
    <div style="text-align:right">
      <p><span class="label">Date: </span><strong>${fmtDate(d.appointment.scheduledAt)}</strong></p>
      ${d.appointment.tokenNumber ? `<p><span class="label">Token: </span>#${d.appointment.tokenNumber}</p>` : ''}
      <p><span class="label">Dr. </span><strong>${d.doctor.firstName} ${d.doctor.lastName}</strong></p>
      ${d.doctor.qualification ? `<p style="font-size:9pt">${d.doctor.qualification}</p>` : ''}
      ${d.doctor.registrationNo ? `<p style="font-size:9pt">Reg: ${d.doctor.registrationNo}</p>` : ''}
      ${d.doctor.specialty ? `<p style="font-size:9pt">${d.doctor.specialty}</p>` : ''}
      ${d.appointment.department ? `<p style="font-size:9pt">Dept: ${d.appointment.department}</p>` : ''}
    </div>
  </div>

  <div class="section-line"></div>

  ${vitalsHtml ? `<div style="margin-bottom:8px">${vitalsHtml}</div><div class="section-line"></div>` : ''}

  ${d.observations ? `<p style="margin-bottom:4px"><span class="label">Clinical Findings: </span>${d.observations}</p>` : ''}
  ${d.diagnosis ? `<p style="margin-bottom:4px"><span class="label">Diagnosis: </span><strong>${d.diagnosis}</strong>${d.icdCodes?.length ? ` <span style="font-size:8.5pt;color:#555">(${d.icdCodes.join(', ')})</span>` : ''}</p>` : ''}

  ${(d.observations || d.diagnosis) ? '<div class="section-line"></div>' : ''}

  <!-- Rx -->
  <p style="font-size:13pt;font-weight:bold;margin-bottom:4px">℞</p>
  ${medsHtml}

  ${d.doctorNotes ? `<div class="section-line"></div><p><span class="label">Doctor's Notes: </span>${d.doctorNotes}</p>` : ''}

  ${d.followUpDate ? `
    <div class="section-line"></div>
    <p><span class="label">Follow-up: </span><strong>${fmtDate(d.followUpDate)}</strong>${d.followUpNotes ? ` — ${d.followUpNotes}` : ''}</p>` : ''}

  <!-- Signature -->
  <div class="sig-row">
    <div></div>
    <div class="sig-box">
      Dr. ${d.doctor.firstName} ${d.doctor.lastName}
      ${d.doctor.qualification ? `<br>${d.doctor.qualification}` : ''}
      ${d.doctor.registrationNo ? `<br>Reg: ${d.doctor.registrationNo}` : ''}
    </div>
  </div>

  <div class="footer-note">
    This prescription is valid for 30 days from the date of issue.
    ${d.tenant.drugLicenseNo ? `&nbsp;|&nbsp; Drug License: ${d.tenant.drugLicenseNo}` : ''}
  </div>

</div>
<script>window.onload=function(){window.print()}</script>
</body></html>`;
}

// ── Payment Receipt ───────────────────────────────────────────────────────────

export function generateReceiptHtml(d: ReceiptPrintData): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Receipt</title>
<style>
${BASE_CSS}
.receipt-box{border:1.5pt solid #000;padding:10px;margin-bottom:10px}
.row{display:flex;justify-content:space-between;padding:3px 0;border-bottom:0.5pt dotted #ccc;font-size:10pt}
.row:last-child{border-bottom:none}
.total-row{display:flex;justify-content:space-between;padding:6px 0;font-size:12pt;font-weight:bold;border-top:2pt solid #000;margin-top:4px}
.badge{display:inline-block;background:#000;color:#fff;padding:2px 8px;font-size:9pt;border-radius:2px}
</style>
</head>
<body>
<div class="page">

  ${hospitalHeader(d.tenant)}

  <div style="text-align:center;margin:8px 0">
    <span style="font-size:13pt;font-weight:bold;letter-spacing:1px">PAYMENT RECEIPT</span>
  </div>

  <div class="grid2" style="margin-bottom:8px;font-size:10pt">
    <div>
      <p><span class="label">Receipt No: </span><strong>${d.receiptNo}</strong></p>
      <p><span class="label">Date: </span>${fmtDateTime(d.date)}</p>
      <p><span class="label">Token: </span>#${d.tokenNumber}</p>
    </div>
    <div style="text-align:right">
      <p><span class="label">Patient: </span><strong>${d.patient.firstName} ${d.patient.lastName}</strong></p>
      <p><span class="label">UHID: </span>${d.patient.uhid}</p>
      <p><span class="label">Phone: </span>${d.patient.phone}</p>
    </div>
  </div>

  <div class="section-line"></div>

  <div class="receipt-box">
    <div class="row"><span>Consulting Doctor</span><span>Dr. ${d.doctor.firstName} ${d.doctor.lastName}</span></div>
    ${d.department ? `<div class="row"><span>Department</span><span>${d.department}</span></div>` : ''}
    ${d.chiefComplaint ? `<div class="row"><span>Complaint</span><span>${d.chiefComplaint}</span></div>` : ''}
    <div class="row"><span>Consultation Fee</span><span>₹${(d.consultationFee ?? d.amount).toLocaleString('en-IN')}</span></div>
    <div class="total-row"><span>Total Paid</span><span>₹${d.amount.toLocaleString('en-IN')}</span></div>
  </div>

  <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">
    <span style="font-size:10pt">Payment Method:</span>
    <span class="badge">${d.paymentMethod}</span>
  </div>

  <div class="sig-row" style="margin-top:30px">
    <div class="sig-box">Patient / Attendant Signature</div>
    <div class="sig-box">Authorised Signatory<br><span style="font-size:8pt">${d.tenant.name}</span></div>
  </div>

  <div class="footer-note">
    Thank you for choosing ${d.tenant.name}. This is a computer-generated receipt.
    ${d.tenant.registrationNo ? `&nbsp;|&nbsp; Reg: ${d.tenant.registrationNo}` : ''}
  </div>

</div>
<script>window.onload=function(){window.print()}</script>
</body></html>`;
}

// ── Full Patient History Report ───────────────────────────────────────────────

export interface PatientReportData {
  tenant: TenantProfile;
  patient: { firstName: string; lastName: string; uhid: string; dob?: string; gender?: string; bloodGroup?: string; phone?: string };
  consultations: Array<{
    id: string;
    date: string;
    doctor: { firstName: string; lastName: string };
    visitType: string;
    chiefComplaint?: string;
    diagnosis?: string;
    observations?: string;
    vitals?: PrintVitals;
    medicines: PrintMedItem[];
    labOrders?: Array<{ orderNumber: string; status: string; items: Array<{ name: string; result?: string; unit?: string; flag?: string }> }>;
  }>;
  invoices: Array<{ invoiceNumber: string; date: string; amount: number; paymentStatus: string; paymentMethod?: string | null }>;
  generatedAt?: string;
}

export function generatePatientReportHtml(d: PatientReportData): string {
  const invoiceRows = d.invoices.map(inv => `
    <tr>
      <td>${inv.invoiceNumber}</td>
      <td>${fmtDate(inv.date)}</td>
      <td style="text-align:right">₹${inv.amount.toLocaleString('en-IN')}</td>
      <td>${inv.paymentMethod ?? '—'}</td>
      <td><span style="font-size:8pt;padding:1px 6px;border-radius:2px;background:${inv.paymentStatus === 'PAID' ? '#d1fae5' : '#fef3c7'};color:${inv.paymentStatus === 'PAID' ? '#065f46' : '#92400e'}">${inv.paymentStatus}</span></td>
    </tr>`).join('');

  const consultSections = d.consultations.map((c, idx) => {
    const meds = c.medicines.length ? `
      <table style="width:100%;border-collapse:collapse;font-size:9pt;margin-top:4px">
        <thead><tr style="background:#f3f4f6"><th style="text-align:left;padding:2px 4px">Medicine</th><th style="padding:2px 4px">Dosage</th><th style="padding:2px 4px">Frequency</th><th style="padding:2px 4px">Duration</th></tr></thead>
        <tbody>${c.medicines.map(m => `<tr><td style="padding:2px 4px">${m.medicineName}</td><td style="padding:2px 4px;text-align:center">${m.dosage}</td><td style="padding:2px 4px;text-align:center">${m.frequency}</td><td style="padding:2px 4px;text-align:center">${m.duration}</td></tr>`).join('')}</tbody>
      </table>` : '<p style="color:#9ca3af;font-size:8.5pt">No medicines prescribed</p>';

    const vitItems: string[] = [];
    const v = c.vitals ?? {};
    if (v.bpSystolic && v.bpDiastolic) vitItems.push(`BP ${v.bpSystolic}/${v.bpDiastolic}`);
    if (v.pulseRate) vitItems.push(`Pulse ${v.pulseRate}`);
    if (v.temperature) vitItems.push(`Temp ${v.temperature}°C`);
    if (v.spo2) vitItems.push(`SpO₂ ${v.spo2}%`);
    if (v.weightKg) vitItems.push(`Wt ${v.weightKg}kg`);

    return `
      <div style="margin-bottom:16px;border:0.5pt solid #d1d5db;border-radius:4px;overflow:hidden;page-break-inside:avoid">
        <div style="background:#f9fafb;padding:6px 10px;border-bottom:0.5pt solid #e5e7eb;display:flex;justify-content:space-between;align-items:center">
          <span style="font-weight:bold;font-size:10pt">${fmtDate(c.date)}</span>
          <span style="font-size:9pt;color:#6b7280">Dr. ${c.doctor.firstName} ${c.doctor.lastName} · ${c.visitType}</span>
        </div>
        <div style="padding:8px 10px">
          ${c.chiefComplaint ? `<p style="font-size:9pt;margin-bottom:3px"><span style="color:#6b7280">Complaint:</span> ${c.chiefComplaint}</p>` : ''}
          ${vitItems.length ? `<p style="font-size:9pt;margin-bottom:3px"><span style="color:#6b7280">Vitals:</span> ${vitItems.join(' | ')}</p>` : ''}
          ${c.observations ? `<p style="font-size:9pt;margin-bottom:3px"><span style="color:#6b7280">Findings:</span> ${c.observations}</p>` : ''}
          ${c.diagnosis ? `<p style="font-size:9.5pt;font-weight:bold;margin-bottom:4px">Dx: ${c.diagnosis}</p>` : ''}
          ${meds}
        </div>
      </div>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Patient Report — ${d.patient.firstName} ${d.patient.lastName}</title>
<style>${BASE_CSS}
table.billing{width:100%;border-collapse:collapse;font-size:9.5pt}
table.billing th{background:#111;color:#fff;padding:4px 8px;text-align:left;font-size:9pt}
table.billing td{padding:4px 8px;border-bottom:0.5pt solid #e5e7eb}
</style>
</head>
<body>
<div class="page">
  ${hospitalHeader(d.tenant)}
  <div style="text-align:center;margin:6px 0 10px">
    <span style="font-size:13pt;font-weight:bold;letter-spacing:1px">PATIENT MEDICAL RECORD</span>
  </div>
  <div class="grid2" style="margin-bottom:8px;font-size:10pt">
    <div>
      <p><span class="label">Patient: </span><strong>${d.patient.firstName} ${d.patient.lastName}</strong></p>
      <p><span class="label">UHID: </span><span style="font-family:monospace">${d.patient.uhid}</span></p>
      ${d.patient.phone ? `<p><span class="label">Phone: </span>${d.patient.phone}</p>` : ''}
    </div>
    <div style="text-align:right">
      <p><span class="label">Age/Sex: </span>${age(d.patient.dob)} / ${d.patient.gender ?? '—'}</p>
      ${d.patient.bloodGroup ? `<p><span class="label">Blood Group: </span>${d.patient.bloodGroup}</p>` : ''}
      <p><span class="label">Report Date: </span>${fmtDate(d.generatedAt)}</p>
    </div>
  </div>
  <div class="double-line"></div>

  ${d.consultations.length ? `
  <p style="font-size:11pt;font-weight:bold;margin:8px 0 6px">CONSULTATION HISTORY (${d.consultations.length})</p>
  ${consultSections}` : ''}

  ${d.invoices.length ? `
  <div class="double-line" style="margin-top:12px"></div>
  <p style="font-size:11pt;font-weight:bold;margin:8px 0 6px">BILLING SUMMARY</p>
  <table class="billing">
    <thead><tr><th>Invoice #</th><th>Date</th><th style="text-align:right">Amount</th><th>Method</th><th>Status</th></tr></thead>
    <tbody>${invoiceRows}</tbody>
    <tfoot>
      <tr style="font-weight:bold;background:#f9fafb">
        <td colspan="2" style="padding:4px 8px">Total Paid</td>
        <td style="padding:4px 8px;text-align:right">₹${d.invoices.filter(i => i.paymentStatus === 'PAID').reduce((s, i) => s + i.amount, 0).toLocaleString('en-IN')}</td>
        <td colspan="2"></td>
      </tr>
    </tfoot>
  </table>` : ''}

  <div class="footer-note" style="margin-top:16px">
    This is a computer-generated summary of medical records. ${d.tenant.registrationNo ? `Reg: ${d.tenant.registrationNo}` : ''}
  </div>
</div>
<script>window.onload=function(){window.print()}</script>
</body></html>`;
}

// ── Open in new window and print ─────────────────────────────────────────────

export function printDocument(html: string) {
  const win = window.open('', '_blank');
  if (!win) {
    alert('Pop-ups are blocked. Please allow pop-ups for this site and try again.');
    return;
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
}
