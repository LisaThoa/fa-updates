/* =============================================================================
 *  fa-updates — CONFIGURATION
 *  -----------------------------------------------------------------------------
 *  C'est le SEUL fichier à modifier. Rien à toucher dans fa-updates.js.
 *  Les couleurs et la disposition se règlent de leur côté dans config.css.
 *
 *  À charger AVANT le plugin :
 *    <script src=".../config.js"></script>
 *    <script src=".../fa-updates.js"></script>
 * ========================================================================== */

window.FA_UPDATES_CONFIG = {

  /* ---------------------------------------------------------------------------
   *  1. OÙ placer le widget dans la page
   * -------------------------------------------------------------------------
   *  cible    : le sélecteur d'un élément qui existe déjà dans ton forum.
   *             Pour le trouver : clic droit sur l'endroit voulu → Inspecter.
   *             Ex. '#page-body', '.headerbar', '#mon-div-a-moi'
   *  position : où se pose le widget PAR RAPPORT à cette cible —
   *             'fin'   → dernier enfant de la cible   (défaut)
   *             'debut' → premier enfant de la cible
   *             'avant' → juste au-dessus de la cible
   *             'apres' → juste en dessous de la cible
   *
   *  Le widget ne remplace jamais le contenu de la cible : il s'ajoute.
   *  Raccourci : emplacement: '#mon-div'  équivaut à { cible: '#mon-div' }.
   */
  emplacement: {
    cible: '#fa-updates',
    position: 'fin'
  },

  /*  Thème : pose une classe sur le conteneur du widget.
   *  'cartes' → .fau-cartes, habillé par themes/cartes.css (à charger aussi) :
   *  barre de titre colorée, pastilles claires sur deux colonnes, avatar à
   *  droite. Plusieurs noms possibles, séparés par un espace :
   *  'cartes cartes-sombre' pour la déclinaison sombre du même thème.
   *  null = pas de thème, on habille tout depuis config.css.
   */
  classe: null,

  /* ---------------------------------------------------------------------------
   *  2. QUOI afficher
   * -------------------------------------------------------------------------
   *  Une entrée par encart. Pour chaque section du forum à suivre :
   *    titre  : ce qui s'affiche au-dessus de l'encart (null = pas de titre)
   *    forum  : l'id numérique de la section
   *    url    : l'adresse de la section
   *    nombre : combien de sujets (sinon celui réglé plus bas)
   *    classe : une classe CSS en plus, pour habiller cet encart à part
   *             (→ .fau--liens dans config.css)
   *
   *  Les deux se lisent dans le lien de la section. Pour une section dont
   *  l'adresse est  monforum.forumactif.com/f12-fiches-de-liens  :
   *      forum : 12                       le nombre qui suit le « f »
   *      url   : '/f12-fiches-de-liens'   tout ce qui suit le nom de domaine
   */
  sections: [
    {
      titre: 'fiches de liens',
      forum: 12,
      url: '/f12-fiches-de-liens',
      classe: 'liens'
    },
    {
      titre: 'activité rps',
      forum: 13,
      url: '/f13-activite-rps',
      nombre: 3,
      classe: 'rps'
    }
    // { titre: 'instagram', forum: 14, url: '/f14-instagram' },
    // { titre: 'journaux',  forum: 15, url: '/f15-journaux' },

    /* Un encart qui FUSIONNE plusieurs sections en une seule liste, remise dans
     * l'ordre chronologique. Pratique pour une rubrique générale. */
    // {
    //   titre: 'recherches',
    //   nombre: 6,
    //   sources: [
    //     { forum: 16, url: '/f16-recherche-de-liens', titre: 'liens' },
    //     { forum: 17, url: '/f17-recherche-de-rp',    titre: 'rps' }
    //   ]
    // },

    /* Un encart qui suit des SUJETS précis plutôt qu'une section entière : on
     * donne leurs ids (ou leurs adresses), et ils gardent l'ordre indiqué.
     * Les sujets doivent se trouver sur la première page de leur section —
     * c'est le cas des post-it, donc des sujets « recherche » et « flood ». */
    // {
    //   titre: 'les incontournables',
    //   url: '/f12-fiches-de-liens',
    //   sujets: [1234, 5678, '/t91-flood-des-liens']
    // },

    /* "exclure" fait l'inverse : il écarte des sujets d'un encart. Pratique
     * quand ils sont déjà mis en avant dans un autre. */
    // { titre: 'liens', url: '/f12-fiches-de-liens', exclure: [1234, 5678] },

    /* Un encart LIBRE : pas de section lue, juste du texte à soi et des liens
     * vers des sujets importants. Reconnu à la présence de "html" ou "liens".
     * Le thème « cartes » le place en colonne de gauche.
     *
     *   titre / soustitre : les deux lignes de titre
     *   html  : ton texte, en HTML (c'est le tien, il est inséré tel quel)
     *   liens : les boutons, { texte, url, detail }
     */
    // {
    //   classe: 'intro',
    //   titre: 'le mot du staff',
    //   soustitre: 'can you keep it ?',
    //   html: '<p>Ce que vous voulez écrire ici. <b>Gras</b>, liens, etc.</p>',
    //   liens: [
    //     { texte: 'les rumeurs', url: '/t1-les-rumeurs' },
    //     { texte: 'membres en danger', url: '/t2-membres-en-danger', detail: 'mis à jour' }
    //   ]
    // }
  ],

  /* ---------------------------------------------------------------------------
   *  3. RÉGLAGES
   * ------------------------------------------------------------------------- */

  nombre: 5,              // sujets affichés par encart
  avatar: true,           // afficher l'avatar du dernier posteur
  auteur: true,           // afficher le pseudo du dernier posteur
  datesRelatives: true,   // 'il y a 2 h' plutôt que 'Mar 22 Sep 2026 - 14:02'
  masquerAutoBump: false, // true = ignorer les sujets remontés par leur propre auteur

  cache: 300,             // secondes avant de réinterroger le forum (0 = jamais de cache)

  texteVide: 'rien de neuf par ici',
  texteInterdit: null,    // texte si le visiteur n'a pas accès à la section
                          // null = l'encart disparaît purement et simplement

  /* Feuille de style :
   *   true  → fa-updates.css est chargée automatiquement, depuis le même
   *           dossier que fa-updates.js (le cas normal)
   *   false → aucune feuille chargée, tu écris tout ton CSS toi-même
   *   '...' → l'adresse d'une feuille à toi
   */
  style: true

  /* ---------------------------------------------------------------------------
   *  4. POUR ALLER PLUS LOIN (optionnel — supprimer la virgule ci-dessus si
   *     vous décommentez)
   * -------------------------------------------------------------------------
   *  Filtre maison. Reçoit chaque sujet, renvoie true pour le garder.
   *  Champs disponibles : titre, url, auteur, posteur, avatar, date, dateTxt.
   *
   *  ,filtre: function (sujet, section) {
   *     return sujet.titre.indexOf('[PAUSE]') === -1;   // masquer les sujets en pause
   *   }
   */
};
