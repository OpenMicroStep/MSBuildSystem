/// <reference no-default-lib="true"/>
/// <reference path="lib.es6.d.ts" />
/// <reference path="node/node.d.ts" />
/// <reference path="underscore/underscore.d.ts" />
/// <reference path="fs-extra/fs-extra.d.ts" />
/// <reference path="nedb/nedb.d.ts" />
/// <reference path="chalk/chalk.d.ts" />
/// <reference path="socket.io/socket.io.d.ts" />
/// <reference path="socket.io-client/socket.io-client.d.ts" />
/// <reference path="express/express.d.ts" />
/// <reference path="bunyan/bunyan.d.ts" />
/// <reference path="pty.js/pty.js.d.ts" />

interface ErrCallback {
  (err?: Error);
}

interface Console {
  trace(...args: any[]);
}
