/* IMagin lead capture: every form on every page lands in one inbox.
   Forms opt in with data-lead="<source>" and optional data-next="<page to show after>". */
(function () {
  var LEAD_ENDPOINT = "https://dzaxjebkbxifgxzmehrl.supabase.co/rest/v1/leads";
  var LEAD_KEY = "sb_publishable_ZysYM01FnC9mKGx2Ki9s4g_HTe8YsB4";
  var QUEUE = "imagin_leads_queue";

  function post(row) {
    return fetch(LEAD_ENDPOINT, {
      method: "POST",
      keepalive: true,
      headers: {
        apikey: LEAD_KEY,
        "Content-Type": "application/json",
        Prefer: "return=minimal"
      },
      body: JSON.stringify(row)
    }).then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return true; });
  }

  function queue(row) {
    try {
      var q = JSON.parse(localStorage.getItem(QUEUE) || "[]");
      q.push(row);
      localStorage.setItem(QUEUE, JSON.stringify(q.slice(-20)));
    } catch (e) {}
  }

  function flush() {
    var q;
    try { q = JSON.parse(localStorage.getItem(QUEUE) || "[]"); } catch (e) { return; }
    if (!q.length) return;
    try { localStorage.setItem(QUEUE, "[]"); } catch (e) {}
    q.forEach(function (row) { post(row).catch(function () { queue(row); }); });
  }

  window.sendLead = function (p) {
    p = p || {};
    var row = {
      source: String(p.source || location.pathname).slice(0, 80),
      name: p.name ? String(p.name).slice(0, 120) : null,
      phone: (p.phone || p.mobile) ? String(p.phone || p.mobile).slice(0, 40) : null,
      email: p.email ? String(p.email).slice(0, 160) : null,
      details: p,
      page: location.href.slice(0, 300),
      user_agent: navigator.userAgent.slice(0, 300)
    };
    return post(row).catch(function (e) {
      queue(row);
      if (window.console) console.warn("IMagin lead queued, will retry:", e);
      return false;
    });
  };

  function formToObject(f) {
    var o = {};
    new FormData(f).forEach(function (v, k) {
      k = k.replace(/\[\]$/, "");
      if (k === "bot-field" || k === "form-name" || k === "company") return;
      if (o[k] === undefined) o[k] = v;
      else o[k] = [].concat(o[k], v);
    });
    return o;
  }

  document.addEventListener("submit", function (e) {
    var f = e.target && e.target.closest && e.target.closest("form[data-lead]");
    if (!f) return;
    e.preventDefault();
    var trap = f.querySelector('[name="bot-field"],[name="company"]');
    if (trap && trap.value) return;
    var data = formToObject(f);
    data.source = f.getAttribute("data-lead");
    var btn = f.querySelector('[type="submit"]');
    if (btn) btn.disabled = true;
    window.sendLead(data).then(function () {
      var next = f.getAttribute("data-next");
      if (next) { location.href = next; return; }
      f.innerHTML = '<p style="font-size:18px;font-weight:600;line-height:1.5;margin:0">Got it. IMagin will reach out within 24 hours.</p>';
    });
  }, true);

  if (document.readyState === "complete") flush();
  else window.addEventListener("load", flush);
})();
