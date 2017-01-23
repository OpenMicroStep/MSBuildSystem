cmd_Release/obj.target/clang_indexer/addon.o := c++ '-DNODE_GYP_MODULE_NAME=clang_indexer' '-D_DARWIN_USE_64_BIT_INODE=1' '-D_LARGEFILE_SOURCE' '-D_FILE_OFFSET_BITS=64' '-DBUILDING_NODE_EXTENSION' -I/Users/vincentrouille/.node-gyp/6.2.1/include/node -I/Users/vincentrouille/.node-gyp/6.2.1/src -I/Users/vincentrouille/.node-gyp/6.2.1/deps/uv/include -I/Users/vincentrouille/.node-gyp/6.2.1/deps/v8/include -I../node_modules/nan -I/Users/vincentrouille/Dev/MicroStep/llvm/tools/clang/include  -Os -gdwarf-2 -mmacosx-version-min=10.7 -arch x86_64 -Wall -Wendif-labels -W -Wno-unused-parameter -std=gnu++0x -fno-rtti -fno-exceptions -fno-threadsafe-statics -std=c++11 -stdlib=libc++ -MMD -MF ./Release/.deps/Release/obj.target/clang_indexer/addon.o.d.raw   -c -o Release/obj.target/clang_indexer/addon.o ../addon.cc
Release/obj.target/clang_indexer/addon.o: ../addon.cc \
  /Users/vincentrouille/Dev/MicroStep/llvm/tools/clang/include/clang-c/Index.h \
  /Users/vincentrouille/Dev/MicroStep/llvm/tools/clang/include/clang-c/Platform.h \
  /Users/vincentrouille/Dev/MicroStep/llvm/tools/clang/include/clang-c/CXErrorCode.h \
  /Users/vincentrouille/Dev/MicroStep/llvm/tools/clang/include/clang-c/CXString.h \
  /Users/vincentrouille/Dev/MicroStep/llvm/tools/clang/include/clang-c/BuildSystem.h \
  ../node_modules/nan/nan.h \
  /Users/vincentrouille/.node-gyp/6.2.1/include/node/node_version.h \
  /Users/vincentrouille/.node-gyp/6.2.1/include/node/uv.h \
  /Users/vincentrouille/.node-gyp/6.2.1/include/node/uv-errno.h \
  /Users/vincentrouille/.node-gyp/6.2.1/include/node/uv-version.h \
  /Users/vincentrouille/.node-gyp/6.2.1/include/node/uv-unix.h \
  /Users/vincentrouille/.node-gyp/6.2.1/include/node/uv-threadpool.h \
  /Users/vincentrouille/.node-gyp/6.2.1/include/node/uv-darwin.h \
  /Users/vincentrouille/.node-gyp/6.2.1/include/node/pthread-barrier.h \
  /Users/vincentrouille/.node-gyp/6.2.1/include/node/node.h \
  /Users/vincentrouille/.node-gyp/6.2.1/include/node/v8.h \
  /Users/vincentrouille/.node-gyp/6.2.1/include/node/v8-version.h \
  /Users/vincentrouille/.node-gyp/6.2.1/include/node/v8config.h \
  /Users/vincentrouille/.node-gyp/6.2.1/include/node/node_buffer.h \
  /Users/vincentrouille/.node-gyp/6.2.1/include/node/node_object_wrap.h \
  ../node_modules/nan/nan_callbacks.h \
  ../node_modules/nan/nan_callbacks_12_inl.h \
  ../node_modules/nan/nan_maybe_43_inl.h \
  ../node_modules/nan/nan_converters.h \
  ../node_modules/nan/nan_converters_43_inl.h \
  ../node_modules/nan/nan_new.h \
  ../node_modules/nan/nan_implementation_12_inl.h \
  ../node_modules/nan/nan_persistent_12_inl.h \
  ../node_modules/nan/nan_weak.h ../node_modules/nan/nan_object_wrap.h \
  ../node_modules/nan/nan_typedarray_contents.h
../addon.cc:
/Users/vincentrouille/Dev/MicroStep/llvm/tools/clang/include/clang-c/Index.h:
/Users/vincentrouille/Dev/MicroStep/llvm/tools/clang/include/clang-c/Platform.h:
/Users/vincentrouille/Dev/MicroStep/llvm/tools/clang/include/clang-c/CXErrorCode.h:
/Users/vincentrouille/Dev/MicroStep/llvm/tools/clang/include/clang-c/CXString.h:
/Users/vincentrouille/Dev/MicroStep/llvm/tools/clang/include/clang-c/BuildSystem.h:
../node_modules/nan/nan.h:
/Users/vincentrouille/.node-gyp/6.2.1/include/node/node_version.h:
/Users/vincentrouille/.node-gyp/6.2.1/include/node/uv.h:
/Users/vincentrouille/.node-gyp/6.2.1/include/node/uv-errno.h:
/Users/vincentrouille/.node-gyp/6.2.1/include/node/uv-version.h:
/Users/vincentrouille/.node-gyp/6.2.1/include/node/uv-unix.h:
/Users/vincentrouille/.node-gyp/6.2.1/include/node/uv-threadpool.h:
/Users/vincentrouille/.node-gyp/6.2.1/include/node/uv-darwin.h:
/Users/vincentrouille/.node-gyp/6.2.1/include/node/pthread-barrier.h:
/Users/vincentrouille/.node-gyp/6.2.1/include/node/node.h:
/Users/vincentrouille/.node-gyp/6.2.1/include/node/v8.h:
/Users/vincentrouille/.node-gyp/6.2.1/include/node/v8-version.h:
/Users/vincentrouille/.node-gyp/6.2.1/include/node/v8config.h:
/Users/vincentrouille/.node-gyp/6.2.1/include/node/node_buffer.h:
/Users/vincentrouille/.node-gyp/6.2.1/include/node/node_object_wrap.h:
../node_modules/nan/nan_callbacks.h:
../node_modules/nan/nan_callbacks_12_inl.h:
../node_modules/nan/nan_maybe_43_inl.h:
../node_modules/nan/nan_converters.h:
../node_modules/nan/nan_converters_43_inl.h:
../node_modules/nan/nan_new.h:
../node_modules/nan/nan_implementation_12_inl.h:
../node_modules/nan/nan_persistent_12_inl.h:
../node_modules/nan/nan_weak.h:
../node_modules/nan/nan_object_wrap.h:
../node_modules/nan/nan_typedarray_contents.h:
