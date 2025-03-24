// Immediate logging to check script execution
console.log("Script starting...");

// Try loading dotenv first with error checking
try {
  console.log("Loading dotenv...");
  require("dotenv").config();
  console.log("Dotenv loaded successfully");
} catch (error) {
  console.error("Error loading dotenv:", error);
  process.exit(1);
}

// Check if required packages are available
try {
  console.log("Loading required packages...");
  const fs = require("fs");
  const path = require("path");
  const discord = require("discord.js");
  const moment = require("moment-timezone");
  console.log("All packages loaded successfully");
} catch (error) {
  console.error("Error loading required packages:", error);
  console.error(
    "Make sure you have run: npm install dotenv discord.js moment-timezone"
  );
  process.exit(1);
}

const fs = require("fs");
const path = require("path");
const {
  Client,
  GatewayIntentBits,
  ChannelType,
  PermissionFlagsBits,
} = require("discord.js");
const moment = require("moment-timezone");

console.log("Starting bot initialization...");

// Configuration constants
const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
if (!DISCORD_BOT_TOKEN) {
  console.error(
    "ERROR: DISCORD_BOT_TOKEN is not set in environment variables!"
  );
  console.log(
    "Make sure you have a .env file with DISCORD_BOT_TOKEN=your_token_here"
  );
  process.exit(1);
}

console.log("Bot token found, length:", DISCORD_BOT_TOKEN.length);

const CONFIG_PATH = path.join(__dirname, "timechannels.json");
const COMMAND_PREFIX = "!";

// Rate limiting constants
const BATCH_SIZE = 2;
const BATCH_DELAY = 2000;
const UPDATE_INTERVAL = 30000;
const CHANNEL_UPDATE_TIMEOUT = 5000; // 10 second timeout for channel updates
const UPDATE_LOCK_TIMEOUT = 20000; // 30 second auto-release for update lock

let updateLockTimeout = null; // Timeout handle for auto-releasing lock

console.log("Creating Discord client...");

// Create the Discord client with required intents
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

console.log("Client created, setting up event handlers...");

// Add unhandled error listeners
process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
});

process.on("unhandledRejection", (error) => {
  console.error("Unhandled Rejection:", error);
});

let timeChannels = {};
let unknownChannelCounts = {};
let updateInProgress = false;

// Event handler setup
client.once("ready", () => {
  console.log(`Bot is ready! Logged in as ${client.user.tag}`);

  // Immediately trigger first update
  console.log("Triggering initial channel update...");
  updateChannels().catch((error) => {
    console.error("Error in initial update:", error);
  });

  // Set up recurring updates
  console.log(`Setting up update interval (${UPDATE_INTERVAL}ms)`);
  setInterval(() => {
    console.log("\n[UPDATE CYCLE] Starting new update cycle");
    updateChannels().catch((error) => {
      console.error("Error in update cycle:", error);
    });
  }, UPDATE_INTERVAL);
});

client.on("error", (error) => {
  console.error("Discord client error:", error);
});

console.log("Attempting to log in to Discord...");

// Initialize bot connection
client
  .login(DISCORD_BOT_TOKEN)
  .then(() => {
    console.log("Successfully logged into Discord!");
  })
  .catch((error) => {
    console.error("Failed to connect to Discord:", error);
    process.exit(1);
  });

console.log("Login attempt initiated...");
// Enhanced logging function with timestamps
function log(type, message, data = null) {
  const timestamp = moment().format("YYYY-MM-DD HH:mm:ss.SSS");
  const logMessage = `[${timestamp}] [${type}] ${message}`;
  console.log(logMessage);
  if (data) {
    console.log(JSON.stringify(data, null, 2));
  }
}

/**
 * When the bot joins a new guild, create and assign necessary role
 */
