BuildSystem.Toolchain.defineAbstractToolchain('_windows-gcc', null, {
  init: function() {
    this.compiler = this.linker = BuildSystem.Tool.GCC.newCrossCompiler({
      bin:this.sysroot + "/bin/" + this.triple + "-gcc",
      //triple:this.triple,
      sysroot:this.sysroot,
      compileFlags:["-DWINVER=0x0501"]
    });
    this.archiver = BuildSystem.Tool.Archiver.newCrossArchiver({
      bin:this.sysroot + "/bin/" + this.triple + "-ar"
    });
  },
  platform : "win32",
  os : "windows7"
});

BuildSystem.Toolchain.defineAbstractToolchain('_windows-clang', '_windows-gcc', {
  init: function(superInit) {
    superInit();
    this.compiler = BuildSystem.Tool.Clang.newCrossCompiler({
      //bin: "/Users/vincentrouille/Dev/MicroStep/llvm/build/bin/clang-3.7",
      triple:this.triple,
      sysroot:this.sysroot,
      compileFlags:["-DWINVER=0x0501"]
    });
  }
});

BuildSystem.Toolchain.defineToolchain('i686-win32-mingw64-clang', '_windows-clang', {
  arch : "i686",
  triple : "i686-w64-mingw32",
  sysroot:"/Users/vincentrouille/Dev/MicroStep/MSXcodePlugin/MSBuildSystem/toolchains/i686-w64-mingw32"
});

BuildSystem.Toolchain.defineToolchain('i686-win32-mingw64-gcc', '_windows-gcc', {
  arch : "i686",
  triple : "i686-w64-mingw32",
  sysroot:"/Users/vincentrouille/Dev/MicroStep/MSXcodePlugin/MSBuildSystem/toolchains/i686-w64-mingw32"
});

BuildSystem.Toolchain.defineToolchain('x86_64-win32-mingw64-gcc', '_windows-gcc', {
  arch : "x86_64",
  triple : "x86_64-w64-mingw32",
  sysroot:"/Users/vincentrouille/Dev/MicroStep/MSXcodePlugin/MSBuildSystem/toolchains/x86_64-w64-mingw32"
});

BuildSystem.Toolchain.defineToolchain('x86_64-win32-mingw64-clang', '_windows-clang', {
  arch : "x86_64",
  triple : "x86_64-w64-mingw32",
  sysroot:"/Users/vincentrouille/Dev/MicroStep/MSXcodePlugin/MSBuildSystem/toolchains/x86_64-w64-mingw32"
});