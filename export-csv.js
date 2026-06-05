/**
 * export-csv.js — Génère un CSV mensuel des votes cantine et l'envoie par e-mail.
 *
 * Variables d'environnement requises (GitHub Secrets) :
 *   FIREBASE_URL   — ex. https://acrina44sondage-default-rtdb.europe-west1.firebasedatabase.app
 *   FIREBASE_SECRET — Database Secret Firebase (legacy auth)
 *   RESEND_API_KEY  — Clé API Resend
 *   MAIL_FROM       — Expéditeur,  ex. cantine@mondomaine.fr
 *   MAIL_TO         — Destinataire(s), ex. equipe@mondomaine.fr (virgule pour plusieurs)
 */

const FIREBASE_URL    = process.env.FIREBASE_URL;
const FIREBASE_SECRET = process.env.FIREBASE_SECRET;
const RESEND_API_KEY  = process.env.RESEND_API_KEY;
const MAIL_FROM       = process.env.MAIL_FROM;
const MAIL_TO         = process.env.MAIL_TO;

// ── Mois cible : le mois en cours au moment de l'exécution ──────────────────
const now   = new Date();
const YEAR  = now.getFullYear();
const MONTH = now.getMonth(); // 0-indexed

const MONTH_NAMES_FR = [
  'Janvier','Février','Mars','Avril','Mai','Juin',
  'Juillet','Août','Septembre','Octobre','Novembre','Décembre',
];

// ── Helpers ─────────────────────────────────────────────────────────────────

function pad(n) { return String(n).padStart(2, '0'); }

function voteKey(y, m) {
  return `cantine_votes_${y}_${pad(m + 1)}`;
}

function dateISO(y, m, d) {
  return `${y}-${pad(m + 1)}-${pad(d)}`;
}

/** Retourne la liste des jours ouvrés (lun–ven) du mois, sans jours fériés. */
function getWorkingDays(year, month) {
  const days  = [];
  const total = new Date(year, month + 1, 0).getDate();
  const holidays = getFrenchHolidays(year);
  for (let d = 1; d <= total; d++) {
    const dow = new Date(year, month, d).getDay();
    const iso = dateISO(year, month, d);
    if (dow !== 0 && dow !== 6 && !holidays.has(iso)) days.push(d);
  }
  return days;
}

/** Algorithme de Meeus/Jones/Butcher pour Pâques. */
function easterDate(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31); // 1-indexed
  const day   = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function isoOf(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function getFrenchHolidays(year) {
  const easter = easterDate(year);
  const set = new Set([
    `${year}-01-01`, // Jour de l'an
    `${year}-05-01`, // Fête du travail
    `${year}-05-08`, // Victoire 1945
    `${year}-07-14`, // Fête nationale
    `${year}-08-15`, // Assomption
    `${year}-11-01`, // Toussaint
    `${year}-11-11`, // Armistice
    `${year}-12-25`, // Noël
    isoOf(addDays(easter,  1)),  // Lundi de Pâques
    isoOf(addDays(easter, 39)),  // Ascension
    isoOf(addDays(easter, 50)),  // Lundi de Pentecôte
  ]);
  return set;
}

/** Regroupe les jours ouvrés par semaine ISO (lun–ven). */
function groupByWeek(year, month, workingDays) {
  const weeks = [];
  let   week  = [];
  workingDays.forEach(d => {
    const dow = new Date(year, month, d).getDay(); // 1=lun … 5=ven
    if (dow === 1 && week.length > 0) { weeks.push(week); week = []; }
    week.push(d);
  });
  if (week.length) weeks.push(week);
  return weeks;
}

// ── Fetch Firebase ───────────────────────────────────────────────────────────

async function fetchVotes(year, month) {
  const key = voteKey(year, month);
  const url = `${FIREBASE_URL}/votes/${key}.json?auth=${FIREBASE_SECRET}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Firebase error: ${res.status} ${res.statusText}`);
  const data = await res.json();
  return data || {};
}

// ── Calcul des compteurs pour un jour ────────────────────────────────────────

