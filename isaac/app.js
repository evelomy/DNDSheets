const STORE_KEY = "isaacChecklist.v1";

const $ = (s) => document.querySelector(s);
const el = (tag, cls) => { const n=document.createElement(tag); if(cls) n.className=cls; return n; };

let DATA = [];
let STATE = {}; // id -> boolean
let FILTER = "";

function loadState(){
  try{ STATE = JSON.parse(localStorage.getItem(STORE_KEY) || "{}"); }
  catch{ STATE = {}; }
}
function saveState(){
  localStorage.setItem(STORE_KEY, JSON.stringify(STATE));
}
function setTick(id, val){
  STATE[id] = !!val;
  saveState();
  // Sync all checkboxes with same data-id
  document.querySelectorAll(`input[type="checkbox"][data-id="${cssEscape(id)}"]`).forEach(cb => cb.checked = !!val);
  // Sync picker tick
  const pickId = $("#picker").value;
  if(pickId === id) $("#pickTick").checked = !!val;
  renderStats();
}
function getTick(id){ return !!STATE[id]; }

function cssEscape(str){
  // tiny escape for querySelector
  return str.replace(/"/g, '\\"');
}

function filtered(items){
  if(!FILTER) return items;
  const q = FILTER.toLowerCase().trim();
  return items.filter(it => (it.name + " " + it.type).toLowerCase().includes(q));
}

function buildItemRow(it){
  const row = el("div","item");
  const icon = el("img","item__icon");
  icon.alt = "";
  icon.src = it.icon || "";
  row.appendChild(icon);

  const body = el("div");
  const name = el("div","item__name");
  name.textContent = it.name;
  const type = el("div","item__type");
  type.textContent = it.type.replaceAll("_"," ");
  body.appendChild(name);
  body.appendChild(type);

  const tickLine = el("label","tickline");
  const cb = el("input");
  cb.type="checkbox";
  cb.checked = getTick(it.id);
  cb.dataset.id = it.id;
  cb.addEventListener("change", () => setTick(it.id, cb.checked));
  const span = el("span");
  span.textContent = "Done";
  tickLine.appendChild(cb);
  tickLine.appendChild(span);

  body.appendChild(tickLine);

  // Clicking name selects in dropdown
  name.style.cursor="pointer";
  name.addEventListener("click", () => {
    $("#picker").value = it.id;
    onPickChange();
  });

  row.appendChild(body);
  return row;
}

function renderLists(){
  const chars = filtered(DATA.filter(d => d.type==="character" || d.type==="tainted_character"));
  const bosses = filtered(DATA.filter(d => d.type==="boss"));
  const finals = filtered(DATA.filter(d => d.type.startsWith("final_boss")));

  $("#listCharacters").innerHTML = "";
  chars.forEach(it => $("#listCharacters").appendChild(buildItemRow(it)));
  $("#listBosses").innerHTML = "";
  bosses.forEach(it => $("#listBosses").appendChild(buildItemRow(it)));
  $("#listFinals").innerHTML = "";
  finals.forEach(it => $("#listFinals").appendChild(buildItemRow(it)));

  $("#metaChars").textContent = `${chars.length} shown`;
  $("#metaBosses").textContent = `${bosses.length} shown`;
  $("#metaFinals").textContent = `${finals.length} shown`;
}

function renderPicker(){
  const pick = $("#picker");
  pick.innerHTML = "";
  const opt0 = el("option");
  opt0.value="";
  opt0.textContent="Select…";
  pick.appendChild(opt0);

  const items = filtered(DATA);
  items.forEach(it => {
    const o = el("option");
    o.value = it.id;
    o.textContent = `${it.name}  (${it.type.replaceAll("_"," ")})`;
    pick.appendChild(o);
  });
}

function onPickChange(){
  const id = $("#picker").value;
  const it = DATA.find(x => x.id===id);
  if(!it){
    $("#pickIcon").src="";
    $("#pickName").textContent="";
    $("#pickType").textContent="";
    $("#pickInstr").textContent="Pick an item to see instructions.";
    $("#pickLinks").innerHTML="";
    $("#pickTick").checked=false;
    $("#pickTick").disabled=true;
    return;
  }
  $("#pickIcon").src = it.icon || "";
  $("#pickName").textContent = it.name;
  $("#pickType").textContent = it.type.replaceAll("_"," ");
  const spawn = (it.spawn && it.spawn.length) ? ("Appears in: " + it.spawn.join(" • ")) : "";
  if(spawn){ $("#pickType").textContent += "  ·  " + spawn; }

  $("#pickInstr").textContent = it.instructions || "";
  $("#pickTick").disabled=false;
  $("#pickTick").checked = getTick(it.id);
  $("#pickTick").onchange = () => setTick(it.id, $("#pickTick").checked);

  $("#pickLinks").innerHTML="";
  (it.links || []).forEach(l => {
    const a = el("a");
    a.href = l.url;
    a.target="_blank";
    a.rel="noreferrer";
    a.textContent = l.label;
    $("#pickLinks").appendChild(a);
  });
}

function renderStats(){
  const total = DATA.length;
  const done = DATA.filter(it => getTick(it.id)).length;
  const pct = total ? Math.round(done/total*100) : 0;

  const byType = {};
  DATA.forEach(it => {
    byType[it.type] = byType[it.type] || {total:0, done:0};
    byType[it.type].total++;
    if(getTick(it.id)) byType[it.type].done++;
  });

  const lines = [];
  lines.push(`Total: ${done}/${total} (${pct}%)`);
  Object.entries(byType).sort().forEach(([k,v]) => {
    lines.push(`${k.replaceAll("_"," ")}: ${v.done}/${v.total}`);
  });

  $("#stats").textContent = lines.join("\n");
}

function exportProgress(){
  const payload = { version: 1, state: STATE };
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
        STATE = payload.state;
        saveState();
        renderLists();
        renderStats();
        onPickChange();
        // Sync all checkbox DOM states
        DATA.forEach(it => setTick(it.id, getTick(it.id)));
      } else {
        alert("That JSON doesn't look right.");
      }
    }catch(e){
      alert("Could not read JSON: " + e.message);
    }
  };
  reader.readAsText(file);
}

async function init(){
  loadState();
  const res = await fetch("./data.json");
  const j = await res.json();
  DATA = j.items || [];

  // Search
  $("#search").addEventListener("input", (e) => {
    FILTER = e.target.value || "";
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
    if(confirm("Reset ALL ticks? This is irreversible. Like opening a cursed chest on 1 HP.")){
      STATE = {};
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
}
init();
