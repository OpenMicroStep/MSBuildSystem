import {
  resolver, FileElement,
  InOutTask, Step, Graph, File, Directory,
  Element, Reporter, AttributeTypes
} from '@msbuildsystem/core';
import { JSTarget, JSCompilers } from '@msbuildsystem/js';
import { TypescriptCompiler } from '@msbuildsystem/js.typescript';
import * as parse_interface from './parse_interface';
import * as path from 'path';

type Type = any;
const elementFactories = Element.createElementFactoriesProviderMap('aspects');

class AspectRootElement extends Element {
  __classes: ClassElement[] = [];
}
class AspectBaseElement extends Element {

}
interface AspectBaseElement {
  __root() : AspectRootElement;
}

function appendUndefined(type: string, allowUndefined: boolean) {
  return allowUndefined ? `${type} | undefined` : type;
}
function typeToTypescriptType(type: Type, allowUndefined) : string {
  if (typeof type === "string") {
    switch (type) {
      case 'any':        return "any";
      case 'integer':    return appendUndefined("number", allowUndefined);
      case 'decimal':    return appendUndefined("number", allowUndefined);
      case 'date':       return appendUndefined("Date", allowUndefined);
      case 'string':     return appendUndefined("string", allowUndefined);
      case 'array':      return appendUndefined("any[]", allowUndefined);
      case 'dictionary': return appendUndefined("{ [k: string]: any }", allowUndefined);
      case 'object':     return appendUndefined("Object", allowUndefined);
      case 'identifier': return appendUndefined("string | number", allowUndefined);
      case 'localdate':  return "any";
    }
    return type;
  }
  else if (Array.isArray(type)) {
    return appendUndefined(`${typeToTypescriptType(type[2], false)}[]`, allowUndefined);
  }
  else if (typeof type === "object") {
    return `{${Object.keys(type).map(k => `${k === '*' ? '[k: string]' : `${k}?`}: ${typeToTypescriptType(type[k], false)}`).join(', ')}}`;
  }
  return "any";
}

elementFactories.registerSimple('class', (reporter, name, definition, attrPath, parent: AspectBaseElement) => {
  let ret = new ClassElement('class', name, parent);
  parent.__root().__classes.push(ret);
  return ret;
});
class ClassElement extends Element {
  superclass: ClassElement | null = null;
  attributes: AttributeElement[] = [];
  categories: CategoryElement[] = [];
  farCategories: CategoryElement[] = [];
  aspects: AspectElement[] = [];

  __decl() {
    let parent = (this.superclass && this.superclass.name) || "VersionedObject";
    let cats = this.categories.concat(this.farCategories);
    return `export interface ${this.name}Constructor<C extends ${this.name}> extends ${parent}Constructor<C> {${
  cats.map(category => `\n  category(name: '${category.name}', implementation: ${this.name}.ImplCategories.${category.name}<${this.name}>);`).join('')}
}
export interface ${this.name} extends ${parent} {
${this.attributes.map(attribute => `  ${attribute.name}: ${typeToTypescriptType(attribute.type, true)}\n`).join('')}
}
const definition = ${JSON.stringify(this.__definition(), null, 2)};
export const ${this.name}: ${this.name}Constructor<${this.name}> = VersionedObject.extends(${parent}, definition);

export namespace ${this.name} {
  export namespace Categories {${
    this.categories.map(category => category.__decl(this.name)).join('')}${
    this.farCategories.map(category => category.__decl(this.name)).join('')}
  }
  export namespace ImplCategories {${
    this.categories.map(category => category.__declImpl(this.name)).join('')}${
    this.farCategories.map(category => category.__declImpl(this.name)).join('')}
  }
  export namespace Aspects {
    ${this.aspects.map(aspect => `export type ${aspect.name} = ${
      aspect.categories.concat(aspect.farCategories).map(c => `Categories.${c.name}`).join(' & ')
    };`).join('\n    ')}
  }
}
`;
  }

  __definition() {
    return {
      is: this.is,
      name: this.name,
      version: 0,
      attributes: this.attributes.map(a => a.__definition()),
      categories: this.categories.map(c => c.__definition()),
      farCategories: this.farCategories.map(c => c.__definition()),
      aspects: this.aspects.map(a => a.__definition())
    };
  }
}

elementFactories.registerSimple('attribute', (reporter, name, definition, attrPath, parent) => {
  return new AttributeElement('attribute', name, parent);
});
class AttributeElement extends Element {
  type: Type;

  __definition() {
    return {
      is: this.is,
      name: this.name,
      type: this.type
    };
  }
}

const farMethods = <((clazz: string, method: string, argument: string, ret: string) => string)[]>[
  (clazz: string, method: string, argument: string, ret: string) =>
    `farCallback(this: ${clazz}, method: '${method}', argument: ${argument}, callback: (envelop: Invocation<${clazz}, ${ret}>) => void);`,
  (clazz: string, method: string, argument: string, ret: string) =>
    `farEvent(this: ${clazz}, method: '${method}', argument: ${argument}, eventName: string, onObject?: Object);`,
  (clazz: string, method: string, argument: string, ret: string) =>
    `farPromise(this: ${clazz}, method: '${method}', argument: ${argument}): Promise<Invocation<${clazz}, ${ret}>>;`,
  //(clazz: string, method: string, argument: string, ret: string) =>
  //  `farAsync(this: ${clazz}, method: '${method}', argument: ${argument}): (flux: Flux<{ envelop: Invocation<${clazz}, ${ret}> }>) => void;`
];

