/**
 * Expose the `Swagger` plugin.
 */
module.exports = Swagger;

/**
 * Module dependencies.
 */
var Remoting = require('../');
var _ = require('lodash');

function formatProperty(property, name) {
  items = {
    type: _.isArray(property.type) ? prepareDataType(property.type[0]) : 'object'
  };

  var type = prepareDataType(property.type);

  var formatted = {};
  formatted[name] = {
    type: type,
    required: property.required,
    items: type == 'array' ? items : undefined
  };
  return formatted;
}

/**
 * Create a swagger compatible model description from remote object class
 */
function modelFromClass(cls) {
  var model = {};
  var properties = cls.ctor.definition.properties;
  var name = cls.ctor.definition.name;

  var required = _(properties).pick(function(p) { return p.required; }).keys().value();
  var formatted = _(properties).map(formatProperty).reduce(_.assign, {});

  model[name] = {
    id: name,
    required: required,
    properties: formatted
  };

  return model;
}

/**
 * Create a remotable Swagger module for plugging into `RemoteObjects`.
 */
function Swagger(remotes, options, models) {
  // Unfold options.
  var _options = options || {};
  var name = _options.name || 'swagger';
  var version = _options.version;
  var basePath = _options.basePath;

  // We need a temporary REST adapter to discover our available routes.
  var adapter = remotes.handler('rest').adapter;
  var routes = adapter.allRoutes();
  var classes = remotes.classes();

  var extension = {};
  var helper = Remoting.extend(extension);

  var apiDocs = {};
  var resourceDoc = {
    apiVersion: version,
    swaggerVersion: '1.2',
    basePath: basePath,
    apis: [
      {
        path: '/swagger/oauth'
      },
      {
        path: '/swagger/batch'
      }
    ],
    authorizations: {
      oauth2: {
        grantTypes: {
          implicit: {
            loginEndpoint: {
              url: '/oauth/authorize'
            },
            tokenName: 'access_token'
          }
        },
        scopes: [
          {
            description: 'Allow everything',
            scope: '*'
          },
        ],
        type: 'oauth2'
      }
    }
  };

  models = models || _(classes).map(modelFromClass).reduce(_.assign, {});
  models['token'] = {
    id: 'token',
    required: ['access_token', 'token_type'],
    properties: {
      access_token: {
        type: 'string',
        required: true
      },
      token_type: {
        type: 'string',
        required: true
      }
    }
  };
  models['tokeninfo'] = {
    id: 'tokeninfo',
    required: ['audience', 'user_id', 'scope'],
    properties: {
      audience: {
        type: 'string',
        required: true
      },
      user_id: {
        type: 'string',
        required: true
      },
      scope: {
        type: 'string',
        required: true
      },
      expires_in: {
        type: 'string'
      }
    }
  };

  var oauthDoc = {
    apiVersion: resourceDoc.apiVersion,
    swaggerVersion: resourceDoc.swaggerVersion,
    basePath: '',
    apis: [
      {
        path: convertPathFragments('/oauth/authorize'),
        operations: [{
          httpMethod: 'GET',
          nickname: 'oauth_authorize',
          responseClass: 'void',
          parameters: [
            {
              paramType: 'query',
              name: 'response_type',
              description: 'Response type',
              dataType: 'string',
              required: true,
              allowMultiple: false,
              enum: [
                'code',
                'token'
              ]
            },
            {
              paramType: 'query',
              name: 'client_id',
              description: 'Client ID',
              dataType: 'string',
              required: true,
              allowMultiple: false
            },
            {
              paramType: 'query',
              name: 'redirect_uri',
              description: 'Client redirect URI',
              dataType: 'string',
              required: true,
              allowMultiple: false
            }
          ],
          errorResponses: [],
          summary: 'OAuth 2.0 authorization endpoint',
          notes: '<p>OAuth 2.0 specifies a framework that allows users to grant client ' +
                 'applications limited access to their protected resources. It does ' +
                 'this through a process of the user granting access, and the client ' +
                 'exchanging the grant for an access token.</p>' +
                 '<p>We support three grant types: <u>authorization codes</u>, ' +
                 '<u>implicit</u> and <u>resource owner password credentials</u>.</p>' +
                 '<p>For detailed description see <a href="http://tools.ietf.org/html/rfc6749#section-1.3">Section 1.3 of OAuth spec</a></p>' +
                 '<p>This endpoint is used for <u>authorization code</u> and <u>implicit</u> ' +
                 'grant types.</p>' +
                 '<p>Once you receive your token, you can use it to send requests that ' +
                 'need authorization by adding received token to \'Athorization\' header:</p>' +
                 '<pre>Authorization: Bearer your-token-goes-here</pre>'
        }]
      },
      {
        path: convertPathFragments('/oauth/token'),
        operations: [{
          httpMethod: 'POST',
          nickname: 'oauth_token',
          responseClass: 'token',
          parameters: [
            {
              paramType: "form",
              nam: "grant_type",
              description: "Token grant type",
              dataType: "string",
              required: true,
              allowMultiple: false,
              enum: [
                "authorization_code",
                "password"
              ]
            },
            {
              "paramType": "form",
              "name": "client_id",
              "description": "Client ID",
              "dataType": "string",
              "required": true,
              "allowMultiple": false
            },
            {
              "paramType": "form",
              "name": "client_secret",
              "description": "Client secret",
              "dataType": "string",
              "required": true,
              "allowMultiple": false
            },
            {
              "paramType": "form",
              "name": "redirect_uri",
              "description": "Client redirect URI",
              "dataType": "string",
              "required": false,
              "allowMultiple": false
            },
            {
              "paramType": "form",
              "name": "username",
              "description": "User login",
              "dataType": "string",
              "required": false,
              "allowMultiple": false
            },
            {
              "paramType": "form",
              "name": "password",
              "description": "User password",
              "dataType": "string",
              "required": false,
              "allowMultiple": false
            },
            {
              "paramType": "form",
              "name": "code",
              "description": "Authorization code",
              "dataType": "string",
              "required": false,
              "allowMultiple": false
            },
            {
              "paramType": "form",
              "name": "scope",
              "description": "Scope of access",
              "dataType": "string",
              "required": false,
              "allowMultiple": false
            }
          ],
          errorResponses: [],
          summary: 'OAuth 2.0 token endpoint',
          notes: '<p>This endpoint is used for <u>authorization code</u> and <u>password</u> ' +
                 'grant types.</p>' +
                 '<p>For <u>authorization code</u> grant type you can exchange authorization ' +
                 'code received from authorization endpoint for an access token</p>' +
                 '<p>For <u>resource owner password credentials</u> grant type you exchange user credentials for an access token</p>' +
                 '<p>Client credentials can be provided either via form arguments or via HTTP Basic authorization</p>'
        }]
      },
      {
        path: convertPathFragments('/oauth/token/info'),
        operations: [{
          httpMethod: 'GET',
          nickname: 'oauth_tokeninfo',
          responseClass: 'tokeninfo',
          parameters: [{
            paramType: 'query',
            name: 'access_token',
            description: 'Access token',
            dataType: 'string',
            required: true,
            allowMultiple: false
          }],
          errorResponses: [],
          summary: 'OAuth 2.0 token validation endpoint',
          notes: '<p>Tokens received on the fragment <u>MUST</u> be explicitly validated. ' +
                 'Failure to verify tokens acquired this way makes your application more ' +
                 'vulnerable to the <a href="http://en.wikipedia.org/wiki/Confused_deputy_problem">confused deputy problem</a>.</p>' +
                 '<p>When verifying a token, it is critical to ensure the audience field ' +
                 'in the response exactly matches your client ID. It is absolutely vital ' +
                 'to perform this step, because it is the mitigation for the confused deputy issue.</p>' +
                 '<p>If the token has expired, has been tampered with, or the permissions ' +
                 'revoked, server will respond with an error. The error surfaces as a 400 ' +
                 'status code, and a JSON body as follows:</p>' +
                 '<pre>{\n  "error": "invalid_token"\n}</pre>' +
                 '<p>By design, no additional information is given as to the reason for the failure.</p>'
        }]
      },
    ],
    models: models
  };

  var batchDoc = {
    apiVersion: resourceDoc.apiVersion,
    swaggerVersion: resourceDoc.swaggerVersion,
    basePath: '',
    apis: [
      {
        path: convertPathFragments('/batch'),
        operations: [{
          httpMethod: "POST",
          nickname: "batch",
          responseClass: 'object',
          authorizations: {
            oauth2: [
              {
                description: 'Allow everything',
                scope: '*'
              }
            ]
          },
          parameters: [
            {
              paramType: 'body',
              name: 'data',
              description: 'Batch request object',
              dataType: 'object',
              required: true,
              allowMultiple: false,
            },
          ],
          errorResponses: [],
          summary: 'Batch request',
          notes: '<p>Batch requests add the ability for a client to send a single request ' +
                 'that represents many, have them all run, then return a single response.</p>' +
                 '<p>Basic batch request will look like this:</p>' +
                 '<pre>{\n' +
                 '  "myRequest": {\n' +
                 '    "method": "GET"\n' +
                 '    "uri": "/api/users"\n' +
                 '  }\n' +
                 '}</pre>' +
                 '<p>Server will perform a GET request to a local endpoint called ' +
                 '/api/users/ and will return the result that looks like the following:</p>' +
                 '<pre>{\n' +
                 '  "myRequest": {\n' +
                 '    "statusCode": 200,\n' +
                 '    "body": ...,\n' +
                 '    "headers": {\n' +
                 '      "x-powered-by": "LoopBack",\n' +
                 '      "content-type": "application/json",\n' +
                 '      "date": "Wed, 06 Nov 2013 21:33:18 GMT",\n' +
                 '      "connection": "close",\n' +
                 '      "transfer-encoding": "chunked"\n' +
                 '    },\n' +
                 '  }\n' +
                 '}</pre>' +
                 '<p>To add more than one request, just add more keys to the root level ' +
                 'JSON object, one per additional request:</p>' +
                 '<pre>{\n' +
                 '  "myRequest1": ...,\n' +
                 '  "myRequest2": ...,\n' +
                 '  "myRequest3": ...\n' +
                 '}</pre>' +
                 '<p>To send a request using a particular method (GET, DELETE, PATCH, POST, PUT) specify it with a key of <u>method</u>.</p>' +
                 '<p>In order to do a POST (or PUT or PATCH) you’ll need to send along the data.</p>' +
                 '<p>This is as simple as adding a key of <u>body</u> whose value is the data you’d like to POST.</p>' +
                 '<p>To specify headers to send with a particular request, simply add a key of <u>headers</u> and an object with any headers to send along.</p>'
        }]
      },
    ],
  };

  classes.forEach(function (item) {
    resourceDoc.apis.push({
      path: '/' + name + item.http.path,
      description: item.ctor.sharedCtor && item.ctor.sharedCtor.description
    });

    apiDocs[item.name] = {
      apiVersion: resourceDoc.apiVersion,
      swaggerVersion: resourceDoc.swaggerVersion,
      basePath: resourceDoc.basePath,
      apis: [],
      models: models
    };

    helper.method(api, {
      path: item.name,
      http: { path: item.http.path },
      returns: { type: 'object', root: true }
    });
    function api(callback) {
      callback(null, apiDocs[item.name]);
    }
    addDynamicBasePathGetter(remotes, name + '.' + item.name, apiDocs[item.name]);
  });

  routes.forEach(function (route) {
    var split = route.method.split('.');
    var doc = apiDocs[split[0]];
    var classDef;

    if (!doc) {
      console.error('Route exists with no class: %j', route);
      return;
    }

    classDef = classes.filter(function (item) {
      return item.name === split[0];
    })[0];

    if (classDef && classDef.sharedCtor && classDef.sharedCtor.accepts && split.length > 2 /* HACK */) {
      route.accepts = (route.accepts || []).concat(classDef.sharedCtor.accepts);
    }

    doc.apis.push(routeToAPI(route, classDef.ctor.definition.name));
  });

  /**
   * The topmost Swagger resource is a description of all (non-Swagger) resources
   * available on the system, and where to find more information about them.
   */
  helper.method(resources, {
    returns: [{ type: 'object', root: true }]
  });
  function resources(callback) {
    callback(null, resourceDoc);
  }

  addDynamicBasePathGetter(remotes, name + '.resources', resourceDoc);

  helper.method(oauth, {
    returns: { type: 'object', root: true }
  });
  function oauth(callback) {
    callback(null, oauthDoc);
  }

  addDynamicBasePathGetter(remotes, name + '.oauth', oauthDoc);

  helper.method(batch, {
    returns: { type: 'object', root: true }
  });
  function batch(callback) {
    callback(null, batchDoc);
  }

  addDynamicBasePathGetter(remotes, name + '.batch', batchDoc);

  remotes.exports[name] = extension;
  return extension;
}

