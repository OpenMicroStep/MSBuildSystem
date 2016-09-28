export * from '@msbuildsystem/shared/src/util';

export function timeElapsed(title: string, action: () => void) : number;
export function timeElapsed(action: () => void) : number;
export function timeElapsed(title: string) : () => number;
export function timeElapsed() : () => number;
export function timeElapsed(a0?, a1?) : any {
  var title = typeof a0 === "string" ? a0 : null;
  var action = a1 || (typeof a0 === "function" && a0);
  if (action) {
    var t = timeElapsed(title!);
    action();
    return t();
  }

  var t0 = process.hrtime();
  return function() {
    var diff = process.hrtime(t0);
    var ns = diff[0] * 1e9 + diff[1];
    if (title)
      console.info(title + " in %d ms", (ns / 1e6).toFixed(2));
    return ns;
  };
}

export function nodepromise(action: (cb: (err, value?) => void) => void) {
  return new Promise(function(res, rej) {
    action(function(err, value) {
      if (err) rej(err);
      else res(value);
    });
  });
}

