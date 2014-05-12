2w
==

2w gives you a simple, small, library-agnostic 2-way data binding API, inspired by (but not equal to) angularjs' data binding.

Demos & documentation: http://ezakto.github.io/2w

# Install

Just clone the repo:

```bash
git clone git@github.com:ezakto/2w.git
```

And include the lib in your markup:

```html
<script src="2w/lib/2w.min.js"></script>
```

And that's all. You can now add some controllers:

```html
<!doctype html>
<html>
  <head>
    <meta charset="UTF-8">
    <script src="2w/lib/2w.min.js"></script>
  </head>
  <body>
    <p data-controller="paragraph">This is an active {{text}}.</p>
    <script>
      $2w.controller('paragraph', function(p){
        p.text = 'text set dynamically';
      });
    </script>
  </body>
</html>
```

# Browser support

Tested with Firefox 18+, Opera 12.16, Chrome, IE8. *Should* work with next versions.

# Testing

Simply install [QUnit](http://qunitjs.com/) with [bower](http://bower.io/):

```bash
bower install
```

Then run test/index.html in a local server.
