/**

- data.js — Couche de données
- 
- ┌─────────────────────────────────────────────────────────────────┐
- │  STOCKAGE                                                       │
- │  GitHub Pages = hébergement statique, pas de backend.           │
- │  Les votes sont stockés dans localStorage (par navigateur).     │
- │                                                                 │
- │  Pour un partage réel entre collègues, deux options :           │
- │  A) JSONBin.io  — définissez JSONBIN_ID et JSONBIN_KEY ci-bas   │
- │  B) Firebase    — adaptez les fonctions load/save               │
- └─────────────────────────────────────────────────────────────────┘
  */

/* ══════════════════════════════════════════════
CONFIGURATION FIREBASE REALTIME DATABASE
Renseignez l'URL de votre base Firebase.
Laissez vide pour utiliser localStorage.
══════════════════════════════════════════════ */
const FIREBASE_URL = 'https://acrina44sondage-default-rtdb.europe-west1.firebasedatabase.app';

/* ══════════════════════════════════════════════
LISTE PAR DÉFAUT DES PARTICIPANTS
Modifiez cette liste selon votre équipe.
Elle sera stockée dans localStorage et
enrichie par l'ajout de nouveaux noms.
══════════════════════════════════════════════ */
const DEFAULT_PEOPLE = [
'Alice Martin',
'Bob Dupont',
'Claire Bernard',
'David Lefèvre',
'Emma Rousseau',
'François Petit',
'Géraldine Simon',
'Hugo Laurent',
];

/* ══════════════════════════════════════════════
CLÉS LOCALSTORAGE
══════════════════════════════════════════════ */
const KEY_PEOPLE = 'cantine_people';
const voteKey    = (y, m) => `cantine_votes_${y}_${String(m+1).padStart(2,'0')}`;

/* ══════════════════════════════════════════════
API PEOPLE
══════════════════════════════════════════════ */
function getPeople() {
const stored = localStorage.getItem(KEY_PEOPLE);
if (stored) return JSON.parse(stored);
savePeople(DEFAULT_PEOPLE);
return [...DEFAULT_PEOPLE];
}

function savePeople(list) {
localStorage.setItem(KEY_PEOPLE, JSON.stringify(list));
}

function addPerson(name) {
const list = getPeople();
if (list.includes(name)) return false;
list.push(name);
savePeople(list);
return true;
}

/* ══════════════════════════════════════════════
API VOTES
Structure :
votes[personName][dateISO] = 'veg' | '11:45' | '12:30' | null
══════════════════════════════════════════════ */

async function loadVotes(year, month) {
if (FIREBASE_URL) return await loadVotesRemote(year, month);
return loadVotesLocal(year, month);
}

async function saveVotes(year, month, votes) {
if (FIREBASE_URL) return await saveVotesRemote(year, month, votes);
saveVotesLocal(year, month, votes);
}

/* ── LOCAL ── */
function loadVotesLocal(year, month) {
const raw = localStorage.getItem(voteKey(year, month));
return raw ? JSON.parse(raw) : {};
}

function saveVotesLocal(year, month, votes) {
localStorage.setItem(voteKey(year, month), JSON.stringify(votes));
}

/* ── REMOTE (Firebase Realtime Database) ── */
// Structure : /votes/cantine_votes_YYYY_MM/<person>/<date> = { time, veg }

async function loadVotesRemote(year, month) {
try {
const url = `${FIREBASE_URL}/votes/${voteKey(year, month)}.json`;
const r   = await fetch(url);
if (!r.ok) throw new Error('Firebase read failed: ' + r.status);
const data = await r.json();
return data || {};
} catch(e) {
console.warn('Firebase load failed', e);
return {};
}
}

async function saveVotesRemote(year, month, votes) {
try {
const url = `${FIREBASE_URL}/votes/${voteKey(year, month)}.json`;
await fetch(url, {
method: 'PUT',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify(votes)
});
} catch(e) {
console.warn('Firebase save failed', e);
}
}

/* ══════════════════════════════════════════════
HELPERS DATE
══════════════════════════════════════════════ */
function dateISO(year, month, day) {
return `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
}

function getWorkingDays(year, month) {
const days = [];
const total = new Date(year, month+1, 0).getDate();
for (let d = 1; d <= total; d++) {
const dow = new Date(year, month, d).getDay();
if (dow !== 0 && dow !== 6) days.push(d);
}
return days;
}

function getInitials(name) {
return name.trim().split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0,3);
}

function getAvatarColor(name) {
const colors = [
'#007AFF','#34C759','#FF9500','#FF3B30',
'#AF52DE','#FF2D55','#5856D6','#00C7BE',
'#30D158','#FFD60A',
];
let h = 0;
for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffffffff;
return colors[Math.abs(h) % colors.length];
}

const MONTH_NAMES = [
'Janvier','Février','Mars','Avril','Mai','Juin',
'Juillet','Août','Septembre','Octobre','Novembre','Décembre'
];
const DAY_SHORT = ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam'];
const DAY_NAMES = ['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'];
