#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { ConfigManager } from './utils/config.js';
import { GitService } from './services/git-service.js';
import { downloadCommand } from './commands/download.js';
import { GitConfig } from './types/index.js';

const program = new Command();

program
  .name('mui-bueno')
  .description('CLI tool for managing MUI Bueno components from git repository')
  .version('1.0.0');

// Download command
program
  .command('download')
  .description('Download components from the git repository')
  .argument('[name]', 'Name of the component to download')
  .option('-v, --version <version>', 'Specific version/tag to download')
  .option('-b, --branch <branch>', 'Specific branch to download from')
  .option('-c, --commit <commit>', 'Specific commit to download')
  .option('-o, --output-dir <dir>', 'Output directory for downloaded components')
  .option('-f, --force', 'Overwrite existing components without confirmation')
  .option('--include-tests', 'Include test files in download')
  .option('--include-stories', 'Include Storybook files in download')
  .option('--install-deps', 'Install component dependencies after download')
  .option('--package-manager <manager>', 'Package manager to use for dependencies (npm, pnpm, yarn)', 'pnpm')
  .action(async (name, options) => {
    try {
      await downloadCommand(name, options);
    } catch (error) {
      console.error(chalk.red(`Download failed: ${error}`));
      process.exit(1);
    }
  });

// List command
program
  .command('list')
  .alias('ls')
  .description('List available components in the repository')
  .option('-b, --branch <branch>', 'List components from a specific branch')
  .option('-l, --limit <limit>', 'Limit number of results', '50')
  .action(async (options) => {
    try {
      await listCommand(options);
    } catch (error) {
      console.error(chalk.red(`List failed: ${error}`));
      process.exit(1);
    }
  });

// Search command
program
  .command('search')
  .description('Search for components')
  .argument('<query>', 'Search query')
  .option('-b, --branch <branch>', 'Search in a specific branch')
  .action(async (query, options) => {
    try {
      await searchCommand(query, options);
    } catch (error) {
      console.error(chalk.red(`Search failed: ${error}`));
      process.exit(1);
    }
  });

// Config command
program
  .command('config')
  .description('Manage CLI configuration')
  .option('--reset', 'Reset configuration to defaults')
  .option('--show', 'Show current configuration')
  .action(async (options) => {
    try {
      await configCommand(options);
    } catch (error) {
      console.error(chalk.red(`Config failed: ${error}`));
      process.exit(1);
    }
  });

// Init command
program
  .command('init')
  .description('Initialize MUI Bueno CLI with git repository access')
  .option('--install-deps', 'Install all dependencies from available components')
  .option('--package-manager <manager>', 'Package manager to use (npm, pnpm, yarn)', 'pnpm')
  .action(async (options) => {
    try {
      await initCommand(options);
    } catch (error) {
      console.error(chalk.red(`Init failed: ${error}`));
      process.exit(1);
    }
  });

// Branches command
program
  .command('branches')
  .description('List available branches and tags')
  .action(async () => {
    try {
      await branchesCommand();
    } catch (error) {
      console.error(chalk.red(`Branches command failed: ${error}`));
      process.exit(1);
    }
  });

// Cache command
program
  .command('cache')
  .description('Manage local repository cache')
  .option('--clear', 'Clear the local repository cache')
  .action(async (options) => {
    try {
      await cacheCommand(options);
    } catch (error) {
      console.error(chalk.red(`Cache command failed: ${error}`));
      process.exit(1);
    }
  });

