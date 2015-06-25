var BuildSystem = require('./lib/BuildSystem');
var Provider = require('./lib/core/Provider');

Provider.register(new Provider.Process("C:/Program Files (x86)/Microsoft Visual Studio 11.0/VC/bin/link.exe", { type:"linker", linker:"msvc", arch:"i386"}));
Provider.register(new Provider.Process("C:/Program Files (x86)/Microsoft Visual Studio 11.0/VC/bin/x86_amd64/link.exe", { type:"linker", linker:"msvc", arch:"x86°64"}));
new Provider.Server(2346, "C:/tmp");