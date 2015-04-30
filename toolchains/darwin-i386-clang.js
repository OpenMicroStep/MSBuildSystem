var Clang = BuildSystem.Tool.Clang;

var toolchain = {
  platform : "darwin",
  os : "osx10.10",
  arch : "i386",
  triple : "i386-apple-darwin14.3.0"
};
toolchain.linker = toolchain.compiler = Clang.newCrossCompiler({
  triple:toolchain.triple
});
toolchain.archiver =

module.exports = toolchain;