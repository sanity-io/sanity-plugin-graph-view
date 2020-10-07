'use strict'

module.exports = {
  env: {
    browser: true,
    es6: true,
    node: true,
  },
  parser: 'babel-eslint',
  plugins: ['react', 'react-hooks', 'prettier'],
  extends: ['plugin:react/recommended', 'eslint:recommended', 'plugin:prettier/recommended'],
  settings: {react: {version: 'detect'}},
  rules: {
    'react/no-unescaped-entities': 0,
    'react-hooks/rules-of-hooks': 'error', // Checks rules of Hooks
    'react-hooks/exhaustive-deps': 'warn', // Checks effect dependencies
  },
}
