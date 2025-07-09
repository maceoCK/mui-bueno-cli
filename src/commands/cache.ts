import chalk from 'chalk';
import ora from 'ora';
import fs from 'fs-extra';
import path from 'path';
import inquirer from 'inquirer';
import { ConfigManager } from '../utils/config.js';

interface CacheOptions {
  clear?: boolean;
}

export async function cacheCommand(options: CacheOptions = {}): Promise<void> {
  const configManager = new ConfigManager();
  const config = await configManager.load();
  const cacheDir = config.cacheDir;

  if (!cacheDir) {
    console.log(chalk.red('Cache directory is not configured.'));
    return;
  }

  if (options.clear) {
    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: `This will delete the cache directory at ${cacheDir}. Continue?`,
        default: false
      }
    ]);

    if (!confirm) {
      console.log(chalk.yellow('Cache clear cancelled.'));
      return;
    }

    const spinner = ora('Clearing cache...').start();
    try {
      await fs.remove(cacheDir);
      spinner.succeed('Cache cleared successfully.');
    } catch (error) {
      spinner.fail('Failed to clear cache.');
      console.error(error);
    }
    return;
  }

  const exists = await fs.pathExists(cacheDir);
  if (!exists) {
    console.log(chalk.yellow('Cache directory does not exist.'));
    return;
  }

  const spinner = ora('Calculating cache size...').start();
  try {
    const sizeBytes = await getDirSize(cacheDir);
    spinner.stop();
    const sizeMB = (sizeBytes / (1024 * 1024)).toFixed(2);
    console.log(chalk.blue(`Cache directory: ${cacheDir}`));
    console.log(chalk.blue(`Cache size: ${sizeMB} MB`));
  } catch (error) {
    spinner.fail('Failed to calculate cache size.');
    console.error(error);
  }
}

async function getDirSize(dir: string): Promise<number> {
  let size = 0;
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      size += await getDirSize(fullPath);
    } else if (entry.isFile()) {
      const { size: fileSize } = await fs.stat(fullPath);
      size += fileSize;
    }
  }
  return size;
} 