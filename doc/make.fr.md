Définition d'un projet (`project`)
==================================

> TODO: project.workspace: string // nom du workspace par défaut auquel le projet appartient

> Long terme: définir les prérequis pour le buildsystem (ie. cxx, clang, gcc, typescript, ...) + npm extensions ?

Ce document présente les concepts essentiels à la définition d'un projet.

Un projet est défini dans un fichier `make.js`.  
Ce fichier est écrit en JavaScript (ECMAScript 6 supporté).  
Il définit les aspects suivants :

 - les environnements supportés (ex: windows, darwin, nodejs, ...);
 - les fichiers du projet;
 - les objectifs (librairie, exécutable, ...);
 - les tâches permettant d'exécuter le résultat d'un ou plusieurs objectifs (ex: lancer les tests, démarrer un serveur, ...).

Les propriétés spécifiques aux différents types d'objectifs et de tâches sont détaillés dans le document xxx.

<a name="☝︎"></a>Sommaire
-------------------------

**Les bases**

- [Vocabulaire](#Vocabulaire)
- [Elément](#Elément)
- [Espace de travail](#Workspace)
- [Espace de noms](#Espace-de-noms)
- [Groupe](#Groupe)
- [Utilisation des étiquettes](#Tags)
- [Composant](#Composant)

**Définition du projet**

- [Fichier](#Fichier)
- [Environnement](#Environnement)
- [Objectif](#Objectif)
- [Tâche](#Tâche)
- [Import/Export](#Import/Export)
- [Méthodes sur les éléments](#Méthodes)
- [Exemple MSFoundation](#MSFoundation)

Les bases
=========

<a name="Vocabulaire"></a>Vocabulaire [☝︎](#☝︎)
-------------------------------------

Un **élément** (`element`) est un objet javascript ayant un nom, une propriété `is` précisant la nature de l'élément et éventuellement des étiquettes (`tags`) permettant de le colorer. Tous les objets d'un projet sont des éléments.

Un **groupe** (`group`) est un élément pouvant contenir d'autres éléments de même type et définissant un espace de noms.

Un **composant** (`component`) est un élément qui représente la fusion de ses propriétés et de celles de tous ses composants internes.

Un **environnement** (`environment`) est un ensemble cohérent de paramètres permettant la construction d'un objectif. Par exemple, un environnement pour un langage compilé, décrira le compilateur et l'architecture ciblée.

Un **objectif** (`target`) est un élément que le make a pour mission de construire.

Une **tâche** (`run`) est la définition d'une commande exécutant le résultat d'un ou plusieurs objectifs.

Un **projet** (`project`) définit un ensemble d'objectifs et de tâches.

Un **espace de travail** (`workspace`) est le regroupement d'un ensemble de projets cohérents entre eux. En général ces projets partagent les mêmes environements.

<a name="Elément"></a>Elément (`element`) [☝︎](#☝︎)
-----------------------------------------

Le projet est défini en termes d'éléments.

Un élément contient toujours une propriété `is` qui désigne le type de l'élément (par exemple `project`, `component`, `target`, etc.). Selon le type de l'élément, certaines propriétés auront des significations particulières.  
Les propriétés spécifiques de chaque élément sont décrites de manière exhaustive dans le document xxxx.

Un élément a généralement un nom. Celui-ci est indispensable lorsqu'il s'agit par exemple d'un nom de fichier ou d'un objectif. Il permet aussi de faire référence à cet élément dans un autre élément.  
Il peut cependant arriver que le nommage d'un élément n'ait aucune utilité (par exemple, un composant terminal défini directement dans un objectif). Dans ce cas, il est autorisé de ne pas nommer l'élément.

Le nom peut être indiqué via la propriété `name` comme dans:

```js
{
  is: "project",
  name: "My project",
  }
```

Dans un espace de nom (cf. § suivant), le nom de l'objet suivi du signe `=` peut aussi être une propriété comme dans l'exemple suivant que l'on peut lire ainsi: soit `myElement` un élément défini avec la couleur bleue:

```js
'myElement=': {
  is: "element",
  color: "blue",
  }
```

A tout élément peut être associé un ensemble d'étiquettes (`tags`) qui permettront de regrouper certains éléments. Par exemple:

```js
'myElement=': {
  is: "element",
  color: "blue",
  tags: [ "beautiful", "tiny" ],
  }
```

Les sept lettres `= : * ? + ! \` sont réservées et ne doivent pas être utilisées dans les noms des éléments car la première sert à la définition ou à l'utilisation d'un élément et les cinq suivantes sont utilisées pour la désignation des groupes en intension (cf. [Utilisation des étiquettes](#Tags)). Si elles apparaissent, elles doivent être escapées par `\`.  
La case des lettres est signifiante.

<a name="Workspace"></a>Espace de travail [☝︎](#☝︎)
-----------------------------------------

Un projet est toujours utiliser dans le contexte d'un espace de travail. La propriété `workspace` définit l'espace de travail du projet.

```js
{
  is: "project",
  name: "My project",
  workspace: "=microstep",
  }
```

Un espace de travail définit tout d'abord un emplacement pour le répertoire de destination des objectifs. Ce répertoire contiendra un certain nombre d'environnements dans lesquels seront rangés les objectifs correspondants. 

Cet espace de travail est un élément défini par ailleurs et qui ressemble à

```js
{
  is: "workspace",
  name: "microstep",
  unix-path: "/opt/microstep",
  windows-path: "c:\opt\microstep",
  }
```

Il est possible dans la ligne de commande du builder de modifier l'espace de travail du projet pour qu'il se construise dans un autre espace (par exemple `microstep2`) en ajoutant l'option: `workspace=microstep2`.

Un ou plusieurs espaces de travail pourront être définis dans un fichier dont le chemin sera fourni au builder.

D'autre part, un espace de travail offre la possibilité de partager des composants (voir [Import/Export](#Import/Export)).

Pour éviter tout conflit, deux projets d'un même espace de travail ne peuvent utiliser le même nom pour un objectif.

<a name="Espace-de-noms"></a>Espace de noms [☝︎](#☝︎)
-------------------------------------------

Certains éléments sont des espaces de noms (au moins les éléments `project`, `group` et `target`). Un espace de nom permet de déclarer des propriétés qui sont des éléments dont le nom suivi du signe `=` est celui de la propriété. Par exemple:

```js
{
  is: "project",
  name: "MicroStep",
  'base=':          {is: "component", compiler: "clang", compilerOptions: {"std":"c11"}},
  'darwin-i386-c=': {is: "component", "arch": "i386", "sysroot": "darwin", components: ["=base"]},
  }
```

Dans cet exemple, `Microstep` est un `project` qui déclare deux éléments `base` et `darwin-i386-c`. Ce dernier élément contient une référence à l'élément `base`, en préfixant le nom de l'élément du signe `=`. Celui-ci est alors recherché dans `darwin-i386-c` puis dans `MicroStep`.

De manière générale, si un élément père P fait référence à un élément E, celui-ci est recherché dans P, puis dans le père de P, et ainsi de suite en remontant jusqu'au projet, et même jusqu'à l'espace de travail si l'élément est importé.

> TODO: puisqu'on a le `=`, même les éléments externes doivent commencer par `=`. Donc revoir la syntaxe pour l'import.

<a name="Groupe"></a>Groupe (`group`) [☝︎](#☝︎)
-------------------------------------

Un groupe est un élément contenant d'autres éléments de même type et/ou des sous-groupes. De plus, un groupe est un espace de noms.

Les sous-éléments peuvent être désignés par leurs noms sous la propriété `elements`. Tous les sous-éléments doivent être de même type (ou des sous-groupes de  type `group`).  
Voici l'exemple un groupe nommé `myGroup` composé des deux éléments `e1` et `e2`.

```js
'myGroup=': {
  is: "group",
  elements: [ "e1", "e2" ],
  }
```

Les sous-éléments peuvent être définis directement dans le groupe comme suit:

```js
'myGroup=': {
  is: "group",
  elements: [ "=e1", "=e2" ],
  'e1=': { is: "xxx", ... },
  'e2=': { is: "xxx", ... },
  }
```

Ou alors:

```js
'myGroup=': {
  is: "group",
  elements: [
    { name: "e1", is: "xxx", ... },
    { name: "e2", is: "xxx", ... },
    ]
  }
```

Si un sous-élément n'est pas défini dans le groupe, il est recherché au même niveau que le groupe puis en remontant jusqu'à l'espace de travail.

Un groupe peut être utilisé partout où une valeur multiple est attendue. Sont alors ajoutés tous les éléments terminaux du groupe et de ses sous-groupes.

Par exemple si on a défini un groupe `commonPublicHeaders` de headers publiques courants, on pourra l'appliquer aux `publicHeaders` d'un objectif particulier comme suit:

```js
'header1=': { is: "file", ... },
'header2=': { is: "file", ... },
'header3=': { is: "file", ... },
'commonPublicHeaders=': {
  is: "group",
  elements: [ "=header1", "=header2" ],
  }
'myTarget=': {
  is: "target",
  publicHeaders: ["=commonPublicHeaders", "=header3"],
  }
```

On peut aussi faire référence à un groupe pour la désignation d'un ensemble de clés prenant les mêmes valeurs comme on le verra au § [Objectif](#Objectif).

La désignation d'un sous-groupe suit la convention `group:subGroup`.

Contrairement aux autres éléments, un groupe ne définit jamais d'étiquettes car cela entretiendrait une confusion. En effet, ces étiquettes pourraient être comprises:

- soit comme appartenant au groupe lui-même,
- soit comme s'appliquant aux éléments terminaux du groupe et de ses sous-groupes.

<a name="Tags"></a>Utilisation des étiquettes (`tags`) [☝︎](#☝︎)
------------------------------------------------------

Les étiquettes permettent de récupérer facilement des ensembles variés d'éléments.

La syntaxe est la suivante : `=GROUPS[?TAGS]`.

Qui s'interprète comme l'ensemble des éléments terminaux du ou des groupes désignés par `GROUPS` et de leurs sous-groupes, disposant du ou des étiquettes `TAGS`. On parle alors de groupe en intension (les groupes vus au § précédent étant des groupes en extension).

Cet ensemble forme lui-même un groupe dont le nom est `GROUPS?TAGS` et qui peut être utilisé, comme tout nom de groupe, partout où une valeur multiple est attendue. `GROUPS` peut être:

- un élément, vu comme le groupe ne contenant que cet élément;
- un groupe;
- un sous-groupe désigné sous la forme `group:subGroup`;
- plusieurs groupes et/ou sous-groupes séparés par des `+` comme par exemple: `group1 + group2:sous-group`. Les blancs autour du `+` ne sont pas considérés comme signifiants. Evidemment, les éléments de chacun des groupes doivent être de même type.

La présence du préfix `=` est la pour signifier que la chaîne représente un groupe d'élements. Ainsi toutes les chaînes de caractères préfixé par `=` dans les propriétés multivaluées des éléments seront interpreté comme faisant référence à un groupe d'élements. Comme lors de la définition des espaces de noms, si le signe `=` fait partie du nom (ce qui est fortement déconseillé), il est nécéssaire de le préfixer d'un caractère d'échappement: `\`. 

Remarque: Il n'est pas possible de désigner les seuls éléments terminaux d'un groupe séparément des éléments terminaux de ses sous-groupes. Pour ce faire, il faudra rassembler les éléments terminaux du groupe dans un sous-groupe spécifique comme dans l'exemple suivant:

```js
'g1=': {
  is: "group",
  elements: [ "=e1", "=e2" , "=sg1" ],
  'sg1=': {
    is: "group",
    elements: [ "=e3" ],
    }
  }

// Si on veut pouvoir désigner les seuls éléments e1 et e2,
// il faudra construire g1 comme suit, les deux éléments pouvant
// alors être désignés par g1:sg0

'g1=': {
  is: "group",
  elements: [ "=sg0" , "=sg1" ],
  'sg0=': {
    is: "group",
    elements: [ "=e1", "=e2" ],
    }
  'sg1=': {
    is: "group",
    elements: [ "=e3" ],
    }
  }
```

On peut ensuite restreindre les éléments de `GROUPS` aux seuls qui satisfont `TAGS`. `TAGS` peut être:

- une étiquette;
- la négation d'une étiquette comme dans `!blue`;
- plusieurs étiquettes (éventuellement niées) séparées par des `+`.

Quelques exemples:

  - `MyGroup1:MyGroup2:MyGroup3`, correspond à l'ensemble des éléments contenus dans le sous-groupe `MyGroup3` du groupe `MyGroup2`, lui même sous-groupe de `MyGroup1`.
  - `?MyTag`: interdit, le groupe doit être indiqué.
  - `MyGroup?`: interdit, n'a pas de signification.
  - `MyGroup+MyElement`, correspond au groupe `MyGroup` auquel on a rajouté l'élément `MyElement`.
  - `environment1 + environment2`, le groupe constitué des deux éléments `environment1` et `environment2`.
  - `Element1 ? Tag1`, Le groupe contenant uniquement `Element1` si ce dernier contient l'étiquette `Tag1`, le groupe vide sinon.
  - `MSCore:file.txt`, Le groupe restreint au fichier `file.txt` de `MSCore`.
  - `MyGroup1+MyGroup2 ? MyTag1+MyTag2+!POSIX`, correspond à l'ensemble des éléments contenus dans l'union des groupes `MyGroup1` et `MyGroup2` et possédant les tags `MyTag1` et `MyTag2` mais pas le tag `POSIX`.
  - dans l'exemple ci-après `publicHeaders` ne comprend que `header1` et `header3` :

```js
'header1=': { is: "file", tags: ["POSIX"], ... },
'header2=': { is: "file", ... },
'header3=': { is: "file", ... },
'commonPublicHeaders=': {
  is: "group",
  elements: [ "=header1", "=header2" ],
  }
'myTarget=': {
  is: "target",
  publicHeaders: ["=commonPublicHeaders?POSIX", "=header3"],
  }
```

<a name="Composant"></a>Composant (`components`) [☝︎](#☝︎)
------------------------------------------------------

Un composant est un élément de type `component` qui peut être composé à partir d'autres composants (via la propriété `components`). Il correspond alors à la fusion de ses propriétés et de celles de tous ses composants.

Exemple:

~~~js
'clang compiler=': {
  is: "component",
  compiler: "clang",
},
'basic flags=': {
  is: "component",
  flags: ["-Werror"],
},
'more flags=': {
  is: "component",
  flags: ["-Wall"],
},
'clang=': {
  is: "component",
  components: ["=clang compiler", "=basic flags", "=more flags"]
},
~~~

Dans l'exemple ci-dessus, le composant `clang` correspond à l'ensemble des propriétés suivantes:

~~~js
'clang=': {
  is: "component",
  compiler: "clang",
  flags: ["-Werror", "-Wall"]
},
~~~

La fusion amène les contraintes suivantes:

- pour les propriétés de type tableau, les valeurs sont fusionnées (ajoutées mais non dupliquées),
- pour les autres propriétés (à valeur simple), les valeurs ne peuvent être qu'identiques (a-t'on vraiment besoin de la redéfinition (surcharge) ? Je suis plutôt contre car c'est un facteur d'erreurs.).
- surcharge pour la propriété `is` (le `is` des sous-composants n'est pas repris).

Comme tout élément, un composant peut avoir des étiquettes et peut être placé dans un groupe.

Définition du projet
=================================

<a name="Fichier"></a>Fichier (`file`) [☝︎](#☝︎)
--------------------------------------

Tous les fichiers utilisés dans des objectifs ou dans des tâches doivent être déclarés dans des groupes.

La propriété `path` du groupe indique alors le chemin relatif des fichiers du groupe par rapport au groupe supérieur ou au projet (ie le dossier contenant le `make.js`). Donc les fichiers d'un groupe sont toujours dans un même dossier. Mais il est possible de constituer plusieurs groupes à partir d'un même dossier.

Toutefois le `path` d'un groupe est absolu s'il commence par `/`.

Un fichier est un élément de type `file` dont le nom est le nom du fichier. 

Exemple:

~~~js
'Sources=': {
  is: "group",
  path: "src",
  elements: [
    {is: "file", name: "MSCore_Private.h"                           },
    {is: "file", name: "MSId.h"          , tags: ["MSPublicHeaders"]},
    {is: "file", name: "MSId.m"                                     },
    ]},
~~~

Plutôt que de fournir les fichiers un par un, on peut aussi utiliser une des trois règles suivantes:

- `*` ou `*.ext` ou `**/*` ou `**/*.ext`;
- ou une RegExp, les fichiers qui passe l'expression régulière sont inclus;
- ou une fonction ayant pour paramètre le nom du fichier, les fichiers pour lesquels cette fonction renvoie `true` sont inclus.

Lors de l'utilisation d'une règle on peut utiliser un paramètre `depth`, optionnel, qui indique la profondeur maximale d'inclusion des fichiers (infinie par défaut).

Exemple:

~~~js
'Sources=': {
  is: "group",
  path: "src",
  elements: [
    {is: "file", name: "*.h"    ,           tags: ["header"]},
    {is: "file", name: /.gif$/  , depth: 4, tags: ["image"] },
    {is: "file", name: (n)=>{return n==="aFile.txt";}       },
    ]},
~~~

<a name="Environnement"></a>Environnement (`environment`) [☝︎](#☝︎)
---------------------------------------------------------

Un environnement est un composant particulier qui ne peut pas contenir d'autres environnements.  
En tant que composant, il peut définir des propriétés et des sous-composants (qui ne sont pas des environnements).  
Un environnement correspond à un paramétrage possible pour un objectif.  
Avec les composants, on peut définir de façon simple des environnements proches sans avoir à répéter toutes les propriétés.

Afin de faciliter les dépendances entre 2 environments proches, il est possible de déclarer l'attribut `compatibleEnvironments`.
Ainsi lorsqu'un objectif cherchera à résoudre une dépendance qui se trouve dans un autre environement, il aura la possibilité de chercher cette dépendance dans les environnements compatibles.
Cela vaut aussi bien pour les dépendances au sein d'un projet que via le système l'import/export.

Le nom de l'environnement correspond aussi au nom du dossier dans lequel les objectifs seront placés après construction (cf Organisation du dossier `microstep` - à écrire !). 

~~~js
'base=': {
  is: "component",
  compiler: "clang",
  flags:    ["-Werror"]
  },
'darwin-i386=': {
  is: "component",
  arch:    "i386",
  sysroot: "darwin"
  },
'cocoa=': {
  is: "component",
  frameworks: ["Foundation"]
  },
'darwin-i386-open=': {
  is: "environment",
  components: ["=base", "=darwin-i386"]
  },
'darwin-i386-cocoa=': {
  is: "environment",
  components: ["=base", "=darwin-i386", "=cocoa"]
  },
'darwin-i386-cocoa-INTERDIT=': { // INTERDIT car darwin-i386-open est un environnement
  is: "environment",
  components: ["=darwin-i386-open", "=cocoa"]
  },
~~~

<a name="Objectif"></a>Objectif (`target`) [☝︎](#☝︎)
------------------------------------------

Un objectif est quelque chose dont on demande la construction, comme une librairie, un exécutable, ...

Un objectif peut être déclaré directement au niveau du projet. Cependant, on nomme souvent un groupe de fichier de la même manière qu'un objectif (ex: un dossier `MSCore` regroupant tous les fichiers permettant la construction d'une librairie `MSCore`). Dans ce cas on peut rassembler les objectifs dans un groupe `Targets` ce qui évite la confusion des noms (cf [Espace de noms](#Espace-de-noms)).

Un objectif peut dépendre d'autres objectifs (`targets`), définis dans le même projet ou dans le même espace de travail, qui seront alors construits préalablement.

Un objectif a toujours un `type` (ex : une application node, un executable, une librairie, ...).

Un objectif donne lieu à autant de construction qu'il a d'environnements déclarés, notamment via la propriété `environments`.

Les composants définissant les paramètres de l'objectif peuvent être déclarés directement dans l'objectif ou avec la propriété `components` s'ils s'appliquent à tous les environnements.

Si l'on veut spécifier des composants qui ne s'appliquent qu'à certains environnements ou si l'on veut spécifier explicitement les composants pour chaque environnement, on peut utiliser la propriété `componentsByEnvironment`, qui est un objet dont les clés sont des environnements ou des groupes d'environnements et les valeurs les composants ou groupes de composants à prendre en compte pour chaque clé donnée.

Les groupes de fichiers à traiter dans tous les environnements peuvent être déclarés avec la propriété `files`.

Si certains groupes de fichiers sont spécifiques à un environnement, on peut soit utiliser `componentsByEnvironment` avec des composants ayant des valeurs de propriétés `files` différentes selon l'environnement, soit déclarer ses fichiers directement sous la propriété `filesByEnvironment`.

En fait, toutes propriété `prop` d'un objectif prenant un ensemble de valeurs existe aussi en version `propByEnvironnement`.

Les environnements qui seront traités seront tous ceux déclarés dans `environments` plus toutes les clés de `componentsByEnvironment`, `filesByEnvironment` et toutes `propByEnvironment`. Ainsi, un objectif peut être parfaitement défini avec simplement les propriétés `environments` et `files`, un autre simplement par la propriété `filesByEnvironment`.

~~~js
'win32-i386=': {
  is: "environment",
  ...
  tags: ["win"]
  },
'win32-ppc=': {
  is: "environment",
  ...
  tags: ["win"]
  },
'win environnements=': {
  is: "group",
  elements: ["=win32-i386", "=win32-ppc"],
  },
'darwin-i386=': {
  is: "environment",
  ...
  },
'all environnements=': {
  is: "group",
  elements: ["=win environnements", "=darwin-i386"],
  },
'Core=': {
  is: "group",
  path: "core",
  elements: ["file1", ...]},
'Sources=': {
  is: "group",
  path: "src",
  elements: [
    {is: "file", name: "*.h", tags: ["header"]        },
    {is: "file", name: "*.m", tags: ["implementation"]},
    {is: "file", name: "*.c", tags: ["POSIX"]         },
    ]},
'paramètres généraux pour les librairies=': {
  is: "component",
  components: [...]
  },
'MyTarget=': {
  is: "target",
  type: "Library",
  files: ["Core", "=Sources?!POSIX"],
  filesByEnvironment: {
    "darwin-i386":        ["=Sources?POSIX"],
    },
  components: ["paramètres généraux pour les librairies"],
  },
~~~

Ecriture 2

~~~js
  files: ["Core"],
  filesByEnvironment: {
    "win environnements":     ["=Sources?!POSIX"],
    "darwin-i386":            ["=Sources"],
    },
~~~

Ecriture 3

~~~js
  filesByEnvironment: {
    "all environnements":     ["=Core"],
    "win environnements":     ["=Sources?!POSIX"],
    "darwin-i386":            ["=Sources"],
    },
~~~

Ecriture 4 avec un groupe d'environnements en intension `all environnements?win`:

~~~js
  filesByEnvironment: {
    "all environnements":     ["=Core"],
    "all environnements?win": ["=Sources?!POSIX"],
    "darwin-i386":            ["=Sources"],
    },
~~~

Ecriture 4

~~~js
  filesByEnvironment: {
    "darwin-i386":        ["=Core", "=Sources"],
    "win environnements": ["=Core", "=Sources?!POSIX"],
    },
~~~

On peut déclarer des éléments directement dans un objectif, ce qui en fait un espace de noms.

~~~js
'MyTarget=': {
  is: "target",
  ...
  'MSSTD_EXPORT=':          {is: "component", defines: ["MSSTD_EXPORT=1"]},
  'MSFOUNDATION_FORCOCOA=': {is: "component", defines: ["MSFOUNDATION_FORCOCOA=1"]},
  componentsByEnvironment: {
    "some envs":  ["MSSTD_EXPORT"],
    "other envs": ["MSFOUNDATION_FORCOCOA"],
    },
  },
~~~

<a name="Tâche"></a>Tâche (`run`) [☝︎](#☝︎)
---------------------------------

Une tâche est un élément (composant ?) qui définit:

- `targets`, la liste des objectifs nécessaires pour pouvoir exécuter la tâche;
- `command`, la commande à exécuter.

<a name="Import/Export"></a>Import/Export [☝︎](#☝︎)
-----------------------------------------

Tout composant définit dans le projet peut être exporté par un objectif pour partager des paramètres de construction entre projets au sein de l'espace de travail.

Un objectif est par définition toujours exporté par un projet.

L'export se déclare au niveau de chaque objectif comme pour les fichiers et les composants avec les propriétés `exports` et `exportsByEnvironment`.

Dès lors, pour accéder à ces éléments depuis un autre projet (toujours au sein du même espace de travail), il suffit d'utiliser la syntaxe `::[env:]target::[component]`, où:

- `env` si fourni, c'est le nom de l'environnement dans lequel il faut rechercher l'objectif contenant les composants exportés.
- `target` est le nom de l'objectif contenant les composants exportés (dans notre exemple: `ATarget`)
- `component` si fourni est le nom du composant exporté à accéder

Lors de la construction du objectif, on créera un fichier `Nom de mon objectif.make.js` contenant le ou les composants à exporter. 
Ce fichier sera déposé dans le dossier `.shared` de l'environement.

Le composant à importer est recherché dans l'espace de travail courant et dans le répertoire `.shared` de l'environment en cours de construction.
Il est nécéssaire que le composant demandé existe et qu'il soit unique au sein de l'espace de travail.

Dans l'exemple ci-dessous, on exporte juste le composant `posix component` pour la target `ATarget` dans l'environnement `darwin-i386`.

~~~js
'posix component=': {
  is: "component",
  ...
  },
'darwin-i386=': {
  is: "environment",
  components: ["=posix component", ...]
  },
'ATarget=': {
  is: "target",
  ...
  filesByEnvironment: {
    "darwin-i386":        ["=Core", "=Sources"],
    "win environnements": ["=Core", "=Sources?!POSIX"],
    },
  exportsByEnvironment: {
    "darwin-i386":        ["=posix component"],
    },
  },
~~~

Dans l'exemple ci-dessus, lors de la construction de l'objectif dans l'environnement cible `darwin-i386`, on créera un fichier `ATarget.make.js` contenant le `posix component`. 
Ce fichier sera déposé dans le dossier `.shared` de l'environement.

Le fichier d'export de l'exemple précédent donnera:

~~~js
{
  is: "export",
  'posix component=': {
    is: "component",
    ...
  },
}
~~~


<a name="Méthodes"></a>Méthodes sur les éléments [☝︎](#☝︎)
------------------------------------------------

Certains make demandent des opérations vraiment spécifiques.   
Pour résoudre se problème, il est possible d'exécuter une fonction sur le ou les éléments du groupe résolue. Pour ce faire, la syntaxe de résolution accepte d'être suffixé par la syntaxe: `?? nom_de_la_méthode()`.

Le contenu retourné par la méthode sera alors ajouter à la liste des valeurs.

 > TODO: Fusionner ceci avec la définition de la syntaxe de résolution + exemple

La liste des méthodes spécifiques est décrite élément par élément dans le document [API](api.md).

<a name="MSFoundation"></a>Exemple MSFoundation [☝︎](#☝︎)
-----------------------------------------------

> TODO: A mettre à jour une fois le make.js valide selon la nouvelle définition 

~~~js
module.exports= {          // LIGNE A SUPPRIMER
  is: "project",
  name: "MicroStep", // Name of the project
  'base=': {
    is: "component",
    compiler: "clang",
    compilerOptions: {"std":"c11"},
    directories: {
      publicHeaders: "include",
      target: {
        "Library": "lib",
        "Framework": "framework",
        "Executable": "bin",
        "Bundle": "bundle",
        "CXXExternal": "lib"
        }}},
  'cocoa-base=': {is: "component", frameworks: ["Foundation"]},

  'msobjclib=':  {is: "component", libraries: ["deps/msobjclib"]}, // deps ??? pourquoi pas juste ::env::msobjclib que l'on recherche dans microstep/env/lib/msobjclib où env est explicite ou * si c'est celui de la target

  'libs=':       {is: "group", elements: ["libffi", "libuv", "msstdlib" , "openssl"]},
  'libffi=':     {is: "component", libraries: ["deps/libffi"  ], "includeDirectories": ["deps/libffi/include","deps/libffi/src/x86"]},
  'libuv=':      {is: "component", libraries: ["deps/libuv"   ], "includeDirectories": ["deps/libuv/include"]},
  'openssl=':    {is: "component", libraries: ["deps/openssl" ]},
  'msstdlib=':   {is: "component", libraries: ["deps/msstdlib"], "includeDirectories": ["deps/msstdlib"]},

  // inclusion des "libs" à revoir, je n'ai ps bien compris dans quels environnements ils allaient
  'darwin-i386-c=':   {is: "component", "arch": "i386"       , "sysroot": "darwin", components: ["base", "libs"]},
  'darwin-x86_64-c=': {is: "component", "arch": "x86_64"     , "sysroot": "darwin", components: ["base", "libs"]},
  'darwin-univ-c=':   {is: "component", "arch": "i386,x86_64", "sysroot": "darwin", components: ["base"]},
  'linux-i386-c=':    {is: "component", "arch": "i386"       , "sysroot": "linux" , components: ["base", "libs"], tags: ["linux"]},
  'linux-x86_64-c=':  {is: "component", "arch": "x86_64"     , "sysroot": "linux" , components: ["base", "libs"]},
  'msvc12-i386-c=':   {is: "component", "arch": "i386"       , "sysroot": "msvc"  , components: ["base", "libs"]},
  'msvc12-x86_64-c=': {is: "component", "arch": "x86_64"     , "sysroot": "msvc"  , components: ["base", "libs"]},
  'wo451-i386-c=':    {is: "component", "arch": "i386"       , "sysroot": "wo451" },

  'darwin-i386=':   {is: "environment", components: ["darwin-i386-c"  ]},
  'darwin-x86_64=': {is: "environment", components: ["darwin-x86_64-c"]},
  'darwin-univ=':   {is: "environment", components: ["darwin-univ-c"  ]},
  'linux-i386=':    {is: "environment", components: ["linux-i386-c"   ]},
  'linux-x86_64=':  {is: "environment", components: ["linux-x86_64-c" ]},
  'msvc12-i386=':   {is: "environment", components: ["msvc12-i386-c"  ]},
  'msvc12-x86_64=': {is: "environment", components: ["msvc12-x86_64-c"]},
  'wo451-i386=':    {is: "environment", components: ["wo451-i386-c"]},

  'darwin-i386-foundation=':   {is: "environment", components: ["darwin-i386-c"  ]},
  'darwin-x86_64-foundation=': {is: "environment", components: ["darwin-x86_64-c"]},
  'darwin-univ-foundation=':   {is: "environment", components: ["darwin-univ-c"  ]},
  'linux-i386-foundation=':    {is: "environment", components: ["linux-i386-c"   ]},
  'linux-x86_64-foundation=':  {is: "environment", components: ["linux-x86_64-c" ]},
  'msvc12-i386-foundation=':   {is: "environment", components: ["msvc12-i386-c"  ]},
  'msvc12-x86_64-foundation=': {is: "environment", components: ["msvc12-x86_64-c"]},

  'darwin-i386-cocoa=':        {is: "environment", components: ["darwin-i386-c"  , "cocoa-base"]},
  'darwin-x86_64-cocoa=':      {is: "environment", components: ["darwin-x86_64-c", "cocoa-base"]},
  'darwin-univ-cocoa=':        {is: "environment", components: ["darwin-univ-c"  , "cocoa-base"]},

  'core envs=': {is: "group", elements: [
    "darwin-i386", "darwin-x86_64", "linux-i386" , "linux-x86_64" , "msvc12-i386", "msvc12-x86_64"]},
  'core and 451 envs=': {is: "group", elements: [
    "core envs", "msvc12-x86_64"]},
  'foundation envs=': {is: "group", elements: [
    "darwin-i386-foundation", "darwin-x86_64-foundation",
    "linux-i386-foundation" , "linux-x86_64-foundation" ,
    "msvc12-i386-foundation", "msvc12-x86_64-foundation"
    ]},
  'cocoa envs=': {is: "group", elements: [
    "darwin-i386-cocoa", "darwin-x86_64-cocoa"]},
  'node envs=': {is: "group", elements: [
    "darwin-x86_64-foundation", "darwin-x86_64-cocoa", "linux-x86_64-foundation"]},

  'MSCore=': {is: "group", elements:["Headers", "Abstraction", "Sources", "Object", "MAPM", "Tests"],
    'Headers=': {is: "group", path: "MSCore_src", elements:[
      {is: "file", name: "MSCore.h"        , tags: ["MSCorePublicHeader"]},
      {is: "file", name: "MSCore_Public.h"                               },
      {is: "file", name: "MSCore_Private.h"                              },
      ]},
    'Abstraction=': {is: "group", path: "MSCore_src", elements:[
      {is: "file", name: "MSCoreTypes.h"        , tags: ["MSPublicHeader"]},
      {is: "file", name: "MSCoreSystem.h"       , tags: ["MSPublicHeader"]},
      {is: "file", name: "MSCoreSystem.c"       ,                          },
      {is: "file", name: "MSCoreTools.h"        , tags: ["MSPublicHeader"]},
      {is: "file", name: "MSCoreTools.c"        ,                          },
      {is: "file", name: "MSCoreToolsCompress.c",                          },
      ]},
    'Sources=': {is: "group", path: "MSCore_src", elements:[
      {is: "file", name: "MSCArray.h"     , tags: ["MSPublicHeader"]},
      {is: "file", name: "MSCArray.c"                               },
      {is: "file", name: "MSCBuffer.c"                              },
      {is: "file", name: "MSCArray.md"                              },
      {is: "file", name: "MSCColor.c"                               },
      {is: "file", name: "MSCBuffer.h"    , tags: ["MSPublicHeader"]},
      {is: "file", name: "MSCCouple.c"                              },
      {is: "file", name: "MSCColor.h"     , tags: ["MSPublicHeader"]},
      {is: "file", name: "MSCDate.c"                                },
      {is: "file", name: "MSCCouple.h"    , tags: ["MSPublicHeader"]},
      {is: "file", name: "MSCDate.h"      , tags: ["MSPublicHeader"]},
      {is: "file", name: "MSCDecimal.h"   , tags: ["MSPublicHeader"]},
      {is: "file", name: "MSCDecimal.c"                             },
      {is: "file", name: "MSCDictionary.h", tags: ["MSPublicHeader"]},
      {is: "file", name: "MSCDictionary.c"                          },
      {is: "file", name: "MSCGrow.h"      , tags: ["MSPublicHeader"]},
      {is: "file", name: "MSCGrow.c"                                },
      {is: "file", name: "MSCMessage.h"   , tags: ["MSPublicHeader"]},
      {is: "file", name: "MSCMessage.c"                             },
      {is: "file", name: "MSCObject.h"    , tags: ["MSPublicHeader"]},
      {is: "file", name: "MSCString.h"    , tags: ["MSPublicHeader"]},
      {is: "file", name: "MSCString.c"                              },
      {is: "file", name: "MSCTraverse.h"  , tags: ["MSPublicHeader"]},
      {is: "file", name: "MSCTraverse.c"                            },
      {is: "file", name: "MSCoreSES.h"    , tags: ["MSPublicHeader"]},
      {is: "file", name: "MSCoreSES.c"                              },
      {is: "file", name: "MSCoreUnichar.h", tags: ["MSPublicHeader"]},
      {is: "file", name: "MSCoreUnichar_Private.h"                  },
      {is: "file", name: "MSCoreUnichar.c"                          },
      {is: "file", name: "MSTE.h"                                   },
      {is: "file", name: "MSTE.c"                                   },
      ]},
    'Object=': {is: "group", path: "MSCore_src", elements:[
      {is: "file", name: "MSCObject.c"},
      ]},
    'MAPM=': {is: "group", path: "MSCore_src/MAPM_src", elements:[
      {is: "file", name: "m_apm.h", tags: ["MSPublicHeader"]},
      {is: "file", name: "m_apm_lc.h"},
      ...
      ]},
    'Tests=': {is: "group", path: "MSCore_tst", elements:[
      {is: "group", name:"MAPM", path: "MAPM_tst", elements:[
        {is: "file", name: "mapm_validate.c"}]},
      {is: "file", name: "mscore_c_validate.c"          },
      ...
      ]}
    },
  'Foundation=': {is: "group", elements:["Headers", "Sources", "Tests"],
    'Headers=': {...},
    'Sources=': {...},
    'Tests=':   {...},
    },
  'MSFoundation=': {is: "group", elements:["Headers", "Sources", "Basics", "Tests"]
    'Headers=': {...},
    'Sources=': {...},
    'Basics=':  {...},
    'Tests=':   {...},
    },
  'Test Core=': {is: "group", path: "MSCore_tst", elements:[
    {is: "file", name: "mscore_test.c"}
    ]},
  'Test Foundation=': {is: "group", path: "MSFoundation_tst", elements:[
    {is: "file", name: "msfoundation_test.m"}
    ]},
  'MSNet=': {is: "group", path: "MSNet_src", elements:[
    {is: "group", name:"Crypto", path: "Crypto_src", elements:[
      {is: "file", name: "*.h", tags: ["MSPublicHeader"]},
      {is: "file", name: "*.m"                           },
      ]},
    ... // files
    ]},
  'MSServer=': {is: "group", path: "MHServer_src", elements:[
    {is: "file", name: "MASHServer.config"},
    {is: "file", name: "MASHServer_main.m"},
    ]},
  'MSDatabase=': {is: "group", elements:["MySQLAdaptor", "SQLCipherAdaptor", "ODBCAdaptor", "OCIAdaptor", "Headers", "Sources", "Tests"]
    'MySQLAdaptor=':     {...},
    'SQLCipherAdaptor=': {...},
    'ODBCAdaptor=':      {...},
    'OCIAdaptor=':       {...},
    'Headers=': {...},
    'Sources=': {...},
    'Tests=':   {...},
    },
  'MSNode=': {is: "group", elements:["Sources", "Tests"],
    'Sources=': {...},
    'Tests=':   {...},
    },
  'MHMessenger=': {is: "group", elements:["Framework", "WebApp", "Resources"],
    'Framework=': {...},
    'WebApp=':    {...},
    'Resources=': {...},
    },
  'MHRepository=': {is: "group", elements:["Framework", "Server", "WebApp"],
    'Framework=': {...},
    'Server=':    {...},
    'WebApp=':    {...},
    },

  // on crée un groupe targets juste pour ne pas avoir de conflit de noms
  'Targets=': {is: "group", elements:["MSCore", "MSCoreTests", "xxx", "xxx", "xxx", "xxx", "xxx"],
    'MSCore=': {
      is: "target",
      type: "Library",
      environments: ["core and 451 envs"],
      files: ["MSCore.Headers", "MSCore.Abstraction", "MSCore.Sources", "MSCore.Object", "MSCore.MAPM"],
      componentsByEnvironment: {
        "core envs?linux": [{is: "component", linkFlags: ["-Wl","--version-script"]}],
        },
      publicHeaders: ["MSCore:**?MSCorePublicHeader", "MSCore:**?MSPublicHeader"],
      components:[
        {is: "component", name:"MSCORE_STANDALONE", defines: ["MSCORE_STANDALONE"]},
        ],
      defines: ["MSSTD_EXPORT"],
/*
      ??????????????????????????????????????????????? target.resolvePath('MSCore_src/MSCVersionScript.txt')
      Quoiqu'il arrive c'esst un composant {is: "component", linkFlags:[]} mais il faut réfléchir sur le resolvePath
      "MSCore_src:MSCVersionScript.txt:path" ?
      configure: function(target) {
        target.addLinkFlags(['-Wl,--version-script,' + target.resolvePath('MSCore_src/MSCVersionScript.txt')]);
        },
*/
      exports: ["MSCORE_STANDALONE"], // Dans ce cas, c'est pas la bonne méthode, il faut que le .h du MSCore contienne MSCORE_STANDALONE dans les environnements core. Mais c'est un autre débat. Idem pour MSFOUNDATION_FORCOCOA.
      },
    'MSCoreTests=': {
      is: "target",
      type: "Library",
      targets: ["MSCore", "MSTests"],
      filesByEnvironment: {
        "core and 451 envs":  ["MSCore.Tests", "Test Core"],
        },
      includeDirectoriesOfFiles: ["MSCore", "MSTests"], // ???
      },
    'MSTests=': {
      is: "target",
      type: "Executable",
      targets: ["MSCore"],
      filesByEnvironment: {
        "core envs + foundation envs + cocoa envs": ["MSTests"],
        },
      componentsByEnvironment: {
        "core envs + foundation envs + cocoa envs?linux": [{is: "component", libraries: ["-ldl", "-lpthread", "-lrt"]}],
        },
      publicHeaders: ["MSTests?MSPublicHeader"],
      },
    'MSFoundation=': {
      is: "target",
      type: "Framework",
      targets: ["MSCore"],
      files: [
        "MSCore.Abstraction", "MSCore.Sources", "MSCore.MAPM",
        "MSFoundation.Headers", "MSFoundation.Sources", "MSFoundation.Basics",
        ],
      'MSSTD_EXPORT=':          {is: "component", defines: ["MSSTD_EXPORT=1"]},
      'MSFOUNDATION_FORCOCOA=': {is: "component", defines: ["MSFOUNDATION_FORCOCOA=1"]},
      componentsByEnvironment: {
        "core envs + foundation envs": ["msstdlib", "msobjclib", "libuv", "libffi", "MSSTD_EXPORT"],
        "cocoa envs":                  ["msstdlib",                                 "MSFOUNDATION_FORCOCOA"],
        },
      publicHeaders: ["MSCore?MSPublicHeader", "MSFoundation?MSPublicHeader"],
      },
    },
  };
}
~~~