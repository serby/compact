var path = require('path')
  , fs = require('fs')
  , async = require('async')
  , _ = require('underscore')
  , parser = require("uglify-js").parser
  , uglifyer = require("uglify-js").uglify;

module.exports.createCompact = function(sourcePath, destinationPath, webPath) {


  if (!path.existsSync(sourcePath)) {
    throw new Error('Invalid source path \'' + sourcePath + '\'');
  }

  if (!path.existsSync(destinationPath)) {
    throw new Error('Invalid destination path \'' + destinationPath + '\'');
  }

  var namespaces = Object.create(null)
    , compactedJs = []
    , namespaceGroupsCache = {}
    , compressOperationCache = {};

  webPath = webPath || '';

  function addNamespace(name) {

    if (!name) {
      throw new Error('Invalid namespace');
    }

    if (!namespaces[name]) {
      var newNamespace = {};
      Object.defineProperty(namespaces, name, {
        get: function() { return newNamespace; },
        configurable: false,
        enumerable: true,
        set: function(value) {
          throw new Error('You can not alter a registered namespace \'' + name + '\''); }
      });
    }
    var namespace = namespaces[name];

    function addJs(filePath) {
      if (!namespace.javascriptFiles) {
        namespace.javascriptFiles = [];
      }
      namespace.javascriptFiles.push(path.normalize(sourcePath + '/' + filePath));

      return namespace;
    }

    namespace.addJs = addJs;

    return namespace;
  }

  function compressAndWriteJavascript(targetNamespaces, callback) {
    var compressedData = ''
      , javascriptFiles = [];

    var compactFilename = targetNamespaces.map(function(namespace) {
        return namespace;
      }).join('-') + '.js'
      , outputFilename = destinationPath + '/' + compactFilename;

    // Only compress and write 'compactFilename' once
    if (compressOperationCache[compactFilename]) {
      callback(undefined, outputFilename);
    }

    targetNamespaces.forEach(function(namespace) {
      javascriptFiles = javascriptFiles.concat(namespaces[namespace].javascriptFiles);
    });

    javascriptFiles = _.uniq(javascriptFiles);

    async.concat(javascriptFiles, fs.readFile, function(error, contents) {

      if (error) {
        return callback(error);
      }

      fs.writeFile(outputFilename, compress(contents.join('')), 'utf-8', function(error) {
        if (error) {
          return callback(error);
        }
        compactedJs.push(path.normalize(webPath + '/' + compactFilename));
        compressOperationCache[compactFilename] = true;
        callback(undefined, outputFilename);
      });
    });
  }

  function compress(data) {
    var ast = parser.parse(data);
    ast = uglifyer.ast_mangle(ast);
    ast = uglifyer.ast_squeeze(ast);
    return uglifyer.gen_code(ast);
  }

  function processNamespace(namespace) {
    if (!namespaces[namespace]) {
      throw new RangeError('Unknown namespace \'' + namespace + '\'');
    }
  }

  function compactJavascript() {
    if (arguments.length === 0) {
      throw new Error('You must pass one or more arrays containing valid namespace names');
    }
    var namespaceGroups = Array.prototype.slice.call(arguments);

    compactedJs = [];

    return function(req, res, next) {
      // Only do the work once for each namespaceGroups
      var hash = namespaceGroups.join('|');
      if (namespaceGroupsCache[hash]) {
        next();
      }


      async.forEach(namespaceGroups, compressAndWriteJavascript, function(error) {
        if (error) {
          return next(error);
        }

        req.app.helpers({
          compactJs: function() {
            return compactedJs;
          },
          compactJsHtml: function() {
            return compactedJs.map(function(filename) {
              return '<script src="/' + filename + '"></script>';
            }).join('');
          },
        });
        namespaceGroupsCache[hash] = true;
        next();
      });
    };
  }

  return {
    addNamespace: addNamespace,
    js: compactJavascript,
    ns: namespaces
  };
};