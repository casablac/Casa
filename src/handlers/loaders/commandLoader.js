import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { Collection } from 'discord.js';
import { logger } from '../../utils/logger.js';
import botConfig, { isCommandCategoryEnabled } from '../../config/bot.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MAX_COMMANDS = 100;
const COMMAND_COUNT_WARN_THRESHOLD = 90;

// Estos se registran primero para que NUNCA los corte el límite de 100
const PRIORITY_COMMANDS = [
  'ticket',
  'ticketsetup',
  'ticketlogs',
  'welcome',
  'goodbye',
  'greet',
  'autorole',
  'help',
  'ping',
  'ban',
  'kick',
  'timeout',
  'warn',
  'purge',
  'clear',
  'verify',
  'verification',
  'mod',
  'setup',
];

function getSubcommandInfo(commandData) {
  const subcommands = [];
  if (commandData.options) {
    for (const option of commandData.options) {
      if (option.type === 1) {
        subcommands.push(option.name);
      } else if (option.type === 2) {
        if (option.options) {
          for (const subOption of option.options) {
            if (subOption.type === 1) {
              subcommands.push(`${option.name}/${subOption.name}`);
            }
          }
        }
      }
    }
  }
  return subcommands;
}

async function getAllFiles(directory, fileList = []) {
  const files = await fs.readdir(directory, { withFileTypes: true });
  for (const file of files) {
    const filePath = path.join(directory, file.name);
    if (file.isDirectory()) {
      if (
        file.name === 'modules' ||
        file.name.includes('OLD_DISABLED') ||
        file.name.includes('_DISABLED')
      ) {
        continue;
      }
      await getAllFiles(filePath, fileList);
    } else if (file.name.endsWith('.js')) {
      fileList.push(filePath);
    }
  }
  return fileList;
}

export async function loadCommands(client) {
  client.commands = new Collection();
  const commandsPath = path.join(__dirname, '../../commands');
  const commandFiles = await getAllFiles(commandsPath);
  logger.info(`Found ${commandFiles.length} command files to load`);
  const uniqueCommandNames = new Set();
  for (const filePath of commandFiles) {
    try {
      const normalizedPath = filePath.replace(/\\/g, '/');
      const commandDir = path.dirname(filePath);
      const category = path.basename(commandDir);
      // Saltar categorías desactivadas en bot.js → features
      if (!isCommandCategoryEnabled(category)) {
        logger.info(`Skipping disabled category: ${category} (${normalizedPath})`);
        continue;
      }
      const commandModule = await import(`file://${filePath}`);
      const command = commandModule.default || commandModule;
      if (!command.data || !command.execute) {
        logger.warn(
          `Command at ${filePath} is missing required "data" or "execute" property.`
        );
        continue;
      }
      command.category = category;
      command.filePath = normalizedPath;
      const primaryCommandName = command.data.name;
      if (!uniqueCommandNames.has(primaryCommandName)) {
        uniqueCommandNames.add(primaryCommandName);
        client.commands.set(primaryCommandName, command);
      }
      const subcommands = getSubcommandInfo(command.data.toJSON());
      logger.info(
        `Loaded command: ${primaryCommandName} from ${normalizedPath} (category: ${category})`
      );
      if (subcommands.length > 0) {
        logger.info(` - Subcommands: ${subcommands.join(', ')}`);
      }
    } catch (error) {
      logger.error(`Error loading command from ${filePath}:`, error);
    }
  }
  logger.info(`Loaded ${uniqueCommandNames.size} commands`);
  return client.commands;
}

