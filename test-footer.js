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
