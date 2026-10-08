import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import test from 'node:test';

const html = await fs.readFile(new URL('../demographic_report_template.html', import.meta.url), 'utf8');
const start = html.indexOf('function prepareReportPrintLayout()');
const source = html.slice(start, html.indexOf('</script>', start));

test('printing fits each complete preview section onto one sheet without changing its width', () => {
  const sheets = [];
  const pages = [800, 1200, 1600].map(height => ({
    scrollHeight: height,
    getBoundingClientRect: () => ({ width: 720, height }),
    before(sheet) { sheets.push(sheet); }
  }));
  const handlers = {};
  const context = vm.createContext({
    window: { addEventListener(name, callback) { handlers[name] = callback; } },
    document: {
      querySelector: () => sheets[0],
      querySelectorAll: selector => selector === '#pdf-root > .page' ? pages : [...sheets],
      createElement: () => ({
        style: { setProperty(name, value) { this[name] = value; } },
        childNodes: [], appendChild(page) { this.childNodes.push(page); },
        replaceWith(...nodes) { assert.equal(nodes.length, 1); sheets.splice(sheets.indexOf(this), 1); }
      })
    }
  });
  vm.runInContext(source, context);
  handlers.beforeprint();
  assert.equal(sheets.length, pages.length);
  sheets.forEach((sheet, index) => {
    const scale = Number(sheet.style['--report-print-scale']);
    assert.ok(scale > 0 && scale <= 1);
    assert.ok(pages[index].scrollHeight * scale <= 959.00001);
    assert.equal(sheet.childNodes[0], pages[index]);
  });
  assert.equal(Number(sheets[0].style['--report-print-scale']), 1);
  handlers.beforeprint();
  assert.equal(sheets.length, pages.length, 'repeated print events do not nest wrappers');
  handlers.afterprint();
  assert.equal(sheets.length, 0, 'preview is restored after printing or cancellation');
  handlers.beforeprint();
  assert.equal(sheets.length, pages.length, 'printing works again after restoration');
});
