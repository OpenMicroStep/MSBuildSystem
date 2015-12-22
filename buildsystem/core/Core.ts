/// <reference path="../../typings/tsd.d.ts" />
class Core {
  get File     () { return require('./File'     ) };
  get Process  () { return require('./Process'  ) };
  get Task     () { return require('./Task'     ) };
  get Graph    () { return require('./Graph'    ) };
  get Target   () { return require('./Target'   ) };
  get Workspace() { return require('./Workspace') };
}

export = new Core();
