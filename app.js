/**

- app.js — Logique principale de l'application Cantine
- Structure vote par jour : { time: '11:45'|'12:30'|null, veg: true|false }
  */

let currentYear, currentMonth;
let votes     = {};
let people    = [];
let tempVotes = {};

document.addEventListener('DOMContentLoaded', async () => {
const today  = new Date();
currentYear  = today.getFullYear();
currentMonth = today.getMonth();
people = getPeople();
await loadMonth();
bindEvents();
startPolling();
});

/* ══════════════════════════════════════════════
POLLING — rafraîchit le tableau toutes les 30s
══════════════════════════════════════════════ */
function startPolling() {
setInterval(async () => {
if (document.getElementById('voteModal').classList.contains('is-open')) return;
votes = await loadVotes(currentYear, currentMonth);
renderAll();
}, 30000);
}

async function loadMonth() {
showSkeleton();
votes = await loadVotes(currentYear, currentMonth);
renderAll();
}

function bindEvents() {
document.getElementById('prevMonthBtn').addEventListener('click', async () => {
currentMonth-1;
if (currentMonth < 0) { currentMonth = 11; currentYear-1; }
await loadMonth();
});
document.getElementById('nextMonthBtn').addEventListener('click', async () => {
currentMonth++;
if (currentMonth > 11) { currentMonth = 0; currentYear++; }
await loadMonth();
});

document.getElementById('addPersonBtn').addEventListener('click', openAddModal);
document.getElementById('closeAddModal').addEventListener('click', closeAddModal);
document.getElementById('confirmAddPerson').addEventListener('click', confirmAddPerson);
document.getElementById('addModal').addEventListener('click', (e) => {
if (e.target === e.currentTarget) closeAddModal();
});
document.getElementById('newPersonInput').addEventListener('keydown', (e) => {
if (e.key === 'Enter') confirmAddPerson();
});

document.getElementById('closeModal').addEventListener('click', closeVoteModal);
document.getElementById('voteModal').addEventListener('click', (e) => {
if (e.target === e.currentTarget) closeVoteModal();
});
document.getElementById('validateVoteBtn').addEventListener('click', savePersonVotes);
}

/* ══════════════════════════════════════════════
RENDER
══════════════════════════════════════════════ */
function renderAll() {
document.getElementById('monthLabel').textContent =
`${MONTH_NAMES[currentMonth]} ${currentYear}`;
const today    = new Date();
const todayISO = dateISO(today.getFullYear(), today.getMonth(), today.getDate());
const workDays = getWorkingDays(currentYear, currentMonth);
renderHead(workDays, todayISO);
renderBody(workDays, todayISO);
renderFoot(workDays);
}

function renderHead(workDays, todayISO) {
const thead = document.getElementById('tableHead');
thead.innerHTML = '';
const r1 = document.createElement('tr');
const th0 = document.createElement('th');
th0.className = 'col-name th-name';
th0.rowSpan = 2;
th0.textContent = 'Participants';
r1.appendChild(th0);
workDays.forEach(day => {
const iso = dateISO(currentYear, currentMonth, day);
const dow = new Date(currentYear, currentMonth, day).getDay();
const th  = document.createElement('th');
th.className = 'th-day-group';
th.colSpan = 3;
if (iso === todayISO) th.classList.add('is-today');
th.innerHTML = `<span class="day-num">${day}</span>${DAY_SHORT[dow]}`;
r1.appendChild(th);
});
thead.appendChild(r1);
const r2 = document.createElement('tr');
workDays.forEach(() => {
[['🥦','sub-veg','Vég.'], ['🕐','sub-1145','11h45'], ['🕛','sub-1230','12h30']].forEach(([icon, cls, label]) => {
const th = document.createElement('th');
th.className = `th-sub ${cls}`;
th.title = label;
th.textContent = icon;
r2.appendChild(th);
});
});
thead.appendChild(r2);
}

function renderBody(workDays, todayISO) {
const tbody = document.getElementById('tableBody');
tbody.innerHTML = '';
people.forEach(person => {
const tr = document.createElement('tr');
const tdName = document.createElement('td');
tdName.className = 'col-name';
const initials = getInitials(person);
const color    = getAvatarColor(person);
tdName.innerHTML = ` <button class="person-btn" data-person="${escHtml(person)}" title="Modifier le vote de ${escHtml(person)}"> <span class="person-avatar" style="background:${color}">${initials}</span> <span class="person-name-full">${escHtml(person)}</span> <span class="person-name-initials">${initials}</span> </button>`;
tr.appendChild(tdName);
const personVotes = votes[person] || {};
workDays.forEach(day => {
const iso     = dateISO(currentYear, currentMonth, day);
const dayVote = personVotes[iso] || {};
const past    = isPast(iso, todayISO);
const tdVeg = document.createElement('td');
tdVeg.className = 'cell-vote' + (past ? ' col-past' : '');
if (dayVote.veg) { const d = document.createElement('div'); d.className='dot dot-veg'; d.textContent='🥦'; tdVeg.appendChild(d); }
tr.appendChild(tdVeg);
const td1145 = document.createElement('td');
td1145.className = 'cell-vote' + (past ? ' col-past' : '');
if (dayVote.time === '11:45') { const d = document.createElement('div'); d.className='dot dot-1145'; d.textContent='🕐'; td1145.appendChild(d); }
tr.appendChild(td1145);
const td1230 = document.createElement('td');
td1230.className = 'cell-vote' + (past ? ' col-past' : '');
if (dayVote.time === '12:30') { const d = document.createElement('div'); d.className='dot dot-1230'; d.textContent='🕛'; td1230.appendChild(d); }
tr.appendChild(td1230);
});
tbody.appendChild(tr);
});
tbody.onclick = (e) => {
const btn = e.target.closest('.person-btn');
if (btn) openVoteModal(btn.dataset.person);
};
}

