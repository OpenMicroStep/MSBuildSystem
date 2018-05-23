import {Parser, Reporter, Diagnostic} from '@openmicrostep/msbuildsystem.shared';
import * as Q from '@openmicrostep/msbuildsystem.shared/query';
import {assert} from 'chai';

function testQuery(query: string, expected: Partial<Q.Query>, diags: Diagnostic[]) {
  expected = {
    groups: [], requiredTags: [], rejectedTags: [],
    method: undefined, explicitAttributes: undefined, removedAttributes: undefined,
    ...expected
  };
  return { name: query, test: function() {
    let parser = new Parser(new Reporter(), query);
    let r = Q.parseQuery(parser);
    assert.deepEqual(parser.reporter.diagnostics, diags);
    assert.deepEqual(r, expected);
  } };
}

export const tests = { name: "query", tests: [
  testQuery("=group1"                           , { groups: [["group1"]]                                                }, []),
  testQuery("=group1:group2"                    , { groups: [["group1", "group2"]]                                      }, []),
  testQuery("=group1 + group2"                  , { groups: [["group1"], ["group2"]]                                    }, []),
  testQuery("=g1 :g_2 + g3 + g4 + g-5: g 6"     , { groups: [["g1", "g_2"], ["g3"], ["g4"], ["g-5", "g 6"]]             }, []),
  testQuery("=g1 :g_2 + g3 + g4 + g-5: g 6"     , { groups: [["g1", "g_2"], ["g3"], ["g4"], ["g-5", "g 6"]]             }, []),
  testQuery("=? tag1"                           , { requiredTags: ["tag1"]                                              }, []),
  testQuery("=? tag1 + tag2"                    , { requiredTags: ["tag1", "tag2"]                                      }, []),
  testQuery("=? tag1+ tag2 +!tag3 + ! tag4"     , { requiredTags: ["tag1", "tag2"], rejectedTags: ["tag3", "tag4"]      }, []),
  testQuery("=g1 ? tag1"                        , { groups: [["g1"]], requiredTags: ["tag1"]                            }, []),
  testQuery("=g1 + g2 :g3 ? t1 + t2"            , { groups: [["g1"], ["g2", "g3"]], requiredTags: ["t1", "t2"]          }, []),
  testQuery("={g1 + g2 :g3 ? t1 + t2} + a1"     , { groups: [["g1"], ["g2", "g3"]], requiredTags: ["t1", "t2"], explicitAttributes: new Set(["a1"])       }, []),
  testQuery("={g1 + g2 :g3 ? t1 + t2}+ a1 +a2"  , { groups: [["g1"], ["g2", "g3"]], requiredTags: ["t1", "t2"], explicitAttributes: new Set(["a1", "a2"]) }, []),
  testQuery("={g1 + g2 :g3 ? t1 + t2} - a1"     , { groups: [["g1"], ["g2", "g3"]], requiredTags: ["t1", "t2"], removedAttributes: new Set(["a1"])        }, []),
  testQuery("={g1 + g2 :g3 ? t1 + t2} -a1 -  a2", { groups: [["g1"], ["g2", "g3"]], requiredTags: ["t1", "t2"], removedAttributes: new Set(["a1", "a2"])  }, []),
  testQuery("={g1 + g2 :g3 ? t1 + t2} .m1"      , { groups: [["g1"], ["g2", "g3"]], requiredTags: ["t1", "t2"], method: "m1"                              }, []),
]};
