var _ = require('lodash');
var defaults = require(__dirname + '/' + '/default.js');
var config = require(__dirname + '/' + (process.env.NODE_ENV || 'development') + '.js');
module.exports = _.merge({}, defaults, config);