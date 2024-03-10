'use strict';

const BbPromise = require('bluebird');
const _ = require('lodash');

module.exports = {
  getLambdaQualifiedArn(lambdaName) {
    const naming = _.get(this, 'provider.naming');
    const normalizedLambdaName = naming.getNormalizedFunctionName(lambdaName);
    return `${normalizedLambdaName}LambdaFunctionQualifiedArn`
  },
  getStateMachine(name) {
    const stateMachines = _.values(_.get(this, 'serverless.service.stepFunctions.stateMachines'));
    const stateMachine = _.find(stateMachines, ['name', name]);
    if (_.isEmpty(stateMachine)) {
      throw new this.serverless.classes.Error(
        `stateMachine "${name}" doesn't exist in this Service`
      );
    }

    return stateMachine;
  },
  getStackResources() {
    const naming = _.get(this, 'provider.naming');
    const stage = _.get(this, 'stage');
    const region = _.get(this, 'region');
    const StackName = naming.getStackName(stage);
    return this.provider.request('CloudFormation', 'describeStacks', {StackName}, stage, region).then((result) => {
      if (result) {
        const firstStack = _.first(result.Stacks);
        const outputs = _.get(firstStack, 'Outputs');
        _.set(this, 'deployStateMachine.getStackResources', outputs);
      }

      return BbPromise.resolve();
    });

  },
  iterateStates(obj, value) {
    const data = {};

    data.States = {};

    for (const [key, val] of Object.entries(obj)) {
      if (key === 'States') {
        for (const [stateKey, state] of Object.entries(val)) {
          const type = _.get(state, 'Type');
          if (type === 'Task') {
            const resource = _.get(state, 'Resource');
            const arn = _.first(_.get(resource, 'Fn::GetAtt'));
            const ref = _.get(state, 'Parameters.StateMachineArn.Ref');
            const resources = _.get(value, 'deployStateMachine.getStackResources');

            if (_.isString(arn)) {
              const lambdaArn = _.find(resources, ['OutputKey', `${_.upperFirst(arn)}LambdaFunctionQualifiedArn`]);
              if (!lambdaArn) {
                throw new Error(`Lambda ${ref} does not exist in stack resources`);
              }
              state.Resource = lambdaArn.OutputValue;
              _.set(state, 'Resource', lambdaArn.OutputValue);
            } else if (_.isString(ref)) {
              const stepFunctionArn = _.find(resources, ['OutputKey', `${ref}Arn`]);
              if (!stepFunctionArn) {
                throw new Error(`StateMachine ${ref} does not exist in stack resources`);
              }
              _.set(state, 'Parameters.StateMachineArn', stepFunctionArn.OutputValue);
            }

            data.States[stateKey] = state;
          } else {
            data.States[stateKey] = state;
            this.iterateStates(state, value);
          }
        }
      } else if (_.isObject(obj[key])) {
        this.iterateStates(obj[key], value);
      } else if (_.isString(obj[key])) {
        data[key] = obj[key];
      }
    }

    return data;
  },
  replaceAllStatesARNInDefinition(definition, value) {
    return this.iterateStates(definition, value);
  },
  /*
   * Will create a definition string for state-machine
   * that needs to be updated along with
   *  => It should replace resource string that we fetched from
   *     last life cycle events step.
   * 'Fn:Get'
  */
  createDefinitionString() {
    const name = _.get(this, 'options.name');
    const stateMachine = this.getStateMachine(name);
    const definition = _.get(stateMachine, 'definition');

    _.set(
      this,
      'deployStateMachine.definition',
      this.replaceAllStatesARNInDefinition(definition, this)
    );
  },
  /*
   * Will get call StateMachine.updateStateMachine
   * and will pass ARN and definition string as params.
   * 'Fn:Get'
  */
  async callUpdateFunction() {
    const stage = _.get(this, 'stage');
    const region = _.get(this, 'region');
    const name = _.get(this, 'options.name');
    const accountId = await this.provider.getAccountId();
    const definition = JSON.stringify(_.get(this, 'deployStateMachine.definition'));
    const stateMachineArn = `arn:aws:states:${region}:${accountId}:stateMachine:${name}`;

    return this.provider.request('StepFunctions', 'updateStateMachine', {
      stateMachineArn,
      definition
    }, stage, region).then((result) => {
      if (result) {
        return BbPromise.resolve(`Step-Function ${stateMachineArn} synced successfully`);
      } else {
        return BbPromise.reject(new Error('Error in syncing Step-Function'));
      }
    });
  },
};
