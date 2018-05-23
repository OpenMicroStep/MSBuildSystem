import {
  Toolchain, Toolchains,
  CXXTarget, CXXLibrary, CXXLinkType,
  CompilerOptions,
  LinkerOptions,
} from '../index.priv';

export abstract class Toolchain_darwin extends Toolchain {
  triple: string;
  linkFinalName(name: string) {
    if (this.graph instanceof CXXLibrary)
      name = `lib${name}${this.graph.linkType === CXXLinkType.DYNAMIC ? ".dylib" : ".a"}`;
    return name;
  }

  mutateCompilerOptions(options: CompilerOptions) {
    if (!options.compiler)
      options.compiler = "clang";
    options.flags.unshift(`--target=${this.triple}`, '-fPIC');
  }

  mutateLinkerOptions(options: LinkerOptions)  {
    if (this.graph.linkType !== CXXLinkType.STATIC) {
      options.flags.unshift(`--target=${this.triple}`, '-fPIC');
      if (!options.linker)
        options.linker = "clang";
      if (this.graph.linkType === CXXLinkType.DYNAMIC)
        options.flags.unshift('-shared');
      if (options.archives.length)
        options.archives = ["-Wl,-all_load", ...options.archives, "-Wl,-noall_load"];
    }
    else {
      if (!options.linker)
        options.linker = "ar";
    }
  }
}

export class Toolchain_darwin_i386 extends Toolchain_darwin {
  triple = "i386-apple-darwin";
  constructor(graph: CXXTarget) {
    super({ type: "toolchain", name: "i386.darwin.clang.ld" }, graph);
  }
}

export class Toolchain_darwin_x86_64 extends Toolchain_darwin {
  triple = "x86_64-apple-darwin";
  constructor(graph: CXXTarget) {
    super({ type: "toolchain", name: "x86_64.darwin.clang.ld" }, graph);
  }
}
Toolchains.register(["i386.darwin"], Toolchain_darwin_i386, {});
Toolchains.register(["x86_64.darwin"], Toolchain_darwin_x86_64, {});
