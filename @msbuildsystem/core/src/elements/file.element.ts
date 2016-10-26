import {
  Element,
  declareElementFactory, createElementValidator,
  AttributeTypes, AttributeResolvers, AttributePath,
  File, util, Reporter, MakeJS
} from '../index.priv';
import * as path from 'path';
import * as fs from 'fs';

declareElementFactory('file', (reporter: Reporter, namespacename: string,
  definition: MakeJS.Element, attrPath: AttributePath, parent: Element
) => {
  let name = namespacename || definition.name;
  let files: File[] = [];
  let list: FileElement[] = [];
  if (typeof name === "string" && name.indexOf('*') !== -1) {
    name = new RegExp('^' +
        util.escapeRegExp(name)
        .replace(/\\\*/g, '[^/]+')
        .replace(/\\\*\\\*/g, '.+') +
        '$');
  }
  if (typeof name === "object" && name instanceof RegExp) {
    let rx = name;
    name = function(relativepath) { return rx.test(relativepath); };
  }

  let absolutePath = parent.__absoluteFilepath();
  if (typeof name === "function") {
    let depth = (<MakeJS.File>definition).depth;
    let relpath = path.relative(parent.__project().directory, absolutePath);
    loadElementFiles(reporter, absolutePath, relpath, name, typeof depth === "number" ? depth : Number.MAX_SAFE_INTEGER, files);
  }
  else if (typeof name === "string") {
    loadElementFile(reporter, new AttributePath(parent, ':', name), util.pathJoinIfRelative(absolutePath, name), files);
  }
  else {
    reporter.diagnostic({
      type: 'error',
      msg: `'${attrPath.toString()}.name' attribute is invalid `
       + `('file' elements requires 'name' to be either a string, a regexp or a filter function)`
    });
  }

  let tags = "tags" in definition ? AttributeTypes.validateStringList(reporter, attrPath, definition["tags"]) : [];
  for (let i = 0, len = files.length; i < len; ++i) {
    let file = files[i];
    list.push(new FileElement(file, parent, tags));
  }
  return list;
});

export class FileElement extends Element {
  is: 'file';
  __file: File;
  tags: string[];

  constructor(file: File, parent: Element, tags: string[]) {
    super('file', file.name, parent);
    this.__file = file;
    this.tags = tags;
  }

  __loadNamespace(reporter: Reporter, name: string, value, attrPath: AttributePath) {
    attrPath.diagnostic(reporter, { type: 'error', msg: `'${name}' can't be an element, 'file' element forbids sub namespace`});
  }

  __loadReservedValue(reporter: Reporter, key: string, value, attrPath: AttributePath) {
    if (key !== 'tags') // name and tags are handled by instanciate
      super.__loadReservedValue(reporter, key, value, attrPath);
  }
}
export module FileElement {
  export const fileElementValidator = createElementValidator('file', FileElement);
  export function fileValidator(reporter: Reporter, path: AttributePath, value: any) {
    if ((value = fileElementValidator(reporter, path, value)) !== undefined && value.__file)
      return <File>value.__file;
    return undefined;
  };
  export const fileSetResolver = new AttributeResolvers.SetResolver(fileValidator);
  export type FileGroup = { values: File[], ext: { dest: string, expand: boolean } };
  export const fileGroupResolver: AttributeResolvers.Resolver<FileGroup[], any> =
  new AttributeResolvers.GroupResolver<File, { dest: string, expand: boolean }, null>(
    fileValidator,
    [
      {path: "dest"  , validator: AttributeTypes.validateString , default: ""   },
      {path: "expand", validator: AttributeTypes.validateBoolean, default: false}
    ]
  );
}

function loadElementFile(reporter: Reporter, attrPath: AttributePath, filepath: string, files: File[]) {
  try {
    let stats = fs.statSync(filepath);
    if (!stats.isFile())
      attrPath.diagnostic(reporter, { type: 'error', msg: `path '${filepath}' doesn't refer to a file` });
  } catch (e) {
    attrPath.diagnostic(reporter, { type: 'warning', msg: `file '${filepath}' not found` });
  }
  files.push(File.getShared(filepath));
}

function loadElementFiles(reporter: Reporter,
  abspath: string, relpath: string,
  filter: (relpath: string) => boolean, depth: number,
  files: File[]
) {
  try {
    let filenames = fs.readdirSync(abspath);
    for (let i = 0, len = filenames.length; i < len; ++i) {
      let abs = path.join(abspath, filenames[i]);
      let rel = relpath ? path.join(relpath, filenames[i]) : filenames[i];
      let stats = fs.statSync(abs);
      if (stats.isFile()) {
        if (filter(rel))
          files.push(File.getShared(abs));
      }
      else if (stats.isDirectory() && depth > 0) {
        loadElementFiles(reporter, abs, rel, filter, depth - 1, files);
      }
    }
  } catch (e) {}
}

