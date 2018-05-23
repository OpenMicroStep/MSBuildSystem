import {execSync} from 'child_process';
const download = require('download');

// 3.9.0/LICENSE.TXT
let version = "3.9.0";
let binaries = [
  { platform: 'darwin' , arch: 'x64'    , distrib: undefined , url: `http://llvm.org/releases/${version}/clang+llvm-${version}-x86_64-apple-darwin.tar.xz` },
  { platform: 'freebsd', arch: 'x64'    , distrib: 'freebsd' , url: `http://llvm.org/releases/${version}/clang+llvm-${version}-amd64-unknown-freebsd10.tar.xz` },
  { platform: 'freebsd', arch: 'ia32'   , distrib: 'freebsd' , url: `http://llvm.org/releases/${version}/clang+llvm-${version}-i386-unknown-freebsd10.tar.xz` },
  { platform: 'linux'  , arch: 'aarch64', distrib: undefined , url: `http://llvm.org/releases/${version}/clang+llvm-${version}-aarch64-linux-gnu.tar.xz` },
  { platform: 'linux'  , arch: 'arm'    , distrib: undefined , url: `http://llvm.org/releases/${version}/clang+llvm-${version}-armv7a-linux-gnueabihf.tar.xz` },
  { platform: 'linux'  , arch: 'ia32'   , distrib: 'fedora'  , url: `http://llvm.org/releases/${version}/clang+llvm-${version}-i686-fedora23.tar.xz` },
  { platform: 'linux'  , arch: 'x64'    , distrib: 'fedora'  , url: `http://llvm.org/releases/${version}/clang+llvm-${version}-x86_64-fedora23.tar.xz` },
  { platform: 'linux'  , arch: 'ia32'   , distrib: 'opensuse', url: `http://llvm.org/releases/${version}/clang+llvm-${version}-i586-opensuse13.2.tar.xz` },
  { platform: 'linux'  , arch: 'x64'    , distrib: 'opensuse', url: `http://llvm.org/releases/${version}/clang+llvm-${version}-x86_64-opensuse13.2.tar.xz` },
  { platform: 'linux'  , arch: 'x64'    , distrib: 'ubuntu'  , url: `http://llvm.org/releases/${version}/clang+llvm-${version}-x86_64-linux-gnu-ubuntu-14.04.tar.xz` },
  { platform: 'linux'  , arch: 'x64'    , distrib: 'ubuntu'  , url: `http://llvm.org/releases/${version}/clang+llvm-${version}-x86_64-linux-gnu-ubuntu-16.04.tar.xz` },
  { platform: 'linux'  , arch: 'x64'    , distrib: 'debian'  , url: `http://llvm.org/releases/${version}/clang+llvm-${version}-x86_64-linux-gnu-debian8.tar.xz` },
  { platform: 'linux'  , arch: 'mips'   , distrib: undefined , url: `http://llvm.org/releases/${version}/clang+llvm-${version}-mips-linux-gnu.tar.xz` },
  { platform: 'linux'  , arch: 'mipsel' , distrib: undefined , url: `http://llvm.org/releases/${version}/clang+llvm-${version}-mipsel-linux-gnu.tar.xz` },
  { platform: 'win32'  , arch: 'ia32'   , distrib: undefined , url: `http://llvm.org/releases/${version}/LLVM-${version}-win32.exe` },
  { platform: 'win32'  , arch: 'x64'    , distrib: undefined , url: `http://llvm.org/releases/${version}/LLVM-${version}-win64.exe` }
];

let compatibles = binaries.filter(b => b.platform === process.platform && b.arch === process.arch);
if (compatibles.length > 1) {
  try {
    let distrib = execSync('lsb_release -i -s', { encoding: 'utf8' });
    compatibles = compatibles.filter(b => b.distrib === distrib);
  } catch (e) {
    compatibles = [];
  }
}
if (compatibles.length === 0) {
  console.error("No compatible binaries found");
  process.exit(1);
}
let choice = compatibles[0];
console.info("Will download and install: " + choice.url);
download(choice.url, 'clang', { extract: true }).then(function() {
  console.info("Done");
});
