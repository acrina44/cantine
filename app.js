/**

- app.js — Logique principale de l'application Cantine
- Structure vote par jour : { time: '11:45'|'12:30'|null, veg: true|false }
  */

let currentYear, currentMonth;
let favoritePerson = getCookieFavorite();
let votes     = {};
let people    = [];
let tempVotes = {};
let menus     = {};

document.addEventListener('DOMContentLoaded', async () => {
const today  = new Date();
currentYear  = today.getFullYear();
currentMonth = today.getMonth();
people = await fetchPeople();
savePeopleLocal(people);
await loadMonth();
bindEvents();
});

async function loadMonth() {
showSkeleton();
votes = await loadVotes(currentYear, currentMonth);
renderAll();
}

function bindEvents() {
const container = document.getElementById('tableContainer');
const fixedHead = document.getElementById('tableHeaderFixed');
container.addEventListener('scroll', () => {
fixedHead.scrollLeft = container.scrollLeft;
});

document.getElementById('prevMonthBtn').addEventListener('click', async () => {
currentMonth = currentMonth - 1;
if (currentMonth < 0) { currentMonth = 11; currentYear = currentYear - 1; }
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

// Print modal
document.getElementById('closePrintModal').addEventListener('click', closePrintModal);
document.getElementById('printModal').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) closePrintModal();
});
document.getElementById('printBtn').addEventListener('click', () => window.print());
document.getElementById('onlyVege').addEventListener('click', () => {
  document.getElementById('onlyVege').classList.toggle('active');
  document.getElementById('list_1145').classList.toggle('hidden');
  document.getElementById('list_1230').classList.toggle('hidden');
});
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
  //renderMenuLink(currentYear, currentMonth);
  renderHead(workDays, todayISO);
  renderBody(workDays, todayISO);
  renderFoot(workDays);
  scrollToToday(workDays, todayISO);
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
    
    
    // Bouton impression
    const printBtn = document.createElement('button');
    printBtn.className = 'btn-print-day';
    printBtn.title = `Imprimer la liste du ${day} ${MONTH_NAMES[currentMonth]}`;
    printBtn.innerHTML = '🖨️';
    printBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      openPrintModal(iso, day, dow);
    });
    
    th.innerHTML = `<span class="day-num">${day}</span>${DAY_SHORT[dow]}`;
    th.appendChild(printBtn);
    r1.appendChild(th);
  });
  
  thead.appendChild(r1);
  const r2 = document.createElement('tr');
  workDays.forEach(() => {
    [['🌱','sub-veg','Vég.'], ['🕚','sub-1145','11h45'], ['🕧','sub-1230','12h30']].forEach(([icon, cls, label]) => {
      const th = document.createElement('th');
      th.className = `th-sub ${cls}`;
      th.title = label;
      th.textContent = `${icon} ${label}`;
      r2.appendChild(th);
    });
  });
  thead.appendChild(r2);
}

