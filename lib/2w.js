/**
 * 2w - Simple 2-way data binding
 * Copyright (c) 2014 Nicolás Arias
 * MIT Licensed
 */

(function (window) {
    'use strict';

    /**
     * Document reference
     */
    var doc = window.document;

    /**
     * Controllers store
     * @type {Object}
     */
    var _controllers = {};

    /**
     * Controller callbacks go here. They're executed after DOM load
     * @type {Array}
     */
    var _bootstrap = [];

    /**
     * Prevents digest overlapping (see digest())
     * @type {Boolean}
     */
    var _clear = true;

    /**
     * Default configuration
     * @type {Object}
     */
    var _cfg = {
        controllerAttr:  'data-controller',
        formModelAttr:   'data-model',
        expressionStart: '{{',
        expressionEnd:   '}}',
        interval:        50,
        manual:          false
    };

    /**
     * Typeof dictionary
     * @type {Object}
     */
    var types = {
        object: 'object',
        array: 'object',
        func: 'function',
        undef: 'undefined'
    };

    /**
     * toString dictionary
     * @type {Object}
     */
    var strTypes = {
        object: '[object Object]',
        array: '[object Array]',
        func: '[object Function]'
    };

    /**
     * Helper shortcuts
     */
    var toString = Object.prototype.toString;

    /**
     * Library
     * @type {Function}
     */
    var $2w = function (){};

    /**
     * Initializes $2w. It loops through the dom (see traverse()), then apply controller callbacks
     * and finally starts observing (see digest())
     */
    $2w.prototype.initialize = function () {
        var self = this,_e = /[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g; // http://stackoverflow.com/a/6969486/772002
        _cfg._expre = new RegExp(_cfg.expressionStart.replace(_e, "\\$&")+'(.*?)'+_cfg.expressionEnd.replace(_e, "\\$&"));

        self.traverse(doc.documentElement);

        _bootstrap.forEach(function (bootstrap) {
            var cb = bootstrap.shift();
            cb.apply(null, bootstrap.map(function (c) {
                return self._controller(c).$scope;
            }));
        });

        self.digest();
    };

    /**
     * Loops through the DOM *once* and attach corresponding controllers to their DOM elements (see attachController())
     * @param  {DOMElement} node    root element to start traversing
     */
    $2w.prototype.traverse = function (node) {
        var self = this, i, l, ctrl;

        if (node.nodeType === 1 && node.hasAttribute(_cfg.controllerAttr)) {
            ctrl = node.getAttribute(_cfg.controllerAttr);
            _controllers[ctrl] = self._attachController(node, ctrl);
        }

        if (node.hasChildNodes()) {
            for (i = 0, l = node.childNodes.length; i < l; i++) {
                self.traverse(node.childNodes[i]);
            }
        }
    };

    /**
     * (1) Returns a controller (it creates one if it doesn't exist), or (2) bootstraps a callback
     * @param  {String}     id  Controller id/name
     * @param  {Function}   cb  Controller callback
     * @return {Object}         (1) Controller or (2) $2w
     */
    $2w.prototype._controller = function (id, cb) {
        var controllers;

        if (typeof cb === types.undef) {
            return _controllers[id] || (_controllers[id] = {
                _scope: {},
                $scope: {},
                dic: {},
                org: {},
                tmp: {}
            });
        }

        controllers = id.split(/\s+/);
        controllers.unshift(cb);
        _bootstrap.push(controllers);

        return $2w;
    };

    /**
     * Public version - (1) Returns a controller's *scope*, or (2) bootstraps a callback
     * @param  {String}     id  Controller id/name
     * @param  {Function}   cb  Controller callback
     * @return {Object}         (1) Controller's scope or (2) $2w
     */
    $2w.prototype.controller = function (id, cb){
        return typeof cb === types.undef ? this._controller(id).$scope : this._controller(id, cb);
    };

    /**
     * Stores a reference to this element, its childs and its attributes, in a controller's dictionary
     * @param  {DOMElement} node    Element to store
     * @param  {Mixed}      ctrl    Controller object or name string
     * @param  {Boolean}    force   Marks that it should be processed (see digest()) as soon as it is attached.
     *                              This lets attach a controller dynamically and see the results immediately.
     * @return {Object}             Controller
     */
    $2w.prototype._attachController = function (node, ctrl, force) {
        var self = this, i, l, id, matches;

        if (typeof ctrl !== types.object) {
            ctrl = self._controller(ctrl);
        }

        if (force) ctrl.force = true;

        // DOM Element with attributes -> attach controller to attributes
        if (node.nodeType === 1 && node.hasAttributes()) {
            for (i = 0, l = node.attributes.length; i < l; i++) {
                self._attachController(node.attributes[i], ctrl);
            }
        }

        // DOM Element with child nodes -> attach controller to child nodes
        if (node.hasChildNodes()) {
            for (i = 0, l = node.childNodes.length; i < l; i++) {
                self._attachController(node.childNodes[i], ctrl);
            }
        }

        // Input or textarea elements -> attach controller and add change listeners
        // TODO less hardcode
        else if (node.nodeType === 1 && (node.nodeName === 'INPUT' || node.nodeName === 'TEXTAREA')) {
            if (node.hasAttribute(_cfg.formModelAttr)) {
                id = Math.random();
                ctrl.dic[id] = node;
                self.addInputListener(node, ctrl);
            }
        }

        // DOM Attribute -> attach controller
        else if (node.nodeType === 2) {
            matches = node.value.search(_cfg._expre);
            if (matches !== -1) {
                id = Math.random();
                ctrl.org[id] = node.value;
                ctrl.dic[id] = node;
            }
        }

        // Finally, text node -> attach controller
        else if (node.nodeType === 3) {
            matches = node.nodeValue.search(_cfg._expre);
            if (matches !== -1) {
                id = Math.random();
                ctrl.org[id] = node.textContent || node.nodeValue;
                ctrl.dic[id] = node;
            }
        }

        return ctrl;
    };

    /**
     * Public version - DOM Element to a controller and process it (see attachController's @force)
     * @param  {DOMElement} node    Element to attach controller to
     * @param  {String}     ctrl    Controller id/name
     * @return {Object}             Controller's scope
     */
    $2w.prototype.attachController = function (node, ctrl) {
        return this._attachController(node, ctrl, true).$scope;
    };

    $2w.prototype.render = function (ctrl) {
        var self = this, node, key;

        for (key in ctrl.dic) {
            node = ctrl.dic[key];

            // For input and textareas, skip if it's focused or reflect changes directly in their 'value'
            // TODO less hardcode
            if (node.nodeType === 1 && (node.nodeName === 'INPUT' || node.nodeName === 'TEXTAREA')) {
                if (node === doc.activeElement) continue;
                node.value = self.expression.call(ctrl, node.getAttribute(_cfg.formModelAttr));
            }

            // Otherwise apply changes consecutively in a temporal (ctrl.tmp) variable
            else if (node.nodeType === 2 || node.nodeType === 3) {
                if (!ctrl.tmp[key]) ctrl.tmp[key] = ctrl.org[key];
                while (ctrl.tmp[key].search(_cfg._expre) !== -1) {
                    ctrl.tmp[key] = ctrl.tmp[key].replace(_cfg._expre, function (str, exp) {
                        return self.expression.call(ctrl, exp);
                    });
                }
            }
        }

        // Once changes have been processed, apply them in the elements content
        for (key in ctrl.dic) {
            node = ctrl.dic[key];

            if (node.nodeType === 2) {
                node.value = ctrl.tmp[key];
            }

            else if (node.nodeType === 3) {
                if (node.textContent) { node.textContent = ctrl.tmp[key]; }
                else { node.nodeValue = ctrl.tmp[key]; }
            }
        }

        ctrl.tmp = {};
        return ctrl;
    };

    /**
     * Waits for content changes in controller-attached-elements and reflects those changes everywhere
     */
    $2w.prototype.digest = function () {
        var self = this, node, key, ctrl;

        if (!_clear) return;
        _clear = false;

        for (key in _controllers) {
            ctrl = _controllers[key];

            // Do stuff only if things have changed
            if (ctrl.force || !equals(ctrl.$scope, ctrl._scope)) {
                self.render(ctrl);
                ctrl._scope = clone(ctrl.$scope); // Keep a backup of the current state
                ctrl.force = false;
            }
        }

        // Re check
        if (!_cfg.manual) setTimeout(function (){
            self.digest();
        }, _cfg.interval);
        _clear = true;
    };

    /**
     * Evaluates a js expression within a scope and returns its result
     * @param  {String} exp JavaScript expression
     * @return {String}     Hopefully a value, or '' in case of error
     */
    $2w.prototype.expression = function (exp, ctx) {
        var result, f;

        try {
            //f = eval('with (this.$scope) { ' + exp + ' });
            f = new Function ('with (this.$scope) { return (' + exp + '); }');
            result = f.call(ctx || this);
            if (result === null || typeof result === types.undef) result = '';
        } catch(e) {
            result = '';
        };

        return result;
    };

    /**
     * Adds event listeners to input/textarea elements so their values are reflected on their models
     * TODO there must be a better approach
     * @param {DOMElement}  node    Input/textarea element
     * @param {Object}      ctrl    Controller object (parent of the @node's model)
     */
    $2w.prototype.addInputListener = function (node, ctrl) {
        var cb = function (evt) {
            var el = (evt.srcElement || this);
            ctrl.$scope[el.getAttribute(_cfg.formModelAttr)] = el.value;
        };
        if (node.addEventListener) {
            node.addEventListener('keypress', cb, false);
            node.addEventListener('keyup', cb, false);
        } else {
            node.attachEvent('onkeypress', cb);
            node.attachEvent('onkeyup', cb);
        }
    };

    /**
     * Expose prototype
     */
    $2w.prototype.fn = $2w.prototype;

    /**
     * Expose configuration
     */
    $2w.prototype.config = _cfg;

    /**
     * Expose lib
     */
    window.$2w = new $2w;

    /**
     * Run
     */
    function init() { window.$2w.initialize(); }
    doc.addEventListener && doc.addEventListener("DOMContentLoaded", init, false);
    doc.attachEvent && doc.attachEvent("onreadystatechange", function () { doc.readyState === "complete" && init(); });

    /**
     * Checks for 'deep' equality
     * @param  {Object}     a   Object to compare
     * @param  {Object}     b   Object to compare
     * @return {Boolean}        Equality
     */
    function equals(a, b) {
        var idx, len, lenb, key, ta, tb;

        // Equal primitives
        if (a === b) {
            return true;
        }

        ta = typeof a;
        tb = typeof b;

        // Unequal primitives
        if (ta !== tb ||
            ta !== types.func && ta !== types.object &&
            tb !== types.func && tb !== types.object && a !== b) {
            return false;
        }

        ta = toString.call(a);
        tb = toString.call(b);

        // Array vs object
        if (ta !== tb) {
            return false;
        }

        // Array elements comparison
        else if (ta === strTypes.array) {
            if ((len = a.length) !== b.length) {
                return false;
            }

            for (idx = 0; idx < len; idx++) {
                if (!equals(a[idx], b[idx])) {
                    return false;
                }
            }
        }
        
        // Object elements comparison
        else if (ta === strTypes.object) {
            len = 0;
            for (key in a) {
                len++;
                if (!equals(a[key], b[key])) {
                    return false;
                }
            }

            lenb = 0;
            for (key in b) {
                lenb++;
            }

            if (len !== lenb) {
                return false;
            }
        }

        return true;
    };

    /**
     * 'Deep' cloning
     * @param  {Mixed} a    Value to clone
     * @return {Mixed}      Cloned value :)
     */
    function clone(a) {
        var idx, key, len, type, result;

        type = typeof a;

        if (a === null || type !== types.object) {
            return a;
        }

        type = toString.call(a);

        if (type === strTypes.array) {
            result = [];
            for (idx = 0, len = a.length; idx < len; idx++) {
                result.push(clone(a[idx]));
            }
        }
        
        else if (type === strTypes.object) {
            result = {};
            for (key in a) {
                result[key] = clone(a[key]);
            }
        }

        return result;
    };

    /**
     * Quick forEach polyfill (just functionality needed in this lib)
     * @param  {Function}   cb  Callback
     * @param  {Mixed}      th  this argument for callback
     */
    !Array.prototype.forEach && (Array.prototype.forEach = function (cb, th) {
        var i, l;
        for (i = 0, l = this.length; i < l; i++) {
            if (cb.call(th, this[i], i, this));
        }
    });

    /**
     * Quick map polyfill (just functionality needed in this lib)
     * @param  {Function}   cb  Callback
     * @param  {Mixed}      th  this argument for callback
     */
    !Array.prototype.map && (Array.prototype.map = function (cb, th) {
        var result = [];
        this.forEach(function(e, i){
            result.push(cb.call(th, e, i));
        })
        return result;
    });

})(window);