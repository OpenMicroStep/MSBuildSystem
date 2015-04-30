var Clang = BuildSystem.Tool.Clang;

var toolchain = {
  platform : "darwin",
  os : "osx10.10",
  arch : "i386|x86_64",
  buildGraph: function(target, options, callback) {
    var x86_64 = {
      options:{},
      inputs:null,
      outputs:null
    };
    var i386 = {
      options:{},
      inputs:null,
      outputs:null
    };
    for(var i in options) {
      if(options.hasOwnProperty(i)) {
        x86_64.options[i] = i386.options[i] = options[i];
      }
    }
    x86_64.options.toolchain = BuildSystem.Toolchain["darwin-x86_64-clang"];
    i386.options.toolchain = BuildSystem.Toolchain["darwin-i386-clang"];

    var barrier = 2;
    target.buildGraph(x86_64.options, function(inputs, outputs) {
      x86_64.inputs = inputs;
      x86_64.outputs = outputs;
      if(--barrier === 0) merge();
    });
    target.buildGraph(i386.options, function(inputs, outputs) {
      i386.inputs = inputs;
      i386.outputs = outputs;
      if(--barrier === 0) merge();
    });

    function merge() {
      var inputs = [].concat(x86_64.inputs, i386.inputs);
      var lipo = new BuildSystem.Task.LipoTask([].concat(x86_64.outputs, i386.outputs));
      callback(inputs, [lipo]);
    }
  }
};

module.exports = toolchain;