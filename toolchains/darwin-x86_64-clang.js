var Clang = BuildSystem.Tool.Clang;
var Archiver = BuildSystem.Tool.Archiver;

var toolchain = {
  platform : "darwin",
  os : "osx10.10",
  arch : "x86_64",
  triple : "x86_64-apple-darwin14.3.0"
};
toolchain.linker = toolchain.compiler = Clang.newCrossCompiler({
  triple:toolchain.triple,
  sysroot:"/Applications/Xcode.app/Contents/Developer/Platforms/MacOSX.platform/Developer/SDKs/MacOSX10.10.sdk"
});
toolchain.archiver = Archiver.newCrossArchiver({});

module.exports = toolchain;