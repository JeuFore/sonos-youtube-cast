import path from "path";

export default {
  mode: "production",
  entry: "./src/index.ts",
  output: {
    path: path.resolve(path.dirname(""), "dist"),
    filename: "index.js",
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: "ts-loader",
        exclude: /node_modules/,
      },
    ],
  },
  target: "node",
  resolve: {
    extensions: [".tsx", ".ts", ".js"],
  },
};