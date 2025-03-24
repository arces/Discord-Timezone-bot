# Discord Time Channel Bot

[![GitHub issues](https://img.shields.io/github/issues/yourusername/discord-time-channel-bot)](https://github.com/yourusername/discord-time-channel-bot/issues)
[![GitHub forks](https://img.shields.io/github/forks/yourusername/discord-time-channel-bot)](https://github.com/yourusername/discord-time-channel-bot/network)
[![GitHub stars](https://img.shields.io/github/stars/yourusername/discord-time-channel-bot)](https://github.com/yourusername/discord-time-channel-bot/stargazers)
[![License](https://img.shields.io/github/license/yourusername/discord-time-channel-bot)](LICENSE)

*Discord Time Channel Bot* is a Node.js-based Discord bot that automatically updates channel names across multiple servers (guilds) to display the current time in various timezones. Configure and manage the bot dynamically using in-Discord commands — no code editing required!

## Table of Contents

- [Features](#features)
- [Installation](#installation)
- [Configuration](#configuration)
- [Usage](#usage)
  - [Commands](#commands)
- [Running with PM2](#running-with-pm2)
- [Contributing](#contributing)
- [License](#license)
- [Contact](#contact)

## Features

- **Multi-Guild Support**  
  Each server can manage its own time channel configurations independently.

- **Dynamic Channel Updates**  
  Automatically update channel names every minute to reflect the current time in the specified timezone.

- **In-Discord Configuration**  
  Easily add, remove, or list channel configurations using simple commands:
  - `!setchannel`
  - `!removechannel`
  - `!listchannels`
  - `!updatenow`

- **Persistent Configuration**  
  Configurations are stored in a JSON file (`timechannels.json`), ensuring that your settings persist across restarts.

- **Robust Error Handling**  
  Input validation (e.g., timezone verification) and logging help maintain smooth operation.

## Installation

### Prerequisites

- [Node.js](https://nodejs.org/) (v14 or higher recommended)
- A Discord bot token (available via the [Discord Developer Portal](https://discord.com/developers/applications))

### Steps

1. **Clone the repository:**
   ```bash
   git clone https://github.com/yourusername/discord-time-channel-bot.git
   cd discord-time-channel-bot
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure Environment Variables:**
   Create a `.env` file in the project root and add your Discord bot token:
   ```ini
   DISCORD_BOT_TOKEN=your_bot_token_here
   ```

4. **Configure PM2 (Optional):**
   If you plan to run the bot with PM2, create an `ecosystem.config.js` file:
   ```javascript
   module.exports = {
     apps: [{
       name: 'discord-time-channel-bot',
       script: './index.js',
       instances: 1,
       autorestart: true,
       watch: false,
       max_memory_restart: '200M',
       env: {
         NODE_ENV: 'production',
         DISCORD_BOT_TOKEN: 'your_bot_token_here'
       }
     }]
   };
   ```

## Configuration

The bot uses a JSON file named `timechannels.json` to persist channel configurations on a per-guild basis. The file structure looks like this:

```json
{
  "guildId1": {
    "PST": {
      "channelId": "123456789012345678",
      "timezone": "America/Los_Angeles"
    },
    "CET": {
      "channelId": "234567890123456789",
      "timezone": "Europe/Berlin"
    }
  },
  "guildId2": {
    "SGT": {
      "channelId": "345678901234567890",
      "timezone": "Asia/Singapore"
    }
  }
}
```

Configurations are updated via Discord commands and automatically saved to this file.

## Usage

Start the bot with:
```bash
node index.js
```

Or, if you're using PM2:
```bash
pm2 start ecosystem.config.js
```

Once running, invite your bot to your server with the appropriate permissions (including Manage Channels) and use the commands listed below.

### Commands

1. **Configure a Channel:**
   Set a channel to display the current time in a specific timezone:
   ```
   !setchannel <label> <channelId> <timezone>
   ```
   Example:
   ```
   !setchannel PST 123456789012345678 America/Los_Angeles
   ```

2. **Remove a Channel Configuration:**
   Remove a channel configuration by its label:
   ```
   !removechannel <label>
   ```
   Example:
   ```
   !removechannel PST
   ```

3. **List Configured Channels:**
   List all channel configurations for your server:
   ```
   !listchannels
   ```

4. **Immediate Update:**
   Force an immediate update of all configured channels in your server:
   ```
   !updatenow
   ```

## Running with PM2

To ensure the bot stays online and automatically restarts if it crashes, PM2 is a great choice for process management. Use the provided `ecosystem.config.js` file and start the bot with:

```bash
pm2 start ecosystem.config.js
```

You can monitor logs with:
```bash
pm2 logs discord-time-channel-bot
```

## Contributing

Contributions are welcome! If you have ideas for new features or improvements, please follow these steps:

1. Fork the repository.
2. Create a new branch:
   ```bash
   git checkout -b feature/YourFeature
   ```
3. Commit your changes.
4. Open a pull request.

Please ensure your code adheres to the existing style and includes appropriate comments and documentation.

## License

This project is licensed under the MIT License.

## Contact

For questions or support, please open an issue on GitHub or contact your.email@example.com.

---

*Happy coding!*