#!/usr/bin/env node
// Assemble site content from the org's content repos.
// Usage: node scripts/sync-content.mjs [contentRoot]
//   contentRoot defaults to ".." (the sibling clones in ~/Physics).
//   In CI, pass "./_content" (where the workflow checks the repos out).
import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';

const ROOT = path.resolve(process.argv[2] || '..');
const SITE = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const repo = (name) => path.join(ROOT, name);
const log = (...a) => console.log('[sync]', ...a);

function rmrf(p) { fs.rmSync(p, { recursive: true, force: true }); }
function mkdirp(p) { fs.mkdirSync(p, { recursive: true }); }
function read(p) { return fs.readFileSync(p, 'utf8'); }
function write(p, s) { mkdirp(path.dirname(p)); fs.writeFileSync(p, s); }
function exists(p) { return fs.existsSync(p); }
function ls(dir, re) {
  if (!exists(dir)) return [];
  return fs.readdirSync(dir).filter((f) => (re ? re.test(f) : true)).sort();
}

// --- markdown sanitizer: strip Obsidian wikilinks, neutralize non-http links/images ---
function sanitize(md, { dropFirstH1 = true } = {}) {
  let s = md;
  if (dropFirstH1) s = s.replace(/^\s*#\s+.*$/m, '').replace(/^\s+/, '');
  // images first: ![alt](src) — keep http(s), else degrade to text note
  s = s.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (m, alt, src) =>
    /^https?:\/\//.test(src) ? m : (alt ? `*(figure: ${alt})*` : ''));
  // markdown links: keep http(s), else collapse to the link text
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (m, text, url) =>
    /^https?:\/\//.test(url) ? m : text);
  // wikilinks: [[target#anchor|label]] -> label | last-path-segment
  s = s.replace(/\[\[([^\]]+)\]\]/g, (m, inner) => {
    const [target, label] = inner.split('|');
    if (label) return label.trim();
    const noAnchor = target.split('#')[0];
    const seg = noAnchor.split('/').pop().trim();
    return seg || target.trim();
  });
  return s.trimStart();
}

