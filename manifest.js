module.exports = {
  version: '0.0.2',
  policies: ['access-controller'],
  init: function(pluginContext) {
    let policy = require('./policies/access-controller-policy');
    pluginContext.registerPolicy(policy);
  }
};
