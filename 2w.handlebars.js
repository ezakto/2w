/**
 * 2w - Handlebars demo plugin
 * Copyright (c) 2014 Nicolás Arias
 * MIT Licensed
 */

(function($2w, Handlebars){
    // Overwrite
    $2w.fn._attachController = function (node, ctrl) {
        var self = this;

        if (typeof ctrl !== 'object') {
            ctrl = self._controller(ctrl);
        }

        if (typeof ctrl.tpl !== 'object') {
            ctrl.tpl = {};
        }

        ctrl.force = true; // Always render at start

        node.$2w_id = Math.random();
        ctrl.dic[node.$2w_id] = node;
        ctrl.tpl[node.$2w_id] = Handlebars.compile(node.innerHTML);

        return ctrl;
    };
    
    // Overwrite
    $2w.fn.render = function (ctrl) {
        var key, node;
        for (key in ctrl.dic) {
            ctrl.dic[key].innerHTML = ctrl.tpl[key](ctrl.$scope);
        }
        return ctrl;
    }
})(window.$2w, Handlebars);