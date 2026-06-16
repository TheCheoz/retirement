// js/chart.js  — se carga después de Chart.js (CDN, global `Chart`)
let chart = null;

export function initChart(canvas) {
  chart = new Chart(canvas, {
    type: 'line',
    data: { labels: [], datasets: [] },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: { legend: { labels: { color: '#cdd' } } },
      scales: {
        x: { ticks: { color: '#9aa' }, title: { display: true, text: 'Edad', color: '#9aa' } },
        y: { ticks: { color: '#9aa', callback: (v) => '$' + (v / 1e6).toFixed(0) + 'M' } },
      },
    },
  });
  return chart;
}

export function updateChart(resultado) {
  if (!chart) return;
  const labels = resultado.realista.serie.map((p) => p.edad);
  const linea = (serie, color, fill) => ({
    label: '', data: serie.map((p) => Math.round(p.total)),
    borderColor: color, backgroundColor: color + '22', borderWidth: 2,
    pointRadius: 0, fill,
  });
  chart.data.labels = labels;
  chart.data.datasets = [
    { ...linea(resultado.optimista.serie, '#4ade80', false), label: 'Optimista' },
    { ...linea(resultado.realista.serie, '#60a5fa', '-1'), label: 'Realista' },
    { ...linea(resultado.pesimista.serie, '#f87171', '-1'), label: 'Pesimista' },
  ];
  chart.update();
}
