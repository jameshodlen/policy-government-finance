/* ==========================================================================
   Post-Pandemic Fiscal Inflection Analysis Page
   ========================================================================== */

'use strict';

(function() {

  function init() {
    SFP.loadJSON('/data/states-summary.json')
      .then(function(summaryData) {
        // Load WI and MN profiles for trend data
        return Promise.all([
          Promise.resolve(summaryData),
          SFP.loadJSON('/data/wi/profile.json'),
          SFP.loadJSON('/data/mn/profile.json'),
          loadAllTrends(summaryData.states)
        ]);
      })
      .then(function(results) {
        var summaryData = results[0];
        var wiProfile = results[1];
        var mnProfile = results[2];
        var trendData = results[3];

        var states = summaryData.states;
        enrichWithTrends(states, trendData);

        renderSubtitle(states);
        renderSummaryStats(states);
        renderInflectionChart(trendData);
        renderRiskTable(states);
        renderSpotlight(wiProfile, mnProfile, states);
        SFP.renderFreshness('#fi-freshness', 'Multiple sources',
          summaryData.generated, summaryData.sample);
      })
      .catch(function(err) {
        console.error('Failed to load fiscal inflection data:', err);
      });
  }

  function loadAllTrends(states) {
    // Load a sample of profiles for the aggregate chart
    var promises = states.map(function(s) {
      return SFP.loadJSON('/data/' + s.abbrev.toLowerCase() + '/profile.json')
        .catch(function() { return null; });
    });
    return Promise.all(promises);
  }

  function enrichWithTrends(states, profiles) {
    profiles.forEach(function(p) {
      if (!p) return;
      var s = states.find(function(st) { return st.abbrev === p.abbrev; });
      if (!s) return;
      var rt = p.revenueTrend || [];
      var et = p.expenditureTrend || [];
      var r21 = (rt.find(function(d) { return d.year === 2021; }) || {}).value;
      var r24 = (rt.find(function(d) { return d.year === 2024; }) || {}).value;
      var e21 = (et.find(function(d) { return d.year === 2021; }) || {}).value;
      var e24 = (et.find(function(d) { return d.year === 2024; }) || {}).value;
      if (r21 && r24) s.revGrowth2124 = ((r24 - r21) / r21 * 100);
      if (e21 && e24) s.expGrowth2124 = ((e24 - e21) / e21 * 100);
    });
  }

  function renderSubtitle(states) {
    var deficitCount = states.filter(function(s) {
      return s.expGrowth2124 != null && s.revGrowth2124 != null &&
             s.expGrowth2124 > s.revGrowth2124;
    }).length;
    var el = document.getElementById('fi-subtitle');
    if (el) {
      el.textContent = deficitCount + ' states with expenditure growing faster than revenue (2021\u20132024). ' +
        'Pandemic surpluses evaporating as structural spending pressures mount.';
    }
  }

  function renderSummaryStats(states) {
    var container = document.getElementById('fi-summary-stats');
    if (!container) return;

    var deficitCount = states.filter(function(s) {
      return s.expGrowth2124 != null && s.revGrowth2124 != null &&
             s.expGrowth2124 > s.revGrowth2124;
    }).length;
    var reserves = states.map(function(s) { return s.reserveDays; }).sort(function(a,b) { return a-b; });
    var medianReserves = reserves[Math.floor(reserves.length / 2)];
    var highVol = states.filter(function(s) { return s.revenueVolatility > 25; }).length;

    var stats = [
      { value: deficitCount + '', label: 'States in Deficit Territory' },
      { value: medianReserves + ' days', label: 'Median Reserve Days' },
      { value: highVol + '', label: 'States with Volatility > 25' },
    ];

    container.innerHTML = stats.map(function(s) {
      return '<div class="summary-stat"><div class="stat-value">' + s.value +
        '</div><div class="stat-label">' + s.label + '</div></div>';
    }).join('');
  }

  function renderInflectionChart(profiles) {
    var container = document.getElementById('inflection-chart');
    if (!container) return;

    // Aggregate revenue by year across all states
    var yearTotals = {};
    profiles.forEach(function(p) {
      if (!p || !p.revenueTrend) return;
      p.revenueTrend.forEach(function(d) {
        yearTotals[d.year] = (yearTotals[d.year] || 0) + d.value;
      });
    });

    var actual = Object.keys(yearTotals).sort().map(function(y) {
      return { year: +y, value: yearTotals[y] };
    });

    if (actual.length === 0) {
      container.innerHTML = '<p style="color:var(--color-text-muted);text-align:center;padding:3rem;">No trend data available.</p>';
      return;
    }

    // Calculate pre-pandemic trend (2015-2019 CAGR projected forward)
    var pre = actual.filter(function(d) { return d.year >= 2015 && d.year <= 2019; });
    var trendLine = [];
    if (pre.length >= 2) {
      var first = pre[0], last = pre[pre.length - 1];
      var years = last.year - first.year;
      var cagr = Math.pow(last.value / first.value, 1 / years) - 1;
      for (var y = 2015; y <= 2024; y++) {
        trendLine.push({
          year: y,
          value: first.value * Math.pow(1 + cagr, y - first.year)
        });
      }
    }

    // Draw with D3
    var margin = { top: 20, right: 90, bottom: 40, left: 70 };
    var width = (container.clientWidth || 700) - margin.left - margin.right;
    var height = 300;

    container.innerHTML = '';
    var svg = d3.select(container).append('svg')
      .attr('viewBox', '0 0 ' + (width + margin.left + margin.right) + ' ' + (height + margin.top + margin.bottom))
      .attr('preserveAspectRatio', 'xMidYMid meet')
      .append('g').attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

    var allPoints = actual.concat(trendLine);
    var x = d3.scaleLinear().domain(d3.extent(allPoints, function(d) { return d.year; })).range([0, width]);
    var y = d3.scaleLinear().domain([0, d3.max(allPoints, function(d) { return d.value; }) * 1.05]).nice().range([height, 0]);

    // Grid
    svg.append('g').call(d3.axisLeft(y).ticks(5).tickSize(-width).tickFormat('')).selectAll('line').attr('stroke', '#eee');
    svg.select('.domain').remove();

    var line = d3.line().x(function(d) { return x(d.year); }).y(function(d) { return y(d.value); });

    // Trend line (dashed)
    if (trendLine.length > 0) {
      svg.append('path').datum(trendLine).attr('fill', 'none')
        .attr('stroke', 'var(--color-text-muted)').attr('stroke-width', 1.5)
        .attr('stroke-dasharray', '6,4').attr('d', line);
      var lastTrend = trendLine[trendLine.length - 1];
      svg.append('text').attr('x', x(lastTrend.year) + 4).attr('y', y(lastTrend.value))
        .attr('dy', '0.35em').attr('font-size', '10px').attr('fill', 'var(--color-text-muted)')
        .text('Pre-pandemic trend');
    }

    // Actual line
    svg.append('path').datum(actual).attr('fill', 'none')
      .attr('stroke', 'var(--color-data-1)').attr('stroke-width', 2.5).attr('d', line);
    var lastActual = actual[actual.length - 1];
    svg.append('text').attr('x', x(lastActual.year) + 4).attr('y', y(lastActual.value))
      .attr('dy', '0.35em').attr('font-size', '10px').attr('fill', 'var(--color-data-1)')
      .text('Actual revenue');

    // Pandemic annotation
    var pandemic = actual.find(function(d) { return d.year === 2021; });
    if (pandemic) {
      svg.append('line').attr('x1', x(2020)).attr('x2', x(2020))
        .attr('y1', 0).attr('y2', height)
        .attr('stroke', 'var(--color-aging)').attr('stroke-width', 1).attr('stroke-dasharray', '3,3');
      svg.append('text').attr('x', x(2020) + 4).attr('y', 10)
        .attr('font-size', '9px').attr('fill', 'var(--color-aging)').text('COVID');
    }

    // Axes
    svg.append('g').attr('transform', 'translate(0,' + height + ')')
      .call(d3.axisBottom(x).tickFormat(d3.format('d')).ticks(10)).selectAll('text').attr('font-size', '11px');
    svg.append('g').call(d3.axisLeft(y).ticks(5).tickFormat(function(d) { return SFP.formatCurrency(d); }))
      .selectAll('text').attr('font-size', '11px');
    svg.selectAll('.domain').remove();
  }

  function riskSignal(s) {
    if (s.revenueVolatility > 20 || s.reserveDays < 15) return 'Exposed';
    if (s.revenueVolatility < 10 && s.reserveDays > 45) return 'Cushioned';
    return 'Stable';
  }

  function renderRiskTable(states) {
    var enriched = states.filter(function(s) { return s.revGrowth2124 != null; });

    var columns = [
      {
        key: 'name', label: 'State',
        render: function(val, d) {
          return '<a class="state-link" href="/states/' + d.abbrev.toLowerCase() + '.html">' + val + '</a>';
        }
      },
      { key: 'revenueVolatility', label: 'Rev. Volatility', format: function(v) { return SFP.formatNumber(v, 1); }, numeric: true },
      { key: 'reserveDays', label: 'Reserve Days', format: function(v) { return SFP.formatNumber(v, 0); }, numeric: true },
      { key: 'revGrowth2124', label: 'Rev Growth 21\u201324', format: function(v) { return v != null ? v.toFixed(1) + '%' : '\u2014'; }, numeric: true },
      { key: 'expGrowth2124', label: 'Exp Growth 21\u201324', format: function(v) { return v != null ? v.toFixed(1) + '%' : '\u2014'; }, numeric: true },
      {
        key: '_risk', label: 'Risk Signal',
        render: function(val, d) {
          var signal = riskSignal(d);
          var colors = { 'Exposed': '#c45a4a', 'Stable': '#c9943e', 'Cushioned': '#4a9e6f' };
          return '<span style="display:inline-block;padding:0.15rem 0.5rem;border-radius:10px;font-size:0.75rem;' +
            'background:' + colors[signal] + ';color:white;">' + signal + '</span>';
        }
      },
    ];

    SFP.sortableTable('#risk-table', enriched, columns, {
      defaultSort: 'revenueVolatility',
      defaultAsc: false,
    });
  }

  function renderSpotlight(wi, mn, states) {
    var container = document.getElementById('wi-mn-spotlight');
    if (!container) return;

    var wiState = states.find(function(s) { return s.abbrev === 'WI'; }) || {};
    var mnState = states.find(function(s) { return s.abbrev === 'MN'; }) || {};

    function trendPct(profile, field) {
      var t = profile[field] || [];
      var v21 = (t.find(function(d) { return d.year === 2021; }) || {}).value;
      var v24 = (t.find(function(d) { return d.year === 2024; }) || {}).value;
      if (v21 && v24) return ((v24 - v21) / v21 * 100).toFixed(1) + '%';
      return '\u2014';
    }

    function card(name, abbrev, profile, state) {
      var revG = trendPct(profile, 'revenueTrend');
      var expG = trendPct(profile, 'expenditureTrend');
      var signal = riskSignal(state);
      return '<div class="card">' +
        '<h3>' + name + '</h3>' +
        '<table class="data-table" style="font-size:0.85rem;">' +
        '<tr><td>Revenue Volatility</td><td class="numeric"><strong>' + SFP.formatNumber(state.revenueVolatility, 1) + '</strong></td></tr>' +
        '<tr><td>Reserve Days</td><td class="numeric"><strong>' + state.reserveDays + '</strong></td></tr>' +
        '<tr><td>Revenue Growth 21\u201324</td><td class="numeric"><strong>' + revG + '</strong></td></tr>' +
        '<tr><td>Expenditure Growth 21\u201324</td><td class="numeric"><strong>' + expG + '</strong></td></tr>' +
        '<tr><td>Risk Signal</td><td class="numeric"><strong>' + signal + '</strong></td></tr>' +
        '</table>' +
        '<p style="font-size:0.85rem;margin-top:0.75rem;color:var(--color-text-secondary);">' +
        (abbrev === 'WI'
          ? 'Wisconsin\'s low revenue volatility (7.7) and moderate reserves (30 days) position it as fiscally stable. Revenue growth slightly outpaced expenditure growth post-pandemic, suggesting the state absorbed the fiscal shock without creating structural imbalances.'
          : 'Minnesota\'s slightly higher volatility (9.8) is offset by stronger reserves (43 days). The biennial budget cycle provides a natural planning horizon that smooths annual fluctuations. Expenditure growth slightly outpaced revenue, but reserves provide a buffer.'
        ) + '</p></div>';
    }

    container.innerHTML = card('Wisconsin', 'WI', wi, wiState) + card('Minnesota', 'MN', mn, mnState);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
