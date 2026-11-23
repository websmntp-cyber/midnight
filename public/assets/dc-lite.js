/* dc-lite: penjalan ringan untuk halaman berformat <template id="dc-tpl"> + <script type="text/x-dc">.
 * Mendukung {{ a.b.c }}, <sc-if value>, <sc-for list as>, handler onClick/onChange,
 * pembaruan DOM bertahap (fokus input dan elemen <video> tidak hilang saat render ulang). */
(function () {
  'use strict';
  var BOOL = { disabled: 1, checked: 1, hidden: 1, required: 1, readonly: 1, multiple: 1, selected: 1, autofocus: 1, open: 1 };
  var HOLE = /\{\{\s*([^}]+?)\s*\}\}/g;
  var WHOLE = /^\s*\{\{\s*([^}]+?)\s*\}\}\s*$/;

  function DCLogic(props) { this.props = props || {}; this.state = {}; }
  DCLogic.prototype.setState = function (p, cb) {
    var patch = typeof p === 'function' ? p(this.state) : p;
    this.state = Object.assign({}, this.state, patch);
    if (this.__schedule) this.__schedule(cb);
    else if (cb) cb();
  };
  DCLogic.prototype.forceUpdate = function () { if (this.__schedule) this.__schedule(); };

  function lookup(expr, scopes, vals) {
    var parts = expr.split('.');
    var root;
    var found = false;
    for (var i = scopes.length - 1; i >= 0; i--) {
      if (Object.prototype.hasOwnProperty.call(scopes[i], parts[0])) { root = scopes[i][parts[0]]; found = true; break; }
    }
    if (!found) root = vals[parts[0]];
    for (var k = 1; k < parts.length; k++) {
      if (root === undefined || root === null) return undefined;
      root = root[parts[k]];
    }
    return root;
  }
  function interp(str, scopes, vals) {
    return str.replace(HOLE, function (_, e) { var v = lookup(e, scopes, vals); return v === undefined || v === null || v === false ? '' : String(v); });
  }

  /* ---------- evaluasi template menjadi pohon DOM baru ---------- */
  var anchorSeq = 0;
  function prepare(node) {
    // beri setiap sc-if / sc-for nomor tetap supaya posisinya bisa dicocokkan antar render
    if (node.nodeType === 1) {
      var ln = node.localName;
      if (ln === 'sc-if' || ln === 'sc-for') node.__aid = ++anchorSeq;
    }
    if (node.nodeType === 1 || node.nodeType === 11) {
      for (var c = node.firstChild; c; c = c.nextSibling) prepare(c);
    }
  }

  function build(node, scopes, vals, out) {
    if (node.nodeType === 3) { out.appendChild(document.createTextNode(node.nodeValue.indexOf('{{') === -1 ? node.nodeValue : interp(node.nodeValue, scopes, vals))); return; }
    if (node.nodeType !== 1) return;
    var ln = node.localName;
    if (ln === 'sc-if') {
      out.appendChild(document.createComment('if' + node.__aid));
      var cond = node.getAttribute('value') || '';
      var wm = WHOLE.exec(cond);
      var v = wm ? lookup(wm[1], scopes, vals) : interp(cond, scopes, vals);
      if (v && v !== 'false') for (var c = node.firstChild; c; c = c.nextSibling) build(c, scopes, vals, out);
      out.appendChild(document.createComment('/if' + node.__aid));
      return;
    }
    if (ln === 'sc-for') {
      out.appendChild(document.createComment('for' + node.__aid));
      var lm = WHOLE.exec(node.getAttribute('list') || '');
      var list = lm ? lookup(lm[1], scopes, vals) : [];
      var as = node.getAttribute('as') || 'item';
      if (Array.isArray(list)) {
        for (var i = 0; i < list.length; i++) {
          var sc = {}; sc[as] = list[i];
          scopes.push(sc);
          for (var c2 = node.firstChild; c2; c2 = c2.nextSibling) build(c2, scopes, vals, out);
          scopes.pop();
        }
      }
      out.appendChild(document.createComment('/for' + node.__aid));
      return;
    }
    var el = node.namespaceURI && node.namespaceURI !== 'http://www.w3.org/1999/xhtml'
      ? document.createElementNS(node.namespaceURI, node.localName)
      : document.createElement(node.localName);
    var handlers = null;
    var attrs = node.attributes;
    for (var a = 0; a < attrs.length; a++) {
      var name = attrs[a].name, raw = attrs[a].value;
      if (name.indexOf('hint-placeholder') === 0) continue;
      var m = WHOLE.exec(raw);
      if (/^on[a-z]+$/.test(name) && m) {
        var fn = lookup(m[1], scopes, vals);
        if (typeof fn === 'function') {
          var evn = name.slice(2);
          if (evn === 'change' && (node.localName === 'textarea' || (node.localName === 'input' && !/^(file|checkbox|radio|range|color|date|time)$/.test(node.getAttribute('type') || 'text')))) evn = 'input';
          (handlers = handlers || {})[evn] = fn;
        }
        continue;
      }
      var val = m ? lookup(m[1], scopes, vals) : (raw.indexOf('{{') === -1 ? raw : interp(raw, scopes, vals));
      if (BOOL[name]) { if (val === true || val === '' || (typeof val === 'string' && val !== 'false' && val !== '' ) || (val && typeof val !== 'string')) el.setAttribute(name, ''); continue; }
      if (val === undefined || val === null) continue;
      if (typeof val === 'function') continue;
      el.setAttribute(name, String(val));
    }
    if (handlers) el.__h = handlers;
    if (ln === 'textarea') {
      // isi textarea datang dari atribut value
    } else {
      for (var c3 = node.firstChild; c3; c3 = c3.nextSibling) build(c3, scopes, vals, el);
    }
    out.appendChild(el);
  }

  /* ---------- pembaruan DOM bertahap ---------- */
  function keyed(n) { return n.nodeType === 8 || (n.nodeType === 1 && n.getAttribute('id')); }
  function match(l, n) {
    if (l.nodeType !== n.nodeType) return false;
    if (n.nodeType === 3) return true;
    if (n.nodeType === 8) return l.data === n.data;
    if (l.localName !== n.localName || l.namespaceURI !== n.namespaceURI) return false;
    return (l.getAttribute('id') || '') === (n.getAttribute('id') || '');
  }
  function patchEl(l, n) {
    var i, name;
    var la = l.attributes;
    for (i = la.length - 1; i >= 0; i--) { name = la[i].name; if (!n.hasAttribute(name)) l.removeAttribute(name); }
    var na = n.attributes;
    for (i = 0; i < na.length; i++) { name = na[i].name; if (l.getAttribute(name) !== na[i].value) l.setAttribute(name, na[i].value); }
    // handler
    var h = n.__h || null;
    l.__h = h;
    if (h) {
      l.__hl = l.__hl || {};
      Object.keys(h).forEach(function (ev) {
        if (l.__hl[ev]) return;
        l.__hl[ev] = true;
        l.addEventListener(ev, function (e) { var f = l.__h && l.__h[ev]; if (f) f(e); });
      });
    }
    var tag = l.localName;
    if (tag === 'textarea') {
      var tv = n.getAttribute('value') || '';
      if (l.value !== tv) l.value = tv;
      return;
    }
    morphChildren(l, n);
    if (tag === 'input') {
      var type = (l.getAttribute('type') || 'text').toLowerCase();
      if (type === 'file') return;
      if (type === 'checkbox' || type === 'radio') { var ck = n.hasAttribute('checked'); if (l.checked !== ck) l.checked = ck; return; }
      var iv = n.hasAttribute('value') ? n.getAttribute('value') : '';
      if (l.value !== iv) l.value = iv;
    } else if (tag === 'select') {
      var sv = n.getAttribute('value');
      if (sv !== null && l.value !== sv) l.value = sv;
    }
  }
  function adopt(n) {
    // elemen baru: pasang handler dan nilai awal
    if (n.nodeType !== 1) return n;
    var h = n.__h;
    if (h) {
      n.__hl = {};
      Object.keys(h).forEach(function (ev) { n.__hl[ev] = true; n.addEventListener(ev, function (e) { var f = n.__h && n.__h[ev]; if (f) f(e); }); });
    }
    if (n.localName === 'textarea') n.value = n.getAttribute('value') || '';
    for (var c = n.firstChild; c; c = c.nextSibling) adopt(c);
    if (n.localName === 'select' && n.getAttribute('value') !== null) n.value = n.getAttribute('value');
    return n;
  }
  function morphChildren(live, next) {
    var nodes = Array.prototype.slice.call(next.childNodes);
    var i = 0;
    for (var k = 0; k < nodes.length; k++) {
      var n = nodes[k];
      var l = live.childNodes[i];
      if (l && match(l, n)) { if (n.nodeType === 3) { if (l.nodeValue !== n.nodeValue) l.nodeValue = n.nodeValue; } else if (n.nodeType === 1) patchEl(l, n); i++; continue; }
      if (keyed(n)) {
        var j = i, found = null;
        while (j < live.childNodes.length) { if (match(live.childNodes[j], n)) { found = live.childNodes[j]; break; } j++; }
        if (found) {
          while (live.childNodes[i] !== found) live.removeChild(live.childNodes[i]);
          if (n.nodeType === 1) patchEl(found, n);
          i++; continue;
        }
        live.insertBefore(adopt(n), l || null); i++; continue;
      }
      if (l && !keyed(l)) { live.replaceChild(adopt(n), l); i++; continue; }
      live.insertBefore(adopt(n), l || null); i++;
    }
    while (live.childNodes.length > i) live.removeChild(live.lastChild);
  }

  /* ---------- pemasangan ---------- */
  function boot() {
    var tpl = document.getElementById('dc-tpl');
    var scriptEl = document.querySelector('script[type="text/x-dc"]');
    if (!tpl || !scriptEl) return;
    var content = tpl.content;
    var helm = content.querySelector('helmet');
    if (helm) {
      Array.prototype.slice.call(helm.children).forEach(function (c) { document.head.appendChild(document.importNode(c, true)); });
      helm.parentNode.removeChild(helm);
    }
    var root = document.createElement('div');
    root.id = 'app';
    tpl.parentNode.insertBefore(root, tpl);
    tpl.parentNode.removeChild(tpl);
    prepare(content);

    var defs = {};
    try { defs = JSON.parse(scriptEl.getAttribute('data-props') || '{}'); } catch (e) { defs = {}; }
    var props = {};
    Object.keys(defs).forEach(function (k) { if (k.charAt(0) !== '$' && defs[k] && 'default' in defs[k]) props[k] = defs[k].default; });

    var Component = new Function('DCLogic', 'window', 'document', scriptEl.textContent + '\n;return Component;')(DCLogic, window, document);
    var inst = new Component(props);
    var pending = false, cbs = [], mounted = false;

    function render() {
      pending = false;
      var vals = inst.renderVals();
      var holder = document.createElement('div');
      for (var c = content.firstChild; c; c = c.nextSibling) build(c, [], vals, holder);
      morphChildren(root, holder);
      var list = cbs; cbs = [];
      list.forEach(function (f) { try { f(); } catch (e) { console.error(e); } });
      if (!mounted) { mounted = true; if (typeof inst.componentDidMount === 'function') inst.componentDidMount(); }
    }
    inst.__schedule = function (cb) {
      if (cb) cbs.push(cb);
      if (pending) return;
      pending = true;
      Promise.resolve().then(function () {
        try { render(); } catch (e) { console.error('Gagal menampilkan halaman:', e); showError(e); }
      });
    };
    inst.__flush = render;
    window.addEventListener('pagehide', function () { if (typeof inst.componentWillUnmount === 'function') inst.componentWillUnmount(); });
    window.__dc = inst;
    try { render(); } catch (e) { console.error('Gagal menampilkan halaman:', e); showError(e); }
  }
  function showError(e) {
    var d = document.getElementById('dc-error');
    if (!d) { d = document.createElement('pre'); d.id = 'dc-error'; d.style.cssText = 'position:fixed;left:8px;right:8px;bottom:8px;margin:0;padding:10px;background:#fee;color:#900;font:12px monospace;white-space:pre-wrap;z-index:99999;border:1px solid #c00;border-radius:8px'; document.body.appendChild(d); }
    d.textContent = 'Terjadi kesalahan: ' + (e && e.message ? e.message : e) + '\nMuat ulang halaman. Jika masih terjadi, hubungi admin.';
  }

  window.DCLogic = DCLogic;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
