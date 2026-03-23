/* ==========================================================================
   Medicaid Analysis Page
   ========================================================================== */

'use strict';

(function() {

  function init() {
    Promise.all([
      SFP.loadJSON('/data/states-summary.json'),
      SFP.loadJSON('/data/medicaid_fmap.json')
    ]).then(function(results) {
      var summaryData = results[0];
      var fmapData = results[1];

      var states = summaryData.states;
      var fmapMap = {};
      (fmapData.records || []).forEach(function(r) {
        fmapMap[r.abbrev] = r;
      });

      // Enrich states with FMAP and medicaid %
      states.forEach(function(s) {
        var fmap = fmapMap[s.abbrev];
        s.fmapRate = fmap ? fmap.fmapRate : null;
        s.medicaidPct = s.totalExpenditure > 0
          ? (s.medicaidSpending / s.totalExpenditure * 100) : 0;
        s.medicaidPerCapita = s.population > 0
          ? (s.medicaidSpending / s.population) : 0;
      });

      renderSubtitle(states);
      renderSummaryStats(states);
      renderExpansionMap(states);
      renderFmapChart(states);
      renderMedicaidTable(states);
      renderWiMn(states);
      SFP.renderFreshness('#med-freshness', 'CMS / Census',
        summaryData.generated, summaryData.sample);
    }).catch(function(err) {
      console.error('Failed to load medicaid data:', err);
    });
  }

  function renderSubtitle(states) {
    var medPcts = states.map(function(s) { return s.medicaidPct; }).sort(function(a,b) { return a-b; });
    var median = medPcts[Math.floor(medPcts.length / 2)];
    var el = document.getElementById('med-subtitle');
    if (el) {
      el.textContent = 'Median ' + median.toFixed(1) + '% of state budgets. ' +
        (states.filter(function(s) { return s.medicaidExpanded; }).length) +
        ' states expanded. FMAP rates range from 50% to 77%.';
    }
  }

  function renderSummaryStats(states) {
    var container = document.getElementById('med-summary-stats');
    if (!container) return;

    var medPcts = states.map(function(s) { return s.medicaidPct; }).sort(function(a,b) { return a-b; });
    var median = medPcts[Math.floor(medPcts.length / 2)];
    var totalMed = states.reduce(function(sum, s) { return sum + s.medicaidSpending; }, 0);
    var medGtEd = states.filter(function(s) { return s.medicaidSpending > s.educationSpending; }).length;

    // Federal share estimate (rough: weighted average FMAP * total)
    var fedShare = states.reduce(function(sum, s) {
      return sum + s.medicaidSpending * ((s.fmapRate || 60) / 100);
    }, 0);

    container.innerHTML = [
      { value: median.toFixed(1) + '%', label: 'Median % of State Budget' },
      { value: SFP.formatCurrency(totalMed), label: 'Total Medicaid Spending' },
      { value: SFP.formatCurrency(fedShare), label: 'Est. Federal Share' },
      { value: medGtEd + '', label: 'States: Medicaid > Education' },
    ].map(function(s) {
      return '<div class="summary-stat"><div class="stat-value">' + s.value +
        '</div><div class="stat-label">' + s.label + '</div></div>';
    }).join('');
  }

  function renderExpansionMap(states) {
    var container = document.getElementById('expansion-map');
    if (!container) return;

    // Add expansion as a metric for choropleth coloring
    var mapStates = states.map(function(s) {
      return Object.assign({}, s, {
        expansionValue: s.medicaidExpanded ? 1 : 0
      });
    });

    d3.json('https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json')
      .then(function(topoData) {
        var width = 960, height = 600;
        container.innerHTML = '';

        var dataByFips = {};
        mapStates.forEach(function(d) { dataByFips[d.fips] = d; });

        var svg = d3.select(container).append('svg')
          .attr('viewBox', '0 0 ' + width + ' ' + height)
          .attr('preserveAspectRatio', 'xMidYMid meet');

        var projection = d3.geoAlbersUsa()
          .fitSize([width, height], topojson.feature(topoData, topoData.objects.states));
        var path = d3.geoPath().projection(projection);

        var tooltip = d3.select(container).append('div')
          .attr('class', 'tooltip').style('display', 'none');

        svg.selectAll('.state-path')
          .data(topojson.feature(topoData, topoData.objects.states).features)
          .enter().append('path')
          .attr('class', 'state-path')
          .attr('d', path)
          .attr('fill', function(d) {
            var sd = dataByFips[d.id] || dataByFips[String(d.id).padStart(2, '0')];
            if (!sd) return '#ddd';
            if (sd.medicaidWaiverCoverage) return '#c9943e'; // WI amber
            return sd.medicaidExpanded ? '#5a9e8f' : '#d4a574';
          })
          .on('mouseover', function(event, d) {
            var sd = dataByFips[d.id] || dataByFips[String(d.id).padStart(2, '0')];
            if (!sd) return;
            var status = sd.medicaidWaiverCoverage ? 'Waiver Coverage'
              : (sd.medicaidExpanded ? 'Expanded' : 'Not Expanded');
            tooltip.style('display', 'block').html(
              '<div class="tooltip-title">' + sd.name + '</div>' +
              '<div>Status: ' + status + '</div>' +
              '<div>FMAP: ' + (sd.fmapRate ? sd.fmapRate + '%' : '\u2014') + '</div>' +
              '<div>Medicaid/Capita: ' + SFP.formatPerCapita(sd.medicaidPerCapita) + '</div>'
            );
          })
          .on('mousemove', function(event) {
            var rect = container.getBoundingClientRect();
            tooltip.style('left', (event.clientX - rect.left + 12) + 'px')
              .style('top', (event.clientY - rect.top - 10) + 'px');
          })
          .on('mouseout', function() { tooltip.style('display', 'none'); })
          .on('click', function(event, d) {
            var sd = dataByFips[d.id] || dataByFips[String(d.id).padStart(2, '0')];
            if (sd) window.location.href = '/states/' + sd.abbrev.toLowerCase() + '.html';
          });

        // Legend
        var legend = document.createElement('div');
        legend.style.cssText = 'display:flex;justify-content:center;gap:1.5rem;margin-top:0.75rem;font-size:0.8rem;';
        legend.innerHTML =
          '<span style="display:flex;align-items:center;gap:0.3rem;"><span style="width:14px;height:14px;background:#5a9e8f;border-radius:2px;"></span> Expanded</span>' +
          '<span style="display:flex;align-items:center;gap:0.3rem;"><span style="width:14px;height:14px;background:#c9943e;border-radius:2px;"></span> Waiver</span>' +
          '<span style="display:flex;align-items:center;gap:0.3rem;"><span style="width:14px;height:14px;background:#d4a574;border-radius:2px;"></span> Not Expanded</span>';
        container.appendChild(legend);
      })
      .catch(function(err) {
        container.innerHTML = '<p style="color:var(--color-text-muted);text-align:center;padding:3rem;">Map unavailable. See table below for expansion data.</p>';
      });
  }

  function renderFmapChart(states) {
    var sorted = states.filter(function(s) { return s.fmapRate != null; })
      .sort(function(a, b) { return b.fmapRate - a.fmapRate; });

    var barData = sorted.map(function(s) {
      var isHighlight = s.abbrev === 'WI' || s.abbrev === 'MN';
      return {
        label: s.abbrev + (isHighlight ? ' \u2605' : ''),
        value: s.fmapRate,
        color: isHighlight ? 'var(--color-accent)' : (s.medicaidExpanded ? '#5a9e8f' : '#d4a574')
      };
    });

    SFP.barChart('#fmap-chart', barData, {
      horizontal: true,
      format: function(v) { return SFP.formatPercent(v); },
      margin: { top: 10, right: 60, bottom: 20, left: 50 },
      barHeight: 10,
    });
  }

  function renderMedicaidTable(states) {
    var columns = [
      {
        key: 'name', label: 'State',
        render: function(val, d) {
          return '<a class="state-link" href="/states/' + d.abbrev.toLowerCase() + '.html">' + val + '</a>';
        }
      },
      { key: 'medicaidSpending', label: 'Medicaid Spending', format: SFP.formatCurrency, numeric: true },
      { key: 'medicaidPct', label: '% of Budget', format: function(v) { return v.toFixed(1) + '%'; }, numeric: true },
      { key: 'fmapRate', label: 'FMAP Rate', format: function(v) { return v ? v.toFixed(1) + '%' : '\u2014'; }, numeric: true },
      {
        key: 'medicaidExpanded', label: 'Expanded',
        render: function(val, d) {
          if (d.medicaidWaiverCoverage) return '<span style="color:var(--color-aging);">Waiver</span>';
          return val ? '<span style="color:var(--color-fresh);">Yes</span>' : '<span style="color:var(--color-stale);">No</span>';
        }
      },
      { key: 'medicaidPerCapita', label: 'Per Capita', format: SFP.formatPerCapita, numeric: true },
    ];

    SFP.sortableTable('#medicaid-table', states, columns, {
      defaultSort: 'medicaidPct',
      defaultAsc: false,
    });
  }

  function renderWiMn(states) {
    var container = document.getElementById('wi-mn-medicaid');
    if (!container) return;

    var wi = states.find(function(s) { return s.abbrev === 'WI'; });
    var mn = states.find(function(s) { return s.abbrev === 'MN'; });
    if (!wi || !mn) return;

    container.innerHTML =
      '<div class="card">' +
        '<h3>Wisconsin</h3>' +
        '<table class="data-table" style="font-size:0.85rem;">' +
        '<tr><td>Expansion Status</td><td class="numeric"><strong style="color:var(--color-aging);">Waiver (1115)</strong></td></tr>' +
        '<tr><td>FMAP Rate</td><td class="numeric"><strong>' + (wi.fmapRate || '59.36') + '%</strong></td></tr>' +
        '<tr><td>Medicaid Spending</td><td class="numeric"><strong>' + SFP.formatCurrency(wi.medicaidSpending) + '</strong></td></tr>' +
        '<tr><td>% of Budget</td><td class="numeric"><strong>' + wi.medicaidPct.toFixed(1) + '%</strong></td></tr>' +
        '<tr><td>Per Capita</td><td class="numeric"><strong>' + SFP.formatPerCapita(wi.medicaidPerCapita) + '</strong></td></tr>' +
        '</table>' +
        '<p style="font-size:0.85rem;margin-top:0.75rem;color:var(--color-text-secondary);">Wisconsin covers adults to 100% FPL via Section 1115 waiver at the standard FMAP rate (~59%). Full ACA expansion would extend coverage to 138% FPL and bring the 90% enhanced FMAP for the expansion population, potentially reducing state costs for currently-covered enrollees while expanding the covered population.</p>' +
      '</div>' +
      '<div class="card">' +
        '<h3>Minnesota</h3>' +
        '<table class="data-table" style="font-size:0.85rem;">' +
        '<tr><td>Expansion Status</td><td class="numeric"><strong style="color:var(--color-fresh);">Expanded</strong></td></tr>' +
        '<tr><td>FMAP Rate</td><td class="numeric"><strong>' + (mn.fmapRate || '50.00') + '%</strong></td></tr>' +
        '<tr><td>Medicaid Spending</td><td class="numeric"><strong>' + SFP.formatCurrency(mn.medicaidSpending) + '</strong></td></tr>' +
        '<tr><td>% of Budget</td><td class="numeric"><strong>' + mn.medicaidPct.toFixed(1) + '%</strong></td></tr>' +
        '<tr><td>Per Capita</td><td class="numeric"><strong>' + SFP.formatPerCapita(mn.medicaidPerCapita) + '</strong></td></tr>' +
        '</table>' +
        '<p style="font-size:0.85rem;margin-top:0.75rem;color:var(--color-text-secondary);">Minnesota expanded Medicaid under the ACA early (2011, before full ACA implementation). The state receives the 50% base FMAP rate — the statutory floor for wealthier states — and 90% for the expansion population. MinnesotaCare, the state\'s longstanding public coverage program, was integrated with the expansion.</p>' +
      '</div>';
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
