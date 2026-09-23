# fa-updates

Widget « dernières activités » par section, pour les forums **Forumactif**.

Affiche les N derniers sujets **ayant reçu un message** dans une ou plusieurs sections
précises : fiches de liens, activité rps, comptes insta, groupchats… Chaque entrée
pointe directement sur le dernier message du sujet.

Pas d'API, pas de service externe, pas de base de données. Le script tourne sur le
forum, donc `fetch()` est en *same-origin* et part avec la session du visiteur :
**chacun ne voit que ce qu'il a le droit de voir.**

---

## Les fichiers

On ne modifie que les deux premiers.

| fichier | à ouvrir ? | rôle |
|---|---|---|
| **`config.js`** | **oui** | quelles sections suivre, où poser le widget, les réglages |
| **`config.css`** | **oui** | couleurs, tailles, colonnes, disposition des encarts |
| `fa-updates.js` | non | le plugin |
| `fa-updates.css` | non | la structure (ne fait que lire les variables de `config.css`) |
| `themes/` | au choix | des habillages prêts à l'emploi |
| `demo.html` | — | rendu hors ligne avec des données simulées |
| `test-footer.js` + `build.py` | — | de quoi fabriquer `console-test.js` |
| `console-test.js` | — | **généré** : tout-en-un à coller dans la console d'un forum |

---

## Installation

