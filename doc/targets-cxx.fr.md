# Objectifs de compilation C/C++

## CXXTarget


### Attributs permettant et/ou définit par le kit de compilation

#### `arch`

L'architecture cible de la compilation.  
Les valeurs courantes sont: `i386`, `x86_64`, `armv7`.

#### `sysroot`

Le sysroot cible de la compilation.  
Les valeurs courantes sont: `darwin`, `linux`, `msvc`, `mingw-w64`.
Il est possible de définir une condition sur le numéro de version: 
 - pour une version en particulier, ex: `{value: "darwin", version: "10.10"}`,
 - pour une version minimal, ex: `{value: "darwin", minVersion: "10.10"}`,
 - pour une version maximal, ex: `{value: "darwin", maxVersion: "10.10"}`,
 - pour un ensemble de versions, ex: `{value: "darwin", versions: ["10.9", "10.10"]}`
 - pour un range de versions, ex: `{value: "darwin", minVersion: "10.10", maxVersion: "10.11"}`

#### `platform`

La plateforme cible de la compilation.  
Les valeurs courantes sont: `darwin`, `linux`, `win32`.

#### `compiler`

Le compilateur à utiliser pour la compilation.  
Les valeurs courantes sont: `clang`, `gcc`.
Il est possible de définir une condition sur le numéro de version: 
 - pour une version en particulier, ex: `{value: "clang", version: "3.8"}`,
 - pour une version minimal, ex: `{value: "clang", minVersion: "3.8"}`,
 - pour une version maximal, ex: `{value: "clang", maxVersion: "3.8"}`,
 - pour un ensemble de versions, ex: `{value: "clang", versions: ["3.7", "3.8"]}`
 - pour un range de versions, ex: `{value: "clang", minVersion: "3.6", maxVersion: "3.8"}`

### Autres attributs

#### `files`

@ListAttribute({
  type: "file",
  scope: "task",
  
})

La liste des fichiers à compiler.  
Si des en-têtes sont fournis, les répertoires qui les contiennents sont ajoutés aux répertoires de recherches des en-têtes.  
Les valeurs ont le format définit pour trouver les fichiers a partir des groupes et des tags.  
Il est possible de définir une condition relative à l'objectif.

```js
[
  "AllFilesInThisGroup",
  "AllFilesInThisGroup.AndThatAreInThisSubGroup",
  "?AllFilesWithThisTag",
  "?AllFilesWithThisTag?AndThisTag",
  "AllFilesInThisGroup?AndThisTag?AndThisOtherTag",
  {add: ["AllFilesInThisGroup?Win32"], ifTarget: target => target.platform === "win32"},
]
```

#### `includeDirectories`

La liste des répertoires à utiliser pour la recherche des fichiers en-têtes lors de la compilation.  
Cet attributs est à utiliser si les répertoires ne font pas partie des fichiers du projet, sinon il suffit d'ajouter les fichiers en-têtes via l'attribut `files` pour qu'automatiquement les répertoires qui les contiennent soient ajoutés.
Il est possible de définir une condition relative à l'objectif.  
Il est possible de définir une condition relative à la tâche.  
Il est possible d'exporter les valeurs.

#### `publicHeaders`

La liste des fichiers formant les en-têtes publiques.
Les valeurs ont le format définit pour trouver les fichiers a partir des groupes et des tags.  
Il est possible de définir une condition relative à l'objectif.  
Il est possible de définir un répertoire de destination via la clé `dest`.  
Il est possible de définir le fait que le placement des en-têtes reprenent la partie du chemin qui diffère entre eux en définissant la clé `expand` à `true`. Par example les fichiers `dir1/dir2/header1.h` et `dir1/dir3/header2.h` seront copiés dans `dir2/header1.h` et `dir3/header2.h`.

```js
[
  "AllHeadersInThisGroup",
  "AllHeadersInThisGroup.AndThatAreInThisSubGroup",
  "?AllHeadersWithThisTag",
  "?AllHeadersWithThisTag?AndThisTag",
  "AllHeadersInThisGroup?AndThisTag?AndThisOtherTag",
  {add: ["AllHeadersInThisGroup?Win32"], ifTarget: target => target.platform === "win32"},
  {add: ["AllHeadersInThisGroup?Win32"], dest: "PutThemInThisDirectory"},
  {add: ["AllHeadersInThisGroup?Win32"], expand: true}, // keep the filesystem structure
]
```

#### `defines`

La liste des valeurs prédéfinit qui seront passés au préprocesseur.  
Les valeurs ont la forme "NOM" ou "NOM=VALEUR".  
Il est possible de définir une condition relative à l'objectif.  
Il est possible de définir une condition relative à la tâche.  
Il est possible d'exporter les valeurs.

