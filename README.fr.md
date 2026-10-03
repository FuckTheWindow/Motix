# Motix — Movix à votre image

*[English version](README.md)*

Motix est une extension pour Chrome et Firefox qui change l'apparence des sites [Movix](https://github.com/movixstream/MovixOpenSource) : choisissez l'un des seize thèmes ou créez le vôtre, et tout le site suit. Elle ne modifie que l'apparence. Elle ne touche ni à la lecture, ni aux comptes, ni aux requêtes réseau, et tout reste sur votre appareil.

## Ce qu'elle fait

- **Des thèmes sur tout le site.** Couleurs, arrondis, ombres et halo s'appliquent à toutes les pages, y compris aux états de survol, et pas seulement à quelques composants.
- **Seize thèmes prêts à l'emploi**, clairs et sombres, et un éditeur pas à pas avec aperçu en direct.
- **Par site ou partout.** Un seul thème pour tous les domaines Movix, ou un thème différent pour chacun.
- **Import et export** des thèmes en fichiers JSON.
- **CSS personnalisé optionnel**, limité à des règles locales simples.
- **Le lecteur vidéo n'est pas modifié**, sauf si vous l'activez.

## Installation depuis les sources

Il faut Node.js 22 ou plus et [pnpm](https://pnpm.io).

```sh
pnpm install
pnpm build
```

Le résultat se trouve dans `build/chrome/` et `build/firefox/`.

- **Chrome, Edge, Brave :** ouvrez `chrome://extensions`, activez le **mode développeur**, cliquez sur **Charger l'extension non empaquetée** et choisissez `build/chrome/`.
- **Firefox :** ouvrez `about:debugging#/runtime/this-firefox`, cliquez sur **Charger un module complémentaire temporaire…** et choisissez `build/firefox/manifest.json`. Le module est retiré à la fermeture de Firefox.

Après un nouveau build, rechargez l'extension et actualisez les onglets Movix ouverts.

## Utilisation

Ouvrez un site Movix et cliquez sur l'icône Motix dans la barre d'outils. La fenêtre permet d'activer ou de désactiver Motix pour ce site et de choisir un thème. **Customize theme** ouvre l'éditeur dans le site, à l'adresse `/themes` ; **← Back to Movix** ramène à la page où vous étiez. Depuis un autre onglet, **Open Motix Themes** ouvre l'éditeur dans un onglet à part. L'interface de l'extension est en anglais.

## Domaines pris en charge

Motix ne s'exécute que sur les domaines listés dans [`src/shared/domains.json`](src/shared/domains.json), fichier généré depuis l'annuaire officiel de Movix : <https://movix.online/address.json>. Les sous-domaines de ces racines sont inclus ; les imitations comme `fake-movix.example` ne le sont pas. Une tâche planifiée ouvre une pull request quand l'annuaire change, et le nouveau domaine arrive chez les utilisateurs avec la version suivante.

## Vie privée et sécurité

- Les thèmes et réglages sont enregistrés dans le stockage local de l'extension. Rien n'est envoyé, et aucune donnée de navigation ou de compte n'est collectée.
- Les permissions se limitent à `storage`, `activeTab` et aux domaines Movix ci-dessus. Il n'y a pas de script d'arrière-plan.
- Les fichiers de thème importés sont limités à 128 Ko et validés par un schéma strict.
- Le CSS personnalisé est limité à 16 Ko, ne peut pas charger de ressource distante (`url()`, `@import`), ne peut pas cibler `html`, `body` ni `:root`, et reste confiné à la page thémée. Il n'est jamais exécuté comme du JavaScript.

## Développement

```sh
pnpm dev          # aperçu de la fenêtre et de l'éditeur dans un navigateur, sans les API d'extension
pnpm check        # tout ce que lance la CI : typage, lint, tests unitaires, build, tests navigateur
```

| Commande | Rôle |
| --- | --- |
| `pnpm typecheck` | TypeScript en mode strict. |
| `pnpm lint` | ESLint. |
| `pnpm test` | Tests unitaires (lanceur de tests de Node). |
| `pnpm build` | Construit les deux extensions dans `build/`. |
| `pnpm test:e2e` | Tests navigateur sur l'extension Chrome construite. Lancez `pnpm build` avant ; la première fois, il faut aussi `pnpm exec playwright install chromium`. |
| `pnpm lint:firefox` | Valide le build Firefox avec l'outil `web-ext` de Mozilla. |
| `pnpm sync:domains` | Met à jour la liste des domaines depuis l'annuaire Movix. |
| `pnpm sync:upstream` | Régénère l'adaptateur de thème depuis la feuille de style que Movix sert actuellement. |
| `pnpm preview:live` | Capture le vrai site avec quelques thèmes dans `test-results/live/`. |
| `pnpm generate:icons` | Régénère les icônes de l'extension depuis `public/icons/icon.svg`. |
| `pnpm generate:logos` | Régénère les logos des thèmes dans `public/logos/`. |

### Fonctionnement

Movix n'a pas de système de thème : ses couleurs sont des classes utilitaires écrites en dur. Motix embarque une feuille de style générée à partir de celle de Movix, où chaque couleur est remplacée par une variable CSS dont la valeur par défaut est la couleur d'origine. Un thème n'est alors qu'un jeu de valeurs pour ces variables. Les détails et les limites connues sont dans [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) (en anglais).

```
src/
  content/   script de contenu : applique le thème, intègre l'éditeur sur /themes
  shared/    domaines, stockage et migration, typage de l'API navigateur
  theme/     thèmes fournis, correspondance des couleurs, génération du CSS, validation, adaptateur généré
  ui/        fenêtre et éditeur (React)
scripts/     empaquetage du build et les deux scripts de synchronisation
tests/
  unit/      logique pure
  e2e/       Playwright, sur une page Movix factice
```

## Tests

Les tests unitaires couvrent la reconnaissance des domaines (y compris tous les faux domaines signalés par Movix), la migration des réglages, la validation des thèmes, la correspondance des couleurs et la génération de l'adaptateur.

Les tests navigateur chargent l'extension construite dans Chromium et la pilotent face à une petite page factice servie sous de vrais noms de domaine Movix, sans accès réseau. Ils couvrent les hôtes non pris en charge et les imitations, les sous-domaines, l'activation et la désactivation, les thèmes fournis, l'éditeur, les thèmes par domaine, la synchronisation entre onglets, l'import et l'export, le rejet des fichiers et du CSS invalides, la page `/themes`, l'option du lecteur, un écran étroit et la réduction des animations.

Ce qui demande encore une vérification humaine :

- [ ] Charger le build Firefox et y refaire un tour rapide (Playwright ne sait pas piloter une extension dans Firefox).
- [ ] Lancer `pnpm preview:live` et regarder les captures : la page factice ne peut pas dire si un thème est réussi sur le vrai site.
- [ ] Lire une vidéo avec un thème actif et vérifier que les contrôles et la lecture ne changent pas.

## Limites connues

- Les couleurs que Movix pose en attribut `style` ou via du CSS injecté à l'exécution sont pour la plupart hors d'atteinte.
- Movix utilise le même rouge pour sa marque et pour les messages d'erreur : les deux suivent la couleur d'accent du thème.
- La page `/themes` est fournie par l'extension, pas par Movix : elle n'existe que là où Motix est installé.
- Les réglages ne sont pas synchronisés entre navigateurs ou appareils.

## Licence

[MIT](LICENSE). Motix est un projet indépendant, sans lien avec Movix.
