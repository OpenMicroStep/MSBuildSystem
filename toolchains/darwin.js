BuildSystem.Toolchain.defineAbstractToolchain('_darwin', null, {
  init: function() {
    this.linker = this.compiler = BuildSystem.Tool.Clang.newCrossCompiler({
      triple:this.triple,
      sysroot:this.sysroot
    });
    this.archiver = BuildSystem.Tool.Archiver.newCrossArchiver({

    });
  },
  platform : "darwin"
});

BuildSystem.Toolchain.defineAbstractToolchain('_darwin-x86_64', '_darwin', {
  arch : "x86_64",
  triple : "x86_64-apple-darwin"
});

BuildSystem.Toolchain.defineAbstractToolchain('_darwin-i386', '_darwin', {
  arch : "i386",
  triple : "i386-apple-darwin"
});

BuildSystem.Toolchain.defineAbstractToolchain('_darwin-universal', null, {
  toolchains : [],
  buildGraph: function(target, options, callback) {
    var inputs = [], outputs = [];
    var barrier = new Barrier.Simple(this.toolchains.length);

    this.toolchains.forEach(function(toolchain) {
      toolchain = BuildSystem.Toolchain.tryRequire(toolchain);
      if(!toolchain)
        return barrier.dec("Unable to find '" + toolchain + "'");
      var tOptions= {};
      _.extend(tOptions, options);
      tOptions.toolchain = BuildSystem.Toolchain.require(toolchain);
      target.buildGraph(tOptions, function(err, tInputs, tOutputs) {
        if(err) return barrier.dec(err);
        Array.prototype.push.apply(inputs, tInputs);
        Array.prototype.push.apply(outputs, tOutputs);
        barrier.dec();
      });
    });

    barrier.endWith(function() {
      var lipo = new BuildSystem.Task.LipoTask(outputs);
      callback(inputs, [lipo]);
    });
  }
});

BuildSystem.Toolchain.defineToolchain('darwin-x86_64-clang-10.10', '_darwin-x86_64', {
  os : "osx10.10",
  triple : "x86_64-apple-darwin14.3.0",
  sysroot:"/Applications/Xcode.app/Contents/Developer/Platforms/MacOSX.platform/Developer/SDKs/MacOSX10.10.sdk"
});
BuildSystem.Toolchain.defineToolchain('darwin-x86_64-clang', 'darwin-x86_64-clang-10.10', {}); // Alias
