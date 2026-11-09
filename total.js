(() => {
  'use strict';

  const DATA_KEY = 'rekap-radiologi-public-demo-v2';
  const viewNames = ['isi', 'rekap', 'total', 'export'];
  const number = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };
  const format = (value) => value.toLocaleString('id-ID');

  function totals() {
    let visits = 0;
    let exams = 0;
    let exposure = 0;

    try {
      const records = JSON.parse(localStorage.getItem(DATA_KEY) || '{}') || {};
      Object.values(records).forEach((record) => {
        visits += Object.values(record.source || {}).reduce((sum, value) => sum + number(value), 0);
        Object.values(record.exams || {}).forEach((exam) => {
          exams += number(exam && exam.patients);
          exposure += number(exam && exam.exposures);
        });
      });
    } catch (error) {
      console.error('Tidak dapat membaca rekap tersimpan.', error);
    }

    return { visits, exams, exposure };
  }

  function renderTotal() {
    const output = document.getElementById('totalOut');
    if (!output) return;

    const summary = totals();
    output.innerHTML = `
      <article><span>Total kunjungan</span><strong>${format(summary.visits)}</strong></article>
      <article><span>Total pemeriksaan</span><strong>${format(summary.exams)}</strong></article>
      <article><span>Total ekspose</span><strong>${format(summary.exposure)}</strong></article>`;
  }

  function showTotal() {
    document.querySelectorAll('.view').forEach((view) => {
      view.classList.toggle('on', view.id === 'v-total');
    });
    document.querySelectorAll('.nav button').forEach((button) => {
      button.classList.toggle('on', button.dataset.view === 'total');
      button.setAttribute('aria-current', button.dataset.view === 'total' ? 'page' : 'false');
    });
    renderTotal();
    history.replaceState(null, '', '#total');
    window.scrollTo({ top: 0 });
  }

  // Intercept the new menu before the older app.js navigation handler.
  document.addEventListener('click', (event) => {
    const button = event.target.closest('.nav button[data-view="total"]');
    if (!button) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    showTotal();
  }, true);

  if (location.hash === '#total') showTotal();
})();
