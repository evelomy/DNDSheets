// Isaac Checklist - stable app.js
// Build: 1  (increment this integer whenever you update this file)
const BUILD = 10;
const STORE_KEY = "isaacChecklist.v1";

const $ = (sel) => document.querySelector(sel);

let DATA = [];
let STATE = {};
let NAME_TO_ID = {};
let FILTER = "";

function safeGet(key) {
  try { return localStorage.getItem(key); } catch(e) { return null; }
}
function safeSet(key, val) {
  try { localStorage.setItem(key, val); return true; } catch(e) { return false; }
}

function loadState() {
  const raw = safeGet(STORE_KEY);
  if(!raw) { STATE = {}; return; }
  try { STATE = JSON.parse(raw) || {}; }
  catch(e) { STATE = {}; }
}
function saveState() {
  safeSet(STORE_KEY, JSON.stringify(STATE));
}
function getTick(id) {
  return !!STATE[id];
}
function setTick(id, val) {
  STATE[id] = !!val;
  saveState();

  // Sync all checkboxes for the same id (lists + inspector)
  const boxes = document.querySelectorAll('input[type="checkbox"][data-id="' + id + '"]');
  boxes.forEach(cb => cb.checked = !!val);

  const pick = $("#picker");
  if(pick && pick.value === id) {
    const pt = $("#pickTick");
    if(pt) pt.checked = !!val;
  }

  renderStats();
}

function setBoot(text) {
  const bs = $("#bootStatus");
  if(bs) bs.textContent = text;
}

function showError(title, details) {
  console.error(title, details || "");
  const box = $("#errorBox");
  if(!box) return;
  box.style.display = "block";
  box.innerHTML = "";
  const t = document.createElement("div");
  t.className = "errorTitle";
  t.textContent = title;

  const pre = document.createElement("pre");
  pre.className = "errorPre";
  pre.textContent = (details || "").toString();

  box.appendChild(t);
  box.appendChild(pre);
}

function textIncludes(hay, needle) {
  // case-insensitive includes without regex
  if(!needle) return true;
  const h = (hay || "").toLowerCase();
  const n = (needle || "").toLowerCase().trim();
  if(!n) return true;
  return h.indexOf(n) !== -1;
}

function matches(it) {
  if(!FILTER) return true;
  const hay = (it.name || "") + " " + (it.type || "");
  return textIncludes(hay, FILTER);
}

function filtered(list) {
  return (list || []).filter(matches);
}

function buildItemRow(it) {
  const row = document.createElement("div");
  row.className = "item";

  const icon = document.createElement("img");
  icon.className = "item__icon";
  icon.alt = "";
  icon.src = it.icon || "";
  row.appendChild(icon);

  const body = document.createElement("div");
  body.className = "item__body";

  const nm = document.createElement("div");
  nm.className = "item__name";
  nm.textContent = it.name || "";
  nm.onclick = () => {
    const pick = $("#picker");
    if(pick) {
      pick.value = it.id;
      onPickChange();
    }
  };
  body.appendChild(nm);

  const meta = document.createElement("div");
  meta.className = "item__type";
  const spawn = Array.isArray(it.spawn) && it.spawn.length ? (" · Appears in: " + it.spawn.join(" • ")) : "";
  meta.textContent = (it.type || "").toString().replaceAll("_"," ") + spawn;
  body.appendChild(meta);

  const tickLine = document.createElement("label");
  tickLine.className = "tickline";
  const cb = document.createElement("input");
  cb.type = "checkbox";
  cb.dataset.id = it.id;
  cb.checked = getTick(it.id);
  cb.onchange = () => setTick(it.id, cb.checked);
  const sp = document.createElement("span");
  sp.textContent = "Done";
  tickLine.appendChild(cb);
  tickLine.appendChild(sp);
  body.appendChild(tickLine);

  row.appendChild(body);
  return row;
}

function renderPicker() {
  const pick = $("#picker");
  if(!pick) return;
  pick.innerHTML = "";
  const opt0 = document.createElement("option");
  opt0.value = "";
  opt0.textContent = "Select...";
  pick.appendChild(opt0);

  filtered(DATA).forEach(it => {
    const o = document.createElement("option");
    o.value = it.id;
    o.textContent = (it.name || "") + " (" + (it.type || "").toString().replaceAll("_"," ") + ")";
    pick.appendChild(o);
  });
}

