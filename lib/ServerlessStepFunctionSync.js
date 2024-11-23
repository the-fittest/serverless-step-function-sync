const BbPromise = require("bluebird");

const _ = require("lodash");

const yamlParse = require("serverless-step-functions/lib/yamlParser");
const deploy = require("./sync");

class ServerlessStepFunctionSync {
  constructor(serverless, options) {
    this.serverless = serverless;
    this.options = options || {};
    this.provider = this.serverless.getProvider("aws");
    this.service = this.serverless.service.service;

    this.region = this.options.region || this.provider.getRegion();
    this.stage = this.provider.getStage();

    _.assign(this, yamlParse, deploy);

    this.commands = {
      deploy: {
        commands: {
          "step-function": {
            lifecycleEvents: ["getStackResources", "replacePlaceHolders"],
            options: {
              id: {
                required: false,
                shortcut: "i",
                type: "string",
                usage: "The StateMachine id",
              },
              name: {
                required: false,
                shortcut: "n",
                type: "string",
                usage: "The StateMachine name",
              },
              region: {
                shortcut: "r",
                type: "string",
                usage: "Region of the service",
              },
              stage: {
                shortcut: "s",
                type: "string",
                usage: "Stage of the service",
              },
            },
            usage: "Deploy Step functions",
          },
        },
      },
    };

    this.hooks = {
      "before:deploy:step-function:getStackResources": () =>
        BbPromise.bind(this).then(this.yamlParse),
      "deploy:step-function:replacePlaceHolders": () =>
        BbPromise.bind(this)
          .then(this.replacePlaceHolders)
          .then((result) => {
            console.log(result);
          }),
    };
  }
}

module.exports = ServerlessStepFunctionSync;
