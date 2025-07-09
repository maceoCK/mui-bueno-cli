import chalk from 'chalk';
import ora from 'ora';
import { ConfigManager } from '../utils/config.js';
import { GitService } from '../services/git/git-service.js';

interface SearchOptions {
  branch?: string;
  limit?: number;
}

export async function searchCommand(query: string, options: SearchOptions = {}): Promise<void> {
  if (!query) {
    console.log(chalk.red('Please provide a search query.'));
    return;
  }

  const spinner = ora('Searching components...').start();
  try {
    const configManager = new ConfigManager();
    const config = await configManager.load();
    const gitService = new GitService(config.git, config.cacheDir);

    const components = await gitService.listComponents(options.branch);

    const matches = components.filter(c => c.name.toLowerCase().includes(query.toLowerCase()));

    spinner.stop();

    if (matches.length === 0) {
      console.log(chalk.yellow(`No components found matching "${query}".`));
      return;
    }

    const list = options.limit ? matches.slice(0, options.limit) : matches;

    console.log(chalk.blue(`Found ${matches.length} component${matches.length === 1 ? '' : 's'} matching "${query}"${options.limit ? ` (showing ${list.length})` : ''}:\n`));
    list.forEach((comp, idx) => {
      console.log(`${chalk.dim(`${idx + 1}.`)} ${chalk.bold(comp.name)}`);
    });
  } catch (error) {
    spinner.fail('Search failed');
    console.error(error);
  }
} 