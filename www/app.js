
(function () {
  var MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  var CUR = {
    PHP: { sym: "₱", name: "Peso", dec: 2 }, USD: { sym: "$", name: "US Dollar", dec: 2 }, AUD: { sym: "A$", name: "Australian Dollar", dec: 2 },
    JPY: { sym: "¥", name: "Japanese Yen", dec: 0 }, GBP: { sym: "£", name: "British Pound", dec: 2 }, IDR: { sym: "Rp", name: "Rupiah", dec: 0 }, SGD: { sym: "S$", name: "Singapore Dollar", dec: 2 }
  };
  var CODES = ["USD", "PHP", "AUD", "JPY", "GBP"];
  /* ECB reference rates per 1 EUR: [date, USD, JPY, GBP, AUD, PHP]. Month-end closes (Banque de France end-of-period table) plus the latest fixing. */
  var NOV = ["2026-11-17", 1.0989, 175.05, 0.83305, 1.6316, 69.974];
  var SEED = { "2026-07": ["2026-07-31", 1.1485, 184.03, 0.8557, 1.6365, 70.367], "2026-08": ["2026-08-31", 1.1596, 185.22, 0.8565, 1.6191, 72.355],
    "2026-09": ["2026-09-30", 1.1355, 178.27, 0.8546, 1.6297, 71.204], "2026-10": ["2026-10-30", 1.1172, 175.68, 0.8338, 1.5904, 71.143] };
  function fromEur(e) { return { USD: 1, JPY: e[2] / e[1], GBP: e[3] / e[1], AUD: e[4] / e[1], PHP: e[5] / e[1] }; }
  var DEF_RATES = Object.assign({ IDR: 16600, SGD: 1.3 }, fromEur(NOV));
  var CATTREE = {
    out: {
      "Groceries": ["7/11", "Robinsons", "Alfa mart", "Dali", "SM", "SnR"],
      "Food & Drinks": ["Breakfast", "Lunch", "Dinner", "Snacks", "Coffee"],
      "Transportation": ["Angkas", "Bus", "MRT", "Tricycle", "Gas", "Parking", "Toll"],
      "Life & Entertainment": ["Professional Development", "Health care and Doctors", "Wellness and Beauty", "Active sports and Fitness", "Culture, Sports and Events", "Life Events", "Hobbies", "Education and Development", "Book, Audio and Subscriptions", "Charity, Gifts", "Alcohol, Tobacco", "Lottery & Gambling"],
      "Communication & PC": ["Accessories", "Telephone and Mobile", "Internet", "Software, apps and games", "Postal Services"],
      "Financial Expense": ["Trading", "Credit card", "Taxes", "Insurance", "Loans and Interest", "Fines", "Advisory", "Charges and Fees", "Child support"],
      "Vehicle": ["Fuel", "Parking", "Vehicle maintenance", "Rentals", "Vehicle Insurance", "Leasing"],
      "Shopping": ["House Maintenance", "Home, Garden", "Pets, Animals", "Stationery, Tools", "Leisure time", "Gifts, Joy", "Kids", "Clothing", "Footwear", "Bags", "Cosmetic", "Digital", "Jewelry, Accessories", "Electronic, Accessories"],
      "Housing": ["Tools", "Water", "Property Insurance", "Maintenance and repairs", "HOA Dues", "Mortgage", "Rent", "Electricity", "Gas (Home)"],
      "Trading": ["Capital"]
    },
    "in": {
      "Salary": ["Allowance", "Salary", "Bonus", "Subsidy", "Commission"],
      "Prulife UK Commission": [],
      "TikTok Affiliate": [],
      "Cash back": [],
      "Interest and Dividends": [],
      "Lottery and Gambling": [],
      "Gifts": [],
      "Refund": ["Cash back", "Purchase", "Voucher", "Tax Refund"],
      "Investment": ["Vehicle and Chattels", "Savings", "Collections", "Interest", "Bond", "Stock", "P2P", "Fund"],
      "Property": []
    }
  };
  var CATS = { out: Object.keys(CATTREE.out), "in": Object.keys(CATTREE["in"]) };
  var $ = function (s) { return document.querySelector(s); };
  var pad = function (n) { return String(n).padStart(2, "0"); };
  var ds = function (y, m, d) { return y + "-" + pad(m + 1) + "-" + pad(d); };
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var now = new Date();
  var todayStr = ds(now.getFullYear(), now.getMonth(), now.getDate());
  var state = { y: now.getFullYear(), m: now.getMonth(), sel: todayStr, view: "cal", disp: "PHP", wallets: [], tx: [], col: null, wcol: null, loaded: false,
    rates: Object.assign({}, DEF_RATES), budget: { amount: 0, cur: "PHP", goal: 0 }, repInit: false, wSel: null, sortNew: true, lastWallet: null, rep: null };
  try { var sc = localStorage.getItem("wl-cur"); if (CODES.indexOf(sc) >= 0) state.disp = sc; } catch (e) {}
  state.locks = {}; state.rsrc = { s: "Default", d: "" };
  try { var rs = JSON.parse(localStorage.getItem("wl-rsrc")); if (rs && rs.s) state.rsrc = rs; } catch (e) {}
  state.budgets = []; try { var ub = JSON.parse(localStorage.getItem("wl-budgets")); if (Array.isArray(ub)) state.budgets = ub; } catch (e) {}
  state.dl = null; try { var dj = JSON.parse(localStorage.getItem("wl-dlayout")); if (dj && Array.isArray(dj.order)) state.dl = dj; } catch (e) {}
  state.rl = null; try { var rj = JSON.parse(localStorage.getItem("wl-rlayout")); if (rj && Array.isArray(rj.order)) state.rl = rj; } catch (e) {}
  state.cl = null; try { var cj = JSON.parse(localStorage.getItem("wl-clayout")); if (cj && Array.isArray(cj.order)) state.cl = cj; } catch (e) {}
  state.eom = {}; try { var eo = JSON.parse(localStorage.getItem("wl-eom")); if (eo && typeof eo === "object") state.eom = eo; } catch (e) {}
  try { var lo = JSON.parse(localStorage.getItem("wl-locks")); if (lo && typeof lo === "object") state.locks = lo; } catch (e) {}
  try {
    var ro = JSON.parse(localStorage.getItem("wl-rates"));
    if (ro) CODES.forEach(function (k) { var v = Number(ro[k]); if (isFinite(v) && v > 0) state.rates[k] = v; });
    var bo = JSON.parse(localStorage.getItem("wl-budget"));
    if (bo && CODES.indexOf(bo.cur) >= 0 && (Number(bo.amount) > 0 || Number(bo.goal) > 0)) state.budget = { amount: Number(bo.amount) || 0, cur: bo.cur, goal: Number(bo.goal) || 0 };
  } catch (e) {}

  function round2(n) { return Math.round(n * 100) / 100; }
  function rnd(n, cur) { return CUR[cur].dec === 0 ? Math.round(n) : round2(n); }
  function conv(n, from, to, date) { to = to || state.disp; var r = (date && state.locks[date.slice(0, 7)]) || state.rates; return from === to ? n : n * r[to] / r[from]; }
  function money(n, cur, signed) {
    var c = CUR[cur] || CUR.PHP, p = Math.pow(10, c.dec), r = Math.round(Math.abs(n) * p) / p;
    var s = r.toLocaleString(cur === "IDR" ? "id-ID" : undefined, { minimumFractionDigits: c.dec, maximumFractionDigits: c.dec });
    return (n < 0 && r > 0 ? "−" : signed && n > 0 && r > 0 ? "+" : "") + c.sym + s;
  }
  function D(n, signed) { return money(n, state.disp, signed); }
  function X(n, cur, date, signed) { return D(conv(n, cur, null, date), signed); }
  function cls(n) { return n > 0 ? "win" : n < 0 ? "loss" : ""; }
  function pct(x) { return x == null ? "–" : Math.round(x * 100) + "%"; }
  function compact(n) {
    var a = Math.abs(n), s;
    if (a >= 1e9) s = (a / 1e9).toFixed(1).replace(/\.0$/, "") + "B";
    else if (a >= 1e6) s = (a / 1e6).toFixed(1).replace(/\.0$/, "") + "M";
    else if (a >= 1e4) s = Math.round(a / 1e3) + "k";
    else if (a >= 1e3) s = (a / 1e3).toFixed(1).replace(/\.0$/, "") + "k";
    else s = a < 10 && a % 1 ? a.toFixed(1) : String(Math.round(a));
    return (n < 0 ? "−" : n > 0 ? "+" : "") + s;
  }
  function cellAmt(n) {
    var a = Math.abs(n);
    if (a >= 100000) return compact(n);
    var dec = CUR[state.disp].dec === 0 || a >= 100 ? 0 : 2;
    return (n < 0 ? "−" : n > 0 ? "+" : "") + a.toLocaleString(state.disp === "IDR" ? "id-ID" : undefined, { minimumFractionDigits: dec, maximumFractionDigits: dec });
  }
  function setStatus(msg, warn) { var el = $("#status"); el.textContent = msg; el.className = "status" + (warn ? " warn" : ""); }
  function parseD(s) { var p = s.split("-").map(Number); return new Date(p[0], p[1] - 1, p[2]); }
  function dstr(d) { return ds(d.getFullYear(), d.getMonth(), d.getDate()); }
  function fmtDate(s) { return parseD(s).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }); }
  function fmtShort(s) { return parseD(s).toLocaleDateString(undefined, { day: "numeric", month: "short" }); }
  function gid(p) { return p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

  function normNum(k, dec0) {
    var d = (k.match(/\./g) || []).length, c = (k.match(/,/g) || []).length;
    if (d && c) { var dp = k.lastIndexOf(".") > k.lastIndexOf(",") ? "." : ",", th = dp === "." ? "," : "."; return k.split(th).join("").replace(dp, "."); }
    if (c) return c > 1 || /^\d{1,3},\d{3}$/.test(k) ? k.replace(/,/g, "") : k.replace(",", ".");
    if (d > 1) return k.replace(/\./g, "");
    if (d === 1 && dec0 && /^\d{1,3}\.\d{3}$/.test(k)) return k.replace(".", "");
    return k;
  }
  function evalExpr(str, cur) {
    var t = String(str == null ? "" : str).replace(/[×xX]/g, "*").replace(/÷/g, "/").replace(/[−–]/g, "-").replace(/\s/g, "").replace(/\d[\d.,]*/g, function (k) { return normNum(k, !!(cur && CUR[cur] && CUR[cur].dec === 0)); });
    if (!t || /[^0-9.+\-*\/()]/.test(t)) return NaN;
    var i = 0;
    function peek() { return t.charAt(i); }
    function expr() { var v = term(); while (peek() === "+" || peek() === "-") { var o = t.charAt(i++); var r = term(); v = o === "+" ? v + r : v - r; } return v; }
    function term() { var v = factor(); while (peek() === "*" || peek() === "/") { var o = t.charAt(i++); var r = factor(); v = o === "*" ? v * r : v / r; } return v; }
    function factor() {
      var c = peek();
      if (c === "+") { i++; return factor(); }
      if (c === "-") { i++; return -factor(); }
      if (c === "(") { i++; var v = expr(); if (peek() !== ")") return NaN; i++; return v; }
      var m = /^\d*\.?\d+|^\d+\.?/.exec(t.slice(i));
      if (!m) return NaN;
      i += m[0].length; return parseFloat(m[0]);
    }
    var res = expr();
    return i === t.length && isFinite(res) ? res : NaN;
  }

  /* ===== Data ===== */
  function isCredit(w) { return !!w && (w.type === "Credit card" || w.type === "Card"); }
  var wmap = {};
  function validT(t) { return t && typeof t.date === "string" && typeof t.amount === "number" && isFinite(t.amount) && (t.kind === "in" || t.kind === "out" || t.kind === "xfer") && wmap[t.wallet] && (t.kind !== "xfer" || wmap[t.to]); }
  var catMap = {};
  function buildMap() { wmap = {}; state.wallets.forEach(function (w) { wmap[w.id] = w; }); var u = {}; state.tx.forEach(function (t) { if (t && t.cat) u[t.cat] = 1; }); catMap = {};
    /* every category keeps its own colour: your expense list first, then older names found in transactions, then income */
    var seq = CATS.out.slice(); Object.keys(u).sort().forEach(function (k) { if (seq.indexOf(k) < 0 && CATS["in"].indexOf(k) < 0) seq.push(k); });
    CATS["in"].forEach(function (k) { if (seq.indexOf(k) < 0) seq.push(k); });
    seq.forEach(function (k, i) { catMap[k] = i % 20 + 1; }); }
  function balances(upto) {
    var b = {};
    state.wallets.forEach(function (w) { b[w.id] = Number(w.opening) || 0; });
    state.tx.forEach(function (t) {
      if (!validT(t) || (upto && t.date > upto)) return;
      if (t.kind === "in") b[t.wallet] += t.amount;
      else if (t.kind === "out") b[t.wallet] -= t.amount;
      else { b[t.wallet] -= t.amount; b[t.to] += Number(t.toAmount) || 0; }
    });
    return b;
  }
  function netWorth(b) { return state.wallets.reduce(function (a, w) { return a + conv(b[w.id], w.cur); }, 0); }
  function byDay() {
    var map = {};
    state.tx.forEach(function (t) {
      if (!validT(t)) return;
      var d = map[t.date] || (map[t.date] = { inc: 0, exp: 0, net: 0, n: 0, list: [] });
      var a = conv(t.amount, wmap[t.wallet].cur, null, t.date);
      if (t.kind === "in") d.inc += a; else if (t.kind === "out") d.exp += a;
      d.net = d.inc - d.exp; d.n++; d.list.push(t);
    });
    return map;
  }
  function saveLocal() {
    try { localStorage.setItem("wl-wallets", JSON.stringify(state.wallets)); localStorage.setItem("wl-tx", JSON.stringify(state.tx)); localStorage.setItem("wl-goals", JSON.stringify(state.goals)); localStorage.setItem("wl-recs", JSON.stringify(state.recs)); } catch (e) {}
  }
  function failMsg(e) { setStatus("Could not save that (" + ((e && e.code) || "error") + "). Try again.", true); return false; }
  function put(kind, obj) {
    var id = obj.id || gid(kind), o = Object.assign({}, obj); delete o.id;
    var c = colOf(kind);
    if (c) return c.doc(id).set(o).then(function () { return id; }).catch(function (e) { failMsg(e); return null; });
    o.id = id; state[keyOf(kind)].push(o); saveLocal(); render();
    return Promise.resolve(id);
  }
  function patch(kind, id, f) {
    var c = colOf(kind);
    if (c) return Promise.resolve().then(function () { return c.doc(id).update(f); }).then(function () { return true; }).catch(failMsg);
    var key = keyOf(kind);
    state[key] = state[key].map(function (x) { return x.id === id ? Object.assign({}, x, f) : x; });
    saveLocal(); render(); return Promise.resolve(true);
  }
  function drop(kind, id) {
    var c = colOf(kind);
    if (c) return c.doc(id).delete().catch(failMsg);
    var key = keyOf(kind);
    state[key] = state[key].filter(function (x) { return x.id !== id; });
    saveLocal(); render(); return Promise.resolve();
  }
  function dropMany(kind, ids) {
    var c = colOf(kind), set = {}; ids.forEach(function (i) { set[i] = 1; });
    if (c) return Promise.all(ids.map(function (id) { return c.doc(id).delete().then(function () { return true; }).catch(function () { return false; }); })).then(function (r) {
      var bad = r.filter(function (x) { return !x; }).length; if (bad) failMsg(); return ids.length - bad;
    });
    var key = keyOf(kind); state[key] = state[key].filter(function (x) { return !set[x.id]; });
    saveLocal(); render(); return Promise.resolve(ids.length);
  }
  /* bulk select + delete, shared by the Recent activity list and the account panel */
  function bulkNew() { return { mode: false, pick: {}, ids: [], arm: false, tm: null }; }
  function bulkN(B) { return B.ids.filter(function (id) { return B.pick[id]; }).length; }
  function renderBulk(B, bar, btn) {
    btn.setAttribute("aria-pressed", String(B.mode)); btn.textContent = B.mode ? "Done" : "Select";
    bar.hidden = !B.mode; if (!B.mode) return;
    var n = bulkN(B), all = B.ids.length > 0 && n === B.ids.length;
    bar.innerHTML = '<span class="bcount" aria-live="polite">' + n + " selected</span>" +
      '<button type="button" class="btn sm" data-ball' + (B.ids.length ? "" : " disabled") + ">" + (all ? "Clear" : "Select all " + B.ids.length) + "</button>" +
      '<button type="button" class="btn sm bdel' + (B.arm ? " arm" : "") + '" data-bdel' + (n ? "" : " disabled") + ">" + (B.arm ? "Sure? Delete " + n : "Delete" + (n ? " " + n : "")) + "</button>";
  }
  function bulkRowToggle(B, e, rowSel, attr, bar, btn) {
    var row = e.target.closest(rowSel); if (!row) return false;
    var id = row.getAttribute(attr), cb = row.querySelector("input[data-pickbox]"), on = e.target === cb ? cb.checked : !B.pick[id];
    if (on) B.pick[id] = true; else delete B.pick[id];
    if (cb) cb.checked = on; row.classList.toggle("sel", on);
    B.arm = false; clearTimeout(B.tm); renderBulk(B, bar, btn); return true;
  }
  function wireBulk(B, bar, btn, rerender) {
    btn.addEventListener("click", function () { B.mode = !B.mode; B.pick = {}; B.arm = false; clearTimeout(B.tm); rerender(); });
    bar.addEventListener("click", function (e) {
      if (e.target.closest("[data-ball]")) {
        var all = B.ids.length > 0 && bulkN(B) === B.ids.length; B.pick = {}; if (!all) B.ids.forEach(function (id) { B.pick[id] = true; });
        B.arm = false; clearTimeout(B.tm); rerender(); return;
      }
      if (e.target.closest("[data-bdel]")) {
        var ids = B.ids.filter(function (id) { return B.pick[id]; }); if (!ids.length) return;
        if (!B.arm) { B.arm = true; clearTimeout(B.tm); B.tm = setTimeout(function () { B.arm = false; renderBulk(B, bar, btn); }, 4000); renderBulk(B, bar, btn); return; }
        clearTimeout(B.tm); B.arm = false;
        dropMany("t", ids).then(function (n) { B.pick = {}; rerender(); setStatus("Deleted " + n + (n === 1 ? " transaction." : " transactions.")); });
      }
    });
  }
  var actBulk = bulkNew(), histBulk = bulkNew();

  /* ===== Header, stats, budget ===== */
  function monthPrefix() { return state.y + "-" + pad(state.m + 1) + "-"; }
  function renderHeader(days) {
    var nw = netWorth(balances()), mp = monthPrefix(), net = 0;
    var R = fRange(); Object.keys(days).forEach(function (k) { if (k >= R.from && k <= R.to) net += days[k].net; });
    var td = days[todayStr];
    $("#pills").innerHTML =
      '<span class="pill">Net worth <b>' + D(nw) + '</b></span>' + owedPill() +
      '<span class="pill">' + esc(fShort(R)) + ' <b class="' + cls(net) + '">' + D(net, true) + '</b></span>' +
      '<span class="pill">Today <b class="' + (td ? cls(td.net) : "") + '">' + (td ? D(td.net, true) : "–") + '</b></span>' + (state.locks[mp.slice(0, 7)] && !state.locks[mp.slice(0, 7)]._u ? '<span class="pill">Rates <b>locked</b></span>' : "");
  }
  function owedPill() {
    var b = balances(), t = 0, n = 0;
    state.wallets.forEach(function (w) { if (isCredit(w)) { n++; t += conv(Math.max(0, -(b[w.id] || 0)), w.cur); } });
    return n ? '<span class="pill">Owed <b class="' + (t > 0 ? "loss" : "") + '">' + D(t) + "</b></span>" : "";
  }
  function monthTotals(days) {
    var mp = monthPrefix(), r = { inc: 0, exp: 0, cats: {}, n: 0, big: null, spendDays: 0 };
    state.tx.forEach(function (t) {
      if (!validT(t) || t.date.indexOf(mp) !== 0) return;
      r.n++;
      var a = conv(t.amount, wmap[t.wallet].cur, null, t.date);
      if (t.kind === "in") r.inc += a;
      else if (t.kind === "out") {
        r.exp += a; var k = t.cat || "Uncategorized"; r.cats[k] = (r.cats[k] || 0) + a;
        if (!r.big || a > r.big.a) r.big = { a: a, cat: k, date: t.date };
      }
    });
    Object.keys(days).forEach(function (k) { if (k.indexOf(mp) === 0 && days[k].exp > 0) r.spendDays++; });
    var top = null; Object.keys(r.cats).forEach(function (k) { if (!top || r.cats[k] > r.cats[top]) top = k; });
    r.top = top; r.net = r.inc - r.exp;
    return r;
  }
  var bOpen = false;
  function fillBudget() {
    var b = state.budget, f = function (n) { return n > 0 ? round2(conv(n, b.cur)) : ""; };
    $("#bAmt").value = f(b.amount); $("#bGoal").value = f(b.goal);
    $("label[for=bAmt]").textContent = "Budget per month (" + state.disp + ")"; $("label[for=bGoal]").textContent = "Monthly savings goal, optional (" + state.disp + ")";
  }
  function renderBudget(days) {
    var R = fRange(), mo = fMonths(R), budget = state.budget.amount > 0 ? conv(state.budget.amount, state.budget.cur) * mo : 0, r = { exp: spend(R.from, R.to).total }, html;
    if (budget > 0) {
      var p = r.exp / budget * 100, over = r.exp > budget, left = budget - r.exp;
      var isNow = mo === 1 && inRange(todayStr, R), dleft = isNow ? new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - now.getDate() + 1 : 0;
      html = '<div class="meter"><div class="mtop"><span class="mname">' + esc(fShort(R)) + (mo > 1 ? " (" + mo + " months)" : "") + '</span><span class="mval num">' + D(r.exp) + ' of ' + D(budget) + '</span></div>' +
        '<div class="bar ' + (over ? "over" : "") + '" role="progressbar" aria-label="Budget used" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + Math.min(100, Math.round(p)) + '"><span style="width:' + Math.max(0, Math.min(100, p)).toFixed(1) + '%"></span></div>' +
        '<div class="msub' + (over || p >= 85 ? " warn" : "") + '">' + (over ? D(-left) + " over budget" : Math.round(p) + "% used · " + D(left) + " left" + (dleft > 0 ? " · about " + D(left / dleft) + " a day" : "")) + '</div></div>';
    } else html = '<p class="empty">Set a monthly spending budget to see how much you have left and a daily allowance.</p>';
    $("#bMeter").innerHTML = html;
    $("#bEdit").textContent = bOpen ? "Close" : budget > 0 ? "Edit budget" : "Set budget";
    $("#bEdit").setAttribute("aria-expanded", String(bOpen)); $("#bForm").hidden = !bOpen;
  }
  $("#bEdit").addEventListener("click", function () {
    bOpen = !bOpen;
    if (bOpen) { fillBudget(); $("#bErr").textContent = ""; }
    render(); if (bOpen) $("#bAmt").focus();
  });
  $("#bCancel").addEventListener("click", function () { bOpen = false; render(); });
  $("#bForm").addEventListener("submit", function (e) {
    e.preventDefault();
    var t = $("#bAmt").value.trim(), bc = state.disp, v = t === "" ? 0 : evalExpr(t, bc), gt = $("#bGoal").value.trim(), gv = gt === "" ? 0 : evalExpr(gt, bc);
    if (!isFinite(v) || v < 0 || !isFinite(gv) || gv < 0) { $("#bErr").textContent = "Enter a number above 0, or leave it blank for no budget."; return; }
    state.budget = { amount: round2(v), cur: bc, goal: round2(gv) };
    try { localStorage.setItem("wl-budget", JSON.stringify(state.budget)); } catch (x) {} syncPrefs();
    bOpen = false; render();
  });

  /* ===== Calendar ===== */
  function renderGrid(days) {
    var lead = (new Date(state.y, state.m, 1).getDay() + 6) % 7, dim = new Date(state.y, state.m + 1, 0).getDate(), weeks = Math.ceil((lead + dim) / 7);
    var prefix = monthPrefix(), maxAbs = 0, html = "", FR = fRange();
    for (var d = 1; d <= dim; d++) { var r0 = days[prefix + pad(d)]; if (r0) maxAbs = Math.max(maxAbs, Math.abs(r0.net)); }
    for (var w = 0; w < weeks; w++) {
      var wnet = 0, wn = 0;
      for (var c = 0; c < 7; c++) {
        var day = w * 7 + c - lead + 1;
        if (day < 1 || day > dim) { html += '<div class="cell blank" aria-hidden="true"></div>'; continue; }
        var key = prefix + pad(day), rec = days[key];
        var classes = "cell" + (key === todayStr ? " today" : "") + (key === state.sel ? " sel" : "") + (inRange(key, FR) ? "" : " outr"), style = "", label = day + " " + MONTHS[state.m], body = '<span class="d">' + day + '</span>';
        if (rec) {
          wnet += rec.net; wn += rec.n;
          classes += " has " + (rec.net > 0 ? "up" : rec.net < 0 ? "down" : "");
          style = ' style="--i:' + (maxAbs ? (0.25 + 0.75 * Math.abs(rec.net) / maxAbs).toFixed(2) : 0.25) + '"';
          body += '<span><span class="p ' + cls(rec.net) + '" title="' + esc(D(rec.net, true)) + '">' + cellAmt(rec.net) + '</span><span class="n">' + rec.n + (rec.n === 1 ? " item" : " items") + '</span></span>';
          label += ", net " + D(rec.net, true) + ", " + rec.n + (rec.n === 1 ? " item" : " items");
        } else label += ", nothing logged";
        html += '<button type="button" class="' + classes + '"' + style + ' data-date="' + key + '" aria-label="' + esc(label) + '" aria-pressed="' + (key === state.sel) + '">' + body + '</button>';
      }
      if (w >= weeks) { html += '<div class="cell blank" aria-hidden="true"></div>'; continue; }
      html += '<div class="cell wk"><span class="wl">Wk ' + (w + 1) + '</span>' + (wn ? '<span class="p ' + cls(wnet) + '">' + cellAmt(wnet) + '</span>' : '<span class="n">–</span>') + '</div>';
    }
    $("#grid").innerHTML = html;
  }
  var tEditId = null, tEditOrig = null;
  function txTitle(t) {
    if (t.kind === "xfer") return "Transfer · " + esc(wmap[t.wallet].name) + " → " + esc(wmap[t.to].name);
    return esc(t.cat || (t.kind === "in" ? "Income" : "Expense")) + (t.sub ? ' <span class="subt">\u203a ' + esc(t.sub) + "</span>" : "");
  }
  function extra(t) {
    var p = [];
    if (t.payee) p.push(esc(t.payee));
    if (t.pay && t.pay !== "Cash") p.push(esc(t.pay));
    if (t.labels) p.push(String(t.labels).split(",").map(function (l) { return l.trim(); }).filter(Boolean).map(function (l) { return "#" + esc(l); }).join(" "));
    return p.length ? " · " + p.join(" · ") : "";
  }
  function renderDay(days) {
    var p = state.sel.split("-").map(Number);
    $("#dayTitle").textContent = new Date(p[0], p[1] - 1, p[2]).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    var rec = days[state.sel], list = rec ? rec.list.slice().sort(function (a, b) { return (a.createdAt || 0) - (b.createdAt || 0); }) : [];
    $("#dayCount").textContent = list.length ? list.length + (list.length === 1 ? " item" : " items") + " · net" : "Nothing logged";
    var net = $("#dayNet"); net.textContent = rec ? D(rec.net, true) : ""; net.className = "num " + (rec ? cls(rec.net) : "");
    var html = "";
    list.forEach(function (t) {
      var w = wmap[t.wallet], amt, ac = "";
      if (t.kind === "xfer") {
        var w2 = wmap[t.to];
        amt = X(t.amount, w.cur, t.date);
      } else { amt = X(t.kind === "in" ? t.amount : -t.amount, w.cur, t.date, true); ac = t.kind === "in" ? "win" : "loss"; }
      var sub = t.kind === "xfer" ? "" : esc(w.name) + extra(t);
      if (t.note) sub += (sub ? " · " : "") + esc(t.note);
      html += '<li' + (t.id === tEditId ? ' class="editing"' : '') + '><div><div class="sym">' + txTitle(t) + '</div>' + (sub ? '<div class="note">' + sub + '</div>' : "") + '</div>' +
        '<span class="amt ' + ac + '">' + amt + '</span><span class="acts"><button type="button" class="ed" data-edit="' + esc(t.id) + '" aria-label="Edit transaction">Edit</button>' +
        '<button type="button" class="del" data-del="' + esc(t.id) + '" aria-label="Delete transaction">Delete</button></span></li>';
    });
    $("#txList").innerHTML = html || '<li class="empty">Pick a day on the calendar, then log what came in or went out below.</li>';
    var has = state.wallets.length > 0;
    $("#form").hidden = !has; $("#noWallet").hidden = has;
    fillWalletSelects(); updateForm();
  }
  function fillWalletSelects() {
    var opts = state.wallets.map(function (w) { return '<option value="' + esc(w.id) + '">' + esc(w.name) + " (" + w.cur + ")</option>"; }).join("");
    ["#wSel", "#toSel"].forEach(function (s) {
      var el = $(s), prev = el.value; el.innerHTML = opts;
      if (prev && wmap[prev]) el.value = prev;
      else if (s === "#wSel" && state.lastWallet && wmap[state.lastWallet]) el.value = state.lastWallet;
    });
    var f = $("#wSel").value, t = $("#toSel");
    if (t.value === f && state.wallets.length > 1) { var alt = state.wallets.filter(function (w) { return w.id !== f; })[0]; if (alt) t.value = alt.id; }
  }
  function curKind() { return $("#kXfer").checked ? "xfer" : $("#kIn").checked ? "in" : "out"; }
  function updateForm() {
    var k = curKind(), w = wmap[$("#wSel").value], to = wmap[$("#toSel").value];
    $("#xferRow").hidden = k !== "xfer"; $("#catBox").hidden = k === "xfer";
    $("#wLbl").textContent = k === "xfer" ? "From wallet" : "Wallet";
    $("#amtLbl").textContent = "Amount" + (w ? " (" + w.cur + ")" : "");
    var diff = k === "xfer" && w && to && w.cur !== to.cur;
    $("#amt2Box").hidden = !diff;
    if (diff) {
      $("#amt2Lbl").textContent = "Amount received (" + to.cur + ")";
      var a = evalExpr($("#amt").value, w.cur);
      $("#amt2").placeholder = isFinite(a) && a > 0 ? "about " + rnd(conv(a, w.cur, to.cur), to.cur) : "auto";
    }
    $("#xferHint").textContent = k === "xfer" && w && to && w.id === to.id ? "Pick two different wallets." : diff ? "Leave the received amount blank to use the current rate." : "";
    refreshSub("#cat", "#subList", k); var dl = $("#catList"), want = k === "in" ? CATS["in"] : CATS.out.concat(state.budgets.map(function (u) { return u.name; }).filter(function (n) { return n && CATS.out.indexOf(n) < 0; })), sig = k + "|" + want.join();
    if (dl.getAttribute("data-k") !== sig) { dl.setAttribute("data-k", sig); dl.innerHTML = want.map(function (c) { return '<option value="' + esc(c) + '">'; }).join(""); }
  }
  ["#amt", "#wSel", "#toSel"].forEach(function (s) { $(s).addEventListener("input", updateForm); $(s).addEventListener("change", updateForm); });
  document.querySelectorAll('input[name="kind"]').forEach(function (r) { r.addEventListener("change", updateForm); });
  $("#wSel").addEventListener("change", function () { state.lastWallet = this.value; });

  function startTxEdit(id) {
    var t = null; state.tx.forEach(function (x) { if (x.id === id) t = x; });
    if (!t || !validT(t)) return;
    tEditId = id;
    $("#kOut").checked = t.kind === "out"; $("#kIn").checked = t.kind === "in"; $("#kXfer").checked = t.kind === "xfer";
    fillWalletSelects(); $("#wSel").value = t.wallet; if (t.kind === "xfer") $("#toSel").value = t.to;
    $("#amt").value = t.amount; $("#amt2").value = t.kind === "xfer" && wmap[t.to].cur !== wmap[t.wallet].cur ? t.toAmount : "";
    $("#cat").value = t.cat || ""; $("#sub").value = t.sub || ""; $("#note").value = t.note || ""; $("#tDate").value = t.date; $("#tDateRow").hidden = false;
    $("#add").textContent = "Save changes"; $("#tCancel").hidden = false; $("#tEditNote").hidden = false; $("#err").textContent = "";
    render(); $("#form").scrollIntoView({ block: "nearest" }); $("#amt").focus();
  }
  function cancelTxEdit() {
    tEditId = null;
    $("#add").textContent = "Add transaction"; $("#tCancel").hidden = true; $("#tDateRow").hidden = true; $("#tEditNote").hidden = true;
    $("#kOut").checked = true; $("#amt").value = ""; $("#amt2").value = ""; $("#cat").value = ""; $("#sub").value = ""; $("#note").value = ""; $("#err").textContent = "";
    render();
  }
  $("#tCancel").addEventListener("click", cancelTxEdit);
  var armTimer = null;
  $("#txList").addEventListener("click", function (e) {
    var eb = e.target.closest("[data-edit]");
    if (eb) { startTxEdit(eb.getAttribute("data-edit")); return; }
    var b = e.target.closest("[data-del]"); if (!b) return;
    if (!b.classList.contains("arm")) {
      b.classList.add("arm"); b.textContent = "Sure?"; clearTimeout(armTimer);
      armTimer = setTimeout(function () { b.classList.remove("arm"); b.textContent = "Delete"; }, 3000); return;
    }
    drop("t", b.getAttribute("data-del"));
  });
  $("#form").addEventListener("submit", function (e) {
    e.preventDefault();
    var err = $("#err"), k = curKind(), w = wmap[$("#wSel").value], raw = evalExpr($("#amt").value, w && w.cur);
    if (!w) { err.textContent = "Pick a wallet."; return; }
    if (!isFinite(raw) || raw === 0) { err.textContent = "Enter the amount as a number or a sum like 120+45.5."; $("#amt").focus(); return; }
    if (raw < 0) { raw = -raw; if (k === "in") $("#kOut").checked = true, k = "out"; else if (k === "out") $("#kIn").checked = true, k = "in"; }
    var t = { date: tEditId ? $("#tDate").value : state.sel, kind: k, amount: rnd(raw, w.cur), wallet: w.id, cat: "", sub: "", note: $("#note").value.trim(), to: "", toAmount: 0, createdAt: Date.now() };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(t.date)) { err.textContent = "Pick a date."; return; }
    if (k === "xfer") {
      var to = wmap[$("#toSel").value];
      if (!to || to.id === w.id) { err.textContent = "Pick two different wallets for a transfer."; return; }
      t.to = to.id;
      if (to.cur === w.cur) t.toAmount = t.amount;
      else {
        var r2 = $("#amt2").value.trim() === "" ? NaN : evalExpr($("#amt2").value, to.cur);
        t.toAmount = isFinite(r2) && r2 > 0 ? rnd(r2, to.cur) : rnd(conv(raw, w.cur, to.cur), to.cur);
      }
    } else { t.cat = $("#cat").value.trim() || (k === "in" ? "Income" : "Other"); t.sub = $("#sub").value.trim(); }
    err.textContent = "";
    $("#add").disabled = true;
    state.lastWallet = w.id;
    if (tEditId) {
      var id = tEditId, fields = Object.assign({}, t); delete fields.createdAt;
      patch("t", id, fields).then(function (ok) {
        $("#add").disabled = false; if (ok === false) return;
        var q = t.date.split("-"); state.sel = t.date; state.y = +q[0]; state.m = +q[1] - 1; cancelTxEdit();
      });
      return;
    }
    put("t", t).then(function () { $("#add").disabled = false; $("#amt").value = ""; $("#amt2").value = ""; $("#note").value = ""; $("#cat").value = ""; $("#sub").value = ""; updateForm(); $("#amt").focus(); });
  });

  /* ===== Subcategories: the list follows the chosen category ===== */
  function subsOf(kind, cat) {
    var tr = CATTREE[kind === "in" ? "in" : "out"], c = String(cat || "").trim().toLowerCase(), k;
    for (k in tr) if (k.toLowerCase() === c) return tr[k];
    return [];
  }
  function refreshSub(catSel, listSel, kind) {
    var el = $(listSel); if (!el) return;
    var arr = subsOf(kind, $(catSel).value), sig = kind + "|" + $(catSel).value.trim().toLowerCase();
    if (el.getAttribute("data-s") === sig) return;
    el.setAttribute("data-s", sig);
    el.innerHTML = arr.map(function (c) { return '<option value="' + esc(c) + '">'; }).join("");
  }
  function rKindNow() { return rType === "repeat" && $("#rKind").value === "in" ? "in" : "out"; }
  [["#cat", "#subList", function () { return curKind(); }], ["#aCat", "#aSubList", function () { return aKind(); }], ["#eCat", "#eSubList", function () { return eKind(); }], ["#rCat", "#rSubList", rKindNow]].forEach(function (x) {
    ["input", "change"].forEach(function (ev) { $(x[0]).addEventListener(ev, function () { refreshSub(x[0], x[1], x[2]()); }); });
  });
  $("#rKind").addEventListener("change", function () { refreshSub("#rCat", "#rSubList", rKindNow()); });
  /* Browsers filter a datalist by the text already in the box, so a filled field only offers its own value.
     On focus the current value moves into the placeholder so the whole list shows; it comes back if nothing is chosen. */
  ["#cat", "#sub", "#eCat", "#eSub", "#aCat", "#aSub", "#rCat", "#rSub"].forEach(function (sel) {
    var el = $(sel), keep = "", ph = el.placeholder;
    function restore() {
      if (keep && el.value === "") { el.value = keep; el.dispatchEvent(new Event("input", { bubbles: true })); }
      keep = ""; el.placeholder = ph;
    }
    el._restore = restore;
    el.addEventListener("focus", function () {
      if (el.value === "") return;
      keep = el.value; el.placeholder = keep; el.value = "";
    });
    el.addEventListener("blur", restore);
  });
  document.addEventListener("submit", function () { var a = document.activeElement; if (a && a._restore) a._restore(); }, true);

  /* ===== Wallets ===== */
  var wEditId = null;
  function lineChart(host, pts, label) {
    if (pts.length < 2) { host.innerHTML = '<p class="empty">The line appears once there is activity on two or more days.</p>'; return; }
    var W = Math.max(280, host.clientWidth || 600), H = 220, L = 56, R = 14, T = 12, B = 26, min = Infinity, max = -Infinity;
    pts.forEach(function (p) { if (p.v < min) min = p.v; if (p.v > max) max = p.v; });
    if (label.indexOf("Cumulative") === 0) { if (max < 0) max = 0; if (min > 0) min = 0; }
    var pd = (max - min) * 0.08 || 1; min -= pd; max += pd;
    var xs = function (i) { return L + i * (W - L - R) / (pts.length - 1); }, ys = function (v) { return T + (max - v) * (H - T - B) / (max - min); };
    var line = pts.map(function (p, i) { return xs(i).toFixed(1) + "," + ys(p.v).toFixed(1); }).join(" "), g = "", ticks = [max, (max + min) / 2, min];
    ticks.forEach(function (v) { g += '<line class="grid" x1="' + L + '" x2="' + (W - R) + '" y1="' + ys(v).toFixed(1) + '" y2="' + ys(v).toFixed(1) + '"/><text x="' + (L - 6) + '" y="' + (ys(v) + 4).toFixed(1) + '" text-anchor="end">' + esc(compact(v).replace(/^\+/, "")) + "</text>"; });
    if (min < 0 && max > 0) g += '<line class="zero" x1="' + L + '" x2="' + (W - R) + '" y1="' + ys(0).toFixed(1) + '" y2="' + ys(0).toFixed(1) + '"/>';
    var dots = ""; if (pts.length <= 40) pts.forEach(function (p, i) { dots += '<circle class="dot" cx="' + xs(i).toFixed(1) + '" cy="' + ys(p.v).toFixed(1) + '" r="3"/>'; });
    var xl = '<text x="' + L + '" y="' + (H - 6) + '" text-anchor="start">' + esc(fmtShort(pts[0].d)) + '</text><text x="' + (W - R) + '" y="' + (H - 6) + '" text-anchor="end">' + esc(fmtShort(pts[pts.length - 1].d)) + "</text>";
    host.innerHTML = '<svg class="chart" viewBox="0 0 ' + W + " " + H + '" width="' + W + '" height="' + H + '" role="img" aria-label="' + esc(label + ", ending at " + D(pts[pts.length - 1].v)) + '">' + g + '<polyline class="ln" points="' + line + '"/>' + dots + xl + "</svg>";
  }
  function netWorthSeries() {
    var dates = {}; state.tx.forEach(function (t) { if (validT(t)) dates[t.date] = 1; });
    var ds2 = Object.keys(dates).sort(), out = [];
    ds2.forEach(function (d) { out.push({ d: d, v: round2(netWorth(balances(d))) }); });
    return out;
  }
  function ensureOpt(sel, v) { var el = $(sel); if (!el.querySelector('option[value="' + v + '"]')) el.insertAdjacentHTML("beforeend", '<option value="' + esc(v) + '">' + esc(v) + " (retired)</option>"); }
  function startWalletEdit(id) {
    var w = wmap[id]; if (!w) return;
    wEditId = id; $("#wName").value = w.name; $("#wType").value = isCredit(w) ? "Credit card" : w.type; ensureOpt("#wCur", w.cur); $("#wCur").value = w.cur; $("#wOpen").value = isCredit(w) ? (w.opening ? -w.opening : "") : (w.opening || ""); $("#wLast4").value = w.last4 || ""; $("#wExp").value = w.exp || "";
    $("#wLimit").value = w.limit || ""; $("#wStmt").value = w.stmt || ""; $("#wDue").value = w.due || ""; updateWType(); $("#wFormTitle").textContent = "Edit account"; $("#wAdd").textContent = "Save changes"; $("#wDel").hidden = false; $("#wErr").textContent = "";
  }
  function cancelWalletEdit() {
    wEditId = null; $("#wFormTitle").textContent = "Add account"; $("#wAdd").textContent = "Add account"; $("#wDel").hidden = true;
    $("#wName").value = ""; $("#wOpen").value = ""; $("#wLast4").value = ""; $("#wExp").value = ""; $("#wErr").textContent = ""; $("#wDel").textContent = "Delete account"; $("#wDel").classList.remove("arm");
    $("#wType").value = "Bank"; $("#wLimit").value = ""; $("#wStmt").value = ""; $("#wDue").value = ""; updateWType(); $("#wCur").value = state.disp in CUR ? state.disp : "PHP"; $("#wAdd").disabled = false;
  }
  /* popup for adding and editing accounts */
  var acctDlg = $("#acctDlg"), dlgId = null;
  function openAcctDlg(id, tab) {
    var ex = !!(id && wmap[id]);
    dlgId = ex ? id : null;
    if (ex) startWalletEdit(id); else cancelWalletEdit();
    $("#aTabs").hidden = !ex;
    setAcctTab(ex ? (tab || "tx") : "add");
    histKind = "all"; histLimit = HIST_STEP; histBulk.mode = false; histBulk.pick = {}; histBulk.arm = false;
    if (!acctDlg.open) acctDlg.showModal();
    renderAcctHist();
    if (ex && (tab || "tx") === "tx") $("#aAmt").focus(); else $("#wName").focus();
  }
  function setAcctTab(tab) {
    var add = tab === "add", tx = tab === "tx" && !!wmap[dlgId];
    if (add) cancelWalletEdit();
    else if (dlgId && wmap[dlgId]) { if (tab === "acct") startWalletEdit(dlgId); else wEditId = dlgId; }
    $("#aTxForm").hidden = !tx; $("#wForm").hidden = tx;
    $("#aTabTx").setAttribute("aria-pressed", String(tx)); $("#aTabAcct").setAttribute("aria-pressed", String(!tx && !add));
    $("#wFormTitle").textContent = tx ? "New transaction" : add ? "Add account" : "Account maintenance";
    if (tx) resetAcctTx();
  }
  $("#aTabTx").addEventListener("click", function () { setAcctTab("tx"); $("#aAmt").focus(); });
  $("#aTabAcct").addEventListener("click", function () { setAcctTab("acct"); $("#wName").focus(); });
  $("#aCancel").addEventListener("click", function () { closeAcctDlg(); });
  function aKind() { return $("#aXfer").checked ? "xfer" : $("#aIn").checked ? "in" : "out"; }
  function resetAcctTx() {
    var w = wmap[wEditId]; if (!w) return;
    var bal0 = balances()[w.id] || 0;
    $("#aCtx").innerHTML = esc(w.name) + (isCredit(w) ? (bal0 < 0 ? " · owed <b>" + money(-bal0, w.cur) + "</b>" : " · balance <b>" + money(bal0, w.cur) + "</b>") + (w.limit > 0 ? " · limit <b>" + money(w.limit, w.cur) + "</b>" : "") : " · balance <b>" + money(bal0, w.cur) + "</b>");
    document.querySelector('label[for="aXfer"]').textContent = isCredit(w) ? "Pay card" : "Transfer";
    $("#aOut").checked = true; $("#aAmt").value = ""; $("#aAmt2").value = ""; $("#aCat").value = ""; $("#aSub").value = ""; $("#aDate").value = todayStr;
    $("#aPay").value = isCredit(w) ? "Credit card" : "Cash"; $("#aPayee").value = ""; $("#aLabels").value = ""; $("#aNote").value = ""; $("#aErr").textContent = "";
    $("#aTo").innerHTML = state.wallets.filter(function (x) { return x.id !== w.id && (!isCredit(w) || !isCredit(x)); }).map(function (x) { return '<option value="' + esc(x.id) + '">' + esc(x.name) + " (" + x.cur + ")</option>"; }).join("");
    updateAcctTx();
  }
  function updateAcctTx() {
    var w = wmap[wEditId]; if (!w) return;
    var k = aKind(), to = wmap[$("#aTo").value], diff = k === "xfer" && to && to.cur !== w.cur;
    $("#aXferRow").hidden = k !== "xfer"; $("#aCatBox").hidden = k === "xfer"; $("#aPayeeBox").hidden = k === "xfer";
    $("#aAmt2Box").hidden = !diff;
    $("#aAmtL").textContent = (isCredit(w) && k === "xfer" ? "Payment amount (" : "Amount (") + w.cur + ")";
    document.querySelector('label[for="aTo"]').textContent = isCredit(w) ? "Pay from account" : "To account";
    $("#aPayeeL").textContent = k === "in" ? "Payer" : "Payee";
    $("#aPayee").placeholder = k === "in" ? "Who paid you" : "Who you paid";
    if (diff) {
      $("#aAmt2L").textContent = (isCredit(w) ? "Amount debited (" : "Amount received (") + to.cur + ")";
      var a = evalExpr($("#aAmt").value, w.cur);
      $("#aAmt2").placeholder = isFinite(a) && a > 0 ? "about " + rnd(conv(a, w.cur, to.cur), to.cur) : "auto";
    }
    $("#aXferHint").textContent = k === "xfer" ? (!to ? (isCredit(w) ? "Add a bank or cash account to pay from." : "Add another account to make a transfer.") : diff ? "Leave the received amount blank to use the current rate." : "") : "";
    refreshSub("#aCat", "#aSubList", k); var dl = $("#aCatList"), want = k === "in" ? CATS["in"] : CATS.out.concat(state.budgets.map(function (u) { return u.name; }).filter(function (n) { return n && CATS.out.indexOf(n) < 0; })), sig = k + "|" + want.join();
    if (dl.getAttribute("data-k") !== sig) { dl.setAttribute("data-k", sig); dl.innerHTML = want.map(function (c) { return '<option value="' + esc(c) + '">'; }).join(""); }
  }
  ["#aAmt", "#aTo"].forEach(function (s) { $(s).addEventListener("input", updateAcctTx); $(s).addEventListener("change", updateAcctTx); });
  document.querySelectorAll('input[name="akind"]').forEach(function (r) { r.addEventListener("change", updateAcctTx); });
  $("#aTxForm").addEventListener("submit", function (e) {
    e.preventDefault();
    var w = wmap[wEditId], err = $("#aErr"), k = aKind(); if (!w) return;
    var raw = evalExpr($("#aAmt").value, w.cur), date = $("#aDate").value;
    if (!isFinite(raw) || raw <= 0) { err.textContent = "Enter an amount above 0, or a sum like 120+45.5."; $("#aAmt").focus(); return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { err.textContent = "Pick a date."; $("#aDate").focus(); return; }
    var t = { date: date, kind: k, amount: rnd(raw, w.cur), wallet: w.id, cat: "", sub: "", note: $("#aNote").value.trim(), to: "", toAmount: 0,
      pay: $("#aPay").value || "Cash", payee: k === "xfer" ? "" : $("#aPayee").value.trim(),
      labels: $("#aLabels").value.split(",").map(function (s) { return s.trim(); }).filter(Boolean).join(", "), createdAt: Date.now() };
    if (k === "xfer") {
      var to = wmap[$("#aTo").value];
      if (!to || to.id === w.id) { err.textContent = "Pick a different account to transfer to."; return; }
      t.to = to.id;
      if (to.cur === w.cur) t.toAmount = t.amount;
      else {
        var r2 = $("#aAmt2").value.trim() === "" ? NaN : evalExpr($("#aAmt2").value, to.cur);
        t.toAmount = isFinite(r2) && r2 > 0 ? rnd(r2, to.cur) : rnd(conv(raw, w.cur, to.cur), to.cur);
      }
    } else { t.cat = $("#aCat").value.trim() || (k === "in" ? "Income" : "Other"); t.sub = $("#aSub").value.trim(); }
    if (k === "xfer" && isCredit(w)) {
      var o2 = wmap[t.to], amtCard = rnd(raw, w.cur), rr = $("#aAmt2").value.trim() === "" ? NaN : evalExpr($("#aAmt2").value, o2.cur);
      t.wallet = o2.id; t.to = w.id; t.toAmount = amtCard;
      t.amount = o2.cur === w.cur ? amtCard : (isFinite(rr) && rr > 0 ? rnd(rr, o2.cur) : rnd(conv(raw, w.cur, o2.cur), o2.cur));
    }
    err.textContent = ""; $("#aSave").disabled = true; state.lastWallet = t.wallet;
    put("t", t).then(function (id) {
      $("#aSave").disabled = false;
      if (!id) { err.textContent = "Could not save the transaction. Try again."; return; }
      var q = date.split("-"); state.sel = date; state.y = +q[0]; state.m = +q[1] - 1;
      closeAcctDlg(); render(); setStatus("Added to " + w.name + ".");
    });
  });
  /* transactions list shown beside the account popup */
  var HIST_STEP = 30, histLimit = HIST_STEP, histKind = "all";
  function renderAcctHist() {
    var box = $("#aHist"), w = wmap[dlgId];
    if (!w || !acctDlg.open) { box.hidden = true; acctDlg.classList.remove("hist"); return; }
    box.hidden = false; acctDlg.classList.add("hist");
    var all = state.tx.filter(function (t) { return validT(t) && (t.wallet === w.id || t.to === w.id); })
      .sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : (b.createdAt || 0) - (a.createdAt || 0); });
    var rows = histKind === "all" ? all : all.filter(function (t) { return t.kind === histKind; });
    $("#aHistT").textContent = w.name;
    $("#aHistN").textContent = rows.length + (rows.length === 1 ? " transaction" : " transactions");
    document.querySelectorAll("#aHist [data-hk]").forEach(function (b) { b.setAttribute("aria-pressed", String(b.getAttribute("data-hk") === histKind)); });
    histBulk.ids = rows.map(function (t) { return t.id; });
    var shown = rows.slice(0, histLimit), more = rows.length - shown.length, html = "", cur = "";
    shown.forEach(function (t) {
      var amt, ac = "", incoming = t.kind === "xfer" && t.to === w.id && t.wallet !== w.id;
      if (t.kind === "xfer") amt = money(incoming ? (Number(t.toAmount) || 0) : -t.amount, w.cur, true);
      else { amt = money(t.kind === "in" ? t.amount : -t.amount, w.cur, true); ac = t.kind === "in" ? "win" : "loss"; }
      if (incoming) ac = "win"; else if (t.kind === "xfer") ac = "loss";
      var sub = t.kind === "xfer" ? "" : extra(t).replace(/^ · /, ""); if (t.note) sub += (sub ? " · " : "") + esc(t.note);
      if (t.date !== cur) { cur = t.date; html += '<div class="act-date"><span>' + esc(dayLabel(t.date)) + "</span></div>"; }
      var col = t.kind === "xfer" ? "var(--c6)" : colorVar(t.cat);
      var hpk = histBulk.mode && histBulk.pick[t.id];
      var hlead = histBulk.mode ? '<label class="apick"><input type="checkbox" data-pickbox aria-label="Select transaction"' + (hpk ? " checked" : "") + '></label>' : '<span class="aic" style="--tc:' + col + '">' + svgi(AIC[t.kind]) + "</span>";
      html += '<div class="act' + (hpk ? " sel" : "") + '"' + (histBulk.mode ? "" : ' role="button" tabindex="0" title="Click to edit this transaction"') + ' data-hid="' + esc(t.id) + '">' + hlead + "<div><span>" + txTitle(t) + "</span>" +
        (t.rid ? '<span class="rec" title="Posted automatically by a recurring item" aria-label="Recurring">↻</span>' : "") + '<div class="note">' + sub + '</div></div><span class="amt ' + ac + '">' + amt + "</span></div>";
    });
    if (more > 0) html += '<div class="hmore"><button type="button" class="btn sm" data-hmore>Show ' + Math.min(HIST_STEP, more) + " more</button></div>";
    renderBulk(histBulk, $("#aHistBulk"), $("#aHistSel"));
    $("#aHistList").innerHTML = html || '<p class="empty">' + (all.length ? "No " + (histKind === "out" ? "expenses" : histKind === "in" ? "income" : "transfers") + " in this account." : "No transactions in this account yet.") + "</p>";
  }
  $("#aHist").addEventListener("click", function (e) {
    var f = e.target.closest("[data-hk]"), m = e.target.closest("[data-hmore]"), r = e.target.closest("[data-hid]");
    if (f) { histKind = f.getAttribute("data-hk"); histLimit = HIST_STEP; renderAcctHist(); $("#aHistList").scrollTop = 0; }
    else if (m) { histLimit += HIST_STEP; renderAcctHist(); }
    else if (r) { if (histBulk.mode) bulkRowToggle(histBulk, e, "[data-hid]", "data-hid", $("#aHistBulk"), $("#aHistSel")); else openTxDlg(r.getAttribute("data-hid")); }
  });
  wireBulk(histBulk, $("#aHistBulk"), $("#aHistSel"), function () { renderAcctHist(); });
  $("#aHist").addEventListener("keydown", function (e) {
    var r = e.target.closest && e.target.closest("[data-hid]");
    if (r && e.target === r && !histBulk.mode && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); openTxDlg(r.getAttribute("data-hid")); }
  });
  function closeAcctDlg() { if (acctDlg.open) acctDlg.close(); }
  acctDlg.addEventListener("close", function () { dlgId = null; histBulk.mode = false; histBulk.pick = {}; histBulk.arm = false; clearTimeout(histBulk.tm); cancelWalletEdit(); renderAcctHist(); });
  /* stays open unless the person taps ✕ / Cancel: ignore backdrop clicks and Esc */
  acctDlg.addEventListener("cancel", function (e) { e.preventDefault(); });
  $("#acctClose").addEventListener("click", closeAcctDlg);
  $("#wCancel").addEventListener("click", closeAcctDlg);
  $("#dAccts").addEventListener("click", function (e) { if (e.target.closest("#seedBtn")) seedExamples(); });
  document.addEventListener("click", function (e) { if (e.target.closest("[data-addacct]")) openAcctDlg(null); });
  /* ===== Recurring: repeats, installments, subscriptions ===== */
  var rType = "installment", recBusy = false, rArm = null;
  var recDlg = $("#recDlg");
  function openRecDlg() {
    if (!state.wallets.length) { openAcctDlg(null); return; }
    $("#rAcct").innerHTML = state.wallets.map(function (x) { return '<option value="' + esc(x.id) + '">' + esc(x.name) + " (" + x.cur + ")</option>"; }).join("");
    var pick = (state.lastWallet && wmap[state.lastWallet] ? state.lastWallet : "") || (state.wallets.filter(isCredit)[0] || state.wallets[0]).id;
    dlgId = pick; $("#rAcct").value = pick;
    setRType(rType);
    if (!recDlg.open) recDlg.showModal();
    $("#rName").focus();
  }
  function closeRecDlg() { if (recDlg.open) recDlg.close(); }
  recDlg.addEventListener("close", function () { dlgId = null; });
  recDlg.addEventListener("cancel", function (e) { e.preventDefault(); });
  $("#recClose").addEventListener("click", closeRecDlg); $("#rCancel").addEventListener("click", closeRecDlg);
  $("#recNew").addEventListener("click", openRecDlg);
  $("#rAcct").addEventListener("change", function () {
    var old = wmap[dlgId], w = wmap[this.value]; if (!w) return;
    dlgId = w.id;
    var st = $("#rStmt").value.trim(); if (st === "" || (old && st === String(old.stmt || ""))) $("#rStmt").value = w.stmt || "";
    $("#rAmtL").textContent = (rType === "installment" ? "Total amount (" : rType === "repeat" ? "Amount (" : "Amount per charge (") + w.cur + ")";
    updateRHint();
  });
  var RT_LABEL = { repeat: "Repeat", installment: "Installment", subscription: "Subscription" };
  var FREQ_LABEL = { weekly: "Weekly", monthly: "Monthly", quarterly: "Quarterly", yearly: "Yearly" };
  function addMonths(d0, k) {
    var q = d0.split("-").map(Number), t = q[1] - 1 + k, y = q[0] + Math.floor(t / 12), m = ((t % 12) + 12) % 12, dim = new Date(y, m + 1, 0).getDate();
    return ds(y, m, Math.min(q[2], dim));
  }
  /* Splits an installment into principal + interest per month.
     type: none | addon_m (flat, % per month) | addon_y (flat, % per annum) | reducing (% per annum, reducing balance). */
  function instCalc(P, n, type, rate) {
    var rows = [], i, rem = P, tI = 0;
    rate = rate > 0 ? rate : 0;
    if (type === "reducing" && rate > 0) {
      var mi = rate / 100 / 12, pmt = P * mi / (1 - Math.pow(1 + mi, -n));
      for (i = 0; i < n; i++) {
        var it = round2(rem * mi), pr = i === n - 1 ? round2(rem) : round2(pmt - it);
        rem = round2(rem - pr); rows.push({ prin: pr, int: it }); tI += it;
      }
    } else {
      tI = round2(type === "addon_m" ? P * rate / 100 * n : type === "addon_y" ? P * rate / 100 * n / 12 : 0);
      var bp = round2(P / n), bi = round2(tI / n);
      for (i = 0; i < n; i++) rows.push({ prin: i === n - 1 ? round2(P - bp * (n - 1)) : bp, int: i === n - 1 ? round2(tI - bi * (n - 1)) : bi });
    }
    var lo = 0, hi = 1, mid, pv, k;
    if (tI > 0 && P > 0) {
      for (i = 0; i < 80; i++) {
        mid = (lo + hi) / 2; pv = 0;
        for (k = 0; k < n; k++) pv += (rows[k].prin + rows[k].int) / Math.pow(1 + mid, k + 1);
        if (pv > P) lo = mid; else hi = mid;
      }
    }
    return { rows: rows, totInt: round2(tI), eir: tI > 0 ? (lo + hi) / 2 * 12 * 100 : 0, addM: P > 0 ? tI / P / n * 100 : 0 };
  }
  function rateTag(r) {
    if (!r || !r.rateType || r.rateType === "none" || !(r.rate > 0)) return "";
    return r.rate + (r.rateType === "addon_m" ? "%/mo add-on" : r.rateType === "addon_y" ? "% p.a. add-on" : "% p.a. reducing");
  }
  function stmtDates(r) {
    var q = r.start.split("-").map(Number), D = r.stmt || q[2], y = q[0], m = q[1] - 1, out = [], k;
    var first = ds(y, m, Math.min(D, new Date(y, m + 1, 0).getDate())), off = first > r.start ? 0 : 1;
    for (k = 0; k < (r.count || 1); k++) { var t = m + off + k, yy = y + Math.floor(t / 12), mm = t % 12; out.push(ds(yy, mm, Math.min(D, new Date(yy, mm + 1, 0).getDate()))); }
    return out;
  }
  function occurrences(r, upto) {
    var out = [], i, d;
    if (!r || !r.start) return out;
    if (r.type === "installment" && r.mode === "amortize") {
      var sd = stmtDates(r), n0 = r.count || 1, sc = instCalc(r.total || 0, n0, r.rateType, r.rate);
      sd.forEach(function (dd, ix) {
        if (dd > upto) return;
        out.push({ date: dd, amount: sc.rows[ix].prin + (r.fee || 0), tag: "amort", idx: ix + 1 });
        if (sc.rows[ix].int > 0) out.push({ date: dd, amount: sc.rows[ix].int, tag: "int", idx: ix + 1 });
        if (ix === 0 && r.charge > 0) out.push({ date: dd, amount: r.charge, tag: "charge" });
      });
      return out;
    }
    if (r.type === "installment") {
      if (r.start <= upto) out.push({ date: r.start, amount: r.total, tag: "purchase" });
      if (r.start <= upto && r.charge > 0) out.push({ date: r.start, amount: r.charge, tag: "charge" });
      if (r.fee > 0) for (i = 1; i <= r.count; i++) { d = addMonths(r.start, i); if (d > upto) break; out.push({ date: d, amount: r.fee, tag: "fee" }); }
      return out;
    }
    for (i = 0; i < 700; i++) {
      d = r.freq === "weekly" ? addDays(r.start, 7 * i) : r.freq === "yearly" ? addMonths(r.start, 12 * i) : r.freq === "quarterly" ? addMonths(r.start, 3 * i) : addMonths(r.start, i);
      if (d > upto || (r.end && d > r.end)) break;
      out.push({ date: d, amount: r.amount, tag: "" });
    }
    return out;
  }
  function recTx(r, o, w, ts) {
    var fee = o.tag === "fee" || o.tag === "int" || o.tag === "charge", k = r.type === "repeat" && r.kind === "in" ? "in" : "out";
    return { id: "r_" + r.id + "_" + o.date + (o.tag === "int" || o.tag === "charge" ? "_" + o.tag : ""), date: o.date, kind: k, amount: rnd(o.amount, w.cur), wallet: w.id,
      cat: fee ? "Interest & fees" : (r.cat || (k === "in" ? "Income" : r.type === "subscription" ? "Life & Entertainment" : "Other")),
      sub: fee ? "" : (r.sub || (!r.cat && r.type === "subscription" ? "Book, Audio and Subscriptions" : "")),
      note: r.type === "installment" ? (r.name || "Installment") + (o.tag === "amort" ? " · " + o.idx + "/" + r.count : o.tag === "int" ? " · interest " + o.idx + "/" + r.count : o.tag === "charge" ? " · " + (r.chargeName || "processing fee") : o.tag === "fee" ? " · monthly fee" : " · " + r.count + "-month installment") : (r.name || ""),
      to: "", toAmount: 0, pay: isCredit(w) ? "Credit card" : "Cash", payee: r.type === "subscription" ? (r.name || "") : (r.payee || ""),
      labels: r.type === "repeat" ? "recurring" : r.type, rid: r.id, createdAt: ts };
  }
  /* Posts every charge that has come due and was not posted yet. Charge ids are fixed (recurring id + date), so a repeat run can never double-post. */
  function runRecurring() {
    if (!state.loaded || recBusy || !state.recs.length) return;
    try { if (window.__remind) window.__remind(state, occurrences, addDays, todayStr, wmap); } catch (e) {}
    var txs = [], ups = [], stamp = Date.now();
    state.recs.forEach(function (r) {
      var w = r && wmap[r.wallet]; if (!w || r.active === false) return;
      var last = r.last || "", nl = last;
      occurrences(r, todayStr).forEach(function (o) {
        if (o.date <= last) return;
        txs.push(recTx(r, o, w, stamp + txs.length)); if (o.date > nl) nl = o.date;
      });
      if (nl !== last) ups.push({ id: r.id, last: nl });
    });
    if (!txs.length) return;
    recBusy = true;
    Promise.all(txs.map(function (t) { return put("t", t); }))
      .then(function () { return Promise.all(ups.map(function (u) { return patch("r", u.id, { last: u.last }); })); })
      .then(function () { recBusy = false; }, function () { recBusy = false; });
  }
  function setRType(t) {
    rType = t; var w = wmap[dlgId]; if (!w) return;
    var rep = t === "repeat", ins = t === "installment", sub = t === "subscription";
    document.querySelectorAll("[data-rt]").forEach(function (b) { b.setAttribute("aria-pressed", String(b.getAttribute("data-rt") === t)); });
    $("#rKindBox").hidden = !rep; $("#rNameBox").style.gridColumn = rep ? "" : "1 / -1";
    $("#rNameL").textContent = rep ? "Name (optional)" : ins ? "What did you buy?" : "Service name";
    $("#rName").placeholder = rep ? "Rent, allowance, loan" : ins ? "e.g. Laptop, appliance" : "e.g. Netflix, Spotify";
    $("#rAmtL").textContent = (ins ? "Total amount (" : rep ? "Amount (" : "Amount per charge (") + w.cur + ")";
    $("#rModeRow").hidden = !ins; $("#rFreqBox").hidden = ins; $("#rMonthsBox").hidden = !ins; $("#rEndBox").hidden = !rep; $("#rFeeBox").hidden = !ins; $("#rPayeeBox").hidden = sub;
    $("#rStartL").textContent = ins ? "Purchase date" : sub ? "First charge date" : "Start date";
    var fr = rep ? ["weekly", "monthly", "yearly"] : ["monthly", "quarterly", "yearly"];
    $("#rFreq").innerHTML = fr.map(function (f) { return '<option value="' + f + '">' + FREQ_LABEL[f] + "</option>"; }).join(""); $("#rFreq").value = "monthly";
    $("#rSave").textContent = "Add " + (rep ? "repeat" : t);
    var cats = (rep ? CATS.out.concat(CATS["in"]) : CATS.out);
    $("#rCatList").innerHTML = cats.map(function (c) { return '<option value="' + esc(c) + '">'; }).join("");
    $("#rCat").placeholder = sub ? "Life & Entertainment" : ins ? "Shopping" : "Housing"; refreshSub("#rCat", "#rSubList", rep && $("#rKind").value === "in" ? "in" : "out");
    ["#rName", "#rAmt", "#rMonths", "#rFee", "#rEnd", "#rCat", "#rPayee", "#rRate", "#rCharge", "#rChargeName", "#rSub"].forEach(function (q) { $(q).value = ""; });
    $("#rRateType").value = "none";
    $("#rKind").value = "out"; $("#rStart").value = todayStr; refreshSub("#rCat", "#rSubList", "out"); $("#rErr").textContent = "";
    $("#rMode").value = "amortize"; $("#rFull").setAttribute("aria-checked", "false"); $("#rFullH").textContent = "Off: billed monthly on each statement date"; $("#rStmt").value = w.stmt || "";
    updateRHint();
  }
  function updateRHint() {
    var ins = rType === "installment", w = wmap[dlgId], am = ins && $("#rMode").value === "amortize";
    $("#rStmtBox").hidden = !am;
    $("#rFeesHead").hidden = !ins; $("#rIntRow").hidden = !am; $("#rFeeRow").hidden = !ins; $("#rCalc").hidden = !ins;
    var chv = $("#rCharge").value.trim();
    $("#rChargeNameBox").hidden = !ins || !w || chv === "" || !(evalExpr(chv, w.cur) > 0);
    var rtp = $("#rRateType").value; $("#rRateBox").hidden = !am || rtp === "none"; $("#rIntBox").style.gridColumn = rtp === "none" ? "1 / -1" : "";
    $("#rRateL").textContent = rtp === "addon_m" ? "Add-on rate (% per month)" : rtp === "addon_y" ? "Add-on rate (% per annum)" : "Interest rate (% per annum)";
    var base = ins ? (am ? "Each statement date adds one monthly amount to the account until the last month. Leave the statement day blank to use the card's, or the purchase day." : "The full price is charged on the purchase date. A monthly fee, if any, is charged each month for the number of months.") : "Charges dated today or earlier are added right away. Later ones are added automatically when you open the app on or after the date.";
    if (ins && w) {
      var a = evalExpr($("#rAmt").value, w.cur), n = parseInt($("#rMonths").value, 10), f = $("#rFee").value.trim() === "" ? 0 : evalExpr($("#rFee").value, w.cur);
      if (isFinite(a) && a > 0 && n > 0) {
        var firstOn = am && /^\d{4}-\d{2}-\d{2}$/.test($("#rStart").value) ? fmtShort(stmtDates({ start: $("#rStart").value, stmt: parseInt($("#rStmt").value, 10) || w.stmt || 0, count: n })[0]) : "";
      }
      /* live interest + charges summary */
      var calc = "";
      if (isFinite(a) && a > 0 && n > 0 && n <= 120) {
        var rt = am ? $("#rRateType").value : "none", rate = parseFloat(($("#rRate").value || "").replace(",", ".")); if (!(rate > 0)) rate = 0;
        var ch = $("#rCharge").value.trim() === "" ? 0 : evalExpr($("#rCharge").value, w.cur); if (!isFinite(ch) || ch < 0) ch = 0;
        var ff = isFinite(f) ? f : 0, sc = instCalc(a, n, rt, rate), P2 = function (x) { return x.toFixed(2) + "%"; };
        var kv = function (k, v, cls) { return "<span" + (cls ? ' class="' + cls + 'l"' : "") + ">" + k + "</span><b" + (cls ? ' class="' + cls + '"' : "") + ">" + esc(v) + "</b>"; }, G = "", head = "";
        if (rt !== "none" && rate > 0) {
          head = '<div class="calc-rate">' + (rt === "addon_m" ? P2(rate) + " add-on per month = " + P2(rate * 12) + " per annum" : rt === "addon_y" ? P2(rate) + " add-on per annum = " + P2(rate / 12) + " per month" : P2(rate) + " per annum, reducing balance = " + P2(rate / 12) + " per month (about " + P2(sc.addM) + " add-on per month)") + "<br>Effective rate (EIR): " + P2(sc.eir) + " per annum</div>";
        }
        if (am) G += kv("Monthly payment", money(sc.rows[0].prin + sc.rows[0].int + ff, w.cur));
        else G += kv("Charged on purchase date", money(a, w.cur));
        if (firstOn) G += kv("First billing", firstOn);
        if (sc.totInt > 0) G += kv("Total interest", money(sc.totInt, w.cur));
        if (ff > 0) G += kv("Monthly fees (" + n + "×)", money(ff * n, w.cur));
        if (ch > 0) G += kv("One-time charge", money(ch, w.cur));
        G += kv("Total payable", money(a + sc.totInt + ff * n + ch, w.cur), "tot");
        calc = head + '<div class="calc-grid">' + G + "</div>";
      }
      $("#rCalc").innerHTML = calc;
    }
    $("#rHint").textContent = base;
  }
  ["#rAmt", "#rMonths", "#rFee", "#rStmt", "#rStart", "#rRate", "#rCharge"].forEach(function (q) { $(q).addEventListener("input", updateRHint); });
  $("#rMode").addEventListener("change", updateRHint);
  $("#rFull").addEventListener("click", function () {
    var on = this.getAttribute("aria-checked") !== "true";
    this.setAttribute("aria-checked", String(on)); $("#rMode").value = on ? "full" : "amortize";
    $("#rFullH").textContent = on ? "On: the whole amount is charged on the purchase date" : "Off: billed monthly on each statement date";
    updateRHint();
  });
  $("#rRateType").addEventListener("change", updateRHint);
  function recMonthly(r) { return r.freq === "weekly" ? 52 / 12 : r.freq === "quarterly" ? 1 / 3 : r.freq === "yearly" ? 1 / 12 : 1; }
  function renderRecList() {
    var host = $("#recBody"); if (!host || $("#recView").hidden) return;
    var list = state.recs.filter(function (r) { return r && wmap[r.wallet]; }).sort(function (x, y) { return (x.createdAt || 0) - (y.createdAt || 0); });
    var T = { inst: 0, instN: 0, left: 0, sub: 0, subN: 0, bill: 0, inc: 0 }, G = { installment: [], subscription: [], repeat: [] };
    list.forEach(function (r) {
      var w = wmap[r.wallet], title = esc(r.name || r.cat || RT_LABEL[r.type]), sub, amt, ac = "loss", np = state.tx.filter(function (t) { return t.rid === r.id; }).length, on = r.active !== false, nk = "";
      if (r.type === "installment") {
        var n = r.count || 1, el = 0, nxt = "", k, sdl = r.mode === "amortize" ? stmtDates(r) : null;
        for (k = 1; k <= n; k++) { var dk = sdl ? sdl[k - 1] : addMonths(r.start, k); if (dk <= todayStr) el++; else if (!nxt) nxt = dk; }
        var sc = instCalc(r.total || 0, n, sdl ? r.rateType : "none", r.rate), mo = sc.rows[0].prin + sc.rows[0].int + (r.fee || 0);
        var leftP = round2(sc.rows.slice(el).reduce(function (s0, x) { return s0 + x.prin; }, 0));
        nk = nxt; amt = money(mo, w.cur) + "/mo";
        sub = el + " of " + n + (sdl ? " statements" : " months") + " billed · " + (nxt ? "next " + fmtShort(nxt) : "completed") + " · left " + money(leftP, w.cur) + (sdl && rateTag(r) ? " · " + rateTag(r) : "");
        if (on && nxt) { T.inst += conv(mo, w.cur); T.instN++; T.left += conv(leftP, w.cur); }
      } else {
        var up = occurrences(r, addDays(todayStr, 400)).filter(function (o) { return o.date > todayStr; })[0];
        nk = up ? up.date : ""; amt = money(r.amount, w.cur); ac = r.kind === "in" ? "win" : "loss";
        sub = FREQ_LABEL[r.freq] + " · " + (up ? "next " + fmtShort(up.date) : r.end && r.end <= todayStr ? "ended" : "no upcoming charge");
        if (on && up) { var m = conv(r.amount * recMonthly(r), w.cur); if (r.type === "subscription") { T.sub += m; T.subN++; } else if (r.kind === "in") T.inc += m; else T.bill += m; }
      }
      if (!on) sub += " · paused";
      G[r.type].push({ k: (on ? "0" : "1") + (nk || "9999-99-99") + "|" + String(r.name || r.cat || "").toLowerCase(), h: '<li><div><div class="sym">' + title + '</div><div class="note">' + esc(w.name + " · " + sub) + '</div></div><span class="amt ' + ac + '">' + esc(amt) + '</span><span class="acts"><button type="button" class="ed" data-rpause="' + esc(r.id) + '">' + (on ? "Pause" : "Resume") + '</button><button type="button" class="del" data-rdel="' + esc(r.id) + '">Delete</button>' + (np ? '<button type="button" class="del" data-rdel="' + esc(r.id) + '" data-rwipe="1">Delete + ' + np + ' posted</button>' : "") + '</span></li>' });
    });
    Object.keys(G).forEach(function (t) { G[t].sort(function (a, b) { return a.k < b.k ? -1 : a.k > b.k ? 1 : 0; }); });
    host.innerHTML = [["installment", "Installments"], ["subscription", "Subscriptions"], ["repeat", "Repeats"]].map(function (g) {
      return G[g[0]].length ? '<h4 class="recgrp">' + g[1] + '</h4><ul class="list">' + G[g[0]].map(function (x) { return x.h; }).join("") + "</ul>" : "";
    }).join("") || '<p class="empty">Nothing set up yet. Tap + New to add an installment, subscription or repeat.</p>';
    var tiles = [
      ["Installments per month", D(T.inst), "var(--loss)", svgi('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18"/>'), T.instN ? T.instN + " active · " + D(T.left) + " left to pay" : "None active"],
      ["Subscriptions per month", D(T.sub), "var(--c5)", svgi('<path d="M17 2l4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4M21 13v2a3 3 0 0 1-3 3H3"/>'), T.subN ? T.subN + " active" : "None active"],
      ["Repeating bills per month", D(T.bill), "var(--c3)", svgi('<circle cx="12" cy="12" r="9"/><path d="M12 8v4l3 2"/>'), ""],
      ["Repeating income per month", D(T.inc), "var(--win)", svgi('<path d="M7 17 17 7M9 7h8v8"/>'), ""]
    ];
    $("#recTiles").innerHTML = tiles.map(function (x) {
      return '<div class="tile" style="--tc:' + x[2] + '"><span class="ic">' + x[3] + '</span><div><div class="tl">' + x[0] + '</div><div class="tv">' + x[1] + "</div>" + (x[4] ? '<div class="tl">' + x[4] + "</div>" : "") + "</div></div>";
    }).join("");
    var box = $("#rOrph"), ids = {}, orph = [];
    state.recs.forEach(function (x) { ids[x.id] = 1; });
    if (state.loaded) orph = state.tx.filter(function (t) { return t.rid && !ids[t.rid] && wmap[t.wallet]; });
    box.hidden = !orph.length;
    box.innerHTML = orph.length ? '<small class="hint">' + orph.length + " charge" + (orph.length === 1 ? "" : "s") + " left over from recurring items you deleted. They still count toward their accounts.</small> " + '<button type="button" class="btn sm" id="rOrphBtn">Remove them</button>' : "";
  }
  $("#rTabs").addEventListener("click", function (e) { var b = e.target.closest("[data-rt]"); if (b) setRType(b.getAttribute("data-rt")); });
  $("#recView").addEventListener("click", function (e) {
    var pb = e.target.closest("[data-rpause]"), db = e.target.closest("[data-rdel]");
    if (pb) {
      var id = pb.getAttribute("data-rpause"), r = null; state.recs.forEach(function (x) { if (x.id === id) r = x; }); if (!r) return;
      if (r.active === false) { var oc = occurrences(r, todayStr), ld = oc.length ? oc[oc.length - 1].date : ""; patch("r", id, { active: true, last: ld > (r.last || "") ? ld : (r.last || "") }); }
      else patch("r", id, { active: false });
      return;
    }
    if (!db) return;
    if (!db.classList.contains("arm")) {
      db.dataset.t = db.textContent; db.classList.add("arm"); db.textContent = "Sure?"; clearTimeout(rArm);
      rArm = setTimeout(function () { db.classList.remove("arm"); db.textContent = db.dataset.t || "Delete"; }, 3000); return;
    }
    var rid = db.getAttribute("data-rdel");
    if (db.getAttribute("data-rwipe")) {
      var gone = state.tx.filter(function (t) { return t.rid === rid; });
      Promise.all(gone.map(function (t) { return drop("t", t.id); }).concat([drop("r", rid)])).then(function () { setStatus("Removed the recurring item and " + gone.length + " posted charge" + (gone.length === 1 ? "" : "s") + "."); });
      return;
    }
    drop("r", rid);
  });
  $("#rOrph").addEventListener("click", function (e) {
    var b = e.target.closest("#rOrphBtn"); if (!b) return;
    if (!b.classList.contains("arm")) { b.classList.add("arm"); b.textContent = "Sure?"; clearTimeout(rArm); rArm = setTimeout(function () { b.classList.remove("arm"); b.textContent = "Remove them"; }, 3000); return; }
    var ids = {}; state.recs.forEach(function (x) { ids[x.id] = 1; });
    var gone = state.tx.filter(function (t) { return t.rid && !ids[t.rid] && wmap[t.wallet]; });
    Promise.all(gone.map(function (t) { return drop("t", t.id); })).then(function () { setStatus("Removed " + gone.length + " leftover charge" + (gone.length === 1 ? "" : "s") + "."); });
  });
  $("#rForm").addEventListener("submit", function (e) {
    e.preventDefault();
    var w = wmap[dlgId], err = $("#rErr"); if (!w) return;
    var rep = rType === "repeat", ins = rType === "installment", sub = rType === "subscription";
    var name = $("#rName").value.trim(), amt = evalExpr($("#rAmt").value, w.cur), start = $("#rStart").value, end = $("#rEnd").value, kind = $("#rKind").value;
    if ((ins || sub) && !name) { err.textContent = ins ? "Say what you bought." : "Enter the service name."; $("#rName").focus(); return; }
    if (!isFinite(amt) || amt <= 0) { err.textContent = "Enter an amount above 0."; $("#rAmt").focus(); return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(start)) { err.textContent = "Pick a start date."; $("#rStart").focus(); return; }
    var o = { type: rType, wallet: w.id, name: name, cat: $("#rCat").value.trim(), sub: $("#rSub").value.trim(), payee: sub ? name : $("#rPayee").value.trim(), start: start, active: true, last: "", createdAt: Date.now() };
    if (ins) {
      var n = parseInt($("#rMonths").value, 10), fee = $("#rFee").value.trim() === "" ? 0 : evalExpr($("#rFee").value, w.cur);
      if (!(n >= 1 && n <= 120)) { err.textContent = "Months must be between 1 and 120."; $("#rMonths").focus(); return; }
      if (!isFinite(fee) || fee < 0) { err.textContent = "The monthly fee must be 0 or more."; $("#rFee").focus(); return; }
      var sday = $("#rStmt").value.trim() === "" ? 0 : parseInt($("#rStmt").value, 10);
      if (!(sday >= 0 && sday <= 31)) { err.textContent = "The statement day must be between 1 and 31."; $("#rStmt").focus(); return; }
      o.kind = "out"; o.total = rnd(amt, w.cur); o.count = n; o.fee = rnd(fee, w.cur); o.amount = rnd(amt / n, w.cur);
      o.mode = $("#rMode").value; o.stmt = o.mode === "amortize" ? (sday || w.stmt || 0) : 0;
      var rtype = o.mode === "amortize" ? $("#rRateType").value : "none", rate = parseFloat(($("#rRate").value || "").replace(",", "."));
      if (rtype !== "none" && !(rate > 0 && rate <= 100)) { err.textContent = "Enter the interest rate as a percentage above 0."; $("#rRate").focus(); return; }
      var chg = $("#rCharge").value.trim() === "" ? 0 : evalExpr($("#rCharge").value, w.cur);
      if (!isFinite(chg) || chg < 0) { err.textContent = "The charge must be 0 or more."; $("#rCharge").focus(); return; }
      o.rateType = rtype; o.rate = rtype === "none" ? 0 : rate; o.charge = rnd(chg, w.cur); o.chargeName = $("#rChargeName").value.trim();
    } else {
      o.kind = rep ? kind : "out"; o.amount = rnd(amt, w.cur); o.freq = $("#rFreq").value;
      if (rep) { if (end && end < start) { err.textContent = "The end date must be after the start date."; $("#rEnd").focus(); return; } o.end = end || ""; }
    }
    err.textContent = ""; $("#rSave").disabled = true;
    put("r", o).then(function (id) {
      $("#rSave").disabled = false;
      if (!id) { err.textContent = "Could not save. Try again."; return; }
      closeRecDlg(); setStatus("Added " + RT_LABEL[rType].toLowerCase() + " to " + w.name + ".");
    });
  });
  function updateWType() {
    var c = $("#wType").value === "Credit card";
    $("#wCardBox").hidden = !c;
    $("#wOpenL").textContent = c ? "Amount owed now" : "Opening balance";
    $("#wOpenH").textContent = c ? "Enter what you owe as a positive number." : "Use a minus if the account is overdrawn.";
  }
  $("#wType").addEventListener("change", updateWType);
  function payCard(id) {
    var w = wmap[id]; if (!w) return;
    openAcctDlg(id, "tx");
    var srcs = state.wallets.filter(function (x) { return !isCredit(x); });
    if (!srcs.length) { $("#aErr").textContent = "Add a bank or cash account to pay from."; return; }
    var pref = srcs.filter(function (x) { return x.id === state.lastWallet; })[0] || srcs[0], owed = Math.max(0, -(balances()[id] || 0));
    $("#aXfer").checked = true; $("#aTo").value = pref.id; $("#aAmt").value = owed ? round2(owed) : ""; $("#aNote").value = "Credit card payment";
    updateAcctTx(); $("#aAmt").focus();
  }
  var wArm = null;
  $("#wDel").addEventListener("click", function () {
    var b = this;
    if (!b.classList.contains("arm")) { b.classList.add("arm"); b.textContent = "Delete account and its transactions?"; clearTimeout(wArm); wArm = setTimeout(function () { b.classList.remove("arm"); b.textContent = "Delete account"; }, 4000); return; }
    var id = wEditId; if (!id) return;
    var gone = state.tx.filter(function (t) { return t.wallet === id || t.to === id; });
    Promise.all(gone.map(function (t) { return drop("t", t.id); }).concat(state.recs.filter(function (r) { return r.wallet === id; }).map(function (r) { return drop("r", r.id); }), [drop("w", id)])).then(function () { closeAcctDlg(); });
  });
  $("#wForm").addEventListener("submit", function (e) {
    e.preventDefault();
    var name = $("#wName").value.trim(), err = $("#wErr"), ot = $("#wOpen").value.trim(), open = ot === "" ? 0 : evalExpr(ot, $("#wCur").value);
    if (!name) { err.textContent = "Give the account a name."; $("#wName").focus(); return; }
    if (!isFinite(open)) { err.textContent = "The opening balance must be a number."; $("#wOpen").focus(); return; }
    var cur = $("#wCur").value, ex = $("#wExp").value.trim(), o = { name: name, type: $("#wType").value, cur: cur, opening: rnd(($("#wType").value === "Credit card" ? -open : open) + 0, cur), last4: $("#wLast4").value.replace(/\D/g, "").slice(0, 4), exp: ex };
    if (ex && !/^(0[1-9]|1[0-2])\/\d{2}$/.test(ex)) { err.textContent = "Expiry should look like 08/27."; $("#wExp").focus(); return; }
    if ($("#wType").value === "Credit card") {
      var lt = $("#wLimit").value.trim(), lim = lt === "" ? 0 : evalExpr(lt, cur), sd = parseInt($("#wStmt").value, 10) || 0, dd = parseInt($("#wDue").value, 10) || 0;
      if (!isFinite(lim) || lim < 0) { err.textContent = "The credit limit must be a number."; $("#wLimit").focus(); return; }
      if (sd < 0 || sd > 31 || dd < 0 || dd > 31) { err.textContent = "Statement and due days must be between 1 and 31."; return; }
      o.limit = rnd(lim, cur); o.stmt = sd; o.due = dd;
    } else { o.limit = 0; o.stmt = 0; o.due = 0; }
    $("#wAdd").disabled = true;
    if (wEditId) {
      var id = wEditId;
      patch("w", id, o).then(function (ok) { $("#wAdd").disabled = false; if (ok !== false) closeAcctDlg(); });
      return;
    }
    o.createdAt = Date.now();
    put("w", o).then(function (id) { $("#wAdd").disabled = false; if (id) closeAcctDlg(); });
  });
  function seedExamples() {
    var ids = { cash: gid("w"), gc: gid("w"), au: gid("w"), us: gid("w") }, t0 = Date.now();
    var ws = [
      { id: ids.cash, name: "Cash (example)", type: "Cash", cur: "PHP", opening: 3500 },
      { id: ids.gc, name: "E-wallet (example)", type: "E-wallet", cur: "PHP", opening: 12000 },
      { id: ids.au, name: "Bank AU (example)", type: "Bank", cur: "AUD", opening: 2400 },
      { id: ids.us, name: "GBP Savings (example)", type: "Savings", cur: "GBP", opening: 1500 }
    ];
    var y = now.getFullYear(), m = now.getMonth(), dayOf = function (d) { return ds(y, m, Math.max(1, Math.min(d, now.getDate()))); };
    var tx = [
      { date: dayOf(1), kind: "in", amount: 2800, wallet: ids.au, cat: "Salary", note: "Example" },
      { date: dayOf(1), kind: "xfer", amount: 500, wallet: ids.au, to: ids.gc, toAmount: round2(conv(500, "AUD", "PHP")), note: "Example" },
      { date: dayOf(2), kind: "out", amount: 8500, wallet: ids.gc, cat: "Rent", note: "Example" },
      { date: dayOf(3), kind: "out", amount: 1240.5, wallet: ids.gc, cat: "Food", note: "Example groceries" },
      { date: dayOf(4), kind: "out", amount: 180, wallet: ids.cash, cat: "Transport", note: "Example" },
      { date: dayOf(5), kind: "out", amount: 2300, wallet: ids.gc, cat: "Bills", note: "Example electricity" },
      { date: dayOf(6), kind: "in", amount: 1500, wallet: ids.cash, cat: "Business", note: "Example" },
      { date: dayOf(7), kind: "out", amount: 640, wallet: ids.cash, cat: "Fun", note: "Example" }
    ].map(function (t, i) { return Object.assign({ createdAt: t0 + i }, t); });
    Promise.all(ws.map(function (w, i) { return put("w", Object.assign({ createdAt: t0 + i }, w)); })).then(function () { return Promise.all(tx.map(function (t) { return put("t", t); })); });
  }

  /* ===== Report ===== */
  var ALL_FROM = "1995-10-05"; /* default "From" date for the All time filter */
  function presets() {
    var t = new Date(now.getFullYear(), now.getMonth(), now.getDate()), all = state.tx.filter(validT).map(function (x) { return x.date; }).sort(), ago = new Date(t); ago.setDate(ago.getDate() - 29);
    return {
      month: [ds(t.getFullYear(), t.getMonth(), 1), dstr(new Date(t.getFullYear(), t.getMonth() + 1, 0))],
      lastmonth: [dstr(new Date(t.getFullYear(), t.getMonth() - 1, 1)), dstr(new Date(t.getFullYear(), t.getMonth(), 0))],
      d30: [dstr(ago), dstr(t)], ytd: [ds(t.getFullYear(), 0, 1), dstr(t)],
      all: [ALL_FROM, all.length && all[all.length - 1] > ALL_FROM ? all[all.length - 1] : dstr(t)]
    };
  }
  function compute(from, to) {
    var rows = state.tx.filter(function (t) { return validT(t) && t.date >= from && t.date <= to; }).sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : (a.createdAt || 0) - (b.createdAt || 0); });
    var r = { rows: rows, inc: 0, exp: 0, n: rows.length, expC: {}, incC: {}, wal: {}, daily: [], span: Math.round((parseD(to) - parseD(from)) / 86400000) + 1, big: null }, dm = {}, cum = 0;
    rows.forEach(function (t) {
      var w = wmap[t.wallet], a = conv(t.amount, w.cur, null, t.date), x = r.wal[w.id] || (r.wal[w.id] = { name: w.name, inc: 0, exp: 0 });
      var d = dm[t.date]; if (!d) { d = dm[t.date] = { date: t.date, n: 0, inc: 0, exp: 0 }; r.daily.push(d); } d.n++;
      if (t.kind === "in") { r.inc += a; d.inc += a; x.inc += a; var k = t.cat || "Income"; r.incC[k] = (r.incC[k] || 0) + a; }
      else if (t.kind === "out") { r.exp += a; d.exp += a; x.exp += a; var k2 = t.cat || "Other"; r.expC[k2] = (r.expC[k2] || 0) + a; if (!r.big || a > r.big.a) r.big = { a: a, cat: k2 }; }
    });
    r.daily.forEach(function (d) { d.net = d.inc - d.exp; cum += d.net; d.cum = cum; });
    r.net = r.inc - r.exp; r.top = null; Object.keys(r.expC).forEach(function (k) { if (!r.top || r.expC[k] > r.expC[r.top]) r.top = k; });
    var tot = rows.filter(function (t) { return t.kind === "out"; }).length; r.nExp = tot;
    return r;
  }
  function tr(cells) { return "<tr>" + cells.map(function (c) { return "<td>" + c + "</td>"; }).join("") + "</tr>"; }
  function table(head, rows) {
    if (!rows.length) return '<p class="empty">Nothing in this range.</p>';
    return '<div class="tw"><table class="t"><thead><tr>' + head.map(function (c) { return '<th scope="col">' + esc(c) + "</th>"; }).join("") + "</tr></thead><tbody>" + rows.join("") + "</tbody></table></div>";
  }
  function catTable(map, total, inc) {
    var keys = Object.keys(map).sort(function (a, b) { return map[b] - map[a]; });
    return table(["Category", "Amount", "Share"], keys.map(function (k) {
      var s = total ? map[k] / total : 0;
      return tr([esc(k), '<span class="' + (inc ? "win" : "loss") + '">' + D(map[k]) + "</span>", pct(s) + '<span class="share ' + (inc ? "in" : "") + '" style="width:' + Math.round(s * 56) + 'px"></span>']);
    }));
  }
  function rmsg(text, warn) { var el = $("#rMsg"); el.textContent = text; el.className = "status" + (warn ? " warn" : ""); }
  function renderReport() {
    var from = $("#rFrom").value, to = $("#rTo").value, err = $("#rErr"), pr = presets();
    document.querySelectorAll("[data-preset]").forEach(function (b) { var p = pr[b.getAttribute("data-preset")]; b.setAttribute("aria-pressed", String(p[0] === from && p[1] === to)); });
    if (!from || !to) { err.textContent = "Pick both a start date and an end date."; return; }
    if (from > to) { err.textContent = "The start date has to be on or before the end date."; return; }
    err.textContent = "";
    var r = compute(from, to); state.rep = { from: from, to: to, r: r };
    var h = '<div class="stat hero"><dt>Net cash flow</dt><dd class="' + cls(r.net) + '">' + (r.n ? D(r.net, true) : "–") + '<small>' + (r.n ? D(r.inc) + " in · " + D(r.exp) + " out" : "no transactions") + '</small></dd></div>';
    h += '<div class="stat"><dt>Money in</dt><dd class="win">' + (r.inc ? D(r.inc) : "–") + '<small>' + Object.keys(r.incC).length + ' sources</small></dd></div>';
    h += '<div class="stat"><dt>Money out</dt><dd class="loss">' + (r.exp ? D(r.exp) : "–") + '<small>' + r.nExp + ' expenses</small></dd></div>';
    h += '<div class="stat"><dt>Savings rate</dt><dd class="' + (r.inc ? cls(r.net) : "") + '">' + (r.inc > 0 ? pct(r.net / r.inc) : "–") + '<small>of income kept</small></dd></div>';
    h += '<div class="stat"><dt>Avg daily spend</dt><dd>' + (r.exp ? D(r.exp / r.span) : "–") + '<small>over ' + r.span + ' days</small></dd></div>';
    h += '<div class="stat"><dt>Top category</dt><dd>' + (r.top ? esc(r.top) : "–") + '<small>' + (r.top ? D(r.expC[r.top]) : "no expenses") + '</small></dd></div>';
    h += '<div class="stat"><dt>Largest expense</dt><dd>' + (r.big ? D(r.big.a) : "–") + '<small>' + (r.big ? esc(r.big.cat) : "") + '</small></dd></div>';
    $("#rStats").innerHTML = h;
    lineChart($("#rChart"), r.daily.map(function (d) { return { d: d.date, v: round2(d.cum) }; }), "Cumulative net cash flow");
    $("#rExp").innerHTML = catTable(r.expC, r.exp, false); $("#rInc").innerHTML = catTable(r.incC, r.inc, true);
    $("#rWal").innerHTML = table(["Wallet", "In", "Out", "Net"], Object.keys(r.wal).map(function (k) { var x = r.wal[k], n = x.inc - x.exp; return tr([esc(x.name), '<span class="win">' + D(x.inc) + "</span>", '<span class="loss">' + D(x.exp) + "</span>", '<span class="' + cls(n) + '">' + D(n, true) + "</span>"]); }));
    var dl = state.sortNew ? r.daily.slice().reverse() : r.daily;
    $("#rDaily").innerHTML = table(["Date", "Items", "In", "Out", "Net", "Cumulative"], dl.map(function (d) {
      return tr(['<button type="button" class="linkbtn" data-goto="' + d.date + '">' + esc(fmtDate(d.date)) + "</button>", d.n, '<span class="win">' + D(d.inc) + "</span>", '<span class="loss">' + D(d.exp) + "</span>", '<span class="' + cls(d.net) + '">' + D(d.net, true) + "</span>", '<span class="' + cls(d.cum) + '">' + D(d.cum, true) + "</span>"]);
    }));
    $("#sortBtn").textContent = state.sortNew ? "Newest first ↓" : "Oldest first ↑";
  }
  $("#sortBtn").addEventListener("click", function () { state.sortNew = !state.sortNew; renderReport(); });
  $("#rFrom").addEventListener("change", function () { syncMonth(); render(); }); $("#rTo").addEventListener("change", function () { syncMonth(); render(); });
  document.querySelectorAll("[data-preset]").forEach(function (b) { b.addEventListener("click", function () { var p = presets()[b.getAttribute("data-preset")]; $("#rFrom").value = p[0]; $("#rTo").value = p[1]; rmsg(""); syncMonth(); render(); }); });
  function use(name) { try { return window.claude && window.claude.use ? Promise.resolve(window.claude.use(name)).catch(function () { return null; }) : Promise.resolve(null); } catch (e) { return Promise.resolve(null); } }
  function saveFile(name, data, mime) {
    return use("downloads").then(function (dl) {
      if (dl) return dl.save({ filename: name, data: data }).then(function () { return "ok"; }, function (e) { return e && e.code === "declined" ? "declined" : "err"; });
      try {
        var url = URL.createObjectURL(new Blob([data], { type: mime })), a = document.createElement("a");
        a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(url); }, 2000); return "ok";
      } catch (e) { return "err"; }
    });
  }
  function ready() {
    if ($("#rErr").textContent || !state.rep) { rmsg("Fix the date range first.", true); return null; }
    if (!state.rep.r.n) { rmsg("No transactions in this range to export.", true); return null; }
    return state.rep;
  }
  function done(res, what) { if (res === "ok") rmsg("Exported " + what + "."); else if (res === "err") rmsg("Could not export the file.", true); }
  function exportRow(t) {
    var w = wmap[t.wallet], a = conv(t.amount, w.cur, null, t.date);
    return [t.date, t.kind === "in" ? "Income" : t.kind === "out" ? "Expense" : "Transfer", w.name, w.cur, t.amount, t.kind === "xfer" ? wmap[t.to].name : "", t.kind === "xfer" ? t.toAmount : "", t.cat || "", t.note || "", t.kind === "xfer" ? "" : round2(t.kind === "in" ? a : -a), t.payee || "", t.pay || "", t.labels || "", t.sub || ""];
  }
  var EH = ["Date", "Type", "Wallet", "Currency", "Amount", "To wallet", "Amount received", "Category", "Note", "Net in " + "display currency", "Payee", "Payment type", "Labels", "Subcategory"];
  $("#rExportX").addEventListener("click", function () {
    if (!window.XLSX) { rmsg("Excel export could not load. Use Export CSV instead.", true); return; }
    var rep = ready(); if (!rep) return;
    var r = rep.r, M = "#,##0.00;-#,##0.00";
    var s1 = [["Wallet report"], ["From", rep.from], ["To", rep.to], ["Display currency", state.disp], [], ["Metric", "Value"],
      ["Net cash flow", round2(r.net)], ["Money in", round2(r.inc)], ["Money out", round2(r.exp)], ["Savings rate", r.inc > 0 ? r.net / r.inc : ""],
      ["Transactions", r.n], ["Average daily spend", round2(r.exp / r.span)], [], ["Rates used (units per 1 USD)"]];
    CODES.forEach(function (k) { s1.push([k, state.rates[k]]); });
    var ws1 = XLSX.utils.aoa_to_sheet(s1); ws1["!cols"] = [{ wch: 26 }, { wch: 18 }];
    [7, 8, 9, 12].forEach(function (n) { var c = ws1["B" + n]; if (c && typeof c.v === "number") c.z = M; });
    if (ws1.B10 && typeof ws1.B10.v === "number") ws1.B10.z = "0%";
    var head = EH.slice(); head[9] = "Net in " + state.disp;
    var a2 = [head]; r.rows.forEach(function (t) { a2.push(exportRow(t)); });
    var last = r.rows.length + 1;
    a2.push(["", "Total", "", "", "", "", "", "", "", { t: "n", v: round2(r.net), f: "SUM(J2:J" + last + ")" }]);
    var ws2 = XLSX.utils.aoa_to_sheet(a2);
    ws2["!cols"] = [{ wch: 12 }, { wch: 10 }, { wch: 20 }, { wch: 9 }, { wch: 14 }, { wch: 20 }, { wch: 16 }, { wch: 14 }, { wch: 36 }, { wch: 16 }, { wch: 20 }, { wch: 14 }, { wch: 20 }, { wch: 24 }];
    for (var i = 2; i <= last + 1; i++) ["E", "G", "J"].forEach(function (col) { var c = ws2[col + i]; if (c && typeof c.v === "number") c.z = M; });
    var a3 = [["Date", "Items", "In", "Out", "Net", "Cumulative"]];
    r.daily.forEach(function (d) { a3.push([d.date, d.n, round2(d.inc), round2(d.exp), round2(d.net), round2(d.cum)]); });
    var ws3 = XLSX.utils.aoa_to_sheet(a3); ws3["!cols"] = [{ wch: 12 }, { wch: 8 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }];
    for (var j = 2; j <= r.daily.length + 1; j++) ["C", "D", "E", "F"].forEach(function (col) { var c = ws3[col + j]; if (c) c.z = M; });
    var a4 = [["Type", "Category", "Amount in " + state.disp]];
    Object.keys(r.expC).sort(function (a, b) { return r.expC[b] - r.expC[a]; }).forEach(function (k) { a4.push(["Expense", k, round2(r.expC[k])]); });
    Object.keys(r.incC).sort(function (a, b) { return r.incC[b] - r.incC[a]; }).forEach(function (k) { a4.push(["Income", k, round2(r.incC[k])]); });
    var ws4 = XLSX.utils.aoa_to_sheet(a4); ws4["!cols"] = [{ wch: 10 }, { wch: 22 }, { wch: 18 }];
    for (var q = 2; q <= a4.length; q++) if (ws4["C" + q]) ws4["C" + q].z = M;
    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws1, "Summary"); XLSX.utils.book_append_sheet(wb, ws2, "Transactions");
    XLSX.utils.book_append_sheet(wb, ws3, "Daily"); XLSX.utils.book_append_sheet(wb, ws4, "By category");
    var out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    saveFile("wallet-report-" + rep.from + "_to_" + rep.to + ".xlsx", out, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet").then(function (res) { done(res, "report to Excel"); });
  });

  /* ===== Import (same layout as Export CSV / the Transactions sheet of Export Excel) ===== */
  function parseCSV(text) {
    var rows = [], row = [], f = "", q = false, i = 0, c;
    if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
    for (; i < text.length; i++) {
      c = text[i];
      if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
      else if (c === '"') q = true;
      else if (c === ",") { row.push(f); f = ""; }
      else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; row.push(f); rows.push(row); row = []; f = ""; }
      else f += c;
    }
    if (f !== "" || row.length) { row.push(f); rows.push(row); }
    return rows;
  }
  function impDate(v) {
    v = String(v == null ? "" : v).trim();
    var m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(v) || null, y, mo, d;
    if (m) { y = +m[1]; mo = +m[2]; d = +m[3]; }
    else if ((m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(v))) { mo = +m[1]; d = +m[2]; y = +m[3]; }
    else return "";
    var dt = new Date(y, mo - 1, d);
    if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return "";
    return y + "-" + pad(mo) + "-" + pad(d);
  }
  function impNum(v) { var n = parseFloat(String(v == null ? "" : v).replace(/[^0-9.\-]/g, "")); return isFinite(n) ? n : NaN; }
  function importRows(rows) {
    var hi = -1, k;
    for (k = 0; k < rows.length && hi < 0; k++) { var low = rows[k].map(function (x) { return String(x == null ? "" : x).trim().toLowerCase(); }); if (low.indexOf("date") >= 0 && low.indexOf("wallet") >= 0 && low.indexOf("amount") >= 0) hi = k; }
    if (hi < 0) { rmsg("That file doesn't look like a wallet export. It needs Date, Type, Wallet and Amount columns.", true); return; }
    var H = rows[hi].map(function (x) { return String(x == null ? "" : x).trim().toLowerCase(); });
    function col(n) { return H.indexOf(n); }
    var C = { date: col("date"), type: col("type"), wallet: col("wallet"), cur: col("currency"), amt: col("amount"), to: col("to wallet"), amt2: col("amount received"), cat: col("category"), note: col("note"), payee: col("payee"), pay: col("payment type"), labels: col("labels"), sub: col("subcategory") };
    function g(r, n) { var v = C[n] < 0 ? "" : r[C[n]]; v = v == null ? "" : String(v).trim(); return /^'[=+\-@]/.test(v) ? v.slice(1) : v; }
    var existing = {}; function key(t) { return [t.date, t.kind, t.wallet, t.amount, t.to || "", t.cat || "", t.note || "", t.payee || ""].join("|"); }
    state.tx.forEach(function (t) { if (validT(t)) { var kk = key(t); existing[kk] = (existing[kk] || 0) + 1; } });
    var newW = [], wByName = {};
    function findW(name, cur) {
      var l = name.toLowerCase(), hit = state.wallets.filter(function (w) { return w.name.toLowerCase() === l; });
      if (hit.length > 1 && cur) { var by = hit.filter(function (w) { return w.cur === cur; }); if (by.length) hit = by; }
      if (hit.length) return hit[0];
      if (wByName[l]) return wByName[l];
      var o = { name: name, type: "Bank", cur: cur && CUR[cur] ? cur : "PHP", opening: 0, last4: "", exp: "", limit: 0, stmt: 0, due: 0, createdAt: Date.now(), id: gid("w") };
      wByName[l] = o; newW.push(o); return o;
    }
    var add = [], dup = 0, bad = [], skipped = 0;
    for (k = hi + 1; k < rows.length; k++) {
      var r = rows[k], rn = k + 1, type = g(r, "type").toLowerCase(), nm = g(r, "wallet");
      if (!r.some(function (x) { return String(x == null ? "" : x).trim() !== ""; }) || type === "total" || /^example\b/i.test(g(r, "note"))) continue;
      var kind = type === "income" ? "in" : type === "expense" ? "out" : type === "transfer" ? "xfer" : "";
      var date = impDate(g(r, "date")), amt = Math.abs(impNum(g(r, "amt")));
      if (!kind) { bad.push("row " + rn + ": type must be Income, Expense or Transfer"); continue; }
      if (!date) { bad.push("row " + rn + ": date should look like 2026-11-18"); continue; }
      if (!nm) { bad.push("row " + rn + ": no wallet"); continue; }
      if (!isFinite(amt) || amt === 0) { bad.push("row " + rn + ": amount is missing"); continue; }
      var cur = g(r, "cur").toUpperCase(), w = findW(nm, cur), t = { date: date, kind: kind, amount: rnd(amt, w.cur), wallet: w.id, cat: "", sub: "", note: g(r, "note"), to: "", toAmount: 0, createdAt: Date.now() + k };
      if (kind === "xfer") {
        var tn = g(r, "to");
        if (!tn) { bad.push("row " + rn + ": transfer has no 'To wallet'"); continue; }
        var w2 = findW(tn, ""); if (w2.id === w.id) { bad.push("row " + rn + ": transfer to the same wallet"); continue; }
        t.to = w2.id; var a2 = Math.abs(impNum(g(r, "amt2")));
        t.toAmount = w2.cur === w.cur ? t.amount : (isFinite(a2) && a2 > 0 ? rnd(a2, w2.cur) : rnd(conv(t.amount, w.cur, w2.cur, date), w2.cur));
      } else { t.cat = g(r, "cat") || (kind === "in" ? "Income" : "Other"); t.sub = g(r, "sub"); t.payee = g(r, "payee"); t.pay = g(r, "pay") || "Cash"; t.labels = g(r, "labels"); }
      var kk2 = key(t); if (existing[kk2] > 0) { existing[kk2]--; dup++; continue; }
      add.push(t);
    }
    if (!add.length) { rmsg((dup ? "Nothing new to import: " + dup + " transaction" + (dup === 1 ? " is" : "s are") + " already in the wallet." : "No transactions found in that file.") + (bad.length ? " Skipped " + bad.length + " (" + bad.slice(0, 3).join("; ") + ")." : ""), !dup); return; }
    var msg = "Imported " + add.length + " transaction" + (add.length === 1 ? "" : "s") + (newW.length ? ", created " + newW.length + " new account" + (newW.length === 1 ? "" : "s") + " (" + newW.map(function (x) { return x.name; }).join(", ") + ")" : "") + (dup ? ", skipped " + dup + " already in the wallet" : "") + (bad.length ? ", skipped " + bad.length + " with problems (" + bad.slice(0, 3).join("; ") + (bad.length > 3 ? "; …" : "") + ")" : "") + ".";
    if (state.col || state.wcol) {
      Promise.all(newW.map(function (x) { return put("w", x); }).concat(add.map(function (t) { return put("t", t); }))).then(function () { rmsg(msg, bad.length > 0); });
    } else {
      newW.forEach(function (x) { state.wallets.push(x); });
      add.forEach(function (t) { t.id = gid("t"); state.tx.push(t); });
      saveLocal(); render(); rmsg(msg, bad.length > 0);
    }
  }
  $("#rTemplate").addEventListener("click", function () {
    if (!window.XLSX) { rmsg("Excel could not load, so the template can't be made.", true); return; }
    var w1 = state.wallets[0] ? state.wallets[0].name : "Cash - wallet", w2 = state.wallets[1] ? state.wallets[1].name : "BPI", c1 = state.wallets[0] ? state.wallets[0].cur : "PHP", c2 = state.wallets[1] ? state.wallets[1].cur : "PHP", td = todayStr;
    var H = ["Date", "Type", "Wallet", "Currency", "Amount", "To wallet", "Amount received", "Category", "Subcategory", "Payee", "Payment type", "Labels", "Note"];
    var rows = [H,
      [td, "Expense", w1, c1, 250, "", "", CATS.out[0] || "Food & Drinks", "", "Jollibee", "Cash", "work", "EXAMPLE - delete this row"],
      [td, "Income", w2, c2, 15000, "", "", CATS["in"][0] || "Salary", "", "Employer", "Bank transfer", "", "EXAMPLE - delete this row"],
      [td, "Transfer", w2, c2, 2000, w1, 2000, "", "", "", "", "", "EXAMPLE - delete this row"]];
    var ws = XLSX.utils.aoa_to_sheet(rows); ws["!cols"] = [{ wch: 12 }, { wch: 10 }, { wch: 22 }, { wch: 9 }, { wch: 12 }, { wch: 22 }, { wch: 16 }, { wch: 18 }, { wch: 16 }, { wch: 18 }, { wch: 14 }, { wch: 14 }, { wch: 28 }];
    for (var i = 2; i <= 4; i++) { var c = ws["E" + i]; if (c) c.z = "#,##0.00"; var c2x = ws["G" + i]; if (c2x && typeof c2x.v === "number") c2x.z = "#,##0.00"; }
    var ins = [["How to use this template"], [],
      ["1.", "Fill in the Transactions sheet, one transaction per row. Delete the three example rows (their Note starts with EXAMPLE; rows like that are skipped anyway)."],
      ["2.", "Date: year-month-day, like 2026-11-18."],
      ["3.", "Type: Expense, Income or Transfer."],
      ["4.", "Wallet: the account's name exactly as it appears in the app. A name that doesn't exist yet is created as a new Bank account with a 0 opening balance."],
      ["5.", "Currency: optional. It is only used when a new wallet has to be created (PHP, USD, AUD, JPY or GBP)."],
      ["6.", "Amount: a positive number in the wallet's own currency, no currency symbol."],
      ["7.", "Transfers only: fill in To wallet. Amount received is only needed when the two wallets use different currencies; leave it blank to use the current rate."],
      ["8.", "Expense and Income: Category is optional (blank becomes Other or Income). Subcategory, Payee, Payment type, Labels (separated by commas) and Note are all optional."],
      ["9.", "Save the file, then choose Import / Export > Bulk upload and pick it. Transactions already in the wallet are skipped, so uploading the same file twice is safe."],
      [], ["Your wallets", "Currency", "Type"]];
    state.wallets.forEach(function (w) { ins.push([w.name, w.cur, w.type]); });
    ins.push([], ["Expense categories"]); CATS.out.forEach(function (x) { ins.push([x]); });
    ins.push([], ["Income categories"]); CATS["in"].forEach(function (x) { ins.push([x]); });
    ins.push([], ["Payment types"]); ["Cash", "Debit card", "Credit card", "Bank transfer", "E-wallet", "Check", "Other"].forEach(function (x) { ins.push([x]); });
    var wi = XLSX.utils.aoa_to_sheet(ins); wi["!cols"] = [{ wch: 26 }, { wch: 100 }, { wch: 14 }];
    var wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Transactions"); XLSX.utils.book_append_sheet(wb, wi, "Instructions");
    saveFile("wallet-upload-template.xlsx", XLSX.write(wb, { bookType: "xlsx", type: "array" }), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet").then(function (res) { if (res === "ok") rmsg("Downloaded the upload template."); else if (res === "err") rmsg("Could not download the template.", true); });
  });
  $("#rImport").addEventListener("click", function () { $("#rImportFile").click(); });
  $("#rImportFile").addEventListener("change", function () {
    var f = this.files && this.files[0], inp = this; if (!f) return;
    var isX = /\.xlsx?$/i.test(f.name), rd = new FileReader();
    rd.onerror = function () { rmsg("Could not read that file.", true); inp.value = ""; };
    rd.onload = function () {
      try {
        if (isX) {
          if (!window.XLSX) { rmsg("Excel import could not load. Use a CSV file instead.", true); return; }
          var wb = XLSX.read(rd.result, { type: "array", cellDates: true }), name = wb.SheetNames.indexOf("Transactions") >= 0 ? "Transactions" : wb.SheetNames[0];
          importRows(XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: false, dateNF: "yyyy-mm-dd", defval: "" }));
        } else importRows(parseCSV(String(rd.result)));
      } catch (e) { rmsg("Could not import that file.", true); }
      inp.value = "";
    };
    if (isX) rd.readAsArrayBuffer(f); else rd.readAsText(f);
  });

  (function () {
    /* the menu is moved to <body> while open so no panel can cover or clip it */
    var btn = $("#ddBtn"), menu = $("#ddMenu"), home = menu.parentNode;
    function place() { var r = btn.getBoundingClientRect(); menu.style.top = (r.bottom + 6) + "px"; menu.style.right = Math.max(8, window.innerWidth - r.right) + "px"; }
    function setOpen(o) {
      if (o) { document.body.appendChild(menu); place(); menu.hidden = false; }
      else { menu.hidden = true; home.appendChild(menu); }
      btn.setAttribute("aria-expanded", String(o));
    }
    btn.addEventListener("click", function (e) { e.stopPropagation(); setOpen(menu.hidden); if (!menu.hidden) { var f = menu.querySelector("button"); if (f) f.focus(); } });
    menu.addEventListener("click", function () { setOpen(false); });
    document.addEventListener("click", function (e) { if (!menu.hidden && !e.target.closest("#ddIO, #ddMenu")) setOpen(false); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !menu.hidden) { setOpen(false); btn.focus(); } });
    window.addEventListener("resize", function () { if (!menu.hidden) place(); });
    window.addEventListener("scroll", function () { if (!menu.hidden) setOpen(false); }, true);
  })();

  /* ===== Custom categories and subcategories ===== */
  var BASE_TREE = JSON.parse(JSON.stringify(CATTREE));
  state.cats = { out: {}, "in": {} };
  try { var sc0 = JSON.parse(localStorage.getItem("wl-cats")); if (sc0 && typeof sc0 === "object") state.cats = { out: sc0.out || {}, "in": sc0["in"] || {} }; } catch (e) {}
  function ciFind(list, name) { var l = String(name).toLowerCase(), r = null; list.forEach(function (x) { if (r === null && String(x).toLowerCase() === l) r = x; }); return r; }
  function applyCats() {
    ["out", "in"].forEach(function (k) {
      var tree = JSON.parse(JSON.stringify(BASE_TREE[k])), cu = state.cats[k] || {};
      Object.keys(cu).forEach(function (c) {
        var key = ciFind(Object.keys(tree), c) || c; if (!tree[key]) tree[key] = [];
        (Array.isArray(cu[c]) ? cu[c] : []).forEach(function (sb) { if (!ciFind(tree[key], sb)) tree[key].push(sb); });
      });
      CATTREE[k] = tree; CATS[k].length = 0; Object.keys(tree).forEach(function (x) { CATS[k].push(x); });
    });
  }
  applyCats();
  function saveCats() {
    try { localStorage.setItem("wl-cats", JSON.stringify(state.cats)); } catch (e) {}
    syncPrefs(); applyCats();
    document.querySelectorAll("datalist").forEach(function (d) { d.removeAttribute("data-s"); });
    render();
  }
  var catDlg = $("#catDlg"), catKind = "out";
  function catMsg(t, warn) { $("#catErr").textContent = warn ? t : ""; $("#catMsg").textContent = warn ? "" : t; }
  function renderCatDlg() {
    var k = catKind, keep = $("#catParent").value;
    document.querySelectorAll("[data-ck]").forEach(function (b) { b.setAttribute("aria-pressed", String(b.getAttribute("data-ck") === k)); });
    $("#catParent").innerHTML = CATS[k].map(function (c) { return '<option value="' + esc(c) + '">' + esc(c) + "</option>"; }).join("");
    if (keep && ciFind(CATS[k], keep)) $("#catParent").value = ciFind(CATS[k], keep);
    var ex = CATTREE[k][$("#catParent").value] || [];
    $("#catExisting").textContent = ex.length ? "Already there: " + ex.join(", ") : "No subcategories yet.";
    var cu = state.cats[k] || {}, h = "";
    Object.keys(cu).forEach(function (c) {
      var isBase = !!ciFind(Object.keys(BASE_TREE[k]), c);
      if (!isBase) h += '<li><span>' + esc(c) + '<small>new category</small></span><button type="button" data-rmc="' + esc(encodeURIComponent(c)) + '">Remove</button></li>';
      (cu[c] || []).forEach(function (sb) { h += '<li><span>' + esc(sb) + '<small>under ' + esc(c) + '</small></span><button type="button" data-rms="' + esc(encodeURIComponent(c)) + '|' + esc(encodeURIComponent(sb)) + '">Remove</button></li>'; });
    });
    $("#catMine").innerHTML = h || '<li class="empty">Nothing added yet.</li>';
  }
  function openCatDlg() { catKind = "out"; $("#catNew").value = ""; $("#subNew").value = ""; catMsg(""); renderCatDlg(); if (!catDlg.open) catDlg.showModal(); $("#catNew").focus(); }
  $("#qaCat").addEventListener("click", openCatDlg);
  $("#catClose").addEventListener("click", function () { catDlg.close(); });
  $("#catKind").addEventListener("click", function (e) { var b = e.target.closest("[data-ck]"); if (!b) return; catKind = b.getAttribute("data-ck"); catMsg(""); renderCatDlg(); });
  $("#catParent").addEventListener("change", renderCatDlg);
  function addCat() {
    var name = $("#catNew").value.trim().replace(/\s+/g, " "), k = catKind;
    if (!name) { catMsg("Type a category name.", true); $("#catNew").focus(); return; }
    if (ciFind(CATS[k], name)) { catMsg("There is already a " + (k === "in" ? "income" : "expense") + " category called " + ciFind(CATS[k], name) + ".", true); return; }
    state.cats[k][name] = state.cats[k][name] || []; saveCats();
    $("#catNew").value = ""; $("#catParent").value = name; renderCatDlg(); catMsg("Added " + name + ". It now shows when you pick a category.");
    $("#subNew").focus();
  }
  function addSub() {
    var name = $("#subNew").value.trim().replace(/\s+/g, " "), k = catKind, parent = $("#catParent").value;
    if (!parent) { catMsg("Pick a category first.", true); return; }
    if (!name) { catMsg("Type a subcategory name.", true); $("#subNew").focus(); return; }
    if (ciFind(CATTREE[k][parent] || [], name)) { catMsg(parent + " already has a subcategory called " + ciFind(CATTREE[k][parent], name) + ".", true); return; }
    var cu = state.cats[k], key = ciFind(Object.keys(cu), parent) || parent; cu[key] = (cu[key] || []).concat([name]); saveCats();
    $("#subNew").value = ""; $("#catParent").value = parent; renderCatDlg(); catMsg("Added " + name + " under " + parent + ".");
    $("#subNew").focus();
  }
  $("#catAdd").addEventListener("click", addCat); $("#subAdd").addEventListener("click", addSub);
  $("#catNew").addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); addCat(); } });
  $("#subNew").addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); addSub(); } });
  $("#catMine").addEventListener("click", function (e) {
    var k = catKind, cu = state.cats[k], c, p;
    var rc = e.target.closest("[data-rmc]"), rs = e.target.closest("[data-rms]");
    if (rc) { delete cu[decodeURIComponent(rc.getAttribute("data-rmc"))]; }
    else if (rs) {
      p = rs.getAttribute("data-rms").split("|"); c = decodeURIComponent(p[0]); var sb = decodeURIComponent(p[1]);
      cu[c] = (cu[c] || []).filter(function (x) { return x !== sb; });
      if (!cu[c].length && ciFind(Object.keys(BASE_TREE[k]), c)) delete cu[c];
    } else return;
    saveCats(); renderCatDlg(); catMsg("Removed. Transactions that used it keep their category text.");
  });

  /* ===== Rates ===== */
  var rateNote = "";
  var pcol = null, prefsReady = false;
  function syncPrefs() { if (pcol) try { pcol.doc("main").set({ budget: state.budget, rates: state.rates, locks: state.locks, rsrc: state.rsrc, eom: state.eom, budgets: state.budgets, cats: state.cats, dlayout: state.dl, rlayout: state.rl, clayout: state.cl }); } catch (e) {} }
  function saveLocks() { try { localStorage.setItem("wl-locks", JSON.stringify(state.locks)); } catch (e) {} syncPrefs(); }
  /* r = last live rate captured in that month; prov = no capture exists, so keep a provisional lock that is replaced by the official month-end rate */
  function mkLock(r, prov) {
    var o = Object.assign({}, state.rates); o._u = false;
    if (r) { CODES.forEach(function (c) { if (r[c] > 0) o[c] = r[c]; }); o._src = "Live"; o._at = r._at || todayStr; }
    else if (prov) { o._src = "Pending"; o._at = todayStr; }
    else { o._src = state.rsrc.s; o._at = state.rsrc.d || todayStr; }
    return o;
  }
  function nextMonthKey(k) { var p = k.split("-"), y = +p[0], m = +p[1] + 1; if (m > 12) { m = 1; y++; } return y + "-" + pad(m); }
  function applySeed() {
    var ch = false;
    var cm = todayStr.slice(0, 7); if (state.locks[cm] && !state.locks[cm]._src) { delete state.locks[cm]; ch = true; }
    if (state.rsrc.s === "Default") { state.rates = Object.assign({}, DEF_RATES); state.rsrc = { s: "ECB", d: NOV[0] }; saveRates(); }
    Object.keys(SEED).forEach(function (k) {
      var L = state.locks[k];
      if (!L || (L._src !== "Manual" && L._src !== "ECB")) { var o = Object.assign({}, DEF_RATES, fromEur(SEED[k])); o._src = "ECB"; o._at = SEED[k][0]; o._u = false; state.locks[k] = o; ch = true; }
    });
    if (ch) saveLocks();
  }
  /* Every month before the current one gets locked automatically, whether or not it has transactions.
     Closing rate priority: official month-end rate > last live rate seen that month > provisional (upgraded later). */
  function autoClose() {
    if (!prefsReady) return;
    applySeed();
    var cur = todayStr.slice(0, 7), ch = false, first = cur, valid = /^\d{4}-\d{2}$/, i;
    state.tx.forEach(function (t) { var k = t && typeof t.date === "string" ? t.date.slice(0, 7) : ""; if (valid.test(k) && k < first) first = k; });
    Object.keys(state.locks).forEach(function (k) { if (valid.test(k) && k < first) first = k; });
    for (var k = first, n = 0; k < cur && n < 600; k = nextMonthKey(k), n++) {
      if (!state.locks[k]) { var e = state.eom[k]; state.locks[k] = mkLock(e, !e); ch = true; }
    }
    if (ch) saveLocks();
    var budget = 6; /* newest months first, a few official look-ups per pass */
    Object.keys(state.locks).sort().reverse().forEach(function (k) {
      var L = state.locks[k];
      if (k < cur && L && L._src !== "ECB" && L._src !== "Manual" && !tried[k] && budget-- > 0) upgradeClose(k);
    });
    refreshLive(false).then(function (c) { if (c) render(); });
  }
  function saveRates() { try { localStorage.setItem("wl-rates", JSON.stringify(state.rates)); localStorage.setItem("wl-rsrc", JSON.stringify(state.rsrc)); } catch (e) {} syncPrefs(); }
  var rBase = "USD", rYear = now.getFullYear();
  function monthKeys() {
    var set = {}; set[todayStr.slice(0, 7)] = 1;
    state.tx.forEach(function (t) { if (t && typeof t.date === "string") set[t.date.slice(0, 7)] = 1; });
    Object.keys(state.locks).forEach(function (k) { set[k] = 1; });
    return Object.keys(set).sort().reverse();
  }
  function fmtMonth(k) { var p = k.split("-"); return MONTHS[+p[1] - 1] + " " + p[0]; }
  function srcLabel(s, d) { return s === "Live" ? "Live · " + new Date(d).toLocaleString([], { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : s === "ECB" ? "ECB · " + fmtDate(d) : s === "Manual" ? "Manual" + (d ? " · " + fmtDate(d) : "") : s === "Pending" ? "Provisional · official close pending" : s ? "Default rates" : "Saved rates"; }
  function renderRates() {
    var keys = monthKeys(), yr = {}; keys.forEach(function (k) { yr[k.slice(0, 4)] = 1; });
    var ys = Object.keys(yr).sort().reverse(); if (ys.indexOf(String(rYear)) < 0) rYear = +ys[0];
    $("#rBase").innerHTML = CODES.map(function (k) { return '<option value="' + k + '">' + esc(CUR[k].sym + " " + CUR[k].name) + "</option>"; }).join(""); $("#rBase").value = rBase;
    $("#rYear").innerHTML = ys.map(function (y) { return "<option>" + y + "</option>"; }).join(""); $("#rYear").value = String(rYear);
    var cols = CODES.filter(function (k) { return k !== rBase; });
    var rows = keys.filter(function (k) { return k.indexOf(rYear + "-") === 0; }).map(function (k) {
      var L = state.locks[k], R = L || state.rates, locked = L && !L._u, st;
      if (!L) st = '<span class="rst">Open · live rate · ' + esc(srcLabel(state.rsrc.s, state.rsrc.d)) + ' · locks automatically when the month ends</span> <button type="button" class="btn sm" data-lk="' + k + '">Lock now</button>';
      else st = '<span class="rst' + (locked ? " lk" : "") + '">' + (locked ? "Locked" : "Unlocked") + " · " + esc(srcLabel(L._src, L._at)) + '</span> <button type="button" class="btn sm" data-lk="' + k + '">' + (locked ? "Unlock" : "Lock") + "</button>";
      return tr([esc(fmtMonth(k))].concat(cols.map(function (c) {
        return '<input type="number" step="any" min="0" inputmode="decimal" data-rc="' + c + '" data-rm="' + k + '" value="' + Number((R[c] / R[rBase]).toPrecision(6)) + '"' + (locked ? " disabled" : "") + ' aria-label="' + esc(fmtMonth(k) + ": " + c + " per 1 " + rBase) + '">';
      }), [st]));
    });
    $("#rTable").innerHTML = table(["Month"].concat(cols.map(function (c) { return CUR[c].sym + " " + c; }), ["Status"]), rows);
    $("#rSubT").textContent = "How much of each currency 1 " + CUR[rBase].sym + " buys";
    $("#rNote").textContent = rateNote || "Type over any rate to override it. Locked months stay put until you unlock them.";
  }
  $("#rBase").addEventListener("change", function () { rBase = this.value; renderRates(); });
  $("#rYear").addEventListener("change", function () { rYear = +this.value; renderRates(); });
  $("#rTable").addEventListener("change", function (e) {
    var i = e.target.closest("input[data-rc]"); if (!i) return;
    var v = parseFloat(i.value), x = i.getAttribute("data-rc"), k = i.getAttribute("data-rm"), L = state.locks[k], R = L || state.rates;
    if (isFinite(v) && v > 0) {
      if (x === "USD") R[rBase] = R.USD / v; else R[x] = v * R[rBase];
      if (L) { L._src = "Manual"; L._at = todayStr; saveLocks(); } else { state.rsrc = { s: "Manual", d: todayStr }; saveRates(); }
      rateNote = "";
    }
    render();
  });
  $("#rTable").addEventListener("click", function (e) {
    var b = e.target.closest("[data-lk]"); if (!b) return;
    var k = b.getAttribute("data-lk"), L = state.locks[k];
    if (!L) state.locks[k] = mkLock(); else L._u = !L._u;
    saveLocks(); render();
  });
  $("#rReset").addEventListener("click", function () { state.rates = Object.assign({}, DEF_RATES); state.rsrc = { s: "ECB", d: NOV[0] }; saveRates(); rateNote = "Latest rates reset to the ECB rates of " + fmtDate(NOV[0]) + "."; render(); });
  function okj(r) { if (!r.ok) throw new Error("http"); return r.json(); }
  var LSRC = [
    function () { return fetch("https://open.er-api.com/v6/latest/USD").then(okj).then(function (j) { if (j.result !== "success") throw new Error("bad"); return { r: j.rates, d: new Date().toISOString() }; }); },
    function () { return fetch("https://api.frankfurter.dev/v1/latest?base=USD&symbols=PHP,AUD,JPY,GBP").then(okj).then(function (j) { return { r: j.rates, d: new Date().toISOString() }; }); },
    function () { return fetch("https://api.frankfurter.app/latest?from=USD&to=PHP,AUD,JPY,GBP").then(okj).then(function (j) { return { r: j.rates, d: new Date().toISOString() }; }); }
  ];
  var lastLive = 0, tried = {};
  function saveEom() { try { localStorage.setItem("wl-eom", JSON.stringify(state.eom)); } catch (e) {} syncPrefs(); }
  function refreshLive(force) {
    if (!force && (Date.now() - lastLive < 60000 || state.rsrc.s === "Manual")) return Promise.resolve(false);
    lastLive = Date.now();
    var p = Promise.reject(new Error("start"));
    try { p = LSRC.reduce(function (q, f) { return q.catch(f); }, p); } catch (e) {}
    return p.then(function (x) {
      var n = 0, e = { _at: x.d };
      CODES.forEach(function (c) { var v = Number(x.r && x.r[c]); if (c !== "USD" && isFinite(v) && v > 0) { state.rates[c] = v; e[c] = v; n++; } });
      if (!n) throw new Error("empty");
      state.rsrc = { s: "Live", d: x.d }; state.eom[todayStr.slice(0, 7)] = e; saveRates(); saveEom(); return true;
    }).catch(function () { return false; });
  }
  function upgradeClose(k) {
    if (tried[k]) return; tried[k] = 1;
    var q = k.split("-"), last = ds(+q[0], +q[1] - 1, new Date(+q[0], +q[1], 0).getDate());
    try {
      fetch("https://api.frankfurter.dev/v1/" + last + "?base=USD&symbols=PHP,AUD,JPY,GBP").then(okj).then(function (j) {
        var L = state.locks[k]; if (!L || L._src === "Manual" || L._src === "ECB") return;
        var n = 0; CODES.forEach(function (c) { var v = Number(j.rates && j.rates[c]); if (c !== "USD" && isFinite(v) && v > 0) { L[c] = v; n++; } });
        if (n) { L._src = "ECB"; L._at = j.date; saveLocks(); render(); }
      }).catch(function () {});
    } catch (e) {}
  }
  setInterval(function () { refreshLive(true).then(function (c) { if (c) render(); }); }, 600000);
  $("#rFetch").addEventListener("click", function () {
    var b = this; b.disabled = true; b.textContent = "Updating…";
    refreshLive(true).then(function (ok) {
      rateNote = ok ? "Live rates updated at " + new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) + ". Only the open month uses them; closed months keep their closing rates."
        : "Could not reach the live rate service from this page, so rates are unchanged. Outside requests are often blocked here, and live updates work when the file is opened in your own browser. You can also type a rate over any cell.";
      b.disabled = false; b.textContent = "Update rates"; render();
    });
  });

  /* ===== Render, views, init ===== */
  /* ===== Dashboard ===== */
  state.goals = []; state.gcol = null; state.recs = []; state.rcol = null;
  function colOf(kind) { return kind === "w" ? state.wcol : kind === "g" ? state.gcol : kind === "r" ? state.rcol : state.col; }
  function keyOf(kind) { return kind === "w" ? "wallets" : kind === "g" ? "goals" : kind === "r" ? "recs" : "tx"; }
  var sparkSel = -1, dSearch = "", dPeriod = "r", dCat = null, cardIdx = 0, gFormOpen = false, gEditId = null;
  function svgi(p) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + p + "</svg>"; }
  function colorVar(k) { return catMap[k] ? "var(--k" + catMap[k] + ")" : "var(--c6)"; }
  function addDays(s, n) { var d = parseD(s); d.setDate(d.getDate() + n); return dstr(d); }
  function spend(from, to) {
    var r = { total: 0, cats: {} };
    state.tx.forEach(function (t) {
      if (!validT(t) || t.kind !== "out" || t.date < from || t.date > to) return;
      var a = conv(t.amount, wmap[t.wallet].cur, null, t.date), k = t.cat || "Other"; r.total += a; r.cats[k] = (r.cats[k] || 0) + a;
    });
    return r;
  }
  /* The filter bar under the header drives every date-based widget */
  function fRange() {
    var f = $("#rFrom").value, t = $("#rTo").value;
    if (!f || !t || f > t) { var mp = todayStr.slice(0, 8); return { from: mp + "01", to: dstr(new Date(now.getFullYear(), now.getMonth() + 1, 0)) }; }
    return { from: f, to: t };
  }
  function fMonths(R) { return (+R.to.slice(0, 4) - +R.from.slice(0, 4)) * 12 + (+R.to.slice(5, 7) - +R.from.slice(5, 7)) + 1; }
  function inRange(d, R) { return d >= R.from && d <= R.to; }
  function fLabel(R) { return R.from === R.to ? fmtDate(R.from) : fmtDate(R.from) + " \u2013 " + fmtDate(R.to); }
  function fShort(R) {
    var last = dstr(new Date(+R.from.slice(0, 4), +R.from.slice(5, 7), 0));
    return R.from.slice(8) === "01" && R.to === last ? MONTHS[+R.from.slice(5, 7) - 1] : fLabel(R);
  }
  function syncMonth() {
    var R = fRange(); state.y = +R.to.slice(0, 4); state.m = +R.to.slice(5, 7) - 1;
    var prefix = monthPrefix(); if (state.sel.indexOf(prefix) !== 0) state.sel = todayStr.indexOf(prefix) === 0 ? todayStr : prefix + "01";
  }
  function setRangeToMonth() { $("#rFrom").value = ds(state.y, state.m, 1); $("#rTo").value = ds(state.y, state.m, new Date(state.y, state.m + 1, 0).getDate()); }
  function budgetNow() { return state.budget.amount > 0 ? conv(state.budget.amount, state.budget.cur) : 0; }

  function renderTiles() {
    var R = fRange(), mo = fMonths(R), inc = 0, exp = 0, nw = netWorth(balances()), budget = budgetNow(), gl = state.budget.goal > 0 ? conv(state.budget.goal, state.budget.cur) : 0;
    state.tx.forEach(function (t) {
      if (!validT(t) || !inRange(t.date, R)) return;
      var a = conv(t.amount, wmap[t.wallet].cur, null, t.date); if (t.kind === "in") inc += a; else if (t.kind === "out") exp += a;
    });
    var items = [
      ["Earnings", D(inc), "var(--win)", svgi('<path d="M7 17 17 7M9 7h8v8"/>'), ""],
      ["Spending", D(exp), "var(--loss)", svgi('<path d="M7 7l10 10M17 9v8H9"/>'), ""],
      ["Monthly savings goal", gl > 0 ? D(gl) : "Not set", "var(--accent)", svgi('<path d="M12 21s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 11c0 5.5-7 10-7 10z"/>'), gl > 0 ? Math.max(0, Math.round((inc - exp) / (gl * mo) * 100)) + "% reached" : ""],
      ["Monthly budget", budget > 0 ? D(budget) : "Not set", "var(--c3)", svgi('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4.5"/>'), budget > 0 ? Math.round(exp / (budget * mo) * 100) + "% used" : ""]
    ];
    $("#dTiles").innerHTML = items.map(function (x) {
      return '<div class="tile" style="--tc:' + x[2] + '"><span class="ic">' + x[3] + '</span><div><div class="tl">' + x[0] + '</div><div class="tv">' + x[1] + "</div>" + (x[4] ? '<div class="tl">' + x[4] + "</div>" : "") + "</div></div>";
    }).join("");
  }
  var cfN = 6, cfSel = null;
  function mAdd(k, d) { var q = k.split("-"), dt = new Date(+q[0], +q[1] - 1 + d, 1); return dt.getFullYear() + "-" + pad(dt.getMonth() + 1); }
  function cfData(n) {
    var cur = todayStr.slice(0, 7), keys = [], m = {}, i;
    for (i = n - 1; i >= 0; i--) keys.push(mAdd(cur, -i));
    keys.forEach(function (k) { m[k] = { k: k, inc: 0, exp: 0 }; });
    state.tx.forEach(function (t) {
      if (!validT(t) || t.kind === "xfer") return;
      var o = m[t.date.slice(0, 7)]; if (!o) return;
      var a = conv(t.amount, wmap[t.wallet].cur, null, t.date); if (t.kind === "in") o.inc += a; else o.exp += a;
    });
    return keys.map(function (k) { return m[k]; });
  }
  function renderCashflow() {
    var host = $("#dCash"); if (!host) return;
    var R = fRange(), inc = 0, exp = 0;
    state.tx.forEach(function (t) {
      if (!validT(t) || t.kind === "xfer" || !inRange(t.date, R)) return;
      var a = conv(t.amount, wmap[t.wallet].cur, null, t.date); if (t.kind === "in") inc += a; else exp += a;
    });
    var net = inc - exp;
    var head = '<div class="cfhead"><span>' + esc(fLabel(R)) + '</span><span>' + (inc > 0 ? "Kept " + pct(net / inc) + " of inflow" : "") + "</span></div>" +
      '<div class="cfstats"><div><span class="cl">Inflow</span><span class="num win">' + D(inc) + '</span></div><div><span class="cl">Outflow</span><span class="num loss">' + D(exp) + '</span></div><div><span class="cl">Net</span><span class="num ' + cls(net) + '">' + D(net, true) + "</span></div></div>";
    host.innerHTML = head + (inc || exp ? "" : '<p class="empty">No inflow or outflow logged in this range.</p>');
  }
  function renderSpark() {
    var host = $("#dSpark"), R = fRange(), span = Math.round((parseD(R.to) - parseD(R.from)) / 86400000) + 1, pts = [], total = 0, i, v;
    if (span <= 186) {
      var step = span <= 31 ? 1 : 7;
      for (i = 0; i < span; i += step) {
        var a = addDays(R.from, i), b = addDays(R.from, Math.min(span - 1, i + step - 1)); v = spend(a, b).total;
        pts.push({ d: a, v: v, t: step === 1 ? String(Number(a.slice(8))) : Number(a.slice(5, 7)) + "/" + Number(a.slice(8)) }); total += v;
      }
    } else {
      var k0 = R.from.slice(0, 7), kEnd = R.to.slice(0, 7);
      while (k0 <= kEnd) {
        var q = k0.split("-"), a2 = k0 === R.from.slice(0, 7) ? R.from : k0 + "-01", b2 = k0 === kEnd ? R.to : dstr(new Date(+q[0], +q[1], 0));
        v = spend(a2, b2).total; pts.push({ d: a2, v: v, t: MONTHS[+q[1] - 1].slice(0, 3) }); total += v; k0 = mAdd(k0, 1);
      }
    }
    var n = pts.length;
    $("#dSpTot").textContent = D(total);
    var mx = 0; pts.forEach(function (p) { if (p.v > mx) mx = p.v; });
    if (!mx) { host.innerHTML = '<p class="empty">No spending logged in this range.</p>'; return; }
    var max = mx * 1.15, W = Math.max(240, host.clientWidth || 320), H = 170, L = 46, R2 = 12, T = 14, B = 24, sel = sparkSel >= 0 && sparkSel < n ? sparkSel : n - 1;
    var xs = function (k) { return n > 1 ? L + k * (W - L - R2) / (n - 1) : (L + W - R2) / 2; }, ys = function (v2) { return T + (max - v2) * (H - T - B) / max; };
    var line = pts.map(function (p, k) { return xs(k).toFixed(1) + "," + ys(p.v).toFixed(1); }).join(" ");
    var area = "M" + xs(0).toFixed(1) + "," + (H - B) + " L" + line.split(" ").join(" L") + " L" + xs(n - 1).toFixed(1) + "," + (H - B) + " Z";
    var g = "";
    [0, max / 2, max].forEach(function (v2) {
      g += '<line class="grid" x1="' + L + '" x2="' + (W - R2) + '" y1="' + ys(v2).toFixed(1) + '" y2="' + ys(v2).toFixed(1) + '"/><text x="' + (L - 6) + '" y="' + (ys(v2) + 4).toFixed(1) + '" text-anchor="end">' + esc(v2 === 0 ? "0" : compact(v2).replace(/^\+/, "")) + "</text>";
    });
    var stride = Math.ceil(n / 12);
    var xl = pts.map(function (p, k) { return k % stride ? "" : '<text x="' + xs(k).toFixed(1) + '" y="' + (H - 6) + '" text-anchor="middle">' + esc(p.t) + "</text>"; }).join("");
    var last = pts[sel], hw = Math.max(6, (W - L - R2) / Math.max(1, n - 1));
    host.innerHTML = '<svg class="chart" viewBox="0 0 ' + W + " " + H + '" width="' + W + '" height="' + H + '" role="img" aria-label="' + esc("Spending over " + fLabel(R) + ", " + D(total) + " in total") + '">' +
      '<defs><linearGradient id="spg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--accent);stop-opacity:0.4"/><stop offset="1" style="stop-color:var(--accent);stop-opacity:0.02"/></linearGradient></defs>' +
      g + '<path d="' + area + '" fill="url(#spg)"/><polyline class="ln" points="' + line + '"/>' + xl +
      '<circle cx="' + xs(sel).toFixed(1) + '" cy="' + ys(last.v).toFixed(1) + '" r="5" style="fill:var(--surface);stroke:var(--accent);stroke-width:2"/><text class="big" x="' + Math.min(W - R2 - 30, Math.max(L + 30, xs(sel))).toFixed(1) + '" y="' + Math.max(T + 10, ys(last.v) - 12).toFixed(1) + '" text-anchor="middle">' + esc(compact(last.v).replace(/^\+/, "")) + "</text>" +
      pts.map(function (p, k) { return '<rect data-k="' + k + '" x="' + (xs(k) - hw / 2).toFixed(1) + '" y="0" width="' + hw.toFixed(1) + '" height="' + H + '" fill="transparent" style="cursor:pointer"/>'; }).join("") + "</svg>";
  }
  var actSel = null, actArm = null, actKind = "all", actWal = "", actLimit = 10, ACT_STEP = 10;
  var AIC = { out: '<path d="M7 17 17 7M9 7h8v8"/>', "in": '<path d="M17 7 7 17M15 17H7V9"/>', xfer: '<path d="M7 7h12l-3-3M17 17H5l3 3"/>' };
  function dayLabel(d) {
    if (d === todayStr) return "Today";
    if (d === addDays(todayStr, -1)) return "Yesterday";
    if (d === addDays(todayStr, 1)) return "Tomorrow";
    return parseD(d).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", year: parseD(d).getFullYear() === now.getFullYear() ? undefined : "numeric" });
  }
  function actReset() { actLimit = 10; }
  function renderActivity() {
    var q = dSearch.trim().toLowerCase(), M = dCat ? donutModel() : null, sel = null, R = fRange();
    if (M) M.list.forEach(function (x) { if (x.id === dCat) sel = x; });
    /* wallet dropdown (rebuilt only when the wallet list changes) */
    var wsel = $("#aWal"), sig = state.wallets.map(function (w) { return w.id + w.name; }).join("|");
    if (wsel.getAttribute("data-sig") !== sig) {
      wsel.setAttribute("data-sig", sig);
      wsel.innerHTML = '<option value="">All wallets</option>' + state.wallets.map(function (w) { return '<option value="' + esc(w.id) + '">' + esc(w.name) + "</option>"; }).join("");
    }
    if (actWal && !wmap[actWal]) actWal = "";
    wsel.value = actWal;
    document.querySelectorAll("[data-ak]").forEach(function (b) { b.setAttribute("aria-pressed", String(b.getAttribute("data-ak") === actKind)); });
    var rows = state.tx.filter(validT).filter(function (t) {
      if (!inRange(t.date, R)) return false;
      if (actKind !== "all" && t.kind !== actKind) return false;
      if (actWal && t.wallet !== actWal && t.to !== actWal) return false;
      if (sel && !(t.kind === "out" && sel.cats.indexOf(t.cat || "Other") >= 0)) return false;
      if (!q) return true;
      var w = wmap[t.wallet];
      return [t.cat, t.sub, t.note, t.payee, t.labels, t.pay, w.name, t.kind === "xfer" ? wmap[t.to].name + " transfer" : ""].join(" ").toLowerCase().indexOf(q) >= 0;
    }).sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : (b.createdAt || 0) - (a.createdAt || 0); });
    /* Today first, then everything else from newest to oldest */
    var tdy = rows.filter(function (t) { return t.date === todayStr; }), oth = rows.filter(function (t) { return t.date !== todayStr; });
    rows = tdy.concat(oth);
    var total = rows.length; actBulk.ids = rows.map(function (t) { return t.id; });
    var shown = rows.slice(0, Math.max(actLimit, sel ? 100 : 0)), more = total - shown.length;
    var filtered = actKind !== "all" || actWal || q;
    if (sel) $("#dActHint").innerHTML = esc(total + (total === 1 ? " transaction" : " transactions") + " · " + sel.name + " · " + fLabel(R)) + ' <button type="button" class="linkbtn plain" data-clearcat>Clear</button>';
    else $("#dActHint").textContent = !total ? "" : filtered ? total + (total === 1 ? " match" : " matches") : more > 0 ? "Showing " + shown.length + " of " + total : total + (total === 1 ? " transaction" : " transactions");
    var html = "", cur = "";
    if (!filtered && !sel && !tdy.length && inRange(todayStr, R)) html += '<div class="act-date"><span>Today</span></div><p class="empty">Nothing logged today yet.</p>';
    shown.forEach(function (t) {
      var w = wmap[t.wallet], amt, ac = "";
      if (t.kind === "xfer") amt = X(t.amount, w.cur, t.date);
      else { amt = X(t.kind === "in" ? t.amount : -t.amount, w.cur, t.date, true); ac = t.kind === "in" ? "win" : "loss"; }
      var sub = t.kind === "xfer" ? "" : esc(w.name) + extra(t); if (t.note) sub += (sub ? " · " : "") + esc(t.note);
      if (t.date !== cur) {
        cur = t.date;
        html += '<div class="act-date"><span>' + esc(dayLabel(t.date)) + "</span></div>";
      }
      var col = t.kind === "xfer" ? "var(--c6)" : colorVar(t.cat), on = !actBulk.mode && t.id === actSel, pk = actBulk.mode && actBulk.pick[t.id];
      var lead = actBulk.mode ? '<label class="apick"><input type="checkbox" data-pickbox aria-label="Select transaction"' + (pk ? " checked" : "") + '></label>' : '<span class="aic" style="--tc:' + col + '" title="' + esc(t.kind === "xfer" ? "Transfer" : t.cat || "Other") + '">' + svgi(AIC[t.kind]) + '</span>';
      html += '<div class="act' + (on || pk ? " sel" : "") + '" data-id="' + esc(t.id) + '">' + lead + '<div><button type="button" class="linkbtn plain" data-pick="' + esc(t.id) + '" aria-expanded="' + on + '">' + txTitle(t) + "</button>" +
        (t.rid ? '<span class="rec" title="Posted automatically by a recurring item" aria-label="Recurring">↻</span>' : "") + '<div class="note">' + sub + "</div></div>" +
        '<span class="amt ' + ac + '">' + amt + "</span></div>";
      if (on) html += '<div class="actrow"><button type="button" class="btn sm" data-aedit="' + esc(t.id) + '">Edit</button><button type="button" class="btn sm" data-adel="' + esc(t.id) + '">Delete</button></div>';
    });
    if (more > 0) html += '<div class="actmore"><button type="button" class="btn sm" data-amore="' + ACT_STEP + '">Show ' + Math.min(ACT_STEP, more) + ' more</button><button type="button" class="btn sm" data-aall>Show all time</button></div>';
    renderBulk(actBulk, $("#aBulk"), $("#aSelBtn"));
    $("#dAct").innerHTML = html || '<p class="empty">' + (filtered ? "Nothing matches those filters." : "No transactions yet. Use the shortcut to add your first one.") + "</p>";
  }
  function renderDaily() {
    var host = $("#dDaily"), budget = budgetNow(), mp = todayStr.slice(0, 8), todaySp = spend(todayStr, todayStr).total, monthSp = spend(mp + "01", todayStr).total;
    if (!budget) {
      host.innerHTML = '<p class="empty">Today you spent <b class="num">' + D(todaySp) + '</b>. Set a monthly budget to get a daily allowance.</p><div style="margin-top:8px"><button type="button" class="btn sm" data-sc="budget">Set monthly budget</button></div>';
      return;
    }
    var dim = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate(), left = dim - now.getDate() + 1;
    var allow = Math.max(0, (budget - (monthSp - todaySp)) / left), p = allow > 0 ? todaySp / allow * 100 : (todaySp > 0 ? 100 : 0), over = todaySp > allow, near = p >= 85;
    host.innerHTML = '<div class="meter"><div class="mtop"><span class="mname">Today</span><span class="mval num">' + D(todaySp) + " of " + D(allow) + '</span></div>' +
      '<div class="bar ' + (over ? "over" : "") + '" role="progressbar" aria-label="Today\'s allowance used" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + Math.min(100, Math.round(p)) + '"><span style="width:' + Math.max(0, Math.min(100, p)).toFixed(1) + '%"></span></div>' +
      '<div class="msub' + (over || near ? " warn" : "") + '">' + (over ? "Over today's allowance by " + D(todaySp - allow) : near ? "Spending limit's near, " + D(allow - todaySp) + " left today" : D(allow - todaySp) + " left today") + '</div>' +
      '<div class="msub">This month ' + D(monthSp) + " of " + D(budget) + "</div></div>";
  }
  var PNAMES = { d: "Daily", w: "Weekly", m: "Monthly", a: "All time" };
  function donutModel() {
    var R = fRange(), rng = { r: [R.from, R.to] }, figs = { r: spend(R.from, R.to) };
    var f = figs.r, keys = Object.keys(f.cats).sort(function (a, b) { return f.cats[b] - f.cats[a]; }), list = [];
    keys.forEach(function (k) { list.push({ id: k, name: k, v: f.cats[k], c: colorVar(k), cats: [k] }); });
    if (dCat && !list.some(function (x) { return x.id === dCat; })) dCat = null;
    return { rng: rng, figs: figs, f: f, list: list };
  }
  function renderDonut() {
    var M = donutModel(), figs = M.figs, f = M.f, list = M.list, sel = null;
    list.forEach(function (x) { if (x.id === dCat) sel = x; });
    $("#dPer").innerHTML = '<p class="hint" style="margin:0 0 8px">' + esc(fLabel(fRange())) + " \u00b7 " + D(f.total) + "</p>";
    var Rr = 54, C = 2 * Math.PI * Rr, off = 0, segs = "", ttl = D(f.total), fs = ttl.length > 12 ? 10 : ttl.length > 9 ? 12 : 14;
    if (f.total > 0) {
      list.forEach(function (x) {
        var len = C * x.v / f.total, gap = list.length > 1 ? Math.min(3, len * 0.3) : 0, on = sel && sel.id === x.id;
        segs += '<circle class="dseg' + (on ? " on" : sel ? " dim" : "") + '" data-cat="' + esc(x.id) + '" role="button" tabindex="0" aria-pressed="' + !!on + '" aria-label="' + esc(x.name + ", " + D(x.v) + ". Show these transactions") + '" cx="75" cy="75" r="' + Rr + '" fill="none" stroke-width="16" style="stroke:' + x.c + '" stroke-dasharray="' + (len - gap).toFixed(2) + " " + (C - len + gap).toFixed(2) + '" stroke-dashoffset="' + (-off).toFixed(2) + '" transform="rotate(-90 75 75)"/>';
        off += len;
      });
    } else segs = '<circle cx="75" cy="75" r="' + Rr + '" fill="none" stroke-width="16" style="stroke:var(--hair)"/>';
    var center;
    if (sel) {
      var vs = D(sel.v), nf = sel.name.length > 12 ? 8.5 : 10, bf = vs.length > 12 ? 10 : vs.length > 9 ? 12 : 14;
      center = '<text x="75" y="66" text-anchor="middle" style="font-size:' + nf + 'px">' + esc(sel.name) + '</text><text class="big" x="75" y="85" text-anchor="middle" style="font-size:' + bf + 'px">' + esc(vs) + '</text><text x="75" y="99" text-anchor="middle" style="font-size:6.5px;opacity:.7">Click to show all</text>' +
        '<circle class="dcen" role="button" tabindex="0" aria-label="Show all expenses again" cx="75" cy="75" r="44" fill="transparent"/>';
    } else center = '<text x="75" y="70" text-anchor="middle" style="font-size:10px">' + (f.total > 0 ? "Spent" : "No spending") + '</text><text class="big" x="75" y="88" text-anchor="middle" style="font-size:' + fs + 'px">' + (f.total > 0 ? esc(ttl) : "") + "</text>";
    var svg = '<svg class="chart" viewBox="0 0 150 150" role="group" aria-label="' + esc(fLabel(fRange()) + " expenses by category, " + ttl + " in total") + '">' + segs + center + "</svg>";
    var leg = list.map(function (x) {
      var on = sel && sel.id === x.id;
      return '<li' + (sel && !on ? ' class="dim"' : "") + '><button type="button" class="dli" data-cat="' + esc(x.id) + '" aria-pressed="' + !!on + '"><span><span class="dotc" style="background:' + x.c + '"></span>' + esc(x.name) + '</span><span class="num">' + D(x.v) + "</span></button></li>";
    }).join("");
    $("#dDonut").innerHTML = '<div class="donutwrap">' + svg + (leg ? '<ul class="dlist">' + leg + "</ul>" : "") + "</div>";
  }
  function renderGoals() {
    var list = state.goals.filter(function (g) { return g && typeof g.target === "number" && g.target > 0 && CUR[g.cur]; });
    $("#dGoals").innerHTML = list.map(function (g) {
      var p = Math.max(0, Math.min(100, (Number(g.saved) || 0) / g.target * 100));
      return '<button type="button" class="goal" data-gid="' + esc(g.id) + '" aria-label="Edit goal ' + esc(g.name) + '"><span class="gn">' + esc(g.name) + '</span><span class="gv">' + D(conv(Number(g.saved) || 0, g.cur)) + " / " + D(conv(g.target, g.cur)) + "</span>" +
        '<div class="bar ' + (p >= 100 ? "ok" : "") + '" role="progressbar" aria-label="' + esc(g.name) + ' progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + Math.round(p) + '"><span style="width:' + p.toFixed(1) + '%"></span></div>' +
        '<span class="gp">' + (p >= 100 ? "Goal reached" : Math.round(p) + "% saved") + "</span></button>";
    }).join("") || (gFormOpen ? "" : '<p class="empty">No savings goals yet. Add one for a trip, a gadget or an emergency fund.</p>');
    $("#gForm").hidden = !gFormOpen; $("#gAddBtn").setAttribute("aria-expanded", String(gFormOpen)); $("#gAddBtn").textContent = gFormOpen ? "Close" : "+ Goal";
  }
  function renderAccounts() {
    var b = balances(), A = dlGet().acct, rank = {};
    (A.order || []).forEach(function (id, i) { rank[id] = i; });
    var val = function (w) { return conv(b[w.id] || 0, w.cur); }, mode = A.sort || "custom";
    var ws = state.wallets.filter(function (w) { return !isCredit(w); }).sort(function (a, c) {
      if (mode === "name") return String(a.name).localeCompare(String(c.name), undefined, { numeric: true, sensitivity: "base" });
      if (mode === "bal-desc") return val(c) - val(a) || String(a.name).localeCompare(String(c.name));
      if (mode === "bal-asc") return val(a) - val(c) || String(a.name).localeCompare(String(c.name));
      if (mode === "type") return String(a.type).localeCompare(String(c.type)) || String(a.name).localeCompare(String(c.name), undefined, { numeric: true });
      var ra = a.id in rank, rc = c.id in rank;
      if (ra && rc) return rank[a.id] - rank[c.id];
      if (ra !== rc) return ra ? -1 : 1;
      return (c.type === "Bank") - (a.type === "Bank");
    });
    if (document.activeElement !== $("#aSort")) $("#aSort").value = ["custom", "name", "bal-desc", "bal-asc", "type"].indexOf(mode) >= 0 ? mode : "custom";
    $("#aCount").textContent = ws.length ? ws.length + (ws.length === 1 ? " account" : " accounts") : "";
    var host = $("#dAccts"), min = Math.max(120, Math.min(340, Number(A.min) || 190));
    host.style.setProperty("--amin", min + "px");
    if (document.activeElement !== $("#aSize")) $("#aSize").value = min;
    host.innerHTML = ws.length ? ws.map(function (w) {
      var v = b[w.id] || 0;
      return '<button type="button" class="acct" title="Click to add a transaction or edit this account" data-wid="' + esc(w.id) + '" data-sc="wallets"><span class="an">' + esc(w.name) + '</span><span class="ab ' + (v < 0 ? "loss" : "") + '">' + D(conv(v, w.cur)) + '</span><span class="as">' + esc(w.type) + (w.last4 ? " ••" + esc(w.last4) : "") + " · " + w.cur + '</span><span class="ao">' + (w.cur !== state.disp ? money(v, w.cur) : "") + "</span></button>";
    }).join("") : '<p class="empty">No accounts yet. <button type="button" class="linkbtn" data-addacct>Add an account</button> or <button type="button" class="linkbtn" id="seedBtn">load a few examples</button>.</p>';
  }
  function nextDue(day) {
    if (!day) return null;
    var y = now.getFullYear(), m = now.getMonth(), t0 = new Date(y, m, now.getDate());
    var c = new Date(y, m, Math.min(day, new Date(y, m + 1, 0).getDate()));
    if (c < t0) c = new Date(y, m + 1, Math.min(day, new Date(y, m + 2, 0).getDate()));
    return { date: dstr(c), days: Math.round((c - t0) / 86400000) };
  }
  function renderCards() {
    var host = $("#dCards"); if (!host) return;
    var b = balances(), cards = state.wallets.filter(isCredit), tot = 0;
    var html = cards.map(function (w) {
      var owed = -(b[w.id] || 0), od = conv(owed, w.cur); if (owed > 0) tot += od;
      var main = owed > 0 ? '<span class="co loss">' + D(od) + "</span>" : owed < 0 ? '<span class="co win">' + D(-od) + "</span>" : '<span class="co">' + D(0) + "</span>";
      var lab = owed > 0 ? "Owed" : owed < 0 ? "Credit balance" : "Paid up", bar = "", av = "";
      if (w.limit > 0) {
        var p = Math.max(0, owed) / w.limit * 100, left = w.limit - owed;
        bar = '<div class="bar ' + (p > 100 ? "over" : "") + '" role="progressbar" aria-label="' + esc(w.name) + ' credit used" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + Math.min(100, Math.round(p)) + '"><span style="width:' + Math.min(100, p).toFixed(1) + '%"></span></div>';
        av = '<span class="cm">' + (left < 0 ? D(conv(-left, w.cur)) + " over the limit" : D(conv(left, w.cur)) + " available of " + D(conv(w.limit, w.cur))) + "</span>";
      }
      var due = "", nd = owed > 0 ? nextDue(w.due) : null;
      if (nd) due = '<span class="duebadge ' + (nd.days === 0 ? "now" : nd.days <= 3 ? "soon" : "") + '">Due ' + esc(fmtShort(nd.date)) + " · " + (nd.days === 0 ? "today" : nd.days === 1 ? "tomorrow" : "in " + nd.days + " days") + "</span>";
      var meta = [w.last4 ? "••" + esc(w.last4) : "", w.stmt ? "Statement day " + w.stmt : "", w.cur !== state.disp ? w.cur : ""].filter(Boolean).join(" · ");
      return '<div class="ctile"><button type="button" class="ctmain" data-sc="wallets" data-wid="' + esc(w.id) + '" aria-label="' + esc(w.name) + ', open actions"><span class="an">' + esc(w.name) + '</span><span class="cm">' + lab + "</span>" + main + bar + av + due + (meta ? '<span class="cm">' + meta + "</span>" : "") + "</button>" +
        (owed > 0 ? '<button type="button" class="btn sm ctpay" data-pay="' + esc(w.id) + '">Pay card</button>' : "") + "</div>";
    }).join("");
    host.innerHTML = html || '<p class="empty">No credit cards yet. Add one with + Wallet at the top and choose Credit card as the type.</p>';
  }
  function renderDash() {
    applyLayout(); renderBudgets(); renderAccounts(); renderCards(); renderTiles(); renderCashflow(); renderSpark(); renderActivity(); renderDaily(); renderDonut(); renderGoals();
  }
  function closeGoalForm() {
    gFormOpen = false; gEditId = null; $("#gName").value = ""; $("#gTarget").value = ""; $("#gSaved").value = ""; $("#gErr").textContent = "";
    $("#gSave").textContent = "Add goal"; $("#gDelete").hidden = true; $("#gDelete").textContent = "Delete goal"; $("#gDelete").classList.remove("arm"); render();
  }
  function openGoalForm(id) {
    var g = null; state.goals.forEach(function (x) { if (x.id === id) g = x; });
    gFormOpen = true; gEditId = g ? g.id : null;
    $("#gName").value = g ? g.name : ""; $("#gTarget").value = g ? g.target : ""; $("#gSaved").value = g && g.saved ? g.saved : ""; if (g) { ensureOpt("#gCur", g.cur); $("#gCur").value = g.cur; }
    $("#gSave").textContent = g ? "Save changes" : "Add goal"; $("#gDelete").hidden = !g; $("#gErr").textContent = "";
    render(); $("#gForm").scrollIntoView({ block: "nearest" }); $("#gName").focus();
  }
  ["click", "mouseover"].forEach(function (ev) { $("#dSpark").addEventListener(ev, function (e) { var r = e.target.closest("[data-k]"), k = r ? +r.getAttribute("data-k") : -1; if (k >= 0 && k !== sparkSel) { sparkSel = k; renderSpark(); } }); });
  $("#dPer").addEventListener("click", function (e) { var b = e.target.closest("[data-per]"); if (b) { dPeriod = b.getAttribute("data-per"); renderDonut(); renderActivity(); } });
  function pickCat(id) {
    dCat = id === null || dCat === id ? null : id; renderDonut(); renderActivity();
    var pn = $("#dAct").closest(".panel"); if (pn) pn.scrollTop = 0;
  }
  $("#dDonut").addEventListener("click", function (e) {
    if (e.target.closest(".dcen")) { pickCat(null); return; }
    var c = e.target.closest("[data-cat]"); if (c) pickCat(c.getAttribute("data-cat"));
  });
  $("#dDonut").addEventListener("keydown", function (e) {
    if (e.key !== "Enter" && e.key !== " ") return;
    var t = e.target; if (t.tagName === "BUTTON") return;
    if (t.closest(".dcen")) { e.preventDefault(); pickCat(null); } else { var c = t.closest("[data-cat]"); if (c) { e.preventDefault(); pickCat(c.getAttribute("data-cat")); } }
  });
  /* ===== Edit-transaction popup (dashboard) ===== */
  var txDlg = $("#txDlg"), eId = null, eArm = null;
  function eKind() { return $("#eXfer").checked ? "xfer" : $("#eIn").checked ? "in" : "out"; }
  function eUpdate() {
    var k = eKind(), w = wmap[$("#eW").value], to = wmap[$("#eTo").value];
    $("#eXferRow").hidden = k !== "xfer"; $("#eCatBox").hidden = k === "xfer";
    $("#eWL").textContent = k === "xfer" ? "From wallet" : "Wallet";
    $("#eAmtL").textContent = "Amount" + (w ? " (" + w.cur + ")" : "");
    var diff = k === "xfer" && w && to && w.cur !== to.cur;
    $("#eAmt2Box").hidden = !diff;
    if (diff) {
      $("#eAmt2L").textContent = "Amount received (" + to.cur + ")";
      var a = evalExpr($("#eAmt").value, w.cur);
      $("#eAmt2").placeholder = isFinite(a) && a > 0 ? "about " + rnd(conv(a, w.cur, to.cur), to.cur) : "auto";
    }
    $("#eHint").textContent = k === "xfer" && w && to && w.id === to.id ? "Pick two different wallets." : diff ? "Leave the received amount blank to use the current rate." : "";
    refreshSub("#eCat", "#eSubList", k);
    var want = k === "in" ? CATS["in"] : CATS.out.concat(state.budgets.map(function (u) { return u.name; }).filter(function (n) { return n && CATS.out.indexOf(n) < 0; }));
    $("#eCatList").innerHTML = want.map(function (c) { return '<option value="' + esc(c) + '">'; }).join("");
  }
  function openTxDlg(id) {
    var t = null; state.tx.forEach(function (x) { if (x.id === id) t = x; });
    if (!t || !validT(t)) return;
    eId = id; actSel = null;
    var opts = state.wallets.map(function (w) { return '<option value="' + esc(w.id) + '">' + esc(w.name) + " (" + w.cur + ")</option>"; }).join("");
    $("#eW").innerHTML = opts; $("#eTo").innerHTML = opts;
    $("#eOut").checked = t.kind === "out"; $("#eIn").checked = t.kind === "in"; $("#eXfer").checked = t.kind === "xfer";
    $("#eW").value = t.wallet; if (t.kind === "xfer") $("#eTo").value = t.to;
    else { var alt = state.wallets.filter(function (w) { return w.id !== t.wallet; })[0]; if (alt) $("#eTo").value = alt.id; }
    $("#eAmt").value = t.amount; $("#eAmt2").value = t.kind === "xfer" && wmap[t.to].cur !== wmap[t.wallet].cur ? t.toAmount : "";
    $("#eCat").value = t.cat || ""; $("#eSub").value = t.sub || ""; $("#eNote").value = t.note || ""; $("#eDate").value = t.date;
    $("#eErr").textContent = ""; $("#eDel").classList.remove("arm"); $("#eDel").textContent = "Delete"; $("#eSave").disabled = false;
    eUpdate(); renderActivity();
    if (!txDlg.open) txDlg.showModal();
    $("#eAmt").focus(); $("#eAmt").select();
  }
  function closeTxDlg() { if (txDlg.open) txDlg.close(); }
  txDlg.addEventListener("close", function () { eId = null; clearTimeout(eArm); });
  txDlg.addEventListener("cancel", function (e) { e.preventDefault(); });
  $("#eClose").addEventListener("click", closeTxDlg); $("#eCancel").addEventListener("click", closeTxDlg);
  ["#eAmt", "#eW", "#eTo"].forEach(function (q) { $(q).addEventListener("input", eUpdate); $(q).addEventListener("change", eUpdate); });
  document.querySelectorAll('input[name="ekind"]').forEach(function (r) { r.addEventListener("change", eUpdate); });
  $("#eDel").addEventListener("click", function () {
    var b = this;
    if (!b.classList.contains("arm")) { b.classList.add("arm"); b.textContent = "Sure?"; clearTimeout(eArm); eArm = setTimeout(function () { b.classList.remove("arm"); b.textContent = "Delete"; }, 3000); return; }
    var id = eId; closeTxDlg(); if (id) drop("t", id);
  });
  $("#eForm").addEventListener("submit", function (e) {
    e.preventDefault();
    var err = $("#eErr"), k = eKind(), w = wmap[$("#eW").value], raw = evalExpr($("#eAmt").value, w && w.cur);
    if (!eId) return;
    if (!w) { err.textContent = "Pick a wallet."; return; }
    if (!isFinite(raw) || raw === 0) { err.textContent = "Enter the amount as a number or a sum like 120+45.5."; $("#eAmt").focus(); return; }
    if (raw < 0) { raw = -raw; if (k === "in") { $("#eOut").checked = true; k = "out"; } else if (k === "out") { $("#eIn").checked = true; k = "in"; } }
    var t = { date: $("#eDate").value, kind: k, amount: rnd(raw, w.cur), wallet: w.id, cat: "", sub: "", note: $("#eNote").value.trim(), to: "", toAmount: 0 };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(t.date)) { err.textContent = "Pick a date."; return; }
    if (k === "xfer") {
      var to = wmap[$("#eTo").value];
      if (!to || to.id === w.id) { err.textContent = "Pick two different wallets for a transfer."; return; }
      t.to = to.id;
      if (to.cur === w.cur) t.toAmount = t.amount;
      else {
        var r2 = $("#eAmt2").value.trim() === "" ? NaN : evalExpr($("#eAmt2").value, to.cur);
        t.toAmount = isFinite(r2) && r2 > 0 ? rnd(r2, to.cur) : rnd(conv(raw, w.cur, to.cur), to.cur);
      }
    } else { t.cat = $("#eCat").value.trim() || (k === "in" ? "Income" : "Other"); t.sub = $("#eSub").value.trim(); }
    err.textContent = ""; $("#eSave").disabled = true;
    patch("t", eId, t).then(function (ok) { $("#eSave").disabled = false; if (ok !== false) closeTxDlg(); });
  });
  wireBulk(actBulk, $("#aBulk"), $("#aSelBtn"), function () { actSel = null; renderActivity(); });
  $("#dAct").addEventListener("click", function (e) {
    if (actBulk.mode) { bulkRowToggle(actBulk, e, ".act[data-id]", "data-id", $("#aBulk"), $("#aSelBtn")); return; }
    var eb = e.target.closest("[data-aedit]"), db = e.target.closest("[data-adel]"), row = e.target.closest(".act[data-id]");
    if (eb) {
      openTxDlg(eb.getAttribute("data-aedit")); return;
    }
    if (db) {
      if (!db.classList.contains("arm")) { db.classList.add("arm"); db.textContent = "Sure?"; clearTimeout(actArm); actArm = setTimeout(function () { db.classList.remove("arm"); db.textContent = "Delete"; }, 3000); return; }
      actSel = null; drop("t", db.getAttribute("data-adel")); return;
    }
    if (row) { var rid = row.getAttribute("data-id"); actSel = actSel === rid ? null : rid; renderActivity(); }
  });
  $("#aWal").addEventListener("change", function () { actWal = this.value; actReset(); renderActivity(); });
  $("#aKinds").addEventListener("click", function (e) { var b = e.target.closest("[data-ak]"); if (!b) return; actKind = b.getAttribute("data-ak"); actReset(); renderActivity(); });
  $("#dAct").addEventListener("click", function (e) {
    if (e.target.closest("[data-amore]")) { actLimit += ACT_STEP; renderActivity(); return; }
    if (e.target.closest("[data-aall]")) {
      var all = state.tx.filter(validT).map(function (t) { return t.date; }).sort();
      if (all.length) { state.repInit = true; $("#rFrom").value = all[0]; $("#rTo").value = all[all.length - 1]; }
      syncMonth(); render();
    }
  });
  $("#dActHint").addEventListener("click", function (e) { if (e.target.closest("[data-clearcat]")) pickCat(null); });
  $("#dGoals").addEventListener("click", function (e) { var b = e.target.closest("[data-gid]"); if (b) openGoalForm(b.getAttribute("data-gid")); });
  $("#dashView").addEventListener("click", function (e) {
    var pc = e.target.closest("[data-pay]"); if (pc) { payCard(pc.getAttribute("data-pay")); return; }
    var gb = e.target.closest("[data-goto]");
    if (gb) { var d = gb.getAttribute("data-goto"), p = d.split("-").map(Number); state.y = p[0]; state.m = p[1] - 1; state.sel = d; focusWidget("ccal"); return; }
    var sc = e.target.closest("[data-sc]"); if (!sc) return; if (dEdit && sc.classList.contains("acct")) return;
    var k = sc.getAttribute("data-sc");
    if (k === "tx") addTx();
    else if (k === "budget") { bOpen = true; fillBudget(); focusWidget("cbudget"); $("#bAmt").focus(); }
    else if (k === "goals") openGoalForm(null);
    else if (k === "report") { showView("dash"); $("#rangeHost").scrollIntoView({ block: "start" }); }
    else if (k === "wallets") openAcctDlg(sc.getAttribute("data-wid") || null);
  });
  $("#gAddBtn").addEventListener("click", function () { if (gFormOpen) closeGoalForm(); else openGoalForm(null); });
  $("#gCancel").addEventListener("click", closeGoalForm);
  var gArm = null;
  $("#gDelete").addEventListener("click", function () {
    var b = this;
    if (!b.classList.contains("arm")) { b.classList.add("arm"); b.textContent = "Sure?"; clearTimeout(gArm); gArm = setTimeout(function () { b.classList.remove("arm"); b.textContent = "Delete goal"; }, 3000); return; }
    var id = gEditId; if (!id) return;
    drop("g", id).then(function () { closeGoalForm(); });
  });
  $("#gForm").addEventListener("submit", function (e) {
    e.preventDefault();
    var name = $("#gName").value.trim(), err = $("#gErr"), tg = evalExpr($("#gTarget").value, $("#gCur").value), st = $("#gSaved").value.trim() === "" ? 0 : evalExpr($("#gSaved").value, $("#gCur").value), cur = $("#gCur").value;
    if (!name) { err.textContent = "Give the goal a name."; $("#gName").focus(); return; }
    if (!isFinite(tg) || tg <= 0) { err.textContent = "The target must be a number above 0."; $("#gTarget").focus(); return; }
    if (!isFinite(st) || st < 0) { err.textContent = "Saved so far must be 0 or more."; $("#gSaved").focus(); return; }
    var o = { name: name, target: rnd(tg, cur), saved: rnd(st, cur), cur: cur };
    if (gEditId) { patch("g", gEditId, o).then(function (ok) { if (ok !== false) closeGoalForm(); }); return; }
    o.createdAt = Date.now();
    put("g", o).then(function (id) { if (id) closeGoalForm(); });
  });

  /* ===== Budgets (several, per category) ===== */
  var uOpen = false, uEditId = null, uArm = null;
  function budgetSpent(u) {
    var R = fRange(), cats = String(u.cats || u.name).split(",").map(function (c) { return c.trim().toLowerCase(); }).filter(Boolean), tot = 0;
    state.tx.forEach(function (t) { if (validT(t) && t.kind === "out" && inRange(t.date, R) && cats.indexOf(String(t.cat || "").toLowerCase()) >= 0) tot += conv(t.amount, wmap[t.wallet].cur, null, t.date); });
    return tot;
  }
  function saveBudgets() { try { localStorage.setItem("wl-budgets", JSON.stringify(state.budgets)); } catch (e) {} syncPrefs(); }
  function renderBudgets() {
    var list = state.budgets.filter(function (u) { return u && u.amount > 0 && CUR[u.cur]; }), tb = 0, ts = 0;
    var html = list.map(function (u) {
      var a = conv(u.amount, u.cur) * fMonths(fRange()), sp = budgetSpent(u), pc = a > 0 ? sp / a * 100 : 0, over = sp > a; tb += a; ts += sp;
      return '<button type="button" class="goal" data-uid="' + esc(u.id) + '" aria-label="Edit budget ' + esc(u.name) + '"><span class="gn">' + esc(u.name) + '</span><span class="gv">' + D(sp) + " / " + D(a) + '</span>' +
        '<div class="bar ' + (over ? "over" : "") + '" role="progressbar" aria-label="' + esc(u.name) + ' used" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + Math.min(100, Math.round(pc)) + '"><span style="width:' + Math.max(0, Math.min(100, pc)).toFixed(1) + '%"></span></div>' +
        '<span class="gp">' + (over ? D(sp - a) + " over budget" : Math.round(pc) + "% used · " + D(a - sp) + " left") + "</span></button>";
    }).join("");
    if (list.length > 1) html += '<div class="atot"><span>Total in range</span><span class="num">' + D(ts) + " / " + D(tb) + "</span></div>";
    if (!html && !uOpen) html = '<p class="empty">No budgets yet. Add Groceries, Insurance, Electricity, Water or Mortgage. Spending counts when a transaction\'s category matches the budget name.</p>';
    $("#dBudgets").innerHTML = html;
    $("#uForm").hidden = !uOpen; $("#uAddBtn").setAttribute("aria-expanded", String(uOpen)); $("#uAddBtn").textContent = uOpen ? "Close" : "+ Budget";
    $("#uAmtL").textContent = "Monthly amount (" + state.disp + ")";
  }
  function closeBudgetForm() { uOpen = false; uEditId = null; $("#uName").value = ""; $("#uAmt").value = ""; $("#uCats").value = ""; $("#uErr").textContent = ""; $("#uSave").textContent = "Add budget"; $("#uDelete").hidden = true; $("#uDelete").textContent = "Delete budget"; render(); }
  function openBudgetForm(id) {
    var u = null; state.budgets.forEach(function (x) { if (x.id === id) u = x; });
    uOpen = true; uEditId = u ? u.id : null;
    $("#uName").value = u ? u.name : ""; $("#uAmt").value = u ? round2(conv(u.amount, u.cur)) : ""; $("#uCats").value = u && u.cats ? u.cats : "";
    $("#uSave").textContent = u ? "Save changes" : "Add budget"; $("#uDelete").hidden = !u; $("#uErr").textContent = "";
    render(); $("#uForm").scrollIntoView({ block: "nearest" }); $("#uName").focus();
  }
  $("#uAddBtn").addEventListener("click", function () { if (uOpen) closeBudgetForm(); else openBudgetForm(null); });
  $("#uCancel").addEventListener("click", closeBudgetForm);
  $("#dBudgets").addEventListener("click", function (e) { var b = e.target.closest("[data-uid]"); if (b) openBudgetForm(b.getAttribute("data-uid")); });
  $("#uDelete").addEventListener("click", function () {
    var b = this;
    if (!b.classList.contains("arm")) { b.classList.add("arm"); b.textContent = "Sure?"; clearTimeout(uArm); uArm = setTimeout(function () { b.classList.remove("arm"); b.textContent = "Delete budget"; }, 3000); return; }
    b.classList.remove("arm"); state.budgets = state.budgets.filter(function (x) { return x.id !== uEditId; }); saveBudgets(); closeBudgetForm();
  });
  $("#uForm").addEventListener("submit", function (e) {
    e.preventDefault();
    var name = $("#uName").value.trim(), v = evalExpr($("#uAmt").value, state.disp), err = $("#uErr");
    if (!name) { err.textContent = "Give the budget a name."; $("#uName").focus(); return; }
    if (!isFinite(v) || v <= 0) { err.textContent = "The amount must be a number above 0."; $("#uAmt").focus(); return; }
    var o = { name: name, amount: rnd(v, state.disp), cur: state.disp, cats: $("#uCats").value.trim() };
    if (uEditId) state.budgets = state.budgets.map(function (x) { return x.id === uEditId ? Object.assign({}, x, o) : x; });
    else { o.id = gid("u"); o.createdAt = Date.now(); state.budgets = state.budgets.concat([o]); }
    saveBudgets(); closeBudgetForm();
  });

  /* ===== Customizable dashboard: drag to reorder, corner to resize ===== */
  var DL_DEF = [["accts", 12], ["cards", 12], ["tiles", 12], ["cashflow", 6], ["spark", 6], ["daily", 6], ["activity", 6], ["expenses", 6], ["budgets", 6], ["savings", 6], ["shortcuts", 6],
    ["ccal", 8], ["cday", 4], ["cbudget", 12], ["rstats", 12], ["rchart", 12], ["rexp", 6], ["rinc", 6], ["rwal", 12], ["rdaily", 12]];
  var dEdit = false, dlBusy = false, dGrid = $("#dGrid");
  function dlGet() {
    var dl = state.dl || {}, size = Object.assign({}, dl.size || {}), ord = (dl.order || []).slice();
    if (dl.v !== 2) { /* one-time migration: My accounts replaces the old wallet card in place */
      var ci = ord.indexOf("card");
      ord = ord.filter(function (p) { return p !== "accts"; });
      ci = ord.indexOf("card");
      if (ci >= 0) ord[ci] = "accts"; else ord.unshift("accts");
      if (size.card && size.card.w) size.accts = { w: size.card.w }; else delete size.accts;
    }
    ord = ord.filter(function (p) { return DL_DEF.some(function (d) { return d[0] === p; }); });
    if (ord.indexOf("cards") < 0) { var ai = Math.max(ord.indexOf("accts"), ord.indexOf("expenses")); ord.splice(ai >= 0 ? ai + 1 : ord.length, 0, "cards"); }
    if (ord.indexOf("cashflow") < 0) { var ti = ord.indexOf("tiles"); ord.splice(ti >= 0 ? ti + 1 : ord.length, 0, "cashflow"); }
    DL_DEF.forEach(function (d) { if (ord.indexOf(d[0]) < 0) ord.push(d[0]); });
    delete size.card;
    return { order: ord, size: size, hidden: (dl.hidden || []).filter(function (p) { return DL_DEF.some(function (d) { return d[0] === p; }); }), v: 2, acct: Object.assign({ order: [], min: 190, sort: "custom" }, dl.acct || {}) };
  }
  function applyLayout() {
    if (dlBusy) return;
    var L = dlGet(), cur = [].map.call(dGrid.children, function (e) { return e.getAttribute("data-pid"); });
    if (cur.join() !== L.order.join()) L.order.forEach(function (pid) { var el = dGrid.querySelector('[data-pid="' + pid + '"]'); if (el) dGrid.appendChild(el); });
    DL_DEF.forEach(function (d) {
      var el = dGrid.querySelector('[data-pid="' + d[0] + '"]'), z = L.size[d[0]] || {}; if (!el) return;
      el.hidden = L.hidden.indexOf(d[0]) >= 0;
      el.style.setProperty("--w", z.w || d[1]);
      if (z.h && d[0] !== "accts") { el.style.setProperty("--h", z.h + "px"); el.setAttribute("data-h", "1"); } else { el.style.removeProperty("--h"); el.removeAttribute("data-h"); }
    });
    dGrid.classList.toggle("edit", dEdit);
    var tray = $("#dTray");
    tray.hidden = !dEdit;
    tray.innerHTML = '<span class="tl">Hidden widgets</span>' + (L.hidden.length ? L.hidden.map(function (pid) { return '<button type="button" class="btn sm" data-showw="' + pid + '">+ ' + esc(WNAMES[pid]) + "</button>"; }).join("") : '<span class="hint" style="display:inline">None. Use the red Hide pill on a widget to remove it.</span>');
    $("#dEmpty").hidden = dEdit || L.hidden.length < DL_DEF.length;
  }
  var WNAMES = { accts: "My accounts", cards: "Credit cards", tiles: "Summary", cashflow: "Cash flow", spark: "Spending over time", daily: "Daily expenses", activity: "Recent activity", expenses: "All expenses", budgets: "Budgets", savings: "My savings", shortcuts: "Super Shortcut",
    ccal: "Calendar", cday: "Day log", cbudget: "Monthly budget", rstats: "Report summary", rchart: "Cumulative net cash flow", rexp: "Spending by category", rinc: "Income by category", rwal: "By wallet", rdaily: "Daily breakdown" };
  [].forEach.call(dGrid.querySelectorAll(".dp"), function (el) {
    var b = document.createElement("button"); b.type = "button"; b.className = "dx"; b.textContent = "✕ Hide"; b.setAttribute("aria-label", "Hide " + (WNAMES[el.getAttribute("data-pid")] || "widget")); el.appendChild(b);
  });
  dGrid.addEventListener("click", function (e) {
    var b = e.target.closest(".dx"), el = e.target.closest(".dp"); if (!b || !el) return;
    var L = dlGet(), pid = el.getAttribute("data-pid"); if (L.hidden.indexOf(pid) < 0) L.hidden.push(pid); saveLayout(L); render();
  });
  $("#dTray").addEventListener("click", function (e) {
    var b = e.target.closest("[data-showw]"); if (!b) return;
    var L = dlGet(), pid = b.getAttribute("data-showw"); L.hidden = L.hidden.filter(function (x) { return x !== pid; }); saveLayout(L); render();
  });
  function saveLayout(L) { state.dl = L; try { localStorage.setItem("wl-dlayout", JSON.stringify(L)); } catch (e) {} syncPrefs(); }
  dGrid.addEventListener("pointerdown", function (e) {
    var h = e.target.closest(".dh"), z = e.target.closest(".rz"), el = e.target.closest(".dp"); if (!dEdit || !el || (!h && !z)) return;
    e.preventDefault(); dlBusy = true; try { e.target.setPointerCapture(e.pointerId); } catch (x) {}
    var sx = e.clientX, sy = e.clientY, sw = el.offsetWidth, sh = el.offsetHeight, col = (dGrid.clientWidth + 18) / 12, span = null, nh = null;
    if (h) el.classList.add("dragging");
    function mv(ev) {
      if (h) {
        var t = document.elementFromPoint(ev.clientX, ev.clientY), o = t && t.closest ? t.closest(".dp") : null;
        if (o && o !== el && o.parentNode === dGrid) { if (el.compareDocumentPosition(o) & 4) o.after(el); else o.before(el); }
      } else {
        span = Math.max(3, Math.min(12, Math.round((sw + ev.clientX - sx + 18) / col))); nh = Math.max(110, Math.round(sh + ev.clientY - sy));
        el.style.setProperty("--w", span); el.style.setProperty("--h", nh + "px"); el.setAttribute("data-h", "1");
      }
    }
    function up() {
      window.removeEventListener("pointermove", mv); window.removeEventListener("pointerup", up); window.removeEventListener("pointercancel", up);
      el.classList.remove("dragging"); dlBusy = false;
      var L = dlGet(), pid = el.getAttribute("data-pid"); L.order = [].map.call(dGrid.children, function (c) { return c.getAttribute("data-pid"); });
      if (z && span) L.size[pid] = { w: span, h: nh };
      saveLayout(L); render();
    }
    window.addEventListener("pointermove", mv); window.addEventListener("pointerup", up); window.addEventListener("pointercancel", up);
  });
  dGrid.addEventListener("dblclick", function (e) {
    var z = e.target.closest(".rz"), el = e.target.closest(".dp"); if (!z || !el) return;
    var L = dlGet(), pid = el.getAttribute("data-pid"), cur = L.size[pid] || {}; L.size[pid] = { w: cur.w }; saveLayout(L); render();
  });
  var swallow = false;
  $("#dAccts").addEventListener("click", function (e) { if (swallow) { e.stopPropagation(); e.preventDefault(); } }, true);
  $("#dAccts").addEventListener("pointerdown", function (e) {
    var c = e.target.closest(".acct[data-wid]"); if (!c || e.button > 0 || (e.pointerType === "touch" && !dEdit)) return;
    if (dEdit) e.preventDefault();
    var host = $("#dAccts"), sx = e.clientX, sy = e.clientY, drag = false;
    function mv(ev) {
      if (!drag) { if (Math.abs(ev.clientX - sx) + Math.abs(ev.clientY - sy) < 7) return; drag = true; dlBusy = true; c.classList.add("dragging"); }
      var t = document.elementFromPoint(ev.clientX, ev.clientY), o = t && t.closest ? t.closest(".acct[data-wid]") : null;
      if (o && o !== c && o.parentNode === host) { if (c.compareDocumentPosition(o) & 4) o.after(c); else o.before(c); }
    }
    function up() {
      window.removeEventListener("pointermove", mv); window.removeEventListener("pointerup", up); window.removeEventListener("pointercancel", up);
      if (!drag) return;
      c.classList.remove("dragging"); dlBusy = false; swallow = true; setTimeout(function () { swallow = false; }, 0);
      var L = dlGet(); L.acct.order = [].map.call(host.querySelectorAll(".acct[data-wid]"), function (x) { return x.getAttribute("data-wid"); }); L.acct.sort = "custom";
      saveLayout(L); render();
    }
    window.addEventListener("pointermove", mv); window.addEventListener("pointerup", up); window.addEventListener("pointercancel", up);
  });
  $("#aSort").addEventListener("change", function () { var L = dlGet(); L.acct.sort = this.value; saveLayout(L); render(); });
  $("#aSize").addEventListener("input", function () { $("#dAccts").style.setProperty("--amin", this.value + "px"); });
  $("#aSize").addEventListener("change", function () { var L = dlGet(); L.acct.min = +this.value; saveLayout(L); render(); });
  $("#dCust").addEventListener("click", function () {
    dEdit = !dEdit; this.textContent = dEdit ? "Done" : "Customize layout"; this.setAttribute("aria-pressed", String(dEdit));
    $("#dReset").hidden = !dEdit; $("#dHint").hidden = !dEdit; render();
  });
  $("#dReset").addEventListener("click", function () { state.dl = null; try { localStorage.removeItem("wl-dlayout"); } catch (e) {} syncPrefs(); render(); });

  $("#custHdr").addEventListener("click", function () { if (state.view === "dash") $("#dCust").click(); });
  var VIEWS = { dash: "#dashView", rec: "#recView", rates: "#ratesView" };
  var TABS = { dash: "#tabDash", rec: "#tabRec", rates: "#tabRates" };
  function render() {
    buildMap(); autoClose();
    if (tEditId && !state.tx.some(function (t) { return t.id === tEditId; })) {
      tEditId = null; $("#add").textContent = "Add transaction"; $("#tCancel").hidden = true; $("#tDateRow").hidden = true; $("#tEditNote").hidden = true;
    }
    if (wEditId && !wmap[wEditId]) {
      closeAcctDlg(); cancelWalletEdit();
    }
    $("#monthLabel").textContent = MONTHS[state.m] + " " + state.y;
    var db = $("#dCust"), ch = $("#custHdr");
    db.parentNode.parentNode.hidden = db.getAttribute("aria-pressed") !== "true";
    ch.hidden = state.view !== "dash"; if (state.view === "dash") ch.setAttribute("aria-pressed", db.getAttribute("aria-pressed"));
    if (!state.repInit) {
      state.repInit = true; $("#rFrom").value = ds(state.y, state.m, 1); $("#rTo").value = ds(state.y, state.m, new Date(state.y, state.m + 1, 0).getDate());
    }
    if (typeof acctDlg !== "undefined" && acctDlg.open) renderAcctHist();
    var days = byDay();
    renderHeader(days);
    if (state.view === "dash") { renderDash(); renderReport(); renderBudget(days); renderGrid(days); renderDay(days); }
    else if (state.view === "rec") renderRecList();
    else renderRates();
    runRecurring();
  }
  function showView(v) {
    if (v === "cal" || v === "rep") v = "dash";
    state.view = v;
    Object.keys(VIEWS).forEach(function (k) { $(VIEWS[k]).hidden = k !== v; });
    Object.keys(TABS).forEach(function (k) { $(TABS[k]).setAttribute("aria-pressed", String(k === v)); });
    render();
  }
  /* Calendar and Report live on the dashboard now: bring a widget back if it was hidden, then scroll to it */
  function focusWidget(pid) {
    var L = dlGet();
    if (L.hidden.indexOf(pid) >= 0) { L.hidden = L.hidden.filter(function (x) { return x !== pid; }); saveLayout(L); }
    showView("dash");
    var el = dGrid.querySelector('[data-pid="' + pid + '"]');
    if (el && el.scrollIntoView) el.scrollIntoView({ block: "start" });
  }
  Object.keys(TABS).forEach(function (k) { $(TABS[k]).addEventListener("click", function () { showView(k); }); });
  document.addEventListener("click", function (e) { var b = e.target.closest("[data-tab]"); if (b) showView(b.getAttribute("data-tab")); });
  function shift(delta) {
    var d = new Date(state.y, state.m + delta, 1); state.y = d.getFullYear(); state.m = d.getMonth();
    var prefix = monthPrefix(); if (state.sel.indexOf(prefix) !== 0) state.sel = todayStr.indexOf(prefix) === 0 ? todayStr : prefix + "01";
    setRangeToMonth(); render();
  }
  $("#prev").addEventListener("click", function () { shift(-1); });
  $("#next").addEventListener("click", function () { shift(1); });
  $("#today").addEventListener("click", function () { state.y = now.getFullYear(); state.m = now.getMonth(); state.sel = todayStr; setRangeToMonth(); render(); });
  $("#grid").addEventListener("click", function (e) {
    var b = e.target.closest("[data-date]"); if (!b) return;
    if (tEditId) cancelTxEdit();
    state.sel = b.getAttribute("data-date"); render();
  });
  function addTx() {
    state.y = now.getFullYear(); state.m = now.getMonth(); state.sel = todayStr;
    if (!state.wallets.length) { openAcctDlg(null); return; }
    focusWidget("cday"); var a = $("#amt"); if (a.scrollIntoView) a.scrollIntoView({ block: "center" }); a.focus();
  }
  $("#qaWallet").addEventListener("click", function () { openAcctDlg(null); });

  $("#disp").innerHTML = CODES.map(function (k) { return '<option value="' + k + '">' + esc(CUR[k].sym + " " + CUR[k].name) + "</option>"; }).join("");
  var curOpts = CODES.map(function (k) { return '<option value="' + k + '">' + esc(k + " · " + CUR[k].name) + "</option>"; }).join("");
  $("#bCur").innerHTML = curOpts; $("#wCur").innerHTML = curOpts; $("#gCur").innerHTML = curOpts; $("#gCur").value = "PHP";
  $("#disp").value = state.disp; $("#bCur").value = state.budget.cur; $("#wCur").value = "PHP";
  $("#disp").addEventListener("change", function (e) { state.disp = e.target.value; try { localStorage.setItem("wl-cur", state.disp); } catch (x) {} render(); });
  var lastW = window.innerWidth;
  window.addEventListener("resize", (function () {
    var tm = null;
    return function () { if (state.view !== "rep" && state.view !== "dash") return; if (window.innerWidth === lastW) return; lastW = window.innerWidth; clearTimeout(tm); tm = setTimeout(render, 150); };
  })());

  function useLocal() {
    try { var a = JSON.parse(localStorage.getItem("wl-wallets")); if (Array.isArray(a)) state.wallets = a; } catch (e) {}
    try { var b = JSON.parse(localStorage.getItem("wl-tx")); if (Array.isArray(b)) state.tx = b; } catch (e) {}
    try { var g = JSON.parse(localStorage.getItem("wl-goals")); if (Array.isArray(g)) state.goals = g; } catch (e) {}
    try { var rc = JSON.parse(localStorage.getItem("wl-recs")); if (Array.isArray(rc)) state.recs = rc; } catch (e) {}
    state.loaded = true; prefsReady = true; setStatus("Saved in this browser only."); render();
  }
  setInterval(function () { var d = new Date(), q = ds(d.getFullYear(), d.getMonth(), d.getDate()); if (q !== todayStr) { var was = state.sel === todayStr; now = d; todayStr = q; if (was) state.sel = q; state.y = d.getFullYear(); state.m = d.getMonth(); render(); } }, 60000);
  showView("dash");
  Promise.all([use("user"), use("db")]).then(function (r) {
    var user = r[0], db = r[1];
    if (!user || !db) { useLocal(); return; }
    return user.id().then(function (uid) {
      if (!uid) { useLocal(); return; }
      var base = db.doc("data/users/" + uid + "/wallet");
      state.wcol = base.collection("wallets"); state.col = base.collection("tx"); state.gcol = base.collection("goals"); state.rcol = base.collection("recurring"); pcol = base.collection("prefs");
      pcol.onSnapshot(function (snap) { snap.docs.forEach(function (d) { if (d.id !== "main") return; var o = d.data() || {}; if (o.budget && CODES.indexOf(o.budget.cur) >= 0) state.budget = { amount: Number(o.budget.amount) || 0, cur: o.budget.cur, goal: Number(o.budget.goal) || 0 }; if (o.rates) CODES.forEach(function (k) { var v = Number(o.rates[k]); if (isFinite(v) && v > 0) state.rates[k] = v; }); if (o.rsrc && o.rsrc.s) state.rsrc = o.rsrc; if (o.eom) state.eom = Object.assign({}, o.eom, state.eom); if (Array.isArray(o.budgets)) state.budgets = o.budgets; if (o.dlayout && Array.isArray(o.dlayout.order) && !dlBusy) state.dl = o.dlayout; if (o.rlayout && Array.isArray(o.rlayout.order)) state.rl = o.rlayout; if (o.clayout && Array.isArray(o.clayout.order)) state.cl = o.clayout; if (o.locks) state.locks = Object.assign({}, state.locks, o.locks); if (o.cats && typeof o.cats === "object") { state.cats = { out: o.cats.out || {}, "in": o.cats["in"] || {} }; applyCats(); } }); prefsReady = true; render(); }, function () {});
      state.rcol.onSnapshot(function (snap) {
        state.recs = snap.docs.map(function (d) { var o = d.data() || {}; o.id = d.id; return o; }); render();
      }, function () {});
      state.gcol.onSnapshot(function (snap) {
        state.goals = snap.docs.map(function (d) { var o = d.data() || {}; o.id = d.id; return o; }); render();
      }, function () {});
      state.wcol.onSnapshot(function (snap) {
        state.wallets = snap.docs.map(function (d) { var o = d.data() || {}; o.id = d.id; return o; }); render();
      }, function () {});
      var timer = setTimeout(function () { if (!state.loaded) setStatus("Still connecting to your saved wallets…", true); }, 10000);
      state.col.onSnapshot(function (snap) {
        state.tx = snap.docs.map(function (d) { var o = d.data() || {}; o.id = d.id; return o; });
        if (!snap.metadata.fromCache || state.tx.length) { state.loaded = true; clearTimeout(timer); setStatus("Private to you · saved on this device."); }
        render();
      }, function (e) { clearTimeout(timer); setStatus("Live sync stopped (" + ((e && e.code) || "error") + "). Reload the page to reconnect.", true); });
    });
  }).catch(function () { useLocal(); });
})();

