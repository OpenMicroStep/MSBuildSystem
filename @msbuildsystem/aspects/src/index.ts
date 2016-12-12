import {
  resolver, FileElement,
  InOutTask, Step, Graph, File, Directory,
  Element, ElementFactory, declareSimpleElementFactory,
  Reporter, AttributePath, AttributeTypes
} from '@msbuildsystem/core';
import { JSTarget, JSCompilers, NPMInstallTask } from '@msbuildsystem/js';
import { TypescriptCompiler, TypescriptTask } from '@msbuildsystem/js.typescript';
import {Hash} from 'crypto';
import * as parse_interface from './parse_interface';
import * as path from 'path';

type Type = any;
const elementFactories = new Map<string, ElementFactory>();
const validateClass = Element.elementValidator('class', ClassElement);
const validateAttribute = Element.elementValidator('attribute', AttributeElement);
const validateCategory = Element.elementValidator('category', CategoryElement);
const validateFarCategory = Element.elementValidator('farCategory', CategoryElement);
const validateMethod = Element.elementValidator('method', MethodElement);
const validateAspect = Element.elementValidator('aspect', AspectElement);

class AspectRootElement extends Element {
  __classes: ClassElement[] = [];
}
class AspectBaseElement extends Element {

}
interface AspectBaseElement {
  __root() : AspectRootElement;
}

function typeToTypescriptType(type: Type) : string {
  if (typeof type === "string") {
    switch (type) {
      case 'any':        return "any";
      case 'integer':    return "number";
      case 'decimal':    return "number";
      case 'date':       return "Date";
      case 'string':     return "string";
      case 'array':      return "any[]";
      case 'dictionary': return "{ [k: string]: any }";
      case 'object':     return "Object";
      case 'identifier': return "(string | number)";
      case 'localdate':  return "any";
    }
  }
  else if (Array.isArray(type)) {
    return `${typeToTypescriptType(type[2])}[]`;
  }
  else if (typeof type === "object") {
    return `{${Object.keys(type).map(k => `${k}: typeToTypescriptType(type[k])`).join(', ')}}`;
  }
  return "any";
}

declareSimpleElementFactory('class', (reporter, name, definition, attrPath, parent: AspectBaseElement) => {
  let ret = new ClassElement('class', name, parent);
  parent.__root().__classes.push(ret);
  return ret;
}, elementFactories);
class ClassElement extends Element {
  superclass: ClassElement | null;
  attributes: AttributeElement[] = [];
  categories: CategoryElement[] = [];
  farCategories: CategoryElement[] = [];
  aspects: AspectElement[] = [];

  __loadReservedValue(reporter: Reporter, key: string, value, attrPath: AttributePath) {
    if (key === 'attributes') this.__loadIfArray(reporter, value, this.attributes, attrPath);
    else if (key === 'categories' || key === 'farCategories') this.__loadIfArray(reporter, value, this.categories, attrPath);
    else if (key === 'aspects') this.__loadIfArray(reporter, value, this.aspects, attrPath);
    else super.__loadReservedValue(reporter, key, value, attrPath);
  }

  __decl() {
    return `class ${this.name} extends ${this.superclass ? this.superclass.name : "VersionedObject"} {\n${
      this.attributes.map(attribute => `  ${attribute.name}: ${typeToTypescriptType(attribute.type)}\n`).join('')
    }\n${
      this.categories.map(category => category.__declCategory(this.name)).join('')
    }\n  static category(name: string, implementation: { [s: string]: (this: ${this.name}, ...args: any[]) => any }) {\n    VersionedObject.addCategory(${this.name}, name, implementation);\n  }\n}`;
  }
}

declareSimpleElementFactory('attribute', (reporter, name, definition, attrPath, parent) => {
  return new AttributeElement('attribute', name, parent);
}, elementFactories);
class AttributeElement extends Element {
  type: Type;
}

const farMethods = <((clazz: string, method: string, argument: string, ret: string) => string)[]>[
  (clazz: string, method: string, argument: string, ret: string) =>
    `farCallback(this: ${clazz}, method: '${method}', argument: ${argument}, callback: (envelop: Invocation<${clazz}, ${ret}>) => void);`,
  (clazz: string, method: string, argument: string, ret: string) =>
    `farEvent(this: ${clazz}, method: '${method}', argument: ${argument}, eventName: string, onObject?: Object);`,
  (clazz: string, method: string, argument: string, ret: string) =>
    `farPromise(this: ${clazz}, method: '${method}', argument: ${argument}): Promise<Invocation<${clazz}, ${ret}>>;`,
  (clazz: string, method: string, argument: string, ret: string) =>
    `farAsync(this: ${clazz}, method: '${method}', argument: ${argument}): (flux: Flux<{ envelop: Invocation<${clazz}, ${ret}> }>) => void;`
];

