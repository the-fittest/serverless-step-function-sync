# Serverless Step Function Sync
This [Serverless](https://github.com/serverless/serverless) plugin syncs step functions from your local machine to speed up your development cycles.

## Installation

First, add Serverless Step Function Sync to your project:

`npm install serverless-step-function-sync --save-dev`

Then inside your project's `serverless.yml` file add following entry to the plugins section: `serverless-step-function-sync`. If there is no plugin section you will need to add it to the file.

**Note that the "plugin" section for serverless-step-function-sync must be at root level on serverless.yml.**

It should look something like this:

```yml
plugins:
  - serverless-step-function-sync
```

## Usage and command line options

In your project root run:

`sls deploy stepFunctionSync --name [name of the step function]` or `serverless deploy stepFunctionSync --name [name of the step function]`.

or

`sls deploy stepFunctionSync --id [id of the step function]` or `serverless deploy stepFunctionSync --id [id of the step function]`.

## Example

### DynamoDb Table name

If you want to resolve TableName like so

```yaml

  Get test:
    Type: Task
    Resource: arn:aws:states:::aws-sdk:dynamodb:query
    Parameters:
      TableName: !Ref TestTable
      KeyConditionExpression: id = :id
      ExpressionAttributeValues:
        ":id":
          S: "1234"
      ConsistentRead: false
    ResultPath: $.test
    Next: Pass
```

you need to set an output in cloudformation:

```yaml
Resources:
  TestTable:
    Type: AWS::DynamoDB::Table
    Properties:
      TableName: TestTable${opt:stage, 'dev'}
      BillingMode: PAY_PER_REQUEST
      AttributeDefinitions:
        - AttributeName: id
          AttributeType: S
      KeySchema:
        - AttributeName: id
          KeyType: HASH

Outputs:
  TestTableName:
    Value: !Ref TestTable
```

### State Machine Arn

If you want to resolve the stateMachineArn, that works simply through declaration as seen here:

```yaml
  RefTest:
    Type: Task
    Resource: arn:aws:states:::states:startExecution
    Parameters:
      StateMachineArn: !Ref StepMachineOne
      Input:
        key1: value3
        key2: value2
    Next: Get test
```

### Lambda Arn

If you want to resolve the lambda arns, that works simply through declaration as seen here:

```yaml
  Function2:
    Type: Task
    Parameters:
      AWS_STEP_FUNCTIONS_STARTED_BY_EXECUTION_NAME.$: $$.Execution.Name
      AWS_STEP_FUNCTIONS_STARTED.$: $$.Execution.Name
    Resource: !GetAtt dummy.Arn
    Next: RefTest
```


## Credits and inspiration

This plugin is based on the work of [notanmay](https://github.com/notanmay) and [jappurohit041](https://github.com/jappurohit041/) at the awesome [serverless-step-functions](https://github.com/serverless-operations/serverless-step-functions).

## License

MIT
