/*!
 * fa-updates — widget "dernières activités par section" pour Forumactif
 * -----------------------------------------------------------------------------
 * Rien à régler ici : la configuration est dans config.js, les styles dans
 * config.css. Ce fichier ne fait que lire le forum et fabriquer le widget.
 *
 * Affiche les N derniers sujets ayant reçu un message dans une ou plusieurs
 * sections précises (fiches de liens, activité rps, comptes insta, etc.).
 *
 * Fonctionne sans API ni service externe : le script tourne sur le forum, donc
 * fetch() est en same-origin et part avec la session du visiteur. Chacun ne voit
 * donc que ce qu'il a le droit de voir — aucune fuite de permissions.
 *
 * Deux sources, dans cet ordre :
 *   1. la page de la section (HTML) → titre, date, dernier posteur, avatar
 *   2. le flux /feed/?f=ID (RSS)    → titre, date, auteur du sujet (pas d'avatar)
 * La 2 sert de filet si le template du forum a des classes exotiques.
 *
 * Licence MIT.
 */
(function (window, document) {
  'use strict';

  var VERSION = '0.2.0';

  // Mémorisé tout de suite : plus tard, document.currentScript vaut null.
  var MON_URL = (document.currentScript && document.currentScript.src) || '';

  var DEFAUTS = {
    emplacement: { cible: '#fa-updates', position: 'fin' },
    classe: null,    // classe posée sur .fau-root ('cartes' → .fau-cartes)
    sections: [],
    nombre: 5,
    avatar: true,
    auteur: true,
    source: true,    // dans un encart fusionné, afficher la section d'origine
    datesRelatives: true,
    masquerAutoBump: false,
    cache: 300,
    texteVide: 'rien de neuf par ici',
    texteInterdit: null,
    style: true,
    filtre: null,
    chargeur: null   // remplace fetch (démo, tests)
  };

  /* ---------------------------------------------------------------- outils */

  function fusion() {
    var out = {}, i, k;
    for (i = 0; i < arguments.length; i++) {
      var src = arguments[i] || {};
      for (k in src) if (Object.prototype.hasOwnProperty.call(src, k)) out[k] = src[k];
    }
    return out;
  }

  function el(tag, cls, texte) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (texte != null) n.textContent = texte; // jamais d'innerHTML sur du contenu forum
    return n;
  }

  function texteDe(node) {
    return node ? node.textContent.replace(/\s+/g, ' ').trim() : '';
  }

  var MOIS = {
    jan: 0, fév: 1, fev: 1, mar: 2, avr: 3, mai: 4, juin: 5,
    juil: 6, aoû: 7, aou: 7, sep: 8, oct: 9, nov: 10, déc: 11, dec: 11
  };

  // "Mer 21 Aoû 2024 - 20:45" / "Aujourd'hui à 8:24" / "Hier à 23:10"
  function dateFr(txt) {
    if (!txt) return null;
    var s = txt.replace(/\s+/g, ' ').trim();
    var hm = s.match(/(\d{1,2})\s*:\s*(\d{2})/);
    var h = hm ? +hm[1] : 0, mn = hm ? +hm[2] : 0;

    if (/aujourd/i.test(s)) { var a = new Date(); a.setHours(h, mn, 0, 0); return a; }
    if (/hier/i.test(s))    { var b = new Date(); b.setDate(b.getDate() - 1); b.setHours(h, mn, 0, 0); return b; }

    var m = s.match(/(\d{1,2})\s+([A-Za-zÀ-ÿ]+)\.?\s+(\d{4})/);
    if (!m) return null;
    var mois = MOIS[m[2].slice(0, 4).toLowerCase()];
    if (mois == null) mois = MOIS[m[2].slice(0, 3).toLowerCase()];
    if (mois == null) return null;
    return new Date(+m[3], mois, +m[1], h, mn);
  }

  function relatif(date, brut) {
    if (!date || isNaN(+date)) return brut || '';
    var sec = (Date.now() - date.getTime()) / 1000;
    if (sec < 60) return "à l'instant";
    if (sec < 3600) return 'il y a ' + Math.floor(sec / 60) + ' min';
    if (sec < 86400) return 'il y a ' + Math.floor(sec / 3600) + ' h';
    // au-delà de 24 h on compte en jours de calendrier, pas en tranches de 24 h,
    // sinon avant-hier 18h s'affiche "hier"
    var minuit = new Date(); minuit.setHours(0, 0, 0, 0);
    var d0 = new Date(date.getTime()); d0.setHours(0, 0, 0, 0);
    var j = Math.round((minuit - d0) / 86400000);
    if (j <= 1) return 'hier';
    if (j < 30) return 'il y a ' + j + ' jours';
    if (j < 365) return 'il y a ' + Math.floor(j / 30) + ' mois';
    return 'il y a ' + Math.floor(j / 365) + ' an' + (j >= 730 ? 's' : '');
  }

  /* ---------------------------------------------------------------- réseau */

  function charger(url, cfg) {
    if (cfg.chargeur) return Promise.resolve(cfg.chargeur(url));
    return fetch(url, { credentials: 'same-origin' }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status + ' sur ' + url);
      return r.text();
    });
  }

  function cacheLire(cle, cfg) {
    if (!cfg.cache) return null;
    try {
      var brut = sessionStorage.getItem('fau:' + cle);
      if (!brut) return null;
      var o = JSON.parse(brut);
      if (Date.now() - o.t > cfg.cache * 1000) return null;
      return o.d;
    } catch (e) { return null; }
  }

  function cacheEcrire(cle, data, cfg) {
    if (!cfg.cache) return;
    try { sessionStorage.setItem('fau:' + cle, JSON.stringify({ t: Date.now(), d: data })); } catch (e) {}
  }

  /* --------------------------------------------------------------- lecture */

  // Page de connexion servie à la place de la section → accès refusé
  function estInterdit(doc) {
    if (/^\s*connexion\s*$/i.test(doc.title || '')) return true;
    return !!doc.querySelector('input[name="password"], input[type="password"]');
  }

  function lirePageForum(html) {
    var doc = new DOMParser().parseFromString(html, 'text/html');
    if (estInterdit(doc)) return { interdit: true, sujets: [] };

    // les liens de sujets, quel que soit le template
    var liens = [].slice.call(doc.querySelectorAll('a.topictitle, a[href*="/t"]'))
      .filter(function (a) {
        var h = a.getAttribute('href') || '';
        return /\/t\d+(p\d+)?-/.test(h) && h.indexOf('#') === -1 && texteDe(a).length > 1;
      });

    var vus = {}, sujets = [];
    liens.forEach(function (a) {
      var href = a.getAttribute('href').split('#')[0];
      var id = (href.match(/\/t(\d+)/) || [])[1];
      if (!id || vus[id]) return;
      vus[id] = 1;

      var ligne = a.closest('tr, li, .topic, .topics, [class*="row"]') || a.parentElement;

      // l'ancre "voir le dernier message" (…/t123-sujet#456) donne l'id du dernier
      // post : incrémental et global, donc tri exact sans avoir à parser de date,
      // et les post-it épinglés retombent d'eux-mêmes à leur vraie place
      var dernierId = 0;
      [].forEach.call(ligne.querySelectorAll('a[href*="#"]'), function (l) {
        var m = (l.getAttribute('href') || '').match(/#(\d+)\s*$/);
        if (m && +m[1] > dernierId) dernierId = +m[1];
      });

      var noeudDate = ligne.querySelector('.timeposte, .lastpost-date, .topicdetails.date');
      var blocDernier = ligne.querySelector('.topicslist-lastpost, .lastpost, .lastpost-avatar');
      var txtDernier = texteDe(blocDernier);
      var txtDate = texteDe(noeudDate);
      if (!txtDate && txtDernier) txtDate = (txtDernier.match(/.*\d{1,2}\s*:\s*\d{2}/) || [''])[0];
      // le bloc "dernier message" = date + pseudo ; on retire la date
      var posteur = txtDernier && txtDate ? txtDernier.replace(txtDate, '').trim() : '';
      posteur = posteur.replace(/^par\s+/i, '').replace(/\s*voir le dernier message\s*$/i, '').trim();

      var img = ligne.querySelector(
        '.topicslist-avatar-lastpost img, .lastpostavatar img, .lastpost img[alt*="avatar" i], td:last-child img'
      );
      var avatar = img && !/icon_topic|empty\.gif|spacer/.test(img.getAttribute('src') || '')
        ? img.getAttribute('src') : '';

      sujets.push({
        id: id,
        titre: texteDe(a),
        url: href + (dernierId ? '#' + dernierId : ''),
        auteur: texteDe(ligne.querySelector('.authorlist, .author')) || '',
        posteur: posteur,
        avatar: avatar,
        dateTxt: txtDate,
        date: dateFr(txtDate),
        ordre: dernierId,
        source: 'html'
      });
    });

    return { interdit: false, nom: (doc.title || '').trim(), sujets: sujets };
  }

  function lireFlux(xml, forumId) {
    var doc = new DOMParser().parseFromString(xml, 'text/xml');
    var lienCanal = texteDe(doc.querySelector('channel > link'));
    // Quand la section est visible, <channel><link> pointe sur elle
    // (…/f12-fiches-de-liens). Quand elle ne l'est pas, Forumactif ignore
    // le ?f= et renvoie le flux global, avec un link en …/feed/?f=12 : on refuse,
    // sinon le widget "fiches de liens" afficherait des sujets au hasard.
    if (forumId && !new RegExp('/f' + forumId + '(?![0-9])').test(lienCanal)) {
      return { interdit: true, sujets: [] };
    }

    var sujets = [].map.call(doc.querySelectorAll('item'), function (it, i) {
      var lien = texteDe(it.querySelector('link'));
      var d = new Date(texteDe(it.querySelector('pubDate')));
      return {
        id: (lien.match(/\/t(\d+)/) || [])[1] || String(i),
        titre: texteDe(it.querySelector('title')),
        url: lien,
        // dc:creator = celui qui a ouvert le sujet, pas le dernier posteur
        auteur: texteDe(it.getElementsByTagName('dc:creator')[0]),
        posteur: '',
        avatar: '',
        dateTxt: '',
        date: isNaN(+d) ? null : d,
        ordre: isNaN(+d) ? 0 : d.getTime(),
        source: 'rss'
      };
    });
    var cat = doc.querySelector('item > category');
    return { interdit: false, nom: cat ? texteDe(cat) : '', sujets: sujets };
  }

  /* ------------------------------------------------------------ chargement */

  // Un encart peut fusionner plusieurs sections : on les charge toutes, on
  // concatène, et le tri par id de dernier message remet tout dans l'ordre.
  function chargerFusion(sec, cfg) {
    return Promise.all(sec.sources.map(function (src) {
      return chargerUne(src, cfg);
    })).then(function (parts) {
      var sujets = [];
      parts.forEach(function (p, i) {
        p.sujets.forEach(function (s) {
          s.section = sec.sources[i].titre || p.nom || '';
          sujets.push(s);
        });
      });
      // interdit seulement si AUCUNE des sections n'est lisible
      return { interdit: parts.every(function (p) { return p.interdit; }), sujets: sujets };
    });
  }

  function chargerUne(sec, cfg) {
    var url = sec.url || ('/f' + sec.forum + '-');

    return charger(url, cfg)
      .then(function (html) {
        var r = lirePageForum(html);
        if (!r.interdit && r.sujets.length) return r;
        if (!sec.forum) return r;
        // filet : le flux RSS, indépendant du template
        return charger('/feed/?f=' + sec.forum, cfg).then(function (xml) {
          return lireFlux(xml, sec.forum);
        });
      })
      .catch(function (e) {
        if (window.console) console.warn('[fa-updates]', sec.titre || sec.forum, e);
        return { interdit: false, erreur: true, sujets: [] };
      });
  }

  function chargerSection(sec, cfg) {
    var cle = (sec.sources ? sec.sources.map(function (s) { return s.forum; }).join('+')
                           : (sec.forum || sec.url)) + ':' + (sec.nombre || cfg.nombre);
    var enCache = cacheLire(cle, cfg);
    if (enCache) return Promise.resolve(enCache);

    return (sec.sources ? chargerFusion(sec, cfg) : chargerUne(sec, cfg))
      .then(function (r) {
        var sujets = r.sujets.slice();
        if (cfg.masquerAutoBump) {
          sujets = sujets.filter(function (s) {
            return !(s.source === 'html' && s.posteur && s.auteur && s.posteur === s.auteur);
          });
        }
        // liste blanche : ne garder que des sujets choisis, par leur id
        if (sec.sujets && sec.sujets.length) {
          var gardes = sec.sujets.map(function (v) {
            return String(v).replace(/^.*\/t(\d+).*$/, '$1');
          });
          sujets = sujets.filter(function (s) { return gardes.indexOf(s.id) !== -1; });
          sujets.sort(function (a, b) { return gardes.indexOf(a.id) - gardes.indexOf(b.id); });
        }
        // sujets à écarter, par id (utile quand ils sont déjà dans un autre encart)
        if (sec.exclure && sec.exclure.length) {
          var horsJeu = sec.exclure.map(function (v) {
            return String(v).replace(/^.*\/t(\d+).*$/, '$1');
          });
          sujets = sujets.filter(function (s) { return horsJeu.indexOf(s.id) === -1; });
        }
        if (typeof cfg.filtre === 'function') {
          sujets = sujets.filter(function (s) { return cfg.filtre(s, sec); });
        }
        if (!(sec.sujets && sec.sujets.length)) {
          sujets.sort(function (a, b) { return b.ordre - a.ordre; });
        }
        var res = {
          interdit: r.interdit,
          sujets: sujets.slice(0, sec.sujets ? sec.sujets.length : (sec.nombre || cfg.nombre))
        };
        cacheEcrire(cle, res, cfg);
        return res;
      })
      .catch(function (e) {
        if (window.console) console.warn('[fa-updates]', sec.titre || sec.forum, e);
        return { interdit: false, erreur: true, sujets: [] };
      });
  }

  /* ------------------------------------------------------------- affichage */

  function encart(sec, cfg) {
    var box = el('section', 'fau fau--attente' + (sec.classe ? ' fau--' + sec.classe : ''));
    if (sec.forum) box.setAttribute('data-fau', String(sec.forum));
    if (sec.titre) box.appendChild(el('h3', 'fau-entete', sec.titre));
    var ul = el('ul', 'fau-liste');
    for (var i = 0; i < (sec.nombre || cfg.nombre); i++) {
      ul.appendChild(el('li', 'fau-entree fau-fantome'));
    }
    box.appendChild(ul);
    return box;
  }

  // Un encart qui ne lit pas le forum : du texte libre et des boutons vers des
  // sujets choisis. Reconnu à la présence de "html" ou de "liens".
  function estLibre(sec) {
    return sec.html != null || (sec.liens && sec.liens.length);
  }

  function blocLibre(sec) {
    var box = el('section', 'fau fau-libre' + (sec.classe ? ' fau--' + sec.classe : ''));
    if (sec.titre) box.appendChild(el('h3', 'fau-entete', sec.titre));
    if (sec.soustitre) box.appendChild(el('p', 'fau-soustitre', sec.soustitre));

    if (sec.html) {
      var libre = el('div', 'fau-html');
      // Seul endroit du plugin où l'on écrit du HTML tel quel : ce texte vient
      // de config.js, écrit par l'admin du forum — jamais du contenu récupéré.
      libre.innerHTML = sec.html;
      box.appendChild(libre);
    }

    if (sec.liens && sec.liens.length) {
      var ul = el('ul', 'fau-boutons');
      sec.liens.forEach(function (l) {
        var li = el('li', 'fau-entree');
        var a = el('a', 'fau-lien fau-bouton');
        a.href = l.url || '#';
        var corps = el('span', 'fau-corps');
        corps.appendChild(el('span', 'fau-sujet', l.texte || ''));
        if (l.detail) corps.appendChild(el('span', 'fau-meta', l.detail));
        a.appendChild(corps);
        li.appendChild(a);
        ul.appendChild(li);
      });
      box.appendChild(ul);
    }
    return box;
  }

  function entree(s, cfg) {
    var li = el('li', 'fau-entree');
    var a = el('a', 'fau-lien');
    a.href = s.url;

    if (cfg.avatar) {
      var ava = el('span', 'fau-avatar');
      if (s.avatar) {
        var img = document.createElement('img');
        img.src = s.avatar;
        img.alt = '';
        img.loading = 'lazy';
        ava.appendChild(img);
      } else {
        ava.className += ' fau-avatar--vide';
        ava.textContent = (s.posteur || s.auteur || '?').charAt(0).toUpperCase();
      }
      a.appendChild(ava);
    }

    var corps = el('span', 'fau-corps');
    corps.appendChild(el('span', 'fau-sujet', s.titre));

    var meta = el('span', 'fau-meta');
    var quand = cfg.datesRelatives
      ? relatif(s.date, s.dateTxt)
      : (s.dateTxt || (s.date ? s.date.toLocaleString('fr-FR') : ''));
    if (quand) meta.appendChild(el('span', 'fau-date', quand));
    var qui = s.source === 'html' ? s.posteur : '';
    if (cfg.auteur && qui) {
      meta.appendChild(el('span', 'fau-sep', '·'));
      meta.appendChild(el('span', 'fau-qui', qui));
    }
    // encart fusionné : d'où vient ce sujet
    if (cfg.source !== false && s.section) {
      meta.appendChild(el('span', 'fau-sep', '·'));
      meta.appendChild(el('span', 'fau-section', s.section));
    }
    if (meta.childNodes.length) corps.appendChild(meta);

    a.appendChild(corps);
    li.appendChild(a);
    return li;
  }

  function remplir(box, res, sec, cfg) {
    box.className = box.className.replace(' fau--attente', '');
    var ul = box.querySelector('.fau-liste');
    ul.textContent = '';

    if (res.interdit) {
      if (!cfg.texteInterdit) { if (box.parentNode) box.parentNode.removeChild(box); return; }
      ul.appendChild(el('li', 'fau-entree fau-vide', cfg.texteInterdit));
      return;
    }
    if (!res.sujets.length) {
      ul.appendChild(el('li', 'fau-entree fau-vide', cfg.texteVide));
      return;
    }
    res.sujets.forEach(function (s) { ul.appendChild(entree(s, cfg)); });
    if (res.sujets[0].source === 'rss') box.className += ' fau--rss';
  }

  /* ------------------------------------------------------- style & ancrage */

  function poserStyle(cfg) {
    if (cfg.style === false) return;
    if (document.getElementById('fau-css')) return; // déjà là (ou embarquée)
    var href = typeof cfg.style === 'string' ? cfg.style : MON_URL.replace(/\.js(\?.*)?$/, '.css');
    if (!href || href === MON_URL) {
      if (window.console) console.warn('[fa-updates] feuille de style introuvable : ajouter fa-updates.css à la main, ou renseigner style: "<adresse>" dans config.js.');
      return;
    }
    var l = document.createElement('link');
    l.id = 'fau-css';
    l.rel = 'stylesheet';
    l.href = href;
    document.head.appendChild(l);
  }

  var POSITIONS = { debut: 'afterbegin', fin: 'beforeend', avant: 'beforebegin', apres: 'afterend' };

  function ancrer(cfg) {
    var e = cfg.emplacement;
    if (typeof e === 'string' || (e && e.nodeType)) e = { cible: e };
    e = e || {};
    var cible = typeof e.cible === 'string' ? document.querySelector(e.cible) : e.cible;
    if (!cible) {
      if (window.console) console.warn('[fa-updates] emplacement introuvable :', e.cible, "— rien n'a été affiché.");
      return null;
    }
    // le widget s'ajoute, il ne remplace jamais le contenu de la cible.
    // On ne retire que le widget déjà posé sur CETTE cible : plusieurs widgets
    // peuvent coexister sur la même page.
    var ancien = cible.fauRacine;
    if (ancien && ancien.parentNode) ancien.parentNode.removeChild(ancien);

    // classe: 'cartes' → .fau-cartes ; plusieurs noms séparés par un espace
    var sup = cfg.classe
      ? ' ' + String(cfg.classe).trim().split(/\s+/).map(function (c) { return 'fau-' + c; }).join(' ')
      : '';
    var racine = el('div', 'fau-root' + sup);
    cible.insertAdjacentElement(POSITIONS[e.position] || 'beforeend', racine);
    cible.fauRacine = racine;
    return racine;
  }

  /* ------------------------------------------------------------------ API */

  function init(config) {
    var cfg = fusion(DEFAUTS, config);
    poserStyle(cfg);

    var racine = ancrer(cfg);
    if (!racine) return Promise.resolve([]);

    // S'il y a un encart libre, les encarts lus sont groupés dans une colonne :
    // sans ça, la grille aligne chaque encart sur l'encart libre et creuse un
    // blanc sous le premier d'entre eux.
    var aLibre = cfg.sections.some(estLibre);
    var colonne = null;

    var taches = [];
    cfg.sections.forEach(function (sec) {
      if (estLibre(sec)) {           // encart de texte : rien à aller chercher
        racine.appendChild(blocLibre(sec));
        return;
      }
      if (aLibre && !colonne) {
        colonne = el('div', 'fau-colonne');
        racine.appendChild(colonne);
      }
      var boite = encart(sec, cfg);
      (colonne || racine).appendChild(boite);
      taches.push(chargerSection(sec, cfg).then(function (res) {
        remplir(boite, res, sec, cfg);
        res.titre = sec.titre;
        return res;
      }));
    });

    return Promise.all(taches);
  }

  function viderCache() {
    try {
      Object.keys(sessionStorage).forEach(function (k) {
        if (k.indexOf('fau:') === 0) sessionStorage.removeItem(k);
      });
    } catch (e) {}
  }

  window.FAUpdates = {
    version: VERSION,
    init: init,
    rafraichir: function (cfg) { viderCache(); return init(cfg || window.FA_UPDATES_CONFIG); },
    viderCache: viderCache,
    _lirePageForum: lirePageForum,
    _lireFlux: lireFlux,
    _dateFr: dateFr
  };

  if (window.FA_UPDATES_CONFIG && !window.FA_UPDATES_CONFIG.manuel) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () { init(window.FA_UPDATES_CONFIG); });
    } else {
      init(window.FA_UPDATES_CONFIG);
    }
  }
})(window, document);