declareSimpleElementFactory('category', (reporter, name, definition, attrPath, parent) => {
  return new CategoryElement('category', name, parent);
}, elementFactories);
declareSimpleElementFactory('farCategory', (reporter, name, definition, attrPath, parent) => {
  return new CategoryElement('farCategory', name, parent);
}, elementFactories);
class CategoryElement extends Element {
  langages: string[] = [];
  methods: MethodElement[] = [];

  __loadReservedValue(reporter: Reporter, key: string, value, attrPath: AttributePath) {
    if (key === 'langages') this.langages = AttributeTypes.validateStringList(reporter, attrPath, value);
    else if (key === 'methods') this.__loadIfArray(reporter, value, this.methods, attrPath);
    else super.__loadReservedValue(reporter, key, value, attrPath);
  }

  __decl(clazz: string, far: boolean) {
    return `interface ${clazz} /* ${this.name} */ {\n${
      far ? this.__declFarMethods(clazz) : this.__declMethods()
    }\n}`;
  }
  __declCategory(clazz: string) {
    return `static category(name: '${this.name}', implementation: {\n${
      this.methods.map(method => `    ${method.name}: (this: ${clazz}${method.__declArguments()}) => ${method.__declReturn()}\n`).join('')
    }\n}`;
  }
  __declMethods() {
    return this.methods.map(method => `  ${method.name}(${method.__declArguments().substring(2)}): ${method.__declReturn()}\n`).join('');
  }
  __declFarMethods(clazz: string) {
    return this.methods.map(method => farMethods.map(f => `  ${f(clazz, method.name, method.__declArguments().substring(2), method.__declReturn())}\n`).join(''));
  }
}

declareSimpleElementFactory('method', (reporter, name, definition, attrPath, parent) => {
  return new MethodElement('method', name, parent);
}, elementFactories);
class MethodElement extends Element {
  type: { arguments: Type[], return: Type };
  __declArguments() {
    return this.type.arguments.map((a, i) => `, arg${i}: ${typeToTypescriptType(a)}`).join('');
  }
  __declReturn() {
    return typeToTypescriptType(this.type.return);
  }
}

declareSimpleElementFactory('aspect', (reporter, name, definition, attrPath, parent) => {
  return new AspectElement('aspect', name, parent);
}, elementFactories);
class AspectElement extends Element {
  categories: CategoryElement[] = [];
  farCategories: CategoryElement[] = [];

  __loadReservedValue(reporter: Reporter, key: string, value, attrPath: AttributePath) {
    if (key === 'categories') this.__loadIfArray(reporter, value, this.categories, attrPath);
    else if (key === 'farCategories') this.__loadIfArray(reporter, value, this.farCategories, attrPath);
    else super.__loadReservedValue(reporter, key, value, attrPath);
  }

  __decl(clazz: ClassElement) {
    return `${clazz.__decl()}\n${this.categories}`;
  }
}

export class ParseAspectInterfaceTask extends InOutTask {
  constructor(graph: Graph, public src: File, public dest: Directory, public aspect: string) {
    super({ type: "aspect parser", name: src.name }, graph, [src], []);
  }

  uniqueKey(hash: Hash) {
    hash.update(this.src.path);
    hash.update(this.dest.path);
    return true;
  }

  run(step: Step<{}>) {
    this.src.readUtf8File((err, content) => {
      if (err) {
        step.context.reporter.error(err);
        step.continue();
      }
      else {
        let ret = parse_interface.interfaceParse(content);
        let root = Element.load(step.context.reporter, ret, new AspectRootElement('root', this.src.name, null), {
          warningProbableMisuseOfKey: [],
          elementFactories: elementFactories
        });
        let aspects = <{cls: ClassElement, aspect: AspectElement }[]>[];
        root.__classes.forEach(cls => {
          aspects.push(...cls.aspects.filter(a => a.name === this.aspect).map(a => ({cls: cls, aspect: a})));
        });

        step.setFirstElements([aspects.map(i => (step: Step<{}>) => {
          let dest = File.getShared(path.join(this.dest.path, `${i.cls.name}.d.ts`));
          dest.writeUtf8File(i.aspect.__decl(i.cls), (err) => {
            step.context.reporter.error(err);
            step.continue();
          });
        })]);
      }
    });
  }

  clean(step) {
    // TODO
    step.continue();
  }
}

@JSCompilers.declare(['aspects'])
export class AspectTypescriptCompiler extends TypescriptCompiler {
  constructor(graph: JSTarget) {
    super(graph);
    this.name.name = "aspects";
  }

  @resolver(AttributeTypes.listValidator(FileElement.validateFile))
  interfaces: File[];

  @resolver(AttributeTypes.validateString)
  aspect: string;

  parsers: ParseAspectInterfaceTask[];

  buildGraph(reporter: Reporter) {
    super.buildGraph(reporter);
    let dest = File.getShared(path.join(this.graph.paths.intermediates, 'aspects.interfaces'), true);
    this.parsers = this.interfaces.map(iface => new ParseAspectInterfaceTask(this, iface, dest, this.aspect));
    this.parsers.forEach(p => this.tsc.addDependency(p));
    this.tsc.setOptions({
      rootDirs: [dest.path]
    });
  }
}
