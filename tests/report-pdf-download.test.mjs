import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const script = await fs.readFile(new URL('../report_pdf.js', import.meta.url), 'utf8');
const urgentCareTemplate = await fs.readFile(new URL('../demographic_report_template.html', import.meta.url), 'utf8');
const specialtyTemplate = await fs.readFile(new URL('../specialty_demand_report_template.html', import.meta.url), 'utf8');

test('both generated report templates load the real PDF downloader', () => {
  assert.match(urgentCareTemplate, /<script src="report_pdf\.js"><\/script>/);
  assert.match(urgentCareTemplate, /html2canvas\.min\.js/);
  assert.match(urgentCareTemplate, /jspdf\.umd\.min\.js/);
  assert.match(specialtyTemplate, /html2canvas\.min\.js/);
  assert.match(specialtyTemplate, /jspdf\.umd\.min\.js/);
  assert.match(specialtyTemplate, /<script src="report_pdf\.js"><\/script>/);
});

test('PDF download renders each visible report page onto its own letter page', () => {
  assert.match(script, /querySelectorAll\(':scope > \.page'\)/);
  assert.match(script, /html2canvas\(pages\[index\]/);
  assert.match(script, /scale: 1\.25/);
  assert.match(script, /new jsPDF\(\{ unit: 'in', format: 'letter'/);
  assert.match(script, /if \(index\) pdf\.addPage\('letter', 'portrait'\)/);
  assert.match(script, /pdf\.output\('blob'\)/);
  assert.match(script, /ownerDocument\.body\.appendChild\(link\)/);
  assert.match(script, /savePdfFromTopLevel\(pdf, reportFilename\(\)\)/);
});

test('embedded reports can use PDF tools from the top-level map page', () => {
  assert.match(script, /window\.html2canvas \|\| parentWindow\?\.html2canvas/);
  assert.match(script, /window\.jspdf\?\.jsPDF \|\| parentWindow\?\.jspdf\?\.jsPDF/);
});

test('embedded report download uses parent PDF tools and starts a browser download', async () => {
  const page = { hidden: false };
  const root = { querySelectorAll: () => [page] };
  const button = { disabled: false, textContent: 'Download' };
  let linkClicked = false;
  const link = { hidden: false, dataset: {}, click() { linkClicked = true; }, remove() {} };
  class PdfStub {
    addPage() {}
    addImage() {}
    output() { return new Blob(['pdf']); }
  }
  const parentWindow = {
    html2canvas: async () => ({ width: 800, height: 1000, toDataURL: () => 'data:image/jpeg;base64,test' }),
    jspdf: { jsPDF: PdfStub },
    document: { createElement: () => link, body: { appendChild() {} } },
    URL: { createObjectURL: () => 'blob:report', revokeObjectURL() {} },
    setTimeout: callback => callback()
  };
  const document = {
    fonts: { ready: Promise.resolve() },
    getElementById: id => id === 'pdf-root' ? root : id === 'download-btn' ? button : null,
    querySelectorAll: () => []
  };
  const window = {
    parent: parentWindow,
    getComputedStyle: () => ({ display: 'block' }),
    setTimeout: callback => callback(),
    alert(message) { throw new Error(message); }
  };
  vm.runInNewContext(script, { window, document, Blob, console });
  await window.downloadPDF();
  assert.equal(linkClicked, true);
  assert.equal(button.disabled, false);
  assert.equal(button.textContent, '📥 Download PDF Report');
});

test('PDF download provides progress, restores the button and reports failures', () => {
  assert.match(script, /Preparing page \$\{index \+ 1\} of \$\{pages\.length\}/);
  assert.match(script, /button\.textContent = DEFAULT_BUTTON_LABEL/);
  assert.match(script, /The PDF could not be generated/);
});
