const STORE_KEY = "isaacChecklist.v2";
const $ = (s) => document.querySelector(s);

let DATA = [];
let state = {};
let filter = "";
let nameToId = {};

function loadState(){
  try { state = JSON.parse(localStorage.getItem(STORE_KEY) || "{}"); }
  catch { state = {}; }
}
function saveState(){
  localStorage.setItem(STORE_KEY, JSON.stringify(state));
}
function setTick(id, val){
  state[id] = !!val;
  saveState();
  document.querySelectorAll(`input[type="checkbox"][data-id="${id}"]`).forEach(cb => cb.checked = !!val);
  if($("#picker").value === id) $("#pickTick").checked = !!val;
  renderStats();
}
function getTick(id){ return !!state[id]; }

function create(tag, cls){
  const el = document.createElement(tag);
  if(cls) el.className = cls;
  return el;
}
function safeText(s){ return (s ?? "").toString(); }

function renderError(msg, err, extra){
  const box = $("#errorBox");
  box.style.display = "block";
  box.innerHTML = "";
  const h = create("div","errorTitle");
  h.textContent = msg;
  const pre = create("pre","errorPre");
  pre.textContent = [
    err ? (err.stack || err.message || String(err)) : "",
    extra ? "\n" + extra : ""
  ].join("");
  box.appendChild(h);
  box.appendChild(pre);
}

function matches(it){
  if(!filter) return true;
  const q = filter.toLowerCase().trim();
  return (it.name + " " + it.type).toLowerCase().includes(q);
}
function filtered(list){ return list.filter(matches); }

function renderPicker(){
  const pick = $("#picker");
  pick.innerHTML = "";
  const opt0 = create("option");
  opt0.value = "";
  opt0.textContent = "Select…";
  pick.appendChild(opt0);

  filtered(DATA).forEach(it => {
    const o = create("option");
    o.value = it.id;
    o.textContent = `${it.name} (${it.type.replaceAll("_"," ")})`;
    pick.appendChild(o);
  });
}

function renderItemRow(it){
  const row = create("div","item");

  const icon = create("img","item__icon");
  icon.alt = "";
  icon.src = it.icon || "";
  row.appendChild(icon);

  const body = create("div","item__body");

  const name = create("div","item__name");
  name.textContent = it.name;
  name.onclick = () => { $("#picker").value = it.id; onPickChange(); };
  body.appendChild(name);

  const meta = create("div","item__type");
  const spawn = (it.spawn && it.spawn.length) ? ` · Appears in: ${it.spawn.join(" • ")}` : "";
  meta.textContent = it.type.replaceAll("_"," ") + spawn;
  body.appendChild(meta);

  const tickLine = create("label","tickline");
  const cb = create("input");
  cb.type = "checkbox";
  cb.dataset.id = it.id;
  cb.checked = getTick(it.id);
  cb.onchange = () => setTick(it.id, cb.checked);
  const span = create("span");
  span.textContent = "Done";
  tickLine.appendChild(cb);
  tickLine.appendChild(span);
  body.appendChild(tickLine);

  row.appendChild(body);
  return row;
}

function renderLists(){
  const chars = filtered(DATA.filter(x => x.type === "character" || x.type === "tainted_character"));
  const bosses = filtered(DATA.filter(x => x.type === "boss"));
  const finals = filtered(DATA.filter(x => x.type.startsWith("final_boss")));

  const lc = $("#listCharacters"); lc.innerHTML = "";
  chars.forEach(it => lc.appendChild(renderItemRow(it)));
  const lb = $("#listBosses"); lb.innerHTML = "";
  bosses.forEach(it => lb.appendChild(renderItemRow(it)));
  const lf = $("#listFinals"); lf.innerHTML = "";
  finals.forEach(it => lf.appendChild(renderItemRow(it)));

  $("#metaChars").textContent = `${chars.length} shown`;
  $("#metaBosses").textContent = `${bosses.length} shown`;
  $("#metaFinals").textContent = `${finals.length} shown`;
}