function collectCommandPayloads(client) {
  const commands = [];
  let totalSubcommands = 0;
  const registeredNames = new Set();
  for (const command of client.commands.values()) {
    if (!command.data || typeof command.data.toJSON !== 'function') {
      logger.warn(`Command missing data or toJSON method: ${command}`);
      continue;
    }
    const commandName = command.data.name;
    logger.debug(`Processing command for registration: ${commandName}`);
    if (registeredNames.has(commandName)) {
      logger.debug(`Skipping duplicate command: ${commandName}`);
      continue;
    }
    registeredNames.add(commandName);
    const commandJson = command.data.toJSON();
    commands.push(commandJson);
    totalSubcommands += getSubcommandInfo(commandJson).length;
    if (process.env.NODE_ENV !== 'production') {
      logger.debug(`Registering command: ${commandName}`);
    }
  }
  return { commands, totalSubcommands };
}

function validateCommands(commands) {
  const validationErrors = [];
  for (const cmd of commands) {
    if (cmd.name && cmd.name.length > 32) {
      validationErrors.push(
        `Command ${cmd.name} has name longer than 32 chars: "${cmd.name}" (${cmd.name.length} chars)`
      );
    }
    if (cmd.description && cmd.description.length > 110) {
      validationErrors.push(
        `Command ${cmd.name} has description longer than 110 chars: "${cmd.description}" (${cmd.description.length} chars)`
      );
    }
    if (!cmd.options) continue;
    for (const option of cmd.options) {
      if (option.name && option.name.length > 32) {
        validationErrors.push(
          `Command ${cmd.name} option ${option.name} has name longer than 32 chars: "${option.name}" (${option.name.length} chars)`
        );
      }
      if (option.description && option.description.length > 110) {
        validationErrors.push(
          `Command ${cmd.name} option ${option.name} has description longer than 110 chars: "${option.description}" (${option.description.length} chars)`
        );
      }
      if (option.choices) {
        for (const choice of option.choices) {
          if (choice.name && choice.name.length > 110) {
            validationErrors.push(
              `Command ${cmd.name} option ${option.name} choice ${choice.name} has name longer than 110 chars`
            );
          }
          if (choice.value && String(choice.value).length > 100) {
            validationErrors.push(
              `Command ${cmd.name} option ${option.name} choice ${choice.name} has value longer than 100 chars`
            );
          }
        }
      }
      if (!option.options) continue;
      for (const subOption of option.options) {
        if (subOption.name && subOption.name.length > 32) {
          validationErrors.push(
            `Command ${cmd.name} subcommand ${option.name} option ${subOption.name} has name longer than 32 chars`
          );
        }
        if (subOption.description && subOption.description.length > 110) {
          validationErrors.push(
            `Command ${cmd.name} subcommand ${option.name} option ${subOption.name} has description longer than 110 chars`
          );
        }
      }
    }
  }
  if (validationErrors.length > 0) {
    logger.error('Command validation failed. Errors:');
    validationErrors.forEach((error) => logger.error(` - ${error}`));
    throw new Error(
      `Command validation failed with ${validationErrors.length} errors`
    );
  }
}

function prepareCommandsForRegistration(commands) {
  if (commands.length >= COMMAND_COUNT_WARN_THRESHOLD) {
    logger.warn(
      `Command count (${commands.length}) is near Discord's ${MAX_COMMANDS} global command limit`
    );
  }
  // Priorizar ticket, welcome, etc.
  const sorted = [...commands].sort((a, b) => {
    const ai = PRIORITY_COMMANDS.indexOf(a.name);
    const bi = PRIORITY_COMMANDS.indexOf(b.name);
    const ap = ai === -1 ? 999 : ai;
    const bp = bi === -1 ? 999 : bi;
    return ap - bp;
  });
  if (sorted.length <= MAX_COMMANDS) {
    return sorted;
  }
  logger.warn(
    `Command count (${sorted.length}) exceeds Discord limit (${MAX_COMMANDS}), truncating...`
  );
  const truncated = sorted.slice(0, MAX_COMMANDS);
  logger.info(`Truncated to ${truncated.length} commands for registration`);
  logger.info(
    `Priority kept (first names): ${truncated
      .slice(0, 20)
      .map((c) => c.name)
      .join(', ')}`
  );
  return truncated;
}

