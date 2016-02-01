import path = require("path");
import os = require("os");
import fsex = require("fs-extra");
import fs = require("fs-extra");
import crypto = require("crypto");
import Datastore = require("nedb");
import Target = require("./Target");
import File = require("./File");
import Task = require("./Task");
import Barrier = require("./Barrier");
import RunProcess = require("./Process");
import async = require("./async");

var IoEngine= require('engine.io');
var IoEngineClient= require('engine.io-client');
var RpcServer = require('rpc-websocket').server;
var RpcSocket = require('rpc-websocket');

type ProviderOptions = {
  args: string[],
  env?: { [s: string]: string},
  requires?: string[],
};

/*
    var g = this.graph;
    while (g && !(g instanceof Target))
      g = g.graph;
    */

class Provider {
  private static idCounter= 0;
  id: number;
  type: string;
  conditions: Provider.Conditions;

  static requireInput = "in&out";
  static requireTargetDependencies = "target";

  constructor(conditions) {
    this.conditions = conditions;
    this.id= ++Provider.idCounter;
  }

  isCompatible(conditions: {[s: string]: string|((v) => boolean)}) : boolean {
    for(var k in conditions) {
      if (conditions.hasOwnProperty(k)) {
        var cnd = conditions[k];
        var v = this.conditions[k];
        var ok = typeof cnd === "function" ? cnd(v) : cnd === v;
        if (!ok)
          return false;
      }
    }
    return true;
  }

  acquireResource(cb: () => void) { cb(); }
  releaseResource() {}

