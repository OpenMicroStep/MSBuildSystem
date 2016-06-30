import {Element, declareElementFactory} from '../element';
import {Reporter} from '../runner';
import * as MakeJS from '../make';
import {AttributeTypes, AttributeResolvers, Attributes, AttributePath} from '../attributes';
import {escapeRegExp} from '../util';
import {File} from '../file';
import * as path from 'path';
import * as fs from 'fs';

declareElementFactory('file', (reporter: Reporter, namespacename: string, definition: MakeJS.Element, attrPath: AttributePath, parent: Element) => {
  let name = namespacename || definition.name;
  let files: File[] = [];
  let list: FileElement[] = [];
  if (typeof name === "string" && name.indexOf('*') !== -1) {
    name = new RegExp('^' + 
        escapeRegExp(name)
        .replace(/\\\*/g, '[^/]+')
        .replace(/\\\*\\\*/g, '.+') + 
        '$');
  }
  if (typeof name === "object" && name instanceof RegExp) {
    let rx = name;
    name = function(relativepath) { return rx.test(relativepath); }  
  }

  let p = parent;
  let absolutePath = "";
  let projectPath = parent.__project().directory;
  while (!absolutePath && p) {
    absolutePath = (<any>p).path; // path is a reserved key that is set to the absolute value if found
    p = p.__parent;
  }
  if (!absolutePath)
    absolutePath = projectPath;
  if (typeof name === "function") {
    let depth = typeof (<MakeJS.File>definition).depth === 'number' ? (<MakeJS.File>definition).depth : Number.MAX_SAFE_INTEGER;
    let relpath = path.relative(projectPath, absolutePath);
    loadElementFiles(reporter, attrPath, absolutePath, relpath, name, depth, files);
  }
  else if (typeof name === "string") {
    if (path.isAbsolute(name))
      absolutePath = name;
    else
      absolutePath = path.join(absolutePath, name);
    loadElementFile(reporter, attrPath, absolutePath, files);
  }
  else {
    reporter.diagnostic({ type: 'error', msg: `'${attrPath.toString()}.name' attribute is invalid ('file' elements requires 'name' to be either a string, a regexp or a filter function)`});
  }

  let tags = "tags" in definition ? AttributeResolvers.stringListResolver.resolve(reporter, definition["tags"], attrPath) : [];
  for (let i = 0, len = files.length; i < len; ++i) {
    let file = files[i];
    list.push(new FileElement(file, parent, tags));
  }
  return list;
});

export class FileElement extends Element
{
  __file: File;
  tags: string[];

  constructor(file: File, parent: Element, tags: string[]) {
    super('file', file.name, parent);
    this.__file = file;
    this.tags = tags;
  }

  __loadNamespace(reporter: Reporter, name: string, value, attrPath: AttributePath)
  {
    reporter.diagnostic({ type: 'error', msg:  `'${attrPath.toString()}' can't be an element, 'file' element forbids sub namespace`});
  }

  __loadReservedValue(reporter: Reporter, key: string, value, attrPath: AttributePath)
  {
    if (key !== 'name' && key != 'tags')
      super.__loadReservedValue(reporter, key, value, attrPath);
  }
}

function loadElementFile(reporter: Reporter, attrPath: AttributePath, filepath: string, files: File[]) {
  try {
    let stats = fs.statSync(filepath);
    if (!stats.isFile())
      reporter.diagnostic({ type: 'error', msg: `'${attrPath.toString()}' doesn't refer to a file`, path: filepath});
  } catch(e) {
    reporter.diagnostic({ type: 'warning', msg: `'${attrPath.toString()}' refer to a file that can't be found`, path: filepath});
  }
  files.push(File.getShared(filepath));
}
  
function loadElementFiles(reporter: Reporter, attrPath: AttributePath, abspath: string, relpath: string, filter:(relpath: string) => boolean, depth: number, files: File[]) {
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
        this._loadElementFiles(reporter, attrPath, abs, rel, filter, depth -1, files);
      }
    }
  } catch(e) {}
}

