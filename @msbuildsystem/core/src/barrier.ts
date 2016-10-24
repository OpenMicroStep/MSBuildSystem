export class Barrier {
  protected action: (() => void) | undefined;
  protected counter: number;

  constructor(public name: string, counter: number = 0) {
    this.action = undefined;
    this.counter = counter + 1;
  }

  inc() {
    if (this.counter > 0)
      this.counter++;
  }

  dec() {
    if (this.counter > 0 && --this.counter === 0)
      this.break();
  }

  break() {
    this.counter = 0;
    if (this.action) {
      let action = this.action;
      action();
      this.action = undefined;
    }
  }

  isPending() {
    return this.counter > 0;
  }

  decCallback() {
    return () => { this.dec(); };
  }

  endWith(action: () => any) {
    if (this.counter === 1) {
      action();
      this.counter = 0;
    }
    else if (this.counter > 1) {
      this.action = action;
      this.counter--;
    }
  }
}
