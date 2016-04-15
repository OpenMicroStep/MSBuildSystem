# Définition d'un projet (`make.js`)

Ce document à pour but de présenter les concepts mis en œuvre pour la définition d'un projet.
Les attributs définis par les différents types d'objectif et d'exécution ne sont pas détaillés dans ce document.

Un projet est défini par un fichier `make.js`.  
Ce fichier à pour syntaxe le JavaScript (ECMAScript 6 supporté).  
Il permet de définir les aspects suivants d'un projet :

 - les environnements supportés (ex : windows, darwin, nodejs, ...)
 - les fichiers organisée en arbre et dont il est possible pour chaque fichier de lui associé un ou plusieurs **tags**;
 - les objectifs de construction (librairie, exécutable, ...) et les paramètres de construction pour chacun d'entre eux ;
 - les façons d'exécuter le résultat d'un ou plusieurs objectifs (ex: lancer les tests, démarrer un serveur, ...)

## Vocabulaire

Un **environnement** est un ensemble d'informations qui définisse une façon de construire le projet. Par exemple, pour les langages compilés, souvent ont défini un environnement par système et architecture cible.

On appelle **target** un objectif de construction.

On appelle **run**, l'exécution d'un résultat d'un ou plusieurs objectifs de construction.

## Syntaxe

Le fichier `make.js` est un module nodejs qui exporte la définition du projet.
Il est donc possible d'utiliser les modules de nodejs pour créer la définition du projet.
Le module exporté est un objet composé de 4 parties :

 - `name` : tout simplement le nom du projet
 - `variables` : la liste des variables du projet
 - `files` : la liste de fichiers du projet
 - `components` : les composants du projet (objectifs, environnements, exécutions, ...)


### variables

C'est la liste des variables configurable pour le projet et disponible pour configurer les *components*.

Une variable est définie par les attributs suivant :

 - `name` : le nom de la variable
 - `default` : si définit, c'est la valeur par défaut que prend la variable

Une variable est toujours de type `string` et ne sont utilisable que dans la partie `components` du projet.
Les variables sont exécuter dans le cadre d'une instance d'objectif pour un environnement.
Le système fournit les variables suivantes:

 - `out`: le chemin vers le répertoire où les produits de l'objectif sont mis,
 - `src`: le chemin vers le répertoire du projet,

Pour toute valeur de type `string`, il est possible d'utiliser des variables via la syntaxe `${NOM_DE_LA_VARIABLE}`.


### files

C'est l'arbre définissant l'ensemble des fichiers sources du projet.
Chaque nœud de l'arbre est soit un fichier, soit un groupe, soit un répertoire.
Tous les chemins commencent en étant relatif au répertoire qui contient ce fichier `make.js`

Un fichier est défini par 2 clés :

 - `file` : le chemin relatif du fichier à inclure dans le projet.
 - `tags` : une liste optionnelle de tags qui peuvent être utilisé pour récupérer un ensemble de fichier du projet.

Un répertoire est défini par 2 clés :

 - `direcotory` : le chemin relatif du répertoire à inclure dans le projet.
 - `depth`: si définit, la profondeur maximal d'inclusion des fichiers
 - `filter`
   - si définit par une RegExp, les fichiers qui passe l'expression régulière sont inclus,
   - si définit par une fonction ayant pour paramètre le chemin relatif vers le fichier et le nom du fichier, les fichiers pour lesquels cette fonction renvoie `true` sont inclus,
 - `tags` : si définit, la liste des tags qui peuvent être utilisé pour récupérer un ensemble de fichier du projet.

Un groupe est définit par 2 clés :

 - `group` : le nom du groupe
 - `directory`: si définit, les chemins des enfants de ce noeud deviennent relatif à ce chemin, 
 - `subs` : la liste de fichiers, répertoires, groupes et/ou groupes qu'il contient

Le fait de définir tous les fichiers sources du projet via des groupes et des tags à pour objectifs de permettre de récupérer des ensembles variés de fichier parmi cette arbre facilement. C'est donc le seul endroit ou un fichier devrait être définit.

Pour définir un ensemble de fichier, une syntaxe dédié existe : `[GROUP][?TAG]*`.
Il possible de restreindre l'ensemble à un groupe en particulier en commençant par ce groupe. Le point `.` est utilisable pour représenter le chemin vers un sous-groupe.
Ensuite il est possible de restreindre l'ensemble au fichier possédant les tags demandés, via la syntaxe `?` suivie du nom du tag.
Si `?` n'est suivi par aucun nom de tag, cela restreint les fichiers à ceux qui ne possèdent aucun tag.

