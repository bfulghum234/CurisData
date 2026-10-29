import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import test from 'node:test';

const script = await fs.readFile(new URL('../report_pdf.js', import.meta.url), 'utf8');
const urgentCareTemplate = await fs.readFile(new URL('../demographic_report_template.html', import.meta.url), 'utf8');
const specialtyTemplate = await fs.readFile(new URL('../specialty_demand_report_template.html', import.meta.url), 'utf8');

test('both generated report templates load the real PDF downloader', () => {
  assert.match(urgentCareTemplate, /<script src="report_pdf\.js"><\/script>/);
  assert.match(specialtyTemplate, /html2pdf\.bundle\.min\.js/);
  assert.match(specialtyTemplate, /<script src="report_pdf\.js"><\/script>/);
});

test('PDF download renders each visible report page onto its own letter page', () => {
  assert.match(script, /querySelectorAll\(':scope > \.page'\)/);
  assert.match(script, /window\.html2canvas\(pages\[index\]/);
  assert.match(script, /scale: 1\.25/);
  assert.match(script, /new jsPDF\(\{ unit: 'in', format: 'letter'/);
  assert.match(script, /if \(index\) pdf\.addPage\('letter', 'portrait'\)/);
  assert.match(script, /pdf\.output\('blob'\)/);
  assert.match(script, /ownerDocument\.body\.appendChild\(link\)/);
  assert.match(script, /savePdfFromTopLevel\(pdf, reportFilename\(\)\)/);
});

test('PDF download provides progress, restores the button and reports failures', () => {
  assert.match(script, /Preparing page \$\{index \+ 1\} of \$\{pages\.length\}/);
  assert.match(script, /button\.textContent = DEFAULT_BUTTON_LABEL/);
  assert.match(script, /The PDF could not be generated/);
});
