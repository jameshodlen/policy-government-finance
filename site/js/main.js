/* ==========================================================================
   50-State Government Finance Platform — Shared Utilities
   ========================================================================== */

'use strict';

const SFP = window.SFP || {};
window.SFP = SFP;

/* --- Navigation --- */
SFP.NAV_ITEMS = [
  { label: 'Dashboard', href: '/' },
  { label: 'States', href: '/states/wi.html' },
  { label: 'Analysis', href: '/analysis/pensions.html' },
  { label: 'Methodology', href: '/methodology/' },
  { label: 'Data Sources', href: '/methodology/data-sources.html' }
];

SFP.renderNav = function(currentPath) {
  const nav = document.querySelector('.site-nav');
  if (!nav) return;

  const inner = document.createElement('div');
  inner.className = 'nav-inner';

  const title = document.createElement('a');
  title.className = 'site-title';
  title.href = '/';
  title.textContent = 'State Finance Platform';
  inner.appendChild(title);

  const toggle = document.createElement('button');
  toggle.className = 'nav-toggle';
  toggle.setAttribute('aria-label', 'Toggle navigation');
  toggle.innerHTML = '&#9776;';
  toggle.addEventListener('click', function() {
    const links = nav.querySelector('.nav-links');
    if (links) links.classList.toggle('open');
  });
  inner.appendChild(toggle);

  const ul = document.createElement('ul');
  ul.className = 'nav-links';

  SFP.NAV_ITEMS.forEach(function(item) {
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.href = item.href;
    a.textContent = item.label;
    if (currentPath && (currentPath === item.href ||
        (item.href !== '/' && currentPath.startsWith(item.href.replace(/\/[^/]*$/, '/'))))) {
      a.className = 'active';
    }
    li.appendChild(a);
    ul.appendChild(li);
  });

  inner.appendChild(ul);
  nav.innerHTML = '';
  nav.appendChild(inner);
};

/* --- Data Loading --- */
SFP.loadJSON = function(path) {
  return fetch(path)
    .then(function(res) {
      if (!res.ok) throw new Error('Failed to load ' + path + ': ' + res.status);
      return res.json();
    });
};

/* --- Formatting --- */
SFP.formatCurrency = function(n, decimals) {
  if (n == null || isNaN(n)) return '—';
  decimals = decimals != null ? decimals : 0;
  var abs = Math.abs(n);
  var prefix = n < 0 ? '-$' : '$';
  if (abs >= 1e12) return prefix + (abs / 1e12).toFixed(1) + 'T';
  if (abs >= 1e9) return prefix + (abs / 1e9).toFixed(1) + 'B';
  if (abs >= 1e6) return prefix + (abs / 1e6).toFixed(1) + 'M';
  if (abs >= 1e3) return prefix + (abs / 1e3).toFixed(decimals) + 'K';
  return prefix + abs.toFixed(decimals);
};

SFP.formatPercent = function(n, decimals) {
  if (n == null || isNaN(n)) return '—';
  decimals = decimals != null ? decimals : 1;
  return n.toFixed(decimals) + '%';
};

SFP.formatNumber = function(n, decimals) {
  if (n == null || isNaN(n)) return '—';
  decimals = decimals != null ? decimals : 0;
  return n.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
};

SFP.formatPerCapita = function(n) {
  if (n == null || isNaN(n)) return '—';
  return '$' + Math.round(n).toLocaleString('en-US');
};

/* --- Data Freshness Badge --- */
SFP.freshnessStatus = function(dateStr, isSample) {
  if (isSample) return 'sample';
  if (!dateStr) return 'stale';
  var d = new Date(dateStr);
  var days = (Date.now() - d.getTime()) / (1000 * 60 * 60 * 24);
  if (days < 90) return 'fresh';
  if (days < 365) return 'aging';
  return 'stale';
};

SFP.freshnessLabel = function(status) {
  switch (status) {
    case 'fresh': return 'Current';
    case 'aging': return 'Aging';
    case 'stale': return 'Stale';
    case 'sample': return 'Sample data';
    default: return 'Unknown';
  }
};

