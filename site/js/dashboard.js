/* ==========================================================================
   Dashboard Page — Choropleth Map + Sortable Table
   ========================================================================== */

'use strict';

(function() {

  var METRICS = [
    {
      key: 'revenuePerCapita',
      label: 'Revenue Per Capita',
      format: SFP.formatPerCapita,
      description: 'Total state revenue per person',
    },
    {
      key: 'expenditurePerCapita',
      label: 'Spending Per Capita',
      format: SFP.formatPerCapita,
      description: 'Total state expenditure per person',
    },
    {
      key: 'pensionFundedRatio',
      label: 'Pension Funded Ratio',
      format: SFP.formatPercent,
      description: 'Pension assets as % of liabilities',
      diverging: true,
    },
    {
      key: 'debtPerCapita',
      label: 'Debt Per Capita',
      format: SFP.formatPerCapita,
      description: 'Total state debt per person',
    },
    {
      key: 'reserveDays',
      label: 'Reserve Days',
      format: function(v) { return SFP.formatNumber(v, 0) + ' days'; },
      description: 'Rainy day fund as days of spending',
    },
    {
      key: 'revenueVolatility',
      label: 'Revenue Volatility',
      format: function(v) { return SFP.formatNumber(v, 1); },
      description: 'Pew revenue volatility index',
    },
    {
      key: 'federalDependencyRatio',
      label: 'Federal Dependency',
      format: SFP.formatPercent,
      description: 'Federal transfers as % of total revenue',
    },
  ];

  var TABLE_COLUMNS = [
    {
      key: 'name',
      label: 'State',
      render: function(val, d) {
        var abbr = d.abbrev.toLowerCase();
        return '<a class="state-link" href="/states/' + abbr + '.html">' + val + '</a>';
      },
    },
    { key: 'revenuePerCapita', label: 'Rev/Capita', format: SFP.formatPerCapita, numeric: true },
    { key: 'expenditurePerCapita', label: 'Exp/Capita', format: SFP.formatPerCapita, numeric: true },
    { key: 'pensionFundedRatio', label: 'Pension %', format: function(v) { return SFP.formatPercent(v); }, numeric: true },
    { key: 'debtPerCapita', label: 'Debt/Capita', format: SFP.formatPerCapita, numeric: true },
    { key: 'reserveDays', label: 'Reserve Days', format: function(v) { return SFP.formatNumber(v, 0); }, numeric: true },
    { key: 'creditRating', label: 'Rating' },
  ];

  var currentMetric = METRICS[0];
  var stateData = [];
  var mapInstance = null;

  function init() {
    SFP.loadJSON('/data/states-summary.json')
      .then(function(data) {
        stateData = data.states;

        renderSummaryStats(stateData);
        renderMetricSelector();
        renderFreshness(data);
        loadMapAndRender();
        renderTable(stateData);
      })
      .catch(function(err) {
        console.error('Failed to load state data:', err);
        document.getElementById('choropleth-map').innerHTML =
          '<p style="color:var(--color-text-muted);text-align:center;padding:3rem;">Unable to load state data. Check console for details.</p>';
      });
  }

  function renderSummaryStats(states) {
    var container = document.getElementById('summary-stats');
    if (!container) return;

    var totalRev = 0, totalDebt = 0, totalUnfunded = 0;
    var fundedRatios = [];
    states.forEach(function(s) {
      totalRev += s.totalRevenue || 0;
      totalDebt += s.totalDebt || 0;
      totalUnfunded += s.unfundedLiability || 0;
      if (s.pensionFundedRatio != null) fundedRatios.push(s.pensionFundedRatio);
    });

    fundedRatios.sort(function(a, b) { return a - b; });
    var medianFunded = fundedRatios[Math.floor(fundedRatios.length / 2)];

    var stats = [
      { label: 'Total State Revenue', value: SFP.formatCurrency(totalRev) },
      { label: 'Total State Debt', value: SFP.formatCurrency(totalDebt) },
      { label: 'Unfunded Pension Liabilities', value: SFP.formatCurrency(totalUnfunded) },
      { label: 'Median Pension Funded Ratio', value: SFP.formatPercent(medianFunded) },
      { label: 'States Tracked', value: '50' },
    ];

    container.innerHTML = stats.map(function(s) {
      return '<div class="summary-stat">' +
        '<div class="stat-value">' + s.value + '</div>' +
        '<div class="stat-label">' + s.label + '</div>' +
        '</div>';
    }).join('');
  }

  function renderMetricSelector() {
    var container = document.getElementById('metric-selector');
    if (!container) return;

    container.innerHTML = METRICS.map(function(m) {
      var active = m.key === currentMetric.key ? ' active' : '';
      return '<button class="metric-btn' + active + '" data-metric="' + m.key + '" title="' + m.description + '">' +
        m.label + '</button>';
    }).join('');

    container.addEventListener('click', function(e) {
      var btn = e.target.closest('.metric-btn');
      if (!btn) return;

      var metricKey = btn.dataset.metric;
      currentMetric = METRICS.find(function(m) { return m.key === metricKey; });

      container.querySelectorAll('.metric-btn').forEach(function(b) {
        b.classList.toggle('active', b.dataset.metric === metricKey);
      });

      if (mapInstance && mapInstance.update) {
        mapInstance.update(currentMetric.key, currentMetric.format, currentMetric.label);
      }
    });
  }

  function renderFreshness(data) {
    SFP.renderFreshness('#map-freshness', 'Multiple sources', data.generated, data.sample);
  }

  function loadMapAndRender() {
    var mapContainer = document.getElementById('choropleth-map');

    // Load TopoJSON from CDN
    d3.json('https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json')
      .then(function(topoData) {
        mapInstance = SFP.choroplethMap(mapContainer, topoData, stateData, {
          metric: currentMetric.key,
          format: currentMetric.format,
          label: currentMetric.label,
          diverging: currentMetric.diverging,
        });
      })
      .catch(function(err) {
        console.error('Failed to load map data:', err);
        mapContainer.innerHTML =
          '<p style="color:var(--color-text-muted);text-align:center;padding:3rem;">' +
          'Map unavailable &mdash; TopoJSON could not be loaded. ' +
          'The sortable table below contains all state data.</p>';
      });
  }

  function renderTable(states) {
    SFP.sortableTable('#states-table', states, TABLE_COLUMNS, {
      defaultSort: 'name',
      defaultAsc: true,
    });
  }

  // Initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