  mapOptions(options: any, original:string, mapped:string) : any {
    return options;
  }
  process(step, inputs: File[], outputs: File[], action: string, options: ProviderOptions) {
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

  export var maxConcurrentTasks: number = os.cpus().length;
  var nbTaskRunning: number = 0;
  var waitingTasks: (() => void)[] = [];
  export class LocalProvider extends Provider {
    acquireResource(cb: () => void) {
      if (nbTaskRunning < maxConcurrentTasks) {
        ++nbTaskRunning;
        cb;
      }
      else {
        waitingTasks.push(cb);
      }
    }
    releaseResource() {
      --nbTaskRunning;
      if (waitingTasks.length > 0)
        waitingTasks.shift()();
    }
  }

  export class Process extends LocalProvider {
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
    process(step, inputs: File[], outputs: File[], action: string, options: ProviderOptions) {
      if (this.options && this.options.PATH) {
        options.env = options.env || {};
        options.env['PATH'] = this.options.PATH.join(";") + ";" + process.env.PATH;
      }
      if (this.options && this.options.args) {
        options.args = options.args || [];
        options.args.unshift.apply(options.args, this.options.args);
      }
      RunProcess.run(this.bin, options.args, options.env, (err, output) => {
        step.context.err = err;
        step.context.output = output;
        step.continue();
      });
    }
  }

  export class Remote extends Provider {
    constructor(conditions, public io) {
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
    process(step, inputs: File[], outputs: File[], action: string, options: any) {
      var inputsMapped= inputs.map((i) => { return i.path; });
      var outputsMapped= outputs.map((output) => { return output.path; });
      this.io.rpc("process-init", inputsMapped, (pid) => {
        var barrier = new Barrier.ErrBarrier("RemoteProvider handle inputs", inputs.length);
        inputs.forEach((file, idx) => {
          var reader = fs.createReadStream(file.path);
          var chunkidx = 0;
          reader.on('data', (data) => {
            this.io.send("process-upload", { pid:pid, idx:idx, data: data });
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
            self.io.send("process-end", { pid: pid });
            var args= Array.from(arguments);
            if (err && typeof err !== "string") {
              if (Array.isArray(err))
                err= Array.from(err).map(function(err: any) { return err.message || err; }).join(', ');
              else
                err= err.message || err;
              args[0]= err;
            }
            step.context.err = args[0];
            step.context.output = args[1];
            step.continue();
          };
          if (errors.length) return end(errors);

          outputsStream= outputs.map((output) => { return fs.createWriteStream(output.path); });
          this.io.on("process-upload-" + pid, (msg: {idx: number, data: any}) => {
            if (!msg.data || msg.data.type !== "Buffer") return console.warn("process-upload: Invalid data type: ", msg.idx);
            outputsStream[msg.idx].write(new Buffer(msg.data.data));
          });
          this.io.rpc("process-run", {pid: pid, id: this.id, outputs:outputsMapped, action:action, options:options}, (r: {err: Error, output_errors?: Error[], args?:any[]}) => {
            console.info("process-run-cb", pid, r.err, r.output_errors);
            //this.io.off("process-upload-" + pid);
            if (r.err || r.output_errors.length) return end(r.err || r.output_errors.join(", "));
            end.apply(null, r.args);
          });
        });
      });
    }
  }
  export class RemoteClient {
    socket: SocketIOClient.Socket;

    constructor(url: string) {
      var ws = IoEngineClient(url);
      if (!ws) throw new Error("Unable to create ws to " + url);
      this.socket= new RpcSocket(ws);
      this.socket.on("register", (conditions, reply) => {
        console.info("Remote provider registered", conditions);
        var provider= new Remote(conditions, this.socket);
        Provider.register(provider);
        reply(provider.id);
      });
      this.socket.on("unregister", (id: number) => {
        Provider.unregister(id);
      });
    }

  }
  export class Server {
    io;
    providers: {[n: number]: Provider}= {};
    tmp: string;
    counter: number;
    ctxs= {};

    constructor(port: number, tmpDirectory: string) {
      this.io = new RpcServer(IoEngine.listen(port));
      this.tmp = tmpDirectory;
      this.counter= (new Date()).getTime();
      this.io.on("connection", (ws) => {
        console.info("Connected to ", ws.webSocket.remoteAddress);
        var barrier = new Barrier("Provider.Server.register", Provider.providers.length);
        Provider.providers.forEach((provider) => {
          ws.rpc("register", provider.conditions, (id: number) => {
            this.providers[id]= provider;
            barrier.dec();
          });
        });
        barrier.endWith(() => {
          ws.send("ready");
        });
        var ctxs = {};
        ws.on("process-init", (input_paths: string[], reply: (pid) => any) => {
          console.info("process-init", input_paths);
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
            ctxs[ctx.id] = ctx;
            reply(ctx.id);
          });
        });
        ws.on("process-end", (pid) => {
          console.info("process-end", pid);
          var ctx= ctxs[pid];
          if (!ctx) return console.warn("process-end: Unable to find context: ", pid);
          fsex.remove(ctx.dir, (err) => {
            if (err) console.warn("process-end: Unable to remove directory " + ctx.dir + " :", err)
          });
          delete ctxs[pid];
        });
        ws.on("process-upload", (msg) => {
          var ctx = ctxs[msg.pid];
          if (!ctx) return console.warn("process-upload: Unable to find context: ", msg.pid);
          if (!msg.data || msg.data.type !== "Buffer") return console.warn("process-upload: Invalid data type: ", msg.pid);
          ctx.inputs[msg.idx].write(new Buffer(msg.data.data));
        });
        ws.on("process-run", (msg: {pid: any, id:number, outputs:string[], action: string, options: any}, reply:(msg: {err: Error, output_errors?: Error[], args?: any[]}) => any) => {
          console.info("process-run", msg.pid, msg.id, msg.outputs);
          var ctx= ctxs[msg.pid];
          if (ctx.err) return reply({ err: ctx.err.message || ctx.err });
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
            console.info("process-run", "inputs flushed", msg.pid);
            var provider = this.providers[msg.id];
            if (provider) {
              var outputsMapped= msg.outputs.map((output) => {
                var filepath= ctx.filePath(output);
                msg.options= provider.mapOptions(msg.options, output, filepath);
                return File.getShared(filepath);
              });
              var inputsMapped= ctx.input_paths_mapped.map((path, idx) => {
                msg.options= provider.mapOptions(msg.options, ctx.input_paths[idx], path);
                return File.getShared(path);
              });
              async.run(null, [
                (step) => {
                  provider.process(step, inputsMapped, outputsMapped, msg.action, msg.options);
                },
                (step) => {
                  var err = step.context.err;
                  console.info("process-run", "runned", msg.pid, err);
                  if(err) return reply({ err:null, output_errors:[], args:[err, null]});
                  var barrier = new Barrier.ErrBarrier("ServerProvider handle outputs", outputsMapped.length);
                  outputsMapped.forEach((output, idx) => {
                    var stream= fs.createReadStream(output.path);
                    stream.on("error", (err) => { barrier.dec(err); });
                    stream.on("data", (data) => { ws.send("process-upload-" + msg.pid, {idx:idx, data: data}); });
                    stream.on("end", () => { barrier.dec(); });
                  });
                  barrier.endWith((errors) => {
                    console.info("process-run", "outputs sent", msg.pid, errors);
                    reply({ err:null, output_errors: errors, args: [null, step.context.output] });
                  });
                }
              ]);
            }
            else {
              console.info("process-run", "Unable to find provider", msg.pid);
              reply({ err:new Error("Unable to find provider") });
            }
          });
        });
      });
    }
  }
}

module Provider {
  export type Conditions = {[s:string]: string};
}

export = Provider;