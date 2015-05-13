module.exports = {
  sysroots: [
    {
      arch: "i686",
      platform: "win32",
      sysroot: "mingw64",
      path: "/Users/vincentrouille/Dev/MicroStep/MSXcodePlugin/MSBuildSystem/toolchains/i686-w64-mingw32",
      compilers: {
        compiler:"gcc",
        path: "bin/i686-w64-mingw32-gcc"
      }
    }
  ]
  win32 : {
    sysroots: {
      "mingw64"
    }
  }
  sysroots : {

  }
};