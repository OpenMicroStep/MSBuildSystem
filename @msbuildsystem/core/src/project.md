Project
=======



RootGraph
=========

Root graph of the build graph (the only one allowed to have no parent).
All root graph sub tasks are `Target` graph.


Phase 1: Target graph creation

 1. create the BuildTargetElement
 2. find all dependencies and resolve them (ie. do 1 to 5 if needed) 
 3. create the associated Target
 4. configure the target
 5. configure the exported element

Phase 2: create sub graph for each target
