/// <reference no-default-lib="true"/>
/// <reference path="lib.es6.d.ts" />
/// <reference path="node/node.d.ts" />
/// <reference path="fs-extra/fs-extra.d.ts" />
/// <reference path="underscore/underscore.d.ts" />

interface ErrCallback {
  (err?: Error);
}

interface Console {
  trace(...args: any[]);
}