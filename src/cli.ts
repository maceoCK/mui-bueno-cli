#!/usr/bin/env node

import { Command } from 'commander';
import { initCommand } from './commands/init.js';
import { downloadCommand } from './commands/download.js';
import { listCommand } from './commands/list.js';
import { searchCommand } from './commands/search.js';
import { branchesCommand } from './commands/branches.js';
import { configCommand } from './commands/config.js';
import { cacheCommand } from './commands/cache.js';
import { version } from '../package.json';

const program = new Command();

program
  .name('mui-bueno')
  .description('CLI tool for downloading and managing MUI Bueno components')
  .version(version);

program
  .command('init')
  .description('Initialize configuration for MUI Bueno')
  .action(initCommand);

program
  .command('download [component]')
  .description('Download a component and its dependencies')
  .option('-b, --branch <branch>', 'Specify a branch to download from')
  .option('-v, --version <version>', 'Specify a version (tag) to download')
  .option('-c, --commit <commit>', 'Specify a commit hash to download')
  .option('-o, --output-dir <dir>', 'Specify output directory')
  .option('-f, --force', 'Force overwrite if component already exists')
  .option('--no-tests', 'Exclude test files')
  .option('--include-stories', 'Include story files')
  .option('--install-deps', 'Install dependencies after download')
  .option('--package-manager <manager>', 'Package manager to use for installing dependencies (npm, yarn, or pnpm)')
  .action(downloadCommand);

program
  .command('list')
  .alias('ls')
  .description('List available components in the repository')
  .option('-b, --branch <branch>', 'Specify branch to list from')
  .option('-l, --limit <number>', 'Limit number of components listed', (val) => parseInt(val, 10))
  .action(listCommand);

program
  .command('search <query>')
  .description('Search for components')
  .option('-b, --branch <branch>', 'Specify branch to search')
  .option('-l, --limit <number>', 'Limit number of results', (val) => parseInt(val, 10))
  .action(searchCommand);

program
  .command('branches')
  .description('List available branches and tags')
  .action(branchesCommand);

program
  .command('config')
  .description('Manage CLI configuration')
  .option('-r, --reset', 'Reset/delete existing configuration')
  .option('-e, --edit', 'Edit configuration interactively')
  .action(configCommand);

program
  .command('cache')
  .description('Manage local repository cache')
  .option('-c, --clear', 'Clear repository cache')
  .action(cacheCommand);

program.parse(); 