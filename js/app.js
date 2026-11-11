// Avatar Prof : l'app (profils, carte de l'aventure, exercices, XP, badges, coin des parents).
// Tout reste sur l'appareil (localStorage) : aucun compte, aucune donnée envoyée.
(function () {
    'use strict';

    // AVANT LA PUBLICATION : mettre true pour ne montrer que les exercices vérifiés par Dom ("verifie": true).
    const SEULEMENT_VERIFIES = true;

    // dit : comment le prof le dit à voix haute (« la 1re secondaire »)
    const NIVEAUX = [
        { id: 'primaire-1', nom: '1re année', dit: '1re année', cycle: 'Primaire' },
        { id: 'primaire-2', nom: '2e année', dit: '2e année', cycle: 'Primaire' },
        { id: 'primaire-3', nom: '3e année', dit: '3e année', cycle: 'Primaire' },
        { id: 'primaire-4', nom: '4e année', dit: '4e année', cycle: 'Primaire' },
        { id: 'primaire-5', nom: '5e année', dit: '5e année', cycle: 'Primaire' },
        { id: 'primaire-6', nom: '6e année', dit: '6e année', cycle: 'Primaire' },
        { id: 'secondaire-1', nom: 'Secondaire 1', dit: '1re secondaire', cycle: 'Secondaire' },
        { id: 'secondaire-2', nom: 'Secondaire 2', dit: '2e secondaire', cycle: 'Secondaire' },
        { id: 'secondaire-3', nom: 'Secondaire 3', dit: '3e secondaire', cycle: 'Secondaire' },
        { id: 'secondaire-4', nom: 'Secondaire 4', dit: '4e secondaire', cycle: 'Secondaire' },
        { id: 'secondaire-5', nom: 'Secondaire 5', dit: '5e secondaire', cycle: 'Secondaire' },
    ];
    const MATIERES = { 'Mathématique': '🔢', 'Français': '📖', 'Sciences': '🔬', 'Anglais': '💬', 'Univers social': '🌎' };
    const TITRES = [[1, 'Apprenti'], [3, 'Explorateur'], [5, 'Aventurier'], [8, 'Champion'], [12, 'Génie'], [16, 'Légende']];
    const BADGES = {
        premiere: { icone: '🎒', nom: 'Première série' },
        parfait: { icone: '⭐', nom: 'Série parfaite' },
        eclair: { icone: '⚡', nom: 'Test-éclair réussi' },
        jours3: { icone: '🔥', nom: '3 jours de suite' },
        jours5: { icone: '🏅', nom: '5 jours de suite' },
        revisions: { icone: '📚', nom: 'Révisions terminées' },
        bonnes100: { icone: '💯', nom: '100 bonnes réponses' },
        niveau5: { icone: '🚀', nom: 'Niveau 5' },
        niveau10: { icone: '👑', nom: 'Niveau 10' },
    };
    // Tout ce que le prof dit à voix haute. Des phrases FIXES (sans prénom ni nombre) : chacune a son fichier audio
    // préparé d'avance (voir toutesLesPhrases et le Coin des parents). Le prénom et les nombres sont seulement écrits dans la bulle.
    const BRAVO = ['Bravo !', 'Super, c\'est ça !', 'Excellent !', 'Exactement !', 'Wow, bien joué !', 'Tu es génial !'];
    const ENCORE = ['Presque ! Essaie encore.', 'Pas tout à fait. Regarde bien, tu es capable !', 'Hmm, pas cette fois. Encore un essai !'];
    const P = {
        accueil: 'Bonjour ! Qui joue aujourd\'hui ?',
        accueilVide: 'Bonjour ! Je suis ton prof avatar. Crée ton joueur pour commencer !',
        pseudo: 'Choisis un pseudo. Pas ton vrai nom : un nom de héros !',
        pseudoVide: 'Écris un pseudo pour continuer.',
        avatars: 'Choisis ton prof avatar. C\'est lui qui va t\'aider !',
        salut: 'Salut ! C\'est moi qui serai ton prof !',
        avatarVide: 'Clique sur un avatar pour le choisir.',
        annee: 'En quelle année es-tu à l\'école ?',
        bienvenue: 'Bienvenue !',
        reviser: (n) => 'On commence par réviser la ' + n.dit + '. Clique sur l\'étape qui brille !',
        revisionsFinies: (n) => 'Bravo, les révisions sont finies ! Choisis une matière de ta ' + n.dit + '.',
        matiere: 'Choisis une matière pour commencer !',
        anneeFinie: (n) => 'Bravo, tu as fini ta ' + n.dit + ' ! Clique sur la fusée pour passer à l\'année suivante.',
        nouvelleAnnee: (n) => 'Super ! Te voici en ' + n.dit + ' ! Une nouvelle aventure commence.',
        toutFini: 'Wow, tu as tout fini ! Rejoue tes étapes pour gagner trois étoiles partout.',
        ferme: 'Cette étape est encore fermée. Réussis d\'abord l\'étape d\'avant !',
        choixRevision: (n) => 'Tu peux réviser la ' + n.dit + ', ou tenter le test-éclair pour aller plus vite !',
        vide: 'Oups, il n\'y a pas encore d\'exercices ici.',
        gauche: 'Clique d\'abord sur un mot de gauche.',
        indice: 'Voici un indice.',
        pasGrave: 'Pas grave, on apprend !',
        monte: 'Wow ! Tu montes de niveau !',
        revisionReussie: (n) => 'Bravo ! Tu as réussi la révision de la ' + n.dit + ' !',
        superTravail: 'Super travail !',
        toutBon: 'Super travail ! Tout est bon !',
        eclairRate: 'Le test-éclair était difficile ! Fais la révision normale : tu auras deux essais par question.',
        revoir: 'On va revoir ce qui était difficile. Tu vas y arriver !',
        rattrapageFini: 'Bien travaillé ! Maintenant, retente la révision.',
        progression: 'Voici ta progression. Bravo pour tout ton travail !',
        parents: 'Ce coin est réservé aux parents.',
        nSyllabes: (n) => 'Ça fait ' + n + (n > 1 ? ' syllabes !' : ' syllabe !'),
        ilYEnA: (n) => 'Il y en a ' + n + ' !',
    };
    // nombres pour lesquels le prof peut dire nSyllabes / ilYEnA (pour préparer les voix d'avance)
    const NOMBRES_DITS = { nSyllabes: [1, 2, 3, 4, 5, 6], ilYEnA: Array.from({ length: 20 }, (_, i) => i + 1) };
    const PROF_ACCUEIL = '058e1d90';
    const SERIE = 10, ECLAIR = 5, REUSSITE = 0.8;
    const CLE = 'avatar-prof-v1';

    // ───────── petits outils
    const $ = (s) => document.querySelector(s);
    function h(tag, props, ...enfants) {
        const el = document.createElement(tag);
        for (const [k, v] of Object.entries(props || {})) {
            if (v === undefined || v === null || v === false) continue;
            if (k === 'class') el.className = v;
            else if (k === 'text') el.textContent = v;
            else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
            else el.setAttribute(k, v === true ? '' : v);
        }
        for (const c of enfants.flat()) if (c !== null && c !== undefined && c !== false) el.append(c instanceof Node ? c : String(c));
        return el;
    }
    const melange = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
    const auHasard = (a) => a[Math.floor(Math.random() * a.length)];
    const nomNiveau = (id) => (NIVEAUX.find((n) => n.id === id) || {}).nom || id;
    const indexNiveau = (id) => NIVEAUX.findIndex((n) => n.id === id);
    const niveauJoueur = (xp) => Math.floor(Math.sqrt((xp || 0) / 40)) + 1;
    const xpPour = (n) => 40 * (n - 1) * (n - 1);
    const titre = (n) => TITRES.filter((t) => n >= t[0]).pop()[1];
    const jour = (d) => { const x = d || new Date(); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); };
    const sansAccents = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[’`]/g, '\'').replace(/\s+/g, ' ').trim();
    // un nombre écrit par l'enfant : virgule ou point, espaces ignorés, fraction « 3/4 » acceptée (comme GoudSolutions)
    const enNombre = (s) => {
        const t = String(s ?? '').replace(/\s/g, '').replace(/,/g, '.').replace(/−/g, '-');
        let m = /^(-?\d+(?:\.\d+)?)\/(-?\d+(?:\.\d+)?)$/.exec(t);
        if (m) return Number(m[2]) ? Number(m[1]) / Number(m[2]) : NaN;
        m = /^-?(\d+(\.\d*)?|\.\d+)$/.exec(t);
        return m ? Number(t) : NaN;
    };
    // un mot écrit par l'enfant (comme GoudSolutions) : majuscules, espaces et ponctuation finale ignorés, les ACCENTS comptent,
    // et en conjugaison le pronom est facultatif (« je mange » ou « mange »)
    const PRONOMS = /^(je |j'|tu |il \/ elle |il\/elle |ils \/ elles |ils\/elles |il |elle |on |nous |vous |ils |elles )/;
    const propre = (s) => String(s ?? '').toLowerCase().replace(/[’`]/g, '\'').replace(/\s+/g, ' ').replace(/[\s.!?;:]+$/, '').trim();
    const sansPronom = (s) => s.replace(/^(que |qu')/, '').replace(PRONOMS, '');   // « qu'ils écoutent » → « écoutent »
    const memeMot = (v, r) => { const a = propre(v), b = propre(r); return a === b || sansPronom(a) === sansPronom(b); };

    // ───────── sauvegarde (sur l'appareil seulement)
    function charger() {
        try { const j = JSON.parse(localStorage.getItem(CLE)); if (j && Array.isArray(j.profils)) return j; } catch { /* rien */ }
        return { profils: [], actif: null };
    }
    let data = charger();
    function sauver() { try { localStorage.setItem(CLE, JSON.stringify(data)); } catch { /* rien */ } }
    const profil = () => data.profils.find((p) => p.id === data.actif) || null;

    // ───────── données
    const cache = {};
    function exercices(niv) {
        if (!cache[niv]) {
            cache[niv] = fetch('exercices/' + niv + '.json').then((r) => (r.ok ? r.json() : {}))
                .then((j) => (Array.isArray(j.exercices) ? j.exercices : []).filter((e) => e.statut !== 'retirer' && (!SEULEMENT_VERIFIES || e.verifie === true)))
                .catch(() => []);
        }
        return cache[niv];
    }
    let LECONS = {};       // le « truc » de chaque notion (data/lecons.json, fait par outils/lecons.py)
    fetch('data/lecons.json').then((r) => r.json()).then((j) => { LECONS = j || {}; }).catch(() => {});
    let AVATARS = [], CATEGORIES = {};
    const avatarsPrets = fetch('data/avatars.json').then((r) => r.json()).then((j) => {
        AVATARS = Array.isArray(j.avatars) ? j.avatars : [];
        CATEGORIES = j.categories || {};
    }).catch(() => {});
    const vignette = (id) => 'avatars/_thumbs/' + id + '.webp';

    // ───────── le prof
    let dernier = null;
    function dire(phrases, bulleTexte) { dernier = [phrases, bulleTexte]; return window.Prof.dire(phrases, bulleTexte); }
    const niv = (id) => NIVEAUX.find((n) => n.id === id) || NIVEAUX[0];
    function geste(n) { window.Prof.geste(n); }
    // le prof affiché et sa voix (celle choisie par l'enfant, sinon celle de l'avatar : femme → Lady Baguette, homme → Capitaine Henri)
    const avatarDe = (id) => AVATARS.find((a) => a.id === id) || null;
    async function prof(id, voix) {
        await avatarsPrets;
        window.Prof.voix(voix || (avatarDe(id) || {}).voix || 'Lady_Baguette');
        return window.Prof.monter(id, $('#prof'), $('#bulle'));
    }
    const profDe = (p) => prof(p.avatar, p.voix);
    $('#b-redire').addEventListener('click', () => { if (dernier) dire(...dernier); });

    function fete() {
        const f = $('#fete');
        f.replaceChildren();
        for (let i = 0; i < 40; i++) {
            const s = h('span', { text: auHasard(['🎉', '⭐', '🎊', '✨', '🌟']) });
            s.style.left = Math.random() * 100 + '%';
            s.style.animationDelay = (Math.random() * 0.6).toFixed(2) + 's';
            s.style.fontSize = (18 + Math.random() * 22).toFixed(0) + 'px';
            f.append(s);
        }
        f.hidden = false;
        setTimeout(() => { f.hidden = true; }, 2800);
    }

    // ───────── barre du haut
    function majBarre() {
        const p = profil();
        $('#barre').hidden = !p;
        if (!p) return;
        const n = niveauJoueur(p.xp), a = xpPour(n), b = xpPour(n + 1);
        $('#xp-niv').textContent = n;
        $('#xp-plein').style.width = Math.round(((p.xp - a) / (b - a)) * 100) + '%';
        $('#xp-txt').textContent = p.xp + ' XP';
        $('#b-joueur').replaceChildren(h('img', { src: vignette(p.avatar), alt: '' }), h('span', { text: p.pseudo }));
        $('#b-son').textContent = window.Prof.sonActif() ? '🔊' : '🔇';
    }
    $('#b-joueur').addEventListener('click', () => ecranProgression());
    $('#b-son').addEventListener('click', () => { window.Prof.son(!window.Prof.sonActif()); majBarre(); });
    $('#b-parents').addEventListener('click', () => ecranParents());
    $('#b-quitter').addEventListener('click', () => { data.actif = null; sauver(); ecranAccueil(); });

    function afficher(...enfants) {
        const e = $('#ecran');
        e.replaceChildren(...enfants.filter((x) => x !== null && x !== undefined && x !== false));
        e.scrollTop = 0;
        window.scrollTo(0, 0);
        majBarre();
    }

    // ═════════ 1. Bienvenue : qui joue ?
    async function ecranAccueil() {
        window.Prof.stop();
        await prof(PROF_ACCUEIL);
        const cartes = data.profils.map((p) => h('button', { class: 'carte-joueur', onclick: () => { data.actif = p.id; sauver(); ecranCarte(); } },
            h('img', { src: vignette(p.avatar), alt: '' }),
            h('b', { text: p.pseudo }),
            h('small', { text: nomNiveau(p.niveau) + ' · niveau ' + niveauJoueur(p.xp) })));
        cartes.push(h('button', { class: 'carte-joueur nouveau', onclick: () => ecranNouveau() }, h('div', { class: 'plus', text: '＋' }), h('b', { text: 'Nouveau joueur' })));
        afficher(
            h('h1', { text: 'Qui joue aujourd\'hui ?' }),
            h('div', { class: 'grille-joueurs' }, cartes),
            h('p', { class: 'note', text: 'Ta progression reste sur cet appareil. Rien n\'est envoyé sur Internet.' }));
        dire(data.profils.length ? P.accueil : P.accueilVide);
    }

    // ═════════ Nouveau joueur : pseudo → prof avatar → année scolaire
    async function ecranNouveau() {
        const nouveau = { pseudo: '', avatar: null, voix: null };
        const etapePseudo = () => {
            const champ = h('input', { class: 'champ', maxlength: '20', placeholder: 'Ex. : Comète, Ninja, Super Lou…', autocomplete: 'off', spellcheck: 'false' });
            const ok = () => {
                const v = champ.value.replace(/\s+/g, ' ').trim();
                if (!v) { champ.focus(); dire(P.pseudoVide); return; }
                nouveau.pseudo = v; etapeAvatar();
            };
            champ.addEventListener('keydown', (e) => { if (e.key === 'Enter') ok(); });
            afficher(h('h1', { text: 'Choisis ton pseudo' }),
                h('p', { text: 'Pas ton vrai nom : un nom de héros !' }),
                champ,
                h('div', { class: 'actions' }, h('button', { class: 'btn secondaire', text: '← Retour', onclick: () => ecranAccueil() }), h('button', { class: 'btn', text: 'Continuer →', onclick: ok })));
            champ.focus();
            dire(P.pseudo);
        };
        let categorie = null;
        const etapeAvatar = async () => {
            await avatarsPrets;
            const cats = Object.keys(CATEGORIES).filter((c) => AVATARS.some((a) => a.categorie === c));
            if (!categorie) categorie = cats[0];
            const grille = h('div', { class: 'grille-avatars' });
            const onglets = h('div', { class: 'onglets' });
            const montrer = (c) => {
                categorie = c;
                onglets.querySelectorAll('button').forEach((b) => b.classList.toggle('actif', b.dataset.cat === c));
                grille.replaceChildren(...AVATARS.filter((a) => a.categorie === c).map((a) => h('button', { class: 'choix-avatar' + (nouveau.avatar === a.id ? ' choisi' : ''), title: a.nom, onclick: async (e) => {
                    nouveau.avatar = a.id;
                    nouveau.voix = a.voix || 'Lady_Baguette';
                    document.querySelectorAll('.choix-avatar').forEach((b) => b.classList.remove('choisi'));
                    e.currentTarget.classList.add('choisi');
                    majVoix();
                    await prof(a.id, nouveau.voix);
                    geste('wave');
                    dire(P.salut, 'Salut, je m\'appelle ' + a.nom + ' ! C\'est moi qui serai ton prof !');
                } }, h('img', { src: vignette(a.id), alt: '', loading: 'lazy' }), h('span', { text: a.nom }))));
            };
            for (const c of cats) onglets.append(h('button', { class: 'onglet', 'data-cat': c, onclick: () => montrer(c) }, (CATEGORIES[c] || '') + ' ' + c.replace(' · ', ' ')));
            montrer(categorie);
            // la voix : celle de l'avatar au départ, mais l'enfant peut prendre l'autre
            const choixVoix = h('div', { class: 'choix-voix' }, h('span', { text: 'Sa voix :' }),
                Object.entries(window.Prof.VOIX).map(([v, nom]) => h('button', { class: 'onglet', 'data-voix': v, onclick: async () => {
                    if (!nouveau.avatar) { dire(P.avatarVide); return; }
                    nouveau.voix = v; majVoix();
                    await prof(nouveau.avatar, v);
                    dire(P.salut, 'Salut, je m\'appelle ' + (avatarDe(nouveau.avatar) || {}).nom + ' ! C\'est moi qui serai ton prof !');
                } }, (v === 'CPT_Henri' ? '👨 ' : '👩 ') + nom)));
            function majVoix() { choixVoix.querySelectorAll('button').forEach((b) => b.classList.toggle('actif', b.dataset.voix === nouveau.voix)); }
            majVoix();
            afficher(h('h1', { text: 'Choisis ton prof avatar' }),
                h('p', { text: 'C\'est lui qui va te lire les questions et t\'encourager.' }),
                onglets, grille, choixVoix,
                h('div', { class: 'actions' }, h('button', { class: 'btn secondaire', text: '← Retour', onclick: etapePseudo }),
                    h('button', { class: 'btn', text: 'Continuer →', onclick: () => { if (!nouveau.avatar) { dire(P.avatarVide); return; } etapeNiveau(); } })));
            dire(P.avatars);
        };
        const etapeNiveau = () => ecranChoixNiveau((niv) => {
            const p = { id: 'j' + Date.now().toString(36), pseudo: nouveau.pseudo, avatar: nouveau.avatar, voix: nouveau.voix, niveau: niv, xp: 0, etapes: {}, badges: [],
                stats: { series: 0, bonnes: 0 }, jour: { dernier: '', suite: 0 }, cree: jour() };
            data.profils.push(p);
            data.actif = p.id;
            sauver();
            ecranCarte(true);
        }, etapeAvatar);
        etapePseudo();
    }

    // ═════════ 2. Mon année scolaire
    function ecranChoixNiveau(choisi, retour) {
        const groupe = (cycle) => h('div', { class: 'groupe-niveaux' }, h('h2', { text: cycle }),
            h('div', { class: 'grille-niveaux' }, NIVEAUX.filter((n) => n.cycle === cycle).map((n) =>
                h('button', { class: 'btn-niveau ' + cycle.toLowerCase(), onclick: () => choisi(n.id) }, n.nom))));
        afficher(h('h1', { text: 'En quelle année es-tu ?' }), groupe('Primaire'), groupe('Secondaire'),
            retour ? h('div', { class: 'actions' }, h('button', { class: 'btn secondaire', text: '← Retour', onclick: retour })) : null);
        dire(P.annee);
    }

    // ═════════ 3. La carte de l'aventure : révisions des années d'avant, puis l'année de l'élève
    async function etapesDe(p) {
        const i = indexNiveau(p.niveau);
        const liste = NIVEAUX.slice(0, Math.max(0, i)).map((n) => ({ cle: 'rev:' + n.id, type: 'revision', niveau: n.id, titre: 'Révision · ' + n.nom, icone: '📚' }));
        const ex = await exercices(p.niveau);
        const matieres = [...new Set(ex.map((e) => e.matiere))];
        for (const m of matieres) liste.push({ cle: 'niv:' + p.niveau + ':' + m, type: 'niveau', niveau: p.niveau, matiere: m, titre: m, icone: MATIERES[m] || '✏️' });
        // déblocage : les révisions une à une, puis toutes les matières de l'année
        let ouvert = true;
        for (const e of liste) {
            const r = p.etapes[e.cle] || {};
            e.etoiles = r.etoiles || 0;
            e.reussi = !!r.reussi;
            if (e.type === 'revision') { e.ouvert = ouvert; if (!e.reussi) ouvert = false; } else e.ouvert = ouvert;
        }
        return liste;
    }
    async function ecranCarte(premiereFois) {
        const p = profil();
        if (!p) { ecranAccueil(); return; }
        window.Prof.stop();
        await profDe(p);
        const liste = await etapesDe(p);
        // toute l'année est réussie : une dernière étape mène à l'année suivante
        const fini = liste.length > 0 && liste.every((e) => e.reussi);
        const suivant = NIVEAUX[indexNiveau(p.niveau) + 1];
        if (fini && suivant) liste.push({ cle: 'suivant', type: 'suivant', titre: 'Passe à la ' + suivant.nom + ' !', icone: '🚀', ouvert: true, reussi: false, etoiles: 0 });
        const actuelle = liste.find((e) => e.ouvert && !e.reussi) || null;
        const noeuds = liste.map((e, k) => h('button', {
            class: 'noeud ' + e.type + (e.reussi ? ' reussi' : '') + (e.ouvert ? '' : ' ferme') + (e === actuelle ? ' actuel' : ''),
            onclick: () => {
                if (!e.ouvert) { geste('think'); dire(P.ferme); return; }
                if (e.type === 'suivant') monterDAnnee(p, suivant, liste);
                else if (e.type === 'revision') ecranRevision(e); else lancerSerie(e, 'normal');
            },
        }, h('div', { class: 'pastille', text: e.ouvert ? (e.reussi ? '✅' : e.icone) : '🔒' }),
        h('div', { class: 'noeud-txt' }, h('b', { text: e.titre }),
            e.type === 'suivant' ? h('span', { class: 'sous-titre', text: 'Nouvelle aventure' }) : h('span', { class: 'etoiles', text: '★'.repeat(e.etoiles) + '☆'.repeat(3 - e.etoiles) })),
        e === actuelle ? h('div', { class: 'ici', 'aria-label': 'C\'est ici !' }, h('span', { class: 'ici-main', text: '👈' }), h('small', { text: 'C\'est ici !' })) : null,
        k < liste.length - 1 ? h('div', { class: 'lien' }) : null));
        const nbRev = liste.filter((e) => e.type === 'revision').length;
        afficher(
            h('h1', { text: 'Ton aventure · ' + nomNiveau(p.niveau) }),
            fini ? h('p', { text: suivant ? 'Bravo, ton année est finie ! Clique sur la fusée 🚀 pour continuer, ou rejoue une étape pour gagner plus d\'étoiles.' : 'Bravo, tu as tout fini ! Rejoue une étape pour gagner plus d\'étoiles.' })
                : nbRev ? h('p', { text: 'D\'abord, on révise les années d\'avant. Ensuite, place à ta ' + nomNiveau(p.niveau) + ' !' }) : h('p', { text: 'Choisis une matière pour commencer.' }),
            h('div', { class: 'chemin' }, noeuds),
            liste.length ? null : h('p', { class: 'note', text: 'Il n\'y a pas encore d\'exercices pour ce niveau.' }));
        const phrases = [];
        if (premiereFois) { geste('wave'); phrases.push(P.bienvenue); }
        if (actuelle && actuelle.type === 'suivant') { geste('party'); phrases.push(P.anneeFinie(niv(p.niveau))); }
        else if (fini) phrases.push(P.toutFini);
        else if (actuelle && actuelle.type === 'revision') phrases.push(P.reviser(niv(actuelle.niveau)));
        else if (nbRev) phrases.push(P.revisionsFinies(niv(p.niveau)));
        else phrases.push(P.matiere);
        dire(phrases, premiereFois ? 'Bienvenue, ' + p.pseudo + ' ! ' + phrases.slice(1).join(' ') : null);
    }
    // passer à l'année suivante : l'année finie compte comme révisée, et la nouvelle carte s'ouvre
    async function monterDAnnee(p, suivant, liste) {
        const etoiles = Math.min(...liste.filter((e) => e.type === 'niveau').map((e) => e.etoiles), 3);
        p.etapes['rev:' + p.niveau] = { reussi: true, etoiles: Number.isFinite(etoiles) ? etoiles : 1, meilleur: 1 };
        p.niveau = suivant.id;
        sauver();
        fete();
        await ecranCarte();
        geste('party');
        dire(P.nouvelleAnnee(suivant));
    }

    function ecranRevision(e) {
        afficher(h('h1', { text: e.titre }),
            h('div', { class: 'deux-choix' },
                h('button', { class: 'gros-choix', onclick: () => lancerSerie(e, 'normal') }, h('div', { class: 'gros-icone', text: '📚' }), h('b', { text: 'Réviser' }), h('span', { text: SERIE + ' questions, deux essais par question. Réussis-en 8 sur 10 pour passer.' })),
                h('button', { class: 'gros-choix eclair', onclick: () => lancerSerie(e, 'eclair') }, h('div', { class: 'gros-icone', text: '⚡' }), h('b', { text: 'Test-éclair' }), h('span', { text: ECLAIR + ' questions, un seul essai. Tout bon ? Tu sautes l\'étape !' }))),
            h('div', { class: 'actions' }, h('button', { class: 'btn secondaire', text: '← La carte', onclick: () => ecranCarte() })));
        dire(P.choixRevision(niv(e.niveau)));
    }

    // ═════════ 4. Une série d'exercices
    let serie = null;
    async function lancerSerie(etape, mode, liste) {
        const p = profil();
        let pool = liste || (await exercices(etape.niveau)).filter((x) => etape.type !== 'niveau' || x.matiere === etape.matiere);
        if (!pool.length) { dire(P.vide); return; }
        const n = mode === 'eclair' ? ECLAIR : SERIE;
        serie = { etape, mode, questions: melange(pool).slice(0, n), i: 0, essai: 1, score: 0, parfaite: true, xp: 0, rates: [], niveauAvant: niveauJoueur(p.xp), fini: false };
        afficherQuestion();
    }

    function afficherQuestion() {
        const q = serie.questions[serie.i];
        jetonAnim++;                             // arrête une animation de la question d'avant
        serie.essai = 1;
        serie.fini = false;
        const points = serie.questions.map((_, k) => h('span', { class: 'point' + (k < serie.i ? ' fait' : k === serie.i ? ' ici' : '') }));
        const retour = h('div', { class: 'retour', id: 'retour' });
        const zone = h('div', { class: 'reponses', id: 'reponses' });
        const suivant = h('button', { class: 'btn suivant', id: 'b-suivant', text: serie.i < serie.questions.length - 1 ? 'Suivant →' : 'Voir mon résultat →', hidden: true, onclick: suivante });
        afficher(
            h('div', { class: 'haut-question' },
                h('button', { class: 'btn petit secondaire', text: '✕ Arrêter', onclick: () => { window.Prof.stop(); ecranCarte(); } }),
                h('div', { class: 'points' }, points),
                h('span', { class: 'compte', text: (serie.i + 1) + ' / ' + serie.questions.length })),
            h('div', { class: 'etiquettes' },
                h('span', { class: 'etiquette', text: (MATIERES[q.matiere] || '✏️') + ' ' + q.matiere + (q.theme ? ' · ' + q.theme : '') }),
                serie.mode === 'eclair' ? h('span', { class: 'etiquette eclair', text: '⚡ Test-éclair' }) : null,
                serie.mode === 'rattrapage' ? h('span', { class: 'etiquette', text: '🔁 Rattrapage' }) : null,
                q.verifie ? null : h('span', { class: 'etiquette a-verifier', title: 'Cet exercice n\'a pas encore été vérifié', text: 'à vérifier' })),
            h('h1', { class: 'consigne', text: q.consigne }),
            q.visuel ? h('div', { class: 'visuel', text: q.visuel }) : null,
            zone, retour, suivant);
        construireReponse(q, zone);
        dire(q.consigne);
    }

    function construireReponse(q, zone) {
        if (q.type === 'choix' || q.type === 'vrai-faux') {
            const choix = q.type === 'vrai-faux' ? q.choix || ['Vrai', 'Faux'] : melange(q.choix || []);
            zone.classList.add(q.type === 'vrai-faux' ? 'vf' : 'choix');
            for (const c of choix) {
                const b = h('button', { class: 'btn-reponse', text: c, onclick: () => { if (!serie.fini) repondre(c === q.reponse, b); } });
                zone.append(b);
            }
        } else if (q.type === 'nombre' || q.type === 'mot') {
            const champ = h('input', { class: 'champ', inputmode: q.type === 'nombre' ? 'decimal' : 'text', autocomplete: 'off', spellcheck: 'false', placeholder: q.type === 'nombre' ? 'Ta réponse (un nombre)' : 'Ta réponse' });
            const valider = () => {
                if (serie.fini) return;
                const v = champ.value.trim();
                if (!v) { champ.focus(); return; }
                const bonnes = Array.isArray(q.reponse) ? q.reponse : [q.reponse];
                let ok;
                if (q.type === 'nombre') ok = bonnes.some((r) => { const a = enNombre(v), b = enNombre(r); return Number.isFinite(a) && Number.isFinite(b) ? Math.abs(a - b) <= (Number(q.tol) || 0) + 1e-9 : sansAccents(v) === sansAccents(r); });
                else ok = bonnes.some((r) => memeMot(v, r));
                repondre(ok, champ);
                if (!ok && !serie.fini) { champ.select(); champ.focus(); }
            };
            champ.addEventListener('keydown', (e) => { if (e.key === 'Enter') valider(); });
            zone.classList.add('ecrire');
            zone.append(champ, h('button', { class: 'btn', text: 'Valider', onclick: valider }));
            setTimeout(() => champ.focus(), 50);
        } else if (q.type === 'associer') {
            const paires = q.paires || [];
            const gauche = h('div', { class: 'colonne' }), droite = h('div', { class: 'colonne' });
            let choisi = null, trouvees = 0;
            for (const [g] of paires) {
                const b = h('button', { class: 'btn-reponse', text: g, onclick: () => {
                    if (serie.fini || b.disabled) return;
                    gauche.querySelectorAll('.btn-reponse').forEach((x) => x.classList.remove('choisi'));
                    b.classList.add('choisi'); choisi = { b, g };
                } });
                gauche.append(b);
            }
            for (const [, d] of melange(paires)) {
                const b = h('button', { class: 'btn-reponse', text: d, onclick: () => {
                    if (serie.fini || b.disabled) return;
                    if (!choisi) { dire(P.gauche); return; }
                    const bon = paires.some(([g, dd]) => g === choisi.g && dd === d);
                    if (bon) {
                        choisi.b.disabled = b.disabled = true;
                        choisi.b.classList.remove('choisi'); choisi.b.classList.add('bon'); b.classList.add('bon');
                        choisi = null; trouvees++;
                        if (trouvees === paires.length) repondre(true, null);
                        else geste('yes');
                    } else {
                        b.classList.add('secoue'); setTimeout(() => b.classList.remove('secoue'), 500);
                        repondre(false, null, true);
                        if (serie.fini) { [...gauche.children, ...droite.children].forEach((x) => { x.disabled = true; x.classList.remove('choisi'); }); }
                    }
                } });
                droite.append(b);
            }
            zone.classList.add('associer');
            zone.append(gauche, h('div', { class: 'fleche', text: '↔' }), droite);
        }
    }

    // bon : la réponse est bonne ; el : le bouton ou la case ; garde : ne pas désactiver le bouton (associer)
    function repondre(bon, el, garde) {
        const q = serie.questions[serie.i];
        jetonAnim++;                             // l'élève a répondu : l'animation en cours s'arrête
        const p = profil();
        const retour = $('#retour');
        if (bon) {
            serie.fini = true;
            const xp = serie.essai === 1 ? 15 : 10;
            serie.score += serie.essai === 1 ? 1 : 0.5;
            if (serie.essai > 1) serie.parfaite = false;
            gagner(xp);
            p.stats.bonnes++;
            sauver();
            if (el) el.classList.add('bon');
            const b = auHasard(BRAVO);
            retour.className = 'retour bon';
            remplir(retour, h('b', { text: '✅ ' + b }), h('span', { class: 'gain', text: '+' + xp + ' XP' }));
            geste(serie.essai === 1 ? 'party' : 'yes');
            dire(b);
            finQuestion();
            return;
        }
        serie.parfaite = false;
        if (el && !garde) { el.classList.add('faux'); if (el.tagName === 'BUTTON') el.disabled = true; }
        // 1re erreur : le prof encourage et explique le TRUC de la notion (avec une petite animation sur un autre exemple),
        // puis l'élève réessaie. Le truc ne donne jamais la réponse.
        if (serie.essai === 1 && serie.mode !== 'eclair') {
            serie.essai = 2;
            const e = auHasard(ENCORE);
            const lecon = LECONS[q.theme];
            const truc = q.indice || (lecon && lecon.truc) || '';
            const zone = h('div', { class: 'anim' });
            const anime = lecon && lecon.anim && lecon.exemple ? () => jouerAnim(lecon.anim, zone, lecon.exemple) : null;
            retour.className = 'retour indice';
            remplir(retour, h('b', { text: '🤔 ' + e }), truc ? h('span', { text: '💡 Le truc : ' + truc }) : null,
                anime ? zone : null, anime ? h('button', { class: 'btn petit secondaire', text: '▶ Montre-moi', onclick: anime }) : null);
            geste('think');
            const j = jetonAnim;
            dire(truc ? [e, truc] : e).then(() => { if (anime && j === jetonAnim && !serie.fini) anime(); });
            return;
        }
        // 2e erreur : la bonne réponse, et pourquoi (animée quand on peut : les syllabes du mot, les objets à compter)
        serie.fini = true;
        serie.rates.push(q);
        const bonne = q.type === 'associer' ? (q.paires || []).map((x) => x.join(' ↔ ')).join(' · ') : q.affichage || (Array.isArray(q.reponse) ? q.reponse[0] : q.reponse);
        const zone = h('div', { class: 'anim' });
        const a = animDe(q);
        const anime = a ? () => jouerAnim(a.type, zone, a.donnee) : null;
        retour.className = 'retour faux';
        remplir(retour, h('b', { text: 'La bonne réponse : ' + bonne }), q.explication ? h('span', { text: q.explication }) : null,
            anime ? zone : null, anime ? h('button', { class: 'btn petit secondaire', text: '▶ Revoir', onclick: anime }) : null);
        document.querySelectorAll('#reponses .btn-reponse').forEach((b) => { if (b.textContent === q.reponse) b.classList.add('bon'); b.disabled = true; });
        geste('think');
        finQuestion();
        const j = jetonAnim;
        if (anime) dire(P.pasGrave).then(() => { if (j === jetonAnim) anime(); });
        else dire([P.pasGrave, q.explication || 'La bonne réponse est : ' + bonne + '.']);
    }

    // ───────── animations qui expliquent
    let jetonAnim = 0;                       // change à chaque question : une vieille animation s'arrête toute seule
    const pause = (ms) => new Promise((ok) => setTimeout(ok, ms));
    function remplir(el, ...enfants) { el.replaceChildren(...enfants.filter((x) => x !== null && x !== undefined && x !== false)); }
    // l'animation qui montre la réponse d'une question, s'il y en a une
    function animDe(q) {
        if (q.theme === 'Syllabes') { const m = /^(.+?)\s*:\s*\d+\s*syllabe/i.exec(q.explication || ''); if (m) return { type: 'syllabes', donnee: m[1].trim() }; }
        if (q.theme === 'Compter' && q.visuel) return { type: 'compter', donnee: q.visuel };
        return null;
    }
    function jouerAnim(type, zone, donnee) { return type === 'syllabes' ? animSyllabes(zone, donnee) : type === 'compter' ? animCompter(zone, donnee) : null; }
    // les syllabes : une main saute sur chaque morceau du mot, le prof le dit, et on compte les tapes
    async function animSyllabes(zone, mot) {
        const j = ++jetonAnim;
        const morceaux = mot.split('-').map((x) => x.trim()).filter(Boolean);
        const main = h('div', { class: 'anim-main', text: '👏' });
        const blocs = morceaux.map((m) => h('span', { class: 'syll', text: m }));
        const compte = h('div', { class: 'anim-compte', text: ' ' });
        remplir(zone, h('div', { class: 'anim-piste' }, main, h('div', { class: 'syll-ligne' }, blocs)), compte);
        await pause(250);
        for (let i = 0; i < blocs.length; i++) {
            if (j !== jetonAnim) return;
            const b = blocs[i];
            main.style.left = (b.offsetLeft + b.offsetWidth / 2) + 'px';
            main.classList.remove('saute'); void main.offsetWidth; main.classList.add('saute');
            b.classList.add('allume');
            compte.textContent = '👏 '.repeat(i + 1).trim();
            await Promise.all([dire(morceaux[i]), pause(800)]);
        }
        if (j !== jetonAnim) return;
        compte.textContent = morceaux.length + (morceaux.length > 1 ? ' tapes = ' : ' tape = ') + morceaux.length + (morceaux.length > 1 ? ' syllabes' : ' syllabe');
        await dire(P.nSyllabes(morceaux.length));
    }
    // compter : chaque objet s'allume avec son numéro, et le prof compte à voix haute
    async function animCompter(zone, texte) {
        const j = ++jetonAnim;
        const objets = typeof Intl.Segmenter === 'function'
            ? [...new Intl.Segmenter('fr', { granularity: 'grapheme' }).segment(texte)].map((s) => s.segment).filter((s) => s.trim())
            : [...texte].filter((s) => s.trim());
        const cases = objets.map((o) => h('span', { class: 'objet' }, h('span', { class: 'o-dessin', text: o }), h('small', { class: 'o-num', text: ' ' })));
        const compte = h('div', { class: 'anim-compte', text: ' ' });
        remplir(zone, h('div', { class: 'objets' }, cases), compte);
        await pause(250);
        for (let i = 0; i < cases.length; i++) {
            if (j !== jetonAnim) return;
            cases[i].classList.add('allume');
            cases[i].querySelector('.o-num').textContent = i + 1;
            await Promise.all([dire(String(i + 1)), pause(600)]);
        }
        if (j !== jetonAnim) return;
        compte.textContent = 'Il y en a ' + cases.length + ' !';
        await dire(P.ilYEnA(cases.length));
    }
    function finQuestion() {
        document.querySelectorAll('#reponses input, #reponses .btn, #reponses .btn-reponse').forEach((x) => { x.disabled = true; });
        const s = $('#b-suivant');
        s.hidden = false;
        s.focus();
    }
    function suivante() {
        serie.i++;
        if (serie.i < serie.questions.length) afficherQuestion(); else finSerie();
    }
    function gagner(xp) {
        const p = profil();
        p.xp += xp;
        serie.xp += xp;
        majBarre();
        const x = $('#xp');
        x.classList.remove('pulse'); void x.offsetWidth; x.classList.add('pulse');
    }

    // ═════════ 5. Fin de la série
    function finSerie() {
        const p = profil();
        const n = serie.questions.length;
        const pct = serie.score / n;
        const etoiles = pct >= 1 ? 3 : pct >= REUSSITE ? 2 : pct >= 0.5 ? 1 : 0;
        const lignes = [['Bonnes réponses', serie.xp + ' XP']];
        const bonus = (nom, xp) => { lignes.push([nom, '+' + xp + ' XP']); gagner(xp); };
        if (serie.mode !== 'rattrapage') bonus('Série terminée', 20);
        if (serie.parfaite && serie.mode !== 'rattrapage') bonus('Série parfaite !', 30);
        const aujourdHui = jour(), hier = jour(new Date(Date.now() - 86400000));
        if (p.jour.dernier !== aujourdHui) {
            p.jour.suite = p.jour.dernier === hier ? p.jour.suite + 1 : 1;
            p.jour.dernier = aujourdHui;
            bonus(p.jour.suite > 1 ? p.jour.suite + ' jours de suite !' : 'Bonus du jour', 15);
        }
        p.stats.series++;
        // l'étape
        const e = serie.etape;
        let reussi = false;
        if (serie.mode === 'normal') reussi = pct >= REUSSITE;
        if (serie.mode === 'eclair') reussi = pct >= 1;
        if (serie.mode !== 'rattrapage') {
            const r = p.etapes[e.cle] || { etoiles: 0, meilleur: 0, reussi: false };
            r.etoiles = Math.max(r.etoiles, etoiles);
            r.meilleur = Math.max(r.meilleur, pct);
            r.reussi = r.reussi || reussi;
            p.etapes[e.cle] = r;
        }
        // badges
        const nouveaux = [];
        const badge = (cle, ok) => { if (ok && !p.badges.includes(cle)) { p.badges.push(cle); nouveaux.push(cle); } };
        badge('premiere', p.stats.series >= 1);
        badge('parfait', serie.parfaite && serie.mode !== 'rattrapage');
        badge('eclair', serie.mode === 'eclair' && reussi);
        badge('jours3', p.jour.suite >= 3);
        badge('jours5', p.jour.suite >= 5);
        const iNiv = indexNiveau(p.niveau);
        badge('revisions', iNiv > 0 && NIVEAUX.slice(0, iNiv).every((x) => (p.etapes['rev:' + x.id] || {}).reussi));
        badge('bonnes100', p.stats.bonnes >= 100);
        badge('niveau5', niveauJoueur(p.xp) >= 5);
        badge('niveau10', niveauJoueur(p.xp) >= 10);
        sauver();

        const niveauApres = niveauJoueur(p.xp);
        const monte = niveauApres > serie.niveauAvant;
        let phrase;
        if (serie.mode === 'rattrapage') phrase = [P.rattrapageFini];
        else if (reussi && e.type === 'revision') phrase = [P.revisionReussie(niv(e.niveau))];
        else if (pct >= REUSSITE) phrase = [pct >= 1 ? P.toutBon : P.superTravail];
        else if (serie.mode === 'eclair') phrase = [P.eclairRate];
        else phrase = [P.revoir];
        if (monte) phrase.unshift(P.monte);
        if (monte || etoiles === 3) { geste('party'); fete(); } else if (pct >= REUSSITE) geste('yes'); else geste('think');

        const boutons = [];
        if (serie.rates.length && serie.mode !== 'eclair') boutons.push(h('button', { class: 'btn', text: '🔁 Revoir mes erreurs (' + serie.rates.length + ')', onclick: () => lancerSerie(e, 'rattrapage', serie.rates) }));
        if (serie.mode === 'eclair' && !reussi) boutons.push(h('button', { class: 'btn', text: '📚 Faire la révision', onclick: () => lancerSerie(e, 'normal') }));
        boutons.push(h('button', { class: 'btn ' + (boutons.length ? 'secondaire' : ''), text: '↻ Rejouer', onclick: () => lancerSerie(e, serie.mode === 'rattrapage' ? 'normal' : serie.mode) }));
        boutons.push(h('button', { class: 'btn secondaire', text: '🗺️ La carte', onclick: () => ecranCarte() }));

        afficher(
            h('div', { class: 'resultat' },
                h('div', { class: 'grandes-etoiles', text: serie.mode === 'rattrapage' ? '🔁' : '★'.repeat(etoiles) + '☆'.repeat(3 - etoiles) }),
                h('h1', { text: serie.mode === 'rattrapage' ? 'Rattrapage terminé' : reussi ? 'Étape réussie !' : pct >= REUSSITE ? 'Bien joué !' : 'Continue, tu progresses !' }),
                h('p', { class: 'score', text: fmt(serie.score) + ' / ' + n + ' bonnes réponses' }),
                h('div', { class: 'gains' }, lignes.map(([a, b]) => h('div', { class: 'ligne' }, h('span', { text: a }), h('b', { text: b })))),
                monte ? h('div', { class: 'monte' }, '🎉 Niveau ' + niveauApres + ' · ' + titre(niveauApres)) : null,
                nouveaux.length ? h('div', { class: 'nouveaux-badges' }, h('b', { text: 'Nouveau badge !' }), nouveaux.map((b) => h('span', { class: 'badge' }, BADGES[b].icone + ' ' + BADGES[b].nom))) : null,
                h('div', { class: 'actions' }, boutons)));
        dire(phrase);
    }
    const fmt = (x) => String(Math.round(x * 10) / 10).replace('.', ',');

    // ═════════ 6. Ma progression
    async function ecranProgression() {
        const p = profil();
        if (!p) return;
        window.Prof.stop();
        const n = niveauJoueur(p.xp);
        const liste = await etapesDe(p);
        afficher(
            h('h1', { text: p.pseudo }),
            h('div', { class: 'fiche' },
                h('div', { class: 'gros-niveau' }, h('b', { text: n }), h('span', { text: titre(n) })),
                h('div', { class: 'stats' },
                    h('div', {}, h('b', { text: p.xp }), ' XP'),
                    h('div', {}, h('b', { text: Math.max(0, xpPour(n + 1) - p.xp) }), ' XP avant le niveau ' + (n + 1)),
                    h('div', {}, h('b', { text: p.stats.bonnes }), ' bonnes réponses'),
                    h('div', {}, h('b', { text: p.stats.series }), ' séries'),
                    h('div', {}, h('b', { text: p.jour.suite || 0 }), ' jour(s) de suite'))),
            h('h2', { text: 'Badges' }),
            h('div', { class: 'badges' }, Object.entries(BADGES).map(([k, b]) => h('div', { class: 'badge' + (p.badges.includes(k) ? '' : ' pas-encore'), title: b.nom }, h('div', { class: 'b-icone', text: b.icone }), h('span', { text: b.nom })))),
            h('h2', { text: 'Étapes' }),
            h('div', { class: 'liste-etapes' }, liste.map((e) => h('div', { class: 'ligne' }, h('span', { text: e.icone + ' ' + e.titre }), h('b', { text: e.reussi ? '✅' : '★'.repeat(e.etoiles) + '☆'.repeat(3 - e.etoiles) })))),
            h('div', { class: 'actions' }, h('button', { class: 'btn', text: '🗺️ Retour à la carte', onclick: () => ecranCarte() })));
        dire(P.progression, 'Tu es au niveau ' + n + ' : ' + titre(n) + ' ! Tu as ' + p.badges.length + ' badge' + (p.badges.length > 1 ? 's' : '') + '. Bravo pour tout ton travail !');
    }

    // ═════════ 7. Coin des parents (une question d'adulte pour entrer)
    function ecranParents() {
        window.Prof.stop();
        const a = 12 + Math.floor(Math.random() * 8), b = 6 + Math.floor(Math.random() * 4);
        const champ = h('input', { class: 'champ', inputmode: 'numeric', autocomplete: 'off', placeholder: 'Réponse' });
        const retour = () => (profil() ? ecranCarte() : ecranAccueil());
        const entrer = () => { if (Number(champ.value.trim()) === a * b) panneauParents(); else { champ.value = ''; champ.placeholder = 'Ce n\'est pas ça'; champ.focus(); } };
        champ.addEventListener('keydown', (e) => { if (e.key === 'Enter') entrer(); });
        afficher(h('h1', { text: '👪 Coin des parents' }),
            h('p', { text: 'Pour entrer, combien font ' + a + ' × ' + b + ' ?' }),
            champ,
            h('div', { class: 'actions' }, h('button', { class: 'btn secondaire', text: '← Retour', onclick: retour }), h('button', { class: 'btn', text: 'Entrer', onclick: entrer })));
        champ.focus();
        dire(P.parents);
    }
    function panneauParents() {
        const lignes = data.profils.map((p) => {
            const sel = h('select', { class: 'champ petit', onchange: () => { p.niveau = sel.value; sauver(); panneauParents(); } },
                NIVEAUX.map((n) => h('option', { value: n.id, selected: n.id === p.niveau, text: n.nom })));
            const reussies = Object.values(p.etapes).filter((r) => r.reussi).length;
            const voixActuelle = p.voix || (avatarDe(p.avatar) || {}).voix || 'Lady_Baguette';
            const selVoix = h('select', { class: 'champ petit', onchange: () => { p.voix = selVoix.value; sauver(); } },
                Object.entries(window.Prof.VOIX).map(([v, nom]) => h('option', { value: v, selected: v === voixActuelle, text: nom })));
            return h('div', { class: 'parent-joueur' },
                h('img', { src: vignette(p.avatar), alt: '' }),
                h('div', { class: 'pj-info' }, h('b', { text: p.pseudo }), h('span', { text: 'Niveau ' + niveauJoueur(p.xp) + ' · ' + p.xp + ' XP · ' + p.stats.series + ' séries · ' + p.stats.bonnes + ' bonnes réponses · ' + reussies + ' étape(s) réussie(s)' })),
                h('label', { class: 'pj-niv' }, 'Année scolaire ', sel),
                h('label', { class: 'pj-niv' }, 'Voix du prof ', selVoix),
                h('button', { class: 'btn petit danger', text: 'Effacer', onclick: () => {
                    if (!confirm('Effacer le joueur « ' + p.pseudo + ' » et toute sa progression ? On ne pourra pas revenir en arrière.')) return;
                    data.profils = data.profils.filter((x) => x !== p);
                    if (data.actif === p.id) data.actif = null;
                    sauver(); panneauParents();
                } }));
        });
        afficher(h('h1', { text: '👪 Coin des parents' }),
            lignes.length ? h('div', { class: 'parents' }, lignes) : h('p', { text: 'Aucun joueur pour l\'instant.' }),
            h('div', { class: 'ligne-son' }, h('span', { text: 'Voix du prof' }),
                h('button', { class: 'btn petit secondaire', text: window.Prof.sonActif() ? '🔊 Activée' : '🔇 Coupée', onclick: () => { window.Prof.son(!window.Prof.sonActif()); panneauParents(); } })),
            h('p', { class: 'note', text: 'Avatar Prof ne demande aucun nom, courriel ni adresse. La progression est gardée seulement sur cet appareil, dans le navigateur. Effacer les données du navigateur efface aussi la progression.' }),
            SEULEMENT_VERIFIES ? null : h('p', { class: 'note attention', text: 'Version de test : les exercices pas encore vérifiés sont affichés (étiquette « à vérifier »).' }),
            window.Prof.voixLocale() ? boutonVoix() : null,
            h('div', { class: 'actions' }, h('button', { class: 'btn', text: '← Retour', onclick: () => (profil() ? ecranCarte() : ecranAccueil()) })));
    }

    // ───────── préparer les voix d'avance (seulement sur le PC, avec outils/serveur.py) :
    // toutes les phrases fixes du prof + les questions VÉRIFIÉES. Les fichiers vont dans audio/ et seront publiés avec l'app.
    async function toutesLesPhrases() {
        const l = [...BRAVO, ...ENCORE];
        for (const [k, v] of Object.entries(P)) {
            if (typeof v === 'string') l.push(v);
            else if (NOMBRES_DITS[k]) for (const n of NOMBRES_DITS[k]) l.push(v(n));
            else for (const n of NIVEAUX) l.push(v(n));
        }
        for (let n = 1; n <= 20; n++) l.push(String(n));                       // le prof qui compte
        for (const le of Object.values(LECONS)) {
            l.push(le.truc);
            if (le.anim === 'syllabes') l.push(...le.exemple.split('-'));
        }
        for (const n of NIVEAUX) {
            for (const e of await exercices(n.id)) {
                if (e.verifie !== true) continue;
                l.push(e.consigne);
                if (e.indice) l.push(e.indice);
                if (e.explication) l.push(e.explication);
                const a = animDe(e);
                if (a && a.type === 'syllabes') l.push(...a.donnee.split('-'));
            }
        }
        return [...new Set(l.map((x) => String(x).trim()).filter(Boolean))];
    }
    function boutonVoix() {
        const etat = h('span', { class: 'note', text: '' });
        const b = h('button', { class: 'btn petit secondaire', text: '🎙️ Préparer les voix du prof', onclick: async () => {
            b.disabled = true;
            const phrases = await toutesLesPhrases();
            const l = Object.keys(window.Prof.VOIX).flatMap((v) => phrases.map((t) => [t, v]));   // chaque phrase dans les 2 voix
            let ok = 0;
            for (let i = 0; i < l.length; i++) {
                etat.textContent = 'Phrase ' + (i + 1) + ' sur ' + l.length + '…';
                if (await window.Prof.preparer(l[i][0], l[i][1])) ok++;
            }
            etat.textContent = ok + ' phrase(s) prêtes sur ' + l.length + ' (phrases du prof + questions vérifiées, dans les 2 voix).';
            b.disabled = false;
        } });
        return h('div', { class: 'ligne-son' }, b, etat);
    }

    // ───────── départ
    if (profil()) ecranCarte(); else ecranAccueil();
})();
