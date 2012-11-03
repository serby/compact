# compact.js
A simple JavaScript compacting middleware for express

[![build status](https://secure.travis-ci.org/serby/compact.png)](http://travis-ci.org/serby/compact)

## Installation

    npm install compact

## Usage

### Initialise compact:

```js
var compact = require('compact').createCompact({
  srcPath: __dirname + '/public/src/',
  destPath: __dirname + '/public/compact/',
  webPath: '/js/compact/',
  debug: false
});
```

- `srcPath` is the path to your frontend JavaScript. (If you initialised your project with Express' quick start, you probably want to set this to `/public/javascripts`).
- `destPath` is the path that compact should use to store the compacted assets.
  If this directory does not exist, it will be created.
- `webPath` is the public public facing route to your `destPath` (This will preceed the filename of the output `<script>` tags, so `webPath: '/js/compact/' -> <script src="/js/compact/myscript.js">`).
- `debug` is optional. If set to true, the scripts will not be concatenated or minified.

### Create namespaces:

Namespaces are used to create different compilations of scripts. Usually, you will want to create a `global` namespace that is used everywhere:

```js
compact.addNamespace('global');

compact.ns.global
  .addJs('/js/main.js')
  .addJs('/js/widget-a.js')
  .addJs('/js/widget-b.js');
```

If you have some collection of scripts that will only be used on certain pages, it is a good idea to create a namespace for it. For example, if you have a banner and some ads that only appear on the homepage, and some UI that appears only on the profile page/section:

```js
compact.addNamespace('home')
  .addJs('/js/banner.js')
  .addJs('/js/ads.js');

compact.addNamespace('profile')
  .addJs('/js/profile.js');
```

When creating a namespace, you can also pass in an extra `srcPath`. Calls to `addJs()` will look for the file in the given `srcPath`, and if not found it then tries the `srcPath` passed to `createCompact()`.

```js
compact.addNamespace('comments',  __dirname + 'libs/comments/public/src/' )
  .addJs('/js/paging.js')
  .addJs('/js/comments.js');
```

### Using the middleware:

If you have created a `global` namespace, you can apply it to all routes like so:

```js
app.use(compact.middleware(['global']));
```

This will expose the view helper `compactJsHtml()` in your templates, so you can output the necessary `<script>` tags. 

**Note that this should appear after middleware for serving static assets.**

### Route Specific Middleware

For most use cases you'll probably want to apply namespaces on a per route bases:

```js
// Add some compacted JavaScript for just this route. Having the namespaces
// in separate arrays will produce a javascript file per array.
app.get(
  '/',
  compact.js(['home'], ['profile']),
  function (req, res) {
  /* Homepage logic here */
  }
);

// Having different namespaces joined together
// will combine and output as one javascript file.
app.get(
  '/',
  compact.js(['comments', 'profile']),
  function (req, res) {
    /* Blog page logic here */
  }
);
```

Note: compact must be applied to your route *before* the route logic. This is so that the view helper is available when you try to render your layout.

### Bulk Config

You can defined all the namespaces and js files in a JSON schema using the *configure* function.

```js

var compact = require('compact').createCompact(...);

compact.configure({
    prepend: [
        '/config.js'
    ],

    append: [
        '/garbageCollector.js'
    ],

    cmsSourcePath: '/public/vendor/cms/',
    cms: [
        'prepend',
        '/myModel.js',
        '/bootstrap.js',
        'append'
    ]
});

```

In this example you can see that you can either reference a JavaScript file or an existing namespace.

### Rendering

Any route that has `compact.js()` applied will have the helper function `compactJsHtml()` available. This will render the relevant script tags. In Jade, Use like so:

```html
!=compactJsHtml()
```

From the examples above, on `/` you'd get the following

```html
<script src="/js/compact/global.js"></script>
<script src="/js/compact/home.js"></script>
<script src="/js/compact/profile.js"></script>
```

And on `/blog` you'd get this

```html
<script src="/js/compact/global.js"></script>
<script src="/js/compact/comment-profile.js"></script>
```

You also have access to the `compactJs()` helper which will return an array
of files instead of the rendered html.

## Credits
[Paul Serby](https://github.com/serby/) follow me on [twitter](http://twitter.com/PabloSerbo)

## Licence
Licenced under the [New BSD License](http://opensource.org/licenses/bsd-license.php)
