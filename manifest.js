module.exports = {
  version: '0.0.3',
  policies: ['access-controller'],
  init: function(pluginContext) {
    let policy = require('./policies/access-controller-policy');
    pluginContext.registerPolicy(policy);
  }
};
