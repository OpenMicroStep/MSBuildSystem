#set -e
DIR="_/bootstrap6/node/debug/node_modules/@msbuildsystem"

publish() {
  pushd "$1"
  npm publish
  popd
}

publish "$DIR/aspects"
publish "$DIR/core"
publish "$DIR/cli"
publish "$DIR/foundation"
publish "$DIR/js"
publish "$DIR/js.typescript"
publish "$DIR/js.logitud"
publish "$DIR/shared"
