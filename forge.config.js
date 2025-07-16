const { MakerSquirrel } = require("@electron-forge/maker-squirrel");
const { MakerZIP } = require("@electron-forge/maker-zip");
const { MakerDeb } = require("@electron-forge/maker-deb");
const { MakerRpm } = require("@electron-forge/maker-rpm");
const {
  AutoUnpackNativesPlugin,
} = require("@electron-forge/plugin-auto-unpack-natives");
const { WebpackPlugin } = require("@electron-forge/plugin-webpack");
const { FusesPlugin } = require("@electron-forge/plugin-fuses");
const { FuseV1Options, FuseVersion } = require("@electron/fuses");
const { MakerDMG } = require("@electron-forge/maker-dmg");

const { mainConfig } = require("./webpack.main.config");
const { rendererConfig } = require("./webpack.renderer.config");

const config = {
  packagerConfig: {
    asar: true,
    icon: "./src/assets/icon",
    name: "Помощник Интервью",
  },
  rebuildConfig: {},
  makers: [
    new MakerZIP({}, ["darwin", "win32"]),
    new MakerDMG({}),
    {
      name: "@electron-forge/maker-zip",
      config: {},
      platforms: ["win32"],
    },
  ],
  plugins: [
    new AutoUnpackNativesPlugin({}),
    new WebpackPlugin({
      mainConfig,
      renderer: {
        config: rendererConfig,
        entryPoints: [
          {
            html: "./src/index.html",
            js: "./src/renderer.jsx",
            name: "main_window",
            preload: {
              js: "./src/preload.js",
            },
          },
        ],
      },
    }),
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
};

module.exports = config;
