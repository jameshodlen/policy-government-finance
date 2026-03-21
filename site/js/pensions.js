/* ==========================================================================
   Pension Analysis Page
   ========================================================================== */

'use strict';

(function() {

  var TABLE_COLUMNS = [
    {
      key: 'name',
      label: 'State',
      render: function(val, d) {
        var abbr = d.abbrev.toLowerCase();
        var hasProfile = abbr === 'wi' || abbr === 'mn';
        if (hasProfile) {
          return '<a class="state-link" href="/states/' + abbr + '.html">' + val + '</a>';
        }
        return val;
      },
    },
    {
      key: 'fundedRatio',
      label: 'Funded Ratio',
      format: function(v) { return SFP.formatPercent(v); },
      numeric: true,
    },
    {
      key: 'unfundedLiability',
      label: 'Unfunded Liability',
      format: SFP.formatCurrency,
      numeric: true,
    },
    {
      key: 'annualContribution',
      label: 'Annual Contribution',
      format: SFP.formatCurrency,
      numeric: true,
    },
    {
      key: 'contributionAsPercentRevenue',
      label: '% of Revenue',
      format: function(v) { return SFP.formatPercent(v); },
      numeric: true,
    },
    {
      key: 'unfundedAsPercentRevenue',
      label: 'Unfunded/Revenue',
      format: function(v) { return SFP.formatPercent(v); },
      numeric: true,
    },
  ];

  function init() {
    SFP.loadJSON('/data/pensions/overview.json')
      .then(function(data) {
        renderSummaryStats(data);
        renderScatterPlot(data.states);
        renderTable(data.states);
        SFP.renderFreshness('#pension-freshness',
          'Public Plans Database', data.lastUpdated, data.sample);
      })
      .catch(function(err) {
        console.error('Failed to load pension data:', err);
      });
  }

  function renderSummaryStats(data) {
    var container = document.getElementById('pension-summary-stats');
    if (!container) return;

    var states = data.states;
    var below60 = states.filter(function(s) { return s.fundedRatio < 60; }).length;
    var above90 = states.filter(function(s) { return s.fundedRatio >= 90; }).length;

    var ratios = states.map(function(s) { return s.fundedRatio; }).sort(function(a,b) { return a-b; });
    var median = ratios[Math.floor(ratios.length / 2)];

    var stats = [
      { label: 'National Funded Ratio', value: SFP.formatPercent(data.nationalFundedRatio) },
      { label: 'Total Unfunded Liability', value: SFP.formatCurrency(data.totalUnfundedLiability) },
      { label: 'Median State Funded Ratio', value: SFP.formatPercent(median) },
      { label: 'States Below 60%', value: String(below60) },
      { label: 'States Above 90%', value: String(above90) },
    ];

    container.innerHTML = stats.map(function(s) {
      return '<div class="summary-stat">' +
        '<div class="stat-value">' + s.value + '</div>' +
        '<div class="stat-label">' + s.label + '</div>' +
        '</div>';
    }).join('');
  }

  function renderScatterPlot(states) {
    SFP.scatterPlot('#scatter-plot', states, {
      xKey: 'fundedRatio',
      yKey: 'contributionAsPercentRevenue',
      xLabel: 'Pension Funded Ratio',
      yLabel: 'Contribution as % of Revenue',
      xFormat: SFP.formatPercent,
      yFormat: SFP.formatPercent,
      height: 400,
    });
  }

  function renderTable(states) {
    SFP.sortableTable('#pension-table', states, TABLE_COLUMNS, {
      defaultSort: 'fundedRatio',
      defaultAsc: false,
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