/**
 * There's a few forces at play that require this "hack". The Swagger spec
 * requires a `basePath` to be set at various points in the API/Resource
 * descriptions. However, we can't guarantee this path is either reachable or
 * desirable if it's set as a part of the options.
 *
 * The simplest way around this is to reflect the value of the `Host` HTTP
 * header as the `basePath`. Because we pre-build the Swagger data, we don't
 * know that header at the time the data is built. Hence, the getter function.
 * We can use a `before` hook to pluck the `Host`, then the getter kicks in to
 * return that path as the `basePath` during JSON serialization.
 *
 * @param {SharedClassCollection} remotes The Collection to register a `before`
 *                                        hook on.
 * @param {String} path                   The full path of the route to register
 *                                        a `before` hook on.
 * @param {Object} obj                    The Object to install the `basePath`
 *                                        getter on.
 */
function addDynamicBasePathGetter(remotes, path, obj) {
  var initialPath = obj.basePath || '';
  var basePath = String(obj.basePath) || '';

  if (!/^https?:\/\//.test(basePath)) {
    remotes.before(path, function (ctx, next) {
      var headers = ctx.req.headers;
      var host = headers.Host || headers.host;

      basePath = ctx.req.protocol + '://' + host + initialPath;

      next();
    });
  }

  return setter(obj);

  function getter() {
    return basePath;
  }

  function setter(obj) {
    return Object.defineProperty(obj, 'basePath', {
      configurable: false,
      enumerable: true,
      get: getter
    });
  }
}

