const dotenv = require("dotenv");

// ENV config
dotenv.config();

// Migrate mongo config
const config = {
  mongodb: {
    url: process.env.MONGO_URI,

    options: {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    },
  },
  useFileHash: false,
  moduleSystem: "commonjs",
  migrationsDir: "migrations",
  migrationFileExtension: ".js",
  changelogCollectionName: "changelog",
};

module.exports = config;