Example:

  - `MyGroup1.MyGroup2.MyGroup3`, correspond à l'ensemble des fichiers contenu dans le groupe `MyGroup3`.
  - `?MyTag1`, correspond à l'ensemble des fichiers possédant le tag `MyTag1`.
  - `MyGroup1.MyGroup2?MyTag1?MyTag2`, correspond à l'ensemble des fichiers contenu dans le groupe *MyGroup2$ et possédant le tag `MyTag1` et le tag `MyTag2`.


### components

C'est la liste des composants qui vont permettre de définir les attributs des *targets*.  
Le principe d'un composant est de permettre le partage de ses attributs.  
On définit le nom d'un composant par la clé portant la valeur du type du composant.
Par exemple : `{component: "MySimpleComponent"}`.  
Il existe 4 types de composants :

 - `component`, c'est un simple composant
 - `environment`, c'est un environnement
 - `target`, c'est un objectif de compilation
 - `run`, c'est l'exécution d'une tache après la réalisation d'un ou plusieurs objectifs de compilation

La clé `components` est particulière, elle définit une liste des composants dont les attributs seront hérités.
Lors de l’héritage :

 - les dépendances cycliques sont interdites,
 - la valeur des attributs de type tableau sont fusionné,
 - si deux valeur différentes sont définit pour le même attribut et que celui-ci n'est pas un tableau, alors cette attribut doit être redéfinit, sinon un avertissement est remonté et l'attribut n'est pas repris
 - les valeurs des attributs `component`, `environment`, `target` et `run` ne sont pas repris.

#### Objectifs de compilations et environnements

Un composant de type objectif de compilation (`target`) définit 3 clé particulières :

 - `environments`, la liste des environnements pour lequel cet objectif est valable,
 - `dependencies`, la liste des objectifs dont dépend cet objectif,
 - `type`, le type de cet objectif (ex : une application node, un executable, une librairie, ...)

Lors de la création du graphe de compilation, après la résolution des composants, chaque objectif est instancié pour chacun des environnements définis.  
Comme pour les composants, les attributs de l'environnement sont ajoutés à l'objectif en suivant les règles suivantes :

 - la valeur des attributs de type tableau sont fusionné,
 - si deux valeur différentes sont définit pour le même attribut et que celui-ci n'est pas un tableau un avertissement est remonté et l'attribut n'est pas repris,
 - l'attribut `component` est repris,
 - l'attribut `components` est supprimé,

#### Execution d'une tache

Un composant de type `run` définit 2 clé particulières :

 - `targets`, la liste des objectifs de compilation nécéssaire pour pouvoir éxécuter la tache
 - `type`, le type de tâche à exécuter

#### Exemple d'héritage des attributs

```js
{ 
  component: "base", 
  compiler: "clang",
  flags: ["-Werror"]
},
{
  environment: "darwin-i386-foundation",
  components: ["base", "darwin-i386"],
  arch: "i386", 
  sysroot: "darwin",
},
{
  component: "all-env",
  environments: ["darwin-i386-foundation"]
},
{ 
  component: "MSObjcComponent",
  components: ["all-env"],
  flags: ["-Wall"],
  type: "Library",
},
{ target: "MSObjc"       , static: false, components: ["MSObjcComponent"] },
{ target: "MSObjc_static", static: true , components: ["MSObjcComponent"] },
```

Une fois résolu, on obtient:

```js
{ 
  component: "base", 
  compiler: "clang",
  flags: ["-Werror"]
},
{
  environment: "darwin-i386-foundation", 
  components: ["base", "darwin-i386"]
  arch: "i386",
  sysroot: "darwin",
  compiler: "clang",
  flags: ["-Werror"]
},
{
  component: "all-env",
  environments: ["darwin-i386-foundation"]
},
{ 
  component: "MSObjcComponent",
  components: ["all-env"],
  environments: ["darwin-i386-foundation"]
  flags: ["-Wall"],
  type: "Library",
},
{ 
  target: "MSObjc"       , 
  static: false, 
  components: ["MSObjcComponent", "all-env"],
  environments: ["darwin-i386-foundation"]
  flags: ["-Wall"],
  type: "Library"
},
{ 
  target: "MSObjc_static", 
  static: true, 
  components: ["MSObjcComponent", "all-env"],
  environments: ["darwin-i386-foundation"]
  flags: ["-Wall"],
  type: "Library"
},
```

