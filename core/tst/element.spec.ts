import {Reporter, PathReporter, createInjectionContext} from '@openmicrostep/msbuildsystem.core/index.priv';

import {newProxyElement, DelayedElement} from '@openmicrostep/msbuildsystem.core/elements/delayed.element';
import {assert} from 'chai';
import {tests as injection_tests} from './injection.spec';

function proxy_element() {
  let $ = newProxyElement;
  let $1: any = $("tests");
  let $2: any = $1.absolutePath();
  $2.__parent = {
    resolveElements(reporter, query) {
      return [{
        absolutePath() {
          return {
            reporter: reporter,
            query: query,
          };
        }
      }];
    }
  };
  let reporter = new Reporter();
  let buildTarget: any = {};
  let res = (<DelayedElement>$2).__delayedResolve(createInjectionContext(reporter, buildTarget), new PathReporter(reporter));
  assert.deepEqual<any>(res, [{
    reporter: reporter,
    query: 'tests',
  }]);
}

export const tests = [
  injection_tests,
  { name: "proxy element", test: proxy_element },
];