// List command implementation
async function listCommand(options: { branch?: string; limit: string }) {
  const configManager = new ConfigManager();
  const config = await configManager.load();
  
  // Validate git access
  const gitService = new GitService(config.git, config.cacheDir);
  const isConnected = await gitService.testConnection();
  
  if (!isConnected) {
    console.error(chalk.red('Cannot access git repository. Please ensure you have SSH access.'));
    console.error(chalk.red('Run "ssh -T git@github.com" to test your SSH connection.'));
    return;
  }

  console.log(chalk.blue('Fetching components from repository...'));
  
  const components = await gitService.listComponents(options.branch);

  const limit = parseInt(options.limit);
  const displayComponents = components.slice(0, limit);

  if (displayComponents.length === 0) {
    console.log(chalk.yellow('No components found.'));
    return;
  }

  console.log(chalk.green(`\nFound ${components.length} component(s)${options.branch ? ` in branch "${options.branch}"` : ''}:\n`));

  displayComponents.forEach(component => {
    console.log(chalk.bold(component.name));
    console.log(chalk.dim(`  Versions: ${component.versions.length} available`));
    if (component.branches.length > 0) {
      console.log(chalk.dim(`  Branches: ${component.branches.slice(0, 3).join(', ')}${component.branches.length > 3 ? '...' : ''}`));
    }
    if (component.tags.length > 0) {
      console.log(chalk.dim(`  Tags: ${component.tags.slice(0, 3).join(', ')}${component.tags.length > 3 ? '...' : ''}`));
    }
    console.log();
  });

  if (components.length > limit) {
    console.log(chalk.dim(`... and ${components.length - limit} more. Use --limit to see more.`));
  }
}

// Search command implementation
async function searchCommand(query: string, options: { branch?: string }) {
  const configManager = new ConfigManager();
  const config = await configManager.load();
  const gitService = new GitService(config.git, config.cacheDir);

  console.log(chalk.blue(`Searching for "${query}"${options.branch ? ` in branch "${options.branch}"` : ''}...`));
  
  const components = await gitService.listComponents(options.branch);
  
  // Simple search - filter by name
  const filteredComponents = components.filter(component => 
    component.name.toLowerCase().includes(query.toLowerCase())
  );

  if (filteredComponents.length === 0) {
    console.log(chalk.yellow('No components found matching your search.'));
    return;
  }

  console.log(chalk.green(`\nFound ${filteredComponents.length} matching component(s):\n`));

  filteredComponents.forEach(component => {
    console.log(chalk.bold(component.name));
    console.log(chalk.dim(`  Versions: ${component.versions.length} available`));
    console.log();
  });
}

// Config command implementation
async function configCommand(options: { reset?: boolean; show?: boolean }) {
  const configManager = new ConfigManager();

  if (options.reset) {
    await configManager.reset();
    console.log(chalk.green('Configuration reset to defaults.'));
    return;
  }

  if (options.show) {
    const config = await configManager.load();
    console.log(chalk.blue('Current Configuration:'));
    console.log(JSON.stringify(config, null, 2));
    return;
  }

  // Interactive configuration setup
  await setupConfiguration(configManager);
}

// Branches command implementation
async function branchesCommand() {
  const configManager = new ConfigManager();
  const config = await configManager.load();
  const gitService = new GitService(config.git, config.cacheDir);

  console.log(chalk.blue('Fetching git information...'));
  
  try {
    const gitInfo = await gitService.getGitInfo();
    
    console.log(chalk.green(`\nCurrent branch: ${gitInfo.currentBranch}`));
    console.log(chalk.green(`Latest commit: ${gitInfo.latestCommit.substring(0, 8)}`));
    
    if (gitInfo.availableBranches.length > 0) {
      console.log(chalk.blue('\nAvailable branches:'));
      gitInfo.availableBranches.forEach(branch => {
        console.log(`  ${branch}`);
      });
    }
    
    if (gitInfo.availableTags.length > 0) {
      console.log(chalk.blue('\nAvailable tags (latest 10):'));
      gitInfo.availableTags.forEach(tag => {
        console.log(`  ${tag}`);
      });
    }
  } catch (error) {
    console.error(chalk.red(`Failed to get git information: ${error}`));
  }
}

// Cache command implementation
async function cacheCommand(options: { clear?: boolean }) {
  const configManager = new ConfigManager();
  const config = await configManager.load();
  const gitService = new GitService(config.git, config.cacheDir);

  if (options.clear) {
    console.log(chalk.blue('Clearing repository cache...'));
    await gitService.clearCache();
    console.log(chalk.green('Cache cleared successfully.'));
    return;
  }

  console.log(chalk.blue('Cache information:'));
  console.log(`Cache directory: ${config.cacheDir}`);
}

