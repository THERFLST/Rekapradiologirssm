(() => {
  'use strict';

  const DATA_KEY = 'rekap-radiologi-public-demo-v2';
  const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  const numeric = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };
  const format = (value) => value.toLocaleString('id-ID');
  const datePattern = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

  function collectMonthlyTotals() {
    const monthly = new Map();
    let visits = 0;
    let exams = 0;
    let exposures = 0;

    try {
      const records = JSON.parse(localStorage.getItem(DATA_KEY) || '{}');
      if (!records || typeof records !== 'object' || Array.isArray(records)) {
        return { monthly: [], visits: 0, exams: 0, exposures: 0 };
      }

      Object.entries(records).forEach(([date, record]) => {
        if (!datePattern.test(date) || !record || typeof record !== 'object') return;

        const monthKey = date.slice(0, 7);
        const month = monthly.get(monthKey) || { visits: 0, exams: 0, exposures: 0, days: 0 };
        let hasData = false;

        Object.values(record.source || {}).forEach((value) => {
          const count = numeric(value);
          month.visits += count;
          if (count !== 0) hasData = true;
        });
        Object.values(record.exams || {}).forEach((exam) => {
          if (!exam || typeof exam !== 'object') return;
          const patients = numeric(exam.patients);
          const exposuresForExam = numeric(exam.exposures);
          month.exams += patients;
          month.exposures += exposuresForExam;
          if (patients !== 0 || exposuresForExam !== 0) hasData = true;
        });
        Object.values(record.payer || {}).forEach((value) => {
          if (numeric(value) !== 0) hasData = true;
        });
        if (hasData) month.days += 1;

        monthly.set(monthKey, month);
        visits += Object.values(record.source || {}).reduce((sum, value) => sum + numeric(value), 0);
        exams += Object.values(record.exams || {}).reduce((sum, exam) => sum + numeric(exam && exam.patients), 0);
        exposures += Object.values(record.exams || {}).reduce((sum, exam) => sum + numeric(exam && exam.exposures), 0);
      });
    } catch (error) {
      console.error('Gagal membaca data rekap dari browser.', error);
    }

    const rows = [...monthly.entries()]
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([key, totals]) => {
        const [year, month] = key.split('-').map(Number);
        return { key, label: `${MONTHS[month - 1]} ${year}`, ...totals };
      });

    return { monthly: rows, visits, exams, exposures };
  }

  function renderTotal() {
    const output = document.getElementById('totalOut');
    if (!output) return;

    const result = collectMonthlyTotals();
    const monthlyRows = result.monthly.length
      ? result.monthly.map((row) => `
          <tr>
            <th scope="row">${row.label}</th>
            <td>${format(row.visits)}</td>
            <td>${format(row.exams)}</td>
            <td>${format(row.exposures)}</td>
            <td>${format(row.days)}</td>
          </tr>`).join('')
      : '<tr><td class="total-empty" colspan="5">Belum ada data rekap yang tersimpan.</td></tr>';

    output.innerHTML = `
      <section class="total-cards" aria-label="Akumulasi seluruh periode">
        <article><span>Total kunjungan</span><strong>${format(result.visits)}</strong></article>
        <article><span>Total pemeriksaan</span><strong>${format(result.exams)}</strong></article>
        <article><span>Total ekspose</span><strong>${format(result.exposures)}</strong></article>
      </section>
      <section class="panel total-monthly">
        <div class="section-title"><div><h3>Rekap per bulan</h3><p class="muted">Menampilkan seluruh bulan yang memiliki data, dari terbaru.</p></div></div>
        <div class="scroll"><table>
          <thead><tr><th scope="col">Bulan</th><th scope="col">Kunjungan</th><th scope="col">Pemeriksaan</th><th scope="col">Ekspose</th><th scope="col">Hari terisi</th></tr></thead>
          <tbody>${monthlyRows}</tbody>
          <tfoot><tr><th scope="row">Total keseluruhan</th><td>${format(result.visits)}</td><td>${format(result.exams)}</td><td>${format(result.exposures)}</td><td>—</td></tr></tfoot>
        </table></div>
      </section>`;
  }

  function showTotal() {
    document.querySelectorAll('.view').forEach((view) => {
      view.classList.toggle('on', view.id === 'v-total');
    });
    document.querySelectorAll('.nav button').forEach((button) => {
      const active = button.dataset.view === 'total';
      button.classList.toggle('on', active);
      if (active) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    });
    renderTotal();
    history.replaceState(null, '', '#total');
    window.scrollTo({ top: 0 });
  }

  // Use capture so the legacy app navigation does not reject the Total view.
  document.addEventListener('click', (event) => {
    const target = event.target;
    const button = target instanceof Element ? target.closest('.nav button[data-view="total"]') : null;
    if (!button) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    showTotal();
  }, true);

  if (location.hash === '#total') showTotal();
  window.addEventListener('storage', (event) => {
    if (event.key === DATA_KEY && location.hash === '#total') renderTotal();
  });
})();
