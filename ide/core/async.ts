/// <reference path="../../typings/browser.d.ts" />

interface ActionFct      {(pool: Flux): void;}
interface SuperactionFct {(pool: Flux, arg: any): void;}
interface ConditionalFct {(pool: Flux): boolean;}
type      Element=       ActionFct | _A | Async | _P
type      Elements=      Element | (Element | Element[])[]

class _A { _s; _args; constructor(superaction, args) {this._s= superaction; this._args= args;} }
class _P { _p; _ctxs; constructor(p          , ctxs) {this._p= p;           this._ctxs= ctxs;} }

export function _for  (as, callback) {var i, n= as.length; for (i= 0; i<n; i++) callback(as[i]);}
export function _forr (as, callback) {var n= as.length; while (n-->0) callback(as[n],n,as);}

class _Base {
  context:       any;
  _actions:      ActionFct[];

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
}

export class Async extends _Base
{
  static State= {defining: 0, started: 1, aborted: 2, finishing: 3, terminated: 4};

  context:       any; // { locale: { lastActionInterval?: number }}
  _actions:      ActionFct[];
  _endCallbacks: ActionFct[];

  constructor(ctx?, actionsOrPools?: Elements)
  {
    if (0) super();
    this.context= ctx || {};
    if (!this.context.locale) this.context.locale= {};
    this._actions=      [];
    this._endCallbacks= [];
    this.setFirstElements(actionsOrPools);
  }

  state() {return Async.State.defining;}

  continue(atEndCallbacks?, ctx?) : Flux //< on devrait peut-être l'appeler run pour éviter les confusions entre pool et flux
  {
    var flux: Flux;
    flux= new Flux(this._actions.slice(0), ctx || this.context);
    flux.setEndCallbacks(this._endCallbacks);
    if (atEndCallbacks) flux.setEndCallbacks(atEndCallbacks);
    flux.continue();
    return flux;
  }

  setEndCallbacks(fs: ActionFct | ActionFct[]) {
    Async._pushFunctions(fs, this._endCallbacks);
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
}

export class Flux extends _Base {
  context:       any;
  _actions:      ActionFct[];
  _state:        number;
  _lastInterval: number;
  _timer:        any;
  _endCallbacks: ActionFct[];
  _stackprotection: number;

  constructor(actions: ActionFct[], ctx) {
    if(0) super(); // this is trick to remove typescript warning
    this.context = ctx;
    this._actions = actions;
    this._state = Async.State.started;
    this._lastInterval = ctx.locale.lastActionInterval;
    this._timer = null;
    this._endCallbacks= [];
    this._startInterval();
    this._stackprotection= 0;
  }

  state() {return this._state;}

  continue()
  {
    if (this._stackprotection > 500) { setImmediate(() => { this.continue(); }); return; }
    // On reste finishing dès qu'on a touché la dernière action, même si celle-ci rajoute des actions au pool.
    if ((this._state === Async.State.started || this._state === Async.State.finishing) &&
        this._actions.length > 0) {
      var action= this._actions.pop();
      if (this._actions.length === 0) this._state= Async.State.finishing;       ///// finishing
      this._stackprotection++;
      action(this);
      this._stackprotection--;}
    else {
      this._stopInterval();
      if (this._state !== Async.State.aborted)
        this._state= Async.State.terminated;                                   ///// terminated
      while (this._endCallbacks.length) {
        this._endCallbacks.pop()(this);}
      this._endCallbacks = null;}
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

  setEndCallbacks(fs: ActionFct | ActionFct[]) {
    if (this._endCallbacks)
      Async._pushFunctions(fs, this._endCallbacks);
    else if (typeof fs === "function")
      (<ActionFct>fs)(this);
    else if (Array.isArray(fs))
      (<ActionFct[]>fs).forEach((f) => { f(this); });
  }
}

export function run(ctx, actionsOrPools: Elements) {
  var flux: Flux;
  ctx= ctx || {};
  if (!ctx.locale) ctx.locale= {};
  flux= new Flux([], ctx || this.context);
  flux.setFirstElements(actionsOrPools);
  flux.continue();
  return flux;
}