client.on("guildCreate", async (guild) => {
  log("GUILD_JOIN", `Bot joined new guild: ${guild.name} (${guild.id})`);

  try {
    let botRole = guild.roles.cache.find((r) => r.name === "TimeChannelBot");
    if (!botRole) {
      botRole = await guild.roles.create({
        name: "TimeChannelBot",
        permissions:
          PermissionFlagsBits.ManageChannels | PermissionFlagsBits.ManageRoles,
        reason:
          "Role for TimeChannelBot to manage channels and roles automatically",
      });
      log("ROLE_CREATE", `Created role ${botRole.name} in guild ${guild.id}`);
    }

    const botMember = guild.members.me;
    if (!botMember.roles.cache.has(botRole.id)) {
      await botMember.roles.add(
        botRole,
        "Assigning role for TimeChannelBot permissions"
      );
      log(
        "ROLE_ASSIGN",
        `Assigned role ${botRole.name} to bot in guild ${guild.id}`
      );
    }
  } catch (error) {
    log("ERROR", `Error in guild setup for ${guild.id}`, error);
  }
});

/**
 * Load channel configurations from file
 */
function loadTimeChannels() {
  log("CONFIG", "Loading channel configurations");
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const rawData = fs.readFileSync(CONFIG_PATH, "utf-8");
      timeChannels = JSON.parse(rawData);
      log("CONFIG", "Configuration loaded successfully", timeChannels);
    } else {
      log("CONFIG", "No configuration file found, starting with empty config");
    }
  } catch (err) {
    log("ERROR", "Error reading config file", err);
  }
}

/**
 * Save channel configurations to file
 */
function saveTimeChannels() {
  log("CONFIG", "Saving channel configurations", timeChannels);
  try {
    fs.writeFileSync(
      CONFIG_PATH,
      JSON.stringify(timeChannels, null, 2),
      "utf-8"
    );
    log("CONFIG", "Configuration saved successfully");
  } catch (err) {
    log("ERROR", "Error writing config file", err);
  }
}

/**
 * Process channels in batches with delay between batches
 */
async function processBatch(channels, startIdx) {
  const batch = channels.slice(startIdx, startIdx + BATCH_SIZE);
  log("BATCH", `Processing batch starting at index ${startIdx}`, batch);

  const batchStart = Date.now();
  const updatePromises = batch.map(async ([guildId, label]) => {
    return updateSingleChannel(guildId, label);
  });

  await Promise.all(updatePromises);
  const batchDuration = Date.now() - batchStart;
  log("BATCH", `Batch completed in ${batchDuration}ms`);

  if (startIdx + BATCH_SIZE < channels.length) {
    log("BATCH", `Waiting ${BATCH_DELAY}ms before next batch`);
    await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY));
    return processBatch(channels, startIdx + BATCH_SIZE);
  } else {
    log("BATCH", "All batches completed");
  }
}

/**
 * Update all channels with rate limiting
 */
async function updateChannels() {
  const updateStart = Date.now();

  if (updateInProgress) {
    log("UPDATE", "Update already in progress, skipping...");
    return;
  }

  try {
    updateInProgress = true;
    log("UPDATE", "Starting channel updates");

    const channelsToUpdate = Object.entries(timeChannels).flatMap(
      ([guildId, labels]) =>
        Object.keys(labels).map((label) => [guildId, label])
    );

    log(
      "UPDATE",
      `Found ${channelsToUpdate.length} channels to update`,
      channelsToUpdate
    );

    if (channelsToUpdate.length === 0) {
      log("UPDATE", "No channels to update");
      return;
    }

    await processBatch(channelsToUpdate, 0);

    const updateDuration = Date.now() - updateStart;
    log("UPDATE", `Update cycle completed in ${updateDuration}ms`);
  } catch (error) {
    log("ERROR", "Error in updateChannels", error);
  } finally {
    updateInProgress = false;
  }
}

/**
 * Update a single channel with better error handling
 */
