import chalk from 'chalk';
import inquirer from 'inquirer';
import { ConfigManager } from '../utils/config.js';
import { initCommand } from './init.js';

interface ConfigOptions {
  reset?: boolean;
  edit?: boolean;
}

export async function configCommand(options: ConfigOptions = {}): Promise<void> {
  const configManager = new ConfigManager();

  if (options.reset) {
    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: 'This will delete existing configuration. Continue?',
        default: false
      }
    ]);

    if (!confirm) {
      console.log(chalk.yellow('Reset cancelled.'));
      return;
    }

    await configManager.reset();
    console.log(chalk.green('Configuration reset.'));
    return;
  }

  if (options.edit) {
    await initCommand();
    return;
  }

  const config = await configManager.load();
  console.log(chalk.blue('Current configuration:\n'));
  console.log(JSON.stringify(config, null, 2));
} 