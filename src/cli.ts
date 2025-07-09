#!/usr/bin/env node

import { Command } from 'commander';
import { initCommand } from './commands/init.js';
import { downloadCommand } from './commands/download.js';
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

program.parse(); 