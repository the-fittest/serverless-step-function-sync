// /* eslint-disable */
const BbPromise = require("bluebird");
const _ = require("lodash");
const { flatten } = require("flattenjs");

const {
  EventBridgeClient,
  DescribeConnectionCommand,
} = require("@aws-sdk/client-eventbridge");

module.exports = {
  async describeStackResource(logicalResourceId, stackName, stage, region) {
    return this.provider
      .request(
        "CloudFormation",
        "describeStackResource",
        {
          LogicalResourceId: logicalResourceId,
          StackName: stackName,
        },
        stage,
        region,
      )
      .then((stackResource) => {
        if (_.isEmpty(stackResource)) {
          return BbPromise.reject(
            new Error(`logicalResourceId: ${logicalResourceId} not found`),
          );
        }

        return BbPromise.resolve(stackResource);
      });
  },
  async dynamoDbDescribeTable(logicalResourceId, stage, region) {
    return this.provider
      .request(
        "DynamoDB",
        "describeTable",
        {
          TableName: logicalResourceId,
        },
        stage,
        region,
      )
      .then((table) => {
        if (_.isEmpty(table)) {
          return BbPromise.reject(
            new Error(`logicalResourceId: ${logicalResourceId} not found`),
          );
        }

        return BbPromise.resolve(table);
      });
  },
  async eventDescribeConnection(logicalResourceId) {
    const { credentials } = this.provider.getCredentials();
    const client = new EventBridgeClient(credentials);
    return client.send(
      new DescribeConnectionCommand({
        Name: logicalResourceId,
      }),
    );
  },
  async getLambdaFunction(logicalResourceId, stage, region) {
    return this.provider
      .request(
        "Lambda",
        "getFunction",
        { FunctionName: logicalResourceId },
        stage,
        region,
      )
      .then((lambdaFunction) => {
        if (_.isEmpty(lambdaFunction)) {
          throw new this.serverless.classes.Error(
            `FunctionArn ${lambdaFunction} not found`,
          );
        }

        return BbPromise.resolve(lambdaFunction);
      });
  },
  getStateMachineDraft(predicate) {
    const stateMachines = _.values(
      _.get(this, "serverless.service.stepFunctions.stateMachines"),
    );

    const stateMachine = _.find(stateMachines, predicate);

    if (_.isEmpty(stateMachine)) {
      throw new this.serverless.classes.Error(
        `stateMachine "${predicate}" doesn't exist in this Service`,
      );
    }

    return stateMachine;
  },
  async replacePlaceHolders() {
    const naming = _.get(this, "provider.naming");
    const stage = _.get(this, "stage");
    const region = _.get(this, "region");
    const stackName = naming.getStackName(stage);
    const name = _.get(this, "options.name");
    const id = _.get(this, "options.id");

    let predicate;
    let logicalResourceId;

    if (!_.isEmpty(name)) {
      predicate = ["name", name];
      logicalResourceId = _.upperFirst(name);
    } else if (id) {
      predicate = ["id", id];
      logicalResourceId = id;
    } else {
      throw new this.serverless.classes.Error("Either name or id is required");
    }

    const stateMachineDraft = this.getStateMachineDraft(predicate);
    const {
      StackResourceDetail: { PhysicalResourceId: stateMachineArn },
    } = await this.describeStackResource(
      logicalResourceId,
      stackName,
      stage,
      region,
    );

    const definitionDraft = _.get(stateMachineDraft, "definition");
    const flat = flatten(definitionDraft);

    for (const k of _.keys(flat)) {
      const path = k.slice(0, Math.max(0, k.lastIndexOf(".")));
      let arn;
      let physicalResourceId;
      let resourceType;
      logicalResourceId = "";
      let stackResource = "";

      switch (true) {
        case _.endsWith(k, ".Resource.Fn::GetAtt[0]"): {
          const short = _.first(_.get(definitionDraft, `${path}.Fn::GetAtt`));
          logicalResourceId = `${_.upperFirst(short)}LambdaFunction`;
          break;
        }
        case _.endsWith(k, ".Fn::GetAtt[0]"): {
          logicalResourceId = _.get(definitionDraft, `${path}.Fn::GetAtt`)[0];
          break;
        }
        case _.endsWith(k, ".Ref"): {
          logicalResourceId = _.get(definitionDraft, `${path}.Ref`);
          break;
        }
        default: {
          break;
        }
      }

      if (!_.isEmpty(logicalResourceId)) {
        stackResource = await this.describeStackResource(
          logicalResourceId,
          stackName,
          stage,
          region,
        );
        physicalResourceId = _.get(
          stackResource,
          "StackResourceDetail.PhysicalResourceId",
        );
        resourceType = _.get(stackResource, "StackResourceDetail.ResourceType");
      }

      switch (true) {
        case resourceType === "AWS::Lambda::Function": {
          const lambdaFunction = await this.getLambdaFunction(
            physicalResourceId,
            stage,
            region,
          );
          arn = _.get(lambdaFunction, "Configuration.FunctionArn");
          break;
        }
        case resourceType === "AWS::Events::Connection": {
          const response =
            await this.eventDescribeConnection(physicalResourceId);
          arn = _.get(response, "ConnectionArn");
          break;
        }
        case resourceType === "AWS::StepFunctions::StateMachine": {
          arn = physicalResourceId;
          break;
        }
        case resourceType === "AWS::DynamoDB::Table": {
          const response = await this.dynamoDbDescribeTable(
            physicalResourceId,
            stage,
            region,
          );
          arn = _.get(response, "Table.TableArn");
          break;
        }
        default: {
          break;
        }
      }

      if (arn) {
        _.set(definitionDraft, path, arn);
      }
    }

    return this.updateStateMachine(
      definitionDraft,
      stateMachineArn,
      stage,
      region,
    );
  },
  async updateStateMachine(definitionDraft, stateMachineArn, stage, region) {
    return this.provider
      .request(
        "StepFunctions",
        "updateStateMachine",
        {
          definition: JSON.stringify(definitionDraft),
          stateMachineArn,
        },
        stage,
        region,
      )
      .then((result) => {
        if (_.isEmpty(result)) {
          return BbPromise.reject(new Error("Error in syncing Step-Function"));
        }

        return BbPromise.resolve(
          `Step-Function ${stateMachineArn} synced successfully`,
        );
      });
  },
};
