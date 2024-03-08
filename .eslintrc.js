"use strict"

module.exports = {
  env: {
    es2022: true,
    mocha: true,
  },

  extends: [
    "eslint:recommended",
    "eslint-config-airbnb-base",
    "plugin:prettier/recommended",
    "plugin:unicorn/recommended",
  ],

  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
  },

  rules: {
    // require file extensions
    "import/extensions": [
      "error",
      "always",
      {
        ignorePackages: true,
      },
    ],

    "no-restricted-exports": "off",

    "no-restricted-globals": [
      "error",
      {
        message: "Import 'Buffer' from 'node:buffer' module instead",
        name: "Buffer",
      },
      {
        message: "Import 'process' from 'node:process' module instead",
        name: "process",
      },
    ],

    "sort-keys": "error"
  }
}
