if (!Array.prototype.findIndex) {
  Array.prototype.findIndex = function(predicate) {
    if (this == null) {
      throw new TypeError('Array.prototype.findIndex appelé sur null ou undefined');
    }
    if (typeof predicate !== 'function') {
      throw new TypeError('predicate doit être une fonction');
    }
    var list = Object(this);
    var length = list.length >>> 0;
    var thisArg = arguments[1];
    var value;

    for (var i = 0; i < length; i++) {
      value = list[i];
      if (predicate.call(thisArg, value, i, list)) {
        return i;
      }
    }
    return -1;
  };
}

requirejs.config({
  baseUrl: "js",
  shim: {
    'bootstrap': {
      deps: ['jquery'],
    },
    'mousetrap-global-bind': {
      deps: ['mousetrap'],
    }
  },
  paths: {
    'socket.io-client': 'socket.io'
  },
});

requirejs(['jquery', "bootstrap", "IDE", "replication", "globals", "mousetrap", "mousetrap-global-bind"], function($, bootstrap, IDE, replication, globals) {
  $(function() {
    var ide = globals.ide = new IDE();
    ide.appendTo(document.body);
  });
});