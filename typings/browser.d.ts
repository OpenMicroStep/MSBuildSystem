/// <reference no-default-lib="true"/>
/// <reference path="lib.es6.d.ts" />
/// <reference path="jquery/jquery.d.ts" />
/// <reference path="ace/ace.d.ts" />
/// <reference path="socket.io-client/socket.io-client.d.ts" />
/// <reference path="underscore/underscore.d.ts" />

interface ErrCallback {
  (err?: Error);
}

interface Console {
  trace(...args: any[]);
}

