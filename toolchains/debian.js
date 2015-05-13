BuildSystem.Toolchain.defineAbstractToolchain('_debian-gcc', null, {
  init: function() {
    this.compiler = this.linker = BuildSystem.Tool.GCC.newCrossCompiler({
      triple:this.triple,
      sysroot:this.sysroot
    });
    this.archiver = BuildSystem.Tool.Archiver.newCrossArchiver({
      bin:this.sysroot + "/bin/" + this.triple + "-ar"
    });
  },
  platform: "linux"
});

BuildSystem.Toolchain.defineAbstractToolchain('_debian-clang', '_debian-gcc', {
  init: function(superInit) {
    superInit();
    this.compiler = BuildSystem.Tool.Clang.newCrossCompiler({
      triple:this.triple,
      sysroot:this.sysroot,
      compileFlags:['-I' + this.sysroot + '/' + this.triple + '/include']
    });
  }
});

BuildSystem.Toolchain.defineToolchain('debian7-x86_64-gcc', '_debian-gcc', {
  arch : "x86_64",
  triple : "x86_64-linux-gnu",
  os: "debian7",
  sysroot:"/Users/vincentrouille/Dev/MicroStep/MSXcodePlugin/MSBuildSystem/toolchains/debian7-x86_64"
});

BuildSystem.Toolchain.defineToolchain('debian7-x86_64-clang', '_debian-clang', {
  arch : "x86_64",
  triple : "x86_64-linux-gnu",
  os: "debian7",
  sysroot:"/Users/vincentrouille/Dev/MicroStep/MSXcodePlugin/MSBuildSystem/toolchains/debian7-x86_64"
});
