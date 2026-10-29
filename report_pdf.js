(function initializeReportPdfDownload() {
  const DEFAULT_BUTTON_LABEL = '📥 Download PDF Report';

  function visibleReportPages(sourceDocument) {
    const root = sourceDocument.getElementById('pdf-root');
    if (!root) return [];
    const sourceWindow = sourceDocument.defaultView || window;
    return Array.from(root.querySelectorAll(':scope > .page')).filter(page =>
      !page.hidden && sourceWindow.getComputedStyle(page).display !== 'none'
    );
  }

  function reportFilename(sourceDocument) {
    const date = new Date().toISOString().slice(0, 10);
    return sourceDocument.getElementById('meps-specialty-table')
      ? `curis-specialty-demand-report-${date}.pdf`
      : `curis-urgent-care-site-assessment-${date}.pdf`;
  }

  function resolvePdfTools(ownerWindow) {
    let parentWindow;
    try {
      parentWindow = ownerWindow.parent && ownerWindow.parent !== ownerWindow ? ownerWindow.parent : undefined;
    } catch (error) {
      parentWindow = undefined;
    }

    return {
      html2canvas: ownerWindow.html2canvas || parentWindow?.html2canvas,
      jsPDF: ownerWindow.jspdf?.jsPDF || parentWindow?.jspdf?.jsPDF
    };
  }

  async function waitForReportAssets(sourceDocument) {
    if (sourceDocument.fonts?.ready) await sourceDocument.fonts.ready;
    await Promise.all(Array.from(sourceDocument.querySelectorAll('#pdf-root img')).map(image => {
      if (image.complete && image.naturalWidth) return Promise.resolve();
      if (typeof image.decode === 'function') return image.decode().catch(() => {});
      return new Promise(resolve => {
        image.addEventListener('load', resolve, { once: true });
        image.addEventListener('error', resolve, { once: true });
      });
    }));
  }

  function savePdfFromTopLevel(pdf, filename, ownerWindow) {
    const blob = pdf.output('blob');
    const ownerDocument = ownerWindow.document;
    const url = ownerWindow.URL.createObjectURL(blob);
    const link = ownerDocument.createElement('a');
    link.href = url;
    link.download = filename;
    link.hidden = true;
    link.dataset.reportPdfDownload = 'true';
    ownerDocument.body.appendChild(link);
    link.click();
    ownerWindow.setTimeout(() => {
      link.remove();
      ownerWindow.URL.revokeObjectURL(url);
    }, 60000);
  }

  async function downloadPDF(sourceDocument = document, ownerWindow = window) {
    const button = sourceDocument.getElementById('download-btn');
    if (button?.disabled) return;
    const pages = visibleReportPages(sourceDocument);
    if (!pages.length) {
      ownerWindow.alert('The report does not contain any pages to download.');
      return;
    }

    const { html2canvas, jsPDF } = resolvePdfTools(ownerWindow);
    if (typeof html2canvas !== 'function' || typeof jsPDF !== 'function') {
      ownerWindow.alert('The PDF tools did not load. Refresh the page and try again.');
      return;
    }

    if (button) {
      button.disabled = true;
      button.textContent = 'Preparing PDF…';
    }

    try {
      await waitForReportAssets(sourceDocument);
      const pdf = new jsPDF({ unit: 'in', format: 'letter', orientation: 'portrait', compress: true });
      const availableWidth = 7.5;
      const availableHeight = 10;

      for (let index = 0; index < pages.length; index += 1) {
        if (index) pdf.addPage('letter', 'portrait');
        if (button) button.textContent = `Preparing page ${index + 1} of ${pages.length}…`;
        await new Promise(resolve => ownerWindow.setTimeout(resolve, 0));

        const canvas = await html2canvas(pages[index], {
          scale: 1.25,
          useCORS: true,
          allowTaint: false,
          backgroundColor: '#ffffff',
          logging: false,
          scrollX: 0,
          scrollY: 0,
          windowWidth: 816
        });

        let drawWidth = availableWidth;
        let drawHeight = drawWidth * canvas.height / canvas.width;
        if (drawHeight > availableHeight) {
          drawHeight = availableHeight;
          drawWidth = drawHeight * canvas.width / canvas.height;
        }
        const x = (8.5 - drawWidth) / 2;
        const y = (11 - drawHeight) / 2;
        pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', x, y, drawWidth, drawHeight, undefined, 'FAST');
      }

      savePdfFromTopLevel(pdf, reportFilename(sourceDocument), ownerWindow);
    } catch (error) {
      console.error('Unable to generate report PDF:', error);
      ownerWindow.alert('The PDF could not be generated. Refresh the report and try again.');
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = DEFAULT_BUTTON_LABEL;
      }
    }
  }

  function installReportPdfDownload(sourceDocument, ownerWindow = window) {
    const button = sourceDocument?.getElementById('download-btn');
    if (!button) return false;

    if (button.__curisPdfHandler) {
      button.removeEventListener('click', button.__curisPdfHandler);
    }
    button.removeAttribute('onclick');
    button.disabled = false;
    button.textContent = DEFAULT_BUTTON_LABEL;
    button.__curisPdfHandler = () => downloadPDF(sourceDocument, ownerWindow);
    button.addEventListener('click', button.__curisPdfHandler);
    return true;
  }

  window.downloadPDF = () => downloadPDF(document, window);
  window.installReportPdfDownload = installReportPdfDownload;
  if (document.getElementById('pdf-root')) installReportPdfDownload(document, window);
})();