function renderBody(workDays, todayISO) {
  const tbody = document.getElementById('tableBody');
  tbody.innerHTML = '';
  const sortedPeople = [...people].sort((a, b) => {
    if (a === favoritePerson) return -1;
    if (b === favoritePerson) return 1;
    return 0;
  });
  sortedPeople.forEach(person => {
    const tr = document.createElement('tr');
    if (person === favoritePerson) tr.classList.add('is-favorite');
    const tdName = document.createElement('td');
    tdName.className = 'col-name';
    const initials = getInitials(person);
    const color    = getAvatarColor(person);
    tdName.innerHTML = `<button class="person-btn" data-person="${escHtml(person)}" title="Modifier le vote de ${escHtml(person)}"><span class="person-avatar" style="background:${color}">${initials}</span><span class="person-name-full">${escHtml(person)}</span><span class="person-name-initials">${initials}</span></button>`;
    tr.appendChild(tdName);
    const personVotes = votes[person] || {};
    workDays.forEach(day => {
      const iso     = dateISO(currentYear, currentMonth, day);
      const dayVote = personVotes[iso] || {};
      const past    = isPast(iso, todayISO);
      const tdVeg = document.createElement('td');
      tdVeg.className = 'cell-vote' + (past ? ' col-past' : '');
      if (dayVote.veg) { const d = document.createElement('div'); d.className='dot dot-veg'; d.textContent='🌱'; tdVeg.appendChild(d); }
      tr.appendChild(tdVeg);
      const td1145 = document.createElement('td');
      td1145.className = 'cell-vote' + (past ? ' col-past' : '');
      if (dayVote.time === '11:45') { const d = document.createElement('div'); d.className='dot dot-1145'; d.textContent='🕚'; td1145.appendChild(d); }
      tr.appendChild(td1145);
      const td1230 = document.createElement('td');
      td1230.className = 'cell-vote' + (past ? ' col-past' : '');
      if (dayVote.time === '12:30') { const d = document.createElement('div'); d.className='dot dot-1230'; d.textContent='🕧'; td1230.appendChild(d); }
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
    { label: '🕚 11h45', key: '11:45', cls: 'total-1145' },
    { label: '🕧 12h30', key: '12:30', cls: 'total-1230' },
    { label: '🌱 Total végé',  key: 'veg',   cls: 'total-veg'  },
    { label: '∑ Total convives',  key: null,    cls: 'total-day'  },
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

function scrollToToday(workDays, todayISO) {
  const isCurrentMonth = currentYear === new Date().getFullYear() && currentMonth === new Date().getMonth();
  if (!isCurrentMonth) return;
  const now = new Date();
  const targetISO = (now.getHours() > 13 || (now.getHours() === 13 && now.getMinutes() >= 30)) ? dateISO(now.getFullYear(), now.getMonth(), now.getDate() + 1) : todayISO;
  const idx = workDays.findIndex(d => dateISO(currentYear, currentMonth, d) === targetISO);
  if (idx < 0) return;
  const container = document.getElementById('tableContainer');
  const fixedHead = document.getElementById('tableHeaderFixed');
  const colNameW  = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--col-name-w')) || 140;
  const colDayW   = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--col-day-w'))  || 86;
  // Colonne d'aujourd'hui en première
  const x = idx * colDayW * 3;
  console.log('workDays : ', workDays);
  console.log('todayISO : ', todayISO);
  console.log('Largeur : ', x);
  container.scrollLeft = Math.max(0, x);
  fixedHead.scrollLeft = container.scrollLeft;
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
  renderStarBtn(person);
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

weekDays.forEach(day => {
  const iso  = dateISO(currentYear, currentMonth, day);
  const dow  = new Date(currentYear, currentMonth, day).getDay();
  const past = iso < todayISO;
  const holidays = getFrenchHolidays(currentYear);
  const holidayName = holidays[iso];
  if (!tempVotes[iso]) tempVotes[iso] = { time: null, veg: false };
  const dayVote = tempVotes[iso];

  const card = document.createElement('div');
  card.className = 'day-card'
    + (past ? ' is-past' : '')
    + (iso === todayISO ? ' is-today' : '')
    + (holidayName ? ' is-holiday' : '');
  if (holidayName) {
    const badge = document.createElement('div');
    badge.className = 'day-holiday-label';
    badge.textContent = holidayName;
    card.appendChild(badge);
  }
  card.innerHTML = `<div class="day-card-num">${day}</div><div class="day-card-name">${DAY_SHORT[dow]}</div>`;

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
  vegLabel.appendChild(document.createTextNode('🌱'));
  card.appendChild(vegLabel);

  [['11:45', '🕚', 'opt-1145'], ['12:30', '🕧', 'opt-1230']].forEach(([val, icon, cls]) => {
    const timeLabel = document.createElement('label');
    timeLabel.className = `vote-option ${cls}` + (dayVote.time === val ? ' selected' : '');
    timeLabel.title = val;

    const timeInput = document.createElement('input');
    timeInput.type  = 'radio';
    timeInput.name  = `time_${iso}`;
    timeInput.value = val;
    timeInput.checked = dayVote.time === val;
    timeInput.style.display = 'none';

    timeLabel.addEventListener('click', (e) => {
      e.preventDefault();
      if (dayVote.time === val) {
        dayVote.time = null;
        timeInput.checked = false;
        card.querySelectorAll('.opt-1145, .opt-1230').forEach(l => l.classList.remove('selected'));
      } else {
        dayVote.time = val;
        timeInput.checked = true;
        card.querySelectorAll('.opt-1145, .opt-1230').forEach(l => l.classList.remove('selected'));
        timeLabel.classList.add('selected');
      }
    });

    timeLabel.appendChild(timeInput);
    timeLabel.appendChild(document.createTextNode(val));
    card.appendChild(timeLabel);
  });

  daysContainer.appendChild(card);
});

weekRow.appendChild(daysContainer);
grid.appendChild(weekRow);

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
  await saveVotesRemote(currentYear, currentMonth, person, clean);
  btn.textContent = '✓ Enregistrer mon planning';
  btn.disabled = false;
  closeVoteModal();
  renderAll();
  window.scrollTo({ top: 0, behavior: 'smooth' });
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
async function confirmAddPerson() {
const name = document.getElementById('newPersonInput').value.trim();
if (!name) { showToast('⚠️ Veuillez saisir un nom'); return; }
const ok = await addPerson(name);
if (!ok) { showToast(`⚠️ "${name}" existe déjà`); return; }
people = await fetchPeople();
savePeopleLocal(people);
closeAddModal();
renderAll();
showToast(`✓ ${name} ajouté(e)`);
}

/* ══════════════════════════════════════════════
MODAL IMPRESSION
══════════════════════════════════════════════ */
function openPrintModal(iso, day, dow) {
  const counts = countDay(iso);
  const dayLabel = `${DAY_SHORT[dow]} ${day} ${MONTH_NAMES[currentMonth]} ${currentYear}`;
  
  // Titre
  document.getElementById('printDayTitle').textContent = dayLabel;
  
  // Listes
  const list1145 = people.filter(p => (votes[p] || {})[iso]?.time === '11:45');
  const list1230 = people.filter(p => (votes[p] || {})[iso]?.time === '12:30');
  const listVeg  = people.filter(p => (votes[p] || {})[iso]?.veg);

  renderPrintList('printListVeg',  listVeg,  counts.veg);
  renderPrintList('printList1145', list1145, counts['11:45']);
  renderPrintList('printList1230', list1230, counts['12:30']);
  
  document.getElementById('printModal').classList.add('is-open');
  document.body.style.overflow = 'hidden';
}

function renderPrintList(containerId, list, count) {
  const el = document.getElementById(containerId);
  if (!list.length) {
    el.innerHTML = '<li class="print-list-empty">Aucun inscrit</li>';
    // Update badge
    el.closest('.print-section').querySelector('.print-count').textContent = '0';
    return;
  }
  el.closest('.print-section').querySelector('.print-count').textContent = count;
  el.innerHTML = list
  .map((name, i) => `<li><span class="print-num">${i + 1}</span><span class="print-name">${escHtml(name)}</span></li>`)
  .join('');
}

function closePrintModal() {
  document.getElementById('printModal').classList.remove('is-open');
  document.body.style.overflow = '';
}

/* ══════════════════════════════════════════════
MENUS
async function renderMenuLink(currentYear, currentMonth) {
 const existing = document.getElementById('btnMenu');
 if (existing) existing.remove();
 menus = await loadMenusRemote(currentYear, currentMonth);
 if (!menus?.url) return;
 const lienMenu = menus.url;
 const btn = document.createElement('button');
 btn.id = 'btnMenu';
 btn.className = 'btn-link';
 btn.title = 'Afficher le menu';
 btn.textContent = 'Afficher le menu';
 btn.onclick = () => window.open(lienMenu, '_blank');
 document.getElementById('headerRight').prepend(btn);
}
══════════════════════════════════════════════ */

/* ══════════════════════════════════════════════
HELPERS
══════════════════════════════════════════════ */
function isPast(iso, todayISO) { return iso < todayISO; }

function countDay(iso) {
const counts = { veg: 0, '11:45': 0, '12:30': 0, total: 0 };
people.forEach(p => {
const dayVote = (votes[p] || {})[iso];
if (!dayVote) return;
if (dayVote.veg)              counts.veg++;
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

function getCookieFavorite() {
  const m = document.cookie.match(/(?:^|;\s*)cantine_favorite=([^;]*)/);
  return m ? decodeURIComponent(m[1]) : null;
}

function setCookieFavorite(name) {
  const expires = new Date();
  expires.setFullYear(expires.getFullYear() + 1);
  document.cookie = `cantine_favorite=${encodeURIComponent(name)};expires=${expires.toUTCString()};path=/`;
}

function removeCookieFavorite() {
  document.cookie = 'cantine_favorite=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/';
}

function renderStarBtn(person) {
  const existing = document.getElementById('starBtn');
  if (existing) existing.remove();
  const btn = document.createElement('button');
  btn.id = 'starBtn';
  btn.className = 'modal-star' + (favoritePerson === person ? ' is-fav' : '');
  btn.title = favoritePerson === person ? 'Retirer des favoris' : 'Mettre en favori';
  btn.textContent = favoritePerson === person ? '★' : '☆';
  btn.addEventListener('click', () => {
    if (favoritePerson === person) {
      removeCookieFavorite();
      favoritePerson = null;
    } else {
      setCookieFavorite(person);
      favoritePerson = person;
    }
    renderStarBtn(person);
    renderAll();
  });
  document.getElementById('nameStar').appendChild(btn);
}
