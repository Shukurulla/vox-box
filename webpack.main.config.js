const { rules } = require("./webpack.rules");
const { plugins } = require("./webpack.plugins");

const mainConfig = {
  entry: "./src/index.js",
  module: {
    rules,
  },
  plugins,
  resolve: {
    extensions: [".js", ".jsx", ".css", ".json"],
  },
};

module.exports = { mainConfig };
