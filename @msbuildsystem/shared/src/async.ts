export interface ActionFct<T>   {(pool: Flux<T>): void; }
export interface SuperactionFct<T, A> {(pool: Flux<T>, arg: A): void; }
export interface ConditionalFct<T>    { (pool: Flux<T>): boolean; }
export type      Element<T> =      ActionFct<T> | Async<any> | undefined;
export type      Elements<T>=      Element<T> | (Element<T> | Element<T>[])[];

function _forr<T> (as: ArrayLike<T>, callback: (v: T) => void) { var n = as.length; while (n > 0) callback(as[--n]); }

function embed<C, T, A>(c: C, args: A | A[], executor: (flux: Flux<T>, c: C, arg: A) => void ) : ActionFct<T> {
  if (!Array.isArray(args))
    return (flux: Flux<T>) => { executor(flux, c, args); };
  return (flux: Flux<T>) => {
    let idx = 0, len = args.length;
    let next = (flux: Flux<T>) => {
      if (idx < len) {
        idx++;
        flux.setFirstElements(next);
        executor(flux, c, args[idx]);
      }
      else {
        flux.continue();
      }
    };
    next(flux);
  };
}

export interface Flux<T> {
  context: AsyncContext<T>;
  state() : AsyncState;
  setFirstElements(elements: Elements<T>);
  setLastActionInterval(interval: number);
  continue();
}

export enum AsyncState {
  Defining = 0,
  Started,
  Aborted,
  Finishing,
  Terminated
}
export type AsyncContext<T> = T & { locale: { lastActionInterval?: number } };
export class Async<T> {
  static State = AsyncState;

  context: AsyncContext<T>;
  _actions: ActionFct<T>[];

  constructor(ctx?: T | null, actionsOrPools?: Elements<T>) {
    this.context = <AsyncContext<T>>(ctx || {});
    if (!this.context.locale)
      this.context.locale = {};
    this._actions = [];
    if (actionsOrPools)
      this.setFirstElements(actionsOrPools);
  }

  state() : AsyncState {
    return AsyncState.Defining;
  }

  setFirstElements(elements: Elements<T>) {
    let self = this;
    _doer(elements, level0);

    function _doer(es: Elements<T>, array?: (es: (Element<T> | Element<T>[])[]) => void) {
      if (!es) {}
      else if (typeof es === 'function') { self._actions.push(es); }
      else if (Array.isArray(es)       ) { if (es.length > 0 && array) array(es); }
      else if (es instanceof Async     ) { self._actions.push((flux: Flux<T>) => { es.continue(flux.continue.bind(flux)); }); }
    }

    function level0(es: (Element<T> | Element<T>[])[]) {
      _forr(es, (e) => { _doer(e, level1); });
    }

    function level1(ees: Element<T>[]) {
      // level 1 elements are run in parallel
      let pools = <Async<T>[]>[];
      for (var i = 0, len = ees.length; i < len; i++) {
        let element = ees[i];
        if      (typeof element === 'function') { pools.push(new Async(self.context, [element])); }
        else if (element instanceof Async     ) { pools.push(element); }
      }
      self._actions.push((flux: Flux<T>) => { Async.runInParallel(flux, pools); });
    }
  }

  continue(atEndCallback: ((flux: Flux<T>) => void) | null = null, ctx: T = this.context) : Flux<T> {
    var flux = new FluxImpl(this._actions.slice(0), ctx, atEndCallback);
    flux.continue();
    return flux;
  }

  setLastActionInterval(interval: number) {
    this.context.locale.lastActionInterval = interval;
  }

  static runInParallel<T>(flux: Flux<T>, pools: Async<any>[]) {
    let nb = pools.length + 1;
    pools.forEach((pool) => { pool.continue(atEnd); });
    atEnd();

    function atEnd() {
      if (--nb === 0)
        flux.continue();
    }
  }

  // Embed a superaction and its arguments into a sequential action
  static A<T, A>(superaction: SuperactionFct<T, A>, args: A | A[]) : ActionFct<T> {
    return embed(superaction, args, (flux: Flux<T>, superaction: SuperactionFct<T, A>, arg: A) => {
      superaction(flux, arg);
    });
  }

  // Embed a pool and its contexts into a sequential action
  static P<T>(pool: Async<T>, ctxs: T | T[]) : ActionFct<T> {
    return embed(pool, ctxs, (flux: Flux<T>, superaction: Async<T>, ctx: T) => {
      pool.continue(flux.continue.bind(flux), ctx);
    });
  }

  static while<T>(condition: ConditionalFct<T>, action: Elements<T>) : ActionFct<T> {
    return function whileStatement(p: Flux<T>) {
      if (condition(p)) {
        p.setFirstElements(whileStatement);
        p.setFirstElements(action);
      }
      p.continue();
    };
  }
  static if<T>(condition: ConditionalFct<T>, thenAction: Elements<T>, elseAction?: Elements<T>) {
    return function ifStatement(p: Flux<T>) {
      p.setFirstElements(condition(p) ? thenAction : elseAction);
      p.continue();
    };
  }

  static run<T>(ctx: T | null, actionsOrPools: Elements<T>) : Flux<T> {
    var flux = new FluxImpl<T>([], ctx, null);
    flux.setFirstElements(actionsOrPools);
    flux.continue();
    return flux;
  }

  static configuration = {
    debug: false,
    stackProtection: true,
    strict: true
  };
  static debugDumpPendings = debugDumpPendings;
}

export var run = Async.run;

class FluxImpl<T> extends Async<T> {
  _state:        number;
  _lastInterval: number | undefined | null;
  _timer:        any;
  _endCallback: ActionFct<T> | null;
  _stackprotection: number; // 0 = no exec, 1 = action is executing, 2 = continue is pending

  constructor(actions: ActionFct<T>[], ctx: T | null, atEndCallback) {
    super(ctx);
    this._actions = actions;
    this._state = AsyncState.Started;
    this._lastInterval = this.context.locale.lastActionInterval;
    this._timer = null;
    this._endCallback = atEndCallback;
    this._startInterval();
    this._stackprotection = 0;
    if (Async.configuration.debug)
      debugNewFlux(this);
  }

  state() { return this._state; }

  continue() : Flux<T> {
    if (this._stackprotection === 1) {
      // this is a synchronous action, delay the call until the execution if given back to this
      this._stackprotection = 2;
      return this;
    }

    do {
      this._stackprotection = Async.configuration.stackProtection ? 1 : 0;
      // On reste finishing dès qu'on a touché la dernière action, même si celle-ci rajoute des actions au pool.
      if ((this._state === AsyncState.Started || this._state === AsyncState.Finishing) &&
          this._actions.length > 0) {
        if (this._actions.length === 0) this._state = AsyncState.Finishing;       ///// finishing
        this._runAction(this._actions.pop()!);
      }
      else {
        this._stopInterval();
        if (this._state !== AsyncState.Aborted)
          this._state = AsyncState.Terminated;                                   ///// terminated
        if (this._endCallback) {
          this._endCallback(this);
          this._endCallback = null;
        }
        if (Async.configuration.debug)
          debugEndFlux(this);
      }
    } while (this._stackprotection === 2);
    this._stackprotection = 0;
    return this;
  }

  _runAction(action: ActionFct<T>) {
    if (Async.configuration.debug) { new DebugFluxProxy(this, action); }
    else if (Async.configuration.strict) { action(new FluxSnapshot(this)); }
    else {action(this); }
  }

  setLastActionInterval(interval: number) {
    this._stopInterval();
    if (this._state < AsyncState.Aborted) {
      this._lastInterval = interval;
      this._startInterval();
    }
  }

  _startInterval() {
    if (this._lastInterval === void 0 || this._lastInterval < 0)
      this._lastInterval = null;
    if (this._state === AsyncState.Started && this._actions.length > 0 &&
        this._lastInterval !== null && this._timer === null) {
      if (this._lastInterval === 0) {
        this._state = AsyncState.Aborted;                                         ///// aborted
        this._actions[0](this);
      }
      else {
        this._timer = setInterval(() => {
          if (this._actions.length > 0 && this._state !== AsyncState.Finishing)
            this._actions[0](this);
          else this._stopInterval();
        }, this._lastInterval);
      }
    }
  }

  _stopInterval() {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
      this._lastInterval = null;
    }
  }
}

class FluxSnapshot<T> implements Flux<T> {
  private _done = 0;
  constructor(private _origin: Flux<T>) {
    this.context = _origin.context;
  }
  context: AsyncContext<T>;
  state() : AsyncState { return this._origin.state(); }
  setFirstElements(elements: Elements<T>) { return this._origin.setFirstElements(elements); }
  setLastActionInterval(interval: number) { return this._origin.setLastActionInterval(interval); }
  continue() {
    if (++this._done === 1)
      this._origin.continue();
    else
      console.error("continue was called " + this._done + " times on flux by the same action");
  }
}

var debug = { pendings: new Set(), id: 0 };
type DebugFluxContext<T> = T & { locale: { debugActionHistory? } };
class DebugFluxProxy<T> extends FluxImpl<DebugFluxContext<T>> {
  _p: FluxImpl<DebugFluxContext<T>>;
  _state: number;
  _action;
  _stacks: any[];
  _pushStack(name) {
    this._stacks.push(new Error(name));
  }
  _debugInfo() {
    return {
      flux: this._p,
      action: this._action,
      stacks: this._stacks.map((e) => { var s = e.stack.split("\n"); s.splice(1, 1); return s; }),
    };
  }
  get _actions() { return this._p._actions; }
  constructor(p: FluxImpl<DebugFluxContext<T>>, action) {
    super([], p.context, null);
    this._p = p;
    this._state = 0;
    this._action = action;
    this._stacks = [];
    this._pushStack("new");
    if (p.context.locale.debugActionHistory)
      p.context.locale.debugActionHistory.push(this);
    action(this);
  }
  state() { return this._p._state; }
  continue() : Flux<T> {
    ++this._state;
    this._pushStack("continue");
    if (this._state !== 1)
      console.error("continue was called " + this._state + " on flux by the same action", this._debugInfo());
    return this._p.continue();
  }
  setLastActionInterval(interval: number) {
    if (this._state !== 0)
      console.error("setLastActionInterval was called after continue on flux by the same action", this._debugInfo());
    return this._p.setLastActionInterval(interval);
  }
  setFirstElements(els) {
    if (this._state !== 0)
      console.error("setFirstElements was called after continue on flux by the same action", this._debugInfo());
    return this._p.setFirstElements(els);
  }
}

function debugNewFlux(p) {
  debug.pendings.add(p);
  p.context.locale.debugActionHistory = [];
}

function debugEndFlux(p) {
  debug.pendings.delete(p);
}

function debugFluxInfo(p) {
  return {
    flux: p,
    history: p.context.locale.debugActionHistory.map((p) => {
      return p._debugInfo();
    })
  };
}

export function debugDumpPendings() {
  debug.pendings.forEach((p) => {
    console.info("flux in progress", debugFluxInfo(p));
  });
}
