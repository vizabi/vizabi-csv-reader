const path = require('path');

module.exports = (env) => ({
    entry: {
        'vizabi-excel-reader-node': './src/index-backend.ts'
    },
    output: {
        path: path.join(__dirname, '../dist'),
        filename: '[name].js',
        libraryTarget: 'commonjs'
    }
});
