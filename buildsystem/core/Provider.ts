import path = require("path");
import os = require("os");
import crypto = require("crypto");
import Target = require("./Target");
import File = require("./File");
import Task = require("./Task");
import Barrier = require("./Barrier");
import RunProcess = require("./Process");
import async = require("./async");
var fs = require("fs-extra");

var IoEngine= require('engine.io');
var IoEngineClient= require('engine.io-client');
var RpcServer = require('rpc-websocket').server;
var RpcSocket = require('rpc-websocket');

type ProviderArgs = {
  args: string[],
  env?: { [s: string]: string},
};
type ProviderOptions = {
  requires?: string[],
  task?: Task
};

function escapeRegExp(str) {
  return str.replace(/([.*+?^${}()|[\]\/\\])/g, '\\$1');
}

class Provider {
  type: string;
  conditions: Provider.Conditions;

  static require = {
    inputs: "inputs",
    files: "files",
    dependenciesOutputs: "dependencies outputs",
  }

  constructor(conditions) {
    this.conditions = conditions;
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

  process(step, inputs: File[], outputs: File[], action: string, args: ProviderArgs, options: ProviderOptions) {
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
    console.info("register provider", provider.conditions);
    Provider.providers.push(provider);
  }
  static unregister(provider: Provider) {
    console.info("unregister provider", provider.conditions);
    var idx = Provider.providers.indexOf(provider);
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
        cb();
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
    process(step, inputs: File[], outputs: File[], action: string, args: ProviderArgs, options: ProviderOptions) {
      if (this.options && this.options.PATH) {
        args.env = args.env || {};
        args.env['PATH'] = this.options.PATH.join(";") + ";" + process.env.PATH;
      }
      if (this.options && this.options.args) {
        args.args = args.args || [];
        args.args.unshift.apply(args.args, this.options.args);
      }
      RunProcess.run(this.bin, args.args, args.env, (err, output) => {
        step.context.err = err;
        step.context.output = output;
        step.continue();
      });
    }
  }

  export class Remote extends LocalProvider {
    constructor(public client: ProviderClient, conditions, public id) {
      super(conditions);
    }

    process(step, inputs: File[], outputs: File[], action: string, args: ProviderArgs, options: ProviderOptions) {
      var tid = this.client.tid;
      var conn = this.client.conn;
      var data = this.client.data;
      var upload = [];
      var download = [];
      var files = new Set<File>();
      var map = new Map<string, string>();
      var target:Target = <any>options.task;
      while (target && !(target instanceof Target))
        target = <any>target.graph;

      if (options.requires) {
        options.requires.forEach((t) => {
          if (t === Provider.require.inputs) {
            inputs.forEach((input) => { files.add(input); map.set(input.path, ""); });
          }
          if (t === Provider.require.files && target) {
            target.workspace.resolveFiles([""]).forEach((file) => { files.add(File.getShared(file)); });
          }
          if (t === Provider.require.dependenciesOutputs) {
            target.allDependencies().forEach((t) => {
              if (t !== target)
                t.listOutputFiles(files);
            });
          }
        });
      }

      var mapped = function(p, file) {
        if (map.get(file.path) === "") {
          map.set(file.path, p.context.result.path);
        }
        p.continue();
      }
      var now = Date.now();
      files.forEach((file) => {
        upload.push((p) => {
          var old = data[file.path] || 0;
          File.ensure(step, [file], { time: old }, (err, changed) => {
            p.setFirstElements((p) => {
              data[file.path] = now;
              if (map.get(file.path) === "") {
                map.set(file.path, p.context.result.path);
              }
              p.continue();
            });
            p.setFirstElements((p) => { mapped(p, file); });
            if (changed) {
              var f = this.client.uploads.get(file.path);
              if (!f) {
                f = new async.Async(null, async.Async.once((p) => {
                  conn.upload(p, { tid: tid, path: file.path });
                }));
                this.client.uploads.set(file.path, f);
              }
              p.setFirstElements([
                f,
                (p) => {
                  data[file.path] = now;
                  this.client.uploads.delete(file.path);
                  p.context.result = f.context.result;
                  p.continue();
                }
              ]);
              p.continue();
            }
            else {
              conn.map(p, { tid: tid, path: file.path });
            }
          });
        });
      });
      outputs.forEach((output) => {
        upload.push((p) => {
          p.setFirstElements((p) => {
            map.set(output.path, p.context.result.path);
            p.continue();
          });
          conn.map(p, { tid: tid, path: output.path, ensureDir: true });
        })
        download.push((p) => {
          conn.download(p, { tid: tid, localpath: output.path, remotepath: map.get(output.path) });
        });
      });
      async.run(null, [
        upload, // upload
        (p) => {
          if (args.args) {
            args.args = args.args.map((arg) => {
              var m = map.get(arg);
              if (m) return m;
              map.forEach((v, k) => {
                //console.info("value=%s, key=%s, arg=%s", v, k, arg);
                if (!m && arg.endsWith(k))
                  m = arg.substring(0, arg.length - k.length) + v;
              })
              return m || arg;
            });
          }
          conn.process(p, { tid: tid, provider: this.id, action: action, args: args });
        },
        (p) => {
          step.context.err = p.context.result.err;
          var output = p.context.result.output;
          output = output.replace(new RegExp(this.client.prefix.replace(/[\\/]/g, '[\\\\/]'), 'g') , '');
          step.context.output = output;
          p.continue();
        },
        download, // download
        (p) => {
          this.releaseResource();
          step.continue();
          p.continue();
        }
      ]);
    }
  }

  export class ProviderClient {
    static idCounter = 0;
    conn: ProviderConnection;
    providers: Remote[];
    tid: string;
    data: any;
    prefix: string;
    uploads: Map<string, async.Async>;
    constructor(url: string) {
      var ws = IoEngineClient(url);
      if (!ws) throw new Error("Unable to create ws to " + url);
      this.conn = new ProviderConnection(new RpcSocket(ws), 0, null, null);
      this.tid = (++ProviderClient.idCounter).toString();
      this.uploads = new Map<any, any>();
      this.providers = [];
    }

    init(p) {
      p.setFirstElements([
        (p) => { this.conn.data(p, { tid: this.tid }); },
        (p) => {
          this.data = p.context.result.data;
          this.prefix = p.context.result.prefix;
          p.continue();
        },
        (p) => { this.conn.providers(p); },
        (p) => {
          var providers = p.context.result.providers;
          if (providers) {
            providers.forEach((p) => {
              var prov = new Remote(this, p.conditions, p.id);
              this.providers.push(prov)
              Provider.register(prov);
            })
          }
          p.context.providers = this.providers;
          p.continue();
        }
      ]);
      p.continue();
    }

    setData(p) {
      this.conn.setData(p, { tid: this.tid, data: this.data});
    }

    destroy() {
      this.providers.forEach((p) => {
        Provider.unregister(p);
      });
      this.conn.io.destroy();
      this.conn = null;
      this.providers = null;
    }
  }

  export class ProviderConnection {
    static CanDownload = 1;
    static CanUpload = 2;
    static CanExecute = 4;
    static CanProcess = 8;
    static CanStore = 16;
    static CanAll = 1 | 2 | 4 | 8 | 16;
    flags: number;
    io;
    tmp: string;
    tids: Map<string, { path: string, data: any }>;
    _providers: Provider[];

    constructor(io: SocketIO.Socket, flags: number, tmp: string, providers: Provider[]) {
      this.io = io;
      this.flags = flags;
      this.tmp = tmp;
      this._providers = providers;
      this.tids = new Map<any, any>();
      if (flags & ProviderConnection.CanStore) {
        io.on("data", (desc: { tid: string }, cb) => {
          this._gettid(desc.tid, (err, t) => {
            cb({ err: err, data: t && t.data, prefix: t.path });
          });
        });
        io.on("setdata", (desc: { tid: string, data: any }, cb) => {
          this._gettid(desc.tid, (err, t) => {
            if (!t) return cb({ err: err });
            t.data = desc.data;
            fs.writeFile(path.join(t.path, "data.json"), JSON.stringify(t.data), 'utf8', (err) => { cb({ err: err }); });
          });
        });
        io.on("clear", (desc: { tid: string }, cb) => {
          this._gettid(desc.tid, (err, t) => {
            if (err) return cb({ err: err });
            this.tids.delete(desc.tid);
            fs.remove(t.path, (err) => { cb({ err: err }); });
          });
        });
      }
      if (flags & ProviderConnection.CanDownload) {
        io.on("download", (desc: { tid: string, path: string }, cb) => {
          this._gettid(desc.tid, (err, t) => {
            if (err) return cb({ err: err });
            if (!path.normalize(desc.path).startsWith(t.path)) return cb({ err: "path is outside tid directory" });
            fs.readFile(desc.path, 'binary', (err, data) => { cb({ err: err, data: data }); });
          });
        });
      }
      if (flags & ProviderConnection.CanUpload) {
        io.on("upload", (desc: { tid: string, path: string, data: string }, cb) => {
          this._gettid(desc.tid, (err, t) => {
            if (err) return cb({ err: err });
            var p = path.join(t.path, desc.path).replace(/\\/g, '/');
            fs.ensureFile(p, function (err) {
              if (err) return cb({ err: err });
              fs.writeFile(p, desc.data, 'binary', (err) => {
                if (err) cb({ err: err });
                else cb({ path: p });
              });
            })
          });
        });
        io.on("map", (desc: { tid: string, path: string, ensureDir?: boolean }, cb) => {
          this._gettid(desc.tid, (err, t) => {
            if (err) return cb({ err: err });
            var p = path.join(t.path, desc.path).replace(/\\/g, '/');
            if (desc.ensureDir === true)
              fs.ensureFile(p, (err) => { cb({ path: p, err: err }); });
            else
              cb({ path: p });
          });
        });
      }
      if (flags & ProviderConnection.CanProcess) {
        io.on("providers", (ignored, cb) => {
          cb({ providers: this._providers.map((p, id) => {
            return { conditions: p.conditions, id: id };
          })});
        });
        io.on("process", (desc: { tid: string, provider: number, action: string, args: any }, cb) => {
          this._gettid(desc.tid, (err, t) => {
            if (err) return cb({ err: err });
            var provider = this._providers[desc.provider];
            if (!provider) return cb({ err: "provider not found" });
            async.run(null, [
              (p) => { provider.process(p, [], [], desc.action, desc.args, {}); },
              (p) => {
                cb({err: p.context.err, output: p.context.output });
                p.continue();
              }
            ]);
          });
        });
      }
      if (flags & ProviderConnection.CanExecute) {
        io.on("start", (cb: (providers: { conditions: any, id: string }[]) => void) => {

        });
      }
      if (flags & (ProviderConnection.CanExecute | ProviderConnection.CanProcess)) {
        io.on("stdin", (desc: { pid: string, data: Buffer }, cb: (ok: boolean) => void) => {

        });
        io.on("exit", (desc: { pid: string }, cb: (ok: boolean) => void) => {

        });
      }
    }

    _gettid(tid, cb: (err, t?) => void) {
      if (!(/^\w+$/.test(tid))) {
        var hash = crypto.createHash('sha256');
        hash.update(tid);
        tid = hash.digest('hex');
      }
      var t = this.tids.get(tid);
      if (t) return cb(null, t);
      this.tids.set(tid, t= { path: path.join(this.tmp, tid), data: {} });
      fs.ensureDir(t.path, (err) => {
        if (err) return cb(err);
        fs.readFile(path.join(t.path, "data.json"), 'utf8', (err, data) => {
          if (err) return cb(null, t);
          try { t.data = JSON.parse(data); } catch(e) {}
          cb(null, t);
        });
      });
    }

    _result(p) {
      return function(result) {
        p.context.result = result;
        p.continue();
      };
    }

    providers(p) {
      this.io.rpc("providers", null, this._result(p));
    }

    data(p, desc: { tid: string }) {
      this.io.rpc("data", desc, this._result(p));
    }

    setData(p, desc: { tid: string, data: any }) {
      this.io.rpc("setdata", desc, this._result(p));
    }

    clear(p, desc: { tid: string }) {
      this.io.rpc("clear", desc, this._result(p));
    }

    map(p, desc: { tid: string, path: string, ensureDir?: boolean }) {
      this.io.rpc("map", desc, this._result(p));
    }

    upload(p, desc: { tid: string, path: string }) {
      fs.readFile(desc.path, 'binary', (err, data) => {
        if (err) return this._result(p)(err);
        this.io.rpc("upload", { tid: desc.tid, path: desc.path, data: data }, this._result(p));
      });
    }

    uploadData(p, desc: { tid: string, path: string, data: string }) {
      this.io.rpc("upload", desc, this._result(p));
    }

    download(p, desc: { tid: string, remotepath: string, localpath: string }) {
      this.io.rpc("download", { tid: desc.tid, path: desc.remotepath }, (r) => {
        if (r.err) return this._result(p)(r);
        if (!desc.localpath) return this._result(p)(r);
        //console.info("downloaded", r);
        fs.writeFile(desc.localpath, r.data, "binary", (err) => {
          r.localpath = desc.localpath;
          this._result(p)(r);
        });
      });
    }

    process(p, desc: { tid: string, provider: number, action: string, args: any }) {
      this.io.rpc("process", desc, this._result(p));
    }

    start(p, desc: { path: string, args: string[], stdout: (data: Buffer) => void, stderr: (data: Buffer) => void, exit: (code: number, signal: number) => void }) {
      this.io.rpc("start", { path: desc.path, args: desc.args }, (r : { pid: string }) => {
        p.context.reply = r.pid;
        p.continue();
      });
    }

    stdin(p, desc: { pid: string, data: Buffer }) {
      this.io.rpc("stdin", desc, (ok) => {
        p.context.reply = ok;
        p.continue();
      });
    }

    exit(p, desc: { pid: string }) {
      this.io.rpc("exit", desc, (ok) => {
        p.context.reply = ok;
        p.continue();
      });
    }
  }

  export class Server {
    server;
    tmp: string;

    constructor(port: number, host: string, tmpDirectory: string) {
      console.info("Provider server is listening to %s:%d", host, port);
      this.server = new RpcServer(IoEngine.listen(port, host));
      this.server.on("connection", (ws) => {
        console.info("New provider connection", ws.webSocket.remoteAddress);
        new ProviderConnection(ws, ProviderConnection.CanAll, tmpDirectory, Provider.providers);
        ws.on("close", (reason) => {
          console.info("End provider connection %s: %s", ws.webSocket.remoteAddress, reason);
        })
      });
    }
  }
}

module Provider {
  export type Conditions = {[s:string]: string};
}

export = Provider;