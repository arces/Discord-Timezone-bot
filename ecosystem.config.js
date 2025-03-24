// ecosystem.config.js
module.exports = {
  apps: [
    {
      name: "discord-time-channel-bot",
      script: "./index.js",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "200M",
      // Do not include sensitive env variables here
      // Instead, load them from your .env file or set them externally on the server.
    },
  ],
};
