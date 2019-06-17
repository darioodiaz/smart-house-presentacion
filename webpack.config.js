const path = require('path');

const config = {
    entry: {
        'app': './ui/js/app.js',
        'vendors': './ui/js/jquery.min.js',
    },
    output: {
        path: path.resolve(__dirname, './ui/dist'),
    },
    module: {
    },
};

module.exports = config;
