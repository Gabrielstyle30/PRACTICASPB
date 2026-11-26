(() => {
  'use strict';

  const DATA = window.RAMA_DATA || [];
  const META = window.RAMA_META || {};

  const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  const ESTACIONES = ['Primavera', 'Verano', 'Otoño', 'Invierno'];

  // Shared synchronized filter state (equivalent to synced slicers in Power BI)
  const state = {
    anio: 'ALL',
    estacion: 'ALL',
    atipico: 'ALL'
  };

  let charts = {};

  // ---------- Statistical Engine (Exact tie-aware Spearman & Pearson) ----------
  function averageRanks(values) {
    const n = values.length;
    const indexed = values.map((v, i) => ({ v, i }));
    indexed.sort((a, b) => a.v - b.v);
    const ranks = new Float64Array(n);
    let i = 0;
    while (i < n) {
      let j = i;
      while (j + 1 < n && indexed[j + 1].v === indexed[i].v) {
        j++;
      }
      const avgRank = (i + j) / 2 + 1;
      for (let k = i; k <= j; k++) {
        ranks[indexed[k].i] = avgRank;
      }
      i = j + 1;
    }
    return ranks;
  }

  function pearson(x, y) {
    const n = x.length;
    if (n < 3) return null;
    let sumX = 0, sumY = 0;
    for (let i = 0; i < n; i++) {
      sumX += x[i];
      sumY += y[i];
    }
    const meanX = sumX / n;
    const meanY = sumY / n;
    let num = 0, denX = 0, denY = 0;
    for (let i = 0; i < n; i++) {
      const dx = x[i] - meanX;
      const dy = y[i] - meanY;
      num += dx * dy;
      denX += dx * dx;
      denY += dy * dy;
    }
    const den = Math.sqrt(denX * denY);
    return den === 0 ? null : num / den;
  }

  function spearman(x, y) {
    if (x.length < 3) return null;
    const rx = averageRanks(x);
    const ry = averageRanks(y);
    return pearson(rx, ry);
  }

  function mean(arr) {
    if (!arr.length) return null;
    let s = 0;
    for (let i = 0; i < arr.length; i++) s += arr[i];
    return s / arr.length;
  }

  function interpretRho(rho, n) {
    if (rho === null || n < 3) return 'Sin suficientes observaciones para calcular Spearman.';
    const sentido = rho >= 0 ? 'positiva' : 'negativa';
    const abs = Math.abs(rho);
    let fuerza = 'muy débil o nula';
    if (abs >= 0.7) fuerza = 'fuerte';
    else if (abs >= 0.4) fuerza = 'moderada';
    else if (abs >= 0.2) fuerza = 'débil';
    return `Asociación monótona ${sentido} ${fuerza} (ρ = ${rho >= 0 ? '+' : ''}${rho.toFixed(4)}, n = ${n.toLocaleString('es-MX')} días)`;
  }

  function fmtNum(val, dec = 2) {
    if (val === null || val === undefined || Number.isNaN(val)) return '—';
    return val.toLocaleString('es-MX', { minimumFractionDigits: dec, maximumFractionDigits: dec });
  }

  function fmtSigned(val, dec = 4) {
    if (val === null || val === undefined || Number.isNaN(val)) return '—';
    const sign = val >= 0 ? '+' : '';
    return sign + val.toFixed(dec);
  }

  // ---------- Filtering ----------
  function getFilteredData() {
    return DATA.filter(r => {
      if (state.anio !== 'ALL' && String(r[1]) !== state.anio) return false;
      if (state.estacion !== 'ALL' && r[3] !== state.estacion) return false;
      const isOutlier = (r[10] === 1 || r[11] === 1);
      if (state.atipico === 'NO' && isOutlier) return false;
      if (state.atipico === 'SI' && !isOutlier) return false;
      return true;
    });
  }

  // ---------- Populate Year Slicers ----------
  function initSlicers() {
    const years = Array.from(new Set(DATA.map(r => r[1]))).sort((a, b) => a - b);
    document.querySelectorAll('.slicer-anio').forEach(sel => {
      years.forEach(y => {
        const opt = document.createElement('option');
        opt.value = String(y);
        opt.textContent = y === 2023 ? '2023 (Ene–May)' : String(y);
        sel.appendChild(opt);
      });
      sel.addEventListener('change', e => {
        state.anio = e.target.value;
        syncSlicerUI();
        updateAll();
      });
    });

    document.querySelectorAll('.slicer-estacion').forEach(sel => {
      sel.addEventListener('change', e => {
        state.estacion = e.target.value;
        syncSlicerUI();
        updateAll();
      });
    });

    document.querySelectorAll('.slicer-atipico').forEach(sel => {
      sel.addEventListener('change', e => {
        state.atipico = e.target.value;
        syncSlicerUI();
        updateAll();
      });
    });

    document.querySelectorAll('.btn-reset').forEach(btn => {
      btn.addEventListener('click', () => {
        state.anio = 'ALL';
        state.estacion = 'ALL';
        state.atipico = 'ALL';
        syncSlicerUI();
        updateAll();
      });
    });
  }

  function syncSlicerUI() {
    document.querySelectorAll('.slicer-anio').forEach(s => s.value = state.anio);
    document.querySelectorAll('.slicer-estacion').forEach(s => s.value = state.estacion);
    document.querySelectorAll('.slicer-atipico').forEach(s => s.value = state.atipico);
  }

  // ---------- Page Navigation ----------
  function switchPage(pageId) {
    document.querySelectorAll('.page-section').forEach(sec => {
      sec.classList.toggle('active', sec.id === pageId);
    });
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.page === pageId);
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
    // Trigger Chart.js resize on visible tab
    Object.values(charts).forEach(ch => {
      if (ch) ch.resize();
    });
  }

  function initNavigation() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => switchPage(btn.dataset.page));
    });
    document.querySelectorAll('.quick-card').forEach(card => {
      card.addEventListener('click', () => switchPage(card.dataset.goto));
    });
  }

  // ---------- Render Global KPIs (Page 1) ----------
  function renderGlobalKPIs() {
    const o3 = DATA.map(r => r[4]);
    const pm = DATA.map(r => r[5]);
    const rho = spearman(o3, pm);
    const r = pearson(o3, pm);
    const atipPm = DATA.filter(row => row[11] === 1).length;

    document.getElementById('p1-n').textContent = DATA.length.toLocaleString('es-MX');
    document.getElementById('p1-rho').textContent = fmtSigned(rho, 4);
    document.getElementById('p1-r').textContent = fmtSigned(r, 4);
    document.getElementById('p1-atip').textContent = atipPm.toLocaleString('es-MX');
  }

  // ---------- Update Dynamic Views (Pages 2 & 3) ----------
  function updateAll() {
    const rows = getFilteredData();
    const o3Arr = rows.map(r => r[4]);
    const pmArr = rows.map(r => r[5]);
    const rho = spearman(o3Arr, pmArr);
    const r = pearson(o3Arr, pmArr);
    const diff = (rho !== null && r !== null) ? (rho - r) : null;
    const avgO3 = mean(o3Arr);
    const avgPm = mean(pmArr);
    const atipPm = rows.filter(row => row[11] === 1).length;
    const atipO3 = rows.filter(row => row[10] === 1).length;

    // Page 2 KPIs
    document.getElementById('p2-n').textContent = rows.length.toLocaleString('es-MX');
    document.getElementById('p2-o3').textContent = fmtNum(avgO3, 2) + ' ppb';
    document.getElementById('p2-pm').textContent = fmtNum(avgPm, 2) + ' µg/m³';
    document.getElementById('p2-atip-pm').textContent = atipPm.toLocaleString('es-MX');
    document.getElementById('p2-atip-o3').textContent = atipO3.toLocaleString('es-MX');

    // Page 3 KPIs
    document.getElementById('p3-rho').textContent = fmtSigned(rho, 4);
    document.getElementById('p3-r').textContent = fmtSigned(r, 4);
    document.getElementById('p3-diff').textContent = fmtSigned(diff, 4);
    document.getElementById('p3-n').textContent = rows.length.toLocaleString('es-MX');
    document.getElementById('p3-interp-text').textContent = interpretRho(rho, rows.length);

    const activeFilterLabel = [
      state.anio === 'ALL' ? '2015–2023' : `Año ${state.anio}`,
      state.estacion === 'ALL' ? 'Todas las estaciones' : state.estacion,
      state.atipico === 'ALL' ? 'Con atípicos' : (state.atipico === 'NO' ? 'Sin atípicos IQR' : 'Solo atípicos IQR')
    ].join(' · ');
    document.getElementById('p3-filter-pill').textContent = activeFilterLabel;

    updateMonthlyChart(rows);
    updateOutliersSeasonChart(rows);
    updateAnnualChart(rows);
    updateScatterChart(rows);
    updateSeasonTable(rows, rho, r, diff, avgO3, avgPm, atipPm);
  }

  // Chart 1: Monthly Periodic Cycle
  function updateMonthlyChart(rows) {
    const o3ByMonth = Array.from({ length: 12 }, () => []);
    const pmByMonth = Array.from({ length: 12 }, () => []);
    rows.forEach(r => {
      o3ByMonth[r[2] - 1].push(r[4]);
      pmByMonth[r[2] - 1].push(r[5]);
    });
    const o3Means = o3ByMonth.map(a => a.length ? Number(mean(a).toFixed(2)) : null);
    const pmMeans = pmByMonth.map(a => a.length ? Number(mean(a).toFixed(2)) : null);

    const ctx = document.getElementById('chartMonthly').getContext('2d');
    if (charts.monthly) charts.monthly.destroy();
    charts.monthly = new Chart(ctx, {
      type: 'line',
      data: {
        labels: MESES,
        datasets: [
          {
            label: 'Ozono O₃ promedio (ppb)',
            data: o3Means,
            borderColor: '#1B365D',
            backgroundColor: 'rgba(27, 54, 93, 0.12)',
            borderWidth: 2.6,
            pointRadius: 4,
            tension: 0.25,
            fill: false
          },
          {
            label: 'PM₂.₅ promedio (µg/m³)',
            data: pmMeans,
            borderColor: '#0F766E',
            backgroundColor: 'rgba(15, 118, 110, 0.12)',
            borderWidth: 2.6,
            pointRadius: 4,
            tension: 0.25,
            fill: false
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { position: 'top' },
          tooltip: {
            callbacks: {
              label: ctx => `${ctx.dataset.label}: ${ctx.parsed.y !== null ? ctx.parsed.y.toFixed(2) : '—'}`
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            title: { display: true, text: 'Concentración promedio diaria' }
          }
        }
      }
    });
  }

  // Chart 2: IQR Outliers by Season
  function updateOutliersSeasonChart(rows) {
    const pmCounts = ESTACIONES.map(est => rows.filter(r => r[3] === est && r[11] === 1).length);
    const o3Counts = ESTACIONES.map(est => rows.filter(r => r[3] === est && r[10] === 1).length);

    const ctx = document.getElementById('chartOutliers').getContext('2d');
    if (charts.outliers) charts.outliers.destroy();
    charts.outliers = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ESTACIONES,
        datasets: [
          {
            label: 'Atípicos PM₂.₅ (>42.52 µg/m³)',
            data: pmCounts,
            backgroundColor: '#C53030',
            borderRadius: 5
          },
          {
            label: 'Atípicos O₃ (>54.66 ppb)',
            data: o3Counts,
            backgroundColor: '#2C5282',
            borderRadius: 5
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'top' } },
        scales: {
          y: {
            beginAtZero: true,
            ticks: { precision: 0 },
            title: { display: true, text: 'Cantidad de días atípicos' }
          }
        }
      }
    });
  }

  // Chart 3: Annual Evolution of Spearman vs Pearson
  function updateAnnualChart(rows) {
    const years = Array.from(new Set(rows.map(r => r[1]))).sort((a, b) => a - b);
    const rhos = [];
    const rs = [];
    years.forEach(y => {
      const sub = rows.filter(r => r[1] === y);
      const sp = spearman(sub.map(r => r[4]), sub.map(r => r[5]));
      const pe = pearson(sub.map(r => r[4]), sub.map(r => r[5]));
      rhos.push(sp !== null ? Number(sp.toFixed(4)) : null);
      rs.push(pe !== null ? Number(pe.toFixed(4)) : null);
    });

    const ctx = document.getElementById('chartAnnual').getContext('2d');
    if (charts.annual) charts.annual.destroy();
    charts.annual = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: years.map(y => y === 2023 ? '2023*' : String(y)),
        datasets: [
          {
            label: 'Spearman (ρ)',
            data: rhos,
            backgroundColor: '#1B365D',
            borderRadius: 5
          },
          {
            label: 'Pearson (r)',
            data: rs,
            backgroundColor: '#38B2AC',
            borderRadius: 5
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'top' } },
        scales: {
          y: {
            beginAtZero: true,
            max: 0.8,
            title: { display: true, text: 'Coeficiente de correlación' }
          }
        }
      }
    });
  }

  // Chart 4: Scatter Plot O3 vs PM2.5
  function updateScatterChart(rows) {
    const normalPts = [];
    const outlierPts = [];
    rows.forEach(r => {
      const pt = { x: r[4], y: r[5], fecha: r[0], est: r[3] };
      if (r[11] === 1 || r[10] === 1) outlierPts.push(pt);
      else normalPts.push(pt);
    });

    const ctx = document.getElementById('chartScatter').getContext('2d');
    if (charts.scatter) charts.scatter.destroy();
    charts.scatter = new Chart(ctx, {
      type: 'scatter',
      data: {
        datasets: [
          {
            label: `Días regulares (${normalPts.length.toLocaleString('es-MX')})`,
            data: normalPts,
            backgroundColor: 'rgba(44, 82, 130, 0.42)',
            borderColor: 'rgba(27, 54, 93, 0.55)',
            pointRadius: 2.8,
            pointHoverRadius: 5
          },
          {
            label: `Días atípicos IQR (${outlierPts.length.toLocaleString('es-MX')})`,
            data: outlierPts,
            backgroundColor: 'rgba(197, 48, 48, 0.85)',
            borderColor: '#742A2A',
            pointRadius: 4.5,
            pointHoverRadius: 7
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 250 },
        plugins: {
          legend: { position: 'top' },
          tooltip: {
            callbacks: {
              label: ctx => {
                const p = ctx.raw;
                return `${p.fecha} (${p.est}) | O₃: ${p.x.toFixed(2)} ppb, PM₂.₅: ${p.y.toFixed(2)} µg/m³`;
              }
            }
          }
        },
        scales: {
          x: { title: { display: true, text: 'Ozono O₃ promedio diario (ppb)' } },
          y: { title: { display: true, text: 'Material particulado PM₂.₅ (µg/m³)' } }
        }
      }
    });
  }

  // Table: Season Comparison Matrix
  function updateSeasonTable(rows, totalRho, totalR, totalDiff, totalO3, totalPm, totalAtip) {
    const tbody = document.getElementById('season-table-body');
    tbody.innerHTML = '';

    ESTACIONES.forEach(est => {
      const sub = rows.filter(r => r[3] === est);
      if (sub.length === 0) return;
      const o3 = sub.map(r => r[4]);
      const pm = sub.map(r => r[5]);
      const rho = spearman(o3, pm);
      const r = pearson(o3, pm);
      const diff = (rho !== null && r !== null) ? (rho - r) : null;
      const atip = sub.filter(row => row[11] === 1).length;

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${est}</strong></td>
        <td class="num">${sub.length.toLocaleString('es-MX')}</td>
        <td class="num"><strong>${fmtSigned(rho, 4)}</strong></td>
        <td class="num">${fmtSigned(r, 4)}</td>
        <td class="num">${fmtSigned(diff, 4)}</td>
        <td class="num">${fmtNum(mean(o3), 2)}</td>
        <td class="num">${fmtNum(mean(pm), 2)}</td>
        <td class="num">${atip}</td>
      `;
      tbody.appendChild(tr);
    });

    const trTot = document.createElement('tr');
    trTot.className = 'total-row';
    trTot.innerHTML = `
      <td>Total filtrado</td>
      <td class="num">${rows.length.toLocaleString('es-MX')}</td>
      <td class="num">${fmtSigned(totalRho, 4)}</td>
      <td class="num">${fmtSigned(totalR, 4)}</td>
      <td class="num">${fmtSigned(totalDiff, 4)}</td>
      <td class="num">${fmtNum(totalO3, 2)}</td>
      <td class="num">${fmtNum(totalPm, 2)}</td>
      <td class="num">${totalAtip}</td>
    `;
    tbody.appendChild(trTot);
  }

  // ---------- Boot ----------
  document.addEventListener('DOMContentLoaded', () => {
    initNavigation();
    initSlicers();
    renderGlobalKPIs();
    updateAll();
  });
})();
