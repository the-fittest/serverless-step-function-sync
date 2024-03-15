const BbPromise = require("bluebird");

const _ = require("lodash");

const deploy = require("./sync");

const yamlParse = require("serverless-step-functions/lib/yamlParser");

class ServerlessStepFunctionSync {
  constructor(serverless, options) {
    this.serverless = serverless;
    this.options = options || {};
    this.provider = this.serverless.getProvider('aws');
    this.service = this.serverless.service.service;

    this.region = this.options.region || this.provider.getRegion();
    this.stage = this.provider.getStage();

    _.assign(this, yamlParse, deploy);

    this.commands = {
      deploy: {
        commands: {
          stepFunctionSync: {
            usage: 'Deploy Step functions',
            lifecycleEvents: ['getStackResources', 'replacePlaceHolders'],
            options: {
              name: {
                usage: 'The StateMachine name', shortcut: 'n', required: true, type: 'string',
              }, stage: {
                usage: 'Stage of the service', shortcut: 's', type: 'string',
              }, region: {
                usage: 'Region of the service', shortcut: 'r', type: 'string',
              },
            },
          },
        },
      },
    };

    this.hooks = {
      'before:deploy:stepFunctionSync:getStackResources': () => BbPromise.bind(this)
        .then(this.yamlParse),
      'deploy:stepFunctionSync:replacePlaceHolders': () => BbPromise.bind(this)
        .then(this.replacePlaceHolders)
        .then((result) => {
          console.log(result);
        }),
    };
  }
}

module.exports = ServerlessStepFunctionSync;