1. Héberger `fa-updates.js`, `fa-updates.css` et `config.js` (GitHub + jsDelivr,
   GitHub Pages, ou n'importe quel hébergeur en https).
2. **PA → Affichage → Gestion des codes JavaScript → Créer un nouveau JavaScript**
   (placement : *dans l'index uniquement*, ou *toutes les pages*) :

```html
<script src="https://cdn.jsdelivr.net/gh/LisaThoa/fa-updates@main/config.js"></script>
<script src="https://cdn.jsdelivr.net/gh/LisaThoa/fa-updates@main/fa-updates.js"></script>
```

`fa-updates.css` se charge toute seule, depuis le même dossier que `fa-updates.js`.

3. Coller le contenu de **`config.css`** dans
   *PA → Affichage → Couleurs → Feuille de style CSS*, et y régler l'apparence.

Rien d'autre à faire : `config.js` dit déjà **où** le widget se pose dans la page.

---

## `config.js` — où, quoi, comment

```js
window.FA_UPDATES_CONFIG = {

  emplacement: {
    cible: '#page-body',   // un élément qui existe déjà (clic droit → Inspecter)
    position: 'debut'      // 'debut' | 'fin' | 'avant' | 'apres'
  },

  sections: [
    { titre: 'fiches de liens', forum: 12, url: '/f12-fiches-de-liens', classe: 'liens' },
    { titre: 'activité rps',    forum: 13, url: '/f13-activite-rps', nombre: 3, classe: 'rps' }
  ],

  nombre: 5,
  masquerAutoBump: false
};
```

`forum` et `url` se lisent dans le lien de la section :
`monforum.forumactif.com/f12-fiches-de-liens` → `forum: 12`,
`url: '/f12-fiches-de-liens'`.

Un encart peut aussi :

```js
// fusionner plusieurs sections en une seule liste, remise dans l'ordre
{ titre: 'recherches', nombre: 6, sources: [
    { forum: 16, url: '/f16-recherche-de-liens', titre: 'liens' },
    { forum: 17, url: '/f17-recherche-de-rp',    titre: 'rps' } ] }

// suivre des sujets précis plutôt qu'une section entière
{ titre: 'les incontournables', url: '/f12-fiches-de-liens',
  sujets: [1234, 5678, '/t91-flood-des-liens'] }

// …et les écarter de l'encart où ils feraient doublon
{ titre: 'liens', url: '/f12-fiches-de-liens', exclure: [1234, 5678] }

// n'afficher que du texte à soi et des boutons : aucun forum n'est lu
{ titre: 'le mot du staff', soustitre: 'can you keep it ?',
  html: '<p>…</p>',
  liens: [ { texte: 'les rumeurs', url: '/t1-les-rumeurs' } ] }
```

Dans un encart fusionné, chaque sujet affiche sa section d'origine — `source: false`
pour l'enlever, sur un encart précis ou sur tout le widget. Un encart à liste blanche garde l'ordre des ids donnés.
L'encart libre est placé en colonne de gauche par le thème « cartes ».

Le widget **s'ajoute** à la cible, il ne remplace jamais son contenu. Plusieurs
widgets peuvent cohabiter sur une même page (un appel à `FAUpdates.init({…})` chacun).

Tous les réglages sont commentés un par un dans le fichier.

---

## `config.css` — l'apparence

Tout passe par des variables, redéclarables encart par encart :

```css
:root {
  --fau-colonnes: 1;            /* sujets côte à côte dans un encart */
  --fau-avatar-taille: 26px;
  --fau-avatar-arrondi: 50%;    /* 4px pour des avatars carrés */
  --fau-bordure: color-mix(in srgb, currentColor 14%, transparent);
  --fau-titre-taille: 11px;
  /* …une trentaine, toutes commentées dans le fichier */
}

/* un encart en particulier : la classe vient de config.js */
.fau--liens { --fau-colonnes: 2; --fau-avatar-arrondi: 4px; }

/* les encarts côte à côte plutôt qu'empilés */
.fau-root { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
```

Repères pour habiller plus finement :

| classe | quoi |
|---|---|
| `.fau-root` | le conteneur de tous les encarts |
| `.fau` | un encart — aussi `.fau--<classe>` et `[data-fau="12"]` |
| `.fau-entete` | son titre |
| `.fau-liste` / `.fau-entree` | la liste / un sujet |
| `.fau-lien`, `.fau-avatar`, `.fau-sujet`, `.fau-meta` | l'intérieur d'un sujet |
| `.fau-vide`, `.fau-fantome` | « rien de neuf », et l'état de chargement |

Par défaut le widget emprunte la couleur du texte autour de lui (`currentColor`) :
il se fond dans n'importe quel design sans rien régler.

---

## Thèmes tout faits

`themes/cartes.css` — barre de titre en dégradé, pastilles claires arrondies sur
deux colonnes, pictogramme carré à gauche, avatar rond à droite.

```html
<link rel="stylesheet" href=".../themes/cartes.css">
```

```js
// dans config.js
classe: 'cartes'
```

Il se décline :

| classe | effet |
|---|---|
| `cartes` | le thème, en clair |
| `cartes cartes-sombre` | la même chose en sombre |
| `cartes cartes-flottant` | calé en bas à droite de l'écran, reste en place quand on défile |

Avec `repliable: true`, un petit bouton rond permet de replier le widget — il ne
reste alors que le bouton. Le choix du visiteur est retenu d'une page à l'autre
(`localStorage`), et `replieParDefaut: true` le laisse fermé la première fois.

Ce bouton n'est pas obligé de rester dans le widget :

```js
repliable: true,
emplacementBascule: { cible: '.navbar', position: 'fin' }   // dans la barre de menu
```

Il porte alors la classe `.fau-bascule--hors`, pour l'habiller comme son voisinage.

Son libellé accepte du texte **ou une icône** — `texteReplier` et `texteDeplier` sont
insérés tels quels, donc `'<i class="cp cp-star-o"></i>'` fonctionne avec la police
d'icônes du forum. Sa taille tient dans une variable :

```css
.fau-bascule { --fau-bascule-taille: 26px; }
```

L'option `classe` accepte plusieurs noms séparés par un espace, donc
`'cartes cartes-sombre cartes-flottant'` se cumule. La variante flottante passe en
une colonne, défile toute seule au-delà de `--flottant-hauteur` (72 vh par défaut),
et reprend sa place dans le flux de la page sous 700 px de large — un panneau fixe
sur un téléphone masquerait la moitié de l'écran.

La classe se pose sur le conteneur (`.fau-root.fau-cartes`), donc le thème ne déborde
jamais sur un autre widget de la page. Couleurs, pictogramme et nombre de colonnes se
règlent en tête du fichier ; un commentaire en fin de fichier montre comment rattacher
la variante sombre à la bascule jour/nuit d'un forum (`[data-color-scheme="dark"]`) ou
au réglage du visiteur (`prefers-color-scheme`).

---

## Comment ça marche

Deux sources, dans cet ordre :

1. **La page de la section** (`/f12-…`), lue avec `DOMParser`. Donne le titre, la date,
   le **dernier posteur** et son **avatar**.
   Le tri n'utilise pas les dates mais l'**id du dernier message**, lisible dans l'ancre
   « voir le dernier message » (`/t123-un-sujet#4567`) : il est global et croissant, donc le
   tri est exact, et les post-it épinglés retombent tout seuls à leur vraie place.
2. **Le flux RSS** (`/feed/?f=12`), en filet si le template du forum a des classes
   exotiques et que rien n'a pu être lu. Indépendant du template, mais sans avatar, et
   `dc:creator` y est l'auteur du sujet — pas le dernier posteur, donc le pseudo n'est
   pas affiché dans ce mode.

Deux garde-fous :

- si le forum sert la page **Connexion** à la place de la section, l'encart est masqué
  (le visiteur n'y a pas accès) ;
- Forumactif **ignore silencieusement** `?f=` sur le flux RSS quand la section n'est pas
  visible et renvoie le flux global du forum. On le détecte via `<channel><link>` : s'il
  pointe sur `/feed/…` au lieu de `/f12-…`, on refuse le flux plutôt que d'afficher des
  sujets au hasard.

Le résultat est gardé en `sessionStorage` pendant `cache` secondes (5 min par défaut),
donc une seule requête par section et par visite, pas une par page vue.

---

## Essayer / développer

**Hors ligne** : ouvrir `demo.html`, données simulées, aucune requête vers un forum.

**Sur un vrai forum** : connecté, ouvrir la console (F12) et coller `console-test.js`
en entier. *(La console refuse le tout premier collage tant qu'on n'a pas tapé
`allow pasting` + Entrée.)* Un panneau apparaît en haut à droite, et la console affiche
ce qui a été lu ainsi que le HTML brut d'une ligne de sujet — pratique pour adapter le
plugin à un template récalcitrant.

Régénérer le tout-en-un après modification :

```sh
python build.py
```

API : `FAUpdates.init(config)`, `FAUpdates.rafraichir()`, `FAUpdates.viderCache()`.

---

## Compatibilité

Testé sur un forum **ModernBB** à template personnalisé. Les sélecteurs de lecture sont
volontairement larges (`a.topictitle` puis n'importe quel lien `/t123-…`, `.timeposte`,
`.topicslist-lastpost`, `.lastpostavatar`…) et couvrent les structures phpBB2 / phpBB3 /
PunBB / Invision non modifiées. Sur un template très réécrit, il reste le filet RSS.

`color-mix()` sert aux valeurs par défaut, pour se fondre dans n'importe quel habillage ;
sur navigateur ancien le widget s'affiche sans bordure — il suffit de donner des couleurs
en dur dans `config.css`.

## Licence

MIT.
