/*!
 * fa-updates — widget « dernières activités par section » pour Forumactif.
 *
 * Rien à régler ici : la configuration est dans config.js, les styles dans
 * config.css. Documentation complète : README.md.
 *
 * Licence MIT.
 */

(function (window, document) {
  'use strict';

  var VERSION = '0.2.0';

  var MON_URL = (document.currentScript && document.currentScript.src) || '';

  var DEFAUTS = {
    emplacement: { cible: '#fa-updates', position: 'fin' },
    classe: null,
    sections: [],
    nombre: 5,
    avatar: true,
    auteur: true,
    source: true,
    datesRelatives: true,
    masquerAutoBump: false,
    cache: 300,
    texteVide: 'rien de neuf par ici',
    texteInterdit: null,
    style: true,
    repliable: false,
    emplacementBascule: null,
    replieParDefaut: false,
    texteReplier: '×',
    texteDeplier: '✦',
    filtre: null,
    chargeur: null
  };

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
    if (texte != null) n.textContent = texte;
    return n;
  }

  function texteDe(node) {
    return node ? node.textContent.replace(/\s+/g, ' ').trim() : '';
  }

  var MOIS = {
    jan: 0, fév: 1, fev: 1, mar: 2, avr: 3, mai: 4, juin: 5,
    juil: 6, aoû: 7, aou: 7, sep: 8, oct: 9, nov: 10, déc: 11, dec: 11
  };

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
    var minuit = new Date(); minuit.setHours(0, 0, 0, 0);
    var d0 = new Date(date.getTime()); d0.setHours(0, 0, 0, 0);
    var j = Math.round((minuit - d0) / 86400000);
    if (j <= 1) return 'hier';
    if (j < 30) return 'il y a ' + j + ' jours';
    if (j < 365) return 'il y a ' + Math.floor(j / 30) + ' mois';
    return 'il y a ' + Math.floor(j / 365) + ' an' + (j >= 730 ? 's' : '');
  }

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

  function estInterdit(doc) {
    if (/^\s*connexion\s*$/i.test(doc.title || '')) return true;
    return !!doc.querySelector('input[name="password"], input[type="password"]');
  }

  function lirePageForum(html) {
    var doc = new DOMParser().parseFromString(html, 'text/html');
    if (estInterdit(doc)) return { interdit: true, sujets: [] };

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
        if (sec.sujets && sec.sujets.length) {
          var gardes = sec.sujets.map(function (v) {
            return String(v).replace(/^.*\/t(\d+).*$/, '$1');
          });
          sujets = sujets.filter(function (s) { return gardes.indexOf(s.id) !== -1; });
          sujets.sort(function (a, b) { return gardes.indexOf(a.id) - gardes.indexOf(b.id); });
        }
        if (sec.source === false) {
          sujets.forEach(function (s) { s.section = ''; });
        }
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

  function estLibre(sec) {
    return sec.html != null || (sec.liens && sec.liens.length);
  }

  function blocLibre(sec) {
    var box = el('section', 'fau fau-libre' + (sec.classe ? ' fau--' + sec.classe : ''));
    if (sec.titre) box.appendChild(el('h3', 'fau-entete', sec.titre));
    if (sec.soustitre) box.appendChild(el('p', 'fau-soustitre', sec.soustitre));

    if (sec.html) {
      var libre = el('div', 'fau-html');
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

  function poserStyle(cfg) {
    if (cfg.style === false) return;
    if (document.getElementById('fau-css')) return;
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

  function etiqueter(btn, val) {
    val = val == null ? '' : String(val);
    if (val.indexOf('<') !== -1) btn.innerHTML = val;
    else btn.textContent = val;
  }

  function poserBascule(racine, cfg) {
    var CLE = 'fau:replie';
    var replie;
    try {
      var v = localStorage.getItem(CLE);
      replie = v === null ? !!cfg.replieParDefaut : v === '1';
    } catch (e) { replie = !!cfg.replieParDefaut; }

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'fau-bascule';

    function appliquer() {
      racine.classList.toggle('fau-replie', replie);
      etiqueter(btn, replie ? cfg.texteDeplier : cfg.texteReplier);
      btn.setAttribute('aria-expanded', replie ? 'false' : 'true');
      btn.setAttribute('title', replie ? 'Afficher les dernières activités'
                                       : 'Masquer les dernières activités');
      btn.setAttribute('aria-label', btn.getAttribute('title'));
    }

    btn.addEventListener('click', function () {
      replie = !replie;
      try { localStorage.setItem(CLE, replie ? '1' : '0'); } catch (e) {}
      appliquer();
    });

    appliquer();

    var e = cfg.emplacementBascule;
    if (typeof e === 'string' || (e && e.nodeType)) e = { cible: e };
    var hote = e && (typeof e.cible === 'string' ? document.querySelector(e.cible) : e.cible);
    if (e && !hote && window.console) {
      console.warn('[fa-updates] emplacement du bouton introuvable :', e.cible,
                   '— il reste dans le widget.');
    }
    if (hote) {
      btn.className += ' fau-bascule--hors';
      var ancien = hote.querySelector('.fau-bascule');
      if (ancien) ancien.parentNode.removeChild(ancien);
      hote.insertAdjacentElement(POSITIONS[e.position] || 'beforeend', btn);
    } else {
      racine.appendChild(btn);
    }
  }

  function ancrer(cfg) {
    var e = cfg.emplacement;
    if (typeof e === 'string' || (e && e.nodeType)) e = { cible: e };
    e = e || {};
    var cible = typeof e.cible === 'string' ? document.querySelector(e.cible) : e.cible;
    if (!cible) {
      if (window.console) console.warn('[fa-updates] emplacement introuvable :', e.cible, "— rien n'a été affiché.");
      return null;
    }
    var ancien = cible.fauRacine;
    if (ancien && ancien.parentNode) ancien.parentNode.removeChild(ancien);

    var sup = cfg.classe
      ? ' ' + String(cfg.classe).trim().split(/\s+/).map(function (c) { return 'fau-' + c; }).join(' ')
      : '';
    var racine = el('div', 'fau-root' + sup);
    cible.insertAdjacentElement(POSITIONS[e.position] || 'beforeend', racine);
    cible.fauRacine = racine;
    return racine;
  }

  function init(config) {
    var cfg = fusion(DEFAUTS, config);
    poserStyle(cfg);

    var racine = ancrer(cfg);
    if (!racine) return Promise.resolve([]);

    var aLibre = cfg.sections.some(estLibre);
    var colonne = null;

    var taches = [];
    cfg.sections.forEach(function (sec) {
      if (estLibre(sec)) {
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

    if (cfg.repliable) poserBascule(racine, cfg);

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