async function updateSingleChannel(guildId, label) {
  const updateStart = Date.now();
  log("CHANNEL", `Starting update for ${label} in guild ${guildId}`);

  const config = timeChannels[guildId]?.[label];
  if (!config) {
    log("ERROR", `No configuration found for ${label} in guild ${guildId}`);
    return;
  }

  const { channelId, timezone } = config;

  try {
    log("CHANNEL", `Fetching channel ${channelId}`);
    const channel = await client.channels.fetch(channelId);
    if (!channel) throw { code: 10003 };

    const currentTime = moment().tz(timezone).format("h:mm A");
    const newName = `${label}: ${currentTime}`;

    if (channel.name !== newName) {
      log(
        "CHANNEL",
        `Updating channel name from "${channel.name}" to "${newName}"`
      );
      await channel.setName(newName);

      const currentPerms = channel.permissionOverwrites.cache.get(
        channel.guild.roles.everyone.id
      );
      if (!currentPerms?.deny.has(PermissionFlagsBits.Speak)) {
        log("CHANNEL", `Updating permissions for ${channelId}`);
        await channel.permissionOverwrites.edit(
          channel.guild.roles.everyone.id,
          {
            [PermissionFlagsBits.Speak]: false,
          }
        );
      }
    } else {
      log("CHANNEL", `Channel name already up to date: ${newName}`);
    }

    if (unknownChannelCounts[guildId]?.[channelId]) {
      unknownChannelCounts[guildId][channelId] = 0;
      log("CHANNEL", `Reset error counter for ${channelId}`);
    }

    const updateDuration = Date.now() - updateStart;
    log("CHANNEL", `Channel update completed in ${updateDuration}ms`);
  } catch (error) {
    const updateDuration = Date.now() - updateStart;
    log("ERROR", `Channel update failed after ${updateDuration}ms`);
    handleUpdateError(error, guildId, channelId, label);
  }
}

/**
 * Handle channel update errors
 */
function handleUpdateError(error, guildId, channelId, label) {
  if (error.code === 10003) {
    if (!unknownChannelCounts[guildId]) unknownChannelCounts[guildId] = {};
    if (!unknownChannelCounts[guildId][channelId])
      unknownChannelCounts[guildId][channelId] = 0;

    unknownChannelCounts[guildId][channelId]++;
    log("ERROR", `Unknown channel error for ${channelId} in guild ${guildId}`, {
      label,
      errorCount: unknownChannelCounts[guildId][channelId],
    });

    if (unknownChannelCounts[guildId][channelId] >= 5) {
      log("CLEANUP", `Removing channel ${channelId} (${label}) after 5 errors`);
      delete timeChannels[guildId][label];
      if (Object.keys(timeChannels[guildId]).length === 0) {
        delete timeChannels[guildId];
      }
      saveTimeChannels();
    }
  } else {
    log(
      "ERROR",
      `Error updating ${label} (${channelId}) in guild ${guildId}`,
      error
    );
  }
}

/**
 * Command handler
 */
