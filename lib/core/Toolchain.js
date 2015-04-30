/**
 * @class Toolchain
 * @property {string} name Name of the toolchain
 * @property {string} arch Architecture (ie. x86_64, i386, armv7, ...)
 * @property {string} platform Platform (ie. darwin, linux, win32, android, ios, ...)
 * @property {string} os Operating system (ie. OSX10.10, Windows 7, Debian 7, ...)
 *
 * @property {function({TargetBuildOptions} options, {BuildGraphCallback} callback)} buildGraph
 *
 * @property compiler
 */

// TODO Allow tool-chains to depends on each others (ie. extension)
