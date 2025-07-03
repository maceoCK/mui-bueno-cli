#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const chalk_1 = __importDefault(require("chalk"));
const inquirer_1 = __importDefault(require("inquirer"));
const config_js_1 = require("./utils/config.js");
const git_service_js_1 = require("./services/git-service.js");
const download_js_1 = require("./commands/download.js");
const program = new commander_1.Command();
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
    .option('--no-tests', 'Exclude test files from download (tests included by default)')
    .option('--include-stories', 'Include Storybook files in download (excluded by default)')
    .option('--install-deps', 'Install component dependencies after download')
    .option('--package-manager <manager>', 'Package manager to use for dependencies (npm, pnpm, yarn)', 'pnpm')
    .action(async (name, options) => {
    try {
        await (0, download_js_1.downloadCommand)(name, options);
    }
    catch (error) {
        console.error(chalk_1.default.red(`Download failed: ${error}`));
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
    }
    catch (error) {
        console.error(chalk_1.default.red(`List failed: ${error}`));
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
    }
    catch (error) {
        console.error(chalk_1.default.red(`Search failed: ${error}`));
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
    }
    catch (error) {
        console.error(chalk_1.default.red(`Config failed: ${error}`));
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
    }
    catch (error) {
        console.error(chalk_1.default.red(`Init failed: ${error}`));
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
    }
    catch (error) {
        console.error(chalk_1.default.red(`Branches command failed: ${error}`));
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
    }
    catch (error) {
        console.error(chalk_1.default.red(`Cache command failed: ${error}`));
        process.exit(1);
    }
});
// List command implementation
async function listCommand(options) {
    const configManager = new config_js_1.ConfigManager();
    const config = await configManager.load();
    // Validate git access
    const gitService = new git_service_js_1.GitService(config.git, config.cacheDir);
    const isConnected = await gitService.testConnection();
    if (!isConnected) {
        console.error(chalk_1.default.red('Cannot access git repository. Please ensure you have SSH access.'));
        console.error(chalk_1.default.red('Run "ssh -T git@bitbucket.org" to test your SSH connection.'));
        return;
    }
    console.log(chalk_1.default.blue('Fetching components from repository...'));
    const components = await gitService.listComponents(options.branch);
    const limit = parseInt(options.limit);
    const displayComponents = components.slice(0, limit);
    if (displayComponents.length === 0) {
        console.log(chalk_1.default.yellow('No components found.'));
        return;
    }
    console.log(chalk_1.default.green(`\nFound ${components.length} component(s)${options.branch ? ` in branch "${options.branch}"` : ''}:\n`));
    displayComponents.forEach(component => {
        console.log(chalk_1.default.bold(component.name));
        console.log(chalk_1.default.dim(`  Versions: ${component.versions.length} available`));
        if (component.branches.length > 0) {
            console.log(chalk_1.default.dim(`  Branches: ${component.branches.slice(0, 3).join(', ')}${component.branches.length > 3 ? '...' : ''}`));
        }
        if (component.tags.length > 0) {
            console.log(chalk_1.default.dim(`  Tags: ${component.tags.slice(0, 3).join(', ')}${component.tags.length > 3 ? '...' : ''}`));
        }
        console.log();
    });
    if (components.length > limit) {
        console.log(chalk_1.default.dim(`... and ${components.length - limit} more. Use --limit to see more.`));
    }
}
// Search command implementation
async function searchCommand(query, options) {
    const configManager = new config_js_1.ConfigManager();
    const config = await configManager.load();
    const gitService = new git_service_js_1.GitService(config.git, config.cacheDir);
    console.log(chalk_1.default.blue(`Searching for "${query}"${options.branch ? ` in branch "${options.branch}"` : ''}...`));
    const components = await gitService.listComponents(options.branch);
    // Simple search - filter by name
    const filteredComponents = components.filter(component => component.name.toLowerCase().includes(query.toLowerCase()));
    if (filteredComponents.length === 0) {
        console.log(chalk_1.default.yellow('No components found matching your search.'));
        return;
    }
    console.log(chalk_1.default.green(`\nFound ${filteredComponents.length} matching component(s):\n`));
    filteredComponents.forEach(component => {
        console.log(chalk_1.default.bold(component.name));
        console.log(chalk_1.default.dim(`  Versions: ${component.versions.length} available`));
        console.log();
    });
}
// Config command implementation
async function configCommand(options) {
    const configManager = new config_js_1.ConfigManager();
    if (options.reset) {
        await configManager.reset();
        console.log(chalk_1.default.green('Configuration reset to defaults.'));
        return;
    }
    if (options.show) {
        const config = await configManager.load();
        console.log(chalk_1.default.blue('Current Configuration:'));
        console.log(JSON.stringify(config, null, 2));
        return;
    }
    // Interactive configuration setup
    await setupConfiguration(configManager);
}
// Branches command implementation
async function branchesCommand() {
    const configManager = new config_js_1.ConfigManager();
    const config = await configManager.load();
    const gitService = new git_service_js_1.GitService(config.git, config.cacheDir);
    console.log(chalk_1.default.blue('Fetching git information...'));
    try {
        const gitInfo = await gitService.getGitInfo();
        console.log(chalk_1.default.green(`\nCurrent branch: ${gitInfo.currentBranch}`));
        console.log(chalk_1.default.green(`Latest commit: ${gitInfo.latestCommit.substring(0, 8)}`));
        if (gitInfo.availableBranches.length > 0) {
            console.log(chalk_1.default.blue('\nAvailable branches:'));
            gitInfo.availableBranches.forEach(branch => {
                console.log(`  ${branch}`);
            });
        }
        if (gitInfo.availableTags.length > 0) {
            console.log(chalk_1.default.blue('\nAvailable tags (latest 10):'));
            gitInfo.availableTags.forEach(tag => {
                console.log(`  ${tag}`);
            });
        }
    }
    catch (error) {
        console.error(chalk_1.default.red(`Failed to get git information: ${error}`));
    }
}
// Cache command implementation
async function cacheCommand(options) {
    const configManager = new config_js_1.ConfigManager();
    const config = await configManager.load();
    const gitService = new git_service_js_1.GitService(config.git, config.cacheDir);
    if (options.clear) {
        console.log(chalk_1.default.blue('Clearing repository cache...'));
        await gitService.clearCache();
        console.log(chalk_1.default.green('Cache cleared successfully.'));
        return;
    }
    console.log(chalk_1.default.blue('Cache information:'));
    console.log(`Cache directory: ${config.cacheDir}`);
}
// Install dependencies from all available components
async function installComponentDependencies(configManager, packageManager) {
    console.log(chalk_1.default.blue('\n📦 Analyzing component dependencies...\n'));
    const config = await configManager.load();
    const gitService = new git_service_js_1.GitService(config.git, config.cacheDir);
    // Get all components
    const components = await gitService.listComponents();
    if (components.length === 0) {
        console.log(chalk_1.default.yellow('No components found in the repository.'));
        return;
    }
    console.log(chalk_1.default.green(`Found ${components.length} components in repository.`));
    console.log(chalk_1.default.yellow('Note: Dependency analysis from git repository is limited.'));
    console.log(chalk_1.default.yellow('Consider downloading specific components to install their dependencies.'));
}
// Init command implementation
async function initCommand(options = {}) {
    console.log(chalk_1.default.blue('🚀 Initializing MUI Bueno CLI...\n'));
    const configManager = new config_js_1.ConfigManager();
    const hasConfig = await configManager.exists();
    if (!hasConfig) {
        console.log(chalk_1.default.yellow('No configuration found. Let\'s set it up!\n'));
        await setupConfiguration(configManager);
    }
    else {
        console.log(chalk_1.default.green('✓ Configuration already exists.'));
        const { reconfigure } = await inquirer_1.default.prompt([
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
    const gitService = new git_service_js_1.GitService(config.git, config.cacheDir);
    console.log(chalk_1.default.blue('\n🔐 Testing SSH connection to repository...'));
    const isConnected = await gitService.testConnection();
    if (isConnected) {
        console.log(chalk_1.default.green('✓ SSH connection successful!'));
    }
    else {
        console.log(chalk_1.default.red('❌ SSH connection failed.'));
        console.log(chalk_1.default.yellow('Please ensure you have SSH access to the repository.'));
        console.log(chalk_1.default.yellow('Run "ssh -T git@bitbucket.org" to test your SSH connection.'));
        console.log(chalk_1.default.yellow('Make sure your SSH key is added to your GitHub account.'));
    }
    // Handle dependency installation
    if (options.installDeps) {
        await installComponentDependencies(configManager, options.packageManager || 'pnpm');
    }
    console.log(chalk_1.default.green('\n✨ MUI Bueno CLI is ready to use!'));
    console.log(chalk_1.default.dim('\nNext steps:'));
    console.log(chalk_1.default.dim('  • Run "mui-bueno list" to see available components'));
    console.log(chalk_1.default.dim('  • Run "mui-bueno download <component>" to download components'));
    console.log(chalk_1.default.dim('  • Run "mui-bueno branches" to see available branches and tags'));
    console.log(chalk_1.default.dim('  • Run "mui-bueno search <query>" to search for components'));
}
// Configuration setup helper
async function setupConfiguration(configManager) {
    console.log(chalk_1.default.blue('Git Repository Configuration:\n'));
    const answers = await inquirer_1.default.prompt([
        {
            type: 'input',
            name: 'repositoryUrl',
            message: 'Git repository URL:',
            default: 'git@bitbucket.org:obp-dashboard/mui-bueno-v2.git',
            validate: (input) => {
                if (!input.trim())
                    return 'Repository URL is required';
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
    const generalAnswers = await inquirer_1.default.prompt([
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
    const gitConfig = {
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
    console.log(chalk_1.default.green('\n✓ Configuration saved successfully!'));
}
// Parse arguments and execute
program.parse();
exports.default = program;
