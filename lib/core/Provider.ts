/// <reference path="../../typings/tsd.d.ts" />
/* @flow */
'use strict';

import io = require("socket.io-client");
import ioServer = require("socket.io");
import path = require("path");
import fs = require("fs");
import crypto = require("crypto");
import Datastore = require("nedb");
import File = require("./File");
import Barrier = require("./Barrier");
import RunProcess = require("./Process");

/**   */
class Provider {
  private static idCounter= 0;
  id: number;
  type: string;

  constructor(conditions) {
    for(var k in conditions) {
      if (conditions.hasOwnProperty(k)) {
        this[k]= conditions[k];
      }
    }
    this.id= ++Provider.idCounter;
  }

  isCompatible(conditions: {[s: string]: string}) : boolean {
    for(var k in conditions) {
      if (conditions.hasOwnProperty(k)) {
        if (this[k] !== conditions[k])
          return false;
      }
    }
    return true;
  }

  filePath(path: string) {
    return path;
  }
  process(inputs: File[], outputs: File[], action: string, options: any, cb) {
    throw "Must be implemented by subclasses";
  }

  static providers: Provider[]= [];
  static find(conditions: {[s: string]: string}) : Provider {
    var idx = Provider.providers.findIndex((provider) => {
      return provider.isCompatible(conditions);
    });
    return (idx !== -1) ? Provider.providers[idx] : null;
  }
  static register(provider: Provider) {
    Provider.providers.push(provider);
  }
  static unregister(id: number) {
    var idx = Provider.providers.findIndex((provider) => {
      return provider.id == id;
    });
    if (idx !== -1)
      Provider.providers.splice(idx, 1);
  }
}

module Provider {
  export class Process extends Provider {
    constructor(public bin: string, conditions) {
      super(conditions);
    }
    process(inputs: File[], outputs: File[], action: string, options: any, cb) {
      RunProcess.run(this.bin, options.args, options.env, cb);
    }
  }
  export class Remote extends Provider {
    constructor(conditions, public io: SocketIOClient.Socket) {
      super(conditions);
    }
    filePath(filepath: string) {
      var shasum = crypto.createHash('sha1');
      shasum.update(filepath);
      return path.join(this.id, shasum.digest("hex") + path.extname(filepath));
    }
    process(inputs: File[], outputs: File[], action: string, options: any, cb) {
      var barrier = new Barrier.FirstErrBarrier("RemoteProvider handle inputs", inputs.length);
      var files= new Array(inputs.length);
      inputs.forEach((file, idx) => {
        fs.readFile(file.path, (err, data) => {
          files[idx]= {path:this.filePath(file.path), data:data};
          barrier.dec(err);
        });
      });
      barrier.endWith((err) => {
        if (err) return cb(err);
        var outputsMapped= outputs.map((output) => { return this.filePath(output.path); });
        this.io.emit("process", this.id, files, outputsMapped, action, options, (err:Error, outputsData?: Buffer[], args?:any[]) => {
          if (err) return cb(err);
          var barrier = new Barrier.FirstErrBarrier("RemoteProvider handle outputs", outputsData.length);
          outputsData.forEach((output, idx) => {
            fs.writeFile(outputs[idx].path, output, barrier.decCallback());
          });
          barrier.endWith((err) => {
            if (err) cb(err);
            else cb.apply(null, args);
          });
        });
      });
    }
  }
  export class RemoteClient {
    socket: SocketIOClient.Socket;

    constructor(url: string) {
      this.socket= io(url);
      this.socket.on("register", (conditions, cb:(id:number) => any) => {
        var provider= new Remote(conditions, this.socket);
        Provider.register(provider);
        cb(provider.id);
      });
      this.socket.on("unregister", (id: number) => {
        Provider.unregister(id);
      });
    }

  }
  export class Server {
    io: SocketIO.Server;
    providers: {[n: number]: Provider}= {};
    tmp: string;
    constructor(port: number, tmpDirectory: string) {
      this.io = ioServer(port);
      this.tmp = tmpDirectory;

      this.io.on("connection", (socket: SocketIO.Socket) => {
        console.info("Connected to ", socket.handshake.address);
        Provider.providers.forEach((provider) => {
          socket.emit("register", provider, (id: number) => {
            this.providers[id]= provider;
            fs.mkdir(path.join(this.tmp, id));
          });
        });

      });
      this.io.on("process", (id:number, files: {path:string, data:Buffer}[], outputs:string[], action: string, options: any, cb:(err:Error, outputsData?: Buffer[], args?: any[]) => any) => {
        var provider = this.providers[id];
        if (provider) {
          var barrier = new Barrier.FirstErrBarrier("ServerProvider handle inputs");
          var inputs= new Array(files.length);
          files.forEach((file, idx) => {
            var filepath= path.join(this.tmp, file.path);
            fs.writeFile(filepath, file.data, barrier.decCallback());
            inputs[idx]= File.getShared(filepath);
          });
          barrier.endWith((err) => {
            if(err) return cb(err);
            var outputsMapped= outputs.map((output) => { return File.getShared(path.join(this.tmp, output)); });
            provider.process(inputs, outputsMapped, action, options, function (err) {
              if(err) return cb(err);

              var args= Array.from(arguments);
              var outputsRet = new Array(outputsMapped.length);
              var barrier = new Barrier.FirstErrBarrier("ServerProvider handle outputs", outputsMapped.length);
              outputsMapped.forEach((output, idx) => {
                fs.readFile(output.path, (err, data) => {
                  outputsRet[idx]= data;
                  fs.unlink(output.path);
                  barrier.dec(err);
                });
              });
              barrier.endWith((err) => {
                if (err) return cb(err);
                cb(null, outputsRet, args);
              });
            })
          })
        }
        else {
          cb(new Error("Unable to find provider"));
        }
      });
    }
  }
}

export = Provider;