'use strict';

const BbPromise = require('bluebird');
const _ = require('lodash');
const {flatten} = require('flattenjs');

module.exports = {
  async getFunctionArn(name) {
    const stage = _.get(this, 'stage');
    const region = _.get(this, 'region');
    return this.provider.request('Lambda', 'getFunction', {FunctionName: name}, stage, region).then((result) => {
      if (result) {
        const functionArn = _.get(result, 'Configuration.FunctionArn')

        if (_.isEmpty(functionArn)) {
          throw new this.serverless.classes.Error(`FunctionArn ${functionArn} not found`)
        }

        return BbPromise.resolve(functionArn);
      }
    });
  },
  async getPhysicalResourceId(logicalResourceId) {
    const naming = _.get(this, 'provider.naming');
    const stage = _.get(this, 'stage');
    const region = _.get(this, 'region');
    const StackName = naming.getStackName(stage);
    return this.provider.request('CloudFormation', 'describeStackResource', {
      StackName,
      LogicalResourceId: logicalResourceId
    }, stage, region).then((result) => {
      if (result) {

        // todo: error handling
        // "CREATE_IN_PROGRESS"
        // "CREATE_FAILED"
        // "CREATE_COMPLETE"
        // "DELETE_IN_PROGRESS"
        // "DELETE_FAILED"
        // "DELETE_COMPLETE"
        // "DELETE_SKIPPED"
        // "UPDATE_IN_PROGRESS"
        // "UPDATE_FAILED"
        // "UPDATE_COMPLETE"
        // "IMPORT_FAILED"
        // "IMPORT_COMPLETE"
        // "IMPORT_IN_PROGRESS"
        // "IMPORT_ROLLBACK_IN_PROGRESS"
        // "IMPORT_ROLLBACK_FAILED"
        // "IMPORT_ROLLBACK_COMPLETE"
        // "UPDATE_ROLLBACK_IN_PROGRESS"
        // "UPDATE_ROLLBACK_COMPLETE"
        // "UPDATE_ROLLBACK_FAILED"
        // "ROLLBACK_IN_PROGRESS"
        // "ROLLBACK_COMPLETE"
        // "ROLLBACK_FAILED",

        const physicalResourceId = _.get(result, 'StackResourceDetail.PhysicalResourceId')

        if (_.isEmpty(physicalResourceId)) {
          throw new this.serverless.classes.Error(`PhysicalResourceId ${physicalResourceId} not found`)
        }

        return BbPromise.resolve(physicalResourceId);
      }
    });
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
  async replacePlaceHolders() {
    console.log('started');
    const stage = _.get(this, 'stage');
    const region = _.get(this, 'region');
    const name = _.get(this, 'options.name');
    const accountId = await this.provider.getAccountId();
    const stateMachine = this.getStateMachine(name);
    const definition = _.get(stateMachine, 'definition');
    const flat = flatten(definition);

    let logicalResourceId, physicalResourceId;

    for (const k of _.keys(flat)) {
      const path = k.substring(0, k.lastIndexOf("."));
      switch (true) {
        case _.endsWith(k, '.Ref',):
          logicalResourceId = _.get(definition, `${path}.Ref`)
          physicalResourceId = await this.getPhysicalResourceId(logicalResourceId);
          _.set(definition, path, physicalResourceId);
          break;
        case _.endsWith(k, '.Fn::GetAtt[0]'):
          const getAttribute = _.get(definition, `${path}.Fn::GetAtt`);
          const name = _.first(getAttribute);
          // todo: may needs to be implemented when we find other uses of getAtt
          // const attribute = _.last(getAttribute);
          if (_.endsWith(path, '.Resource')) {
            physicalResourceId = await this.getPhysicalResourceId(`${_.upperFirst(name)}LambdaFunction`);
            const functionArn = await this.getFunctionArn(physicalResourceId);
            _.set(definition, path, functionArn);
          } else {
            throw new this.serverless.classes.Error(`${k} not yet implemented`);
          }
          break;
      }
    }

    const stateMachineArn = `arn:aws:states:${region}:${accountId}:stateMachine:${name}`;

    return this.provider.request('StepFunctions', 'updateStateMachine', {
      stateMachineArn,
      definition: JSON.stringify(definition)
    }, stage, region).then((result) => {
      if (result) {
        return BbPromise.resolve(`Step-Function ${stateMachineArn} synced successfully`);
      } else {
        return BbPromise.reject(new Error('Error in syncing Step-Function'));
      }
    });
  },
};
