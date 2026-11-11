// GhostWalk Studio · Social : avatars vivants.
// Chaque avatar = 4 images alignées (idle, blink, talk, blinktalk) superposées ; on dose leur opacité à chaque image :
// bouche = piste d'ouverture calculée sur le son (ou sur les lettres du texte), dessinée par une mâchoire qui descend
// (la lèvre du bas ne s'efface jamais), paupières = clignements naturels,
// tête = respiration + petits gestes suivis de pauses + suivi de la souris, expressions = petites scènes.
// Même méthode que l'AI Studio (audio_meter.py, avatar_render.py, avatar_rig.py, avatar_pointer.py), adaptée aux 4 images à plat.
//
// Avatar Prof : copie de GhostWalk Social (assets/avatar.js). Seuls changements : les adresses viennent de
// window.GWAvatarConfig (fichiers de l'app au lieu du serveur Social), et la voix lit des fichiers audio préparés d'avance.
//   base      : dossier des avatars (ex. 'avatars/')
//   eyesUrl   : fichier des yeux   (ex. 'data/yeux.json')
//   mouthsUrl : fichier des bouches (ex. 'data/bouches.json')
//   audioUrl(text, voice) : adresse du fichier audio de cette phrase, ou null s'il n'existe pas
//   onMissing(text) : appelé quand une phrase n'a pas de fichier audio (ex. voix du navigateur en secours)
(function () {
    'use strict';
    const CFG = window.GWAvatarConfig || {};
    const BASE = CFG.base || '/social/avatars/';
    const views = new Set();
    const rnd = (a, b) => a + Math.random() * (b - a);
    const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
    const smooth = (v) => { v = clamp(v, 0, 1); return v * v * (3 - 2 * v); };
    const REDUCED = (() => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } })();

    // Expressions : durée (s), et ce qu'elles font à la tête, aux yeux, à la bouche, au filtre et aux particules.
    const EXPR = {
        wave:  { label: 'Salut', icon: '👋', dur: 1.8, fx: ['👋'], f: (t) => ({ rot: 7 * Math.sin(t * 14) * (1 - t), y: -1.5 * Math.sin(Math.PI * t) }) },
        laugh: { label: 'Rire', icon: '😂', dur: 2.0, fx: ['😂', '🤣'], f: (t) => ({ blink: t < 0.92 ? 1 : 0, mouth: 0.35 + 0.65 * Math.abs(Math.sin(t * 31)), y: -2.2 * Math.abs(Math.sin(t * 31)), rot: 2 * Math.sin(t * 9) }) },
        wow:   { label: 'Wow', icon: '😮', dur: 1.5, fx: ['❗', '✨'], f: (t) => ({ mouth: t < 0.85 ? 0.9 : 0, blink: 0, scale: 1 + 0.07 * Math.sin(Math.PI * Math.min(1, t * 1.6)), y: -1.2 * Math.sin(Math.PI * t) }) },
        wink:  { label: 'Clin d\'œil', icon: '😉', dur: 1.1, fx: ['✨'], f: (t) => ({ wink: t > 0.15 && t < 0.55 ? 1 : 0, rot: -4 * Math.sin(Math.PI * t) }) },
        love:  { label: 'Amour', icon: '😍', dur: 2.4, fx: ['❤️', '💖', '💕'], many: true, glow: 'rgba(255,90,160,.75)', f: (t) => ({ scale: 1 + 0.03 * Math.sin(t * 18), rot: 3 * Math.sin(t * 5) }) },
        yes:   { label: 'Oui', icon: '👍', dur: 1.3, fx: ['👍'], f: (t) => ({ y: 3.2 * Math.sin(t * 6 * Math.PI) * (1 - t), rx: 1 }) },
        no:    { label: 'Non', icon: '👎', dur: 1.3, fx: ['👎'], f: (t) => ({ x: 3.2 * Math.sin(t * 8 * Math.PI) * (1 - t), rot: 1.5 * Math.sin(t * 8 * Math.PI) * (1 - t) }) },
        sad:   { label: 'Triste', icon: '😢', dur: 2.6, fx: ['💧'], filter: 'saturate(.55) brightness(.88)', f: (t) => ({ y: 2.4 * Math.sin(Math.PI * t), rot: -3 * Math.sin(Math.PI * t), blink: t > 0.3 && t < 0.42 ? 1 : 0 }) },
        angry: { label: 'Fâché', icon: '😠', dur: 1.7, fx: ['💢'], glow: 'rgba(255,60,40,.85)', f: (t) => ({ x: 1.4 * Math.sin(t * 70) * (1 - t), mouth: t < 0.6 ? 0.35 * Math.abs(Math.sin(t * 20)) : 0 }) },
        sleep: { label: 'Dodo', icon: '😴', dur: 3.4, fx: ['💤'], filter: 'brightness(.86)', f: (t) => ({ blink: t > 0.06 && t < 0.94 ? 1 : 0, y: 1.6 * Math.sin(Math.PI * t), rot: 5 * Math.sin(Math.PI * t), scale: 1 + 0.015 * Math.sin(t * 9) }) },
        think: { label: 'Hmm…', icon: '🤔', dur: 2.2, fx: ['💭'], f: (t) => ({ rot: 6 * Math.sin(Math.PI * t), y: -0.8 * Math.sin(Math.PI * t) }) },
        party: { label: 'Fête', icon: '🎉', dur: 2.2, fx: ['🎉', '🎊', '⭐'], many: true, f: (t) => ({ y: -2.6 * Math.abs(Math.sin(t * 22)), rot: 4 * Math.sin(t * 11), mouth: 0.4 * Math.abs(Math.sin(t * 22)) }) },
    };

    // ───────── Bouche : lèvres comme un muscle (avatar_render.spring_mouth)
    const MOUTH_SPRING = 34;   // environ 0,1 s pour s'ouvrir ou se fermer complètement
    const MOUTH_LEAD = 0.05;   // les lèvres d'un vrai visage bougent un peu avant le son
    function springMouth(value, speed, target, dt) {
        dt = clamp(dt, 0, 0.1);
        const error = value - target;
        const decay = Math.exp(-MOUTH_SPRING * dt);
        const drift = (speed + MOUTH_SPRING * error) * dt;
        value = target + (error + drift) * decay;
        speed = (speed - MOUTH_SPRING * drift) * decay;
        if (value <= 0 || value >= 1) { value = clamp(value, 0, 1); speed = 0; }
        if (target < 0.02 && value < 0.03) return [0, 0];   // silence : la bouche finit de se fermer
        return [value, speed];
    }

    // ───────── Tête : une petite inclinaison, puis une longue pause (avatar_rig._idle_sway) ; jamais un balancement continu
    function idleSway(now, phase) {
        const clock = now + phase * 2.7;
        const cycle = Math.floor(clock / 18);
        const variation = 0.5 + 0.5 * Math.sin(cycle * 1.73 + phase * 0.93);
        const start = 1.4 + 2 * variation;
        const duration = 4.8 + 0.8 * (0.5 + 0.5 * Math.sin(cycle * 2.11 + phase * 1.31));
        const p = (clock - cycle * 18 - start) / duration;
        if (!(p > 0 && p < 1)) return 0;
        const dir = Math.sin(cycle * 2.37 + phase * 1.7 + 0.6) >= 0 ? 1 : -1;
        return dir * (0.8 + 0.3 * variation) * Math.pow(Math.sin(Math.PI * p), 4);
    }
    // Bref coup d'œil de côté, puis retour en face ; neutre plus de 90 % du temps (avatar_gaze.glance). Ici : la tête tourne un peu.
    function glance(now, phase) {
        const clock = now + phase * 1.9;
        const cycle = Math.floor(clock / 13);
        const variation = 0.5 + 0.5 * Math.sin(cycle * 1.83 + phase * 1.37);
        const start = 2 + 3 * variation;
        const duration = 0.95 + 0.2 * (0.5 + 0.5 * Math.sin(cycle * 2.31 + phase * 0.73));
        const p = (clock - cycle * 13 - start) / duration;
        if (!(p > 0 && p < 1)) return [0, 0];
        const amount = smooth(p / 0.24) * (1 - smooth((p - 0.54) / 0.46));
        const dir = Math.sin(cycle * 2.47 + phase + 0.7) >= 0 ? 1 : -1;
        return [dir * (0.35 + 0.25 * variation) * amount, 0.1 * Math.sin(cycle * 1.41 + phase * 0.8) * amount];
    }

    // ───────── Suivi de la souris (avatar_pointer) : ressort amorti sans rebond, vitesse et accélération bornées
    function follow(pos, vel, target, elapsed, freq, speed, accel) {
        const steps = Math.max(1, Math.ceil(elapsed * 120));
        const dt = elapsed / steps;
        let [px, py] = pos;
        let [vx, vy] = vel;
        for (let i = 0; i < steps; i++) {
            const ax = freq * freq * (target[0] - px) - 2 * freq * vx;
            const ay = freq * freq * (target[1] - py) - 2 * freq * vy;
            let r = Math.min(1, accel / Math.max(1e-9, Math.hypot(ax, ay)));
            vx += ax * r * dt; vy += ay * r * dt;
            r = Math.min(1, speed / Math.max(1e-9, Math.hypot(vx, vy)));
            vx *= r; vy *= r;
            let nx = px + vx * dt, ny = py + vy * dt;
            if ((target[0] - nx) * (target[0] - px) <= 0) { nx = target[0]; vx = 0; }
            if ((target[1] - ny) * (target[1] - py) <= 0) { ny = target[1]; vy = 0; }
            px = nx; py = ny;
        }
        return [[px, py], [vx, vy]];
    }
    const pointer = { x: 0, y: 0, on: false, t: 0 };
    const POINTER_REST = 9;    // s sans bouger la souris : les avatars cessent de la regarder
    if (!REDUCED) {
        window.addEventListener('pointermove', (e) => { pointer.x = e.clientX; pointer.y = e.clientY; pointer.on = true; pointer.t = performance.now() / 1000; }, { passive: true });
        window.addEventListener('pointerup', (e) => { if (e.pointerType === 'touch') pointer.on = false; }, { passive: true });
        document.addEventListener('mouseout', (e) => { if (!e.relatedTarget) pointer.on = false; }, { passive: true });
        window.addEventListener('blur', () => { pointer.on = false; });
    }
    // Yeux et bouche de chaque avatar (fiches du studio, server/avatars-categories.json) : chargés une fois, puis donnés aux vues déjà là
    let EYES = null;
    let MOUTHS = null;
    let facesP = null;
    const getJson = (u) => fetch(u).then((r) => (r.ok ? r.json() : {})).then((j) => (j && typeof j === 'object' ? j : {})).catch(() => ({}));
    function loadEyes() {
        if (facesP) return facesP;
        facesP = Promise.all([
            getJson(CFG.eyesUrl || '/social/api/avatars/yeux').then((j) => { EYES = j; for (const v of views) v.applyEyes(); }),
            getJson(CFG.mouthsUrl || '/social/api/avatars/bouches').then((j) => { MOUTHS = j; }),
        ]);
        return facesP;
    }

    // ───────── Bouche par mâchoire (avatar_expressions.mouth_poses + jaw_drop du studio)
    // Un fondu entre la bouche fermée et la bouche ouverte effaçait la lèvre du bas pendant le geste (« comme si la lèvre
    // inférieure disparaissait »). Ici on part de la photo ouverte et on remonte sa mâchoire du bas (lèvre, menton) :
    // l'intérieur de la bouche se tasse entre les lèvres, les lèvres restent toujours là.
    // Si la mâchoire n'est pas nette, la bouche ouverte descend depuis la ligne de la bouche (reveal_order) :
    // chaque pixel montre l'une ou l'autre image, jamais les deux à moitié.
    const REVEAL_SOFT = 0.3;      // part du geste pendant laquelle un pixel passe de la bouche fermée à l'ouverte
    const REVEAL_SIDE = 0.25;     // les coins s'ouvrent un peu après le centre : d'abord en largeur
    const JAW_FROM_CLOSED = 0.25; // la bouche fermée cède la place à la photo ouverte tassée pendant ce début du geste
    const JAW_ROOM = 2.5;         // sous la bouche, de la place pour tasser le menton
    const JAW_ALIKE = 0.95;       // la photo ouverte refermée doit ressembler davantage à la bouche fermée
    const JAW_CORNER = 0.45;      // bouts arrondis de l'ouverture, sur cette part de la demi-largeur
    const JAW_MAX = 200;          // côté le plus long de la zone de travail (px) : les grandes gueules sont calculées plus petit
    const rigs = new Map();       // id → Promise(mâchoire ou null), partagé par toutes les vues du même avatar

    // Sorte de bouche (voir tools/convertir-categories-avatars.js) : 0 mâchoire depuis la bouche fermée, 4 photo ouverte refermée,
    // 1 image entière, 2 treillis à trous (fondu), 3 immobile. Sans fiche : 0, la bouche est cherchée dans l'image.
    const mouthKind = (id) => { const b = MOUTHS && MOUTHS[id]; return b ? b[4] : 0; };

    function getRig(id) {
        if (!rigs.has(id)) {
            if (rigs.size > 40) rigs.delete(rigs.keys().next().value);
            rigs.set(id, loadEyes().then(() => buildRig(id)).catch(() => null));
        }
        return rigs.get(id);
    }
    function pixels(img, S) {
        const cv = document.createElement('canvas');
        cv.width = cv.height = S;
        const g = cv.getContext('2d', { willReadFrequently: true });
        g.imageSmoothingQuality = 'high';
        g.drawImage(img, 0, 0, S, S);
        return g.getImageData(0, 0, S, S).data;
    }
    // Sans fiche : la bouche est là où les images fermée et ouverte diffèrent (moitié basse du visage)
    function guessMouth(ia, ib) {
        const N = 128, a = pixels(ia, N), b = pixels(ib, N), xs = [], ys = [];
        for (let y = Math.round(N * 0.4); y < N * 0.92; y++) for (let x = Math.round(N * 0.15); x < N * 0.85; x++) {
            const p = (y * N + x) * 4;
            if (a[p + 3] > 200 && Math.max(Math.abs(a[p] - b[p]), Math.abs(a[p + 1] - b[p + 1]), Math.abs(a[p + 2] - b[p + 2])) > 28) { xs.push(x); ys.push(y); }
        }
        if (xs.length < 15) return null;
        xs.sort((u, v) => u - v); ys.sort((u, v) => u - v);
        const l = pct(xs, 5) / N, r = pct(xs, 95) / N, t = pct(ys, 5) / N, bo = pct(ys, 95) / N;
        const w = clamp((r - l) * 1.15, 0.12, 0.5), cy = t + (bo - t) * 0.35;
        const chin = Math.min(0.86, cy + 0.11);
        return { cx: (l + r) / 2, cy, w, h: w * 0.6, chin, collar: Math.min(0.97, chin + 0.18) };
    }
    async function buildRig(id) {
        // onload plutôt que decode() : decode() attend sans fin dans un onglet caché
        const load = (n) => new Promise((ok, ko) => { const i = new Image(); i.onload = () => ok(i); i.onerror = ko; i.src = BASE + id + '/' + n + '.webp'; });
        const [ia, ib] = await Promise.all([load('idle'), load('talk')]);
        const b = MOUTHS && MOUTHS[id];
        const geo = b ? { cx: b[0], cy: b[1], w: b[2], h: b[3], chin: b[5], collar: b[6] } : guessMouth(ia, ib);
        if (!geo || ![geo.cx, geo.cy, geo.w, geo.h].every(Number.isFinite)) return null;
        if (!Number.isFinite(geo.chin)) geo.chin = Math.min(0.86, geo.cy + 0.11);            // menton absent : sous la bouche
        if (!Number.isFinite(geo.collar) || geo.collar <= geo.chin) geo.collar = Math.min(0.97, geo.chin + 0.18);
        if (!b || b[4] === 0) {
            let jaw = null;
            try { jaw = buildJaw(id, ia, ib, geo); } catch { jaw = null; }
            if (jaw) return jaw;
        }
        return buildPoses(id, ia, ib, geo);
    }
    // zone de la photo ouverte refermée [gauche, haut, droite, bas] en fractions ; jamais sur les yeux (les paupières passent dessous)
    function posesBox(id, geo) {
        const box = [geo.cx - geo.w / 2, geo.cy - geo.h * 0.4, geo.cx + geo.w / 2, geo.cy + geo.h * 0.6];
        const e = EYES && EYES[id];
        if (e) box[1] = Math.max(box[1], Math.max(e[1], e[3]) + e[5] * 0.45);
        for (let i = 0; i < 4; i++) box[i] = clamp(box[i], 0, 1);
        return box[2] - box[0] > 0.03 && box[3] - box[1] > 0.03 ? box : null;
    }
    function buildPoses(id, ia, ib, geo) {
        const box = posesBox(id, geo);
        if (!box) return null;
        const S0 = ia.naturalWidth || 512;
        const S = Math.max(64, Math.round(S0 * Math.min(1, JAW_MAX / (Math.max(box[2] - box[0], box[3] - box[1]) * S0))));
        const L = Math.round(box[0] * S), T = Math.round(box[1] * S), R = Math.round(box[2] * S), B = Math.round(box[3] * S);
        const W = R - L, H = B - T;
        if (!(W >= 8 && H >= 8)) return null;
        const cv = document.createElement('canvas');
        cv.width = cv.height = S;
        const g = cv.getContext('2d', { willReadFrequently: true });
        g.drawImage(ia, 0, 0, S, S);
        const start = g.getImageData(L, T, W, H).data;
        g.clearRect(0, 0, S, S);
        g.drawImage(ib, 0, 0, S, S);
        const end = g.getImageData(L, T, W, H).data;
        // masque : ellipse à fondu compact (_expression_mask)
        const weight = new Float32Array(W * H);
        const ex = (L + R) / 2, ey = (T + B) / 2, rx = Math.max(1, (R - L) / 2), ry = Math.max(1, (B - T) / 2);
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
            const d = Math.hypot((L + x - ex) / rx, (T + y - ey) / ry);
            weight[y * W + x] = Math.round((1 - smooth((d - 0.62) / 0.38)) * 255) / 255;
        }
        const rig = { type: 'poses', id, S, L, T, W, H, start, end, weight };
        rig.jaw = jawDrop(rig);
        if (!rig.jaw) rig.order = revealOrder(rig);
        return rig;
    }

    // flou gaussien (σ = 3 px) d'un tableau W×H, bords recopiés
    function blur3(src, W, H) {
        const R = 9, k = [];
        let sum = 0;
        for (let i = -R; i <= R; i++) { const v = Math.exp(-(i * i) / 18); k.push(v); sum += v; }
        for (let i = 0; i < k.length; i++) k[i] /= sum;
        const tmp = new Float32Array(W * H), out = new Float32Array(W * H);
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
            let s = 0;
            for (let i = -R; i <= R; i++) s += src[y * W + clamp(x + i, 0, W - 1)] * k[i + R];
            tmp[y * W + x] = s;
        }
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
            let s = 0;
            for (let i = -R; i <= R; i++) s += tmp[clamp(y + i, 0, H - 1) * W + x] * k[i + R];
            out[y * W + x] = s;
        }
        return out;
    }
    const pct = (sorted, p) => { const i = (sorted.length - 1) * p / 100, a = Math.floor(i); return sorted[a] + (sorted[Math.min(a + 1, sorted.length - 1)] - sorted[a]) * (i - a); };
    // ce qui change d'une bouche à l'autre : masque, bornes (3e et 97e centiles)
    function changes(rig) {
        const { W, H, start, end, weight } = rig;
        const diff = new Float32Array(W * H);
        for (let i = 0, p = 0; i < W * H; i++, p += 4) {
            diff[i] = Math.max(Math.abs(start[p] - end[p]), Math.abs(start[p + 1] - end[p + 1]), Math.abs(start[p + 2] - end[p + 2])) * weight[i];
        }
        const bl = blur3(diff, W, H);
        const changed = new Uint8Array(W * H);
        const rows = [], cols = [];
        for (let i = 0; i < W * H; i++) if (bl[i] > 12) { changed[i] = 1; rows.push((i / W) | 0); cols.push(i % W); }
        if (rows.length < 10) return { changed, n: rows.length };
        rows.sort((a, b) => a - b); cols.sort((a, b) => a - b);
        return { changed, n: rows.length, top: pct(rows, 3), bottom: pct(rows, 97), left: pct(cols, 3), right: pct(cols, 97) };
    }
    function revealOrder(rig) {
        const { W, H } = rig;
        const c = changes(rig);
        const order = new Float32Array(W * H);
        if (c.n < 10) return order;
        const cx = (c.left + c.right) / 2, hw = Math.max((c.right - c.left) / 2, 1), dh = Math.max(c.bottom - c.top, 1);
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
            const down = clamp((y - c.top) / dh, 0, 1), side = clamp(Math.abs(x - cx) / hw, 0, 1);
            order[y * W + x] = down * (1 - REVEAL_SIDE) + side * side * REVEAL_SIDE;
        }
        return order;
    }
    // mâchoire : ligne de la bouche (par colonne), hauteur de l'ouverture et champ du mouvement ; null si rien de net
    function jawDrop(rig) {
        const { W, H, start, end, weight } = rig;
        const c = changes(rig);
        if (c.n < 40) return null;
        const { changed, top, bottom, left, right } = c;
        const cx = (left + right) / 2, hw = Math.max((right - left) / 2, 4);
        // ligne de la bouche : premier pixel qui change dans chaque colonne, lissée en parabole
        const fx = [], fy = [];
        for (let x = 0; x < W; x++) {
            if (x < left || x > right) continue;
            for (let y = 0; y < H; y++) if (changed[y * W + x]) { fx.push(x); fy.push(y); break; }
        }
        if (fx.length < 8 || bottom - top < 4) return null;
        const mx = fx.reduce((a, b) => a + b) / fx.length, sx = Math.max(1, (Math.max(...fx) - Math.min(...fx)) / 2);
        let s0 = 0, s1 = 0, s2 = 0, s3 = 0, s4 = 0, t0 = 0, t1 = 0, t2 = 0;
        for (let i = 0; i < fx.length; i++) {
            const u = (fx[i] - mx) / sx, u2 = u * u;
            s0++; s1 += u; s2 += u2; s3 += u2 * u; s4 += u2 * u2; t0 += fy[i]; t1 += fy[i] * u; t2 += fy[i] * u2;
        }
        const det = (a) => a[0] * (a[4] * a[8] - a[5] * a[7]) - a[1] * (a[3] * a[8] - a[5] * a[6]) + a[2] * (a[3] * a[7] - a[4] * a[6]);
        const M = [s0, s1, s2, s1, s2, s3, s2, s3, s4], D = det(M);
        if (!D) return null;
        const co = [0, 1, 2].map((j) => { const m = M.slice(); m[j] = t0; m[3 + j] = t1; m[6 + j] = t2; return det(m) / D; });
        const line = new Float32Array(W);
        for (let x = 0; x < W; x++) { const u = (x - mx) / sx; line[x] = clamp(co[0] + co[1] * u + co[2] * u * u, top, bottom); }
        // forme du mouvement : lentille entre les coins, qui s'élargit vers le menton sous la lèvre
        const shape = new Float32Array(W * H);
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
            const i = y * W + x, under = y - line[x];
            if (under <= 0) continue;
            const side = clamp((Math.abs(x - cx) / hw - (1 - JAW_CORNER)) / JAW_CORNER, 0, 1);
            const lens = Math.pow(1 - side * side, 0.8);
            const chin = smooth(1 - Math.abs(x - cx) / (hw * 1.6));
            const mix = smooth(under / Math.max(hw * 0.6, 2));
            shape[i] = (lens * (1 - mix) + chin * mix) * weight[i];
        }
        const mid = [];
        for (let x = Math.floor(cx - hw * 0.3); x <= Math.floor(cx + hw * 0.3); x++) if (x >= 0 && x < W) mid.push(line[x]);
        mid.sort((a, b) => a - b);
        const center = mid.length ? (mid.length % 2 ? mid[mid.length >> 1] : (mid[mid.length / 2 - 1] + mid[mid.length / 2]) / 2) : top;
        const judged = [];
        let before = 0;
        for (let i = 0; i < W * H; i++) if (changed[i] && weight[i] > 0.5) {
            judged.push(i);
            const p = i * 4;
            before += (Math.abs(start[p] - end[p]) + Math.abs(start[p + 1] - end[p + 1]) + Math.abs(start[p + 2] - end[p + 2])) / 3;
        }
        if (!judged.length) return null;
        before /= judged.length;
        // hauteur de l'ouverture : celle qui, refermée, ressemble le plus à la bouche fermée
        const fieldAt = (i, y, opening, reach, room) => Math.min(shape[i] * (1 - smooth((y - reach) / room)), Math.max(H - 1 - y, 0) / opening);
        const top4 = Math.max(4, Math.min(bottom - center, (H - center) / JAW_ROOM));
        let best = null;
        for (let k = 0; k < 24; k++) {
            const opening = 3 + (top4 - 3) * k / 23, reach = center + opening, room = Math.max(H - reach, 2);
            let err = 0;
            for (const i of judged) {
                const y = (i / W) | 0, x = i % W;
                const f = fieldAt(i, y, opening, reach, room);
                let sy = y;
                if (f > 0) { const under = y - line[x]; sy = under < 0.02 * opening * f ? line[x] + under / 0.02 : y + opening * f; }
                const q = sample(end, W, H, x, sy), p = i * 4;
                err += (Math.abs(start[p] - q[0]) + Math.abs(start[p + 1] - q[1]) + Math.abs(start[p + 2] - q[2])) / 3;
            }
            err /= judged.length;
            if (!best || err < best.err) best = { err, opening };
        }
        if (!(best.err < before * JAW_ALIKE && best.opening >= 6)) return null;
        const opening = best.opening, reach = center + opening, room = Math.max(H - reach, 2);
        const field = new Float32Array(W * H);
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = y * W + x; field[i] = shape[i] > 0 ? fieldAt(i, y, opening, reach, room) : 0; }
        return { line, opening, field };
    }
    const SAMPLE = [0, 0, 0, 0];
    // pixel de l'image à (x, y) avec y fractionnaire (interpolation verticale, bords recopiés)
    function sample(px, W, H, x, y) {
        y = clamp(y, 0, H - 1);
        const a = Math.floor(y), b = Math.min(a + 1, H - 1), t = y - a;
        const p = (a * W + x) * 4, q = (b * W + x) * 4;
        SAMPLE[0] = px[p] + (px[q] - px[p]) * t;
        SAMPLE[1] = px[p + 1] + (px[q + 1] - px[p + 1]) * t;
        SAMPLE[2] = px[p + 2] + (px[q + 2] - px[p + 2]) * t;
        SAMPLE[3] = px[p + 3] + (px[q + 3] - px[p + 3]) * t;
        return SAMPLE;
    }
    const sat = (r, g, b) => { const mx = Math.max(r, g, b); return mx > 0 ? (mx - Math.min(r, g, b)) / mx * 255 : 0; };
    const drawMouth = (rig, m, out) => (rig.type === 'jaw' ? drawJaw(rig, m, out) : drawPoses(rig, m, out));
    // la bouche à l'ouverture m (0..1), dans out (RGBA de la zone) ; l'alpha porte le masque et la silhouette du repos
    function drawPoses(rig, m, out) {
        const { W, H, start, end, weight, jaw, order } = rig;
        const f = Math.max(m, 0.02);
        const shown = smooth(m / JAW_FROM_CLOSED);
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
            const i = y * W + x, p = i * 4;
            let r, g, b, a, mix;
            if (m >= 1) { r = end[p]; g = end[p + 1]; b = end[p + 2]; a = end[p + 3]; mix = 1; }
            else if (jaw) {
                const fl = jaw.field[i];
                let sy = y;
                if (fl > 0) { const under = y - jaw.line[x]; sy = under < f * jaw.opening * fl ? jaw.line[x] + under / f : y + (1 - m) * jaw.opening * fl; }
                const q = sample(end, W, H, x, sy);
                r = q[0]; g = q[1]; b = q[2]; a = q[3]; mix = shown;
            } else {
                const v = clamp((m * (1 + REVEAL_SOFT) - order[i]) / REVEAL_SOFT, 0, 1);
                mix = v * v * (3 - 2 * v);
                r = end[p]; g = end[p + 1]; b = end[p + 2]; a = end[p + 3];
            }
            if (mix < 1) {
                // fondu, puis chaque pixel garde au moins la couleur attendue (keep_lip_color : un fondu délave les lèvres)
                const s0 = sat(start[p], start[p + 1], start[p + 2]), s1 = sat(r, g, b);
                r = start[p] + (r - start[p]) * mix; g = start[p + 1] + (g - start[p + 1]) * mix; b = start[p + 2] + (b - start[p + 2]) * mix;
                a = start[p + 3] + (a - start[p + 3]) * mix;
                const want = Math.max(s0 * (1 - mix) + s1 * mix, Math.min(s0, s1)), have = sat(r, g, b);
                if (have > 0 && have < want - 1) {
                    const V = Math.max(r, g, b), k = Math.min(1, want / 255) / (have / 255);
                    r = V - (V - r) * k; g = V - (V - g) * k; b = V - (V - b) * k;
                }
            }
            const cover = weight[i] * (a >= 250 ? 1 : a / 255);   // un bord transparent de l'expression ne révèle rien
            out[p] = r; out[p + 1] = g; out[p + 2] = b;
            out[p + 3] = cover * start[p + 3];
        }
    }

    // ───────── Mâchoire depuis la bouche FERMÉE (ai_studio/avatar_jaw.py, essai B de Kaliss du 2026-10-30)
    // La ligne entre les lèvres est le chemin le plus sombre d'un coin à l'autre ; la lèvre du bas et le menton descendent,
    // la lèvre du haut monte un peu, et l'ouverture montre l'intérieur de la photo OUVERTE (dents, langue, ombre).
    // Les lèvres de la photo fermée restent donc toujours entières. Mesures sur une copie à 480 px.
    const ANALYSIS = 480;
    const OPEN_GAIN = 1.15, MIN_OPEN = 0.25, LIFT = 0.35, TEETH_STRETCH = 1.4, CORNER_DEPTH = 0.45, MIN_CONTRAST = 8, MIN_MATCH = 0.55;
    const CORNER_ROUND = 0.45, OPEN_DIFFERENCE = 30, OPEN_SHADOW = 95, CORNER_SHADE = 0.55, TAIL_MARGIN = 0.12, INSIDE_DIM = 110, TAIL_FADE = 2.5;
    const SMALL_KERNELS = { 1: [1], 3: [0.25, 0.5, 0.25], 5: [0.0625, 0.25, 0.375, 0.25, 0.0625], 7: [0.03125, 0.109375, 0.21875, 0.28125, 0.21875, 0.109375, 0.03125] };
    const kernel = (sigma, size) => {                     // même noyau qu'OpenCV (getGaussianKernel)
        if (!size) size = (Math.round(sigma * 8 + 1) | 1);
        if (sigma <= 0 && SMALL_KERNELS[size]) return SMALL_KERNELS[size];
        if (sigma <= 0) sigma = 0.3 * ((size - 1) * 0.5 - 1) + 0.8;
        const k = [], r = size >> 1;
        let s = 0;
        for (let i = -r; i <= r; i++) { const v = Math.exp(-(i * i) / (2 * sigma * sigma)); k.push(v); s += v; }
        return k.map((v) => v / s);
    };
    const refl = (i, n) => (n === 1 ? 0 : i < 0 ? Math.min(-i, n - 1) : i >= n ? Math.max(2 * n - 2 - i, 0) : i);
    function gauss(src, W, H, kx, ky) {                   // flou séparable, bords en miroir (BORDER_REFLECT_101)
        const tmp = new Float32Array(W * H), out = new Float32Array(W * H), rx = kx.length >> 1, ry = ky.length >> 1;
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
            let s = 0;
            for (let i = -rx; i <= rx; i++) s += src[y * W + refl(x + i, W)] * kx[i + rx];
            tmp[y * W + x] = s;
        }
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
            let s = 0;
            for (let i = -ry; i <= ry; i++) s += tmp[refl(y + i, H) * W + x] * ky[i + ry];
            out[y * W + x] = s;
        }
        return out;
    }
    const grayOf = (px, p) => Math.round(0.299 * px[p] + 0.587 * px[p + 1] + 0.114 * px[p + 2]);
    const median = (a) => { if (!a.length) return NaN; const s = Float64Array.from(a).sort(); const h = s.length >> 1; return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2; };
    const interp = (x, xs, ys) => (x <= xs[0] ? ys[0] : x >= xs[xs.length - 1] ? ys[ys.length - 1] : (() => { const i = Math.floor(x - xs[0]); const t = x - xs[0] - i; return ys[i] + (ys[Math.min(i + 1, ys.length - 1)] - ys[i]) * t; })());
    // moindres carrés d'un polynôme de degré n (x ramené à -1..1, comme numpy Polynomial.fit)
    function polyfit(xs, ys, n) {
        const lo = Math.min(...xs), hi = Math.max(...xs), mid = (lo + hi) / 2, half = Math.max((hi - lo) / 2, 1e-9);
        const A = Array.from({ length: n + 1 }, () => new Float64Array(n + 2));
        for (let k = 0; k < xs.length; k++) {
            const u = (xs[k] - mid) / half, pw = [1];
            for (let i = 1; i <= 2 * n; i++) pw.push(pw[i - 1] * u);
            for (let i = 0; i <= n; i++) { for (let j = 0; j <= n; j++) A[i][j] += pw[i + j]; A[i][n + 1] += ys[k] * pw[i]; }
        }
        for (let c = 0; c <= n; c++) {
            let piv = c;
            for (let r = c + 1; r <= n; r++) if (Math.abs(A[r][c]) > Math.abs(A[piv][c])) piv = r;
            [A[c], A[piv]] = [A[piv], A[c]];
            if (Math.abs(A[c][c]) < 1e-12) return null;
            for (let r = 0; r <= n; r++) if (r !== c) { const f = A[r][c] / A[c][c]; for (let j = c; j <= n + 1; j++) A[r][j] -= f * A[c][j]; }
        }
        const co = A.map((row, i) => row[n + 1] / row[i]);
        return (x) => { const u = (x - mid) / half; let s = 0, p = 1; for (const c of co) { s += c * p; p *= u; } return s; };
    }
    // ligne entre les lèvres fermées (lip_line) : lignes par colonne de la boîte, coins, contraste, ligne brute et bouts sombres
    function lipLine(gray, box) {
        const N = ANALYSIS, [left, top, right, bottom] = box;
        const height = bottom - top, center = top + height * 0.4;
        const bt = Math.trunc(Math.max(0, center - height * 0.28)), bb = Math.trunc(Math.min(N, center + height * 0.28));
        const R = bb - bt, W = right - left;
        if (R < 5 || W < 10) return null;
        const g = new Float32Array(R * W);
        for (let y = 0; y < R; y++) for (let x = 0; x < W; x++) g[y * W + x] = gray[(bt + y) * N + left + x];
        const region = gauss(g, W, R, kernel(0, 5), kernel(0, 3)).map(Math.round);
        // chemin le plus sombre, d'une colonne à l'autre d'un pixel au plus ; le centre de la bande est un peu favorisé
        const at = (y, x) => region[y * W + x];
        const prior = Array.from({ length: R }, (_, r) => ((r - (center - bt)) / (R / 2)) ** 2 * 6);
        let total = Float64Array.from({ length: R }, (_, r) => at(r, 0) + prior[r]);
        const back = new Int8Array(R * W);
        for (let x = 1; x < W; x++) {
            const next = new Float64Array(R);
            for (let r = 0; r < R; r++) {
                const up = r > 0 ? total[r - 1] + 2 : Infinity, same = total[r], down = r < R - 1 ? total[r + 1] + 2 : Infinity;
                let c = 0, v = up;
                if (same < v) { c = 1; v = same; }
                if (down < v) { c = 2; v = down; }
                next[r] = v + at(r, x) + prior[r];
                back[r * W + x] = c - 1;
            }
            total = next;
        }
        const rows = new Int32Array(W);
        let best = 0;
        for (let r = 1; r < R; r++) if (total[r] < total[best]) best = r;
        rows[W - 1] = best;
        for (let x = W - 1; x > 0; x--) rows[x - 1] = rows[x] + back[rows[x] * W + x];
        // contraste : la ligne est plus sombre que les lèvres juste au-dessus et juste au-dessous
        const depth = new Float32Array(W);
        for (let x = 0; x < W; x++) depth[x] = Math.min(at(clamp(rows[x] - 4, 0, R - 1), x), at(clamp(rows[x] + 4, 0, R - 1), x)) - at(rows[x], x);
        const sd = new Float32Array(W);
        for (let x = 0; x < W; x++) { let s = 0; for (let i = -2; i <= 2; i++) if (x + i >= 0 && x + i < W) s += depth[x + i]; sd[x] = s / 5; }
        const contrast = median(Array.from(depth.slice(Math.floor(W / 3), Math.floor(W * 2 / 3))));
        const threshold = Math.max(5, contrast * CORNER_DEPTH);
        const corners = [];
        for (const dir of [-1, 1]) {
            let x = W >> 1, misses = 0;
            while (x > 0 && x < W - 1 && misses <= 3) { x += dir; misses = sd[x] > threshold ? 0 : misses + 1; }
            corners.push(x - dir * misses);
        }
        const tail = Float32Array.from(rows, (r) => r + bt);
        const line = Float32Array.from(rows, (r) => r + bt);
        if (corners[1] - corners[0] + 1 >= 8) {
            const sx = [], sy = [];
            for (let x = corners[0]; x <= corners[1]; x++) { sx.push(x); sy.push(line[x]); }
            const fit = polyfit(sx, sy, 4);
            if (fit) for (let x = corners[0]; x <= corners[1]; x++) line[x] = fit(x);
        }
        for (let x = 0; x < corners[0]; x++) line[x] = line[corners[0]];
        for (let x = corners[1]; x < W; x++) line[x] = line[corners[1]];
        return { line, corners: [corners[0] + left, corners[1] + left], contrast, tail, dark: [corners[0] + left, corners[1] + left] };
    }
    // décalage vertical (px) qui fait le mieux correspondre la bande fermée à l'ouverte (_shift), et sa ressemblance
    function bestShift(a, b, rows, cols, limit, upward) {
        let best = -1, shift = 0;
        for (let d = 0; d < Math.min(limit, rows - 6); d++) {
            const n = (rows - d) * cols;
            let sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0;
            for (let y = 0; y < rows - d; y++) for (let x = 0; x < cols; x++) {
                const u = upward ? a[(y + d) * cols + x] : a[y * cols + x], v = upward ? b[y * cols + x] : b[(y + d) * cols + x];
                sx += u; sy += v; sxx += u * u; syy += v * v; sxy += u * v;
            }
            const vx = sxx / n - (sx / n) ** 2, vy = syy / n - (sy / n) ** 2;
            if (vx < 1e-6 || vy < 1e-6) continue;
            const score = (sxy / n - (sx / n) * (sy / n)) / Math.sqrt(vx * vy);
            if (score > best) { best = score; shift = d; }
        }
        return [shift, best];
    }
    function measure(cg, og, box) {
        const N = ANALYSIS;
        const f = lipLine(cg, box);
        if (!f) return null;
        const [left, top, right, bottom] = box, [cl, cr] = f.corners;
        if (!(f.contrast >= MIN_CONTRAST) || cr - cl < (right - left) * 0.3) return null;
        const cx = (cl + cr) / 2, hw = Math.max(4, (cr - cl) / 2);
        const xs = Float32Array.from({ length: right - left }, (_, i) => left + i);
        const center = interp(cx, xs, f.line);
        const block = (g, y0, y1, x0, x1) => { const o = new Float32Array(Math.max(0, y1 - y0) * (x1 - x0)); for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) o[(y - y0) * (x1 - x0) + x - x0] = g[y * N + x]; return o; };
        const c0 = Math.trunc(cx - hw * 0.4), c1 = Math.trunc(cx + hw * 0.4), cols = c1 - c0;
        const b0 = Math.trunc(center) + 4, b1 = Math.min(N, bottom + (bottom - top));
        if (cols < 2 || b1 - b0 < 7) return null;
        const [drop, match] = bestShift(block(cg, b0, b1, c0, c1), block(og, b0, b1, c0, c1), b1 - b0, cols, 45, false);
        if (match < MIN_MATCH) return null;
        const a0 = Math.max(0, Math.trunc(center - hw * 0.5)), a1 = Math.trunc(center) - 2;
        const [lift, lm] = a1 - a0 > 6 ? bestShift(block(cg, a0, a1, c0, c1), block(og, a0, a1, c0, c1), a1 - a0, cols, 20, true) : [0, -1];
        return { line: f.line, x: xs, cx, hw, center, drop: Math.max(drop, 2), lift: lm > 0.5 ? lift : 0, tail: f.tail, dark: f.dark };
    }
    const hsv = (r, g, b) => { const v = Math.max(r, g, b); return [v ? (v - Math.min(r, g, b)) / v * 255 : 0, v]; };
    function buildJaw(id, ia, ib, geo) {
        const N = ANALYSIS;
        const box = [geo.cx - geo.w / 2, geo.cy - geo.h * 0.4, geo.cx + geo.w / 2, geo.cy + geo.h * 0.6].map((v) => Math.round(clamp(v, 0, 1) * N));
        const ca = pixels(ia, N), oa = pixels(ib, N);
        const cg = new Float32Array(N * N), og = new Float32Array(N * N);
        for (let i = 0; i < N * N; i++) { cg[i] = grayOf(ca, i * 4); og[i] = grayOf(oa, i * 4); }
        const found = measure(cg, og, box);
        if (!found) return null;
        // à la taille d'affichage
        const S = ia.naturalWidth || 512, scale = S / N;
        const closedF = pixels(ia, S), opened = pixels(ib, S);
        const cx = found.cx * scale, hw = found.hw * scale, center = found.center * scale;
        let measured = found.drop * scale, drop = Math.max(measured, hw * MIN_OPEN);
        const chin = geo.chin * S, collar = geo.collar * S;
        const stillFrom = Math.min(chin + S * 0.08, collar);
        const x0 = Math.trunc(Math.max(0, cx - hw * 2.4)), x1 = Math.trunc(Math.min(S, cx + hw * 2.4));
        const y0 = Math.trunc(Math.max(0, center - hw * 0.5)), y1 = Math.trunc(Math.min(S, collar, Math.max(stillFrom, center + hw * 1.5) + 2));
        const W = x1 - x0, H = y1 - y0;
        if (!(W >= 8 && H >= 8)) return null;
        const n = W * H;
        const line = new Float32Array(W), lens = new Float32Array(W), tailRow = new Float32Array(W);
        for (let i = 0; i < W; i++) {
            const X = x0 + i;
            line[i] = interp(X / scale, found.x, found.line) * scale;
            tailRow[i] = interp(X / scale, found.x, found.tail) * scale;
            const side = clamp((Math.abs(X - cx) / hw - (1 - CORNER_ROUND)) / CORNER_ROUND, 0, 1);
            lens[i] = Math.pow(1 - side * side, 0.8);                    // bout arrondi « ) », sans paroi verticale au coin
        }
        const fadeTop = Math.min(chin, stillFrom - 2), fadeLen = Math.max(2, stillFrom - fadeTop);
        const down = new Float32Array(n), up = new Float32Array(n);
        const closed = new Uint8ClampedArray(n * 4), shadow = new Uint8Array(n), teeth = new Uint8Array(n), win = new Uint8Array(n), openV = new Float32Array(n);
        for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
            const X = x0 + i, Y = y0 + j, k = j * W + i, p = (Y * S + X) * 4;
            const jaw = smooth(1 - Math.abs(X - cx) / (hw * 2.2)), below = Y - line[i];
            const mix = smooth(below / (hw * 0.9));                       // sous la lèvre du bas, la lentille s'élargit vers le menton
            const fade = 1 - smooth((Y - fadeTop) / fadeLen);
            if (below > 0) down[k] = (lens[i] * (1 - mix) + jaw * mix) * fade;
            else up[k] = lens[i] * (1 - smooth(-below / (hw * 0.4)));
            closed[k * 4] = closedF[p]; closed[k * 4 + 1] = closedF[p + 1]; closed[k * 4 + 2] = closedF[p + 2]; closed[k * 4 + 3] = closedF[p + 3];
            // intérieur de la photo ouverte : ombre (bien plus sombre que la bouche fermée) ou dents (claires, peu colorées)
            const [os, ov] = hsv(opened[p], opened[p + 1], opened[p + 2]), cv = Math.max(closedF[p], closedF[p + 1], closedF[p + 2]);
            openV[k] = ov;
            shadow[k] = ov < Math.min(OPEN_SHADOW, cv - OPEN_DIFFERENCE) ? 1 : 0;
            teeth[k] = os < 70 && ov > 150 && ov > cv + 15 ? 1 : 0;
            win[k] = Y > line[i] - hw * 0.5 && Y < line[i] + Math.max(measured, hw * 0.5) * 1.6 ? 1 : 0;
        }
        // ouverture morphologique 3×3 de (ombre ou dents) dans la fenêtre
        const raw = new Uint8Array(n);
        for (let k = 0; k < n; k++) raw[k] = (shadow[k] || teeth[k]) && win[k] ? 1 : 0;
        const morph = (src, erode) => {
            const o = new Uint8Array(n);
            for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
                let v = erode ? 1 : 0;
                for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
                    const jj = j + dj, ii = i + di;
                    if (jj < 0 || jj >= H || ii < 0 || ii >= W) continue;
                    if (erode && !src[jj * W + ii]) v = 0;
                    if (!erode && src[jj * W + ii]) v = 1;
                }
                o[j * W + i] = v;
            }
            return o;
        };
        const interior = morph(morph(raw, true), false);
        // lèvre du haut de la photo ouverte : mesurée au centre
        let lift = found.lift * scale;
        const lifts = [];
        for (let i = 0; i < W; i++) {
            if (Math.abs(x0 + i - cx) >= hw * 0.5) continue;
            let cnt = 0, first = -1;
            for (let j = 0; j < H; j++) if (interior[j * W + i]) { cnt++; if (first < 0) first = j; }
            if (cnt >= 3) lifts.push(line[i] - (first + y0));
        }
        if (lifts.length >= 5) lift = Math.max(0, median(lifts));
        // Ajout du site : un menton qui ne bouge pas (cartoons, enfants) donnait une descente trop courte et une bouche
        // à peine ouverte. La photo ouverte dit aussi jusqu'où va son intérieur sous la ligne : on garde la plus grande.
        const seen = [];
        for (let i = 0; i < W; i++) {
            if (Math.abs(x0 + i - cx) >= hw * 0.5) continue;
            let cnt = 0, last = -1;
            for (let j = 0; j < H; j++) if (interior[j * W + i]) { cnt++; last = j; }
            if (cnt >= 3) seen.push(last + y0 - line[i]);
        }
        if (seen.length >= 5) { const s = median(seen); if (s > measured) { measured = s; drop = Math.max(measured, hw * MIN_OPEN); } }
        const innerTop = new Float32Array(W), innerBottom = new Float32Array(W), innerMid = new Float32Array(W);
        for (let i = 0; i < W; i++) {
            innerTop[i] = line[i] - lift * lens[i];
            innerBottom[i] = line[i] + Math.max(2, measured - 1) * lens[i];
            innerMid[i] = (innerTop[i] + innerBottom[i]) / 2;
        }
        // couleur de l'ombre de la bouche et de la langue
        const inside = [], lipPx = [];
        for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
            const Y = y0 + j, p = (Y * S + x0 + i) * 4;
            if (Y > innerTop[i] + 1 && Y < innerBottom[i] - 1 && lens[i] > 0.4) inside.push([opened[p], opened[p + 1], opened[p + 2]]);
            if (Y > line[i] + 2 && Y < line[i] + hw * 0.35 && lens[i] > 0.5) lipPx.push([closedF[p], closedF[p + 1], closedF[p + 2]]);
        }
        let cavity = [60, 25, 25];
        if (inside.length > 20) {
            const br = inside.map((q) => q[0] + q[1] + q[2]).sort((a, b) => a - b), lim = pct(br, 30);
            const dark = inside.filter((q) => q[0] + q[1] + q[2] <= lim);
            cavity = [0, 1, 2].map((c) => median(dark.map((q) => q[c])) * 0.85);
        }
        const lipColor = lipPx.length > 20 ? [0, 1, 2].map((c) => median(lipPx.map((q) => q[c]))) : cavity.map((v) => v * 2);
        const tongue = cavity.map((v, c) => v * 0.45 + lipColor[c] * 0.45);
        // colonnes où la photo ouverte l'est vraiment ; vers les coins, elle montre encore la lèvre : on y met l'ombre
        const ev = new Float32Array(W);
        for (let i = 0; i < W; i++) {
            let hit = 0, all = 0;
            for (let j = 0; j < H; j++) {
                const Y = y0 + j;
                if (Y > innerTop[i] && Y < Math.max(innerBottom[i], innerTop[i] + 3)) { all++; if (shadow[j * W + i] || teeth[j * W + i]) hit++; }
            }
            ev[i] = hit / Math.max(all, 1);
        }
        const openedCols = new Float32Array(W);
        for (let i = 0; i < W; i++) { let s = 0; for (let d = -2; d <= 2; d++) if (i + d >= 0 && i + d < W) s += ev[i + d]; openedCols[i] = smooth(s / 5 / 0.35); }
        // entre la première et la dernière ombre (ou dent) de chaque colonne, c'est bien l'intérieur (langue comprise)
        const realB = new Float32Array(n);
        for (let i = 0; i < W; i++) {
            let firstJ = -1, lastJ = -1;
            for (let j = 0; j < H; j++) if (raw[j * W + i]) { if (firstJ < 0) firstJ = j; lastJ = j; }
            for (let j = 0; j < H; j++) {
                const k = j * W + i;
                realB[k] = (firstJ >= 0 && j >= firstJ && j <= lastJ) || openV[k] < INSIDE_DIM ? 1 : 0;
            }
        }
        const sr = Math.max(1, hw * 0.03), kr = kernel(sr);
        const real = gauss(realB, W, H, kr, kr);
        for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
            const middle = smooth((1 - Math.abs(x0 + i - cx) / hw - 0.6) / 0.15);   // le milieu (langue, dents) reste toujours la photo
            const k = j * W + i;
            real[k] = Math.max(real[k], middle);
        }
        // bouts de la ligne sombre fermée au-delà des coins : effacés quand la bouche s'ouvre (_tail)
        const tail = new Float32Array(n);
        let erased = null;
        {
            const darkL = found.dark[0] * scale, darkR = found.dark[1] * scale, reach = TAIL_MARGIN * hw, thick = Math.max(1.5, 2.2 * scale);
            let any = false;
            for (let i = 0; i < W; i++) {
                const X = x0 + i, outside = Math.max(cx - hw - X, X - cx - hw);
                const limit = X < cx ? cx - hw - (darkL - reach) : darkR + reach - (cx + hw);
                if (!(outside > -hw * 0.08 && outside < limit)) continue;
                for (let j = 0; j < H; j++) { const v = clamp(1 - Math.abs(y0 + j - tailRow[i]) / thick, 0, 1); if (v > 0) { tail[j * W + i] = v; any = true; } }
            }
            if (any) {
                const kt = kernel(Math.max(0.8, scale)), tb = gauss(tail, W, H, kt, kt);
                for (let k = 0; k < n; k++) tail[k] = clamp(tb[k] * 2, 0, 1);
                // peau reconstruite sous la ligne : on remplit le trou depuis ses bords (comme cv2.inpaint)
                const hole = new Uint8Array(n);
                for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
                    let h = 0;
                    for (let dj = -1; dj <= 1 && !h; dj++) for (let di = -1; di <= 1; di++) {
                        const jj = j + dj, ii = i + di;
                        if (jj >= 0 && jj < H && ii >= 0 && ii < W && tail[jj * W + ii] > 0.05) { h = 1; break; }
                    }
                    hole[j * W + i] = h;
                }
                erased = new Float32Array(n * 3);
                for (let k = 0; k < n; k++) { erased[k * 3] = closed[k * 4]; erased[k * 3 + 1] = closed[k * 4 + 1]; erased[k * 3 + 2] = closed[k * 4 + 2]; }
                let left = hole.reduce((a, b) => a + b, 0), guard = 0;
                while (left > 0 && guard++ < 60) {
                    const fill = [];
                    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
                        const k = j * W + i;
                        if (!hole[k]) continue;
                        let r = 0, g = 0, b = 0, w = 0;
                        for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
                            const jj = j + dj, ii = i + di;
                            if (jj < 0 || jj >= H || ii < 0 || ii >= W) continue;
                            const q = jj * W + ii;
                            if (hole[q]) continue;
                            const ww = di && dj ? 0.7 : 1;
                            r += erased[q * 3] * ww; g += erased[q * 3 + 1] * ww; b += erased[q * 3 + 2] * ww; w += ww;
                        }
                        if (w) fill.push([k, r / w, g / w, b / w]);
                    }
                    if (!fill.length) break;
                    for (const [k, r, g, b] of fill) { erased[k * 3] = r; erased[k * 3 + 1] = g; erased[k * 3 + 2] = b; hole[k] = 0; left--; }
                }
            }
        }
        const still = new Uint8Array(n);
        for (let k = 0; k < n; k++) still[k] = down[k] === 0 && up[k] === 0 && tail[k] === 0 ? 1 : 0;
        // la photo ouverte, seulement les colonnes de la zone (toute la hauteur : l'intérieur peut venir d'un peu plus haut ou plus bas)
        const openCols = new Uint8ClampedArray(W * S * 4);
        for (let Y = 0; Y < S; Y++) for (let i = 0; i < W; i++) { const p = (Y * S + x0 + i) * 4, q = (Y * W + i) * 4; openCols[q] = opened[p]; openCols[q + 1] = opened[p + 1]; openCols[q + 2] = opened[p + 2]; openCols[q + 3] = opened[p + 3]; }
        return {
            type: 'jaw', id, S, L: x0, T: y0, W, H, line, lens, down, up, closed, openCols, real, tail, erased, still,
            innerTop, innerBottom, innerMid, openedCols, cavity, tongue, drop: drop * OPEN_GAIN,
        };
    }
    // une position de la bouche (JawRig._draw, forme neutre) dans out (RGBA de la zone)
    function drawJaw(rig, amount, out) {
        const { S, T: y0, W, H, line, lens, down, up, closed, openCols, real, tail, erased, still, innerTop, innerBottom, innerMid, openedCols, cavity, tongue } = rig;
        const height = rig.drop * clamp(amount, 0, 1);
        const fadeK = Math.min(1, amount * TAIL_FADE);
        // couleur de la bouche fermée (ligne sombre peu à peu effacée) à la ligne j de la zone
        const src = (k, c) => (erased && tail[k] ? closed[k * 4 + c] * (1 - tail[k] * fadeK) + erased[k * 3 + c] * tail[k] * fadeK : closed[k * 4 + c]);
        for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
            const k = j * W + i, p = k * 4;
            if (still[k]) { out[p + 3] = 0; continue; }                        // rien ne bouge ici : l'image au repos se voit dessous
            const Y = y0 + j;
            const sy = Y + (up[k] * LIFT - down[k]) * height;
            // la bouche fermée déplacée (lignes voisines mélangées)
            const fy = clamp(sy - y0, 0, H - 1), a = Math.floor(fy), b = Math.min(a + 1, H - 1), t = fy - a, ka = a * W + i, kb = b * W + i;
            let r = src(ka, 0) + (src(kb, 0) - src(ka, 0)) * t;
            let g = src(ka, 1) + (src(kb, 1) - src(ka, 1)) * t;
            let bl = src(ka, 2) + (src(kb, 2) - src(ka, 2)) * t;
            // ouverture : les pixels qui iraient chercher l'autre côté de la ligne des lèvres
            const below = Y - line[i];
            const gap = below > 0 ? clamp(line[i] - sy, 0, 1) : clamp(sy - line[i], 0, 1);
            if (gap > 0) {
                const gTop = line[i] - LIFT * height * lens[i], gBot = line[i] + height * lens[i];
                const sc = clamp((gBot - gTop) / Math.max(innerBottom[i] - innerTop[i], 1), 1, TEETH_STRETCH);
                const fromTop = innerTop[i] + (Y - gTop) / sc, fromBot = innerBottom[i] - (gBot - Y) / sc;
                const topHalf = fromTop <= innerMid[i];
                const sample = topHalf ? fromTop : Math.max(fromBot, innerMid[i]);
                const fs = clamp(sample, 0, S - 1), oa = Math.floor(fs), ob = Math.min(oa + 1, S - 1), ot = fs - oa, qa = (oa * W + i) * 4, qb = (ob * W + i) * 4;
                let ir = openCols[qa] + (openCols[qb] - openCols[qa]) * ot;
                let ig = openCols[qa + 1] + (openCols[qb + 1] - openCols[qa + 1]) * ot;
                let ib = openCols[qa + 2] + (openCols[qb + 2] - openCols[qa + 2]) * ot;
                const rs = sample - y0;
                let rv = 0;
                if (rs > -1 && rs < H) {
                    const ra = Math.floor(rs), rt = rs - ra;
                    const v0 = ra >= 0 ? real[ra * W + i] : 0, v1 = ra + 1 < H ? real[(ra + 1) * W + i] : 0;
                    rv = v0 + (v1 - v0) * rt;
                }
                // au-delà de l'intérieur du portrait : l'ombre de la bouche, sombre en haut, vers la langue en bas
                const beyond = topHalf ? 0 : Math.max(innerMid[i] - fromBot, 0) * sc;
                const cav = clamp(beyond / Math.max(6, (gBot - gTop) * 0.3), 0, 1) * 0.7;
                const depth = Math.pow(clamp((Y - gTop) / Math.max(gBot - gTop, 1), 0, 1), 1.5);
                const shR = cavity[0] * (1 - depth) + tongue[0] * depth, shG = cavity[1] * (1 - depth) + tongue[1] * depth, shB = cavity[2] * (1 - depth) + tongue[2] * depth;
                ir = ir * (1 - cav) + shR * cav; ig = ig * (1 - cav) + shG * cav; ib = ib * (1 - cav) + shB * cav;
                ir = ir * rv + shR * (1 - rv); ig = ig * rv + shG * (1 - rv); ib = ib * rv + shB * (1 - rv);
                // vers les coins, les commissures restent dans l'ombre
                const shade = Math.max(1 - smooth(lens[i] / CORNER_SHADE), 1 - openedCols[i]);
                ir = ir * (1 - shade) + cavity[0] * shade; ig = ig * (1 - shade) + cavity[1] * shade; ib = ib * (1 - shade) + cavity[2] * shade;
                r = r * (1 - gap) + ir * gap; g = g * (1 - gap) + ig * gap; bl = bl * (1 - gap) + ib * gap;
            }
            out[p] = r; out[p + 1] = g; out[p + 2] = bl; out[p + 3] = closed[p + 3];
        }
    }
    let rectsStale = true;
    window.addEventListener('scroll', () => { rectsStale = true; }, { passive: true, capture: true });
    window.addEventListener('resize', () => { rectsStale = true; }, { passive: true });

    class AvatarView {
        constructor(id, opts = {}) {
            this.el = document.createElement('div');
            this.el.className = 'av' + (opts.className ? ' ' + opts.className : '');
            this.rig = document.createElement('div');
            this.rig.className = 'av-rig';
            this.layers = ['idle', 'talk', 'blink', 'blinktalk', 'wink'].map((n) => {
                const img = document.createElement('img');
                img.className = 'av-l av-' + n;
                img.alt = '';
                img.draggable = false;
                img.decoding = 'async';
                if (n !== 'idle') img.style.opacity = '0';
                this.rig.appendChild(img);
                return img;
            });
            // regard : une copie de l'image au repos, montrée seulement au centre des yeux, qu'on décale un peu (avatar_gaze.move_gaze)
            this.eyes = document.createElement('div');
            this.eyes.className = 'av-eyes';
            this.eyesImg = document.createElement('img');
            this.eyesImg.className = 'av-l';
            this.eyesImg.alt = '';
            this.eyesImg.draggable = false;
            this.eyesImg.decoding = 'async';
            this.eyes.appendChild(this.eyesImg);
            this.rig.insertBefore(this.eyes, this.layers[2]);        // sous les paupières fermées
            this.eyeGeo = null;
            this.fx = document.createElement('div');
            this.fx.className = 'av-fx';
            this.el.append(this.rig, this.fx);
            this.phase = rnd(0, 100);
            this.mouth = 0;              // ouverture affichée
            this.mouthV = 0;             // vitesse des lèvres (ressort)
            this.mouthFn = null;         // source de la bouche : () => 0..1
            this.jaw = null;             // mâchoire calculée (partagée par avatar), dessinée dans this.jawCv
            this.jawCv = null;
            this.jawAsked = false;
            this.jawM = -1;
            this.blinkT = -1;
            this.nextBlink = performance.now() / 1000 + rnd(0.6, 3.5);
            this.expr = null;
            this.visible = true;
            this.calm = !!opts.calm;     // petites pastilles : moins de mouvement
            // suivi de la souris : les yeux (ici l'intention) visent vite, la tête suit plus lentement
            this.look = { ix: 0, iy: 0, hx: 0, hy: 0, hv: [0, 0], ex: 0, ey: 0, ev: [0, 0], w: 0 };
            this.eyeShown = false;
            this.rect = null;
            this.rectT = -1;
            this.set(id);
            views.add(this);
            io && io.observe(this.el);
            loadEyes();
            start();
        }
        set(id) {
            if (!id || id === this.id) return;
            this.id = id;
            const f = (n) => BASE + id + '/' + n + '.webp';
            const [idle, talk, blink, blinktalk, wink] = this.layers;
            idle.src = f('idle');
            talk.src = f('talk');
            blink.src = f('blink');
            blinktalk.src = f('blinktalk');
            wink.src = f('blink');
            this.eyesImg.src = f('idle');
            this.applyEyes();
            if (this.jawCv) this.jawCv.remove();
            this.jaw = null; this.jawCv = null; this.jawAsked = false; this.jawM = -1;
        }
        // la mâchoire est prête : une petite toile posée sur la bouche, au-dessus des paupières
        attachJaw(rig) {
            if (!rig || rig.id !== this.id || this.jaw) return;
            const c = document.createElement('canvas');
            c.className = 'av-mouth';
            c.width = rig.W; c.height = rig.H;
            const pc = (v) => (v / rig.S * 100).toFixed(3) + '%';
            c.style.cssText = `position:absolute;pointer-events:none;display:none;left:${pc(rig.L)};top:${pc(rig.T)};width:${pc(rig.W)};height:${pc(rig.H)}`;
            this.rig.appendChild(c);
            this.jawCtx = c.getContext('2d');
            this.jawImg = this.jawCtx.createImageData(rig.W, rig.H);
            this.jawCv = c;
            this.jaw = rig;
            this.jawM = -1;
        }
        showJaw(m) {
            if (m <= 0.001) { if (this.jawM !== 0) { this.jawCv.style.display = 'none'; this.jawM = 0; } return; }
            if (Math.abs(m - this.jawM) < 0.004 && m < 1) return;
            if (m === this.jawM) return;
            drawMouth(this.jaw, m, this.jawImg.data);
            this.jawCtx.putImageData(this.jawImg, 0, 0);
            if (!(this.jawM > 0)) this.jawCv.style.display = '';
            this.jawM = m;
        }
        // zones des yeux d'après la fiche du studio ; sans fiche, pas de regard (la tête tourne un peu à la place)
        applyEyes() {
            const e = EYES && EYES[this.id];
            this.eyes.style.display = 'none';
            this.eyeShown = false;
            if (!e) { this.eyeGeo = null; return; }
            const [x1, y1, x2, y2, w, h] = e;
            const rx = w * 0.34;
            const ry = Math.min(h * 0.21, rx * 0.48);
            const g = (x, y) => `radial-gradient(ellipse ${(rx * 100).toFixed(2)}% ${(ry * 100).toFixed(2)}% at ${(x * 100).toFixed(2)}% ${(y * 100).toFixed(2)}%, #000 45%, rgba(0,0,0,.5) 72%, transparent 100%)`;
            const mask = g(x1, y1) + ', ' + g(x2, y2);
            this.eyes.style.webkitMaskImage = mask;
            this.eyes.style.maskImage = mask;
            this.eyeGeo = { lx: rx * 0.4, ly: ry * 0.3 };             // pas de pupille à travers une paupière
        }
        play(name) {
            const e = EXPR[name];
            if (!e) return;
            this.expr = { e, t0: performance.now() / 1000 };
            const n = e.many ? 9 : 3;
            for (let i = 0; i < n; i++) setTimeout(() => this.particle(e.fx[i % e.fx.length]), i * (e.many ? 140 : 260));
        }
        particle(ch) {
            const s = document.createElement('span');
            s.className = 'av-p';
            s.textContent = ch;
            s.style.left = rnd(18, 82) + '%';
            s.style.setProperty('--dx', rnd(-30, 30) + 'px');
            s.style.setProperty('--rot', rnd(-25, 25) + 'deg');
            s.style.fontSize = 'calc(var(--avs, 120px) * ' + rnd(0.14, 0.22).toFixed(2) + ')';
            this.fx.appendChild(s);
            setTimeout(() => s.remove(), 1700);
        }
        speakText(text) {                         // bouche au rythme du texte (sans son) ; rend la durée
            const tl = textTrack(text);
            const total = tl.length ? tl[tl.length - 1][0] : 0;
            const t0 = performance.now() / 1000;
            let i = 0;
            const fn = () => {
                const now = performance.now() / 1000 - t0 + MOUTH_LEAD;
                if (now > total) { if (this.mouthFn === fn) this.mouthFn = null; return 0; }
                while (i < tl.length - 1 && tl[i + 1][0] <= now) i++;
                return tl[i] ? tl[i][1] : 0;
            };
            this.mouthFn = fn;
            return total;
        }
        destroy() { views.delete(this); io && io.unobserve(this.el); this.el.remove(); }
        // où regarder : vecteur vers la souris, fondu au bord d'une zone autour du portrait (avatar_pointer.nearby)
        lookTarget(now) {
            if (!pointer.on || now - pointer.t > POINTER_REST) return null;
            if (rectsStale || !this.rect || now - this.rectT > 0.5) { this.rect = this.el.getBoundingClientRect(); this.rectT = now; }
            const r = this.rect;
            if (!r.width) return null;
            const reach = Math.max(r.width * 1.3, 200);
            const dx = (pointer.x - (r.left + r.width / 2)) / reach;
            const dy = (pointer.y - (r.top + r.height * 0.4)) / (reach * 0.85);
            const d = Math.hypot(dx, dy);
            if (d >= 1) return null;
            return [dx, dy, 1 - smooth((d - 0.7) / 0.3)];
        }
        tick(now, dt) {
            if (!this.el.isConnected) { if (this.lostAt === undefined) this.lostAt = now; else if (now - this.lostAt > 5) views.delete(this); return; }
            this.lostAt = undefined;
            if (!this.visible) return;
            // ── clignements : rapides (0,17 s), parfois doubles
            if (now >= this.nextBlink && this.blinkT < 0) { this.blinkT = 0; this.nextBlink = now + (Math.random() < 0.15 ? 0.32 : rnd(2.2, 6.0)); }
            let blink = 0;
            if (this.blinkT >= 0) {
                this.blinkT += dt;
                const b = this.blinkT;
                blink = b < 0.05 ? b / 0.05 : b < 0.08 ? 1 : b < 0.17 ? 1 - (b - 0.08) / 0.09 : 0;
                if (b >= 0.17) this.blinkT = -1;
            }
            // ── bouche
            let target = this.mouthFn ? clamp(this.mouthFn(), 0, 1) : 0;
            // ── expression en cours
            let ex = null;
            let wink = 0;
            if (this.expr) {
                const t = (now - this.expr.t0) / this.expr.e.dur;
                if (t >= 1) this.expr = null;
                else {
                    ex = this.expr.e.f(t);
                    if (ex.blink !== undefined) blink = Math.max(blink * (ex.blink ? 1 : 0), ex.blink);
                    if (ex.mouth !== undefined) target = Math.max(target, ex.mouth);
                    if (ex.wink) { wink = ex.wink; blink = 0; }
                }
            }
            [this.mouth, this.mouthV] = springMouth(this.mouth, this.mouthV, target, dt);
            const m = this.mouth;
            const [, talk, bl, bt, wk] = this.layers;
            // paupières nettes : un fondu superposait les iris aux paupières fermées (avatar_reference.render_reference)
            blink = blink >= 0.5 ? 1 : 0;
            const kind = mouthKind(this.id);
            let mt = m, mb = m;                                       // opacité des images « talk » et « blinktalk »
            if (kind === 3) mt = mb = 0;                              // bouche immobile
            else if (kind === 1) mt = mb = m >= 0.5 ? 1 : 0;          // image entière : bascule nette à mi-geste
            else if (kind === 0 || kind === 4) {
                if (m > 0.01 && !this.jawAsked) { this.jawAsked = true; const id = this.id; getRig(id).then((r) => { if (r && this.id === id) this.attachJaw(r); }); }
                if (this.jaw) { this.showJaw(m); mt = mb = 0; }        // la mâchoire remplace le fondu
            }
            talk.style.opacity = mt.toFixed(3);
            bl.style.opacity = (blink * (1 - mb)).toFixed(3);
            bt.style.opacity = (blink * mb).toFixed(3);
            wk.style.opacity = wink.toFixed(3);

            // ── tête
            const amp = (this.calm ? 0.55 : 1) * (REDUCED ? 0.3 : 1);
            const ph = this.phase;
            const presence = 1 + 0.12 * clamp(m * 3, 0, 1);              // la parole accentue un peu les gestes
            const breath = Math.sin(now * 0.95 + ph * 0.5);              // respiration : seule chose continue
            const sway = idleSway(now, ph) * presence;                   // petite inclinaison, puis pause
            const neck = -0.12 * sway + 0.025 * Math.sin(now * 0.29 + ph + 0.3);
            const [gx, gy] = this.calm ? [0, 0] : glance(now, ph);
            // suivi de la souris
            const L = this.look;
            const tg = REDUCED ? null : this.lookTarget(now);
            let px = 0, py = 0, pw = 0;
            if (tg) { pw = clamp(tg[2], 0, 1); px = clamp(tg[0], -1, 1) * pw; py = clamp(tg[1], -1, 1) * pw; }
            const el = Math.min(0.1, dt);
            const k = 1 - Math.exp(-el / 0.18);
            L.ix += (px - L.ix) * k;
            L.iy += (py - L.iy) * k;
            L.w += (pw - L.w) * (1 - Math.exp(-el / 0.30));
            const [head, hv] = follow([L.hx, L.hy], L.hv, [L.ix, L.iy], el, 6, 0.8, 3.5);   // la tête : lente
            [L.hx, L.hy] = head;
            L.hv = hv;
            const [eye, ev] = follow([L.ex, L.ey], L.ev, [L.ix, L.iy], el, 12, 2.2, 16);    // les yeux : vifs
            [L.ex, L.ey] = eye;
            L.ev = ev;
            const free = 1 - L.w;                                         // l'attention remplace les gestes au repos
            const ps = this.calm ? 0.6 : 1;
            // ── regard : coup d'œil au repos + suivi de la souris
            const geo = this.eyeGeo;
            const turnGlance = geo ? 0.25 : 1;                            // avec des yeux qui bougent, la tête tourne moins pour un coup d'œil
            if (geo) {
                const gzx = gx * free + L.ex * 6 * ps;
                const gzy = gy * free + L.ey * 5 * ps;
                const dx = clamp(clamp(gzx, -3, 3) * 0.004, -geo.lx, geo.lx);
                const dy = clamp(clamp(gzy, -3, 3) * 0.002, -geo.ly, geo.ly);
                const show = Math.abs(dx) > 0.0004 || Math.abs(dy) > 0.0004;
                if (show !== this.eyeShown) { this.eyes.style.display = show ? '' : 'none'; this.eyeShown = show; }
                if (show) this.eyesImg.style.transform = `translate(${(dx * 100).toFixed(3)}%, ${(dy * 100).toFixed(3)}%)`;
            }
            let rot = (sway * 2.4 + neck * 1.2) * amp * free + L.hx * 4 * ps;
            let turnY = gx * 7 * amp * free * turnGlance + L.hx * 16 * ps; // la tête tourne vers la souris
            let turnX = -gy * 6 * amp * free * turnGlance - L.hy * 10 * ps; // et lève ou baisse un peu le menton
            let x = L.hx * 2 * ps + gx * 0.6 * amp * free * turnGlance;
            let y = 0.35 * breath * amp + L.hy * 1.3 * ps - m * 0.5;     // la mâchoire qui s'ouvre soulève un peu la tête
            let sc = 1 + 0.006 * breath * amp;
            let filter = '';
            if (ex) {
                rot += ex.rot || 0; y += ex.y || 0; x += ex.x || 0; sc *= ex.scale || 1;
                const e = this.expr && this.expr.e;
                if (e && e.filter) filter = e.filter;
                if (e && e.glow) filter += ' drop-shadow(0 0 calc(var(--avs, 120px) * .06) ' + e.glow + ')';
            }
            this.rig.style.transform = `translate(${x.toFixed(2)}%, ${y.toFixed(2)}%) rotate(${rot.toFixed(2)}deg) rotateY(${turnY.toFixed(2)}deg) rotateX(${turnX.toFixed(2)}deg) scale(${sc.toFixed(4)})`;
            if (filter !== this.lastFilter) { this.rig.style.filter = filter; this.lastFilter = filter; }
            this.el.classList.toggle('speaking', m > 0.06);
        }
    }

    // Lettres → piste de bouche (sans son) : voyelles ouvertes, b/m/p lèvres fermées, f/v/s/ch resserrées. Le ressort lisse le tout.
    function textTrack(text) {
        const tl = [];
        let t = 0;
        const s = String(text).slice(0, 400).toLowerCase();
        for (let i = 0; i < s.length; i++) {
            const ch = s[i];
            let open, dur;
            if (/[aàâä]/.test(ch)) { open = rnd(0.85, 1); dur = 0.09; }
            else if (/[oôöœæ]/.test(ch)) { open = rnd(0.65, 0.8); dur = 0.09; }
            else if (/[eéèêë]/.test(ch)) { open = rnd(0.55, 0.75); dur = ch === 'e' && /[\s.,!?;:]|$/.test(s[i + 1] || '') ? 0.04 : 0.08; }
            else if (/[iîïyuùûü]/.test(ch)) { open = rnd(0.4, 0.55); dur = 0.075; }
            else if (/[bmp]/.test(ch)) { open = 0; dur = 0.06; }
            else if (/[fv]/.test(ch)) { open = 0.12; dur = 0.055; }
            else if (/[szcçjxh]/.test(ch)) { open = 0.2; dur = 0.05; }
            else if (/[\p{L}\p{N}]/u.test(ch)) { open = rnd(0.25, 0.38); dur = 0.05; }
            else if (/[.!?…]/.test(ch)) { open = 0; dur = 0.32; }
            else if (/[,;:]/.test(ch)) { open = 0; dur = 0.18; }
            else { open = 0.05; dur = 0.04; }
            tl.push([t, open]);
            t += dur;
        }
        tl.push([t, 0]);
        return tl;
    }

    // Son → piste d'ouverture, une valeur toutes les 10 ms (audio_meter.mouth_features + mouth_opening) :
    // les voyelles (200-2500 Hz) ouvrent, les « s, ch, f » (3500-9000 Hz) resserrent, et un creux entre deux syllabes referme un peu.
    const STEP = 0.01;
    function audioTrack(buf) {
        let x = buf.getChannelData(0);
        let rate = buf.sampleRate;
        if (buf.numberOfChannels > 1) {
            const y = buf.getChannelData(1);
            const mix = new Float32Array(x.length);
            for (let i = 0; i < x.length; i++) mix[i] = (x[i] + y[i]) / 2;
            x = mix;
        }
        const dec = Math.max(1, Math.floor(rate / 22050));      // 48 kHz → 24 kHz : assez pour 9 kHz, deux fois moins de calcul
        if (dec > 1) {
            const n = Math.floor(x.length / dec);
            const d = new Float32Array(n);
            for (let i = 0; i < n; i++) { let s = 0; for (let j = 0; j < dec; j++) s += x[i * dec + j]; d[i] = s / dec; }
            x = d;
            rate /= dec;
        }
        const W = Math.max(16, Math.round(0.03 * rate));
        let N = 1;
        while (N < W) N <<= 1;
        const bits = Math.log2(N);
        const rev = new Uint32Array(N);
        for (let i = 0; i < N; i++) { let r = 0; for (let b = 0; b < bits; b++) r |= ((i >> b) & 1) << (bits - 1 - b); rev[i] = r; }
        const cos = new Float64Array(N / 2), sin = new Float64Array(N / 2);
        for (let i = 0; i < N / 2; i++) { cos[i] = Math.cos(-2 * Math.PI * i / N); sin[i] = Math.sin(-2 * Math.PI * i / N); }
        const hann = new Float32Array(W);
        for (let i = 0; i < W; i++) hann[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (W - 1));
        const bin = (hz) => Math.round(hz * N / rate);
        const [v0, v1, h0, h1] = [bin(200), bin(2500), bin(3500), Math.min(N / 2, bin(9000))];
        const count = Math.ceil(x.length / (rate * STEP));
        const rms = new Float32Array(count), level = new Float32Array(count), hiss = new Float32Array(count);
        const re = new Float64Array(N), im = new Float64Array(N);
        for (let f = 0; f < count; f++) {
            const c0 = Math.round(f * STEP * rate) - (W >> 1);
            re.fill(0); im.fill(0);
            let e = 0;
            for (let j = 0; j < W; j++) {
                const k = c0 + j;
                const v = k >= 0 && k < x.length ? x[k] : 0;
                e += v * v;
                re[rev[j]] = v * hann[j];
            }
            rms[f] = Math.sqrt(e / W);
            for (let size = 2; size <= N; size <<= 1) {
                const half = size >> 1, step = N / size;
                for (let i = 0; i < N; i += size) {
                    for (let j = 0, t = 0; j < half; j++, t += step) {
                        const a = i + j, b = a + half;
                        const tr = re[b] * cos[t] - im[b] * sin[t];
                        const ti = re[b] * sin[t] + im[b] * cos[t];
                        re[b] = re[a] - tr; im[b] = im[a] - ti;
                        re[a] += tr; im[a] += ti;
                    }
                }
            }
            let total = 1e-12, vow = 0, hs = 0;
            for (let k = 0; k <= N / 2; k++) {
                const p = re[k] * re[k] + im[k] * im[k];
                total += p;
                if (k >= v0 && k < v1) vow += p;
                else if (k >= h0 && k < h1) hs += p;
            }
            level[f] = rms[f] * Math.sqrt(vow / total);
            hiss[f] = clamp((10 * Math.log10((hs + 1e-12) / (vow + 1e-12)) + 6) / 12, 0, 1);
        }
        let peak = 0.005;
        for (let f = 0; f < count; f++) if (level[f] > peak) peak = level[f];
        const db = new Float32Array(count);
        for (let f = 0; f < count; f++) db[f] = 20 * Math.log10(level[f] / peak + 1e-9);
        const out = new Float32Array(count);
        const span = 8;                                           // ± 80 ms : la syllabe voisine la plus forte
        for (let f = 0; f < count; f++) {
            let local = -Infinity;
            for (let j = Math.max(0, f - span); j <= Math.min(count - 1, f + span); j++) if (db[j] > local) local = db[j];
            const syllable = clamp((db[f] - local + 12) / 12, 0, 1);
            let o = clamp((db[f] + 26) / 18, 0, 1);              // fermée sous -26 dB, grande ouverte vers -8 dB
            o *= 0.4 + 0.6 * syllable;
            o *= 1 - 0.6 * hiss[f];
            out[f] = rms[f] <= 2e-4 ? 0 : o;
        }
        return out;
    }

    const io = 'IntersectionObserver' in window ? new IntersectionObserver((entries) => {
        for (const en of entries) for (const v of views) if (v.el === en.target) v.visible = en.isIntersecting;
    }) : null;

    let running = false;
    let last = 0;
    function frame(ms) {
        const now = ms / 1000;
        const dt = Math.min(0.1, last ? now - last : 0.016);
        last = now;
        for (const v of views) v.tick(now, dt);
        rectsStale = false;
        if (views.size) requestAnimationFrame(frame); else { running = false; last = 0; }
    }
    function start() { if (!running) { running = true; requestAnimationFrame(frame); } }

    // ───────── Voix : le serveur lit le texte (voix de l'utilisateur), la bouche suit la piste calculée sur ce son
    let ctx = null;
    const queue = [];
    let busy = false;
    const Voice = {
        enabled: (() => { try { return localStorage.getItem('gws_sound') !== '0'; } catch { return true; } })(),
        setEnabled(on) { this.enabled = on; try { localStorage.setItem('gws_sound', on ? '1' : '0'); } catch { /* rien */ } if (!on) this.stop(); },
        unlock() { if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { ctx = null; } } if (ctx && ctx.state === 'suspended') ctx.resume(); },
        current: null,
        stop() { queue.length = 0; if (this.current) { try { this.current.stop(); } catch { /* rien */ } } },
        // views : une ou plusieurs vues du même membre (sa carte sur la Place, sa pastille…)
        say(views, text, voice) {
            views = (Array.isArray(views) ? views : [views]).filter(Boolean);
            if (!this.enabled || !ctx) { const d = Math.max(...views.map((v) => v.speakText(text)), 0); return Promise.resolve(d); }
            return new Promise((resolve) => { queue.push({ views, text, voice, resolve }); pump(); });
        },
    };
    // instant entendu en ce moment dans le temps du son (le délai de la carte son compris)
    function heardTime() {
        if (ctx.getOutputTimestamp) {
            const ts = ctx.getOutputTimestamp();
            if (ts && ts.contextTime > 0 && ts.performanceTime > 0) return ts.contextTime + (performance.now() - ts.performanceTime) / 1000;
        }
        return ctx.currentTime - (ctx.outputLatency || ctx.baseLatency || 0);
    }
    async function pump() {
        if (busy || !queue.length) return;
        busy = true;
        const job = queue.shift();
        try {
            let r;
            if (CFG.audioUrl) {
                const u = CFG.audioUrl(job.text, job.voice || '');
                if (!u) throw new Error('pas de fichier audio');
                r = await fetch(u);
            } else {
                r = await fetch('/social/api/tts', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-GWS': '1' }, body: JSON.stringify({ text: job.text, voice: job.voice || '' }) });
            }
            if (!r.ok) throw new Error('tts');
            const buf = await ctx.decodeAudioData(await r.arrayBuffer());
            const src = ctx.createBufferSource();
            src.buffer = buf;
            src.connect(ctx.destination);
            let track = null;
            try { track = audioTrack(buf); } catch { track = null; }
            let level;
            const t0 = ctx.currentTime + 0.03;
            if (track && track.length > 1) {
                level = () => {
                    const pos = (heardTime() - t0 + MOUTH_LEAD) / STEP;
                    if (pos < 0 || pos >= track.length - 1) return 0;
                    const i = Math.floor(pos);
                    return track[i] + (track[i + 1] - track[i]) * (pos - i);
                };
            } else {                                                  // secours : volume en direct
                const an = ctx.createAnalyser();
                an.fftSize = 1024;
                an.smoothingTimeConstant = 0.35;
                src.connect(an);
                const data = new Float32Array(an.fftSize);
                level = () => {
                    an.getFloatTimeDomainData(data);
                    let s = 0;
                    for (let i = 0; i < data.length; i++) s += data[i] * data[i];
                    return clamp((Math.sqrt(s / data.length) - 0.012) * 7.5, 0, 1);
                };
            }
            job.views.forEach((v) => (v.mouthFn = level));
            Voice.current = src;
            await new Promise((res) => { src.onended = res; src.start(t0); });
            job.views.forEach((v) => { if (v.mouthFn === level) v.mouthFn = null; });
            job.resolve(buf.duration);
        } catch {
            if (CFG.onMissing) { try { CFG.onMissing(job.text); } catch { /* rien */ } }
            job.resolve(Math.max(...job.views.map((v) => v.speakText(job.text)), 0));
        } finally {
            Voice.current = null;
            busy = false;
            pump();
        }
    }
    ['pointerdown', 'keydown'].forEach((ev) => window.addEventListener(ev, () => Voice.unlock(), { once: false, passive: true }));

    window.GWAvatar = { AvatarView, EXPR, Voice, url: (id, n) => BASE + id + '/' + (n || 'idle') + '.webp', thumb: (id) => BASE + '_thumbs/' + id + '.webp', _audioTrack: audioTrack, _textTrack: textTrack };
})();
