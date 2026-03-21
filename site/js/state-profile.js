/* ==========================================================================
   State Profile Page — Charts and data loading
   ========================================================================== */

'use strict';

(function() {

  var REVENUE_CATEGORIES = [
    { key: 'incomeTax', label: 'Income Tax', color: '#2c5f8a' },
    { key: 'salesTax', label: 'Sales Tax', color: '#4a90b8' },
    { key: 'federalTransfers', label: 'Federal Transfers', color: '#7ab8d4' },
    { key: 'propertyTax', label: 'Property Tax', color: '#a8d4e6' },
    { key: 'other', label: 'Other', color: '#d4ecf4' },
  ];

  var EXPENDITURE_CATEGORIES = [
    { key: 'education', label: 'Education', color: '#2c5f8a' },
    { key: 'medicaid', label: 'Medicaid/Welfare', color: '#4a90b8' },
    { key: 'transportation', label: 'Transportation', color: '#7ab8d4' },
    { key: 'corrections', label: 'Corrections', color: '#a8d4e6' },
    { key: 'other', label: 'Other', color: '#d4ecf4' },
  ];

  function init() {
    // Determine which state from the URL
    var path = window.location.pathname;
    var match = path.match(/\/states\/(\w+)\.html/);
    if (!match) return;
    var stateAbbrev = match[1].toLowerCase();

    SFP.loadJSON('/data/' + stateAbbrev + '/profile.json')
      .then(function(data) {
        renderHeader(data);
        renderKeyStats(data);
        renderRevenueBreakdown(data);
        renderExpenditureBreakdown(data);
        renderTrend(data);
        renderPensionSnapshot(data);
        renderFederalDependency(data);
        renderFreshnessIndicators(data);
      })
      .catch(function(err) {
        console.error('Failed to load state profile:', err);
      });
  }

  function renderHeader(data) {
    var el = document.getElementById('state-name');
    if (el) el.textContent = data.name;
    var subtitle = document.getElementById('state-subtitle');
    if (subtitle) {
      subtitle.textContent = 'Fiscal Year: ' + (data.fiscalYear || 'July 1 - June 30') +
        ' | ' + (data.biennialBudget ? 'Biennial budget' : 'Annual budget');
    }
  }

  function renderKeyStats(data) {
    var container = document.getElementById('key-stats');
    if (!container) return;

    var stats = [
      { label: 'Population', value: SFP.formatNumber(data.population) },
      { label: 'GDP', value: SFP.formatCurrency(data.gdp) },
      { label: 'GDP Per Capita', value: SFP.formatPerCapita(data.gdpPerCapita) },
      { label: 'Credit Rating', value: data.creditRating || '—' },
      { label: 'Pension Funded', value: SFP.formatPercent(data.pensionFundedRatio) },
      { label: 'Reserve Days', value: SFP.formatNumber(data.reserveDays, 0) + ' days' },
      { label: 'Revenue Volatility', value: SFP.formatNumber(data.revenueVolatility, 1) },
      { label: 'Medicaid Expanded', value: data.medicaidExpanded ? 'Yes' : 'No' },
    ];

    container.innerHTML = stats.map(function(s) {
      return '<div class="stat-item">' +
        '<div class="stat-label">' + s.label + '</div>' +
        '<div class="stat-value">' + s.value + '</div>' +
        '</div>';
    }).join('');
  }

  function renderRevenueBreakdown(data) {
    if (!data.revenueBreakdown) return;
    var barData = data.revenueBreakdown.map(function(d) {
      return { label: d.category, value: d.value, color: d.color };
    });
    SFP.barChart('#revenue-chart', barData, {
      horizontal: true,
      format: SFP.formatCurrency,
      margin: { top: 10, right: 80, bottom: 20, left: 120 },
    });
  }

  function renderExpenditureBreakdown(data) {
    if (!data.expenditureBreakdown) return;
    var barData = data.expenditureBreakdown.map(function(d) {
      return { label: d.category, value: d.value, color: d.color };
    });
    SFP.barChart('#expenditure-chart', barData, {
      horizontal: true,
      format: SFP.formatCurrency,
      margin: { top: 10, right: 80, bottom: 20, left: 120 },
    });
  }

  function renderTrend(data) {
    if (!data.revenueTrend || !data.expenditureTrend) return;
    SFP.lineChart('#trend-chart', [
      { label: 'Revenue', data: data.revenueTrend, color: 'var(--color-data-1)' },
      { label: 'Expenditure', data: data.expenditureTrend, color: 'var(--color-low)' },
    ], {
      format: SFP.formatCurrency,
      height: 280,
    });
  }

  function renderPensionSnapshot(data) {
    var container = document.getElementById('pension-stats');
    if (!container) return;

    var stats = [
      { label: 'Funded Ratio', value: SFP.formatPercent(data.pensionFundedRatio) },
      { label: 'Unfunded Liability', value: SFP.formatCurrency(data.unfundedLiability) },
      { label: 'Annual Contribution', value: SFP.formatCurrency(data.annualPensionContribution) },
      { label: 'Contribution as % Revenue', value: SFP.formatPercent(data.pensionContributionAsPercentRevenue) },
    ];

    container.innerHTML = stats.map(function(s) {
      return '<div class="summary-stat">' +
        '<div class="stat-value">' + s.value + '</div>' +
        '<div class="stat-label">' + s.label + '</div>' +
        '</div>';
    }).join('');

    // Funded ratio history
    if (data.fundedRatioHistory) {
      SFP.lineChart('#pension-trend-chart', [
        { label: 'Funded Ratio', data: data.fundedRatioHistory, color: 'var(--color-data-1)' },
      ], {
        format: SFP.formatPercent,
        height: 220,
      });
    }
  }

  function renderFederalDependency(data) {
    var el = document.getElementById('fed-dependency-value');
    if (el) {
      el.textContent = SFP.formatPercent(data.federalDependencyRatio);
    }
    var bar = document.getElementById('fed-dependency-bar');
    if (bar) {
      bar.style.width = Math.min(data.federalDependencyRatio || 0, 100) + '%';
    }
  }

  function renderFreshnessIndicators(data) {
    var badges = document.querySelectorAll('[data-freshness]');
    badges.forEach(function(el) {
      SFP.renderFreshness(el, el.dataset.source || 'Multiple sources',
        el.dataset.date || data.generated, data.sample);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
