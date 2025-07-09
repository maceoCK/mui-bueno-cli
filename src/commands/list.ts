import chalk from 'chalk';
import ora from 'ora';
import { ConfigManager } from '../utils/config.js';
import { GitService } from '../services/git/git-service.js';

interface ListOptions {
  branch?: string;
  limit?: number;
}

export async function listCommand(options: ListOptions = {}): Promise<void> {
  const spinner = ora('Fetching components...').start();
  try {
    const configManager = new ConfigManager();
    const config = await configManager.load();
    const gitService = new GitService(config.git, config.cacheDir);

    const components = await gitService.listComponents(options.branch);

    spinner.stop();

    if (components.length === 0) {
      console.log(chalk.yellow('No components found in the repository.'));
      return;
    }

    const list = options.limit ? components.slice(0, options.limit) : components;

    console.log(chalk.blue(`Found ${components.length} component${components.length === 1 ? '' : 's'}${options.limit ? ` (showing ${list.length})` : ''}:\n`));

    list.forEach((comp, idx) => {
      console.log(`${chalk.dim(`${idx + 1}.`)} ${chalk.bold(comp.name)}`);
    });
  } catch (error) {
    spinner.fail('Failed to list components');
    console.error(error);
  }
} 