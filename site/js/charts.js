/* ==========================================================================
   Reusable D3.js Chart Components
   Depends on: D3.js v7 (loaded via CDN), SFP namespace from main.js
   ========================================================================== */

'use strict';

/* --- Choropleth Map --- */
SFP.choroplethMap = function(container, topoData, stateData, options) {
  options = options || {};
  var metric = options.metric || 'revenuePerCapita';
  var width = options.width || 960;
  var height = options.height || 600;
  var formatFn = options.format || SFP.formatPerCapita;
  var label = options.label || metric;

  if (typeof container === 'string') {
    container = document.querySelector(container);
  }
  if (!container) return;
  container.innerHTML = '';

  var values = stateData.map(function(d) { return d[metric]; }).filter(function(v) { return v != null; });
  var min = d3.min(values);
  var max = d3.max(values);

  var colorFn = options.diverging
    ? function(v) { return SFP.divergingColor(v, min, max); }
    : function(v) { return SFP.colorScale(v, min, max); };

  var dataByFips = {};
  stateData.forEach(function(d) {
    dataByFips[d.fips] = d;
  });

  var svg = d3.select(container)
    .append('svg')
    .attr('viewBox', '0 0 ' + width + ' ' + height)
    .attr('preserveAspectRatio', 'xMidYMid meet');

  var projection = d3.geoAlbersUsa()
    .fitSize([width, height], topojson.feature(topoData, topoData.objects.states));

  var path = d3.geoPath().projection(projection);

  var tooltip = d3.select(container)
    .append('div')
    .attr('class', 'tooltip')
    .style('display', 'none');

  var states = topojson.feature(topoData, topoData.objects.states).features;

  svg.selectAll('.state-path')
    .data(states)
    .enter()
    .append('path')
    .attr('class', 'state-path')
    .attr('d', path)
    .attr('fill', function(d) {
      var sd = dataByFips[d.id] || dataByFips[String(d.id).padStart(2, '0')];
      return sd ? colorFn(sd[metric]) : '#ddd';
    })
    .on('mouseover', function(event, d) {
      var sd = dataByFips[d.id] || dataByFips[String(d.id).padStart(2, '0')];
      if (!sd) return;
      tooltip.style('display', 'block')
        .html(
          '<div class="tooltip-title">' + (sd.name || sd.state) + '</div>' +
          '<div class="tooltip-value">' + label + ': ' + formatFn(sd[metric]) + '</div>'
        );
    })
    .on('mousemove', function(event) {
      var rect = container.getBoundingClientRect();
      tooltip
        .style('left', (event.clientX - rect.left + 12) + 'px')
        .style('top', (event.clientY - rect.top - 10) + 'px');
    })
    .on('mouseout', function() {
      tooltip.style('display', 'none');
    })
    .on('click', function(event, d) {
      var sd = dataByFips[d.id] || dataByFips[String(d.id).padStart(2, '0')];
      if (sd && sd.abbrev) {
        window.location.href = '/states/' + sd.abbrev.toLowerCase() + '.html';
      }
    });

  // Legend
  var legendDiv = document.createElement('div');
  legendDiv.className = 'map-legend';

  var canvas = document.createElement('canvas');
  canvas.width = 200;
  canvas.height = 10;
  var ctx = canvas.getContext('2d');
  for (var i = 0; i < 200; i++) {
    var v = min + (i / 199) * (max - min);
    ctx.fillStyle = colorFn(v);
    ctx.fillRect(i, 0, 1, 10);
  }

  legendDiv.innerHTML =
    '<span class="legend-label">' + formatFn(min) + '</span>';
  legendDiv.appendChild(canvas);
  var highLabel = document.createElement('span');
  highLabel.className = 'legend-label';
  highLabel.textContent = formatFn(max);
  legendDiv.appendChild(highLabel);

  container.appendChild(legendDiv);

  return { svg: svg, update: updateMetric };

  function updateMetric(newMetric, newFormat, newLabel) {
    metric = newMetric;
    formatFn = newFormat || formatFn;
    label = newLabel || newMetric;

    values = stateData.map(function(d) { return d[newMetric]; }).filter(function(v) { return v != null; });
    min = d3.min(values);
    max = d3.max(values);

    colorFn = options.diverging
      ? function(v) { return SFP.divergingColor(v, min, max); }
      : function(v) { return SFP.colorScale(v, min, max); };

    svg.selectAll('.state-path')
      .transition()
      .duration(400)
      .attr('fill', function(d) {
        var sd = dataByFips[d.id] || dataByFips[String(d.id).padStart(2, '0')];
        return sd ? colorFn(sd[newMetric]) : '#ddd';
      });

    // Update legend
    for (var i = 0; i < 200; i++) {
      var v = min + (i / 199) * (max - min);
      ctx.fillStyle = colorFn(v);
      ctx.fillRect(i, 0, 1, 10);
    }
    legendDiv.querySelector('.legend-label').textContent = formatFn(min);
    legendDiv.querySelector('.legend-label:last-child').textContent = formatFn(max);
  }
};

