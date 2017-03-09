# Objectifs de compilation Javascript

## JSTarget

### Attributs permettant et/ou définit par le kit de compilation

#### `compiler?`

Le système de compilation à utiliser.
Les valeurs courantes sont: `typescript`.

#### `packager?`

Le système de packaging à utiliser.
Les valeurs courantes sont: `npm`.

#### `compilerOptions?`

Dictionaire des options de compilation (voir `CompilerOptions`).

#### `linkerOptions?`

Dictionaire des options pour l'édition des liens (voir `LinkerOptions`).


#### `files: File[]`

La liste des fichiers à compiler.


## NPMPackager

Packager nommé `npm` compatible avec l'objectif de compilation `JSTarget`.

#### `npmPackage`

Le contenu du fichier `package.json`.

## TypescriptCompiler

Packager nommé `npm` compatible avec l'objectif de compilation `JSTarget`.

#### `tsConfig`

Options de compilation typescript.

#### `npmInstall`

Liste des paquets npm nécéssaire à la compilation.