function renderFoot(workDays) {
const tfoot = document.getElementById('tableFoot');
tfoot.innerHTML = '';
const rows = [
{ label: '🥦 Vég.',  key: 'veg',   cls: 'total-veg'  },
{ label: '🕐 11h45', key: '11:45', cls: 'total-1145' },
{ label: '🕛 12h30', key: '12:30', cls: 'total-1230' },
{ label: '∑ Total',  key: null,    cls: 'total-day'  },
];
rows.forEach(({ label, key, cls }) => {
const tr = document.createElement('tr');
const tdL = document.createElement('td');
tdL.className = 'col-name';
tdL.textContent = label;
tr.appendChild(tdL);
workDays.forEach(day => {
const iso    = dateISO(currentYear, currentMonth, day);
const counts = countDay(iso);
['veg', '11:45', '12:30'].forEach(col => {
const td = document.createElement('td');
if (key === null) {
td.className   = col === 'veg' ? cls : '';
td.textContent = col === 'veg' ? (counts.total || '') : '';
} else {
td.className   = col === key ? cls : '';
td.textContent = col === key ? (counts[key] || '') : '';
}
tr.appendChild(td);
});
});
tfoot.appendChild(tr);
});
}

/* ══════════════════════════════════════════════
MODAL VOTE
══════════════════════════════════════════════ */
function openVoteModal(person) {
document.getElementById('modalPersonName').textContent = person;
document.getElementById('modalMonthLabel').textContent =
`${MONTH_NAMES[currentMonth]} ${currentYear}`;
const existing = votes[person] || {};
tempVotes = {};
Object.entries(existing).forEach(([iso, val]) => {
if (val && typeof val === 'object') {
tempVotes[iso] = { time: val.time || null, veg: !!val.veg };
} else if (typeof val === 'string') {
tempVotes[iso] = { time: (val === '11:45' || val === '12:30') ? val : null, veg: val === 'veg' };
}
});
buildModalGrid();
document.getElementById('voteModal').classList.add('is-open');
document.body.style.overflow = 'hidden';
}

function closeVoteModal() {
document.getElementById('voteModal').classList.remove('is-open');
document.body.style.overflow = '';
}

function buildModalGrid() {
const grid     = document.getElementById('modalGrid');
grid.innerHTML = '';
const today    = new Date();
const todayISO = dateISO(today.getFullYear(), today.getMonth(), today.getDate());
const weeks    = getWeeksOfMonth(currentYear, currentMonth);

weeks.forEach((weekDays, wi) => {
if (!weekDays.length) return;
const weekRow = document.createElement('div');
weekRow.className = 'week-row';
const wLabel = document.createElement('div');
wLabel.className = 'week-label';
wLabel.textContent = `Semaine ${wi + 1} — du ${weekDays[0]} au ${weekDays[weekDays.length-1]} ${MONTH_NAMES[currentMonth].slice(0,3)}.`;
weekRow.appendChild(wLabel);
const daysContainer = document.createElement('div');
daysContainer.className = 'week-days';

```
weekDays.forEach(day => {
  const iso  = dateISO(currentYear, currentMonth, day);
  const dow  = new Date(currentYear, currentMonth, day).getDay();
  const past = iso < todayISO;
  if (!tempVotes[iso]) tempVotes[iso] = { time: null, veg: false };
  const dayVote = tempVotes[iso];

  const card = document.createElement('div');
  card.className = 'day-card' + (past ? ' is-past' : '') + (iso === todayISO ? ' is-today' : '');
  card.innerHTML = `<div class="day-card-num">${day}</div><div class="day-card-name">${DAY_SHORT[dow]}</div>`;

  // ── Checkbox végétarien ──
  const vegLabel = document.createElement('label');
  vegLabel.className = 'vote-option opt-veg' + (dayVote.veg ? ' selected' : '');
  vegLabel.title = 'Végétarien';
  const vegInput = document.createElement('input');
  vegInput.type    = 'checkbox';
  vegInput.checked = !!dayVote.veg;
  vegInput.addEventListener('change', () => {
    dayVote.veg = vegInput.checked;
    vegLabel.classList.toggle('selected', vegInput.checked);
  });
  vegLabel.appendChild(vegInput);
  vegLabel.appendChild(document.createTextNode('🥦'));
  card.appendChild(vegLabel);

  // ── Boutons horaire : on gère TOUT via click sur le label ──
  // On n'utilise PAS les events natifs radio (change) pour éviter
  // le conflit label→input double-déclenchement.
  [['11:45', '🕐', 'opt-1145'], ['12:30', '🕛', 'opt-1230']].forEach(([val, icon, cls]) => {
    const timeLabel = document.createElement('label');
    timeLabel.className = `vote-option ${cls}` + (dayVote.time === val ? ' selected' : '');
    timeLabel.title = val;

    const timeInput = document.createElement('input');
    timeInput.type  = 'radio';
    timeInput.name  = `time_${iso}`;
    timeInput.value = val;
    timeInput.checked = dayVote.time === val;
    // Empêcher le comportement natif du label (qui déclencherait change)
    timeInput.style.display = 'none';

    timeLabel.addEventListener('click', (e) => {
      e.preventDefault(); // neutralise le comportement natif label→input
      if (dayVote.time === val) {
        // Déjà sélectionné → on décoche
        dayVote.time = null;
        timeInput.checked = false;
        card.querySelectorAll('.opt-1145, .opt-1230').forEach(l => l.classList.remove('selected'));
      } else {
        // Sélectionner cet horaire
        dayVote.time = val;
        timeInput.checked = true;
        card.querySelectorAll('.opt-1145, .opt-1230').forEach(l => l.classList.remove('selected'));
        timeLabel.classList.add('selected');
      }
    });

    timeLabel.appendChild(timeInput);
    timeLabel.appendChild(document.createTextNode(icon));
    card.appendChild(timeLabel);
  });

  daysContainer.appendChild(card);
});

weekRow.appendChild(daysContainer);
grid.appendChild(weekRow);
```

});
}

