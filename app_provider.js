var BuildSystem = require('./lib/BuildSystem');
var Provider = require('./lib/core/Provider');

Provider.register(new Provider.Process("C:/Program Files (x86)/Microsoft Visual Studio 11.0/VC/bin/link.exe", { type:"linker", linker:"msvc", arch:"i386", version:"12"}, {
  args: ["/libpath:C:/Program Files (x86)/Microsoft Visual Studio 11.0/VC/lib", "/libpath:C:/Program Files (x86)/Microsoft SDKs/Windows/v7.1A/Lib"],
  PATH: ["C:/Program Files (x86)/Microsoft Visual Studio 11.0/VC/BIN", "C:/Program Files (x86)/Microsoft Visual Studio 11.0/Common7/IDE"]
}));
Provider.register(new Provider.Process("C:/Program Files (x86)/Microsoft Visual Studio 11.0/VC/bin/ml.exe", { type:"assembler", assembler:"msvc", arch:"i386", version:"12"}, {
  PATH: ["C:/Program Files (x86)/Microsoft Visual Studio 11.0/VC/BIN", "C:/Program Files (x86)/Microsoft Visual Studio 11.0/Common7/IDE"]
}));
Provider.register(new Provider.Process("C:/Program Files (x86)/Microsoft Visual Studio 11.0/VC/bin/lib.exe", { type:"archiver", archiver:"msvc", arch:"i386", version:"12"}, {
  PATH: ["C:/Program Files (x86)/Microsoft Visual Studio 11.0/VC/BIN", "C:/Program Files (x86)/Microsoft Visual Studio 11.0/Common7/IDE"]
}));
Provider.register(new Provider.Process("C:/Program Files (x86)/Microsoft Visual Studio 11.0/VC/bin/dumpbin.exe", { type:"dumpbin", arch:"i386", version:"12"}, {
  PATH: ["C:/Program Files (x86)/Microsoft Visual Studio 11.0/VC/BIN", "C:/Program Files (x86)/Microsoft Visual Studio 11.0/Common7/IDE"]
}));

Provider.register(new Provider.Process("C:/Program Files (x86)/Microsoft Visual Studio 11.0/VC/bin/x86_amd64/link.exe", { type:"linker", linker:"msvc", arch:"x86_64", version:"12"}, {
  args: ["/libpath:C:/Program Files (x86)/Microsoft Visual Studio 11.0/VC/lib/amd64", "/libpath:C:/Program Files (x86)/Microsoft SDKs/Windows/v7.1A/Lib/x64"],
  PATH: ["C:/Program Files (x86)/Microsoft Visual Studio 11.0/VC/BIN/x86_amd64", "C:/Program Files (x86)/Microsoft Visual Studio 11.0/Common7/IDE"]
}));
Provider.register(new Provider.Process("C:/Program Files (x86)/Microsoft Visual Studio 11.0/VC/bin/x86_amd64/ml64.exe", { type:"assembler", assembler:"msvc", arch:"x86_64", version:"12"}, {
  PATH: ["C:/Program Files (x86)/Microsoft Visual Studio 11.0/VC/BIN/x86_amd64", "C:/Program Files (x86)/Microsoft Visual Studio 11.0/Common7/IDE"]
}));
Provider.register(new Provider.Process("C:/Program Files (x86)/Microsoft Visual Studio 11.0/VC/bin/x86_amd64/lib.exe", { type:"archiver", archiver:"msvc", arch:"x86_64", version:"12"}, {
  PATH: ["C:/Program Files (x86)/Microsoft Visual Studio 11.0/VC/BIN/x86_amd64", "C:/Program Files (x86)/Microsoft Visual Studio 11.0/Common7/IDE"]
}));
Provider.register(new Provider.Process("C:/Program Files (x86)/Microsoft Visual Studio 11.0/VC/bin/x86_amd64/dumpbin.exe", { type:"dumpbin", arch:"x86_64", version:"12"}, {
  PATH: ["C:/Program Files (x86)/Microsoft Visual Studio 11.0/VC/BIN/x86_amd64", "C:/Program Files (x86)/Microsoft Visual Studio 11.0/Common7/IDE"]
}));

new Provider.Server(2346, "C:/tmp");//