import { Flux, Async } from './index';

declare function describe(name: string, tests: any);
declare function it(name: string, test: (done) => void);

export type Test<T> = Test.Direct<T> | Test.Parent<T>;
export module Test {
  export type Method<T> = (flux?: Flux<T>) => void
  export type Direct<T> = { name: string, test: Method<T> };
  export type Parent<T> = { name: string, tests: Test<any>[] };

  function isDirectTest<T>(test: Test<T>) : test is Test.Direct<T> {
    return "test" in test;
  }

  function willRunOnFlux(context: any, test: Test<any>) {
    if (isDirectTest(test)) {
      it(test.name, (done) => {
        Async.run(context, [
          (f) => {
            if (test.test.length > 0)
              test.test(f);
            else {
              test.test();
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
        if (Array.isArray(test.tests))
          test.tests.forEach(t => willRunOnFlux(ctx, t));
      });
    }
  }

  export function run(test: Test<any>) {
    willRunOnFlux({}, test);
  }
}
