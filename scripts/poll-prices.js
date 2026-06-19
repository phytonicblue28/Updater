// Pollt die Tankerkönig-API und schreibt Preisänderungen in dieselbe
// Firebase Realtime Database, die auch Tankstelle.html nutzt.
// Läuft unabhängig von jedem geöffneten Browser - per GitHub Actions Cron.

const STATIONS = [
  '00060066-ad70-4444-8888-acdc00000001', // Geroldshausen (eigene Station)
  '00060609-4fc3-4444-8888-acdc00000001', // Autohaus Hutter
  '00060022-0001-4444-8888-acdc00000001', // Dollinger
  '7ada7581-0f56-4a39-b24b-6b7435354bd9', // HEM
  'f744c237-120b-588e-92de-37d814523a79', // Hoyer
  '0081e69e-b530-4146-aa5d-761e3c493478', // Agip ENI
];

const TK_API_KEY = process.env.TANKERKOENIG_API_KEY;
const DB_URL = process.env.FIREBASE_DATABASE_URL; // z.B. https://xxx-default-rtdb.europe-west1.firebasedatabase.app (ohne Slash am Ende)

if (!TK_API_KEY || !DB_URL) {
  console.error('FEHLER: TANKERKOENIG_API_KEY oder FIREBASE_DATABASE_URL fehlt (als GitHub-Secret setzen).');
  process.exit(1);
}

async function main() {
  const ids = STATIONS.join(',');
  const res = await fetch(
    'https://creativecommons.tankerkoenig.de/json/prices.php?ids=' + ids + '&apikey=' + TK_API_KEY
  );
  if (!res.ok) throw new Error('HTTP ' + res.status + ' von der Tankerkönig-API');
  const data = await res.json();
  if (data.ok === false) throw new Error('Tankerkönig-Fehler: ' + (data.message || 'unbekannt'));

  const ts = Date.now();
  let changed = 0;

  for (const id of STATIONS) {
    const p = data.prices[id];
    if (!p) continue;
    const cur = { e5: p.e5 || null, e10: p.e10 || null, diesel: p.diesel || null, lpg: p.lpg || null };

    const histRes = await fetch(DB_URL + '/history/' + id + '.json');
    let hist = (await histRes.json()) || [];
    if (!Array.isArray(hist)) hist = [];
    const last = hist[hist.length - 1];

    if (!last || JSON.stringify(last.prices) !== JSON.stringify(cur)) {
      hist.push({ ts: ts, prices: cur });
      if (hist.length > 200) hist = hist.slice(-200);
      await fetch(DB_URL + '/history/' + id + '.json', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(hist),
      });
      changed++;
      console.log(id + ': Änderung gespeichert');
    }
  }

  console.log('Fertig - ' + changed + ' Änderung(en) gespeichert um ' + new Date(ts).toISOString());
}

main().catch(function (e) {
  console.error('Fehler:', e.message);
  process.exit(1);
});