Et une fois les *targets* instancié par *environment*, on obtient

```js
{ 
  target: "MSObjc_static",
  environment: "darwin-i386-foundation",
  components: ["MSObjcComponent", "all-env", "base", "darwin-i386", "darwin-i386-foundation"],
  type: "Library"
  static: true,
  flags: ["-Wall", "-Werror"],
  arch: "i386",
  sysroot: "darwin",
  compiler: "clang",
},

{ 
  target: "MSObjc",
  environment: "darwin-i386-foundation",
  components: ["MSObjcComponent", "all-env", "base", "darwin-i386", "darwin-i386-foundation"],
  type: "Library"
  static: false,
  flags: ["-Wall", "-Werror"],
  arch: "i386",
  sysroot: "darwin",
  compiler: "clang",
}
```

### Concepts sur les attributs

Pour les attributs qui acceptes des listes de valeurs il est souvent intéressant de pouvoir filtrer ces attributs en fonction d'autres attributs provenant de la *target* et ou de la *tache*.  
Par exemple, la liste des fichiers à compilés peut varier en fonction des plateformes.  
Pour résoudre ce problème, la majorité des listes supportes de recevoir :

 - directement la valeur,
 - un objet qui définit la valeur et une condition sur cette valeur.
   - la clé `add` définit la ou les valeurs à ajouter
   - la clé `rm`  définit la ou les valeurs à retirer
   - la clé `ifTarget` définit une condition à l'objectif en cours de configuration, 
     c'est à dire une fonction ayant pour paramètre cette `target` et qui renvoie `true` s'il faut ajouter les valeurs
   - la clé `ifTask` définit une condition par rapport à la tache en cours de configuration, 
     c'est à dire une fonction ayant pour paramètres la `tache` et cette `target` et qui renvoie `true` s'il faut ajouter les valeurs,
     cette clé n'est valable que si l'attribut à du sens pour une tâche.
   - la clé `ifFile` définit une condition par rapport aux fichiers principaux utilisé pour la tache en cours de configuration,
     c'est donc une liste d'expressions d'accès aux fichiers,
     cette clé n'est valable que si l'attribut à du sens pour une tâche et que cette tache utilise les fichiers du projet (ex: étape de compilation).
   - la clé `export` définit si la valeur doit être remonté sur les objectifs qui dépendent de cet objectif,
     c'est soit un booléan, soit une fonction ayant pour paramètres, la `target`, cette `target` et le niveau d'imbrication et qui renvoie `true` s'il faut ajouter les valeurs

Une fois la liste des valeurs établies : 

 1. les valeurs qui sont des fonctions sont remplacés par le résultat. Les paramètres sont la `target` et la `tache` si la valeur à du sens pour une tache.
 2. les variables au sein des valeurs de type `string` sont remplacé par leurs valeurs

Pour les valeurs qui sont des listes de fichiers, il arrive que les fichiers répondant au besoin ne soit pas dans la liste des sources de ce projet (il ne sont donc pas accessible via le system des groupes et tags). Dans ce cas il est possible de fournir une expression de chemin absolu. Cette expression doit être préfixé par `>`. Dans cette expression:

 - les variables sont autorisés : (ex: `>$out/MyOtherTarget/Headers/**`)
 - `*` est utilisable pour accepter un nom de fichier (ex: `>/etc/*/*.conf`)
 - `**` est utilisable pour accepter un chemin (ex: `>/etc/**.conf`)


Exemple : 

```js
{
  target        : "MyTarget",
  type          : "Library",
  environments  : ["darwin-x86_64"],
  files         : [
    "MyFiles?",
    {add: ["MyFiles?POSIX"], ifTarget: target => target.platform !== "win32" },
  ],
  compileFlags       : [
      {add: ["-fconstant-string-class=NSConstantString", "-fobjc-runtime=gnustep-1.7"], ifTask: task => task.language.indexOf("OBJC") !== -1, export: true },
      {add: ["-fno-objc-exceptions"], ifTarget: target => target.platform === "win32", export: true },
      {rm: ["-Wunused"], ifFile: ["?DontWarnOnUnused"] },
  ],
  definitionFiles        : [
    {add: "MyFiles?DEF", ifTarget: target => target.static && target.platform === "win32", export: (other, self, lvl) => self.static && !other.static }
  ],
  linkLibrary: ["$MyExternalLibraryPath"]
}
```

Dans cet exemple, la notation courte ajouté par l'ECMAScript 6 est utilisé pour définir les conditions.

