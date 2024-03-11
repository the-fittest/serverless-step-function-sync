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

## Credits and inspiration

This plugin is based on the work of [notanmay](https://github.com/notanmay) and [jappurohit041](https://github.com/jappurohit041/) work at the awesome [serverless-step-functions](https://github.com/serverless-operations/serverless-step-functions).

## License

MIT