#### `compileFlags`

La liste des arguments à passer au compilateur.
Il est possible de définir une condition relative à l'objectif.  
Il est possible de définir une condition relative à la tâche.  
Il est possible d'exporter les valeurs.

#### `linkFlags`

La liste des arguments à passer au linker.
Il est possible de définir une condition relative à l'objectif.  
Il est possible de définir une condition relative à la tâche.  
Il est possible d'exporter les valeurs.

#### `libraries`

La liste des libraries utilisés pour l'étape de link.  
Il est possible de définir une condition relative à l'objectif.  
Il est possible de définir une condition relative à la tâche.  
Il est possible d'exporter les valeurs.

#### `archives`

La liste des archives utilisés pour l'étape de link.  
Il est possible de définir une condition relative à l'objectif.  
Il est possible de définir une condition relative à la tâche.  
Il est possible d'exporter les valeurs.

#### `frameworks`

La liste des frameworks utilisés pour la compilation et le link.  
Il est possible de définir une condition relative à l'objectif.  
Il est possible de définir une condition relative à la tâche.  
Il est possible d'exporter les valeurs.

#### `compileOptions`

La liste des options qui seront passées au compilateur. 
Chaque option est définit par un couple clé valeur.
Il est préférable d'utiliser les options plutot que les arguments, si ceux si existent.   
Ces options seront directement interpreté par les taches de compilation qui se chargeront de les transformers en arguments.  
Les options non supporté par une tache sont remontées lors de la création du graphe de compilation.  
Il est possible de définir une condition relative à l'objectif.  
Il est possible de définir une condition relative à la tâche.  
Il est possible d'exporter les valeurs.

```js
[
  {std: "c11", warnings: ["all", "error"]},
  {warnings: ["unused"]},
  {add: [{ "no-exceptions": true }], ifTarget: target => target.sysroot === "msvc"},
  {rm : [{ warnings: ["unusued"] }], ifFile  : ["?DontWarnOnUnused"]              },
]
```

#### `linkOptions`

La liste des options qui seront passées au linker.
Chaque option est définit par un couple clé valeur.
Il est préférable d'utiliser les options plutot que les arguments, si ceux si existent.   
Ces options seront directement interpreté par les taches de link qui se chargeront de les transformers en arguments.  
Les options non supporté par une tache sont remontées lors de la création du graphe de compilation.  
Il est possible de définir une condition relative à l'objectif.  
Il est possible de définir une condition relative à la tâche.  
Il est possible d'exporter les valeurs.


## Executable

C'est une extension de l'objectif **CXXTarget**.  
Le résultat de la compilation sera un exécutable.  
Cet objectif de compilation n'ajoute aucun attribut supplémentaire.

## Library

C'est une extension de l'objectif **CXXTarget**.  
Le résultat de la compilation sera une librarie.  
Cet objectif de compilation n'ajoute aucun attribut supplémentaire.


## Framework

C'est une extension de l'objectif **Library**.  
Le résultat de la compilation sera un framework (librarie + entêtes + resources).

### Attributs

#### `bundleInfo`

Les propriétés du framework.

```js
{
  "CFBundleIdentifier": "org.microstep.foundation",
  "NSPrincipalClass": "MyPrincipalClass"
}
```

#### `resources`

La liste des resources à inclure dans le framework.
Les valeurs ont le format définit pour trouver les fichiers a partir des groupes et des tags.  
Il est possible de définir une condition relative à l'objectif.  
Il est possible de définir un répertoire de destination via la clé `dest`.  
Il est possible de définir le fait que le placement des en-têtes reprenent la partie du chemin qui diffère entre eux en définissant la clé `expand` à `true`. Par example les fichiers `dir1/dir2/myfile1.jpg` et `dir1/dir3/myfile2.jpg` seront copiés dans `dir2/myfile1.jpg` et `dir3/myfile2.jpg`.

```js
[
  "AllResourcesInThisGroup",
  "AllResourcesInThisGroup.AndThatAreInThisSubGroup",
  "?AllResourcesWithThisTag",
  "?AllResourcesWithThisTag?AndThisTag",
  "AllResourcesInThisGroup?AndThisTag?AndThisOtherTag",
  {add: ["AllResourcesInThisGroup?Win32"], ifTarget: target => target.platform === "win32"},
  {add: ["AllResourcesInThisGroup?Win32"], dest: "PutThemInThisDirectory"},
  {add: ["AllResourcesInThisGroup?Win32"], expand: true}, // keep the filesystem structure
]
```

## Bundle

C'est une extension de l'objectif **Framework**.  
Cet objectif de compilation n'ajoute aucun attribut supplémentaire.


