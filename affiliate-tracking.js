(function () {
  'use strict';

  var affiliateHosts = [
    'anrdoezrs.net', 'dpbolvw.net', 'jdoqocy.com', 'kqzyfj.com',
    'tkqlhce.com', 'turbify.com', 'lawdepot.com', 'amazon.com',
    'amzn.to', 'payhip.com'
  ];

  function isAffiliateLink(link) {
    if (!link || !link.href) return false;
    var rel = (link.getAttribute('rel') || '').toLowerCase();
    if (rel.split(/\s+/).indexOf('sponsored') !== -1) return true;
    try {
      var host = new URL(link.href, location.href).hostname.toLowerCase();
      return affiliateHosts.some(function (candidate) {
        return host === candidate || host.endsWith('.' + candidate);
      });
    } catch (_) {
      return false;
    }
  }

  function text(value, limit) {
    return String(value || '').replace(/\s+/g, ' ').trim().slice(0, limit);
  }

  document.addEventListener('click', function (event) {
    var link = event.target.closest && event.target.closest('a[href]');
    if (!isAffiliateLink(link) || typeof window.gtag !== 'function') return;

    var target;
    try { target = new URL(link.href, location.href); } catch (_) { return; }
    var sid = target.searchParams.get('sid') || target.searchParams.get('subid') || '';
    var placement = link.getAttribute('data-affiliate-position') ||
      (link.closest('header,nav,main,aside,footer,article,section') || {}).tagName || 'unknown';

    window.gtag('event', 'affiliate_click', {
      affiliate_domain: target.hostname,
      affiliate_sid: text(sid, 100),
      link_text: text(link.textContent || link.getAttribute('aria-label'), 100),
      link_url: text(target.href, 300),
      page_path: location.pathname,
      placement: String(placement).toLowerCase(),
      transport_type: 'beacon'
    });
  }, true);
}());
