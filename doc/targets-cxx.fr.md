# Objectifs de compilation C/C++

## CompilerOptions

#### `language?: string`
#### `compiler?: string`
Les valeurs courantes sont: `clang`, `gcc`, `msvc`.

#### `defines?: string[]`
La liste des valeurs prédéfinit qui seront passés au préprocesseur.  
Les valeurs ont la forme "NOM" ou "NOM=VALEUR".  

#### `compileFlags?: string[]`
La liste des arguments à passer au compilateur.

#### `includeDirectories?: Directory[]`
La liste des répertoires à utiliser pour la recherche des fichiers en-têtes lors de la compilation.  

#### `frameworkDirectories?: Directory[]`
La liste des répertoires à utiliser pour la recherche des frameworks lors de la compilation.  

## LinkerOptions

#### `linker?: string`
#### `linkFlags?: string[]`
La liste des arguments à passer au linker.

#### `libraries?: string[]`
La liste des libraries utilisés pour l'étape de link.  

#### `archives?: string[]`
La liste des archives utilisés pour l'étape de link.  

#### `libDirectories?: Directory[]`
La liste des répertoires à utiliser pour la recherche des libraries.  

#### `frameworkDirectories?: Directory[]`
La liste des répertoires à utiliser pour la recherche des frameworks.  

## CXXTarget

### Attributs permettant et/ou définit par le kit de compilation

#### `arch?`

L'architecture cible de la compilation.  
Les valeurs courantes sont: `i386`, `x86_64`, `armv7`.

#### `sysroot?`

Le sysroot cible de la compilation.
Le format est le suivant: `platform:arch@version`.
Les valeurs courantes sont: `darwin:i386`, `darwin:x86_64`, `linux:armv7`, `msvc`, `mingw-w64`.

#### `compilerOptions?`

Dictionaire des options de compilation (voir `CompilerOptions`).

#### `linkerOptions?`

Dictionaire des options pour l'édition des liens (voir `LinkerOptions`).


#### `files: Map<File, CompilerOptions>`

La liste des fichiers à compiler. Il est possible de définir des options de compilation par fichier.  


## CXXExecutable

C'est une extension de l'objectif **CXXTarget**.  
Le résultat de la compilation sera un exécutable.  
Cet objectif de compilation n'ajoute aucun attribut supplémentaire.

## CXXLibrary

C'est une extension de l'objectif **CXXTarget**.  
Le résultat de la compilation sera une librarie.  

#### `publicHeaders`

La liste des fichiers formant les en-têtes publiques.
Il est possible de définir un répertoire de destination via la clé `dest`.  
Il est possible de définir le fait que le placement des en-têtes reprenent la partie du chemin qui diffère entre eux en définissant la clé `expand` à `true`. 
Par exemple les fichiers `dir1/dir2/header1.h` et `dir1/dir3/header2.h` seront copiés dans `dir2/header1.h` et `dir3/header2.h`.

#### `publicHeadersBasePath`

Chemin préfixant le chemin du header, `"includes"` par défaut.

#### `publicHeadersFolder`

Chemin préfixant `publicHeadersBasePath`, le nom de la target par défaut.


## CXXFramework

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

#### `bundleBasePath`

Chemin préfixant le chemin du bundle, `"includes"` par défaut.

#### `bundleResourcesBasePath`

Chemin préfixant le chemin des resources du bundle, `"Resources"` par défaut.

#### `bundleInfoPath`

Chemin du fichier info du bundle, `"Info.plist"` par défaut.

#### `resources`

La liste des resources à inclure dans le framework.
Il est possible de définir un répertoire de destination via la clé `dest`.  
Il est possible de définir le fait que le placement des en-têtes reprenent la partie du chemin qui diffère entre eux en définissant la clé `expand` à `true`. Par example les fichiers `dir1/dir2/myfile1.jpg` et `dir1/dir3/myfile2.jpg` seront copiés dans `dir2/myfile1.jpg` et `dir3/myfile2.jpg`.

## CXXBundle

C'est une extension de l'objectif **Framework**.  
Cet objectif de compilation n'ajoute aucun attribut supplémentaire.