;

(function () {
  var root = document.documentElement, sw = document.getElementById("themeSw");
  if (!sw) return;
  function sync() {
    var dark = root.getAttribute("data-theme") === "dark";
    sw.setAttribute("aria-checked", dark ? "true" : "false");
    sw.setAttribute("aria-label", dark ? "Switch to light mode" : "Switch to dark mode");
  }
  sw.addEventListener("click", function () {
    var next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
    root.setAttribute("data-theme", next);
    try { localStorage.setItem("wl-theme", next); } catch (e) {}
    sync();
  });
  try {
    matchMedia("(prefers-color-scheme: dark)").addEventListener("change", function (e) {
      var saved = null; try { saved = localStorage.getItem("wl-theme"); } catch (x) {}
      if (saved !== "light" && saved !== "dark") { root.setAttribute("data-theme", e.matches ? "dark" : "light"); sync(); }
    });
  } catch (e) {}
  sync();
})();

;

(function () {
  var timers = new WeakMap();
  document.addEventListener("scroll", function (e) {
    var el = e.target === document ? document.documentElement : e.target;
    if (!el || !el.classList) return;
    el.classList.add("sb-on"); clearTimeout(timers.get(el));
    timers.set(el, setTimeout(function () { el.classList.remove("sb-on"); }, 900));
  }, true);
})();
