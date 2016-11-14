Barrier
=======

Une barrière (`Barrier`) est un objet qui permet d'attendre plusieurs évenements avant de passer à la suite.   
Bien que async permet de résoudre ce problème, `Barrier` est bien plus léger et fléxible pour résoudre ce problème précis.

Un compteur est mis à disposition, il commence à `n + 1` et lorsqu'il atteint `0` la barrière s'ouvre. Une fois ouverte, aucune action n'est possible.

 - `inc`: incrémente le compteur si la barrière n'est pas ouverte
 - `dec`: décrémente le compteur si la barrière n'est pas ouverte
 - `endWith`: définition l'action à exécuter lorsque le compteur atteint 0 et décrémente le compteur
