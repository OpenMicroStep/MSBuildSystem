/// <reference path="../../typings/tsd.d.ts" />
/* @flow */
'use strict';

import io = require("socket.io-client");
import ioServer = require("socket.io");
import path = require("path");
import fsex = require("fs-extra");
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

    /*
     - emit once:    process-init, input_paths => pid
     - emit n times: process-upload, pid, input_idx, data
     - emit once:    process-run, pid, provider_id, output_paths, action, options
       - on n times: process-upload-pid, output_idx, data
       - => (err, args)
     - emit once:    process-end
     */
    process(inputs: File[], outputs: File[], action: string, options: any, cb) {
      var inputsMapped= inputs.map((i) => { return i.path; });
      var outputsMapped= outputs.map((output) => { return output.path; });
      this.io.emit("process-init", inputsMapped, (pid) => {
        var barrier = new Barrier.ErrBarrier("RemoteProvider handle inputs", inputs.length);
        inputs.forEach((file, idx) => {
          var reader = fs.createReadStream(file.path);
          reader.on('data', (data) => {
            this.io.emit("process-upload", pid, idx, data);
          });
          reader.on('end', () => { barrier.dec(); });
          reader.on('error', (err) => { barrier.dec(err); });
        });
        barrier.endWith((errors) => {
          var outputsStream: fs.WriteStream[];
          var self = this;
          var end = function(err?) {
            if (outputsStream)
              outputsStream.forEach((stream) => { stream.end(); });
            self.io.emit("process-end", pid);
            var args= Array.from(arguments);
            if (err && typeof err !== "string") {
              if (Array.isArray(err))
                err= Array.from(err).map(function(err: any) { return err.message || err; }).join(', ');
              else
                err= err.message || err;
              args[0]= err;
            }
            cb.apply(null, args);
          };
          if (errors.length) return end(errors);

          outputsStream= outputs.map((output) => { return fs.createWriteStream(output.path); });
          this.io.on("process-upload-" + pid, (idx, data) => {
            //console.info("process-upload-" + pid, idx);
            outputsStream[idx].write(data);
          });
          this.io.emit("process-run", pid, this.id, outputsMapped, action, options, (err: Error, output_errors?: Error[], args?:any[]) => {
            console.info("process-run-cb", pid, err, output_errors);
            this.io.off("process-upload-" + pid);
            if (err || output_errors.length) return end(err || output_errors.join(", "));
            end.apply(null, args);
          });
        });
      });
    }
  }
  export class RemoteClient {
    socket: SocketIOClient.Socket;

    constructor(url: string) {
      this.socket= io(url, {transports: ['websocket']});
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
    ctxs= {};

    constructor(port: number, tmpDirectory: string) {
      this.io = ioServer(port, {transport: ["websocket"]});
      this.tmp = tmpDirectory;
      this.counter= (new Date()).getTime();
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

        socket.on("process-init", (input_paths: string[], cb: (pid) => any) => {
          console.info("process-init");
          var ctx: any = {};
          ctx.id = ++this.counter;
          ctx.dir= path.join(this.tmp, ctx.id.toString());
          fs.mkdir(ctx.dir, 0x1FF, (err) => {
            if(err) ctx.err= err;
            ctx.filePath = function (filepath:string) {
              var basename = path.basename(filepath);
              return path.join(this.dir, basename);
            };
            ctx.input_paths = Array.from(input_paths);
            ctx.input_paths_mapped = ctx.input_paths.map((path) => {
              return ctx.filePath(path);
            });
            ctx.inputs = ctx.input_paths_mapped.map((path) => {
              var stream= fs.createWriteStream(path);
              stream.on('error', (err) => { console.error(err); ctx.err= err; });
              return stream;
            });
            this.ctxs[ctx.id] = ctx;
            cb(ctx.id);
          });
        });
        socket.on("process-end", (pid) => {
          console.info("process-end", pid);
          var ctx= this.ctxs[pid];
          if (!ctx) return console.warn("process-end: Unable to find context: ", pid);
          fsex.remove(ctx.dir, (err) => {
            if (err) console.warn("process-end: Unable to remove directory " + ctx.dir + " :", err)
          });
          delete this.ctxs[pid];
        });
        socket.on("process-upload", (pid, idx, data) => {
          var ctx = this.ctxs[pid];
          if (!ctx) return console.warn("process-upload: Unable to find context: ", pid);
          ctx.inputs[idx].write(data);
        });
        socket.on("process-run", (pid, id:number, outputs:string[], action: string, options: any, cb:(err: Error, output_errors?: Error[], args?: any[]) => any) => {
          console.info("process-run", pid, id, outputs);
          var ctx= this.ctxs[pid];
          if (ctx.err) return cb(ctx.err.message || ctx.err);
          var barrier = new Barrier("ServerProvider flush inputs", ctx.inputs.length);
          ctx.inputs.forEach((input) => {
            input.on('finish', function() {
              //console.info("process-upload-end", pid, barrier.counter);
              barrier.dec();
            });
            input.end();
            //console.info("process-upload-endasked", pid, barrier.counter);
          });
          barrier.endWith(() => {
            console.info("process-run", "inputs flushed", pid);
            var provider = this.providers[id];
            if (provider) {
              var outputsMapped= outputs.map((output) => {
                var filepath= ctx.filePath(output);
                options= provider.mapOptions(options, output, filepath);
                return File.getShared(filepath);
              });
              var inputsMapped= ctx.input_paths_mapped.map((path, idx) => {
                options= provider.mapOptions(options, ctx.input_paths[idx], path);
                return File.getShared(path);
              });
              provider.process(inputsMapped, outputsMapped, action, options, function (err) {
                var args= Array.from(arguments);
                console.info("process-run", "runned", pid, err);
                if(err) return cb(null, [], args);
                var barrier = new Barrier.ErrBarrier("ServerProvider handle outputs", outputsMapped.length);
                outputsMapped.forEach((output, idx) => {
                  var stream= fs.createReadStream(output.path);
                  stream.on("error", (err) => { barrier.dec(err); });
                  stream.on("data", (data) => { socket.emit("process-upload-" + pid, idx, data); });
                  stream.on("end", () => { barrier.dec(); });
                });
                barrier.endWith((errors) => {
                  console.info("process-run", "outputs sent", pid, errors);
                  cb(null, errors, args);
                });
              });
            }
            else {
              console.info("process-run", "Unable to find provider", pid);
              cb(new Error("Unable to find provider"));
            }
          });
        });
      });
    }
  }
}

export = Provider;