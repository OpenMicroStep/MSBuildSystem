export interface ActionFct      {(pool: Flux): void;}
export interface SuperactionFct {(pool: Flux, arg: any): void;}
export interface ConditionalFct {(pool: Flux): boolean;}
export type      Element=       ActionFct | _A | Async | _P
export type      Elements=      Element | (Element | Element[])[]

export class _A { _s; _args; constructor(superaction, args) {this._s= superaction; this._args= args;} }
export class _P { _p; _ctxs; constructor(p          , ctxs) {this._p= p;           this._ctxs= ctxs;} }

export function _for  (as, callback) {var i, n= as.length; for (i= 0; i<n; i++) callback(as[i]);}
export function _forr (as, callback) {var n= as.length; while (n-->0) callback(as[n],n,as);}

export class Async {
  static State= {defining: 0, started: 1, aborted: 2, finishing: 3, terminated: 4};

  context:       any; // { locale: { lastActionInterval?: number }}
  _actions:      ActionFct[];

  constructor(ctx?, actionsOrPools?: Elements)
  {
    this.context= ctx || {};
    if (!this.context.locale) this.context.locale= {};
    this._actions=      [];
    if (actionsOrPools) this.setFirstElements(actionsOrPools);
  }

  state() {return Async.State.defining;}

  setFirstElements(elements: Elements) {
    var me= this;
    function _doer(es, f) {
      if (!es) {}
      else if (typeof es === 'function') me._actions.push(es);
      else if (es instanceof Async._A  ) me._setFirstRepeatedSuperaction(es._s, es._args);
      else if (es instanceof Async     ) me._setFirstRepeatedSuperaction(Async._runParallelePools, es);
      else if (es instanceof Async._P  ) {
        _forr (es._ctxs, (ctx) => {      me._setFirstRepeatedSuperaction(Async._runParallelePools, Async.P(es._p, ctx));});}
      else if (Array.isArray(es)       ) {if (es.length) f(es);}}
    _doer(elements, function (es) {
      _forr (es, (e) => {_doer(e, function (ees) {me._paralleleElementsBuilder(ees);});});});
  }

  // Rem: null and undefined are acceptable values for args because they are acceptable values
  //      for array's elements.
  // Si args est très grand, on ne peut pas faire
  // _forr (args, (a) => {this._actions.push((p)=>{superaction(p, a);});});
  // C'est pour ça qu'on le fait par récursion.
  // setImmediate: pour éviter 'Maximum call stack size exceeded' sur très grosse répétition
  _setFirstRepeatedSuperaction(superaction: SuperactionFct, args: any | any[]) {
    var as;
    function one(p) {
      if (as.length===1) superaction(p, as.pop());
      else {
        p._actions.push(one);
        p._actions.push((pp)=>{superaction(pp, as.pop());});
        p.continue();}}
    if (superaction) {
      if (!Array.isArray(args)) this._actions.push((pool)=>{superaction(pool, args);});
      else if (args.length) {as= args.slice(0).reverse(); this._actions.push(one);}}}

  _paralleleElementsBuilder(es: Element[]) { // length > 0
    if (es.length===1 && typeof es[0] === 'function') this._actions.push(<ActionFct>es[0]);
    else {
      var pools= [];
      _for (es, (e) => {
        if (!e) {}
        else if (typeof e === 'function') pools.push(new Async(this.context, e));
        else if (e instanceof Async     ) pools.push(e);
        else if (e instanceof Async._P  ) pools.push(e);
        else if (e instanceof Async._A  ) _for (e._args, (a) => {
          pools.push(new Async(this.context, Async.A(e._s, a)));});});
      if (pools.length) this._setFirstRepeatedSuperaction(Async._runParallelePools, [pools]);}}

  continue(atEndCallback = null, ctx = this.context) : Flux {
    var flux: Flux;
    flux= new Flux(this._actions.slice(0), ctx, atEndCallback);
    flux.continue();
    return flux;
  }

  setLastActionInterval(interval: number) {
    this.context.locale.lastActionInterval= interval;
  }

  // Pousser dans un array une function ou un ensemble de functions en FIFO,
  static _pushFunctions(fcts: any | any[], array: any[]) {
    function _doer(fs, f?) {
      if (!fs) {}
      else if (typeof fs === 'function') array.push(fs);
      else if (f && Array.isArray(fs)  && fs.length) f(fs);}
    _doer(fcts, function (fs) {_forr (fs, (f) => {_doer(f);});});}

  static _runParallelePools(mainFlux: Flux, pools: (_P|Async) | (_P|Async)[]) {
    function buildAtEnd(nb: number) {
      return function (pool) {
        if (--nb === 0) mainFlux.continue();}}
    if (pools) {
      var ps= (!Array.isArray(pools) ? [pools] : pools);
      var atEnd, n= 0;
      _for (ps, (p) => {n+= (p instanceof Async) ? 1 : (<_P>p)._ctxs.length;});
      atEnd= buildAtEnd(n+1);
      _for (ps, (p) => {
        if      (p instanceof Async   ) p.continue(atEnd);
        else if (p instanceof Async._P) {
          _for ((<_P>p)._ctxs, (ctx) => {<_P>p._p.continue(atEnd, ctx ? ctx : mainFlux.context);});}});
      mainFlux._actions.push(atEnd);}
    mainFlux.continue();}

