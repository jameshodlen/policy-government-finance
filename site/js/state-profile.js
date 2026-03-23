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
    var path = window.location.pathname;
    var match = path.match(/\/states\/(\w+)\.html/);
    if (!match) return;
    var stateAbbrev = match[1].toLowerCase();

    Promise.all([
      SFP.loadJSON('/data/' + stateAbbrev + '/profile.json'),
      SFP.loadJSON('/data/states-summary.json'),
      SFP.loadJSON('/data/medicaid_fmap.json').catch(function() { return { records: [] }; })
    ]).then(function(results) {
      var data = results[0];
      var allStates = results[1].states;
      var fmapRecords = results[2].records || [];

      var fmapRate = null;
      var fmapRec = fmapRecords.find(function(r) { return r.abbrev === data.abbrev; });
      if (fmapRec) fmapRate = fmapRec.fmapRate;

      renderHeader(data);
      renderSidebar(data, allStates, fmapRate);
      renderRevenueBreakdown(data);
      renderExpenditureBreakdown(data);
      renderTrend(data);
      renderPensionSnapshot(data);
      renderFederalDependency(data);
      renderFreshnessIndicators(data);
    }).catch(function(err) {
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

  /* =====================================================================
     SIDEBAR — Fiscal Health Card System
     ===================================================================== */

  function creditRatingScore(rating) {
    var map = { 'AAA': 15, 'AA+': 13, 'AA': 11, 'AA-': 9, 'A+': 6, 'A': 5, 'A-': 4, 'BBB+': 3, 'BBB': 2 };
    return map[rating] || 0;
  }

  function computeFiscalHealth(data) {
    // Pension: 40=0, 100+=25
    var pensionPts = Math.max(0, Math.min(25, (data.pensionFundedRatio - 40) / 60 * 25));
    // Reserves: 0=0, 90+=25
    var reservePts = Math.max(0, Math.min(25, data.reserveDays / 90 * 25));
    // Volatility: inverted, 0=20, 80+=0
    var volPts = Math.max(0, Math.min(20, (80 - data.revenueVolatility) / 80 * 20));
    // Debt/GDP: inverted, 0=15, 20%+=0
    var debtPts = Math.max(0, Math.min(15, (20 - data.debtAsPercentGDP) / 20 * 15));
    // Credit: mapped
    var creditPts = creditRatingScore(data.creditRating);
    return Math.round(pensionPts + reservePts + volPts + debtPts + creditPts);
  }

  function healthGrade(score) {
    if (score >= 80) return 'A';
    if (score >= 65) return 'B';
    if (score >= 50) return 'C';
    if (score >= 40) return 'D';
    return 'F';
  }

  function healthColorClass(score) {
    if (score >= 80) return 'gauge-dark-green';
    if (score >= 65) return 'gauge-green';
    if (score >= 40) return 'gauge-yellow';
    return 'gauge-red';
  }

  function healthColor(score) {
    if (score >= 80) return '#2d7a4f';
    if (score >= 65) return '#4a9e6f';
    if (score >= 40) return '#c9943e';
    return '#c45a4a';
  }

  function renderSidebar(data, allStates, fmapRate) {
    var container = document.getElementById('key-stats');
    if (!container) return;

    var score = computeFiscalHealth(data);
    var grade = healthGrade(score);
    var colorCls = healthColorClass(score);
    var color = healthColor(score);

    // Build SVG gauge arc
    var gaugeR = 55, gaugeW = 10;
    var startAngle = -Math.PI * 0.75;
    var endAngle = Math.PI * 0.75;
    var scoreAngle = startAngle + (score / 100) * (endAngle - startAngle);

    var arcBg = describeArc(70, 65, gaugeR, startAngle, endAngle);
    var arcFill = describeArc(70, 65, gaugeR, startAngle, scoreAngle);

    var html = '';

    // Card 1: Fiscal Health Gauge
    html += '<div class="fiscal-gauge-card">' +
      '<svg class="gauge-svg" viewBox="0 0 140 80">' +
      '<path d="' + arcBg + '" fill="none" stroke="' + 'var(--color-border-light)' + '" stroke-width="' + gaugeW + '" stroke-linecap="round"/>' +
      '<path d="' + arcFill + '" fill="none" stroke="' + color + '" stroke-width="' + gaugeW + '" stroke-linecap="round"/>' +
      '</svg>' +
      '<div class="gauge-score ' + colorCls + '">' + score + '</div>' +
      '<div class="gauge-grade ' + colorCls + '">Grade: ' + grade + '</div>' +
      '<div class="gauge-label">Based on pension funding, reserves, volatility, debt load, and credit rating</div>' +
      '</div>';

    // Card 2: Metrics Grid
    var ratingClass = 'rating-blue';
    if (data.creditRating === 'AAA' || data.creditRating === 'AA+') ratingClass = 'rating-green';
    else if (data.creditRating && data.creditRating.startsWith('A') && !data.creditRating.startsWith('AA')) ratingClass = 'rating-yellow';
    else if (data.creditRating === 'BBB+' || data.creditRating === 'BBB') ratingClass = 'rating-red';

    var pensionColor = data.pensionFundedRatio >= 100 ? '#2d7a4f' : data.pensionFundedRatio >= 80 ? '#4a9e6f' : data.pensionFundedRatio >= 60 ? '#c9943e' : '#c45a4a';
    var pensionWidth = Math.min(data.pensionFundedRatio, 110) / 110 * 100;

    var reserveColor = data.reserveDays >= 60 ? '#2d7a4f' : data.reserveDays >= 30 ? '#4a9e6f' : data.reserveDays >= 15 ? '#c9943e' : '#c45a4a';

    html += '<div class="metrics-grid">';
    html += tile(svgIcon('people'), SFP.formatNumber(data.population), 'Population');
    html += tile(svgIcon('dollar'), SFP.formatPerCapita(data.gdpPerCapita), 'GDP/Capita');
    html += tile(svgIcon('shield'), '<span class="rating-badge ' + ratingClass + '">' + (data.creditRating || '\u2014') + '</span>', 'Credit Rating');
    html += tile(svgIcon('gauge'), '<span class="' + colorCls + '">' + score + '</span>', 'Fiscal Score');

    // Pension with inline bar
    html += '<div class="metric-tile">' + svgIcon('chart') +
      '<div class="mt-value">' + SFP.formatPercent(data.pensionFundedRatio) + '</div>' +
      '<div class="pension-bar-wrap">' +
      '<div class="pension-bar-track">' +
      '<div class="pension-bar-fill" style="width:' + pensionWidth + '%;background:' + pensionColor + ';"></div>' +
      '<div class="pension-bar-marker" style="left:' + (100/110*100) + '%;"></div>' +
      '</div></div>' +
      '<div class="mt-label">Pension Funded</div></div>';

    html += tile(svgIcon('calendar'), '<span style="color:' + reserveColor + ';">' + data.reserveDays + ' days</span>', 'Reserves');
    html += tile(svgIcon('wave'), SFP.formatNumber(data.revenueVolatility, 1), 'Rev. Volatility');
    html += tile(svgIcon('link'), SFP.formatPercent(data.federalDependencyRatio), 'Fed. Dependency');
    html += '</div>';

    // Card 3: Medicaid Status
    var medStatus, medDotColor, medLabel;
    if (data.medicaidWaiverCoverage) {
      medDotColor = '#c9943e';
      medLabel = 'Waiver Coverage (Section 1115)';
    } else if (data.medicaidExpanded) {
      medDotColor = '#4a9e6f';
      medLabel = 'Medicaid Expanded';
    } else {
      medDotColor = '#c45a4a';
      medLabel = 'Not Expanded';
    }
    html += '<div class="medicaid-badge" style="margin:0.5rem 1rem;">' +
      '<span class="badge-dot" style="background:' + medDotColor + ';"></span>' +
      '<span>' + medLabel + (fmapRate ? ' &middot; FMAP ' + fmapRate + '%' : '') + '</span>' +
      '</div>';

    // Card 4: Quick Rankings
    var pensionRank = rankOf(allStates, data.abbrev, 'pensionFundedRatio', true);
    var reserveRank = rankOf(allStates, data.abbrev, 'reserveDays', true);
    var debtRank = rankOf(allStates, data.abbrev, 'debtAsPercentGDP', false);
    var total = allStates.length;

    html += '<div class="quick-ranks">' +
      '<div style="font-size:0.75rem;text-transform:uppercase;letter-spacing:0.04em;color:var(--color-text-muted);margin-bottom:0.4rem;">How does ' + data.name + ' rank?</div>' +
      rankRow('Pension Funding', pensionRank, total) +
      rankRow('Reserve Adequacy', reserveRank, total) +
      rankRow('Debt/GDP (lower=better)', debtRank, total) +
      '</div>';

    container.innerHTML = html;
  }

  function tile(icon, value, label) {
    return '<div class="metric-tile">' + icon +
      '<div class="mt-value">' + value + '</div>' +
      '<div class="mt-label">' + label + '</div></div>';
  }

  function rankOf(states, abbrev, field, descending) {
    var sorted = states.slice().sort(function(a, b) {
      return descending ? (b[field] - a[field]) : (a[field] - b[field]);
    });
    for (var i = 0; i < sorted.length; i++) {
      if (sorted[i].abbrev === abbrev) return i + 1;
    }
    return null;
  }

  function rankRow(label, rank, total) {
    return '<div class="rank-row"><span class="rank-label">' + label +
      '</span><span class="rank-value">' + rank + ' of ' + total + '</span></div>';
  }

  function svgIcon(type) {
    var icons = {
      people: '<svg viewBox="0 0 20 20" class="mt-icon"><circle cx="10" cy="6" r="3" fill="currentColor"/><path d="M3 17c0-3.87 3.13-7 7-7s7 3.13 7 7" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>',
      dollar: '<svg viewBox="0 0 20 20" class="mt-icon"><text x="10" y="15" text-anchor="middle" font-size="14" fill="currentColor">$</text></svg>',
      shield: '<svg viewBox="0 0 20 20" class="mt-icon"><path d="M10 2l6 3v5c0 4-2.5 6.5-6 8-3.5-1.5-6-4-6-8V5z" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>',
      gauge: '<svg viewBox="0 0 20 20" class="mt-icon"><path d="M4 14a7 7 0 0 1 12 0" fill="none" stroke="currentColor" stroke-width="1.5"/><line x1="10" y1="13" x2="13" y2="8" stroke="currentColor" stroke-width="1.5"/></svg>',
      chart: '<svg viewBox="0 0 20 20" class="mt-icon"><rect x="2" y="10" width="3" height="8" fill="currentColor"/><rect x="7" y="6" width="3" height="12" fill="currentColor"/><rect x="12" y="3" width="3" height="15" fill="currentColor"/></svg>',
      calendar: '<svg viewBox="0 0 20 20" class="mt-icon"><rect x="2" y="4" width="16" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="1.5"/><line x1="2" y1="9" x2="18" y2="9" stroke="currentColor" stroke-width="1"/><line x1="6" y1="2" x2="6" y2="6" stroke="currentColor" stroke-width="1.5"/><line x1="14" y1="2" x2="14" y2="6" stroke="currentColor" stroke-width="1.5"/></svg>',
      wave: '<svg viewBox="0 0 20 20" class="mt-icon"><path d="M2 10c2-4 4 4 6 0s4 4 6 0s4 4 6 0" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>',
      link: '<svg viewBox="0 0 20 20" class="mt-icon"><path d="M8 12l4-4M6 10l-2 2a3 3 0 0 0 4 4l2-2M14 10l2-2a3 3 0 0 0-4-4l-2 2" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>',
    };
    return icons[type] || '';
  }

  function describeArc(cx, cy, r, startAngle, endAngle) {
    var x1 = cx + r * Math.cos(startAngle);
    var y1 = cy + r * Math.sin(startAngle);
    var x2 = cx + r * Math.cos(endAngle);
    var y2 = cy + r * Math.sin(endAngle);
    var largeArc = (endAngle - startAngle) > Math.PI ? 1 : 0;
    return 'M ' + x1 + ' ' + y1 + ' A ' + r + ' ' + r + ' 0 ' + largeArc + ' 1 ' + x2 + ' ' + y2;
  }

  /* =====================================================================
     CHART SECTIONS (unchanged)
     ===================================================================== */

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
