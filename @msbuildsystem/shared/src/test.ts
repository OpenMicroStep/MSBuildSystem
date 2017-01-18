import { Flux, Async } from './index';

declare function after(hook: () => void);
declare function describe(name: string, tests: any);
declare function it(name: string, test: (done) => void);

export type Test<T> = Test.Direct<T> | Test.Parent<T>;
export module Test {
  export type Method<T> = (flux?: Flux<T>) => void
  export type Direct<T> = { name: string, test: Method<T> } | Method<T>;
  export type Parent<T> = { name: string, tests: Test<any>[] };

  function isDirectTest<T>(test: Test<T>) : test is Test.Direct<T> {
    return typeof test === "function" || "test" in test;
  }

  function willRunOnFlux(context: any, test: Test<any>) {
    if (isDirectTest(test)) {
      it(test.name, (done) => {
        let fn = typeof test === "function" ? test : test.test;
        Async.run(context, [
          (f) => {
            if (fn.length > 0)
              fn(f);
            else {
              fn();
              f.continue();
            }
          },
          (f) => { done(); f.continue(); }
        ]);
      });
    }
    else {
      describe(test.name, () => {
        let ctx = {};
        if (Array.isArray(test.tests)) {
          if (test.tests.length > 0)
            test.tests.forEach(t => willRunOnFlux(ctx, t));
          else
            (it as any).skip('no test', () => { });
        }
        else
          it('tests format', () => { throw new Error("tests is not an array of Test"); });
      });
    }
  }

  export function run(flux: Flux<any>, test: Test<any>) {
      after(() => { flux.continue(); });
      willRunOnFlux({}, test);
  }
}