/* --- Sortable Table --- */
SFP.sortableTable = function(container, data, columns, options) {
  options = options || {};

  if (typeof container === 'string') {
    container = document.querySelector(container);
  }
  if (!container) return;

  var sortCol = options.defaultSort || columns[0].key;
  var sortAsc = options.defaultAsc != null ? options.defaultAsc : true;
  var filteredData = data.slice();

  var wrapper = document.createElement('div');

  // Toolbar
  var toolbar = document.createElement('div');
  toolbar.className = 'table-toolbar';

  var searchInput = document.createElement('input');
  searchInput.type = 'text';
  searchInput.className = 'search-box';
  searchInput.placeholder = 'Search states...';
  searchInput.addEventListener('input', function() {
    filterAndRender();
  });
  toolbar.appendChild(searchInput);

  var countSpan = document.createElement('span');
  countSpan.className = 'result-count';
  toolbar.appendChild(countSpan);

  wrapper.appendChild(toolbar);

  var table = document.createElement('table');
  table.className = 'data-table';

  // Header
  var thead = document.createElement('thead');
  var headerRow = document.createElement('tr');
  columns.forEach(function(col) {
    var th = document.createElement('th');
    th.textContent = col.label;
    th.dataset.key = col.key;
    if (col.numeric) th.className = 'numeric';
    var arrow = document.createElement('span');
    arrow.className = 'sort-arrow';
    arrow.textContent = ' \u25B2';
    th.appendChild(arrow);
    th.addEventListener('click', function() {
      if (sortCol === col.key) {
        sortAsc = !sortAsc;
      } else {
        sortCol = col.key;
        sortAsc = col.numeric ? false : true;
      }
      filterAndRender();
    });
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);
  table.appendChild(thead);

  var tbody = document.createElement('tbody');
  table.appendChild(tbody);
  wrapper.appendChild(table);
  container.innerHTML = '';
  container.appendChild(wrapper);

  filterAndRender();

  function filterAndRender() {
    var query = searchInput.value.toLowerCase().trim();
    filteredData = data.filter(function(d) {
      if (!query) return true;
      return columns.some(function(col) {
        var val = d[col.key];
        if (val == null) return false;
        return String(val).toLowerCase().indexOf(query) >= 0;
      });
    });

    filteredData.sort(function(a, b) {
      var va = a[sortCol];
      var vb = b[sortCol];
      if (va == null) return 1;
      if (vb == null) return -1;
      if (typeof va === 'string') {
        return sortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
      }
      return sortAsc ? va - vb : vb - va;
    });

    // Update header arrows
    headerRow.querySelectorAll('th').forEach(function(th) {
      var key = th.dataset.key;
      th.classList.toggle('sorted', key === sortCol);
      var arrow = th.querySelector('.sort-arrow');
      if (key === sortCol) {
        arrow.textContent = sortAsc ? ' \u25B2' : ' \u25BC';
      } else {
        arrow.textContent = ' \u25B2';
      }
    });

    countSpan.textContent = filteredData.length + ' of ' + data.length + ' states';

    tbody.innerHTML = '';
    filteredData.forEach(function(d) {
      var tr = document.createElement('tr');
      columns.forEach(function(col) {
        var td = document.createElement('td');
        if (col.numeric) td.className = 'numeric';
        var val = d[col.key];
        if (col.render) {
          td.innerHTML = col.render(val, d);
        } else if (col.format) {
          td.textContent = col.format(val);
        } else {
          td.textContent = val != null ? val : '—';
        }
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
  }

  return { refresh: filterAndRender };
};

/* --- Bar Chart --- */
SFP.barChart = function(container, data, options) {
  options = options || {};
  var margin = options.margin || { top: 20, right: 20, bottom: 40, left: 60 };
  var barHeight = options.barHeight || 24;
  var horizontal = options.horizontal !== false;
  var formatFn = options.format || SFP.formatCurrency;

  if (typeof container === 'string') {
    container = document.querySelector(container);
  }
  if (!container) return;
  container.innerHTML = '';

  var containerWidth = container.clientWidth || 500;
  var width = containerWidth - margin.left - margin.right;
  var height, chartHeight;

  if (horizontal) {
    chartHeight = data.length * (barHeight + 4);
    height = chartHeight + margin.top + margin.bottom;
  } else {
    chartHeight = options.height || 300;
    height = chartHeight + margin.top + margin.bottom;
  }

  var svg = d3.select(container)
    .append('svg')
    .attr('viewBox', '0 0 ' + (width + margin.left + margin.right) + ' ' + height)
    .attr('preserveAspectRatio', 'xMidYMid meet')
    .append('g')
    .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

  if (horizontal) {
    var x = d3.scaleLinear()
      .domain([0, d3.max(data, function(d) { return d.value; })])
      .range([0, width]);

    var y = d3.scaleBand()
      .domain(data.map(function(d) { return d.label; }))
      .range([0, chartHeight])
      .padding(0.15);

    svg.selectAll('.bar')
      .data(data)
      .enter()
      .append('rect')
      .attr('class', 'bar')
      .attr('x', 0)
      .attr('y', function(d) { return y(d.label); })
      .attr('width', function(d) { return x(d.value); })
      .attr('height', y.bandwidth())
      .attr('fill', function(d) { return d.color || 'var(--color-data-1)'; })
      .attr('rx', 2);

    svg.selectAll('.bar-label')
      .data(data)
      .enter()
      .append('text')
      .attr('x', function(d) { return x(d.value) + 4; })
      .attr('y', function(d) { return y(d.label) + y.bandwidth() / 2; })
      .attr('dy', '0.35em')
      .attr('font-size', '11px')
      .attr('fill', 'var(--color-text-secondary)')
      .text(function(d) { return formatFn(d.value); });

    svg.append('g')
      .attr('class', 'y-axis')
      .call(d3.axisLeft(y).tickSize(0))
      .selectAll('text')
      .attr('font-size', '12px');

    svg.select('.y-axis .domain').remove();
  } else {
    var x2 = d3.scaleBand()
      .domain(data.map(function(d) { return d.label; }))
      .range([0, width])
      .padding(0.2);

    var y2 = d3.scaleLinear()
      .domain([0, d3.max(data, function(d) { return d.value; })])
      .nice()
      .range([chartHeight, 0]);

    svg.selectAll('.bar')
      .data(data)
      .enter()
      .append('rect')
      .attr('class', 'bar')
      .attr('x', function(d) { return x2(d.label); })
      .attr('y', function(d) { return y2(d.value); })
      .attr('width', x2.bandwidth())
      .attr('height', function(d) { return chartHeight - y2(d.value); })
      .attr('fill', function(d) { return d.color || 'var(--color-data-1)'; })
      .attr('rx', 2);

    svg.append('g')
      .attr('class', 'x-axis')
      .attr('transform', 'translate(0,' + chartHeight + ')')
      .call(d3.axisBottom(x2).tickSize(0))
      .selectAll('text')
      .attr('font-size', '11px');

    svg.append('g')
      .attr('class', 'y-axis')
      .call(d3.axisLeft(y2).ticks(5).tickFormat(function(d) { return formatFn(d); }))
      .selectAll('text')
      .attr('font-size', '11px');

    svg.selectAll('.domain').remove();
  }
};

/* --- Line Chart --- */
SFP.lineChart = function(container, series, options) {
  options = options || {};
  var margin = options.margin || { top: 20, right: 80, bottom: 40, left: 60 };
  var formatFn = options.format || SFP.formatCurrency;
  var chartHeight = options.height || 300;

  if (typeof container === 'string') {
    container = document.querySelector(container);
  }
  if (!container) return;
  container.innerHTML = '';

  var containerWidth = container.clientWidth || 600;
  var width = containerWidth - margin.left - margin.right;
  var height = chartHeight + margin.top + margin.bottom;

  var svg = d3.select(container)
    .append('svg')
    .attr('viewBox', '0 0 ' + (width + margin.left + margin.right) + ' ' + height)
    .attr('preserveAspectRatio', 'xMidYMid meet')
    .append('g')
    .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

  var allPoints = [];
  series.forEach(function(s) {
    s.data.forEach(function(d) { allPoints.push(d); });
  });

  var x = d3.scaleLinear()
    .domain(d3.extent(allPoints, function(d) { return d.year; }))
    .range([0, width]);

  var y = d3.scaleLinear()
    .domain([0, d3.max(allPoints, function(d) { return d.value; })])
    .nice()
    .range([chartHeight, 0]);

  // Grid lines
  svg.append('g')
    .attr('class', 'grid')
    .call(d3.axisLeft(y).ticks(5).tickSize(-width).tickFormat(''))
    .selectAll('line')
    .attr('stroke', '#eee');
  svg.select('.grid .domain').remove();

  // Lines
  var line = d3.line()
    .x(function(d) { return x(d.year); })
    .y(function(d) { return y(d.value); });

  var colors = ['var(--color-data-1)', 'var(--color-data-3)', 'var(--color-low)'];

  series.forEach(function(s, i) {
    var color = s.color || colors[i % colors.length];

    svg.append('path')
      .datum(s.data)
      .attr('fill', 'none')
      .attr('stroke', color)
      .attr('stroke-width', 2)
      .attr('d', line);

    // Label at end of line
    var last = s.data[s.data.length - 1];
    svg.append('text')
      .attr('x', x(last.year) + 6)
      .attr('y', y(last.value))
      .attr('dy', '0.35em')
      .attr('font-size', '11px')
      .attr('fill', color)
      .text(s.label);
  });

  // Axes
  svg.append('g')
    .attr('transform', 'translate(0,' + chartHeight + ')')
    .call(d3.axisBottom(x).tickFormat(d3.format('d')).ticks(Math.min(10, width / 60)))
    .selectAll('text')
    .attr('font-size', '11px');

  svg.append('g')
    .call(d3.axisLeft(y).ticks(5).tickFormat(function(d) { return formatFn(d); }))
    .selectAll('text')
    .attr('font-size', '11px');

  svg.selectAll('.domain').remove();
};

/* --- Stacked Bar Chart --- */
SFP.stackedBar = function(container, data, categories, options) {
  options = options || {};
  var margin = options.margin || { top: 20, right: 20, bottom: 40, left: 60 };
  var chartHeight = options.height || 300;
  var formatFn = options.format || SFP.formatCurrency;

  if (typeof container === 'string') {
    container = document.querySelector(container);
  }
  if (!container) return;
  container.innerHTML = '';

  var containerWidth = container.clientWidth || 600;
  var width = containerWidth - margin.left - margin.right;
  var height = chartHeight + margin.top + margin.bottom;

  var svg = d3.select(container)
    .append('svg')
    .attr('viewBox', '0 0 ' + (width + margin.left + margin.right) + ' ' + height)
    .attr('preserveAspectRatio', 'xMidYMid meet')
    .append('g')
    .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

  var keys = categories.map(function(c) { return c.key; });
  var colors = {};
  categories.forEach(function(c) { colors[c.key] = c.color; });

  var stack = d3.stack().keys(keys);
  var stacked = stack(data);

  var x = d3.scaleBand()
    .domain(data.map(function(d) { return d.label; }))
    .range([0, width])
    .padding(0.2);

  var y = d3.scaleLinear()
    .domain([0, d3.max(stacked[stacked.length - 1], function(d) { return d[1]; })])
    .nice()
    .range([chartHeight, 0]);

  svg.selectAll('.layer')
    .data(stacked)
    .enter()
    .append('g')
    .attr('fill', function(d) { return colors[d.key]; })
    .selectAll('rect')
    .data(function(d) { return d; })
    .enter()
    .append('rect')
    .attr('x', function(d) { return x(d.data.label); })
    .attr('y', function(d) { return y(d[1]); })
    .attr('height', function(d) { return y(d[0]) - y(d[1]); })
    .attr('width', x.bandwidth())
    .attr('rx', 1);

  svg.append('g')
    .attr('transform', 'translate(0,' + chartHeight + ')')
    .call(d3.axisBottom(x).tickSize(0))
    .selectAll('text')
    .attr('font-size', '11px');

  svg.append('g')
    .call(d3.axisLeft(y).ticks(5).tickFormat(function(d) { return formatFn(d); }))
    .selectAll('text')
    .attr('font-size', '11px');

  svg.selectAll('.domain').remove();

  // Legend
  var legend = d3.select(container)
    .append('div')
    .style('display', 'flex')
    .style('flex-wrap', 'wrap')
    .style('gap', '1rem')
    .style('justify-content', 'center')
    .style('margin-top', '0.5rem')
    .style('font-size', '0.75rem');

  categories.forEach(function(c) {
    var item = legend.append('span')
      .style('display', 'flex')
      .style('align-items', 'center')
      .style('gap', '0.3rem');
    item.append('span')
      .style('width', '12px')
      .style('height', '12px')
      .style('background', c.color)
      .style('border-radius', '2px')
      .style('flex-shrink', '0');
    item.append('span').text(c.label);
  });
};

/* --- Scatter Plot --- */
SFP.scatterPlot = function(container, data, options) {
  options = options || {};
  var margin = options.margin || { top: 20, right: 20, bottom: 50, left: 60 };
  var chartHeight = options.height || 400;
  var xKey = options.xKey || 'x';
  var yKey = options.yKey || 'y';
  var xLabel = options.xLabel || xKey;
  var yLabel = options.yLabel || yKey;
  var xFormat = options.xFormat || SFP.formatPercent;
  var yFormat = options.yFormat || SFP.formatPercent;

  if (typeof container === 'string') {
    container = document.querySelector(container);
  }
  if (!container) return;
  container.innerHTML = '';

  var containerWidth = container.clientWidth || 600;
  var width = containerWidth - margin.left - margin.right;
  var height = chartHeight + margin.top + margin.bottom;

  var svg = d3.select(container)
    .append('svg')
    .attr('viewBox', '0 0 ' + (width + margin.left + margin.right) + ' ' + height)
    .attr('preserveAspectRatio', 'xMidYMid meet')
    .append('g')
    .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

  var x = d3.scaleLinear()
    .domain(d3.extent(data, function(d) { return d[xKey]; })).nice()
    .range([0, width]);

  var y = d3.scaleLinear()
    .domain(d3.extent(data, function(d) { return d[yKey]; })).nice()
    .range([chartHeight, 0]);

  // Grid
  svg.append('g')
    .call(d3.axisLeft(y).ticks(5).tickSize(-width).tickFormat(''))
    .selectAll('line').attr('stroke', '#eee');
  svg.select('.grid .domain').remove();

  // Points
  var tooltip = d3.select(container)
    .append('div')
    .attr('class', 'tooltip')
    .style('display', 'none');

  svg.selectAll('.dot')
    .data(data)
    .enter()
    .append('circle')
    .attr('class', 'dot')
    .attr('cx', function(d) { return x(d[xKey]); })
    .attr('cy', function(d) { return y(d[yKey]); })
    .attr('r', function(d) { return d.highlight ? 6 : 4; })
    .attr('fill', function(d) { return d.highlight ? 'var(--color-accent)' : 'var(--color-data-3)'; })
    .attr('stroke', '#fff')
    .attr('stroke-width', 1)
    .style('cursor', 'pointer')
    .on('mouseover', function(event, d) {
      tooltip.style('display', 'block')
        .html(
          '<div class="tooltip-title">' + (d.name || d.label) + '</div>' +
          '<div>' + xLabel + ': ' + xFormat(d[xKey]) + '</div>' +
          '<div>' + yLabel + ': ' + yFormat(d[yKey]) + '</div>'
        );
    })
    .on('mousemove', function(event) {
      var rect = container.getBoundingClientRect();
      tooltip
        .style('left', (event.clientX - rect.left + 12) + 'px')
        .style('top', (event.clientY - rect.top - 10) + 'px');
    })
    .on('mouseout', function() {
      tooltip.style('display', 'none');
    });

  // Labels for highlighted points
  data.filter(function(d) { return d.highlight; }).forEach(function(d) {
    svg.append('text')
      .attr('x', x(d[xKey]) + 8)
      .attr('y', y(d[yKey]))
      .attr('dy', '0.35em')
      .attr('font-size', '11px')
      .attr('font-weight', '600')
      .attr('fill', 'var(--color-accent)')
      .text(d.abbrev || d.name);
  });

  // Axes
  svg.append('g')
    .attr('transform', 'translate(0,' + chartHeight + ')')
    .call(d3.axisBottom(x).ticks(6).tickFormat(function(d) { return xFormat(d); }))
    .selectAll('text').attr('font-size', '11px');

  svg.append('g')
    .call(d3.axisLeft(y).ticks(6).tickFormat(function(d) { return yFormat(d); }))
    .selectAll('text').attr('font-size', '11px');

  svg.selectAll('.domain').remove();

  // Axis labels
  svg.append('text')
    .attr('x', width / 2)
    .attr('y', chartHeight + margin.bottom - 5)
    .attr('text-anchor', 'middle')
    .attr('font-size', '12px')
    .attr('fill', 'var(--color-text-secondary)')
    .text(xLabel);

  svg.append('text')
    .attr('transform', 'rotate(-90)')
    .attr('x', -chartHeight / 2)
    .attr('y', -margin.left + 14)
    .attr('text-anchor', 'middle')
    .attr('font-size', '12px')
    .attr('fill', 'var(--color-text-secondary)')
    .text(yLabel);
};
