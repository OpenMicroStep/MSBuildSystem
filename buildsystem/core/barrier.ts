export class Barrier {
  protected actions:((...args) => any)[];
  protected counter: number;

  constructor(public name: string, counter: number = 0) {
    this.reset(counter);
  }

  reset(counter: number) {
    this.actions = [];
    this.counter = counter;
  }

  inc() {
    this.counter++;
  }

  dec() {
    if(--this.counter === 0 && this.actions.length > 0) {
      this.actions.forEach((action) => {
       this.signal(action);
      });
    }
  }
  protected signal(action) {
    action();
  }
  decCallback() {
    return () => { this.dec(); }
  }
  waitOn(action?: (...args) => any) {
    this.inc();
    var _this = this;
    return function() {
      if(action) action.apply(null, arguments);
      _this.dec();
    }
  }

  endWith(action: () => any) {
    if(this.counter <= 0)
      this.signal(action);
    else
      this.actions.push(action);
  }
}

export class FirstErrBarrier extends Barrier {
  protected err = null;
  dec(err?: any) {
    if(err && this.counter > 0) {
      this.err = err;
      this.counter = 1;
    }
    super.dec();
  }
  decCallback() {
    return (err?: any) => { this.dec(err); }
  }
  protected signal(action) {
    action(this.err);
  }
  endWith(action: (err?) => any) {
    super.endWith(action);
  }
}

export class ErrBarrier extends Barrier {
  protected errors = [];
  dec(err?: any) {
    if(err) this.errors.push(err);
    super.dec();
  }
  decCallback() {
    return (err?: any) => { this.dec(err); }
  }
  protected signal(action) {
    action(this.errors);
  }
  endWith(action: (errors?: any[]) => any) {
    super.endWith(action);
  }
}
