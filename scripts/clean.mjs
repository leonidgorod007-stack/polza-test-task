const CP1251_HIGH = [
  0x0402,0x0403,0x201A,0x0453,0x201E,0x2026,0x2020,0x2021,0x20AC,0x2030,0x0409,0x2039,0x040A,0x040C,0x040B,0x040F,
  0x0452,0x2018,0x2019,0x201C,0x201D,0x2022,0x2013,0x2014,0xFFFD,0x2122,0x0459,0x203A,0x045A,0x045C,0x045B,0x045F,
  0x00A0,0x040E,0x045E,0x0408,0x00A4,0x0490,0x00A6,0x00A7,0x0401,0x00A9,0x0404,0x00AB,0x00AC,0x00AD,0x00AE,0x0407,
  0x00B0,0x00B1,0x0406,0x0456,0x0491,0x00B5,0x00B6,0x00B7,0x0451,0x2116,0x0454,0x00BB,0x0458,0x0405,0x0455,0x0457,
];

const REVERSE = new Map();
for (let b = 0; b <= 0x7F; b++) REVERSE.set(String.fromCharCode(b), b);
for (let i = 0; i < 64; i++) REVERSE.set(String.fromCharCode(CP1251_HIGH[i]), 0x80 + i);
for (let b = 0xC0; b <= 0xFF; b++) REVERSE.set(String.fromCharCode(0x0410 + (b - 0xC0)), b);

export function repairMojibake(s) {
  if (!s) return null;
  const bytes = [];
  for (const ch of s) {
    const b = REVERSE.get(ch);
    if (b === undefined) return null;
    bytes.push(b);
  }
  const out = Buffer.from(bytes).toString('utf8');
  if (out.includes('�')) return null;
  return out;
}

const CLEAN_RE = /^[А-яЁёA-Za-z0-9 «»№()."'\/,.\-–]+$/;
export function looksClean(s) { return !!s && CLEAN_RE.test(s); }

export function maybeRepair(s) {
  if (looksClean(s)) return s;
  const r = repairMojibake(s);
  return (r && looksClean(r)) ? r : s;
}

export function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const d = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      d[i][j] = Math.min(d[i-1][j] + 1, d[i][j-1] + 1, d[i-1][j-1] + (a[i-1] === b[j-1] ? 0 : 1));
  return d[m][n];
}

export function makeCanonicalizer(canonicalValues, aliases = {}) {
  const canon = [...canonicalValues];
  const byLower = new Map(canon.map(c => [c.toLowerCase(), c]));
  const aliasLower = new Map(Object.entries(aliases).map(([k, v]) => [k.toLowerCase(), v]));

  return function canonicalize(raw) {
    if (raw == null) return null;
    const candidates = [raw.trim()];
    const rep = repairMojibake(raw.trim());
    if (rep && rep !== raw.trim()) candidates.push(rep.trim());

    for (const c of candidates) {
      if (c === '') continue;
      if (byLower.has(c.toLowerCase())) return byLower.get(c.toLowerCase());
      if (aliasLower.has(c.toLowerCase())) return aliasLower.get(c.toLowerCase());
    }
    for (const c of candidates) {
      if (c === '') continue;
      let best = null, bestD = Infinity;
      for (const cv of canon) {
        const dist = levenshtein(c.toLowerCase(), cv.toLowerCase());
        if (dist < bestD) { bestD = dist; best = cv; }
      }
      if (best && bestD <= 2) return best;
    }
    return null;
  };
}
