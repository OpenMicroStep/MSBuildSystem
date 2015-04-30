var toolchain = {
  platform : "linux",
  os : "debian7",
  arch : "x86_64",
  triple : "x86_64-linux-gnu",
  sysroot:"/Users/vincentrouille/Dev/MicroStepToolchains/debian7-x86_64"
};
toolchain.compiler = BuildSystem.Tool.Clang.newCrossCompiler({
  triple:toolchain.triple,
  sysroot:toolchain.sysroot,
  compileFlags:['-I/Users/vincentrouille/Dev/MicroStepToolchains/debian7-x86_64/x86_64-linux-gnu/include']
});
toolchain.linker = BuildSystem.Tool.GCC.newCrossCompiler({
  triple:toolchain.triple,
  sysroot:toolchain.sysroot
});
toolchain.archiver = BuildSystem.Tool.Archiver.newCrossArchiver({
  bin:"/Users/vincentrouille/Dev/MicroStepToolchains/debian7-x86_64/bin/x86_64-linux-gnu-ar"
});

module.exports = toolchain;