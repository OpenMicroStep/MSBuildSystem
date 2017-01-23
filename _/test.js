var libclang = require('libclang');

var index = new libclang.index();
var tu = new libclang.translationunit();

tu.fromSource(idx, 'myLibrary.h', ['-I/path/to/my/project']);

tu.cursor().visitChildren(function (parent) {
  switch (this.kind) {
    case libclang.KINDS.CXCursor_FunctionDecl:
      console.log(this.spelling);
      break;
  }
  return libclang.CXChildVisit_Continue;
});

index.dispose();
tu.dispose();