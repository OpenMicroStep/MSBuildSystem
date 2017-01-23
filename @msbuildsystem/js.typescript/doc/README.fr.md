js.typescript
=============

Module fournissant le support de la compilation vers du **javascript** via le compilateur **typescript**

L'objectif de ce module est de fournir le nécéssaire pour avoir au minimum les mêmes capacités que le fichier `tsconfig.json`.

Afin de garantir le bon fonctionnemnt des outils relatifs à typescript, la compatibilité avec le fichier `tsconfig.json` sera garder dans la mesure du possible.


Usage
-----

### make.js

```js
{
  type: "javascript", // typescript n'est pas une target différente de javascript, c'est simplement un moyen de compilation
  compiler: "typescript",
  tsConfig: [{ /* les mêmes options que les compilerOptions de tsconfig.json */ }],
}
```

### generation

 - `tsconfig`: ask the buildsystem to generate the best tsconfig.json possible
 - `vscode`: ask the buildsystem to provide the best integration possible with vscode

