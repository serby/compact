var fs = require('fs')
  , mkdirp = require('mkdirp')
  , async = require('asyncjs');

var srcPath = __dirname + '/assets/'
  , destPath = __dirname + '/tmp/'
  , altPath = __dirname + '/assets-alt/';

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
      }).should.throwError('Invalid source path \'invalid src path\'');
    });

    it('should create a missing invalid destination path', function(done) {
      var compact = require('../../compact').createCompact({ srcPath: srcPath, destPath: destPath + '/invalid-dest' });
      setTimeout(function () {
        fs.existsSync(destPath + '/invalid-dest').should.equal(true);
        done();
      }, 10);
    });

    it('should succeed with valid paths', function() {
      require('../../compact')
        .createCompact({ srcPath: srcPath, destPath: destPath }).should.be.a('object');
    });

  });

  describe('#configure', function() {

    it('should throwError error if config not an object', function() {
      var compact = require('../../compact').createCompact({ srcPath: srcPath, destPath: destPath });

      (function() {
        compact.configure([]);
      }).should.throwError();

    });

    it('should parse javascript config paths and namespaces', function() {
      var config = {
        prepend: [
          'a.js'
        ],

        append: [
          'b.js'
        ],

        test: [
          'prepend',
          'c.js',
          'append'
        ]
      },
      compact = require('../../compact').createCompact({ srcPath: srcPath, destPath: destPath });

      compact.configure(config);
      compact.ns.test.should.be.a('object');
      compact.ns.test.javascriptFiles.length.should.equal(3);
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
        }).should.throwError('You can not alter a registered namespace \'global\'');

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

    describe('#addJadeWithSafeCompression', function() {
      it('should succeed with in && out files === same data', function() {
        namespace.addJs('a.jade', { mangle: false, no_mangle_functions: true });
      });
    });

    describe('#addNamespace()', function () {
      it('should not allow a namespace to be added more than once', function () {
        (function () {
          compact.addNamespace('foo');
          compact.addNamespace('foo');
        }).should.throwError('The namespace \'foo\' has already been added');
      });

      var compact;

      beforeEach(function() {
        compact = require('../../compact').createCompact({ srcPath: srcPath, destPath: destPath });
      });

      it('should fail on null', function() {
        (function() {
          compact.addNamespace(null);
        }).should.throwError('Invalid namespace');
      });

      it('should succeed with valid namespace', function() {
        compact.addNamespace('global').addJs.should.be.a('function');
      });

      it('should add a source path to the lookup chain when given', function () {

        compact.addNamespace('alternative', altPath);

        // Lookup item in added path
        (function () {
          compact.ns.alternative.addJs('d.js');
        }).should.not.throwError();

        // Lookup item in default path
        (function () {
          compact.ns.alternative.addJs('a.js');
        }).should.not.throwError();

        // Lookup item that doesn't exist in either path
        (function () {
          compact.ns.alternative.addJs('xyz.js');
        }).should.throwError('Unable to find \'xyz.js\'');

      });
    });
  });

  describe('#middleware()', function() {

    var namespace
      , compact
      , compactDebug;

    beforeEach(function() {
      compact = require('../../compact').createCompact({ srcPath: srcPath, destPath: destPath });
      compactDebug = require('../../compact').createCompact({ srcPath: srcPath, destPath: destPath, debug: true });
    });

    it('should error without parameter', function() {
      (function() {
        compact.middleware();
      }).should.throwError('You must pass one or more arrays containing valid namespace names');

    });

    it('should succeed with empty array as first parameter', function() {
      compact.middleware([]).should.be.a('function');
    });


    it('should succeed and return nothing if a namespace has no js files added', function(done) {
      compact.addNamespace('global');
      compact.middleware(['global']).should.be.a('function');

      var req
        , res = {
          locals: {
            set compactJs(func) {
              func()[0].should.match(/\/global.js$/);
              done();
            }
          }
        };

      compact.middleware(['global'])(req, res, function() {});

    });

    it('should not compress and concat files in debug mode', function(done) {

      compactDebug.addNamespace('global')
        .addJs('/a.js')
        .addJs('/b.js');

      var req
        , res = {
          locals: {
            set compactJs(func) {
              func()[0].should.match(/\-a.js$/);
              func()[1].should.match(/\-b.js$/);
              done();
            }
          }
        };

      compactDebug.middleware(['global'])(req, res, function() {});
    });

    it('should create a helper when given valid input for a single namespace', function(done) {
      compact.addNamespace('global')
      .addJs('/a.js')
      .addJs('/b.js');

      var req
        , res = {
          locals: {
            set compactJs(func) {
              func().should.eql(['/global.js']);
              done();
            }
          }
        };

      compact.middleware(['global'])(req, res, function() {});
    });

    it('should use webPath', function(done) {
      var compactWebPath = require('../../compact').createCompact({
        webPath: '/custom', srcPath: srcPath, destPath: destPath });

      compactWebPath.addNamespace('global')
      .addJs('/a.js')
      .addJs('/b.js');

      var req
        , res = {
          locals: {
            set compactJs(func) {
              func().should.eql(['/custom/global.js']);
              done();
            }
          }
        };

      compactWebPath.middleware(['global'])(req, res, function() {});
    });

    it('should use webPath and remove extra separators', function(done) {
      var compactWebPath = require('../../compact').createCompact({
        webPath: '/custom//', srcPath: srcPath, destPath: destPath });

      compactWebPath.addNamespace('global')
      .addJs('/a.js')
      .addJs('/b.js');

      var req
        , res = {
          locals: {
            set compactJs(func) {
              func().should.eql(['/custom/global.js']);
              done();
            }
          }
        };

      compactWebPath.middleware(['global'])(req, res, function() {});
    });

    it('should add the files to the compacted file in the correct order', function(done) {

      compactDebug.addNamespace('global')
        .addJs('/large.js')
        .addJs('/a.js')
        .addJs('/b.js')
        .addJs('/c.js');

      var req
        , res = {
          locals: {
            set compactJs(func) {
              var c = func();
              c[0].should.match(/\-large.js$/);
              c[1].should.match(/\-a.js$/);
              c[2].should.match(/\-b.js$/);
              c[3].should.match(/\-c.js$/);
            }
          }
        };

      compactDebug.middleware(['global'])(req, res, function() {
        done();
      });

    });

    it('should create the correct helpers when given valid multiple namespaces', function(done) {

      compact.addNamespace('global')
        .addJs('/a.js')
        .addJs('/b.js');

        compact.addNamespace('profile')
        .addJs('/c.js');

      var req
        , res = {
          locals: {
            set compactJs(func) {
              func().should.eql(['/global-profile.js']);
              done();
            }
          }
        };

      compact.middleware(['global', 'profile'])(req, res, function() {});
    });


    it('should create the correct helpers when given valid multiple namespaces in debug mode', function(done) {

      var compactDebug = require('../../compact').createCompact({ srcPath: srcPath, destPath: destPath, debug: true });


      compactDebug.addNamespace('global')
        .addJs('/a.js')
        .addJs('/b.js');

        compactDebug.addNamespace('profile')
        .addJs('/c.js');

      var req
        , res = {
          locals: {
            set compactJs(func) {
              var c = func();
              c[0].should.match(/\-a.js$/);
              c[1].should.match(/\-b.js$/);
              c[2].should.match(/\-c.js$/);
              done();
            }
          }
        };

      compactDebug.middleware(['global', 'profile'])(req, res, function() {});
    });

    it('should have a correct helper when given valid input for multiple groups', function(done) {

      compact.addNamespace('global')
        .addJs('/a.js');

      compact.addNamespace('blog')
        .addJs('/b.js');

        compact.addNamespace('profile')
        .addJs('/c.js');

      var req
        , res = {
          locals: {
            set compactJs(func) {
              func().should.eql(['/global-profile.js', '/blog.js']);
              done();
            }
          }
        };

      compact.middleware(['global', 'profile'], ['blog'])(req, res, function() {});
    });

    it('should returned the correct helpers', function(done) {

      compact.addNamespace('global')
        .addJs('/a.js')
        .addJs('/b.js')
        .addJs('/c.js');

      compact.addNamespace('profile')
        .addJs('/b.js');

      var doneCount = 0
        , req
        , globalRes = {          
            locals: {
              set compactJs(func) {
                func().should.eql(['/global.js']);
                doneCount += 1;
                if (doneCount === 2) {
                  done();
                }      
              }
            }
          }
        , profileRes = {          
            locals: {
              set compactJs(func) {
                func().should.eql(['/profile.js']);
                doneCount += 1;
                if (doneCount === 2) {
                  done();
                }
              }
            }
          }

      compact.middleware(['global'])(req, globalRes, function() {
        compact.middleware(['profile'])(req, profileRes, function() {});
      });
    });

    it('should give higher precedence to the added srcPath', function (done) {

      compact.addNamespace('alternative', altPath);
      compact.ns.alternative.addJs('a.js');

      var req
        , res = {
          locals: function (helper) {}
        };

      compact.middleware(['alternative'])(req, res, function () {

        var compacted = fs.readFileSync(destPath + '/alternative.js', 'utf8')
          , raw = fs.readFileSync(altPath + '/a.js', 'utf8');

        raw.should.equal(compacted + ';');
        done();

      });

    });

    it('should differentiate between files with the same name from ' +
      'different locations in different namespaces', function (done) {

      var compactDebug = require('../../compact').createCompact({
        srcPath: srcPath,
        destPath: destPath,
        debug: true
      });


      compactDebug.addNamespace('global')
        .addJs('/a.js');

        compactDebug.addNamespace('alternative', altPath)
        .addJs('/a.js');

      var req
        , res = {
          locals: {
            set compactJs(func) {
              func()[0].should.not.equal(func()[1]);
              done();
            }
          }
        };

      compactDebug.middleware(['global', 'alternative'])(req, res, function() {});

    });

    it('should differentiate between files with the same name from ' +
      'different locations from the same namespace', function (done) {

      var compactDebug = require('../../compact').createCompact({
        srcPath: altPath,
        destPath: destPath,
        debug: true
      });


      compactDebug.addNamespace('global')
        .addJs('/a.js')
        .addJs('/x/a.js');

      var req
        , res = {
          locals: {
            set compactJs(func) {
              func()[0].should.not.equal(func()[1]);
              done();
            }
          }
        };

      compactDebug.middleware(['global'])(req, res, function() {});

    });


    it('should not cache namespace when in debug mode', function (done) {

      var content = 'var test = 1';
      fs.writeFileSync(srcPath + '/tmp.js', content);

      compactDebug.addNamespace('global')
        .addJs('/tmp.js')
        ;



      var results = [content, '']
        , i = 0
        , req
        , res = {
          locals: function(helper) {
            fs.readFileSync(destPath + helper.compactJs()[0]).toString().should.equal(results[i++]);
          }
        };

      compactDebug.middleware(['global'])(req, res, function() {
        fs.unlinkSync(srcPath + '/tmp.js');
        compactDebug.middleware(['global'])(req, res, function() {
          done();
        });
      });
    });


  });
});