/**
 * Converts from an sl-remoting-formatted "Route" description to a
 * Swagger-formatted "API" description.
 */

function routeToAPI(route, modelName) {
  var returnDesc = route.returns && route.returns[0];
  var model = returnDesc
    ? ((returnDesc.type == 'object' || returnDesc.type == 'any')
         ? modelName || 'any'
         : prepareDataType(returnDesc.type))
    : 'void';

  return {
    path: convertPathFragments(route.path),
    operations: [{
      httpMethod: convertVerb(route.verb),
      nickname: route.method.replace(/\./g, '_'), // [rfeng] Swagger UI doesn't escape '.' for jQuery selector
      responseClass: model,
      parameters: route.accepts ? route.accepts.map(acceptToParameter(route)) : [],
      errorResponses: [], // TODO(schoon) - We don't have descriptions for this yet.
      summary: route.description, // TODO(schoon) - Excerpt?
      notes: '', // TODO(schoon) - `description` metadata?
      authorizations: {
        oauth2: [
          {
            description: 'Allow everything',
            scope: '*'
          }
        ]
      }
    }]
  };
}

function convertPathFragments(path) {
  return path.split('/').map(function (fragment) {
    if (fragment.charAt(0) === ':') {
      return '{' + fragment.slice(1) + '}';
    }
    return fragment;
  }).join('/');
}

