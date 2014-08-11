/**
 * 2w - Click handler
 * Copyright (c) 2014 Nicolás Arias
 * MIT Licensed
 */

(function (window, $2w) {
    'use strict';

    $2w.config.clickAttr = 'data-click';
    $2w.events.click = {
        nodeType: 1,
        event: 'click',
        test: function(node) {
            return node.hasAttribute($2w.config.clickAttr);
        },
        cb: function(evt, node, ctrl) {
            evt.preventDefault();
            $2w.expression.call(ctrl, node.getAttribute($2w.config.clickAttr));
        }
    }

})(window, window.$2w);