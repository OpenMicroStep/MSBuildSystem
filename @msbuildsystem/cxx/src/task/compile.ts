import {
  File, Directory,
  Task, Graph, Target, InOutTask, StepWithData, Step, Reporter, Flux, ReduceStepContext, TaskDoMapReduce,
  AttributeTypes as V, PathReporter,
  FileElement, ComponentElement} from '@openmicrostep/msbuildsystem.core';
import {CompilerProviders} from '../index.priv';
import * as path from 'path';

export type CompilerOptions = {
  language: string | undefined;
  compiler: string;
  defines: string[];
  flags: (string | (string|File)[])[];
  includeDirectories: Directory[];
  frameworkDirectories: Directory[];
}
export namespace CompilerOptions {
  export function empty() : CompilerOptions {
    return {
      language: undefined,
      compiler: '',
      defines: [],
      flags: [],
      includeDirectories: [],
      frameworkDirectories: [],
    };
  }
  export function merge(self: CompilerOptions, other: CompilerOptions) : CompilerOptions {
    if (other.language && !self.language)
      self.language = other.language;
    if (other.compiler && !self.compiler)
      self.compiler = other.compiler;
    if (other.defines)
      self.defines.push(...other.defines);
    if (other.flags)
      self.flags.push(...other.flags);
    if (other.includeDirectories) for (let dir of other.includeDirectories)
      self.includeDirectories.push(dir);
    if (other.frameworkDirectories) for (let dir of other.frameworkDirectories)
      self.frameworkDirectories.push(dir);
    return self;
  }
}

export type CompileAttributes = {
  srcFile: File,
  objFile: File,
  hmapFile?: File,
  compilerOptions: CompilerOptions,
}

export type CompileCommand = {
  file: string,
  command: string,
  directory: string,
}


export const compilerExtensions: V.Extensions<CompilerOptions, Target> = {
  'language'            : V.defaultsTo(V.validateString, undefined),
  'compiler'            : V.defaultsTo(V.validateString, ''),
  'defines'             : V.defaultsTo(ComponentElement.setAsListValidator(V.validateString), () => [], ''),
  'flags'               : V.defaultsTo(ComponentElement.setAsListValidator(V.validateString), () => [], ''),
  'includeDirectories'  : V.defaultsTo(ComponentElement.setAsListValidator(Target.validateDirectory), () => [], ''),
  'frameworkDirectories': V.defaultsTo(ComponentElement.setAsListValidator(Target.validateDirectory), () => [], ''),
};

export const validateCompilerOptions = ComponentElement.objectValidator<CompilerOptions, Target>(compilerExtensions);

@Task.declare(["cxx-compile"], {
  srcFile: FileElement.validateFile,
  objFile: FileElement.validateFile,
  hmapFile: V.defaultsTo(FileElement.validateFile, undefined),
  compilerOptions: validateCompilerOptions,
})
export class CompileTask extends InOutTask {
  options: CompilerOptions;
  constructor(name: string, graph: Graph, public attributes: CompileAttributes) {
    super({type: "cxx-compile", name: name}, graph, [attributes.srcFile], [attributes.objFile]);
    this.options = attributes.compilerOptions = Object.assign({
      language: undefined,
      compiler: undefined,
      defines: [],
      flags: [],
      includeDirectories: new Set(),
      frameworkDirectories: new Set(),
    }, attributes.compilerOptions);
    if (attributes.hmapFile)
      this.outputFiles.push(attributes.hmapFile);
  }

  uniqueKey() {
    return Object.assign(super.uniqueKey(), {
      compilerOptions: this.options,
    });
  }

  is_build_required(step: StepWithData<{ actionRequired?: boolean }, {}, { headers: string[] }>) {
     step.setFirstElements((step) => {
       if (!step.context.actionRequired && step.context.sharedData.headers) {
         File.ensure(step.context.sharedData.headers.map(h => File.getShared(h)), step.context.lastSuccessStartTime, {}, (err, required) => {
           step.context.actionRequired = !!(err || required);
           step.continue();
         });
       }
       else {
         step.continue();
       }
     });
     super.is_build_required(step);
  }

  do_generate_compile_commands(step: Step<{ value: CompileCommand[], cmd?: string }>) {
    let provider = CompilerProviders.validateBest.validate(new PathReporter(step.context.reporter), this.options.compiler);
    if (!provider) return step.continue();
    console.info("do_generate_compile_commands");
    step.setFirstElements(step => {
      step.context.value = [{
        file: this.attributes.srcFile.path,
        directory: this.target().project.directory,
        command: step.context.cmd!,
      }];
      step.continue();
    });
    provider.do_generate_compile_command(step, this.attributes);
  }

  do_build(step: StepWithData<{}, {}, { headers: string[] }>) {
    let provider = CompilerProviders.validateBest.validate(new PathReporter(step.context.reporter), this.options.compiler);
    if (!provider) return step.continue();
    provider.do_compile(step, this.attributes);
  }
}

Task.generators.register(['compile_commands'], {
  returnValues: false,
  map: (v) => v[0].directory,
  reduce: (reporter, values) => ([] as CompileCommand[]).concat(...values),
  run(f, value) {
    let file = File.getShared(path.join(value[0].directory, "compile_commands.json"));
    console.info(file.path);
    file.writeUtf8File(JSON.stringify(value, null, 2), (err) => {
      if (err) f.context.reporter.error(err, { is: "error", path: file.path, msg: "unable to write file" });
      f.continue();
    });
  }
} as TaskDoMapReduce<CompileCommand[], string>);