elementFactories.registerSimple('category', (reporter, name, definition, attrPath, parent) => {
  return new CategoryElement('category', name, parent);
});
elementFactories.registerSimple('farCategory', (reporter, name, definition, attrPath, parent) => {
  return new CategoryElement('farCategory', name, parent);
});
class CategoryElement extends Element {
  langages: string[] = [];
  methods: MethodElement[] = [];

  __decl(clazz: string) {
    return `
    export interface ${this.name} extends ${clazz} {
${this.is === 'farCategory' ? this.__declFarMethods(clazz) : this.__declMethods()}    }`;
  }
  __declImpl(clazz: string) {
    return `
    export interface ${this.name}<C extends ${clazz}> extends ${clazz} {
${this.is === 'farCategory' ? this.__declImplFarMethods('C') : this.__declImplMethods('C')}    }`;
  }
  __declMethods() {
    return this.methods.map(method => `      ${method.name}(${method.__declArguments().join(', ')}): ${method.__declReturn()};\n`).join('');
  }
  __declFarMethods(clazz: string) {
    return this.methods.map(method => farMethods.map(f => `      ${f(clazz, method.name, method.__declFarArgument(), method.__declReturn())}\n`).join('')).join('');
  }
  __declImplMethods(clazz: string) {
    return this.methods.map(method => `      ${method.name}: (this: ${clazz}${method.__declArguments().map(a => `, ${a}`).join('')}) => ${method.__declReturn()};\n`).join('');
  }
  __declImplFarMethods(clazz: string) {
    return this.methods.map(method => `      ${method.name}: FarImplementation<${clazz}, ${method.__declFarArgument()}, ${method.__declReturn()}>;\n`).join('');
  }

  __definition(){
    return {
      is: this.is,
      name: this.name,
      methods: this.methods.map(m => m.__definition())
    };
  }
}

elementFactories.registerSimple('method', (reporter, name, definition, attrPath, parent) => {
  return new MethodElement('method', name, parent);
});
class MethodElement extends Element {
  type: { arguments: Type[], return: Type };
  __declArguments() : string[] {
    return this.type.arguments.map((a, i) => `arg${i}: ${typeToTypescriptType(a, false)}`);
  }
  __declFarArgument() {
    return this.type.arguments[0] ? typeToTypescriptType(this.type.arguments[0], false) : "undefined";
  }
  __declReturn() {
    return typeToTypescriptType(this.type.return, false);
  }

  __definition() {
    return {
      is: this.is,
      name: this.name,
      argumentTypes: this.type.arguments,
      returnType: this.type.return,
    };
  }
}

elementFactories.registerSimple('aspect', (reporter, name, definition, attrPath, parent) => {
  return new AspectElement('aspect', name, parent);
});
class AspectElement extends Element {
  categories: CategoryElement[] = [];
  farCategories: CategoryElement[] = [];

  __definition() {
    return {
      is: this.is,
      name: this.name,
      categories: this.categories.map(c => c.name),
      farCategories: this.farCategories.map(c => c.name),
    };
  }
}

export class ParseAspectInterfaceTask extends InOutTask {
  constructor(graph: Graph, public src: InterfaceFileGroup, public dest: Directory) {
    super({ type: "aspect parser", name: "interfaces" }, graph, src.values, []);
  }

  uniqueKey() {
    return Object.assign(super.uniqueKey(), {
      dest: this.dest.path,
      ext: this.src.ext
    });
  }
  isRunRequired(step: Step<{ runRequired?: boolean }>) {
    step.context.runRequired = true;
      step.continue();
  }
  run(step: Step<{}>) {
    let root = new AspectRootElement('root', 'root', null);
    step.setFirstElements([
      this.inputFiles.map(inputFile => (step: Step<{}>) => {
        inputFile.readUtf8File((err, content) => {
          if (err) {
            step.context.reporter.error(err);
            step.continue();
          }
          else {
            let ret = parse_interface.interfaceParse(content);
            Element.load(step.context.reporter, ret, root, elementFactories);
            step.continue();
          }
        });
      }),
      (step: Step<{}>) => {
        let dest = File.getShared(path.join(this.dest.path, `aspects.interfaces.ts`));
        let r = this.src.ext.customHeader || `import {VersionedObject, VersionedObjectConstructor, FarImplementation, Invocation} from '@microstep/aspects';`;
        r += `\n${this.src.ext.header}\n`;
        root.__classes.forEach(cls => {
          r += cls.__decl();
        });
        dest.writeUtf8File(r, (err) => {
          step.context.reporter.error(err);
          step.continue();
        });
      }
    ]);
    step.continue();
  }

  clean(step) {
    // TODO
    step.continue();
  }
}

export type InterfaceFileGroup = {
    values: File[];
    ext: {
        header: string;
        customHeader: string;
    };
}

@JSCompilers.declare(['aspects'])
export class AspectTypescriptCompiler extends TypescriptCompiler {
  constructor(graph: JSTarget) {
    super(graph);
    this.name.name = "aspects";
  }

  @resolver(AttributeTypes.groupValidator<File, { header: string; customHeader: string; }>(FileElement.validateFile, {
    header:       { validator: AttributeTypes.validateString, default: "" },
    customHeader: { validator: AttributeTypes.validateString, default: "" }
  }))
  interfaces: InterfaceFileGroup[] = [];

  @resolver(AttributeTypes.validateString)
  aspect: string = "";

  parsers: ParseAspectInterfaceTask[];

  buildGraph(reporter: Reporter) {
    super.buildGraph(reporter);
    let dest = File.getShared(path.join(this.graph.paths.intermediates, 'generated'), true);
    this.parsers = this.interfaces.map(i => new ParseAspectInterfaceTask(this, i, dest));
    this.parsers.forEach(p => this.tsc.addDependency(p));
  }
}