function h1Title(md, fallback) {
  const m = md.match(/^\s*#\s+(.+?)\s*$/m);
  return (m ? m[1] : fallback).replace(/\s+/g, ' ').trim();
}

function frontmatter(obj) {
  return `---\n${yaml.dump(obj, { lineWidth: -1 }).trimEnd()}\n---\n\n`;
}

function emitProblem(srcFile, { book, bookLabel, order, chapter, sourceRepo }) {
  const raw = read(srcFile);
  const title = h1Title(raw, path.basename(srcFile, '.md').replace(/_/g, ' '));
  const body = sanitize(raw);
  const base = path.basename(srcFile, '.md');
  const fm = frontmatter({
    title, book, bookLabel, order,
    ...(chapter ? { chapter } : {}),
    status: 'drafted',
    sourceRepo,
    sourcePath: path.relative(ROOT, srcFile),
  });
  write(path.join(SITE, 'src/content/problems', book, `${base}.md`), fm + body);
}

function num(s) { const m = String(s).match(/\d+/); return m ? parseInt(m[0], 10) : 0; }

// ---------------------------------------------------------------- PROBLEMS
function syncProblems() {
  rmrf(path.join(SITE, 'src/content/problems'));
  let n = 0;
  const isChapter = (f) => /\.md$/.test(f) && !f.startsWith('_') && f !== 'README.md';

  // Jackson (electromagnetic)
  const jdir = path.join(repo('electromagnetic'), 'derivations/Jackson');
  for (const f of ls(jdir, /^Ch\d+.*\.md$/)) {
    emitProblem(path.join(jdir, f), { book: 'jackson', bookLabel: 'Jackson — Classical Electrodynamics', order: num(f), chapter: `Ch. ${num(f)}`, sourceRepo: 'electromagnetic' }); n++;
  }
  // Griffiths (quantum)
  const gdir = path.join(repo('quantum'), 'derivations/Griffiths');
  for (const f of ls(gdir, /^Ch\d+.*\.md$/)) {
    emitProblem(path.join(gdir, f), { book: 'griffiths', bookLabel: 'Griffiths — Introduction to Quantum Mechanics', order: num(f), chapter: `Ch. ${num(f)}`, sourceRepo: 'quantum' }); n++;
  }
  // Bethe-Salpeter (quantum)
  const bdir = path.join(repo('quantum'), 'derivations/Bethe_Salpeter');
  for (const f of ls(bdir, /^\d+_.*\.md$/)) {
    emitProblem(path.join(bdir, f), { book: 'bethe-salpeter', bookLabel: 'Bethe–Salpeter — One- & Two-Electron Atoms', order: num(f), chapter: `§${num(f)}`, sourceRepo: 'quantum' }); n++;
  }
  // GPS (relativistic-dynamics): standard effects, proper-time companion, Mercury
  const rdir = path.join(repo('relativistic-dynamics'), 'derivations');
  for (const f of ls(rdir, /^\d+_.*\.md$/)) {
    emitProblem(path.join(rdir, f), { book: 'gps', bookLabel: 'GPS Relativity & Solar-System Tests', order: num(f), chapter: `Effect ${num(f)}`, sourceRepo: 'relativistic-dynamics' }); n++;
  }
  for (const f of ls(rdir, /^pt_\d+_.*\.md$/)) {
    emitProblem(path.join(rdir, f), { book: 'gps', bookLabel: 'GPS Relativity & Solar-System Tests', order: 100 + num(f), chapter: `Proper-time ${num(f)}`, sourceRepo: 'relativistic-dynamics' }); n++;
  }
  const mdir = path.join(rdir, 'Mercury_Perihelion');
  for (const f of ls(mdir, /^\d+_.*\.md$/)) {
    emitProblem(path.join(mdir, f), { book: 'gps', bookLabel: 'GPS Relativity & Solar-System Tests', order: 200 + num(f), chapter: `Mercury ${num(f)}`, sourceRepo: 'relativistic-dynamics' }); n++;
  }
  log(`problems: ${n} pages`);
}

// ---------------------------------------------------------------- ROADMAP
function syncRoadmap() {
  rmrf(path.join(SITE, 'src/content/roadmap'));
  const sources = [
    { repo: 'commons', rel: 'reference/Research_Roadmap_Dual_Theory.md', slug: 'research-roadmap', title: 'Research Roadmap — Dual Theory of Relativity & QM', order: 1 },
    { repo: 'commons', rel: 'history-meta/PLAN.md', slug: 'history-campaign-plan', title: 'History-of-Physics Campaign Plan (1800–1965)', order: 2 },
  ];
  let n = 0;
  for (const s of sources) {
    const src = path.join(repo(s.repo), s.rel);
    if (!exists(src)) { log(`roadmap: missing ${s.rel}`); continue; }
    const body = sanitize(read(src));
    const fm = frontmatter({ title: s.title, order: s.order, sourceRepo: s.repo, sourcePath: s.rel });
    write(path.join(SITE, 'src/content/roadmap', `${s.slug}.md`), fm + body);
    n++;
  }
  log(`roadmap: ${n} pages`);
}

// ---------------------------------------------------------------- VIDEOS
function prettyScene(key) {
  return key
    .replace(/^maxwell_/, 'Maxwell ').replace(/^drqm_/, 'DRQM ')
    .replace(/^tcep_/, 'TCEP ').replace(/^hist_/, '').replace(/^pnt_/, '')
    .replace(/^synthesis_/, 'Synthesis ')
    .replace(/_/g, ' ')
    .replace(/\beq(\d+)/gi, 'Eq.$1')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}
function videoGroup(key) {
  if (/^(maxwell|drqm|tcep|synthesis)_/.test(key)) return 'Equation derivations';
  if (key.startsWith('hist_')) return 'History of physics';
  if (key.startsWith('pnt_')) return 'Applications — position, navigation, timing';
  return 'Other';
}
function syncVideos() {
  const vroot = path.join(repo('animations'), 'rendered/videos');
  const outDir = path.join(SITE, 'public/videos');
  rmrf(outDir); mkdirp(outDir);
  const items = [];
  for (const key of ls(vroot)) {
    const q = path.join(vroot, key, '480p15');
    if (!exists(q)) continue;
    const mp4 = ls(q, /\.mp4$/)[0];
    if (!mp4) continue;
    fs.copyFileSync(path.join(q, mp4), path.join(outDir, `${key}.mp4`));
    items.push({ key, title: prettyScene(key), group: videoGroup(key), src: `/videos/${key}.mp4` });
  }
  const order = ['Equation derivations', 'History of physics', 'Applications — position, navigation, timing', 'Other'];
  items.sort((a, b) => order.indexOf(a.group) - order.indexOf(b.group) || a.key.localeCompare(b.key));
  write(path.join(SITE, 'src/data/videos.yaml'), yaml.dump(items, { lineWidth: -1 }));
  log(`videos: ${items.length} clips`);
}

// ---------------------------------------------------------------- BRANDING
function syncBranding() {
  const b = repo('branding');
  const out = path.join(SITE, 'public');
  mkdirp(out);
  for (const f of ['logo.svg', 'logo_dark.svg', 'logo_light.svg', 'logo_horizontal_dark.svg', 'logo_horizontal_light.svg', 'logo_256.png', 'logo_64.png', 'logo_32.png', 'social_preview_1280x640.png']) {
    if (exists(path.join(b, f))) fs.copyFileSync(path.join(b, f), path.join(out, f));
  }
  if (exists(path.join(b, 'logo_32.png'))) fs.copyFileSync(path.join(b, 'logo_32.png'), path.join(out, 'favicon.png'));
  write(path.join(out, '.nojekyll'), '');
  log('branding: logos + favicon copied');
}

// ---------------------------------------------------------------- PODCASTS
function syncPodcasts() {
  const p = repo('podcasts');
  const manifest = path.join(p, 'episodes.yaml');
  let episodes = [];
  if (exists(manifest)) {
    episodes = yaml.load(read(manifest)) || [];
  } else {
    // fall back to per-episode frontmatter
    for (const f of ls(p, /^episode_\d+.*\.md$/)) {
      const raw = read(path.join(p, f));
      const fm = raw.match(/^---\n([\s\S]*?)\n---/);
      const meta = fm ? (yaml.load(fm[1]) || {}) : {};
      episodes.push({
        episode: meta.episode || num(f),
        title: meta.title || f,
        era: meta.era || '',
        speakers: meta.speakers || [],
        runtime_min: meta.target_runtime_min || null,
        audio_url: meta.audio_url || null,
        script_url: `https://github.com/Proper-Time-Physics-Institute/podcasts/blob/main/${f}`,
      });
    }
  }
  episodes.sort((a, b) => num(a.episode) - num(b.episode));
  write(path.join(SITE, 'src/data/podcasts.yaml'), yaml.dump(episodes, { lineWidth: -1 }));
  log(`podcasts: ${episodes.length} episodes`);
}

// ---------------------------------------------------------------- run
log(`content root: ${ROOT}`);
syncProblems();
syncRoadmap();
syncVideos();
syncBranding();
syncPodcasts();
log('done');
