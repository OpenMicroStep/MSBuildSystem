import {Reporter, AttributePath} from '@msbuildsystem/core';
import {newProxyElement, DelayedElement} from '@msbuildsystem/core/elements/delayed.element';
import {assert} from 'chai';

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
  let res = (<DelayedElement>$2).__delayedResolve(reporter, buildTarget, new AttributePath());
  assert.deepEqual(res, [{
    reporter: reporter,
    query: 'tests',
  }]);
}

export const tests = [
  { name: "proxy element", test: proxy_element },
];
