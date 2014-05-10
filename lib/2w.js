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
     * Library
     * @type {Object}
     */
    var $2w = window.$2w = {};

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
    var _cfg = $2w.config = {
            controllerAttr:  'data-controller',
            formModelAttr:   'data-model',
            expressionStart: '{{',
            expressionEnd:   '}}',
            interval:        50
        };

    /**
     * Typeof dictionary
     * @type {Object}
     */
    var types = {
        object: 'object',
        array: 'object',
        func: 'function'
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
     * Initializes $2w. It loops through the dom (see traverse()), then apply controller callbacks
     * and finally starts observing (see digest())
     */
    function initialize() {
        var _e = /[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g; // http://stackoverflow.com/a/6969486/772002
        _cfg._expre = new RegExp(_cfg.expressionStart.replace(_e, "\\$&")+'(.*?)'+_cfg.expressionEnd.replace(_e, "\\$&"));

        traverse(doc.documentElement);

        _bootstrap.forEach(function (bootstrap) {
            var cb = bootstrap.shift();
            cb.apply(null, bootstrap.map(function (c) {
                return controller(c).$scope;
            }));
        });

        digest();
    }

    /**
     * Loops through the DOM *once* and attach corresponding controllers to their DOM elements (see attachController())
     * @param  {DOMElement} node    root element to start traversing
     */
    function traverse(node) {
        var i, l;

        if (node.nodeType === 1 && node.hasAttribute(_cfg.controllerAttr)) {
            _controllers[node.getAttribute(_cfg.controllerAttr)] = attachController(node);
        }

        if (node.hasChildNodes()) {
            for (i = 0, l = node.childNodes.length; i < l; i++) {
                traverse(node.childNodes[i]);
            }
        }
    }

    /**
     * Stores a reference to this element, its childs and its attributes, in a controller's dictionary
     * @param  {DOMElement} node    Element to store
     * @param  {Mixed}      ctrl    Controller object or name string
     * @param  {Boolean}    force   Marks that it should be processed (see digest()) as soon as it is attached.
     *                              This lets attach a controller dynamically and see the results immediately.
     * @return {Object}             Controller
     */
    function attachController(node, ctrl, force) {
        var i, l, arr, matches;

        if (typeof ctrl !== types.object) {
            ctrl = controller(ctrl);
        }

        if (force) ctrl.force = true;

        // DOM Element with attributes -> attach controller to attributes
        if (node.nodeType === 1 && node.hasAttributes()) {
            for (i = 0, l = node.attributes.length; i < l; i++) {
                attachController(node.attributes[i], ctrl);
            }
        }

        // DOM Element with child nodes -> attach controller to child nodes
        if (node.hasChildNodes()) {
            for (i = 0, l = node.childNodes.length; i < l; i++) {
                attachController(node.childNodes[i], ctrl);
            }
        }

        // Input or textarea elements -> attach controller and add change listeners
        // TODO less hardcode
        else if (node.nodeType === 1 && (node.nodeName === 'INPUT' || node.nodeName === 'TEXTAREA')) {
            if (node.hasAttribute(_cfg.formModelAttr)) {
                node.$2w_id = Math.random();
                ctrl.dic[node.$2w_id] = node;
                addInputListener(node, ctrl);
            }
        }

        // DOM Attribute -> attach controller
        else if (node.nodeType === 2) {
            matches = node.value.search(_cfg._expre);
            if (matches !== -1) {
                node.$2w_id = Math.random();
                ctrl.org[node.$2w_id] = node.value;
                ctrl.dic[node.$2w_id] = node;
            }
        }

        // Finally, text node -> attach controller
        else if (node.nodeType === 3) {
            matches = node.nodeValue.search(_cfg._expre);
            if (matches !== -1) {
                node.$2w_id = Math.random();
                ctrl.org[node.$2w_id] = node.textContent;
                ctrl.dic[node.$2w_id] = node;
            }
        }

        return ctrl;
    }

    /**
     * Waits for content changes in controller-attached-elements and reflects those changes everywhere
     */
    function digest() {
        var node, key, ctr, ctrl;

        if (!_clear) return;
        _clear = false;

        for (ctr in _controllers) {
            ctrl = _controllers[ctr];

            // Do stuff only if things have changed
            if (ctrl.force || !equals(ctrl.$scope, ctrl._scope)) {
                for (key in ctrl.dic) {
                    node = ctrl.dic[key];

                    // For input and textareas, skip if it's focused or reflect changes directly in their 'value'
                    // TODO less hardcode
                    if (node.nodeType === 1 && (node.nodeName === 'INPUT' || node.nodeName === 'TEXTAREA')) {
                        if (node === doc.activeElement) continue;
                        node.value = expression.call(ctrl, node.getAttribute(_cfg.formModelAttr));
                    }

                    // Otherwise apply changes consecutively in a temporal (ctrl.tmp) variable
                    else if (node.nodeType === 2 || node.nodeType === 3) {
                        if (!ctrl.tmp[node.$2w_id]) ctrl.tmp[node.$2w_id] = ctrl.org[node.$2w_id];
                        while (ctrl.tmp[node.$2w_id].search(_cfg._expre) !== -1) {
                            ctrl.tmp[node.$2w_id] = ctrl.tmp[node.$2w_id].replace(_cfg._expre, function (str, exp) {
                                return expression.call(ctrl, exp);
                            });
                        }
                    }
                }

                // Once changes have been processed, apply them in the elements content
                for (key in ctrl.dic) {
                    node = ctrl.dic[key];

                    if (node.nodeType === 2) {
                        node.value = ctrl.tmp[node.$2w_id];
                    }

                    else if (node.nodeType === 3) {
                        node.textContent = ctrl.tmp[node.$2w_id];
                    }
                }

                // Keep a backup of the current state, clear stuff
                ctrl._scope = clone(ctrl.$scope);
                ctrl.force = false;
                ctrl.tmp = {};
            }
        }

        // Re check
        setTimeout(digest, _cfg.interval);
        _clear = true;
    }

    /**
     * Evaluates a js expression within a scope and returns its result
     * @param  {String} exp JavaScript expression
     * @return {String}     Hopefully a value, or '' in case of error
     */
    function expression(exp) {
        var result, f;

        try {
            //f = eval('with (this.$scope) { ' + exp + ' });
            f = new Function ('with (this.$scope) { return (' + exp + '); }');
            result = f.call(this);
            if (result === null || typeof result === 'undefined') result = '';
        } catch(e) {
            result = '';
        };

        return result;
    }

    /**
     * Adds event listeners to input/textarea elements so their values are reflected on their models
     * TODO there must be a better approach
     * @param {DOMElement}  node    Input/textarea element
     * @param {Object}      ctrl    Controller object (parent of the @node's model)
     */
    function addInputListener(node, ctrl) {
        var cb = function () { ctrl.$scope[this.getAttribute(_cfg.formModelAttr)] = this.value; };
        node.addEventListener('keypress', cb, false);
        node.addEventListener('keyup', cb, false);
    }

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

            for (key in b) {
                lenb++;
            }

            if (len !== lenb) {
                return false;
            }
        }

        return true;
    }

    /**
     * 'Deep' cloning
     * @param  {Mixed} a    Value to clone
     * @return {Mixed}      Cloned value :)
     */
    function clone(a) {
        var idx, key, len, type, result;

        type = typeof a;

        if (type !== types.object) {
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
    }

    /**
     * Merge @b's keys into @a's
     * @param  {Object} a   Object to merge into
     * @param  {Object} b   Object to merge from
     * @return {Object}     @a
     */
    function extend(a, b) {
        var attr;
        for (attr in b) {
            if (toString.call(a[attr]) === strTypes.object) {
                extend(a[attr], b[attr]);
            } else {
                a[attr] = clone(b[attr]);
            }
        }
        return a;
    }

    /**
     * forEach quick polyfill (just functionality needed in this lib)
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
     * (1) Returns a controller (it creates one if it doesn't exist), or (2) bootstraps a callback
     * @param  {String}     id  Controller id/name
     * @param  {Function}   cb  Controller callback
     * @return {Object}         (1) Controller or (2) $2w
     */
    function controller (id, cb) {
        var controllers;

        if (typeof cb === 'undefined') {
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
    }

    /**
     * Exposed method - (1) Returns a controller's *scope*, or (2) bootstraps a callback
     * @param  {String}     id  Controller id/name
     * @param  {Function}   cb  Controller callback
     * @return {Object}         (1) Controller's scope or (2) $2w
     */
    $2w.controller = function(id, cb){
        return typeof cb === 'undefined' ? controller(id).$scope : controller(id, cb);
    };

    /**
     * Exposed method - DOM Element to a controller and process it (see attachController's @force)
     * @param  {DOMElement} node    Element to attach controller to
     * @param  {String}     ctrl    Controller id/name
     * @return {Object}             Controller's scope
     */
    $2w.attachController = function(node, ctrl) {
        return attachController(node, ctrl, true).$scope;
    }

    /**
     * Run
     */
    doc.addEventListener && doc.addEventListener("DOMContentLoaded", initialize, false);
    doc.attachEvent && doc.attachEvent("onreadystatechange", function() { doc.readyState === "complete" && initialize(); });

})(window);