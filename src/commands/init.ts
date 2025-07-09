import chalk from 'chalk';
import inquirer from 'inquirer';
import { ConfigManager } from '../utils/config.js';
import { GitService } from '../services/git/git-service.js';
import { GitConfig } from '../types/index.js';

interface InitOptions {
  installDeps?: boolean;
  packageManager?: string;
}

export async function initCommand(options: InitOptions = {}): Promise<void> {
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
    console.log(chalk.yellow('Run "ssh -T git@bitbucket.org" to test your SSH connection.'));
    console.log(chalk.yellow('Make sure your SSH key is added to your GitHub account.'));
  }

  console.log(chalk.green('\n✨ MUI Bueno CLI is ready to use!'));
  console.log(chalk.dim('\nNext steps:'));
  console.log(chalk.dim('  • Run "mui-bueno download <component>" to download components'));
}

async function setupConfiguration(configManager: ConfigManager): Promise<void> {
  console.log(chalk.blue('Git Repository Configuration:\n'));

  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'repositoryUrl',
      message: 'Git repository URL:',
      default: 'git@bitbucket.org:obp-dashboard/mui-bueno-v2.git',
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