function countDay(votes, iso) {
  let veg = 0, trad = 0;
  for (const personVotes of Object.values(votes)) {
    const dayVote = personVotes?.[iso];
    if (!dayVote || !dayVote.time) continue; // pas de vote horaire = absent
    if (dayVote.veg) veg++;
    else             trad++;
  }
  const total = veg + trad;
  const pct   = total > 0 ? ((veg / total) * 100).toFixed(1) : '';
  return { veg, trad, total, pct };
}

// ── Construction du CSV ──────────────────────────────────────────────────────

function buildCSV(year, month, votes) {
  const workingDays = getWorkingDays(year, month);
  const weeks       = groupByWeek(year, month, workingDays);
  const monthName   = MONTH_NAMES_FR[month];

  // En-tête
  const header = 'Jour;Plats végétariens;Plats traditionnels;Total participants;% végétarien';
  const lines  = [header];

  // Cumuls mensuels
  let sumVeg = 0, sumTrad = 0, sumTotal = 0;
  let daysWithVotes = 0;

  weeks.forEach((weekDays, wi) => {
    // Ligne vide entre semaines (sauf la première)
    if (wi > 0) lines.push('');

    weekDays.forEach(d => {
      const iso    = dateISO(year, month, d);
      const counts = countDay(votes, iso);

      // Format JJ/MM/AA
      const label = `${pad(d)}/${pad(month + 1)}/${String(year).slice(2)}`;

      lines.push(
        `${label};${counts.veg};${counts.trad};${counts.total};${counts.pct}`,
      );

      sumVeg   += counts.veg;
      sumTrad  += counts.trad;
      sumTotal += counts.total;
      if (counts.total > 0) daysWithVotes++;
    });
  });

  // Ligne vide avant le total
  lines.push('');

  // Ligne de totaux mensuels
  const sumPct = sumTotal > 0 ? ((sumVeg / sumTotal) * 100).toFixed(1) : '';
  lines.push(`${monthName};${sumVeg};${sumTrad};${sumTotal};${sumPct}`);

  // Moyenne de convives par jour (colonne 3 uniquement = index 3 = "Total participants")
  const avg = daysWithVotes > 0 ? (sumTotal / daysWithVotes).toFixed(1) : '0';
  lines.push(`;;Moy./jour : ${avg};;`);

  return lines.join('\n');
}

// ── Envoi e-mail via Resend ──────────────────────────────────────────────────

async function sendMail(subject, csvContent, filename) {
  const recipients = MAIL_TO.split(',').map(s => s.trim());

  // Encode en base64 pour la pièce jointe
  const base64 = Buffer.from('\uFEFF' + csvContent, 'utf8').toString('base64');

  const body = {
    from: MAIL_FROM,
    to:   recipients,
    subject,
    text: `Bonjour,\n\nVeuillez trouver ci-joint le récapitulatif cantine pour ${MONTH_NAMES_FR[MONTH]} ${YEAR}.\n\nCordialement\n\nP.S. Ce message est généré automatiquement.`,
    attachments: [
      { filename, content: base64 },
    ],
  };

  const res = await fetch('https://api.resend.com/emails', {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Resend error: ${res.status} — ${err}`);
  }
  console.log('✅ E-mail envoyé avec succès.');
}

// ── Point d'entrée ───────────────────────────────────────────────────────────

async function main() {
  console.log(`📊 Export cantine — ${MONTH_NAMES_FR[MONTH]} ${YEAR}`);

  const votes    = await fetchVotes(YEAR, MONTH);
  const csv      = buildCSV(YEAR, MONTH, votes);
  const filename = `cantine_${YEAR}_${pad(MONTH + 1)}.csv`;

  console.log('\n--- Aperçu CSV ---');
  console.log(csv);
  console.log('------------------\n');

  await sendMail(
    `🍽️ Cantine — Récapitulatif ${MONTH_NAMES_FR[MONTH]} ${YEAR}`,
    csv,
    filename,
  );
}

main().catch(err => { console.error('❌', err); process.exit(1); });