function renderLists() {
  const chars = filtered(DATA.filter(x => x.type === "character" || x.type === "tainted_character"));
  const bosses = filtered(DATA.filter(x => x.type === "boss"));
  const finals = filtered(DATA.filter(x => (x.type || "").toString().indexOf("final_boss") === 0));

  const lc = $("#listCharacters");
  const lb = $("#listBosses");
  const lf = $("#listFinals");

  if(lc) {
    lc.innerHTML = "";
    chars.forEach(it => lc.appendChild(buildItemRow(it)));
  }
  if(lb) {
    lb.innerHTML = "";
    bosses.forEach(it => lb.appendChild(buildItemRow(it)));
  }
  if(lf) {
    lf.innerHTML = "";
    finals.forEach(it => lf.appendChild(buildItemRow(it)));
  }

  const mc = $("#metaChars"); if(mc) mc.textContent = chars.length + " shown";
  const mb = $("#metaBosses"); if(mb) mb.textContent = bosses.length + " shown";
  const mf = $("#metaFinals"); if(mf) mf.textContent = finals.length + " shown";
}

function enrichTextToNode(s) {
  // Turns text with [[Links]] into a DocumentFragment without regex.
  const frag = document.createDocumentFragment();
  const text = (s || "").toString();
  let i = 0;

  while(i < text.length) {
    const open = text.indexOf("[[", i);
    if(open === -1) {
      frag.appendChild(document.createTextNode(text.slice(i)));
      break;
    }
    // add text before link
    if(open > i) frag.appendChild(document.createTextNode(text.slice(i, open)));

    const close = text.indexOf("]]", open + 2);
    if(close === -1) {
      // no closing, treat rest as plain text
      frag.appendChild(document.createTextNode(text.slice(open)));
      break;
    }

    const label = text.slice(open + 2, close).trim();
    const id = NAME_TO_ID[label.toLowerCase()];
    if(id) {
      const a = document.createElement("a");
      a.href = "#";
      a.textContent = label;
      a.onclick = (e) => {
        e.preventDefault();
        const sEl = $("#search");
        if(sEl) sEl.value = "";
        FILTER = "";
        renderPicker();
        renderLists();
        const pick = $("#picker");
        if(pick) {
          pick.value = id;
          onPickChange();
        }
      };
      frag.appendChild(a);
    } else {
      frag.appendChild(document.createTextNode(label));
    }

    i = close + 2;
  }

  return frag;
}

function renderInstructions(container, text) {
  if(!container) return;
  container.className = "instructions";
  container.innerHTML = "";

  const raw = (text || "").toString().replaceAll("\r\n","\n").replaceAll("\r","\n").trim();
  if(!raw) {
    container.textContent = "Pick an item to see instructions.";
    return;
  }

  const lines = raw.split("\n");
  let ul = null;

  function flushUL() { ul = null; }

  for(let idx=0; idx<lines.length; idx++) {
    const t = (lines[idx] || "").trim();
    if(!t) { flushUL(); continue; }

    if(t.startsWith("## ")) {
      flushUL();
      const h = document.createElement("h3");
      h.textContent = t.slice(3).trim();
      container.appendChild(h);
      continue;
    }

    if(t.startsWith("- ")) {
      if(!ul) {
        ul = document.createElement("ul");
        container.appendChild(ul);
      }
      const li = document.createElement("li");
      li.appendChild(enrichTextToNode(t.slice(2)));
      ul.appendChild(li);
      continue;
    }

    flushUL();
    const p = document.createElement("p");
    p.appendChild(enrichTextToNode(t));
    container.appendChild(p);
  }
}

