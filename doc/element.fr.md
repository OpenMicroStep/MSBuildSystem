Element
=======

Un **élément** (`element`) est un objet javascript ayant un nom, une propriété `is` précisant la nature de l'élément et éventuellement des étiquettes (`tags`) permettant de le colorer.

Un élément contient toujours une propriété `is` qui désigne le type de l'élément (par exemple `project`, `component`, `target`, etc.). Selon le type de l'élément, certaines propriétés auront des significations particulières.  
Les propriétés spécifiques de chaque élément sont décrites de manière exhaustive dans la documentation associé à chaque élément.

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
La casse des lettres est signifiante.

Espace de noms
--------------

Tout élément est un espace de noms. Un espace de nom permet de déclarer des propriétés qui sont des éléments dont le nom suivi du signe `=` est celui de la propriété. Par exemple:

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

Groupe
------

Un groupe est un élément contenant d'autres éléments de même type et/ou des sous-groupes.

Les sous-éléments peuvent être désignés par leurs noms sous la propriété `elements`. Tous les sous-éléments doivent être de même type (ou des sous-groupes dont les sous-éléments sont de même types).  

Un groupe peut porter des attributs, c'est attributs sont alors reportés sur l'ensemble des sous-éléments du groupe. Si des sous-groupes portent des attributs ceux-ci sont ajoutés et ont priorité sur ceux ajoutés par les sur-groupes pour l'ensemble des sous-éléments qu'ils contiennent.

Voici l'exemple d'un groupe nommé `myGroup` composé des deux éléments `e1` et `e2`.

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

Contrairement aux autres éléments, un groupe ne définit jamais d'étiquettes car cela entretiendrait une confusion. En effet, ces étiquettes pourraient être comprises:

 - soit comme appartenant au groupe lui-même,
 - soit comme s'appliquant aux éléments terminaux du groupe et de ses sous-groupes.

Références
----------

Les références permettent de récupérer facilement des ensembles variés d'éléments.

La syntaxe est la suivante : `=[GROUPS][?TAGS]`.

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

