/* Driver QR booking page: behavior shared by index.html and thanks.html.
   Nothing driver-specific lives here. Edit config.js instead. */
(function () {
  "use strict";
  window.__driverReady = true;

  var C = (typeof CONFIG !== "undefined" && CONFIG) ? CONFIG : {};
  var root = document.documentElement;
  var reduceMotion = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);

  function safe(fn) { try { fn(); } catch (e) { if (window.console) console.warn(e); } }

  // ---------- reveals first, so a later error can never leave content hidden ----------
  safe(function () {
    var els = document.querySelectorAll(".reveal");
    if (reduceMotion || !("IntersectionObserver" in window)) {
      els.forEach(function (el) { el.classList.add("is-in"); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add("is-in"); io.unobserve(en.target); }
      });
    }, { rootMargin: "0px 0px -6% 0px", threshold: 0.12 });
    els.forEach(function (el) { io.observe(el); });
  });

  // ---------- templating: {firstName}, {city} ... ----------
  function hasAll(tpl) {
    var ok = true;
    tpl.replace(/\{(\w+)\}/g, function (_, k) { if (C[k] == null || String(C[k]).trim() === "") ok = false; return ""; });
    return ok;
  }
  function fill(tpl) {
    return String(tpl || "").replace(/\{(\w+)\}/g, function (_, k) { return C[k] != null ? String(C[k]) : ""; });
  }

  safe(function () {
    if (C.accent) root.style.setProperty("--gold", C.accent);

    document.querySelectorAll("[data-bind]").forEach(function (el) {
      var v = C[el.getAttribute("data-bind")];
      if (v != null && String(v).trim() !== "") el.textContent = v;
    });
    document.querySelectorAll("[data-tpl]").forEach(function (el) {
      var tpl = el.getAttribute("data-tpl");
      if (hasAll(tpl)) el.textContent = fill(tpl);
    });
    var driverInput = document.querySelector('input[name="driver"]');
    if (driverInput && C.firstName) driverInput.value = C.firstName;
  });

  // ---------- icons (trusted constants only) ----------
  var ICONS = {
    plane: '<path d="M10.5 3.6c0-.8.7-1.6 1.5-1.6s1.5.8 1.5 1.6V9l7.5 4.6V16l-7.5-2.3v4.5l2.3 1.7V22L12 21l-3.8 1v-2.1l2.3-1.7v-4.5L3 16v-2.4L10.5 9z"/>',
    bag:   '<path d="M5 8h14l-1.1 12.4a1.7 1.7 0 0 1-1.7 1.6H7.8a1.7 1.7 0 0 1-1.7-1.6z"/><path d="M9 10V6.8a3 3 0 0 1 6 0V10"/>',
    glass: '<path d="M4.5 4h15L12 12.5z"/><path d="M12 12.5V20M8 20.5h8M7.5 7.5h9"/>',
    road:  '<path d="M4 21L10 3M20 21L14 3M12 5v2M12 10.5v2.5M12 16.5v4"/>',
    star:  '<path d="M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6-4.5-4.2 6.1-.7z"/>',
    check: '<circle cx="12" cy="12" r="9.2"/><path d="M8 12.3l2.7 2.7L16.2 9.5"/>'
  };
  function icon(name) {
    var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "1.6");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");
    svg.setAttribute("aria-hidden", "true");
    svg.innerHTML = ICONS[name] || ICONS.star;
    return svg;
  }
  function span(cls, text) {
    var s = document.createElement("span");
    s.className = cls;
    s.textContent = text;
    return s;
  }

  // ---------- services + trust lines ----------
  safe(function () {
    var list = document.querySelector("[data-services]");
    if (list && Array.isArray(C.services)) {
      list.textContent = "";
      C.services.forEach(function (s) {
        if (!s || !s.title) return;
        var li = document.createElement("li");
        li.className = "chip";
        li.appendChild(icon(s.icon));
        li.appendChild(span("chip__t", s.title));
        if (s.detail) li.appendChild(span("chip__d", s.detail));
        list.appendChild(li);
      });
    }
    var trust = document.querySelector("[data-trust]");
    if (trust) {
      trust.textContent = "";
      (Array.isArray(C.trust) ? C.trust : []).forEach(function (line) {
        var li = document.createElement("li");
        li.appendChild(icon("check"));
        li.appendChild(span("", fill(line)));
        trust.appendChild(li);
      });
      trust.hidden = !trust.children.length;
    }
  });

  // ---------- Text button: hidden unless DRIVER_SMS is set ----------
  var smsNumber = String(C.sms || "").replace(/[^\d+]/g, "");
  safe(function () {
    var isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    var body = encodeURIComponent(fill(C.smsMessage || ""));
    document.querySelectorAll("[data-sms]").forEach(function (el) {
      if (!smsNumber) { el.hidden = true; el.removeAttribute("href"); return; }
      el.href = "sms:" + smsNumber + (body ? (isIOS ? "&" : "?") + "body=" + body : "");
      el.hidden = false;
    });
  });

  // ---------- Save to contacts (.vcf built in the browser) ----------
  function bookingUrl() {
    if (C.bookingUrl) return C.bookingUrl;
    return location.href.split(/[?#]/)[0].replace(/(index|thanks)(\.html)?$/, "");
  }
  function vEsc(s) {
    return String(s).replace(/\\/g, "\\\\").replace(/\r?\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
  }
  function buildVcf() {
    var first = C.firstName || "Driver";
    var url = bookingUrl();
    var lines = [
      "BEGIN:VCARD",
      "VERSION:3.0",
      "N:;" + vEsc(first) + ";;;",
      "FN:" + vEsc(first),
      "item1.URL:" + url,
      "item1.X-ABLabel:Book a ride",
      "NOTE:" + vEsc("Personal driver" + (C.city ? " in " + C.city : "") + ". Book your next ride: " + url)
    ];
    if (smsNumber) lines.push("TEL;TYPE=CELL:" + smsNumber);
    lines.push("END:VCARD");
    return lines.join("\r\n") + "\r\n";
  }
  safe(function () {
    document.querySelectorAll("[data-vcf]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var file = (String(C.firstName || "driver").replace(/[^\w-]+/g, "") || "driver") + ".vcf";
        var blob = new Blob([buildVcf()], { type: "text/vcard;charset=utf-8" });
        var href = URL.createObjectURL(blob);
        var a = document.createElement("a");
        a.href = href;
        a.download = file;
        a.rel = "noopener";
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(function () { URL.revokeObjectURL(href); }, 4000);
      });
    });
  });

  // ---------- form niceties (index only) ----------
  safe(function () {
    var date = document.getElementById("f-date");
    if (date) {
      var t = new Date();
      t.setMinutes(t.getMinutes() - t.getTimezoneOffset());
      date.min = t.toISOString().slice(0, 10);
    }

    var sel = document.querySelector("[data-passengers]");
    var max = parseInt(C.maxPassengers, 10);
    if (sel && max > 0 && max < 20) {
      sel.textContent = "";
      for (var i = 1; i <= max; i++) {
        var o = document.createElement("option");
        o.value = String(i);
        o.textContent = String(i);
        if (i === 1) o.selected = true;
        sel.appendChild(o);
      }
    }

    var form = document.querySelector('form[name="ride-request"]');
    var submit = document.querySelector("[data-submit]");
    var label = document.querySelector("[data-submit-label]");
    if (form && submit) {
      var original = label ? label.textContent : "";
      form.addEventListener("submit", function () {
        submit.setAttribute("aria-busy", "true");
        if (label) label.textContent = "Sending…";
        setTimeout(function () { submit.disabled = true; }, 0);
      });
      // Back button restores the page from cache: reset the button.
      window.addEventListener("pageshow", function () {
        submit.disabled = false;
        submit.removeAttribute("aria-busy");
        if (label) label.textContent = original;
      });
    }
  });
})();
