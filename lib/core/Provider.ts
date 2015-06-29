/// <reference path="../../typings/tsd.d.ts" />
/* @flow */
'use strict';

import io = require("socket.io-client");
import ioServer = require("socket.io");
import path = require("path");
import fs = require("fs-extra");
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
  conditions: {[s:string]: string};

  constructor(conditions) {
    this.conditions = conditions;
    this.id= ++Provider.idCounter;
  }

  isCompatible(conditions: {[s: string]: string}) : boolean {
    for(var k in conditions) {
      if (conditions.hasOwnProperty(k)) {
        if (this.conditions[k] !== conditions[k])
          return false;
      }
    }
    return true;
  }

  mapOptions(options: any, original:string, mapped:string) : any {
    return options;
  }
  process(inputs: File[], outputs: File[], action: string, options: any, cb) {
    throw "Must be implemented by subclasses";
  }

  static providers: Provider[]= [];
  static find(conditions: {[s: string]: string}) : Provider {
    var idx = Provider.providers.findIndex((provider) => {
      return provider.isCompatible(conditions);
    });
    if (idx === -1) console.warn("Unable to find a provider that match", conditions);
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
    constructor(public bin: string, conditions, public options?: any) {
      super(conditions);
    }
    mapOptions(options: any, original:string, mapped:string) : any {
      options.args = options.args.map((arg: string) => {
        var idx = arg.indexOf(original);
        if (idx !== -1 && idx + original.length === arg.length) {
          return arg.substr(0, idx) + mapped;}
        return arg;
      });
      return options;
    }
    process(inputs: File[], outputs: File[], action: string, options: any, cb) {
      if (this.options && this.options.PATH) {
        options.env = options.env || {};
        options.env.PATH = this.options.PATH.join(";") + ";" + process.env.PATH;
      }
      if (this.options && this.options.args) {
        options.args = options.args || [];
        options.args.unshift.apply(options.args, this.options.args);
      }
      RunProcess.run(this.bin, options.args, options.env, cb);
    }
  }
  export class Remote extends Provider {
    constructor(conditions, public io: SocketIOClient.Socket) {
      super(conditions);
    }

    process(inputs: File[], outputs: File[], action: string, options: any, cb) {
      var barrier = new Barrier.FirstErrBarrier("RemoteProvider handle inputs", inputs.length);
      var files= new Array(inputs.length);
      inputs.forEach((file, idx) => {
        fs.readFile(file.path, (err, data) => {
          files[idx]= {path:file.path, data:data};
          barrier.dec(err);
        });
      });
      barrier.endWith((err) => {
        if (err) return cb(err);
        var outputsMapped= outputs.map((output) => { return output.path; });
        this.io.emit("process", this.id, files, outputsMapped, action, options, (err:Error, outputsData?: Buffer[], args?:any[]) => {
          if (err) return cb(err);
          if (args[0]) return cb.apply(null, args);
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
        console.info("Remote provider registered", conditions);
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
    counter: number;

    constructor(port: number, tmpDirectory: string) {
      this.io = ioServer(port);
      this.tmp = tmpDirectory;
      this.counter= 0;
      this.io.on("connection", (socket: SocketIO.Socket) => {
        console.info("Connected to ", socket.handshake.address);
        var barrier = new Barrier("Provider.Server.register", Provider.providers.length);
        Provider.providers.forEach((provider) => {
          socket.emit("register", provider.conditions, (id: number) => {
            this.providers[id]= provider;
            barrier.dec();
          });
        });
        barrier.endWith(() => {
          socket.emit("ready");
        });
        socket.on("process", (id:number, files: {path:string, data:Buffer}[], outputs:string[], action: string, options: any, cb:(err:Error, outputsData?: Buffer[], args?: any[]) => any) => {
          var provider = this.providers[id];
          if (provider) {
            var tmpDirectory = path.join(this.tmp, (++this.counter).toString());
            fs.mkdir(tmpDirectory, 0x1FF, (err) => {
              if (err) return cb(err);
              var prevCb = cb;
              cb = function() {
                fs.remove(tmpDirectory, (err) => { if (err) console.warn("Unable to remove directory " + tmpDirectory + " :", err)});
                prevCb.apply(this, arguments);
                prevCb = null;
              };
              var filePath = function(filepath: string) {
                var basename = path.basename(filepath);
                return path.join(tmpDirectory, basename);
              };
              var barrier = new Barrier.FirstErrBarrier("ServerProvider handle inputs", files.length);
              var inputs= new Array(files.length);
              files.forEach((file, idx) => {
                var filepath= filePath(file.path);
                options= provider.mapOptions(options, file.path, filepath);
                fs.writeFile(filepath, file.data, barrier.decCallback());
                inputs[idx]= File.getShared(filepath);
              });
              barrier.endWith((err) => {
                if(err) return cb(err.message);
                var outputsMapped= outputs.map((output) => {
                  var filepath= filePath(output);
                  options= provider.mapOptions(options, output, filepath);
                  return File.getShared(filepath);
                });
                provider.process(inputs, outputsMapped, action, options, function (err) {
                  var args= Array.from(arguments);
                  if(err) return cb(null, null, args);

                  var outputsRet = new Array(outputsMapped.length);
                  var barrier = new Barrier.FirstErrBarrier("ServerProvider handle outputs", outputsMapped.length);
                  outputsMapped.forEach((output, idx) => {
                    fs.readFile(output.path, (err, data) => {
                      outputsRet[idx]= data;
                      barrier.dec(err && err.message);
                    });
                  });
                  barrier.endWith((err) => {
                    if (err) return cb(err);
                    cb(null, outputsRet, args);
                  });
                })
              });
            });
          }
          else {
            cb(new Error("Unable to find provider"));
          }
        });
      });
    }
  }
}

export = Provider;