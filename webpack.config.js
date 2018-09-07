const path = require('path');
const CleanWebpackPlugin = require('clean-webpack-plugin');
const webpackMerge = require("webpack-merge");
const FRONTEND_MODE = JSON.parse(process.env.FRONTEND_ENV || '0');
const modeConfig = env => require(`./build-utils/webpack.${env}`)(env);

module.exports = ({ mode, presets } = { mode: "production", presets: [] }) => {
  const basicConfig = {
    mode,
    performance: { hints: false },
    target: "node",
    devtool: 'source-map',
    module: {
      rules: [
        {
          test: /\.js$/,
          use: [ "source-map-loader" ],
          enforce: "pre"
        },
        {
          test: /\.ts?$/,
          use: 'ts-loader',
          exclude: /node_modules/
        }
      ]
    },
    resolve: {
      extensions: [ '.ts', '.js' ]
    },
    plugins: []
  };

  const additionalConfig = {};

  if (FRONTEND_MODE) {
    additionalConfig.entry = './src/index-frontend.ts';
    additionalConfig.target = 'web';
    additionalConfig.output = {
      path: path.join(__dirname, 'dist'),
      filename: 'vizabi-excel-reader.js',
      libraryTarget: 'var',
      library: 'ExcelReader'
    };
  } else {
   basicConfig.plugins.push(new CleanWebpackPlugin(['dist']));
  }

  return webpackMerge(basicConfig, modeConfig(mode), additionalConfig);
};
