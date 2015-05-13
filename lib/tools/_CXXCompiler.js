/**
 * Base class for
 * @constructor
 */
function CXXCompiler() {


}

/**
 * Name of the compiler (ie. clang, gcc).
 * This name must be usable by makefile to identify a specific compiler
 * @type {string}
 */
CXXCompiler.prototype.name = "undefined";

/**
 * @callback CXXCompiler~buildIncludeFilesCallback
 * @param {[File]} files
 */
/**
 * Build the list of file that got included in srcFile
 * @param {File} srcFile
 * @param {CXXCompiler~buildIncludeFilesCallback} callback
 */
CXXCompiler.prototype.buildIncludeFiles = function(srcFile, callback) {
  throw "Must be reimplemented by subclasses";
};


/**
 * @callback CXXCompiler~compileCallback
 */
/**
 * Compile srcFile to objFile
 * @param {File} srcFile Source file to build
 * @param {string} lang Language of the source file, can be 'C', 'CXX' or 'ASM'
 * @param {File} objFile Object file that will be the built source file
 * @param {object} options Compile options
 * @param {CXXCompiler~compileCallback} callback
 */
CXXCompiler.prototype.compile = function(runner, srcFile, lang, objFile, options, callback) {
  throw "Must be reimplemented by subclasses";
};

/**
 * Link the given object files
 * @param {[File]} objFiles
 * @param {File} finalFile
 * @param {object} options
 * @param {CXXCompiler~compileCallback} callback
 */
CXXCompiler.prototype.link = function(objFiles, finalFile, options, callback) {
  throw "Must be reimplemented by subclasses";
};

module.exports = CXXCompiler;