  static _X(classFct, a, bs) {
    if (!Array.isArray(bs)) bs= [bs];
    return (!a || bs.length===0) ? undefined : new classFct(a, bs);}

  static _A= _A;
  static _P= _P;
  static A(superaction, args) {return Async._X(Async._A, superaction, args);}
  static P(pool       , ctxs) {return Async._X(Async._P, pool       , ctxs);}

  static while(cond: ConditionalFct, es: Elements) {return function whileStatement(p: Flux) {
    if (cond(p)) {
      p.setFirstElements(whileStatement);
      p.setFirstElements(es);}
    p.continue();}}
  static if(cond: ConditionalFct, es: Elements, ees?: Elements) {return function (p: Flux) {
    p.setFirstElements(cond(p) ? es : ees);
    p.continue();}}
  static once(es: Elements) {
    var obs = null, done = false;
    function end(p) {
      p.continue();}
    return function (p: Flux) {
      if (done) {
        end(p);}
      else if (obs === null) {
        obs = [];
        p.setFirstElements(function(p) {
          done = true;
          end(p);
          obs.forEach(end);
          obs = null;});
        p.setFirstElements(es);
        p.continue();}
      else {
        obs.push(p);}}}

  static run(ctx, actionsOrPools: Elements) : Flux {
    var flux = new Flux([], ctx, null);
    flux.setFirstElements(actionsOrPools);
    flux.continue();
    return flux;
  }

  static debug = false;
  static debugDumpPendings = debugDumpPendings;
}

export var run = Async.run;

export class Flux extends Async {
  context:       any;
  _actions:      ActionFct[];
  _state:        number;
  _lastInterval: number;
  _timer:        any;
  _endCallback: ActionFct;
  _stackprotection: number; // 0 = no exec, 1 = action is executing, 2 = continue is pending

  constructor(actions: ActionFct[], ctx, atEndCallback) {
    super(); // this is trick to remove typescript warning
    this._actions = actions;
    this._state = Async.State.started;
    this._lastInterval = this.context.locale.lastActionInterval;
    this._timer = null;
    this._endCallback= atEndCallback;
    this._startInterval();
    this._stackprotection= 0;
    if (Async.debug)
      debugNewFlux(this);
  }

  state() {return this._state;}

  continue() : Flux {
    if (this._stackprotection === 1) {
      // this is a synchronous action, delay the call until the execution if given back to this
      this._stackprotection = 2;
      return this;}

    do {
      this._stackprotection = 1;
      // On reste finishing dès qu'on a touché la dernière action, même si celle-ci rajoute des actions au pool.
      if ((this._state === Async.State.started || this._state === Async.State.finishing) &&
          this._actions.length > 0) {
        var action= this._actions.pop();
        if (this._actions.length === 0) this._state= Async.State.finishing;       ///// finishing
        if (!Async.debug) { action(this); }
        else { debugAction(this, action);}}
      else {
        this._stopInterval();
        if (this._state !== Async.State.aborted)
          this._state= Async.State.terminated;                                   ///// terminated
        if (this._endCallback) {
          this._endCallback(this);
          this._endCallback = null;}
          if (Async.debug)
            debugEndFlux(this);}
    } while (this._stackprotection === 2);
    this._stackprotection = 0;
    return this;
  }

  setLastActionInterval(interval: number) {
    this._stopInterval();
    if (this._state < Async.State.aborted) {
      this._lastInterval= interval;
      this._startInterval();}
  }

  _startInterval() {
    if (this._lastInterval === void 0 || this._lastInterval < 0)
      this._lastInterval = null;
    if (this._state === Async.State.started && this._actions.length > 0 &&
        this._lastInterval!==null && this._timer===null) {
      if (this._lastInterval === 0) {
        this._state= Async.State.aborted;                                         ///// aborted
        this._actions[0](this);}
      else {
        this._timer= setInterval(
          () => {
            if (this._actions.length > 0 && this._state !== Async.State.finishing)
              this._actions[0](this);
            else this._stopInterval();},
          this._lastInterval);}}}

  _stopInterval() {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer= null;
      this._lastInterval= null;}}
}

var debug = { pendings: new Set(), id: 0 };
class DebugFluxProxy extends Flux {
  _p: Flux;
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
    }
  }
  get _actions() { return this._p._actions; }
  constructor(p: Flux, action) {
    if (0) super(null, null, null);
    this.context = p.context;
    this._p = p;
    this._state = 0;
    this._action = action;
    this._stacks = [];
    this._pushStack("new");
    if (p.context.locale.debugActionHistory)
      p.context.locale.debugActionHistory.push(this);
    action(this);
  }
  state() {return this._p._state;}
  continue() : Flux {
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
function debugAction(p, action) {
  new DebugFluxProxy(p, action);
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
  }
}

export function debugDumpPendings() {
  debug.pendings.forEach((p) => {
    console.info("flux in progress", debugFluxInfo(p));
  });
}