/* --- fa-updates.css, embarquée pour que le test se suffise à lui-même --- */
(function () {
  if (document.getElementById('fau-css')) return;
  var s = document.createElement('style');
  s.id = 'fau-css';
  s.textContent = "/* =============================================================================\n *  fa-updates \u2014 structure\n *  -----------------------------------------------------------------------------\n *  Ce fichier ne contient que de la mise en page. Tous les r\u00e9glages (couleurs,\n *  tailles, colonnes, arrondis\u2026) sont des variables, et se modifient dans\n *  config.css \u2014 pas ici.\n *\n *  Rep\u00e8res pour habiller :\n *    .fau-root                 le conteneur de tous les encarts\n *    .fau                      un encart      (+ .fau--<classe>, [data-fau=\"12\"])\n *    .fau-entete               son titre\n *    .fau-liste                la liste des sujets\n *    .fau-entree               un sujet\n *    .fau-lien                   > le lien cliquable\n *    .fau-avatar                 > l'avatar du dernier posteur\n *    .fau-sujet                  > le titre du sujet\n *    .fau-meta                   > la ligne date \u00b7 pseudo\n *    .fau-colonne              regroupe les encarts lus quand il y a un encart\n *                              libre, pour les mettre en colonne \u00e0 c\u00f4t\u00e9 de lui\n *    .fau-libre                un encart de texte libre, avec :\n *      .fau-soustitre            > sa ligne de sous-titre\n *      .fau-html                 > le bloc de texte\n *      .fau-boutons / .fau-bouton  > les liens vers des sujets\n *    .fau-vide                 le message quand il n'y a rien\n *    .fau--attente             l'encart pendant le chargement\n * ========================================================================== */\n\n:root {\n  --fau-largeur: auto;\n  --fau-colonnes: 1;\n  --fau-espacement: 4px;\n  --fau-espacement-encarts: 14px;\n\n  --fau-fond: transparent;\n  --fau-fond-survol: transparent;\n  --fau-bordure: color-mix(in srgb, currentColor 14%, transparent);\n  --fau-bordure-survol: color-mix(in srgb, currentColor 35%, transparent);\n  --fau-arrondi: 6px;\n  --fau-padding: 6px 8px;\n  --fau-glissement: 2px;\n  --fau-transition: .18s;\n\n  --fau-avatar-taille: 26px;\n  --fau-avatar-arrondi: 50%;\n  --fau-avatar-fond: color-mix(in srgb, currentColor 10%, transparent);\n\n  --fau-titre-taille: 11px;\n  --fau-titre-graisse: 600;\n  --fau-titre-casse: uppercase;\n  --fau-titre-interligne: .3px;\n\n  --fau-meta-taille: 9px;\n  --fau-meta-casse: uppercase;\n  --fau-meta-opacite: .6;\n\n  --fau-entete-taille: 11px;\n  --fau-entete-casse: uppercase;\n  --fau-entete-interligne: 1px;\n  --fau-entete-opacite: .75;\n  --fau-entete-marge: 0 0 6px;\n\n  --fau-couleur: inherit;\n}\n\n.fau-root {\n  display: flex;\n  flex-direction: column;\n  gap: var(--fau-espacement-encarts);\n  width: var(--fau-largeur);\n  color: var(--fau-couleur);\n}\n\n.fau { margin: 0; min-width: 0; }\n\n.fau-colonne {\n  display: flex;\n  flex-direction: column;\n  gap: var(--fau-espacement-encarts);\n  min-width: 0;\n}\n\n.fau-entete {\n  margin: var(--fau-entete-marge);\n  font-size: var(--fau-entete-taille);\n  letter-spacing: var(--fau-entete-interligne);\n  text-transform: var(--fau-entete-casse);\n  opacity: var(--fau-entete-opacite);\n  font-weight: inherit;\n}\n\n.fau-liste {\n  list-style: none;\n  margin: 0;\n  padding: 0;\n  display: grid;\n  grid-template-columns: repeat(var(--fau-colonnes), minmax(0, 1fr));\n  gap: var(--fau-espacement);\n}\n\n.fau-entree { margin: 0; padding: 0; min-width: 0; }\n\n.fau-lien {\n  display: flex;\n  align-items: center;\n  gap: 8px;\n  padding: var(--fau-padding);\n  background: var(--fau-fond);\n  border: 1px solid var(--fau-bordure);\n  border-radius: var(--fau-arrondi);\n  text-decoration: none;\n  color: inherit;\n  transition: var(--fau-transition);\n}\n\n.fau-lien:hover {\n  background: var(--fau-fond-survol);\n  border-color: var(--fau-bordure-survol);\n  transform: translateX(var(--fau-glissement));\n}\n\n.fau-avatar {\n  flex: 0 0 auto;\n  width: var(--fau-avatar-taille);\n  height: var(--fau-avatar-taille);\n  border-radius: var(--fau-avatar-arrondi);\n  overflow: hidden;\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  font-size: calc(var(--fau-avatar-taille) * .42);\n  background: var(--fau-avatar-fond);\n}\n\n.fau-avatar img { width: 100%; height: 100%; object-fit: cover; display: block; }\n\n.fau-corps { min-width: 0; display: flex; flex-direction: column; gap: 1px; }\n\n.fau-sujet {\n  font-size: var(--fau-titre-taille);\n  font-weight: var(--fau-titre-graisse);\n  letter-spacing: var(--fau-titre-interligne);\n  text-transform: var(--fau-titre-casse);\n  white-space: nowrap;\n  overflow: hidden;\n  text-overflow: ellipsis;\n}\n\n.fau-meta {\n  display: flex;\n  gap: 4px;\n  font-size: var(--fau-meta-taille);\n  text-transform: var(--fau-meta-casse);\n  letter-spacing: .5px;\n  opacity: var(--fau-meta-opacite);\n}\n\n.fau-qui { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }\n\n.fau-vide {\n  padding: var(--fau-padding);\n  font-size: calc(var(--fau-titre-taille) - 1px);\n  font-style: italic;\n  opacity: .6;\n}\n\n/* --- encart libre : texte + boutons ---------------------------------------- */\n.fau-soustitre {\n  margin: 0 0 8px;\n  font-size: var(--fau-soustitre-taille, 9px);\n  letter-spacing: 1px;\n  text-transform: uppercase;\n  opacity: .6;\n}\n\n.fau-html {\n  font-size: var(--fau-texte-taille, 11px);\n  line-height: 1.65;\n}\n\n.fau-html p { margin: 0 0 8px; }\n.fau-html p:last-child { margin-bottom: 0; }\n\n.fau-boutons {\n  list-style: none;\n  margin: 10px 0 0;\n  padding: 0;\n  display: flex;\n  flex-direction: column;\n  gap: var(--fau-espacement);\n}\n\n.fau-bouton::after {\n  content: var(--fau-fleche, '\u2192');\n  margin-left: auto;\n  padding-left: 8px;\n  flex: 0 0 auto;\n}\n\n/* chargement */\n.fau-fantome {\n  height: calc(var(--fau-avatar-taille) + 12px);\n  border-radius: var(--fau-arrondi);\n  background: color-mix(in srgb, currentColor 8%, transparent);\n  animation: fau-pulse 1.2s ease-in-out infinite;\n}\n\n@keyframes fau-pulse { 0%, 100% { opacity: .35 } 50% { opacity: .7 } }\n\n@media (prefers-reduced-motion: reduce) {\n  .fau-lien { transition: none }\n  .fau-lien:hover { transform: none }\n  .fau-fantome { animation: none }\n}\n";
  document.head.appendChild(s);
})();

