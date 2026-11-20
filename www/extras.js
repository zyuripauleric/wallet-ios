/* App extras: backup/restore, PIN + biometric lock, due-date reminders, offline install. */
(function () {
  var LS = localStorage, menu = document.getElementById("ddMenu"), ov = null, hiddenAt = 0, idle = null;
  function item(label, fn) { var b = document.createElement("button"); b.type = "button"; b.setAttribute("role", "menuitem"); b.textContent = label; b.onclick = fn; menu.appendChild(b); return b; }
  function save(name, text) { var a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type: "application/json" })); a.download = name; document.body.appendChild(a); a.click(); a.remove(); }
  /* ---- backup / restore ---- */
  var fi = document.createElement("input"); fi.type = "file"; fi.accept = ".json,application/json"; fi.hidden = true; document.body.appendChild(fi);
  item("Backup everything (JSON)", function () { WalletStore.dump().then(function (o) { save("wallet-backup-" + o.at.slice(0, 10) + ".json", JSON.stringify(o)); LS.setItem("wl-lastbackup", o.at); }); });
  item("Restore backup", function () { fi.click(); });
  fi.onchange = function () {
    var f = fi.files[0]; if (!f) return;
    f.text().then(function (t) { if (!confirm("Restoring replaces ALL current data with the backup. Continue?")) return; return WalletStore.restore(JSON.parse(t)).then(function () { location.reload(); }); }).catch(function () { alert("That file is not a valid Wallet backup."); }); fi.value = "";
  };
  /* ---- lock ---- */
  function hash(s) { return crypto.subtle.digest("SHA-256", new TextEncoder().encode((LS.getItem("wl-psalt") || "") + s)).then(function (b) { return Array.from(new Uint8Array(b)).map(function (x) { return ("0" + x.toString(16)).slice(-2); }).join(""); }); }
  function b64(u) { return btoa(String.fromCharCode.apply(null, u)); }
  function unb(s) { return Uint8Array.from(atob(s), function (c) { return c.charCodeAt(0); }); }
  function lock() {
    if (!LS.getItem("wl-pin") || ov) return;
    ov = document.createElement("div"); ov.style.cssText = "position:fixed;inset:0;z-index:99999;background:var(--bg,#fff);color:var(--ink,#000);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;font:16px system-ui";
    ov.innerHTML = '<b style="font-size:20px">Wallet is locked</b><input id="lkPin" type="password" inputmode="numeric" autocomplete="off" placeholder="PIN" style="font-size:20px;padding:10px;text-align:center;width:160px"><button id="lkGo" class="btn primary">Unlock</button><button id="lkBio" class="btn" hidden>Use fingerprint / Face ID</button><small id="lkMsg"></small>';
    document.body.appendChild(ov);
    var pin = ov.querySelector("#lkPin"), msg = ov.querySelector("#lkMsg"), bio = ov.querySelector("#lkBio");
    function open() { ov.remove(); ov = null; }
    function go() { hash(pin.value).then(function (h) { if (h === LS.getItem("wl-pin")) open(); else { msg.textContent = "Wrong PIN."; pin.value = ""; } }); }
    ov.querySelector("#lkGo").onclick = go; pin.onkeydown = function (e) { if (e.key === "Enter") go(); };
    if (LS.getItem("wl-bio") && window.PublicKeyCredential) { bio.hidden = false; bio.onclick = function () { navigator.credentials.get({ publicKey: { challenge: crypto.getRandomValues(new Uint8Array(32)), allowCredentials: [{ type: "public-key", id: unb(LS.getItem("wl-bio")) }], userVerification: "required", timeout: 60000 } }).then(open, function () { msg.textContent = "Biometric check failed. Use your PIN."; }); }; }
    pin.focus();
  }
  item("App lock (PIN)…", function () {
    var cur = LS.getItem("wl-pin"), p;
    (cur ? hash(prompt("Enter your current PIN") || "").then(function (h) { return h === cur; }) : Promise.resolve(true)).then(function (ok) {
      if (!ok) { alert("Wrong PIN."); return; }
      p = prompt("New PIN (4 to 8 digits). Leave empty to turn the lock off.");
      if (p === null) return;
      if (!p) { ["wl-pin", "wl-psalt", "wl-bio"].forEach(function (k) { LS.removeItem(k); }); alert("Lock turned off."); return; }
      if (!/^\d{4,8}$/.test(p)) { alert("Use 4 to 8 digits."); return; }
      LS.setItem("wl-psalt", b64(crypto.getRandomValues(new Uint8Array(12))));
      hash(p).then(function (h) { LS.setItem("wl-pin", h); LS.removeItem("wl-bio"); alert("PIN set. The app locks after 1 minute away or 3 minutes idle."); });
      if (window.PublicKeyCredential && confirm("Also unlock with fingerprint / Face ID?")) navigator.credentials.create({ publicKey: { challenge: crypto.getRandomValues(new Uint8Array(32)), rp: { name: "Wallet" }, user: { id: crypto.getRandomValues(new Uint8Array(8)), name: "wallet", displayName: "Wallet" }, pubKeyCredParams: [{ type: "public-key", alg: -7 }, { type: "public-key", alg: -257 }], authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required" } } }).then(function (c) { LS.setItem("wl-bio", b64(new Uint8Array(c.rawId))); }, function () {});
    });
  });
  function bump() { clearTimeout(idle); idle = setTimeout(lock, 180000); }
  ["pointerdown", "keydown", "scroll"].forEach(function (e) { addEventListener(e, bump, true); }); bump();
  /* ---- reminders: fire when the app is opened or resumed ---- */
  window.__remind = function (st, occ, add, today, wm) {
    window.__ra = [st, occ, add, today, wm];
    if (LS.getItem("wl-remind") !== "1" || !window.Notification || Notification.permission !== "granted" || !navigator.serviceWorker) return;
    var seen = {}; try { seen = JSON.parse(LS.getItem("wl-seen") || "{}"); } catch (e) {}
    st.recs.forEach(function (r) {
      var w = wm[r.wallet]; if (!w || r.active === false) return;
      occ(r, add(today, 3)).forEach(function (o) {
        var k = r.id + "|" + o.date; if (o.date < today || o.date <= (r.last || "") || seen[k]) return; seen[k] = 1;
        navigator.serviceWorker.ready.then(function (g) { g.showNotification((o.date === today ? "Due today: " : "Due " + o.date + ": ") + (r.name || r.type), { body: w.name || "", tag: k, icon: "icons/icon-192.png" }); });
      });
    });
    var ks = Object.keys(seen); if (ks.length > 300) ks.slice(0, ks.length - 300).forEach(function (k) { delete seen[k]; });
    LS.setItem("wl-seen", JSON.stringify(seen));
  };
  var rb = item("Due-date reminders: " + (LS.getItem("wl-remind") === "1" ? "on" : "off"), function () {
    if (LS.getItem("wl-remind") === "1") { LS.setItem("wl-remind", "0"); rb.textContent = "Due-date reminders: off"; return; }
    if (!window.Notification) { alert("This browser does not support notifications."); return; }
    Notification.requestPermission().then(function (p) { if (p === "granted") { LS.setItem("wl-remind", "1"); rb.textContent = "Due-date reminders: on"; if (window.__ra) window.__remind.apply(null, window.__ra); } else alert("Notifications are blocked for this site."); });
  });
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) { hiddenAt = Date.now(); return; }
    if (hiddenAt && Date.now() - hiddenAt > 60000) lock(); if (window.__ra) window.__remind.apply(null, window.__ra);
  });

  /* ---- search + receipts ---- */
  function el(t, css, html) { var x = document.createElement(t); if (css) x.style.cssText = css; if (html) x.innerHTML = html; return x; }
  function esc(v) { return String(v == null ? "" : v).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function shrink(f) { return new Promise(function (res, rej) { var im = new Image(), u = URL.createObjectURL(f); im.onload = function () { var s = Math.min(1, 1100 / Math.max(im.width, im.height)), c = document.createElement("canvas"); c.width = im.width * s; c.height = im.height * s; c.getContext("2d").drawImage(im, 0, 0, c.width, c.height); URL.revokeObjectURL(u); res(c.toDataURL("image/jpeg", 0.72)); }; im.onerror = rej; im.src = u; }); }
  var pf = el("input"); pf.type = "file"; pf.accept = "image/*"; pf.hidden = true; document.body.appendChild(pf);
  function openSearch() {
    var P = el("div", "position:fixed;inset:0;z-index:9000;background:var(--bg,#fff);color:var(--ink,#000);overflow:auto;padding:max(16px,env(safe-area-inset-top,0px)) 16px 40px;font:14px system-ui");
    P.innerHTML = '<div style="max-width:720px;margin:0 auto"><div style="display:flex;gap:8px;margin-bottom:10px"><input id="sq" type="search" placeholder="Search notes, categories, wallets, dates, amounts" style="flex:1;font-size:16px;padding:10px;border-radius:10px;border:1px solid var(--line,#ccc);background:var(--surface,#fff);color:inherit"><button class="btn" id="sx" type="button">Close</button></div><label style="display:block;margin-bottom:8px"><input type="checkbox" id="sr"> Only with receipt</label><div id="ss" style="color:var(--muted,#666);margin-bottom:8px"></div><div id="sl"></div></div>';
    document.body.appendChild(P);
    var q = P.querySelector("#sq"), sr = P.querySelector("#sr"), ss = P.querySelector("#ss"), sl = P.querySelector("#sl"), T = [], W = {}, R = {};
    function load() { return Promise.all([WalletStore.all("tx"), WalletStore.all("wallets"), WalletStore.all("receipts")]).then(function (r) { T = r[0].map(function (x) { return Object.assign({ id: x.id }, x.d); }); W = {}; r[1].forEach(function (w) { W[w.id] = w.d; }); R = {}; r[2].forEach(function (x) { R[x.id] = x.d; }); draw(); }); }
    function draw() {
      var toks = q.value.toLowerCase().split(/\s+/).filter(Boolean), out = T.filter(function (t) {
        if (sr.checked && !R[t.id]) return false;
        var hay = [t.note, t.cat, t.sub, (W[t.wallet] || {}).name, t.date, t.amount].join(" ").toLowerCase();
        return toks.every(function (k) { return hay.indexOf(k) >= 0; });
      }).sort(function (a, b) { return (b.date || "") < (a.date || "") ? -1 : 1; });
      ss.textContent = out.length + (out.length === 1 ? " transaction" : " transactions") + (out.length > 100 ? " (showing 100)" : "");
      sl.innerHTML = out.slice(0, 100).map(function (t) {
        var w = W[t.wallet] || {}, col = t.kind === "in" ? "var(--win,#0b7a4b)" : t.kind === "out" ? "var(--loss,#c2372d)" : "inherit";
        return '<div style="display:flex;gap:10px;align-items:center;padding:9px 0;border-bottom:1px solid var(--line,#ddd)"><div style="flex:1;min-width:0"><div>' + esc(t.note || t.cat || "Transaction") + '</div><small style="color:var(--muted,#666)">' + esc(t.date) + " · " + esc(w.name || "") + (t.cat ? " · " + esc(t.cat) : "") + '</small></div><b style="color:' + col + '">' + (t.kind === "out" ? "−" : "") + Number(t.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " " + esc(w.cur || "") + '</b><button class="btn sm" data-r="' + esc(t.id) + '" type="button" title="Receipt">' + (R[t.id] ? "🧾" : "📎") + "</button></div>";
      }).join("") || '<p style="color:var(--muted,#666)">Nothing found.</p>';
    }
    q.oninput = draw; sr.onchange = draw; P.querySelector("#sx").onclick = function () { P.remove(); };
    sl.onclick = function (e) {
      var b = e.target.closest("[data-r]"); if (!b) return; var id = b.getAttribute("data-r");
      if (!R[id]) { pf.onchange = function () { var f = pf.files[0]; pf.value = ""; if (f) shrink(f).then(function (d) { return WalletStore.col("receipts").doc(id).set({ img: d, at: Date.now() }); }).then(load, function () { alert("Could not read that photo."); }); }; pf.click(); return; }
      var V = el("div", "position:fixed;inset:0;z-index:9500;background:rgba(0,0,0,.88);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:16px"), im = el("img", "max-width:100%;max-height:78vh;border-radius:8px"); im.src = R[id].img; V.appendChild(im);
      var row = el("div", "display:flex;gap:10px"), c = el("button", "", "Close"), d = el("button", "", "Remove receipt"); c.className = d.className = "btn"; c.type = d.type = "button"; row.appendChild(c); row.appendChild(d); V.appendChild(row); document.body.appendChild(V);
      c.onclick = function () { V.remove(); }; d.onclick = function () { V.remove(); WalletStore.col("receipts").doc(id).delete().then(load); };
    };
    load().then(function () { q.focus(); });
  }
  var sb = el("button", "", "🔍 Search"); sb.className = "btn"; sb.type = "button"; sb.onclick = openSearch;
  var qa = document.getElementById("qaCat"); if (qa) qa.insertAdjacentElement("afterend", sb); else item("Search & receipts", openSearch);
  /* ---- first-run welcome ---- */
  setTimeout(function () {
    if (LS.getItem("wl-welcomed") || ov) return;
    WalletStore.all("wallets").then(function (w) {
      if (w.length) { LS.setItem("wl-welcomed", "1"); return; }
      var P = el("div", "position:fixed;inset:0;z-index:9000;background:var(--bg,#fff);color:var(--ink,#000);display:flex;align-items:center;justify-content:center;padding:20px;font:15px/1.5 system-ui");
      P.innerHTML = '<div style="max-width:380px;text-align:center"><div style="font-size:44px">👛</div><h2 style="margin:8px 0">Welcome to Wallet</h2><p style="color:var(--muted,#666)">Everything stays on this device. Set up in two steps:</p><ol style="text-align:left;margin:12px auto 18px;padding-left:22px"><li>Add an account (cash, bank, e-wallet or credit card).</li><li>Log your first expense or income from the calendar.</li></ol><button class="btn primary" id="wA" type="button" style="width:100%;margin-bottom:8px">Add my first account</button><button class="btn" id="wR" type="button" style="width:100%;margin-bottom:8px">Restore from a backup</button><button class="btn" id="wS" type="button" style="width:100%">Skip for now</button></div>';
      document.body.appendChild(P);
      function done() { LS.setItem("wl-welcomed", "1"); P.remove(); }
      P.querySelector("#wA").onclick = function () { done(); var b = document.getElementById("qaWallet"); if (b) b.click(); };
      P.querySelector("#wR").onclick = function () { fi.click(); }; P.querySelector("#wS").onclick = done;
    });
  }, 1500);
  lock();
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(function () {});
})();
