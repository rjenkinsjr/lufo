module.exports = {
  parser: 'babel-eslint',
  extends: [
    'airbnb-base',
    'plugin:flowtype/recommended',
  ],
  plugins: [
    'import',
    'flowtype',
  ],
  env: {
    node: true,
    es6: true,
  },
  rules: {
    'func-names': [1, 'never'],
    'no-underscore-dangle': 0,
  },
};
