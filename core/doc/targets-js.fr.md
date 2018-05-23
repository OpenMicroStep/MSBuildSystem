# Objectifs de compilation Javascript

## JSTarget

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

Compilateur nommé `typescript`, `ts` compatible avec l'objectif de compilation `JSTarget`.

#### `tsConfig: dictionary`

Options de compilation typescript (voir: https://www.typescriptlang.org/docs/handbook/compiler-options.html).

#### `npmInstall`

Liste des paquets npm nécéssaire à la compilation.
