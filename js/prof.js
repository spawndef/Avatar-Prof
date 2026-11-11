// Avatar Prof : le prof avatar qui parle (animation de GhostWalk Social + voix).
// Ce fichier est chargé AVANT avatar.js : il lui donne ses adresses (window.GWAvatarConfig).
//
// La voix :
//   1. si la phrase a un fichier audio préparé d'avance par Piper (audio/index.json : { "voix|texte": "fichier.wav" }), on le joue,
//      et la bouche suit le son ;
//   2. sinon, en secours, la voix du navigateur lit la phrase (voix française de Windows, du Chromebook ou de l'iPad).
// Les fichiers audio se fabriquent à partir de Prof.prononcer(texte) : « 6 × 7 » devient « 6 fois 7 », etc.
// Deux voix Piper faites maison (outils/voix/voices) : Lady_Baguette (femme) et CPT_Henri (homme).
(function () {
    'use strict';
    const VOIX = { Lady_Baguette: 'Lady Baguette', CPT_Henri: 'Capitaine Henri' };
    let voixProf = 'Lady_Baguette';  // la voix du prof affiché
    let manifest = {};
    let voixLocale = false;         // true quand l'app tourne avec outils/serveur.py : il fabrique les voix qui manquent
    const pret = Promise.all([
        fetch('audio/index.json', { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : {})).then((j) => { manifest = j && typeof j === 'object' ? j : {}; }).catch(() => {}),
        // le petit serveur qui fabrique les voix n'existe que sur le PC de préparation (jamais sur GitHub)
        /^(localhost|127\.0\.0\.1)$/.test(location.hostname)
            ? fetch('tts-local').then((r) => r.ok && r.text()).then((t) => { voixLocale = t === 'ok'; }).catch(() => {})
            : Promise.resolve(),
    ]);

    // ce qu'on dit à voix haute : les nombres ordinaux (1re, 2e), les unités (cm, kg, $) et les symboles des maths en mots
    const ORDINAUX = ['', 'premier', 'deuxième', 'troisième', 'quatrième', 'cinquième', 'sixième', 'septième', 'huitième', 'neuvième', 'dixième',
        'onzième', 'douzième', 'treizième', 'quatorzième', 'quinzième', 'seizième', 'dix-septième', 'dix-huitième', 'dix-neuvième', 'vingtième'];
    const UNITES = { mm: 'millimètres', cm: 'centimètres', m: 'mètres', km: 'kilomètres', g: 'grammes', kg: 'kilogrammes', mL: 'millilitres', L: 'litres', $: 'dollars' };
    const PUISSANCE = { '²': ' carrés', '³': ' cubes' };
    const FIN = '(?![\\p{L}\\p{N}])';                      // pas suivi d'une lettre ou d'un chiffre
    function prononcer(t) {
        return String(t || '')
            .replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, '')
            // 1re → première, 1er → premier, 2e / 2ème → deuxième… (« 1re année », « 3e secondaire »)
            .replace(new RegExp('(?<![\\p{L}\\p{N},.])1(re|ère)' + FIN, 'gu'), 'première')
            .replace(new RegExp('(?<![\\p{L}\\p{N},.])1er' + FIN, 'gu'), 'premier')
            .replace(new RegExp('(?<![\\p{L}\\p{N},.])(\\d{1,2})(e|ème|ième)' + FIN, 'gu'), (m, n) => ORDINAUX[+n] || m)
            // unités : « 12 cm » → « 12 centimètres », « 24 cm² » → « 24 centimètres carrés », « (cm) » → « en centimètres », « 4 $ » → « 4 dollars »
            .replace(new RegExp('\\((mm|cm|km|kg|mL|m|g|L|\\$)(²|³)?\\)', 'gu'), (m, u, p) => 'en ' + UNITES[u] + (p ? PUISSANCE[p] : ''))
            .replace(new RegExp('(\\d)\\s*(mm|cm|km|kg|mL|m|g|L|\\$)(²|³)?' + FIN, 'gu'), (m, d, u, p) => d + ' ' + UNITES[u] + (p ? PUISSANCE[p] : ''))
            // un nombre collé à une lettre de maths : « 5x » → « 5 x » (l'exposant est lu plus bas)
            .replace(/(\d)([a-zA-Z])(?![\p{L}])/gu, '$1 $2')
            .replace(/log([₀₁₂₃₄₅₆₇₈₉]+)/g, (m, b) => 'logarithme en base ' + [...b].map((c) => '₀₁₂₃₄₅₆₇₈₉'.indexOf(c)).join('') + ' de ')
            .replace(/\b(sin|cos|tan)\s*\(/g, (m, f) => ({ sin: 'sinus', cos: 'cosinus', tan: 'tangente' })[f] + ' de (')
            .replace(/√\s*(\d+)/g, 'racine carrée de $1')
            .replace(/([\w)])²/g, '$1 au carré')
            .replace(/([\w)])³/g, '$1 au cube')
            .replace(/([\w)])([⁰¹²³⁴⁵⁶⁷⁸⁹]+)/g, (m, a, e) => a + ' exposant ' + [...e].map((c) => '⁰¹²³⁴⁵⁶⁷⁸⁹'.indexOf(c)).join(''))
            .replace(/(\d+)\s*\/\s*(\d+)/g, '$1 sur $2')
            .replace(/\(\s*[-−]\s*(\d)/g, '(moins $1')
            .replace(/\s[-−]\s/g, ' moins ')
            .replace(/×/g, ' fois ')
            .replace(/÷/g, ' divisé par ')
            .replace(/\s\+\s/g, ' plus ')
            .replace(/\s=\s/g, ' égale ')
            .replace(/°/g, ' degrés')
            .replace(/π/g, ' pi ')
            .replace(/±/g, ' plus ou moins ')
            .replace(/√\s*\(/g, 'racine carrée de (')
            .replace(/≈/g, ' environ ')
            .replace(/\ben \$/g, 'en dollars')
            .replace(/(^|[\s(=])[-−](\d)/g, '$1moins $2')                   // « -18 » → « moins 18 »
            .replace(/−/g, ' moins ')                                       // un signe moins collé, ex. « (−b » (Piper plante dessus)
            .replace(/\s*[→⇒]\s*/g, ', ')                                   // « grand → petit » → « grand, petit » (Piper plante sur la flèche)
            .replace(/_{2,}|…/g, ', blanc, ')
            .replace(/[«»"]/g, '')
            .replace(/\s+/g, ' ')
            .trim();
    }

    // ───────── voix du navigateur (secours tant que les fichiers Piper ne sont pas faits)
    let voixNav = null;
    function choisirVoix() {
        if (!('speechSynthesis' in window)) return;
        const v = speechSynthesis.getVoices();
        voixNav = v.find((x) => /fr[-_]CA/i.test(x.lang)) || v.find((x) => /^fr/i.test(x.lang)) || null;
    }
    if ('speechSynthesis' in window) { choisirVoix(); speechSynthesis.onvoiceschanged = choisirVoix; }
    let enAttente = null;   // la phrase que lit la voix du navigateur en ce moment (promesse)
    function voixNavigateur(texte) {
        if (!('speechSynthesis' in window)) return;
        const u = new SpeechSynthesisUtterance(prononcer(texte));
        u.lang = voixNav ? voixNav.lang : 'fr-CA';
        if (voixNav) u.voice = voixNav;
        u.rate = 0.95;
        u.pitch = voixProf === 'CPT_Henri' ? 0.75 : 1.05;
        enAttente = new Promise((ok) => { u.onend = ok; u.onerror = ok; setTimeout(ok, 20000); });
        speechSynthesis.speak(u);
    }

    window.GWAvatarConfig = {
        base: 'avatars/',
        eyesUrl: 'data/yeux.json',
        mouthsUrl: 'data/bouches.json',
        audioUrl: (texte, voix) => {
            voix = VOIX[voix] ? voix : voixProf;
            const k = voix + '|' + String(texte).trim();
            if (manifest[k]) return 'audio/' + manifest[k];
            if (voixLocale) return 'tts?v=' + voix + '&k=' + encodeURIComponent(k) + '&t=' + encodeURIComponent(prononcer(texte));
            return null;
        },
        onMissing: voixNavigateur,
    };

    // ───────── le prof à l'écran
    const sleep = (s) => new Promise((ok) => setTimeout(ok, s * 1000));
    let vue = null;          // AvatarView (animation complète) ou vue de secours (vignette qui bouge)
    let hote = null;
    let bulle = null;
    let numero = 0;          // chaque nouvelle phrase coupe la précédente

    // vue de secours : la vignette seule, qui sautille au rythme du texte (tant que les grandes images ne sont pas copiées)
    function vueSecours(id) {
        const el = document.createElement('div');
        el.className = 'av av-secours';
        const img = document.createElement('img');
        img.src = 'avatars/_thumbs/' + id + '.webp';
        img.alt = '';
        el.appendChild(img);
        const v = {
            el, mouthFn: null, secours: true,
            speakText(texte) {
                const tl = window.GWAvatar ? window.GWAvatar._textTrack(texte) : [];
                const total = tl.length ? tl[tl.length - 1][0] : 0;
                const t0 = performance.now() / 1000;
                let i = 0;
                this.mouthFn = () => {
                    const t = performance.now() / 1000 - t0;
                    if (t > total) return 0;
                    while (i < tl.length - 1 && tl[i + 1][0] <= t) i++;
                    return tl[i] ? tl[i][1] : 0;
                };
                return total;
            },
            play(nom) { el.classList.remove('geste-' + nom); void el.offsetWidth; el.classList.add('geste-' + nom); setTimeout(() => el.classList.remove('geste-' + nom), 1600); },
            destroy() { el.remove(); this.mouthFn = null; },
        };
        const anim = () => {
            if (!el.isConnected && v.gone) return;
            const m = v.mouthFn ? Math.max(0, Math.min(1, v.mouthFn() || 0)) : 0;
            img.style.transform = 'translateY(' + (-m * 4).toFixed(1) + 'px) scale(' + (1 + m * 0.03).toFixed(3) + ')';
            el.classList.toggle('speaking', m > 0.06);
            requestAnimationFrame(anim);
        };
        requestAnimationFrame(anim);
        return v;
    }

    function grandesImages(id) {
        return new Promise((ok) => { const i = new Image(); i.onload = () => ok(true); i.onerror = () => ok(false); i.src = 'avatars/' + id + '/idle.webp'; });
    }

    const Prof = {
        prononcer,
        id: null,
        // place le prof (avatar id) dans l'élément hote ; bulleEl reçoit le texte dit
        async monter(id, hoteEl, bulleEl) {
            if (this.id === id && vue && hoteEl === hote) return;
            this.id = id;
            hote = hoteEl; bulle = bulleEl;
            if (vue) { vue.gone = true; vue.destroy(); vue = null; }
            const complet = window.GWAvatar && await grandesImages(id);
            if (this.id !== id) return;
            vue = complet ? new window.GWAvatar.AvatarView(id) : vueSecours(id);
            hote.replaceChildren(vue.el);
        },
        geste(nom) { if (vue) vue.play(nom); },
        stop() {
            numero++;
            if (window.GWAvatar) window.GWAvatar.Voice.stop();
            if ('speechSynthesis' in window) speechSynthesis.cancel();
            if (vue) vue.mouthFn = null;
        },
        // dit une phrase ou une suite de phrases (bulle + voix + bouche) ; rend une promesse finie quand il a fini de parler.
        // Chaque phrase a son propre fichier audio : on garde des phrases FIXES (sans prénom ni nombre au hasard)
        // pour qu'elles puissent être préparées d'avance. bulleTexte (facultatif) : ce qu'on montre, s'il diffère de ce qu'on dit.
        async dire(phrases, bulleTexte) {
            phrases = (Array.isArray(phrases) ? phrases : [phrases]).filter(Boolean);
            if (!phrases.length) return;
            this.stop();
            const n = numero;
            if (bulle) { bulle.textContent = bulleTexte || phrases.join(' '); bulle.classList.remove('vide'); }
            await pret;
            for (const texte of phrases) {
                if (!vue || !window.GWAvatar || n !== numero) return;
                enAttente = null;
                const t0 = performance.now() / 1000;
                const d = await window.GWAvatar.Voice.say([vue], texte, voixProf);
                if (n !== numero) return;
                if (enAttente) { await enAttente; enAttente = null; continue; }
                const passe = performance.now() / 1000 - t0;
                if (passe < d - 0.1) await sleep(d - passe);
            }
        },
        // prépare d'avance le fichier audio d'une phrase (avec outils/serveur.py seulement) ; rend true si c'est fait
        async preparer(texte, voix) {
            await pret;
            const u = window.GWAvatarConfig.audioUrl(texte, voix);
            if (!u) return false;
            try { const r = await fetch(u); return r.ok; } catch { return false; }
        },
        // la voix du prof : 'Lady_Baguette' (femme) ou 'CPT_Henri' (homme)
        voix(v) { if (VOIX[v]) voixProf = v; return voixProf; },
        VOIX,
        voixLocale: () => voixLocale,
        vue: () => vue,
        son(actif) {
            if (window.GWAvatar) window.GWAvatar.Voice.setEnabled(actif);
            if (!actif && 'speechSynthesis' in window) speechSynthesis.cancel();
        },
        sonActif() { return window.GWAvatar ? window.GWAvatar.Voice.enabled : true; },
    };
    window.Prof = Prof;
})();