function renderInstructions(container, text){
  container.innerHTML = "";
  const raw = safeText(text).trim();
  if(!raw){
    container.textContent = "No instructions yet for this entry.";
    return;
  }
  const lines = raw.split(/\r?\n/);
  let ul = null;

  const flushUL = () => { ul = null; };

  const makeLink = (label) => {
    const id = nameToId[label.toLowerCase()];
    if(!id) return null;
    const a = create("a");
    a.href = "#";
    a.textContent = label;
    a.onclick = (e) => {
      e.preventDefault();
      $("#search").value = "";
      filter = "";
      renderPicker();
      renderLists();
      $("#picker").value = id;
      onPickChange();
    };
    return a;
  };

  const enrich = (s) => {
    const frag = document.createDocumentFragment();
    const rx = /\[\[([^\]]+)\]\]/g;
    let last = 0, m;
    while((m = rx.exec(s))){
      const before = s.slice(last, m.index);
      if(before) frag.appendChild(document.createTextNode(before));
      const label = m[1].trim();
      const link = makeLink(label);
      if(link) frag.appendChild(link);
      else frag.appendChild(document.createTextNode(label));
      last = m.index + m[0].length;
    }
    const tail = s.slice(last);
    if(tail) frag.appendChild(document.createTextNode(tail));
    return frag;
  };

  for(const line of lines){
    const t = line.trim();
    if(!t){ flushUL(); continue; }
    if(t.startsWith("## ")){
      flushUL();
      const h = create("h3");
      h.textContent = t.slice(3);
      container.appendChild(h);
      continue;
    }
    if(t.startsWith("- ")){
      if(!ul){
        ul = create("ul");
        container.appendChild(ul);
      }
      const li = create("li");
      li.appendChild(enrich(t.slice(2)));
      ul.appendChild(li);
      continue;
    }
    flushUL();
    const p = create("p");
    p.appendChild(enrich(t));
    container.appendChild(p);
  }
}

function onPickChange(){
  const id = $("#picker").value;
  const it = DATA.find(x => x.id === id);
  if(!it){
    $("#pickIcon").src = "";
    $("#pickName").textContent = "";
    $("#pickType").textContent = "";
    $("#pickTick").checked = false;
    $("#pickTick").disabled = true;
    $("#pickInstr").textContent = "Pick an item to see instructions.";
    $("#pickLinks").innerHTML = "";
    return;
  }

  $("#pickIcon").src = it.icon || "";
  $("#pickName").textContent = it.name;
  const spawn = (it.spawn && it.spawn.length) ? ` · Appears in: ${it.spawn.join(" • ")}` : "";
  $("#pickType").textContent = it.type.replaceAll("_"," ") + spawn;

  $("#pickTick").disabled = false;
  $("#pickTick").checked = getTick(it.id);
  $("#pickTick").onchange = () => setTick(it.id, $("#pickTick").checked);

  renderInstructions($("#pickInstr"), it.instructions || "");

  const links = $("#pickLinks");
  links.innerHTML = "";
  (it.links || []).forEach(l => {
    const a = create("a");
    a.href = l.url;
    a.target = "_blank";
    a.rel = "noreferrer";
    a.textContent = l.label;
    links.appendChild(a);
  });
}

function renderStats(){
  const total = DATA.length;
  const done = DATA.filter(it => getTick(it.id)).length;
  const pct = total ? Math.round(done/total*100) : 0;
  $("#stats").textContent = `Total: ${done}/${total} (${pct}%)`;
}

function exportProgress(){
  const payload = { version: 2, state };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {type:"application/json"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "isaac-progress.json";
  a.click();
  URL.revokeObjectURL(url);
}
function importProgress(file){
  const reader = new FileReader();
  reader.onload = () => {
    try{
      const payload = JSON.parse(reader.result);
      if(payload && payload.state){
        state = payload.state;
        saveState();
        renderLists();
        renderStats();
        onPickChange();
      } else {
        alert("That JSON doesn't look right.");
      }
    }catch(e){
      alert("Could not read JSON: " + e.message);
    }
  };
  reader.readAsText(file);
}

async function loadData(){
  // Make failures loud, not silent.
  const url = "./data.json";
  const res = await fetch(url, { cache: "no-store" });
  if(!res.ok){
    throw new Error(`Failed to fetch ${url} (${res.status} ${res.statusText})`);
  }
  const txt = await res.text();
  try{
    const j = JSON.parse(txt);
    return j.items || [];
  }catch(e){
    throw new Error("data.json is not valid JSON: " + e.message + "\n\nFirst 200 chars:\n" + txt.slice(0,200));
  }
}

async function init(){
  try{
    DATA = await loadData();
    if(!Array.isArray(DATA) || DATA.length === 0){
      renderError("Loaded data.json but DATA is empty.", null, "Check that data.json has { \"items\": [...] } and items have id + name.");
    }

    nameToId = {};
    DATA.forEach(it => { nameToId[(it.name||"").toLowerCase()] = it.id; });

    loadState();

    $("#search").addEventListener("input", (e) => {
      filter = e.target.value || "";
      renderPicker();
      renderLists();
    });
    $("#picker").addEventListener("change", onPickChange);

    $("#exportBtn").addEventListener("click", exportProgress);
    $("#importBtn").addEventListener("click", () => $("#fileInput").click());
    $("#fileInput").addEventListener("change", (e) => {
      const file = e.target.files && e.target.files[0];
      if(file) importProgress(file);
      e.target.value="";
    });
    $("#resetBtn").addEventListener("click", () => {
      if(confirm("Reset ALL ticks?")){
        state = {};
        saveState();
        renderLists();
        renderStats();
        onPickChange();
      }
    });

    renderPicker();
    renderLists();
    renderStats();
    onPickChange();
  }catch(err){
    renderError("App failed to start. Open dev tools for details.", err);
    console.error(err);
  }
}
init();
