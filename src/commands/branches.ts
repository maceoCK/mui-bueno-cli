import chalk from 'chalk';
import ora from 'ora';
import { ConfigManager } from '../utils/config.js';
import { GitService } from '../services/git/git-service.js';

export async function branchesCommand(): Promise<void> {
  const spinner = ora('Fetching branches and tags...').start();
  try {
    const configManager = new ConfigManager();
    const config = await configManager.load();
    const gitService = new GitService(config.git, config.cacheDir);

    const gitInfo = await gitService.getGitInfo();

    spinner.stop();

    console.log(chalk.blue('\nBranches:'));
    gitInfo.availableBranches.forEach(branch => {
      const prefix = branch === gitInfo.currentBranch ? chalk.green('*') : ' ';
      console.log(`${prefix} ${branch}`);
    });

    if (gitInfo.availableTags.length) {
      console.log(chalk.blue('\nTags:'));
      gitInfo.availableTags.forEach(tag => console.log(`  ${tag}`));
    }

    console.log(chalk.dim(`\nCurrent branch: ${gitInfo.currentBranch}`));
    console.log(chalk.dim(`Latest commit: ${gitInfo.latestCommit}`));
  } catch (error) {
    spinner.fail('Failed to fetch branches and tags');
    console.error(error);
  }
} 