async function registerGlobalCommands(client, clientId, commands, totalSubcommands) {
  if (!clientId) {
    throw new Error('CLIENT_ID is required for slash command registration');
  }
  if (!client.rest) {
    throw new Error(
      'Discord REST client is not available for slash command registration'
    );
  }
  logger.info(
    `Preparing to register ${totalSubcommands + commands.length} commands globally`
  );
  logger.info('Validating commands before registration...');
  validateCommands(commands);
  logger.info('Command validation passed');
  const commandsToRegister = prepareCommandsForRegistration(commands);
  if (botConfig.commands?.deleteCommands) {
    logger.info('Clearing existing global commands before registration...');
    await client.rest.put(`/applications/${clientId}/commands`, { body: [] });
  }
  logger.info(`Registering ${commandsToRegister.length} global commands...`);
  await client.rest.put(`/applications/${clientId}/commands`, {
    body: commandsToRegister,
  });
  logger.info(
    `Successfully registered ${commandsToRegister.length} global commands`
  );
  logger.info(
    'Global commands may take up to an hour to appear in all servers on first deploy'
  );
}

async function registerGuildCommands(client, clientId, guildId, commands, totalSubcommands) {
  if (!clientId) {
    throw new Error('CLIENT_ID is required for slash command registration');
  }
  if (!guildId) {
    throw new Error('GUILD_ID is required for guild slash command registration');
  }
  if (!client.rest) {
    throw new Error(
      'Discord REST client is not available for slash command registration'
    );
  }

  logger.info(`Preparing to register ${commands.length} commands to guild ${guildId}`);
  logger.info('Validating commands before registration...');
  validateCommands(commands);
  logger.info('Command validation passed');

  const commandsToRegister = prepareCommandsForRegistration(commands);

  // Limpia comandos viejos del servidor y registra los nuevos (instantáneo)
  logger.info(`Clearing existing guild commands for ${guildId}...`);
  await client.rest.put(`/applications/${clientId}/guilds/${guildId}/commands`, {
    body: [],
  });

  logger.info(`Registering ${commandsToRegister.length} guild commands...`);
  await client.rest.put(`/applications/${clientId}/guilds/${guildId}/commands`, {
    body: commandsToRegister,
  });
  logger.info(
    `Successfully registered ${commandsToRegister.length} guild commands (instant)`
  );
}

export async function registerCommands(client, options = {}) {
  const { clientId = null } = options;
  const guildId =
    process.env.GUILD_ID || client?.config?.bot?.guildId || null;

  try {
    const { commands, totalSubcommands } = collectCommandPayloads(client);

    // Si hay GUILD_ID, registra en ese servidor (aparece al instante)
    if (guildId) {
      await registerGuildCommands(
        client,
        clientId,
        guildId,
        commands,
        totalSubcommands
      );
      // También actualiza global en segundo plano (puede tardar hasta 1 hora)
      registerGlobalCommands(client, clientId, commands, totalSubcommands).catch(
        (err) => {
          logger.warn(
            'Background global command registration failed:',
            err.message
          );
        }
      );
    } else {
      await registerGlobalCommands(client, clientId, commands, totalSubcommands);
    }
  } catch (error) {
    logger.error('Error registering commands:', error);
    throw error;
  }
}

export async function reloadCommand(client, commandName) {
  const command = client.commands.get(commandName);
  if (!command) {
    return { success: false, message: `Command "${commandName}" not found` };
  }
  try {
    const commandPath = path.resolve(command.filePath);
    const moduleUrl = pathToFileURL(commandPath);
    moduleUrl.searchParams.set('t', Date.now().toString());
    const newCommand = (await import(moduleUrl.href)).default;
    client.commands.set(commandName, newCommand);
    logger.info(`Reloaded command: ${commandName}`);
    return {
      success: true,
      message: `Successfully reloaded command "${commandName}"`,
    };
  } catch (error) {
    logger.error(`Error reloading command "${commandName}":`, error);
    return {
      success: false,
      message: `Error reloading command: ${error.message}`,
    };
  }
}
