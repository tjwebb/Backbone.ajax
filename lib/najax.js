/*
 * najax
 * https://github.com/alanclarke/najax
 *
 * Copyright (c) 2012 Alan Clarke
 * Licensed under the MIT license.
 */

var https   = require('https');
var http        = require('http');
var querystring = require('querystring');
var url         = require('url');
var _           = require('lodash');
var default_settings = { type: 'GET', rejectUnauthorized: true };
var najax       = module.exports = request;
var Promise = require('bluebird');

/* set default settings */
module.exports.defaults = function(opts) {
	return _.extend(default_settings, opts);
};

function _parseOptions(options, a, b){
	var args = [], opts = _.extend({}, default_settings);
	if (_.isString(options)) { opts.url = options; }
	else { _.extend(opts, options); }
	_.each([a, b], function(fn) {
		if (_.isFunction(fn)) { opts.success = fn; }
	});
	if (!_.isFunction(a)) { _.extend(opts, a); }
	return opts;
}

/* auto rest interface go! */
_.each('get post put delete'.split(' '),function(method){
	najax[method] = module.exports[method] = function(options, a, b) {
		var opts = _parseOptions(options, a, b);
		opts.type = method.toUpperCase();
		return najax(opts);
	};
});

/* main function definition */
function request(options, a, b) {
  return new Promise(function (resolve, reject) {
  //OPTIONS
    /*
      method overloading, can use:
      -function(url, opts, callback) or
      -function(url, callback)
      -function(opts)
    */


    if (_.isString(options) || _.isFunction(a)) {
      return request(_parseOptions(options, a, b));
    }
    
    if (_.isObject(default_settings.url)) {
      options.url = url.format(_.extend({ }, url.parse(options.url), default_settings.url));
    }

    //var dfd = new $.Deferred(),
    var o = _.extend({}, default_settings, options),
      l = url.parse(o.url),
      ssl = (l.protocol || '').indexOf('https') === 0,
      data = '';

    //DATA
      /* massage request data according to options */
      o.data = o.data || '';
      o.contentType = o.contentType ? 'application/'+o.contentType :'application/x-www-form-urlencoded';

      if(!o.encoder){
        switch(o.contentType){
          case 'application/json': o.data = JSON.stringify(o.data); break;
          case 'application/x-www-form-urlencoded': o.data = querystring.stringify(o.data); break;
          default: o.data = o.data.toString();
        }
      } else {
        o.data = o.encoder(o.data);
      }

      /* if get, use querystring method for data */
      if (o.type === 'GET') {
        l.search = (l.search ? l.search + ( o.data ? '&' + o.data : '' ) : ( o.data ? '?' + o.data : '' ));
      }

    /* if get, use querystring method for data */
    options = {
      host: l.hostname,
      path: l.pathname + (l.search||''),
      method: o.type,
      port: l.port || (ssl? 443 : 80),
      headers: {},
      rejectUnauthorized: o.rejectUnauthorized
    };

      /* set data content type */
      if(o.type!=='GET' && o.data){
        o.data = o.data+'\n';
        options.headers = {
          'Content-Type': o.contentType+';charset=utf-8',
          'Content-Length': o.data ? Buffer.byteLength(o.data) : 0
        };
      }

    /* add authentication to http request */
    if (l.auth) {
      options.auth = l.auth;
    } else if (o.username && o.password) {
      options.auth = o.username + ':' + o.password;
    } else if (o.auth){
      options.auth = o.auth;
    }

    /* apply header overrides */
    if(typeof o.headers != "undefined" && typeof options.headers == "undefined")
      options.headers = {};
    _.extend(options.headers, o.headers);
    _.extend(options, _.pick(o, ['auth', 'agent']));

    var req = (ssl ? https : http).request(options, function(res) {
      res.on('data', function(d) {
        data += d;
      });
      res.on('end', function() {
        if (o.dataType === 'json') {
          try {
            //replace control characters
            data = JSON.parse(data.replace(/[\cA-\cZ]/gi,''));
          }
          catch (e) {
            if (_.isFunction(o.error)) {
              o.error(e);
            }
            return reject(!o.error || o.error(e, res.statusCode));
          }
        }
        if (res.statusCode < 200 || res.statusCode >= 300) {
          if (_.isFunction(o.error)) {
            o.error(data);
          }
          return reject(!o.error || o.error(data, res.statusCode));
        }


        if (_.isFunction(o.success)) {
          o.success(data, res.statusCode);
        }
        return resolve(data);
      });
    });

    req.on('error', function(e) {
      if (_.isFunction(o.error)) { o.error(e); }
      return reject(e);
    });

    if (o.type !== 'GET' && o.data) {
      req.write(o.data , 'utf-8');
    }
    req.end();
  });
}
