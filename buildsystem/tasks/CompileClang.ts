import File = require('../core/File');
import Task = require('../core/Task');
import Graph = require('../core/Graph');
import Provider = require('../core/Provider');
import CompileTask = require('./Compile');
import Target = require('../core/Target');

class CompileClangTask extends CompileTask {
  constructor(graph: Graph, srcFile:File, objFile:File, provider: Provider.Conditions = { compiler: "clang" }) {
    super(graph, srcFile, objFile, provider);
    this.appendArgs([
      "-o", objFile.path,
      "-c", srcFile.path,
      "-Wall",
      "-fdiagnostics-show-note-include-stack",
      "-fmessage-length=0",
      "-fmacro-backtrace-limit=0",
      "-fdiagnostics-parseable-fixits",
      "-fdiagnostics-print-source-range-info",
      "-fdiagnostics-show-category=name"
    ]);

    // if ( ?.variant.debug )

    if ((<Target>graph).variant !== "release")
      this.appendArgs(["-g"]);
    else
      this.appendArgs(["-O3", "-g"]);
    //if (this.language === 'C' || this.language === 'OBJC')
    //  this.appendArgs(["-std=c11"]);
    //if(!(<any>process.stdout).isTTY)
    //  this.appendArgs(['-fno-color-diagnostics']);
  }

  autocomplete() {
    // -fsyntax-only -Xclang -code-completion-macros -Xclang -code-completion-at=path:row:col
    // COMPLETION: count : [#NSUInteger#]count
    // COMPLETION: write : [#ssize_t#]write(<#int#>, <#const void *#>, <#size_t#>)
    // OVERLOAD: [#NSUInteger#](<#id#>)
    // the position must be at word start, then the completion list must be filtered with the word first characters
  }
}
Task.registerClass(CompileClangTask, "CompileClang");

export = CompileClangTask;