function onPickChange() {
  const pick = $("#picker");
  const id = pick ? pick.value : "";
  const it = DATA.find(x => x.id === id);

  const icon = $("#pickIcon");
  const name = $("#pickName");
  const type = $("#pickType");
  const tick = $("#pickTick");
  const instr = $("#pickInstr");
  const links = $("#pickLinks");

  if(!it) {
    if(icon) icon.src = "";
    if(name) name.textContent = "";
    if(type) type.textContent = "";
    if(tick) { tick.checked = false; tick.disabled = true; tick.onchange = null; }
    if(instr) instr.textContent = "Pick an item to see instructions.";
    if(links) links.innerHTML = "";
    return;
  }

  if(icon) icon.src = it.icon || "";
  if(name) name.textContent = it.name || "";
  const spawn = Array.isArray(it.spawn) && it.spawn.length ? (" · Appears in: " + it.spawn.join(" • ")) : "";
  if(type) type.textContent = (it.type || "").toString().replaceAll("_"," ") + spawn;

  if(tick) {
    tick.disabled = false;
    tick.checked = getTick(it.id);
    tick.onchange = () => setTick(it.id, tick.checked);
    tick.dataset.id = it.id;
  }

  renderInstructions(instr, it.instructions || "");

  if(links) {
    links.innerHTML = "";
    const arr = Array.isArray(it.links) ? it.links : [];
    for(let i=0;i<arr.length;i++) {
      const l = arr[i];
      if(!l || !l.url) continue;
      const a = document.createElement("a");
      a.href = l.url;
      a.target = "_blank";
      a.rel = "noreferrer";
      a.textContent = l.label || "Link";
      links.appendChild(a);
    }
  }
}

function renderStats() {
  const el = $("#stats");
  if(!el) return;
  const total = DATA.length;
  let done = 0;
  for(let i=0;i<DATA.length;i++) {
    if(getTick(DATA[i].id)) done++;
  }
  const pct = total ? Math.round((done/total)*100) : 0;
  el.textContent = "Total: " + done + "/" + total + " (" + pct + "%)";
}

function exportProgress() {
  const payload = { build: BUILD, savedAt: new Date().toISOString(), state: STATE };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "isaac-progress.json";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function importProgressFile(file) {
  const r = new FileReader();
  r.onload = () => {
    try {
      const payload = JSON.parse(r.result);
      const st = payload && payload.state ? payload.state : payload;
      if(!st || typeof st !== "object") throw new Error("No state object found");
      STATE = st;
      saveState();
      renderLists();
      renderStats();
      onPickChange();
    } catch(e) {
      alert("Import failed: " + e.message);
    }
  };
  r.readAsText(file);
}

async function loadData() {
  const res = await fetch("./data.json", { cache: "no-store" });
  if(!res.ok) throw new Error("Failed to fetch data.json (" + res.status + ")");
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); }
  catch(e) { throw new Error("data.json invalid JSON: " + e.message); }
  const items = json && Array.isArray(json.items) ? json.items : [];
  return items;
}

async function init() {
  setBoot("JS loaded (build " + BUILD + "). Loading data.json...");

  try {
    DATA = await loadData();
    if(!Array.isArray(DATA)) DATA = [];

    NAME_TO_ID = {};
    for(let i=0;i<DATA.length;i++) {
      const it = DATA[i];
      if(it && it.name && it.id) {
        NAME_TO_ID[it.name.toLowerCase()] = it.id;
      }
    }

    loadState();

    const search = $("#search");
    if(search) {
      search.addEventListener("input", (e) => {
        FILTER = e.target.value || "";
        renderPicker();
        renderLists();
      });
    }

    const picker = $("#picker");
    if(picker) picker.addEventListener("change", onPickChange);

    const ex = $("#exportBtn"); if(ex) ex.addEventListener("click", exportProgress);
    const im = $("#importBtn"); if(im) im.addEventListener("click", () => { const fi=$("#fileInput"); if(fi) fi.click(); });
    const fi = $("#fileInput");
    if(fi) {
      fi.addEventListener("change", (e) => {
        const f = e.target.files && e.target.files[0];
        if(f) importProgressFile(f);
        e.target.value = "";
      });
    }
    const rs = $("#resetBtn");
    if(rs) {
      rs.addEventListener("click", () => {
        if(confirm("Reset ALL ticks on this device?")) {
          STATE = {};
          saveState();
          renderLists();
          renderStats();
          onPickChange();
        }
      });
    }

    renderPicker();
    renderLists();
    renderStats();
    onPickChange();

    setBoot("OK (build " + BUILD + "): loaded " + DATA.length + " entries.");
  } catch(e) {
    showError("App failed to start.", (e && e.stack) ? e.stack : String(e));
    setBoot("ERROR (build " + BUILD + "): " + (e && e.message ? e.message : "unknown"));
  }
}

document.addEventListener("DOMContentLoaded", init);