/* ===========================================================================
 * Bout de test, ajouté à la suite du plugin pour produire console-test.js.
 * Ne fait pas partie du plugin : à coller dans la console d'un forum, connecté.
 * Adapter SECTIONS à son propre forum.
 * =========================================================================== */
(function () {
  var SECTIONS = [
    { titre: 'fiches de liens', forum: 12, url: '/f12-fiches-de-liens', classe: 'liens' },
    { titre: 'activité rps', forum: 13, url: '/f13-activite-rps', nombre: 3, classe: 'rps' }
  ];

  var vieux = document.getElementById('test-fau');
  if (vieux) vieux.remove();

  var panneau = document.createElement('div');
  panneau.id = 'test-fau';
  panneau.style.cssText = 'position:fixed;top:10px;right:10px;width:320px;max-height:90vh;overflow:auto;'
    + 'z-index:99999;background:#14141c;color:#ddd;padding:14px;border-radius:10px;'
    + 'box-shadow:0 8px 30px rgba(0,0,0,.5);font-family:Trebuchet MS,sans-serif';
  var fermer = document.createElement('div');
  fermer.textContent = '× fermer le test';
  fermer.style.cssText = 'cursor:pointer;font-size:10px;opacity:.5;text-align:right;margin-bottom:8px';
  fermer.onclick = function () { panneau.remove(); };
  panneau.appendChild(fermer);
  document.body.appendChild(panneau);

  FAUpdates.init({
    emplacement: panneau,          // un élément convient aussi bien qu'un sélecteur
    cache: 0,
    style: false,                  // la feuille est déjà embarquée dans ce fichier
    texteInterdit: '⛔ section inaccessible (ou template non lu)',
    sections: SECTIONS
  }).then(function (res) {
    console.log('%c[fa-updates] résultat', 'font-weight:bold', res);
    res.forEach(function (r, i) {
      console.log('— ' + (SECTIONS[i] && SECTIONS[i].titre) + ' : '
        + (r.interdit ? 'INACCESSIBLE' : r.sujets.length + ' entrées'));
      if (r.sujets.length) console.table(r.sujets.map(function (s) {
        return { titre: s.titre, posteur: s.posteur, date: s.dateTxt, avatar: !!s.avatar, ordre: s.ordre, source: s.source };
      }));
    });
  });

  // Dump d'une ligne de sujet brute : utile pour adapter le plugin à un template
  // exotique, ou pour repérer comment le forum marque les sujets non lus.
  fetch(SECTIONS[0].url, { credentials: 'same-origin' })
    .then(function (r) { return r.text(); })
    .then(function (html) {
      var d = new DOMParser().parseFromString(html, 'text/html');
      var a = d.querySelector('a.topictitle');
      if (!a) return console.warn('[fa-updates] aucune ligne de sujet lisible (page Connexion ?) — titre :', d.title);
      var ligne = a.closest('tr, li') || a.parentElement;
      console.log('%c[fa-updates] HTML brut d\'une ligne de sujet :', 'font-weight:bold');
      console.log(ligne.outerHTML.replace(/\s+/g, ' '));
    });
})();
