# compact.js - A simple JavaScript and CSS compacting middleware for express

[![build status](https://secure.travis-ci.org/serby/compact.png)](http://travis-ci.org/serby/compact)

## Installation

      npm install compact

## Usage

```js

var compact = require('compact').createCompact({
	srcPath: __dirname + '/public/src/',
	destPath: __dirname + '/public/compact/',
  webPath: '/js/compact/',
  debug: false
});

compact.addNamespace('global');

compact.ns.global
	.addJs('/js/main.js')
	.addJs('/js/widget-a.js')
	.addJs('/js/widget-b.js');

compact.addNamespace('home')
	.addJs('/js/banner.js')
	.addJs('/js/ads.js');

compact.addNamespace('profile')
	.addJs('/js/profile.js');

compact.addNamespace('comments',  __dirname + 'libs/comments/public/src/' )
	.addJs('/js/paging.js');
	.addJs('/js/comments.js');

// All routes will have global
app.use(compact.js(['global']))

// Add some compacted JavaScript for just this route. Having the namespaces
// in separate arrays will produce a javascript file per array.
app.get('/', compact.js(['home'], ['profile']));

// Having different namespaces joined together will combine and output as one
// javascript file.
app.get('/blog', compact.js(['comments', 'profile']));

```

Then in the view use the **compactJsHtml()** view helper in your jade

```html
!=compactJsHtml()
```
On / you'd get the following

```html
<script src="/js/compact/global.js"></script>
<script src="/js/compact/home.js"></script>
<script src="/js/compact/profile.js"></script>
```

On /blog you'd get this

```html
<script src="/js/compact/global.js"></script>
<script src="/js/compact/comment-profile.js"></script>
```

You also have access to the **compactJs()** helper which will return an array
of files for you to include on the page.

## Credits
[Paul Serby](https://github.com/serby/) follow me on [twitter](http://twitter.com/PabloSerbo)

## Licence
Licenced under the [New BSD License](http://opensource.org/licenses/bsd-license.php)