client.on("messageCreate", async (message) => {
  if (
    message.author.bot ||
    !message.guild ||
    !message.content.startsWith(COMMAND_PREFIX)
  )
    return;

  const guildId = message.guild.id;
  const args = message.content.slice(COMMAND_PREFIX.length).trim().split(/\s+/);
  const command = args.shift().toLowerCase();

  log("COMMAND", `Received command: ${command}`, { guildId, args });

  // !setchannel <label> <channelId> <timezone>
  if (command === "setchannel") {
    if (args.length < 3) {
      log("COMMAND", "Invalid setchannel command - insufficient arguments");
      return message.channel.send(
        "Usage: `!setchannel <label> <channelId> <timezone>`\nExample: `!setchannel PST 123456789012345678 America/Los_Angeles`"
      );
    }

    const [label, channelId, timezone] = args;

    if (!moment.tz.zone(timezone)) {
      log("COMMAND", `Invalid timezone provided: ${timezone}`);
      return message.channel.send(
        `Invalid timezone provided: \`${timezone}\`.`
      );
    }

    try {
      const channel = await client.channels.fetch(channelId);
      if (!channel) {
        log("COMMAND", `Channel not found: ${channelId}`);
        return message.channel.send(
          `No channel found with ID: \`${channelId}\`.`
        );
      }
      if (channel.type !== ChannelType.GuildVoice) {
        log("COMMAND", `Invalid channel type: ${channel.type}`);
        return message.channel.send(
          "Please provide a valid **voice channel** ID."
        );
      }

      if (!timeChannels[guildId]) {
        timeChannels[guildId] = {};
      }

      timeChannels[guildId][label] = { channelId, timezone };
      saveTimeChannels();

      log("COMMAND", `Channel configured successfully`, {
        guildId,
        label,
        channelId,
        timezone,
      });

      return message.channel.send(
        `Configured **${label}** → Voice Channel **${channelId}** with timezone **${timezone}** for this server.`
      );
    } catch (error) {
      log("ERROR", `Error in setchannel command`, error);
      return message.channel.send(
        `Error fetching channel with ID: \`${channelId}\`.`
      );
    }
  }

  // !removechannel <label>
  if (command === "removechannel") {
    if (args.length < 1) {
      log("COMMAND", "Invalid removechannel command - no label provided");
      return message.channel.send("Usage: `!removechannel <label>`");
    }

    const label = args[0];
    if (timeChannels[guildId] && timeChannels[guildId][label]) {
      log("COMMAND", `Removing channel configuration`, { guildId, label });

      delete timeChannels[guildId][label];
      if (Object.keys(timeChannels[guildId]).length === 0) {
        delete timeChannels[guildId];
      }
      saveTimeChannels();

      return message.channel.send(
        `Removed configuration for **${label}** for this server.`
      );
    } else {
      log("COMMAND", `No configuration found for removal`, { guildId, label });
      return message.channel.send(
        `No configuration found for label: **${label}** for this server.`
      );
    }
  }

  // !listchannels
  if (command === "listchannels") {
    log("COMMAND", `Listing channels for guild ${guildId}`);

    if (
      !timeChannels[guildId] ||
      Object.keys(timeChannels[guildId]).length === 0
    ) {
      return message.channel.send(
        "No channel configurations found for this server."
      );
    }

    const configList = Object.entries(timeChannels[guildId])
      .map(
        ([label, { channelId, timezone }]) =>
          `**${label}** → Channel ID: \`${channelId}\`, Timezone: \`${timezone}\``
      )
      .join("\n");

    log("COMMAND", "Channel list generated", {
      guildId,
      channels: timeChannels[guildId],
    });
    return message.channel.send(
      `**Current Configurations for this server:**\n${configList}`
    );
  }

  // !updatenow
  if (command === "updatenow") {
    log("COMMAND", `Manual update triggered for guild ${guildId}`);

    if (
      !timeChannels[guildId] ||
      Object.keys(timeChannels[guildId]).length === 0
    ) {
      log("COMMAND", `No channels to update in guild ${guildId}`);
      return message.channel.send(
        "No channel configurations found for this server."
      );
    }

    const updatePromises = [];
    for (const label in timeChannels[guildId]) {
      updatePromises.push(updateSingleChannel(guildId, label));
    }

    await Promise.all(updatePromises);
    log("COMMAND", `Manual update completed for guild ${guildId}`);

    return message.channel.send(
      "Updated channels for this server with the current time!"
    );
  }
});

client.once("ready", () => {
  log("STARTUP", `Bot logged in as ${client.user.tag}`);
  loadTimeChannels();

  // Start update cycle
  setInterval(() => {
    log("CYCLE", "Automatic update cycle starting");
    updateChannels();
  }, UPDATE_INTERVAL);

  log("STARTUP", `Update interval set to ${UPDATE_INTERVAL}ms`);
  log("STARTUP", `Batch size: ${BATCH_SIZE}, Batch delay: ${BATCH_DELAY}ms`);
});
