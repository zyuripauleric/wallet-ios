/* Local database: gives the app the same db/user API it had inside Claude, stored in IndexedDB on this device. */
(function () {
  var DB = null, subs = {};
  function open() { return DB || (DB = new Promise(function (res, rej) { var q = indexedDB.open("wallet", 1); q.onupgradeneeded = function () { q.result.createObjectStore("docs", { keyPath: "k" }).createIndex("c", "c"); }; q.onsuccess = function () { res(q.result); }; q.onerror = function () { rej(q.error); }; })); }
  function tx(m, f) { return open().then(function (db) { return new Promise(function (res, rej) { var t = db.transaction("docs", m), r = f(t.objectStore("docs")); t.oncomplete = function () { res(r && r.result); }; t.onerror = t.onabort = function () { rej(t.error); }; }); }); }
  function emit(c) { (subs[c] || []).forEach(function (f) { f(); }); }
  /* Undo: every delete is remembered for a few seconds; deletes made together share one toast. */
  var batch = [], bt = null, toastEl = null;
  function stash(r) { batch.push(r); clearTimeout(bt); bt = setTimeout(function () { var b = batch; batch = []; toast(b); }, 500); }
  function toast(b) {
    if (toastEl) toastEl.remove(); var el = toastEl = document.createElement("div");
    el.style.cssText = "position:fixed;left:50%;transform:translateX(-50%);bottom:calc(20px + env(safe-area-inset-bottom,0px));z-index:9999;background:#14201c;color:#fff;padding:10px 14px;border-radius:12px;display:flex;gap:14px;align-items:center;font:14px system-ui;box-shadow:0 8px 24px rgba(0,0,0,.4)";
    el.innerHTML = "<span>Deleted " + b.length + (b.length === 1 ? " item" : " items") + '</span><button type="button" style="background:none;border:0;color:#5cd1b2;font:600 14px system-ui;cursor:pointer">Undo</button>';
    el.querySelector("button").onclick = function () { tx("readwrite", function (s) { b.forEach(function (r) { s.put(r); }); }).then(function () { var seen = {}; b.forEach(function (r) { if (!seen[r.c]) { seen[r.c] = 1; emit(r.c); } }); }); el.remove(); };
    document.body.appendChild(el); setTimeout(function () { if (el.parentNode) el.remove(); }, 8000);
  }
  function coll(c) {
    return {
      doc: function (id) {
        var k = c + "/" + id;
        return {
          set: function (d) { return tx("readwrite", function (s) { s.put({ k: k, c: c, id: id, d: d }); }).then(function () { emit(c); }); },
          update: function (p) { return tx("readonly", function (s) { return s.get(k); }).then(function (r) { return tx("readwrite", function (s) { s.put({ k: k, c: c, id: id, d: Object.assign({}, r && r.d, p) }); }); }).then(function () { emit(c); }); },
          delete: function () { return tx("readonly", function (s) { return s.get(k); }).then(function (r) { if (r) stash(r); return tx("readwrite", function (s) { s.delete(k); }); }).then(function () { emit(c); }); }
        };
      },
      onSnapshot: function (ok, bad) {
        function run() { tx("readonly", function (s) { return s.index("c").getAll(c); }).then(function (rs) { ok({ docs: rs.map(function (r) { return { id: r.id, data: function () { return r.d; } }; }), metadata: { fromCache: false } }); }, function (e) { if (bad) bad(e); }); }
        (subs[c] = subs[c] || []).push(run); run();
      }
    };
  }
  window.claude = { use: function (n) {
    if (n === "user") return { id: function () { return Promise.resolve("local"); } };
    if (n === "db") return { doc: function (p) { return { collection: function (x) { return coll(p + "/" + x); } }; } };
    return null;
  } };
  var BASE = "data/users/local/wallet/";
  window.WalletStore = {
    col: function (n) { return coll(BASE + n); },
    all: function (n) { return tx("readonly", function (s) { return s.index("c").getAll(BASE + n); }); },
    dump: function () { return tx("readonly", function (s) { return s.getAll(); }).then(function (docs) { var ls = {}; for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if (k.indexOf("wl-") === 0 && k !== "wl-pin" && k !== "wl-psalt" && k !== "wl-bio") ls[k] = localStorage.getItem(k); } return { app: "wallet", version: 1, at: new Date().toISOString(), docs: docs, ls: ls }; }); },
    restore: function (o) {
      if (!o || o.app !== "wallet" || !Array.isArray(o.docs)) return Promise.reject(new Error("bad"));
      return tx("readwrite", function (s) { s.clear(); o.docs.forEach(function (d) { s.put(d); }); }).then(function () { Object.keys(o.ls || {}).forEach(function (k) { localStorage.setItem(k, o.ls[k]); }); });
    }
  };
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) {}
})();
