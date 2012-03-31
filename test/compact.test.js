var path = require('path')
  , fs = require('fs')
  , mkdirp = require('mkdirp')
  , async = require('asyncjs');

var srcPath = __dirname + '/assets'
  , destPath = __dirname + '/tmp'
  , altPath = __dirname + '/assets-alt';

function createFiles(done) {
  mkdirp(destPath, done);
}

function removeFiles(done) {
  async.rmtree(destPath, done);
}

describe('compact.js', function() {

  beforeEach(createFiles);
  afterEach(removeFiles);

  describe('#createCompact()', function() {

    it('should error with invalid source path', function() {
      (function() {
        var compact = require('../../compact').createCompact({ srcPath: 'invalid src path' });
      }).should.throw('Invalid source path \'invalid src path\'');
    });

    it('should create a missing invalid destination path', function() {
      var compact = require('../../compact').createCompact({ srcPath: srcPath, destPath: destPath + '/invalid-dest' });
      path.existsSync(destPath + '/invalid-dest').should.equal(true);
    });

    it('should succeed with valid paths', function() {
      require('../../compact')
        .createCompact({ srcPath: srcPath, destPath: destPath }).should.be.a('object');
    });
  });

  describe('#addNamespace()', function() {
    var compact;

    beforeEach(function() {
      compact = require('../../compact').createCompact({ srcPath: srcPath, destPath: destPath });
    });

    it('should fail on null', function() {
      (function() {
        compact.addNamespace(null);
      }).should.throw('Invalid namespace');
    });

    it('should succeed with valid namespace', function() {
      compact.addNamespace('global').addJs.should.be.a('function');
    });

    it('should add a source path to the lookup chain when given', function () {

      compact.addNamespace('alternative', altPath);

      // Lookup item in added path
      (function () {
        compact.ns.alternative.addJs('d.js');
      }).should.not.throw();

      // Lookup item in default path
      (function () {
        compact.ns.alternative.addJs('a.js');
      }).should.not.throw();

      // Lookup item that doesn't exist in either path
      (function () {
        compact.ns.alternative.addJs('xyz.js');
      }).should.throw('Unable to find \'xyz.js\'');

    });

  });

  describe('Namespace', function() {

    var namespace
      , compact;

    beforeEach(function() {
      compact = require('../../compact').createCompact({ srcPath: srcPath, destPath: destPath });
      namespace = compact.addNamespace('global');
    });

    describe('access via .ns', function() {
      it('should be accessible via ', function() {
        compact.ns.global.should = Object.prototype.should;
        compact.ns.global.should.be.a('object');
      });

      it('should not be able to mess with a namespace', function() {
        compact.ns.global.should = Object.prototype.should;
        (function() {
          compact.ns.global = {};
        }).should.throw('You can not alter a registered namespace \'global\'');

      });
    });

    describe('#addJs()', function() {

      it('should succeed with valid file', function() {
        namespace.addJs('a.js');
      });

      it('should be chainable', function() {
        namespace
          .addJs('a.js')
          .addJs('b.js');
      });

      it('should be able to add via .ns', function() {
        compact.ns.global
          .addJs('a.js')
          .addJs('b.js');
      });
    });
  });

  describe('#js()', function() {

    var namespace
      , compact
      , compactDebug;

    beforeEach(function() {
      compact = require('../../compact').createCompact({ srcPath: srcPath, destPath: destPath });
      compactDebug = require('../../compact').createCompact({ srcPath: srcPath, destPath: destPath, debug: true });
    });

    it('should error without parameter', function() {
      (function() {
        compact.js();
      }).should.throw('You must pass one or more arrays containing valid namespace names');

    });

    it('should succeed with empty array as first parameter', function() {
      compact.js([]).should.be.a('function');
    });

    it('should not compress and concat files in debug mode', function(done) {

      compactDebug.addNamespace('global')
        .addJs('/a.js')
        .addJs('/b.js');

       var
        req = {
          app: {
            helpers: function(helper) {
              helper.compactJs().should.eql(['/a.js', '/b.js']);
              done();
            },
            configure: function(fn) {
              fn();
            }
          }
        }
        , res;

      compactDebug.js(['global'])(req, res, function() {});
    });

    it('should create a helper when given valid input for a single namespace', function(done) {
      compact.addNamespace('global')
      .addJs('/a.js')
      .addJs('/b.js');

      var
        req = {
          app: {
            helpers: function(helper) {
              helper.compactJs().should.eql(['/global.js']);
              done();
            },
            configure: function(fn) {
              fn();
            }
          }
        }
        , res;

      compact.js(['global'])(req, res, function() {});
    });

    it('should add the files to the compacted file in the correct order', function(done) {

      compactDebug.addNamespace('global')
        .addJs('/large.js')
        .addJs('/a.js')
        .addJs('/b.js')
        .addJs('/c.js');

      var
        req = {
          app: {
            helpers: function(helper) {
              helper.compactJs().should.eql(['/large.js', '/a.js', '/b.js', '/c.js' ]);
            },
            configure: function(fn) {
              fn();
            }
          }
        }
        , res;

      compactDebug.js(['global'])(req, res, function() {

        fs.readFile(destPath + '/global.js', function(error, data) {
         // data.toString().should.equal('var a=1;a=10;var b=3,c=5');
          done();
        });
      });

    });

    it('should create the correct helpers when given valid multiple namespaces', function(done) {

      compact.addNamespace('global')
        .addJs('/a.js')
        .addJs('/b.js');

        compact.addNamespace('profile')
        .addJs('/c.js');

      var
        req = {
          app: {
            helpers: function(helper) {
              helper.compactJs().should.eql(['/global-profile.js']);
              done();
            },
            configure: function(fn) {
              fn();
            }
          }
        }
        , res;

      compact.js(['global', 'profile'])(req, res, function() {});
    });


    it('should create the correct helpers when given valid multiple namespaces in debug mode', function(done) {

      var compactDebug = require('../../compact').createCompact({ srcPath: srcPath, destPath: destPath, debug: true });


      compactDebug.addNamespace('global')
        .addJs('/a.js')
        .addJs('/b.js');

        compactDebug.addNamespace('profile')
        .addJs('/c.js');

      var
        req = {
          app: {
            helpers: function(helper) {
              helper.compactJs().should.eql(['/a.js', '/b.js', '/c.js']);
              done();
            },
            configure: function(fn) {
              fn();
            }
          }
        }
        , res;

      compactDebug.js(['global', 'profile'])(req, res, function() {});
    });

    it('should have a correct helper when given valid input for multiple groups', function(done) {

      compact.addNamespace('global')
        .addJs('/a.js');

      compact.addNamespace('blog')
        .addJs('/b.js');

        compact.addNamespace('profile')
        .addJs('/c.js');

      var
        req = {
          app: {
            helpers: function(helper) {
              helper.compactJs().should.eql(['/global-profile.js', '/blog.js']);
              done();
            },
            configure: function(fn) {
              fn();
            }
          }
        }
        , res;

      compact.js(['global', 'profile'], ['blog'])(req, res, function() {});
    });

    it('should returned the correct helpers', function(done) {

      compact.addNamespace('global')
        .addJs('/a.js')
        .addJs('/b.js')
        .addJs('/c.js');

      compact.addNamespace('profile')
        .addJs('/b.js');

      var
        doneCount = 0,
        app = {
          helpers: null,
          configure: function(fn) {
            fn();
          }
        },
        res,
        globalReq = { app: app },
        profileReq = { app: app };

        globalReq.app.helpers = function(helper) {
          helper.compactJs().should.eql(['/global.js']);
          doneCount += 1;
          if (doneCount === 2) {
            done();
          }
        };

      compact.js(['global'])(globalReq, res, function() {
        profileReq.app.helpers = function(helper) {
          helper.compactJs().should.eql(['/profile.js']);
          doneCount += 1;
          if (doneCount === 2) {
            done();
          }
        };
        compact.js(['profile'])(profileReq, res, function() {});
      });


    });
  });
});