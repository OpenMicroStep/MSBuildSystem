import {
  Reporter, Step, StepWithData, Diagnostic,
  File, SemVerProvider, Loader,
} from '@openmicrostep/msbuildsystem.core';
import {
  safeSpawnProcess, toShellArg
} from '@openmicrostep/msbuildsystem.foundation';
import {
  CompilerProviders, CompilerProvider, CompileAttributes,
  LinkerProviders, LinkerProvider, LinkAttributes,
} from '../index.priv';
import * as child_process from 'child_process';

//                1:path  2:row 3:col    4:ranges                      5:type                                  6:msg     7:option     8:category
const rxdiag  = /^(.+?):(\d+):(\d+):(?:((?:\{\d+:\d+-\d+:\d+\})+):)? (warning|(?:fatal )?error|note|remark): (.+?)(?:\[([^,\]]+)(?:,([^\]]+))?\])?$/;
//                       1:path    2-5:range                  6:replacement
const rxfixit = /^fix-it:"(.+?)":\{(\d+):(\d+)-(\d+):(\d+)\}:"(.*?)"$/;
//                                        1:path  2:row
const rxcontext = /^In file included from ([^:]+):(\d+):/;
export class ClangProvider extends SemVerProvider implements CompilerProvider, LinkerProvider {
  name: string;

  constructor(public bin: string, name: string, version: string) {
    super(name, version);
  }

  do_compile(step: StepWithData<{}, {}, { headers: string[] }>, attributes: CompileAttributes) : void {
    step.setFirstElements([
      step => safeSpawnProcess(step, { cmd: [this.bin, ...this.compile_arguments(step.context.reporter, attributes)] }),
      step => {
        this.parseLogs(step.context.reporter, step.context.reporter.logs);
        if (attributes.hmapFile)
          this.parseHeaderMap(step, attributes.hmapFile);
        else
          step.continue();
      }
    ]);
    step.continue();
  }

  do_generate_compile_command(step: Step<{ cmd?: string }>, attributes: CompileAttributes) {
    step.context.cmd = [this.bin, ...this.compile_arguments(step.context.reporter, attributes)].map(a => toShellArg(a)).join(' ');
    step.continue();
  }

  do_link(step: Step, attributes: LinkAttributes) : void {
    step.setFirstElements([
      step => safeSpawnProcess(step, { cmd: [this.bin, ...this.link_arguments(step.context.reporter, attributes)] }),
      step => {
        this.parseLogs(step.context.reporter, step.context.reporter.logs);
        step.continue();
      }
    ]);
    step.continue();
  }

  compile_arguments(reporter: Reporter, attributes: CompileAttributes): string[] {
    let args: string[] = [];
    let compilerOptions = attributes.compilerOptions;
    args.push('-fdiagnostics-parseable-fixits', '-fdiagnostics-print-source-range-info');
    args.push('-o', attributes.objFile.path);
    args.push('-c', attributes.srcFile.path);
    if (attributes.hmapFile)
      args.push('-MMD', '-MF', attributes.hmapFile.path);
    if (compilerOptions) {
      if (compilerOptions.defines)
        args.push(...compilerOptions.defines.map(d => `-D${d}`));
      if (compilerOptions.flags) {
        args.push(...this.flattenArgs(compilerOptions.flags));
      }
      if (compilerOptions.includeDirectories) for (let d of compilerOptions.includeDirectories)
        args.push('-I', d.path);
      if (compilerOptions.frameworkDirectories) for (let d of compilerOptions.frameworkDirectories)
        args.push('-F', d.path);
    }
    return args;
  }

  link_arguments(reporter: Reporter, attributes: LinkAttributes): string[] {
    let args: string[] = [];
    let linkerOptions = attributes.linkerOptions;
    args.push('-o', attributes.outFile.path);
    for (let objFile of attributes.objFiles)
      args.push(objFile.path);
    if (linkerOptions) {
      args.push(...linkerOptions.libraries);
      args.push(...linkerOptions.archives);
      for (let framework of linkerOptions.frameworks)
        args.push('-framework', framework);
      args.push(...this.flattenArgs(linkerOptions.flags));
      for (let d of linkerOptions.libDirectories)
        args.push('-L', d.path);
      for (let d of linkerOptions.frameworkDirectories)
        args.push('-F', d.path);
    }
    return args;
  }

  parseLogs(reporter: Reporter, logs: string) {
    let diag: Diagnostic | null = null;
    let diags: Diagnostic[] = [];
    let context: Diagnostic[] = [];
    let lines = logs.split(/\r?\n/);
    for (let line of lines) {
      var matches = line.match(rxdiag);
      if (matches) {
        var d: Diagnostic = {
          is: <any>matches[5],
          path: matches[1],
          row: parseInt(matches[2]),
          col: parseInt(matches[3]),
          ranges: this.parseRanges(matches[4]),
          msg: matches[6].trim(),
          option: matches[7],
          category: matches[8],
          notes: context.reverse(),
          fixits: [],
        };
        context = [];
        if (d.is === "note" && diag)
          diag.notes!.push(d);
        else {
          diags.push(d);
          diag = d;
        }
      }
      else if ((matches = line.match(rxcontext))) {
        context.push({
          is: "note",
          path: matches[1],
          row: parseInt(matches[2]),
          col: 0,
          msg: `included from here`,
        });
      }
      else if (diag && (matches = line.match(rxfixit))) {
        var fixit = {
          path: matches[1],
          replacement: matches[6],
          range: {
            srow: parseInt(matches[2]), scol: parseInt(matches[3]),
            erow: parseInt(matches[4]), ecol: parseInt(matches[5])
          }
        };
        diag.fixits!.push(fixit);
      }
    }
    for (let diag of diags)
      reporter.diagnostic(diag);
  }

  parseRanges(ranges: string) : Diagnostic.Range[] {
    var ret = <Diagnostic.Range[]>[];
    if (ranges) {
      var rngs = ranges.split('}{');
      for (var range of rngs) {
        var m = range.match(/(\d+):(\d+)-(\d+):(\d+)/);
        if (m) {
          ret.push({
            srow: parseInt(m[1]), scol: parseInt(m[2]),
            erow: parseInt(m[3]), ecol: parseInt(m[4])
          });
        }
      }
    }
    return ret;
  }

  parseHeaderMap(step: StepWithData<{}, {}, { headers?: string[] }>, hmapFile: File) {
    hmapFile.readUtf8File((err, content) => {
      if (err && !step.context.reporter.failed) { step.context.reporter.error(err); }
      if (!err) {
        var headers = <string[]>[];
        var lines = content.split("\n");
        for (var i = 1, len = lines.length; i < len; ++i) {
          var header = lines[i].trim();
          if (header.endsWith("\\"))
            header = header.substring(0, header.length - 1).trim();
          if (header.length)
            headers.push(header);
        }
        step.context.sharedData.headers = headers;
      }
      step.continue();
    });
  }
}
/*
Loader.safeLoadIfOutOfDate<{ semver: string }>({
  name: 'clang',
  uuid: '3FD566D3-540D-490B-814B-4053E7EE3AA7',
  init() {
    let output = child_process.execSync(`clang --version`).toString('utf8');
    let [version, target] = output.trim().split('\n').map(l => l.trim());
    let semver = version.match(/(\d+\.\d+\.\d+)/);
    return semver ? { semver: semver[1] } : undefined;
  },
  load({ semver }) {
    let p = new ClangProvider('clang', 'clang', semver);
    CompilerProviders.register(p);
    LinkerProviders.register(p);
  }
});
*/
