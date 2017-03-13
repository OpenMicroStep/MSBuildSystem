# TypescriptCompiler

#### `buildGraph(reporter: Reporter)`

     |-> npm link local dependencies -> npm install in target.paths.intermediates -> tsc ->|
    -|                                                                                     | ->
     |-> npm install in packager.absoluteCompilationOutputDirectory()                    ->|
