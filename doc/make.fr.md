# Définition d'un projet (`make.js`)

Un projet est défini par un fichier `make.js`.
Dans ce fichier ayant pour syntaxe le javascript, il est possible de définir les aspects suivants d'un projet:

 - les environnements supportés (ex: windows, darwin, nodejs, ...)
 - les fichiers organisée en arbre et dont il est possible pour chaque fichier de lui associé un ou plusieurs **tags**;
 - les objectifs de construction (librarie, exécutable, ...) et les paramètres de construction pour chacun d'entre eux;
 - les façons d'exécuter le résultat d'un ou plusieurs objectifs (ex: lancer les tests, démarrer un serveur, ...)

## Vocabulaire

Un **environnment** est un ensemble d'informations qui définisse une façon de construire le projet. Par exemple, pour les languages compilés, souvent on défini un environnment par système et architecture cible.

On appelle **target** un objectif de construction.

On appelle **run**, l'exécution d'un résultat d'un ou plusieurs objectif de construction.

## Syntaxe

Le fichier `make.js` est un module nodejs qui exporte la définition du projet.
Il est donc possible d'utiliser les modules de nodejs pour créer la définition du projet.
Le module exporté est un objet composé de 5 parties:

 - `environments`
 - `files`
 - `targets`
 - `runs`


### environments

C'est la liste des environnement utilisable pour la construction des targets du projet.
Un environnement est au minimum définit par son nom (clé `name`).
Il existe 2 clés particulières en plus de `name`:
 - `import`, qui définit la liste des environnements dont les attributs sont automatiquement récupérer, en cas de conflit, c'est le dernier qui définit les attributs qui gagne (à savoir que le dernier est toujours l'environnement en cours de définition).
 - `splitInto`, si défini, cette environnement est considéré comme représentant une liste d'environnement et toute référence à celui-ci est systématiquement remplacé par la liste d'environnement définit dans cet attribut.
Tous les autres attributs sont libres et leur signification dépend du type de target.


### files

C'est l'arbre définissant l'ensemble des fichiers sources du projet.
Chaque noeud de l'arbre est soit un fichier, soit un groupe.

Un fichier est définit par 2 clés:

 - `file`: le chemin relatif au fichier `make.js` du fichier à inclure dans le projet.
 - `tags`: une liste optionnel de tags qui peuvent être utilisé pour récupérer un ensemble de fichier du projet.

Un groupe est définit par 2 clés:

 - `group`: le nom du groupe
 - `subs`: la liste de fichiers et/ou groupes qu'il contient

Le fait de définir tous les fichiers sources du projet via des groupes et des tags à pour objectifs de permettre de récupérer des ensembles variées de fichier parmi cette arbre facilement. C'est donc le seul endroit ou un fichier devrait être définit.

Pour définir un ensemble de fichier, une syntaxe dédié existe: `[GROUP]?[?TAG]*`.
Il possible de restreindre l'ensemble à un groupe en particulier en commançant par ce groupe. Le point `.` est utilisable pour définir un sous-groupe.
Ensuite il est possible de restreindre l'ensemble au fichier possédant les tags demandés (via la syntaxe: `?NomDuTag`).

Example:

  - *MyGroup1.MyGroup2.MyGroup3*, correspond à l'ensemble des fichiers contenu dans le groupe *MyGroup3*.
  - *?MyTag1*, correspond à l'ensemble des fichiers possédant le tag *MyTag1*.
  - *MyGroup1.MyGroup2?MyTag1?MyTag2*, correspond à l'ensemble des fichiers contenu dans le groupe *MyGroup2$ et possédant le tag *MyTag1* et le tag *MyTag2*.


### targets

Une target est définie par 3 choses:

  - un nom (clé `name`)
  - un type (clé `type`), par exemple: `Library`, `Framework`, ...
  - une liste d'environnement supporté (clé `environments`)

### runs

## Example

```
module.exports = {
  "environments": [
    {name: "c", compiler: "clang" },
    {name: "darwin-x86_64", sysroot: "darwin", arch: "x86_64", import: ["c"] },
    {name: "darwin-i386"  , sysroot: "darwin", arch: "i386"  , import: ["c"] },
    {name: "darwin", splitInto: ["darwin-x86_64", "darwin-i386" }
  ],
  files: [
    { file: "MyFile.c", tags: ["CompileMe"] },
    { group: "MyGroup", subs: [
      { file: "DontCompileMe.c" },
      { file: "CompileMe.c", tags: ["CompileMe"] }
    ]}
  ]
  "targets": [
    {
      name: "MyExecutable",  // name of the target
      type: "Executable",    // this target is an executable
      files: ["MyGroup?CompileMe"], // all the file that has the tag: CompileMe
      environments: ["darwin"] // soit "darwin-x86_64" et "darwin-i386"
    }
  ],
  "runs": [
    {
      name: "RunMyExecutable",
      dependencies: ["MyExecutable"],
      path: { target: "MyExecutable" },
      arguments: [ "1", "2", function() { return "3"; }],
    }
  ]

}