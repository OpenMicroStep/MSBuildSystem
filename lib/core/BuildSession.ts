/// <reference path="../../typings/tsd.d.ts" />
/* @flow */
'use strict';

import fs = require("fs");
import path = require("path");
import Datastore = require("nedb");

/** Store information about the current build sessions (task informations) */
interface BuildSession {
  retrieveInfo(key: string, callback: (info: any) => any);
  storeInfo(key: string, info: any);
}
module BuildSession {
  export class InDatabase implements BuildSession {
    db: Datastore;
    constructor(public dbPath: string) {
      this.db = new Datastore({ filename: dbPath, autoload: true });
    }
    retrieveInfo(key: string, callback: (info: any) => any) {
      if (!key) return callback(undefined);
      this.db.findOne({ _id: key }, function (err, doc: {_id:string; info:any}) {
        if(!doc || !doc.info) callback(undefined);
        else callback(doc.info)
      });
    }
    storeInfo(key: string, info: any) {
      if (key) this.db.update({ _id:key}, { _id:key, info:info }, { upsert:true });
    }
  }
  export class InMemory implements BuildSession {
    protected infos = new Map<string, any>();
    retrieveInfo(key: string, callback: (info: any) => any) {
      if (!key) callback(undefined);
      else      callback(this.infos.get(key));
    }
    storeInfo(key: string, info: any) {
      if (key) this.infos.set(key, info);
    }
  }
  export class Noop implements BuildSession {
    retrieveInfo(key: string, callback: (info: any) => any) {
      callback(undefined);
    }
    storeInfo(key: string, info: any) {

    }
  }
  export var noop: BuildSession = new Noop();
}

export = BuildSession;