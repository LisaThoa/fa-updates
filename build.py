#!/usr/bin/env python3
"""Fabrique console-test.js : le plugin + la feuille de style + le bout de test,
en un seul fichier à coller dans la console d'un forum.

    python build.py

Rien n'est écrit à la main dans console-test.js : il se régénère à partir de
fa-updates.js, fa-updates.css et test-footer.js.
"""
import json
import pathlib

ici = pathlib.Path(__file__).parent
js = (ici / "fa-updates.js").read_text(encoding="utf-8")
css = (ici / "fa-updates.css").read_text(encoding="utf-8")
footer = (ici / "test-footer.js").read_text(encoding="utf-8")

style = (
    "\n/* --- fa-updates.css, embarquée pour que le test se suffise à lui-même --- */\n"
    "(function () {\n"
    "  if (document.getElementById('fau-css')) return;\n"
    "  var s = document.createElement('style');\n"
    "  s.id = 'fau-css';\n"
    "  s.textContent = %s;\n"
    "  document.head.appendChild(s);\n"
    "})();\n\n" % json.dumps(css)
)

sortie = ici / "console-test.js"
sortie.write_text(js + style + footer, encoding="utf-8")
print("console-test.js régénéré — %d octets" % sortie.stat().st_size)