SFP.renderFreshness = function(container, source, dateStr, isSample) {
  var status = SFP.freshnessStatus(dateStr, isSample);
  var badge = document.createElement('span');
  badge.className = 'freshness-badge';
  badge.innerHTML =
    '<span class="freshness-dot ' + status + '"></span>' +
    '<span>' + source + '</span>' +
    '<span>&middot;</span>' +
    '<span>' + (isSample ? 'Sample data' : (dateStr || 'Unknown date')) + '</span>';
  if (typeof container === 'string') {
    container = document.querySelector(container);
  }
  if (container) {
    container.appendChild(badge);
  }
  return badge;
};

/* --- Footer --- */
SFP.renderFooter = function() {
  var footer = document.querySelector('.site-footer');
  if (!footer) return;
  footer.innerHTML =
    '<div class="container">' +
      '<p>50-State Government Finance Platform &middot; ' +
      'Primary-sourced public data &middot; Nonpartisan analysis</p>' +
      '<p>Data from Census Bureau, BEA, FRED, USASpending.gov, CMS, Treasury &middot; ' +
      '<a href="/methodology/">Methodology</a> &middot; ' +
      '<a href="/methodology/data-sources.html">Data Sources</a></p>' +
    '</div>';
};

/* --- State Utilities --- */
SFP.STATE_ABBREVS = {
  'AL': 'Alabama', 'AK': 'Alaska', 'AZ': 'Arizona', 'AR': 'Arkansas',
  'CA': 'California', 'CO': 'Colorado', 'CT': 'Connecticut', 'DE': 'Delaware',
  'FL': 'Florida', 'GA': 'Georgia', 'HI': 'Hawaii', 'ID': 'Idaho',
  'IL': 'Illinois', 'IN': 'Indiana', 'IA': 'Iowa', 'KS': 'Kansas',
  'KY': 'Kentucky', 'LA': 'Louisiana', 'ME': 'Maine', 'MD': 'Maryland',
  'MA': 'Massachusetts', 'MI': 'Michigan', 'MN': 'Minnesota', 'MS': 'Mississippi',
  'MO': 'Missouri', 'MT': 'Montana', 'NE': 'Nebraska', 'NV': 'Nevada',
  'NH': 'New Hampshire', 'NJ': 'New Jersey', 'NM': 'New Mexico', 'NY': 'New York',
  'NC': 'North Carolina', 'ND': 'North Dakota', 'OH': 'Ohio', 'OK': 'Oklahoma',
  'OR': 'Oregon', 'PA': 'Pennsylvania', 'RI': 'Rhode Island', 'SC': 'South Carolina',
  'SD': 'South Dakota', 'TN': 'Tennessee', 'TX': 'Texas', 'UT': 'Utah',
  'VT': 'Vermont', 'VA': 'Virginia', 'WA': 'Washington', 'WV': 'West Virginia',
  'WI': 'Wisconsin', 'WY': 'Wyoming'
};

SFP.stateByFips = {};
SFP.fipsByAbbrev = {};

/* --- Color Scale --- */
SFP.colorScale = function(value, min, max) {
  if (value == null || isNaN(value)) return '#ddd';
  var t = Math.max(0, Math.min(1, (value - min) / (max - min)));
  // Interpolate from light blue to dark blue
  var r = Math.round(212 - t * (212 - 44));
  var g = Math.round(236 - t * (236 - 95));
  var b = Math.round(244 - t * (244 - 138));
  return 'rgb(' + r + ',' + g + ',' + b + ')';
};

SFP.divergingColor = function(value, min, max) {
  if (value == null || isNaN(value)) return '#ddd';
  var mid = (min + max) / 2;
  var t;
  if (value <= mid) {
    t = (value - min) / (mid - min);
    // low (warm) to neutral
    var r = Math.round(212 + t * (232 - 212));
    var g = Math.round(165 + t * (224 - 165));
    var b = Math.round(116 + t * (216 - 116));
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  } else {
    t = (value - mid) / (max - mid);
    // neutral to high (teal)
    var r2 = Math.round(232 - t * (232 - 90));
    var g2 = Math.round(224 - t * (224 - 158));
    var b2 = Math.round(216 - t * (216 - 143));
    return 'rgb(' + r2 + ',' + g2 + ',' + b2 + ')';
  }
};

/* --- Init on DOM ready --- */
document.addEventListener('DOMContentLoaded', function() {
  var path = window.location.pathname;
  SFP.renderNav(path);
  SFP.renderFooter();
});