function convertVerb(verb) {
  if (verb.toLowerCase() === 'all') {
    return 'POST';
  }

  if (verb.toLowerCase() === 'del') {
    return 'DELETE';
  }

  return verb.toUpperCase();
}

/**
 * A generator to convert from an sl-remoting-formatted "Accepts" description to
 * a Swagger-formatted "Parameter" description.
 */

function acceptToParameter(route) {
  var type = 'form';

  if (route.verb.toLowerCase() === 'get') {
    type = 'query';
  }

  return function (accepts) {
    var name = accepts.name || accepts.arg;
    var paramType = type;

    // TODO: Regex. This is leaky.
    if (route.path.indexOf(':' + name) !== -1) {
      paramType = 'path';
    }

    // Check the http settings for the argument
    if(accepts.http && accepts.http.source) {
        paramType = accepts.http.source;
    }

    return {
      paramType: paramType || type,
      name: name,
      description: accepts.description,
      dataType: accepts.model || prepareDataType(accepts.type),
      required: !!accepts.required,
      allowMultiple: false
    };
  };
}

/**
 * Converts from an sl-remoting data type to a Swagger dataType.
 */

function prepareDataType(type) {
  if (!type) {
    return 'void';
  }

  // TODO(schoon) - Add support for complex dataTypes, "models", etc.
  switch (type) {
    case 'buffer':
      return 'byte';
    case Date:
    case 'date':
      return 'Date';
    case Number:
    case 'number':
      return 'double';
    case String:
      return 'string';
    case Array:
    case 'array':
      return 'array';
    case 'any':
      return 'any';
    case 'object':
      return 'object';
  }

  if (Array.isArray(type)) {
    return 'array';
  }

  return typeof type  == 'string' ? type : 'object';
}