async function savePersonVotes() {
const person = document.getElementById('modalPersonName').textContent;
const clean  = {};
Object.entries(tempVotes).forEach(([iso, dayVote]) => {
if (dayVote.veg || dayVote.time) {
clean[iso] = { time: dayVote.time || null, veg: !!dayVote.veg };
}
});
votes[person] = clean;
const btn = document.getElementById('validateVoteBtn');
btn.textContent = '⏳ Enregistrement…';
btn.disabled = true;
await saveVotes(currentYear, currentMonth, votes);
btn.textContent = '✓ Enregistrer mon planning';
btn.disabled = false;
closeVoteModal();
renderAll();
showToast(`✓ Vote de ${person} enregistré`);
}

/* ══════════════════════════════════════════════
MODAL AJOUTER PERSONNE
══════════════════════════════════════════════ */
function openAddModal() {
document.getElementById('newPersonInput').value = '';
document.getElementById('addModal').classList.add('is-open');
document.body.style.overflow = 'hidden';
setTimeout(() => document.getElementById('newPersonInput').focus(), 100);
}
function closeAddModal() {
document.getElementById('addModal').classList.remove('is-open');
document.body.style.overflow = '';
}
function confirmAddPerson() {
const name = document.getElementById('newPersonInput').value.trim();
if (!name) { showToast('⚠️ Veuillez saisir un nom'); return; }
if (!addPerson(name)) { showToast(`⚠️ "${name}" existe déjà`); return; }
people = getPeople();
closeAddModal();
renderAll();
showToast(`✓ ${name} ajouté(e)`);
}

/* ══════════════════════════════════════════════
HELPERS
══════════════════════════════════════════════ */
function isPast(iso, todayISO) { return iso < todayISO; }

function countDay(iso) {
const counts = { veg: 0, '11:45': 0, '12:30': 0, total: 0 };
people.forEach(p => {
const dayVote = (votes[p] || {})[iso];
if (!dayVote) return;
if (dayVote.veg)             counts.veg++;
if (dayVote.time === '11:45') { counts['11:45']++; counts.total++; }
if (dayVote.time === '12:30') { counts['12:30']++; counts.total++; }
});
return counts;
}

function getWeeksOfMonth(year, month) {
const weeks = [];
let week = [];
const total = new Date(year, month+1, 0).getDate();
for (let d = 1; d <= total; d++) {
const dow = new Date(year, month, d).getDay();
if (dow === 1 && week.length > 0) { weeks.push(week); week = []; }
if (dow !== 0 && dow !== 6) week.push(d);
}
if (week.length) weeks.push(week);
return weeks;
}

function escHtml(s) {
return s.replace(/&/g,'&').replace(/</g,'<').replace(/>/g,'>').replace(/”/g,'"');
}

function showSkeleton() {
document.getElementById('tableHead').innerHTML = '';
document.getElementById('tableBody').innerHTML =
'<tr><td class="col-name" colspan="100" style="padding:32px;text-align:center;color:var(--ios-gray);font-size:14px">Chargement…</td></tr>';
document.getElementById('tableFoot').innerHTML = '';
}

let toastTimer;
function showToast(msg) {
const t = document.getElementById('toast');
t.textContent = msg;
t.classList.add('show');
clearTimeout(toastTimer);
toastTimer = setTimeout(() => t.classList.remove('show'), 2800);
}
