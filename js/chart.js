// chart.js — script clásico (solo navegador). Se carga después de Chart.js (CDN,
// global `Chart`). Expone window.RetiroChart = { initChart, updateChart }.
// Firma visual "amanecer": los tres escenarios son bandas de luz apiladas
// (alba terracota → sol ámbar → día pleno verde) y el retiro es un sol naciente.
(function () {
  let chart = null;

  const INK_SOFT = '#8A7E72';
  const BORDE    = '#EADFCE';
  const TERRACOTA = '#C75D43';
  const SOL       = '#E8923A';
  const BROTE     = '#6FA368';

  // Degradado vertical cálido para una banda; se disuelve hacia abajo.
  // Scriptable: si el área del gráfico aún no existe, cae a color plano translúcido.
  function bandaLuz(hex, alphaTop, alphaBot) {
    return (ctx) => {
      const { chart } = ctx;
      const area = chart.chartArea;
      if (!area) return hex + alphaBot;
      const g = chart.ctx.createLinearGradient(0, area.top, 0, area.bottom);
      g.addColorStop(0, hex + alphaTop);
      g.addColorStop(1, hex + alphaBot);
      return g;
    };
  }

  function moneda(v) {
    return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(v || 0);
  }

  function initChart(canvas) {
    Chart.defaults.font.family = "'Hanken Grotesk', ui-sans-serif, system-ui, sans-serif";
    Chart.defaults.color = INK_SOFT;

    chart = new Chart(canvas, {
      type: 'line',
      data: { labels: [], datasets: [] },
      options: {
        responsive: true, maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: {
            position: 'bottom',
            labels: { color: INK_SOFT, usePointStyle: true, pointStyle: 'circle', boxWidth: 8, padding: 16 },
          },
          tooltip: {
            backgroundColor: '#2A2320', titleColor: '#FBF6EE', bodyColor: '#FBF6EE',
            padding: 10, cornerRadius: 8, displayColors: true, usePointStyle: true,
            callbacks: {
              title: (items) => 'Edad ' + items[0].label,
              label: (item) => '  ' + item.dataset.label + ': ' + moneda(item.parsed.y),
            },
          },
        },
        scales: {
          x: {
            grid: { color: 'transparent' },
            ticks: { color: INK_SOFT },
            title: { display: true, text: 'Edad', color: INK_SOFT },
          },
          y: {
            grid: { color: BORDE },
            border: { display: false },
            ticks: { color: INK_SOFT, callback: (v) => '$' + (v / 1e6).toFixed(0) + 'M' },
          },
        },
      },
    });
    return chart;
  }

  function updateChart(resultado) {
    if (!chart) return;
    const labels = resultado.realista.serie.map((p) => p.edad);
    const ultimo = labels.length - 1;

    const datos = (serie) => serie.map((p) => Math.round(p.total));

    // Sol naciente: punto destacado solo al año de retiro (último de la serie realista).
    const solRadio = (c) => (c.dataIndex === ultimo ? 7 : 0);

    const banda = (serie, label, hex, fill, alphaTop, alphaBot, sol) => ({
      label, data: datos(serie),
      borderColor: hex,
      backgroundColor: bandaLuz(hex, alphaTop, alphaBot),
      borderWidth: sol ? 3 : 1.5,
      fill,
      tension: 0.35,
      pointRadius: sol ? solRadio : 0,
      pointHoverRadius: sol ? 8 : 4,
      pointBackgroundColor: hex,
      pointBorderColor: '#FFFCF7',
      pointBorderWidth: 2,
    });

    chart.data.labels = labels;
    // Orden = capas de luz de abajo hacia arriba: alba → sol → día pleno.
    chart.data.datasets = [
      banda(resultado.pesimista.serie, 'Pesimista', TERRACOTA, 'origin', '2E', '08', false),
      banda(resultado.realista.serie,  'Realista',  SOL,       '-1',     '3A', '0A', true),
      banda(resultado.optimista.serie, 'Optimista', BROTE,     '-1',     '30', '08', false),
    ];
    chart.update();
  }

  window.RetiroChart = { initChart, updateChart };
})();
