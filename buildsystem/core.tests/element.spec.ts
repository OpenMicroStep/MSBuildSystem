import {Reporter} from '../core';
import {newProxyElement, DelayedElement} from '../core/element';
import {assert} from 'chai';

export function tests() {
  describe('elements', function() {
    
it("proxy element", function() {
  let $ = newProxyElement;
  let $1:any = $("tests");
  let $2:any = $1.absolutePath();
  $2.__parent = {
    resolveElements(reporter, query) {
      return [{
        absolutePath() {
          return {
            reporter: reporter,
            query: query,
          };
        }
      }]
    }
  }
  let reporter = new Reporter();
  let buildTarget: any = {};
  let res = (<DelayedElement>$2).__delayedResolve(reporter, buildTarget);
  assert.deepEqual(res, [{
    reporter: reporter,
    query: 'tests',
  }]);
})

  });
}