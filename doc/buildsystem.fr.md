Build system
------------

Ce document à pour but d'expliquer le fonctionnement du buildsystem.
Il est destiné aux développeurs qui souhaite ajouter ou modifier les fonctionalités du buildsystem.

## Classes

 - __Graphe de compilation__: Définitions des tâches et de leurs dépendances
   - `Task`: Une tâche
   - `Graph`: Une tâche contant un sous graphe de tâches
   - `Target`: Une tâche définissant objectif de compilation et les sous-tâches nécéssaire à sa réalisation
 - __Élements__: Définition d'un projet et ces éléments
   - `Element`: La classe de base de tout élément,
   - `FileElement`: Un élément représentant un unique fichier,
   - `DelayedElement`: Un élément dont la résolution est retardée jusqu'au dernier moment (après la fusion entre _target_, _environment_ et _variant_).
   - `ComponentElement`, `GroupElement`, `EnvironmentElement`, `TargetElement`: Les classes correspondants au types d'éléments _component_, _group_, _environment_, _target_
   - `BuildTargetElement`: L'élément résultant de la fusion entre _target_, _environment_ et _variant_ qui sert à la configuration d'une target.
 - __Résolution des attributs__: Analyse des éléments permettant de configurer les objectifs de compilation
   - `AttributeResolver`: Résolution des attributs d'un éléments (liste, _*ByEnv_, extensions, ...)
   - `AttributeTypes`: Validation de la forme d'un attribut
 - __Exécution__: Exécution de tout ou de parties du graphe de compilation
   - `Runner`: Exécuteur
   - `Step`: Flux async étendu associé à chaque tâche lors de l'exécution
   - `BuildSession`: Gestionnaire des données de chaque tâche (chargement, sauvegarde)
   - `Provider`: Fournisseur d'un service (qu'il soit local ou distant)
 - __Gestion des fichiers__: Partage de tous les liens vers des fichiers et/ou dossiers (`File`)
 - __Modules__: Chargement des modules du buildsystem (`Loader`)
 - __Espace de travail__
   - `Project`: Le projet associé à chaque fichier _make.js_
   - `Workspace`: Le rassemblement d'un ensemble de projets au sein d'un espace de travail cohérent


## Graphe de compilation

Le fonctionnement du buildsystem tourne autour de son graphe de compilation.
Ce graphe est généré par les classes : 

 - `Project` : gère le ficher make.js et la création des objectifs (`Target`) qui forment le premier niveau du graphe.
 - `Target` : génére les tâches nécéssaire à la création de l'objectif.

Le graphe est composé de noeuds (classe `Task`) qui ont pour attributs:

 - `graph` : le noeud parent de type `Graph` qui contient ce noeud
 - `dependencies` et `requiredBy` : un lien dans les deux sens entre noeuds ayant le même parent qui définit une relation d'ordre entre eux.

Cela permet de décrire une hiérachie de tâches et les pré-requis d'exécution de ces tâches. 
L'approche hiérarchique permet de simplifier l'expression des dépendances entre les tâches et permet l'exécution partielle du graphe de compilation (un seul objectif par exemple, ce qui correspond à une branche de l'arbre des graphes).

Un objectif est un noeud `Target` qui étend la classe `SelfGraph`.
Les noeuds `SelfGraph` ont la particularité de générer eux-mêmes leurs noeuds enfants.

L'exécution du graphe est effectué par la classe `Runner`.  
Chaque tache implémente la méthode `do(step: Runner.Step)`, cette méthode prend en paramètre un flux **Async** dont le context possède les informations suivantes :

 - `runner: Runner` : l'objet responsable de l'exécution du graphe
 - `task: Task`: la tâche en cours de traitement
 - `reporter: Reporter`: le raporteur associé à la tâche pour cette exécution
 - `data`: les données persistantes (start time, end time, success time, logs, diagnostics)
 - `sharedData`: les données persistante partagées entre les actions
 - `lastRunStartTime: number`: le moment où la dernière exécution à commencer
 - `lastRunEndTime: number`: le moment où la dernière exécution à terminer
 - `lastSuccessTime: number`: le moment où la dernière exécution à réussi

L'exécution d'une tache est lié à deux flux d'informations différents gérés par le raporteur : 

 - un flux textuel sous la forme d'un log
 - un flux structuré sous la forme d'un ensemble de diagnostics.

### Génération du graphe de compilation

 1. Execution du script du project (make.js) dans une VM javascript dédié et récupération de la définition du projet (`Project.reload`)
 2. Analyse récursive de façons à instancier les éléments sans résoudre les liens entres les éléments (`Project.loadDefinition`)
 3. Résolution des liens entre les éléments et des groupes (`Project.loadDefinition`)
 4. Création des objectifs de compilation (targets) et analyse des éléments pour configurer les targets.
    (`Project.buildGraph`)   
    La création des objectifs de compilation implique la fusion entre les éléments `target`, `environment` et `variant` puis la résolution des éléments restant (`DelayedElement` pour les targets externes).
  5. Création des sous-tâches pour toutes les targets (`Target.doConfigure`)

### Liens entre éléments et tâches

Pour simplifier l'analyse des éléments et la configuration des targets, il est possible de créer des liens entre attributs d'une tâche target et les attributs de l'élément target via l'annotation typescript `@resolver()`. 

Cette annotation ajoute dans la liste `resolvers` le lien entre l'élément et la tâche. 
Ces liens sont résolues dans l'ordre de déclaration lors de l'exécution de `configure()`.

## Element

Toutes les propriétés et méthodes non publiques sont préfixés par `__`.

### Instanciation (`__load`)

## Barrier

Une barrière (`Barrier`) est un objet qui permet d'attendre plusieurs évenements avant de passer à la suite.   
Bien que async permet de résoudre ce problème, `Barrier` est bien plus léger pour résoudre ce problème précis.

Un compteur est mis à disposition, il commence à `n + 1` et lorsqu'il atteint `0` la barrière s'ouvre. Une fois ouverte, aucune action n'est possible.

 - `inc`: incrémente le compteur si la barrière n'est pas ouverte
 - `dec`: décrémente le compteur si la barrière n'est pas ouverte
 - `endWith`: définition l'action à exécuter lorsque le compteur atteint 0 et décrémente le compteur

