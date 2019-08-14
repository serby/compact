var path = require('path')
var fs = require('fs')
var mkdirp = require('mkdirp')
var async = require('async')
var _ = require('lodash')
var parser = require('uglify-js').parser
var uglifyer = require('uglify-js').uglify
var crypto = require('crypto')

module.exports.createCompact = function(options) {
  options = _.extend(
    {
      webPath: '',
      debug: false,
      uglify: {}
    },
    options
  )

  if (!fs.existsSync(options.srcPath)) {
    throw new Error("Invalid source path '" + options.srcPath + "'")
  }

  if (!fs.existsSync(options.destPath)) {
    mkdirp(options.destPath)
  }

  var namespaces = {}
  var namespaceGroupsCache = {}
  var compressOperationCache = {}

  // eslint-disable-next-line no-unused-vars
  function getNamespace(name) {
    if (!Object.prototype.hasOwnProperty.call(namespaces, name)) {
      throw new Error("Unknown namespace '" + name + "'")
    }
    return namespaces[name]
  }

  function addNamespace(name, namespaceSourcePath) {
    if (!name) {
      throw new Error('Invalid namespace')
    }

    if (namespaces[name]) {
      throw new Error("The namespace '" + name + "' has already been added")
    }

    var newNamespace = {}
    Object.defineProperty(namespaces, name, {
      get: function() {
        return newNamespace
      },
      configurable: false,
      enumerable: true,
      set: function(value) {
        throw new Error(
          "You can not alter a registered namespace '" + name + "'"
        )
      }
    })
    var namespace = namespaces[name]

    namespace.javascriptFiles = []

    function addJs(filePath) {
      var paths = [
        path.normalize(namespaceSourcePath + '/' + filePath),
        path.normalize(options.srcPath + '/' + filePath),
        path.normalize(filePath)
      ]

      var jsPath
      for (var i = 0; i < paths.length; i++) {
        if (fs.existsSync(paths[i])) {
          jsPath = paths[i]
          break
        }
      }

      if (jsPath === undefined) {
        throw new Error("Unable to find '" + filePath + "'")
      }
      namespace.javascriptFiles.push(jsPath)

      return namespace
    }

    namespace.addJs = addJs

    return namespace
  }

  function configure(config) {
    if (typeof config !== 'object' || config.length !== undefined) {
      throw new TypeError('config must be an object')
    }

    function parseConfigNamespace(ns, params) {
      for (var i = 0; i < params.length; i++) {
        if (params[i].match(/\.js$/)) {
          ns.addJs(params[i])
        } else {
          parseConfigNamespace(ns, config[params[i]])
        }
      }
      return ns
    }

    for (var key in config) {
      if (typeof config[key] !== 'object') {
        continue
      }

      var ns = addNamespace(key, config[key + 'SourcePath'] || null)
      var params = config[key]
      if (!params.length) {
        continue
      }

      parseConfigNamespace(ns, params)
    }
  }

  function copyFile(src, callback) {
    var md5 = crypto.createHash('md5')
    md5.update(src)
    var hash = md5.digest('hex').substr(0, 10)
    var source = fs.createReadStream(src)
    var dest = fs.createWriteStream(
      options.destPath + '/' + hash + '-' + path.basename(src)
    )
    source.pipe(dest)
    source.on('error', function(error) {
      callback(error)
    })

    source.on('end', function() {
      callback(
        null,
        path.normalize(options.webPath + '/' + hash + '-' + path.basename(src))
      )
    })
  }

  function getJavaScriptFilesFromNamespaces(targetNamespaces) {
    var files = []
    targetNamespaces.forEach(function(namespace) {
      if (!namespaces[namespace]) {
        throw new Error(
          "Unknown namespace '" +
            namespace +
            "'. Ensure you provide a namespace that has been defined with 'addNamespace()'"
        )
      }
      files = files.concat(namespaces[namespace].javascriptFiles)
    })

    return _.uniq(files)
  }

  function copyJavaScript(targetNamespaces, callback) {
    var files = []
    try {
      files = getJavaScriptFilesFromNamespaces(targetNamespaces)
    } catch (e) {
      return callback(e)
    }
    async.concatSeries(files, copyFile, function(ignoreError, results) {
      callback(undefined, results)
    })
  }

  function compressAndWriteJavascript(
    targetNamespaces,
    callback,
    uglifyOptions
  ) {
    // var compressedData = ''
    var files
    var compactFilename =
      targetNamespaces
        .map(function(namespace) {
          return namespace
        })
        .join('-') + '.js'
    var outputFilename = options.destPath + '/' + compactFilename
    var compactedWebPath = (options.webPath + '/' + compactFilename).replace(
      /\/+/g,
      '/'
    )
    // var objs = []

    // Only compress and write 'compactFilename' once
    if (compressOperationCache[compactFilename]) {
      return callback(undefined, compactedWebPath)
    }

    try {
      files = getJavaScriptFilesFromNamespaces(targetNamespaces)
    } catch (e) {
      return callback(e)
    }
    async.concatSeries(files, fs.readFile, function(error, contents) {
      if (error) {
        return callback(error)
      }

      fs.writeFile(
        outputFilename,
        compress(contents.join(';\n'), uglifyOptions),
        'utf-8',
        function(error) {
          if (error) {
            return callback(error)
          }

          compressOperationCache[compactFilename] = true
          callback(undefined, compactedWebPath)
        }
      )
    })
  }

  function compress(data, compressorOptions) {
    var ast = parser.parse(data)
    var uglifyOptions = {}
    if (typeof compressorOptions !== 'undefined') {
      uglifyOptions = compressorOptions
    } else if (options.uglify !== 'undefined') {
      uglifyOptions = options.uglify
    }

    ast = uglifyer.ast_mangle(ast, uglifyOptions)
    ast = uglifyer.ast_squeeze(ast, uglifyOptions)
    return uglifyer.gen_code(ast, uglifyOptions)
  }

  function processNamespaceGroups(namespaceGroups, callback) {
    // Use a different compress function for debug
    var compressFunction = options.debug
      ? copyJavaScript
      : compressAndWriteJavascript

    var hash = namespaceGroups.join('|')
    if (options.debug || !namespaceGroupsCache[hash]) {
      async.map(namespaceGroups, compressFunction, function(error, results) {
        if (error) {
          return callback(error)
        }
        results = _.flatten(results)
        // No caching in debug mode
        if (options.debug) {
          namespaceGroupsCache[hash] = results
        }
        callback(undefined, results)
      })
    } else {
      callback(undefined, namespaceGroupsCache[hash])
    }
  }

  function middleware() {
    if (arguments.length === 0) {
      throw new Error(
        'You must pass one or more arrays containing valid namespace names'
      )
    }

    var namespaceGroups = Array.prototype.slice.call(arguments)

    return function(req, res, next) {
      processNamespaceGroups(namespaceGroups, function(error, results) {
        if (error) {
          return next(error)
        }
        res.locals.compactJs = function() {
          return results
        }
        res.locals.compactJsHtml = function() {
          return results
            .map(function(filename) {
              return '<script src="' + filename + '"></script>'
            })
            .join('')
        }
        next()
      })
    }
  }

  return {
    configure: configure,
    addNamespace: addNamespace,
    middleware: middleware,
    js: middleware,
    ns: namespaces
  }
}