// Install dependencies from all available components
async function installComponentDependencies(configManager: ConfigManager, packageManager: string) {
  console.log(chalk.blue('\n📦 Analyzing component dependencies...\n'));

  const config = await configManager.load();
  const gitService = new GitService(config.git, config.cacheDir);
  
  // Get all components
  const components = await gitService.listComponents();
  
  if (components.length === 0) {
    console.log(chalk.yellow('No components found in the repository.'));
    return;
  }

  console.log(chalk.green(`Found ${components.length} components in repository.`));
  console.log(chalk.yellow('Note: Dependency analysis from git repository is limited.'));
  console.log(chalk.yellow('Consider downloading specific components to install their dependencies.'));
}

// Init command implementation
async function initCommand(options: { installDeps?: boolean; packageManager?: string } = {}) {
  console.log(chalk.blue('🚀 Initializing MUI Bueno CLI...\n'));

  const configManager = new ConfigManager();
  const hasConfig = await configManager.exists();

  if (!hasConfig) {
    console.log(chalk.yellow('No configuration found. Let\'s set it up!\n'));
    await setupConfiguration(configManager);
  } else {
    console.log(chalk.green('✓ Configuration already exists.'));
    
    const { reconfigure } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'reconfigure',
        message: 'Would you like to reconfigure?',
        default: false
      }
    ]);

    if (reconfigure) {
      await setupConfiguration(configManager);
    }
  }

  // Test git connection
  const config = await configManager.load();
  const gitService = new GitService(config.git, config.cacheDir);
  
  console.log(chalk.blue('\n🔐 Testing SSH connection to repository...'));
  const isConnected = await gitService.testConnection();

  if (isConnected) {
    console.log(chalk.green('✓ SSH connection successful!'));
  } else {
    console.log(chalk.red('❌ SSH connection failed.'));
    console.log(chalk.yellow('Please ensure you have SSH access to the repository.'));
    console.log(chalk.yellow('Run "ssh -T git@github.com" to test your SSH connection.'));
    console.log(chalk.yellow('Make sure your SSH key is added to your GitHub account.'));
  }

  // Handle dependency installation
  if (options.installDeps) {
    await installComponentDependencies(configManager, options.packageManager || 'pnpm');
  }

  console.log(chalk.green('\n✨ MUI Bueno CLI is ready to use!'));
  console.log(chalk.dim('\nNext steps:'));
  console.log(chalk.dim('  • Run "mui-bueno list" to see available components'));
  console.log(chalk.dim('  • Run "mui-bueno download <component>" to download components'));
  console.log(chalk.dim('  • Run "mui-bueno branches" to see available branches and tags'));
  console.log(chalk.dim('  • Run "mui-bueno search <query>" to search for components'));
}

// Configuration setup helper
async function setupConfiguration(configManager: ConfigManager) {
  console.log(chalk.blue('Git Repository Configuration:\n'));

  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'repositoryUrl',
      message: 'Git repository URL:',
      default: 'git@github.com:owner/mui-bueno-v2.git',
      validate: (input) => {
        if (!input.trim()) return 'Repository URL is required';
        if (!input.includes('git@') && !input.includes('https://')) {
          return 'Please provide a valid git URL (SSH or HTTPS)';
        }
        return true;
      }
    },
    {
      type: 'input',
      name: 'branch',
      message: 'Default branch:',
      default: 'main',
      validate: (input) => input.trim() !== '' || 'Branch is required'
    },
    {
      type: 'input',
      name: 'sshKeyPath',
      message: 'SSH key path (optional, leave empty for default):',
      default: ''
    }
  ]);

  const generalAnswers = await inquirer.prompt([
    {
      type: 'input',
      name: 'author',
      message: 'Your name (for attribution):',
      default: 'anonymous'
    },
    {
      type: 'input',
      name: 'defaultDownloadPath',
      message: 'Default download path:',
      default: './components'
    }
  ]);

  const gitConfig: GitConfig = {
    repositoryUrl: answers.repositoryUrl,
    branch: answers.branch,
    sshKeyPath: answers.sshKeyPath || undefined,
    username: generalAnswers.author
  };

  const config = {
    git: gitConfig,
    author: generalAnswers.author,
    defaultDownloadPath: generalAnswers.defaultDownloadPath,
    workspace: process.cwd(),
    cacheDir: require('path').join(require('os').homedir(), '.mui-bueno-cache')
  };

  await configManager.save(config);
  console.log(chalk.green('\n✓ Configuration saved successfully!'));
}

// Parse arguments and execute
program.parse();

export default program; 