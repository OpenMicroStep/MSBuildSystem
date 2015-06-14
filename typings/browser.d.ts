/// <reference no-default-lib="true"/>
/// <reference path="lib.es6.d.ts" />
/// <reference path="jquery/jquery.d.ts" />

interface ErrCallback {
  (err?: Error);
}

interface Console {
  trace(...args: any[]);
}

