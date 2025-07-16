const { rules } = require("./webpack.rules");
const { plugins } = require("./webpack.plugins");

rules.push({
  test: /\.css$/,
  use: [
    { loader: "style-loader" },
    { loader: "css-loader" },
    {
      loader: "postcss-loader",
      options: {
        postcssOptions: {
          plugins: [require("tailwindcss"), require("autoprefixer")],
        },
      },
    },
  ],
});

const rendererConfig = {
  module: {
    rules,
  },
  plugins,
  resolve: {
    extensions: [".js", ".jsx", ".css"],
  },
};

module.exports = { rendererConfig };
