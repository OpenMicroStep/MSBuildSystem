import {File, declareTarget, declareResolvers, AttributeResolvers, AttributeTypes, Reporter} from '../../core';
import {ProcessTask} from '../../foundation';
import {CXXTarget, CXXLinkType} from '../cxxTarget';

@declareTarget({ type: "Library" })
@declareResolvers([
  new AttributeResolvers.SimpleResolver({
    path: "static",
    map: AttributeTypes.validateBoolean,
    defaultValue: false
  }),
  new AttributeResolvers.ListResolver({
    path: "publicHeaders",
    map: AttributeTypes.validateString,
    extensions: [
      {path:"dest"  , map: AttributeTypes.validateString , default: ""   }, 
      {path:"expand", map: AttributeTypes.validateBoolean, default: false}
    ],
    exportable: true
  })
])
export class Library extends CXXTarget {
  
  configure(reporter: Reporter) {
    super.configure(reporter);
    var linkStatic = this.resolvers['static'].resolve(reporter, this);
    this.linkType = linkStatic ? CXXLinkType.STATIC : CXXLinkType.DYNAMIC;
  }
  exports(targetToConfigure: Target, callback: ErrCallback) {
    if(targetToConfigure instanceof CXXTarget) {
      targetToConfigure.addIncludeDirectory(this.buildPublicHeaderPath());
      if (this.linkType === CXXTarget.LinkType.STATIC)
        targetToConfigure.addArchives([this.sysroot.linkFinalPath(this)]);
      else
        targetToConfigure.addLibraries([this.sysroot.linkFinalPath(this)]);
      super.exports(targetToConfigure, callback);
    }
    else {
      return callback(new Error("target " +  targetToConfigure.targetName + " is incompable with " + this.targetName));
    }
  }
  buildPublicHeaderPath() {
    return path.join(this.outputBasePath, this.env.directories.publicHeaders);
  }
  addWorkspacePublicHeaders(headers: string[]) {
    this.addPublicHeaders(this.workspace.resolveFiles(headers));
  }
  addPublicHeaders(headers: string[]) {
    var files = File.buildList(this.workspace.directory, headers);
    this.publicHeaders.push(...files);
  }
  setPublicHeadersPrefix(prefix) {
    this.publicHeadersPrefix = prefix;
  }
  addPublicHeaderMapper(mapper) {
    this.publicHeaderMappers.push(mapper);
  }
  buildGraph(callback: ErrCallback) {
    super.buildGraph((err) => {
      if(err) return callback(err);

      if(this.publicHeaders.length) {
        var copy = new CopyTask("public headers", this);
        this.publicHeaders.forEach((inFilename) => {
          var outFilename = path.basename(inFilename);
          if(this.publicHeadersPrefix)
            outFilename = path.join(this.publicHeadersPrefix, outFilename);
          this.publicHeaderMappers.forEach((mapper) => { outFilename = mapper(this, outFilename); });
          outFilename = path.join(this.buildPublicHeaderPath(), outFilename);
          copy.willCopyFile(inFilename, outFilename);
        });
        this.applyTaskModifiers(copy);
        this.inputs.forEach((task) => {
          if(task !== copy) task.addDependency(copy);
        });
      }
      callback();
    });
  }
}
