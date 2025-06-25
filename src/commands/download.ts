import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { ConfigManager } from '../utils/config.js';
import { GitService } from '../services/git-service.js';
import { DownloadOptions, Component } from '../types/index.js';

export async function downloadCommand(componentName?: string, options: DownloadOptions = {}): Promise<void> {
  const spinner = ora('Initializing download...').start();
  
  try {
    // Load configuration
    const configManager = new ConfigManager();
    const config = await configManager.load();
    
    // Validate configuration
    const configValidation = await configManager.validateConfig();
    if (!configValidation.valid) {
      spinner.fail('Configuration is invalid');
      console.error(chalk.red('Configuration errors:'));
      configValidation.errors.forEach(error => console.error(chalk.red(`  - ${error}`)));
      console.log(chalk.yellow('\nRun "mui-bueno init" to fix configuration issues.'));
      return;
    }

    // Initialize git service
    const gitService = new GitService(config.git, config.cacheDir);

    // Test git connection
    spinner.text = 'Testing SSH connection to repository...';
    const isConnected = await gitService.testConnection();
    
    if (!isConnected) {
      spinner.fail('Failed to connect to git repository');
      console.error(chalk.red('Please ensure you have SSH access to the repository and try again.'));
      console.error(chalk.red('Run "ssh -T git@bitbucket.org" to test your SSH connection.'));
      return;
    }

    // Ensure repository cache is up to date
    spinner.text = 'Updating repository cache...';
    await gitService.ensureRepositoryCache();

    let targetComponent = componentName;
    let targetVersion = options.version || options.branch || options.commit;

    // If no component specified, let user search and select
    if (!targetComponent) {
      spinner.text = 'Fetching available components...';
      const components = await gitService.listComponents(options.branch);
      
      if (components.length === 0) {
        spinner.fail('No components found in the repository');
        return;
      }

      spinner.stop();

      console.log(chalk.blue(`Found ${components.length} components:\n`));
      components.forEach((comp, index) => {
        console.log(`${chalk.dim(`${index + 1}.`)} ${chalk.bold(comp.name)} ${chalk.dim(`(${comp.versions.length} versions)`)}`);
      });
      console.log();

      const { selectedComponent } = await inquirer.prompt([
        {
          type: 'list',
          name: 'selectedComponent',
          message: 'Select a component to download:',
          choices: [
            { name: chalk.dim('🔍 Search components...'), value: '__search__' },
            new inquirer.Separator(),
            ...components.map(c => ({
              name: `${c.name} (${c.versions.length} versions available)`,
              value: c.name,
              short: c.name
            }))
          ],
          pageSize: 15
        }
      ]);

      if (selectedComponent === '__search__') {
        const { searchQuery } = await inquirer.prompt([
          {
            type: 'input',
            name: 'searchQuery',
            message: 'Enter search term:'
          }
        ]);

        const filteredComponents = components.filter(c => 
          c.name.toLowerCase().includes(searchQuery.toLowerCase())
        );

        if (filteredComponents.length === 0) {
          console.log(chalk.yellow(`No components found matching "${searchQuery}"`));
          return;
        }

        const { selectedFromSearch } = await inquirer.prompt([
          {
            type: 'list',
            name: 'selectedFromSearch',
            message: `Found ${filteredComponents.length} matching component(s):`,
            choices: filteredComponents.map(c => ({
              name: `${c.name} (${c.versions.length} versions available)`,
              value: c.name,
              short: c.name
            }))
          }
        ]);

        targetComponent = selectedFromSearch;
      } else {
        targetComponent = selectedComponent;
      }
    }

    if (!targetComponent) {
      console.log(chalk.yellow('No component selected for download.'));
      return;
    }

    // If no version specified, let user choose
    if (!targetVersion) {
      spinner.start('Fetching available versions...');
      const gitInfo = await gitService.getGitInfo();
      spinner.stop();

      const versionChoices = [
        ...gitInfo.availableTags.map(tag => ({ name: `${tag} (tag)`, value: tag })),
        ...gitInfo.availableBranches.map(branch => ({ name: `${branch} (branch)`, value: branch }))
      ];

      if (versionChoices.length > 0) {
        const { selectedVersion } = await inquirer.prompt([
          {
            type: 'list',
            name: 'selectedVersion',
            message: 'Select a version to download:',
            choices: [
              { name: 'Latest (current branch)', value: undefined },
              new inquirer.Separator(),
              ...versionChoices
            ]
          }
        ]);

        targetVersion = selectedVersion;
      }
    }

    // Determine output directory
    const outputDir = options.outputDir || config.defaultDownloadPath || './components';

    // Check if component already exists
    const componentPath = path.join(outputDir, targetComponent);
    if (await fs.pathExists(componentPath) && !options.force) {
      const { overwrite } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'overwrite',
          message: `Component "${targetComponent}" already exists. Overwrite?`,
          default: false
        }
      ]);

      if (!overwrite) {
        console.log(chalk.yellow('Download cancelled.'));
        return;
      }
    }

    // Download component
    const downloadSpinner = ora(`Analyzing and downloading ${targetComponent}${targetVersion ? `@${targetVersion}` : ''}...`).start();
    
    try {
      downloadSpinner.stop();
      console.log(chalk.blue(`\n📦 Downloading ${targetComponent}${targetVersion ? `@${targetVersion}` : ''} and dependencies...\n`));
      
      const extractedPath = await gitService.downloadComponent(
        targetComponent, 
        targetVersion, 
        outputDir
      );

      console.log(chalk.green(`\n✅ ${targetComponent}${targetVersion ? `@${targetVersion}` : ''} and all dependencies downloaded successfully!`));
      console.log(chalk.dim(`   Main component location: ${extractedPath}`));

      // Post-download processing
      if (!options.includeTests) {
        await removeTestFiles(extractedPath);
      }

      if (!options.includeStories) {
        await removeStoryFiles(extractedPath);
      }

      // Show component info
      await showComponentInfo(extractedPath, targetVersion);

      // Install dependencies if requested
      if (options.installDeps) {
        await installComponentDependencies(extractedPath, options.packageManager || 'pnpm');
      }

    } catch (error) {
      downloadSpinner.fail(`Failed to download ${targetComponent}`);
      console.error(chalk.red(`Error: ${error}`));
    }

  } catch (error) {
    spinner.fail('Download failed');
    console.error(chalk.red(`Error: ${error}`));
    process.exit(1);
  }
}

async function removeTestFiles(componentPath: string): Promise<void> {
  try {
    const files = await fs.readdir(componentPath, { withFileTypes: true });
    for (const file of files) {
      if (file.isFile() && (file.name.includes('.test.') || file.name.includes('.spec.'))) {
        await fs.remove(path.join(componentPath, file.name));
      }
    }
  } catch (error) {
    console.warn(chalk.yellow(`Warning: Could not remove test files: ${error}`));
  }
}

async function removeStoryFiles(componentPath: string): Promise<void> {
  try {
    const files = await fs.readdir(componentPath, { withFileTypes: true });
    for (const file of files) {
      if (file.isFile() && file.name.includes('.stories.')) {
        await fs.remove(path.join(componentPath, file.name));
      }
    }
  } catch (error) {
    console.warn(chalk.yellow(`Warning: Could not remove story files: ${error}`));
  }
}

async function showComponentInfo(componentPath: string, version?: string): Promise<void> {
  try {
    // Look for the main component file
    const files = await fs.readdir(componentPath);
    const mainComponentFile = files.find(file => 
      file.endsWith('.tsx') && !file.includes('.stories.') && !file.includes('.test.')
    );

    if (mainComponentFile) {
      const componentName = path.basename(componentPath);
      
      console.log(chalk.blue('\nComponent Information:'));
      console.log(`  Name: ${componentName}`);
      if (version) {
        console.log(`  Version: ${version}`);
      }
      console.log(`  Main file: ${mainComponentFile}`);
      
      // Try to extract component info from files
      const componentContent = await fs.readFile(path.join(componentPath, mainComponentFile), 'utf8');
      
      // Look for exports
      const exportMatches = componentContent.match(/export\s+(?:const|function|class)\s+(\w+)/g);
      if (exportMatches) {
        const exports = exportMatches.map(match => match.replace(/export\s+(?:const|function|class)\s+/, ''));
        console.log(`  Exports: ${exports.join(', ')}`);
      }

      // Check for dependencies in the component file
      const importMatches = componentContent.match(/import\s+.*?\s+from\s+['"]([^'"]+)['"]/g);
      if (importMatches) {
        const dependencies = importMatches
          .map(match => match.match(/from\s+['"]([^'"]+)['"]/)?.[1])
          .filter(dep => dep && !dep.startsWith('.') && !dep.startsWith('/'))
          .filter((dep, index, arr) => arr.indexOf(dep) === index);
        
        if (dependencies.length > 0) {
          console.log(chalk.blue('\nDependencies found in component:'));
          dependencies.forEach(dep => {
            console.log(`  ${dep}`);
          });
        }
      }

      // Usage example
      const mainExport = mainComponentFile.replace('.tsx', '');
      console.log(chalk.blue('\nUsage:'));
      console.log(chalk.gray(`  import { ${mainExport} } from './${componentName}/${mainComponentFile.replace('.tsx', '')}';`));
    }
  } catch (error) {
    console.warn(chalk.yellow(`Warning: Could not read component info: ${error}`));
  }
}

// Install dependencies for a specific component
async function installComponentDependencies(componentPath: string, packageManager: string): Promise<void> {
  try {
    // Look for package.json or component metadata
    const packageJsonPath = path.join(componentPath, 'package.json');
    let dependencies: Map<string, string> = new Map();
    let peerDependencies: Map<string, string> = new Map();

    if (await fs.pathExists(packageJsonPath)) {
      const packageJson = await fs.readJson(packageJsonPath);
      
      if (packageJson.dependencies) {
        Object.entries(packageJson.dependencies).forEach(([name, version]) => {
          dependencies.set(name, version as string);
        });
      }

      if (packageJson.peerDependencies) {
        Object.entries(packageJson.peerDependencies).forEach(([name, version]) => {
          peerDependencies.set(name, version as string);
        });
      }
    } else {
      // Try to extract dependencies from the component files
      const extractedDeps = await extractDependenciesFromFiles(componentPath);
      extractedDeps.forEach(dep => dependencies.set(dep, 'latest'));
    }

    const totalDeps = dependencies.size + peerDependencies.size;

    if (totalDeps === 0) {
      console.log(chalk.yellow('No dependencies found for this component.'));
      return;
    }

    console.log(chalk.blue(`\n📦 Found ${totalDeps} dependencies:`));
    
    if (dependencies.size > 0) {
      console.log(chalk.blue('Dependencies:'));
      Array.from(dependencies.entries()).forEach(([name, version]) => {
        console.log(chalk.dim(`  ${name}@${version}`));
      });
    }

    if (peerDependencies.size > 0) {
      console.log(chalk.blue('Peer Dependencies:'));
      Array.from(peerDependencies.entries()).forEach(([name, version]) => {
        console.log(chalk.dim(`  ${name}@${version}`));
      });
    }

    // Ask for confirmation
    const { shouldInstall } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'shouldInstall',
        message: `Install ${totalDeps} dependencies using ${packageManager}?`,
        default: true
      }
    ]);

    if (!shouldInstall) {
      console.log(chalk.yellow('Dependency installation cancelled.'));
      return;
    }

    // Install dependencies
    await installDependencies(dependencies, peerDependencies, packageManager);

  } catch (error) {
    console.warn(chalk.yellow(`Warning: Could not install dependencies: ${error}`));
  }
}

async function extractDependenciesFromFiles(componentPath: string): Promise<string[]> {
  try {
    const files = await fs.readdir(componentPath);
    const dependencies = new Set<string>();

    for (const file of files) {
      if (file.endsWith('.tsx') || file.endsWith('.ts')) {
        const content = await fs.readFile(path.join(componentPath, file), 'utf8');
        const importMatches = content.match(/import\s+.*?\s+from\s+['"]([^'"]+)['"]/g);
        
        if (importMatches) {
          importMatches.forEach(match => {
            const dep = match.match(/from\s+['"]([^'"]+)['"]/)?.[1];
            if (dep && !dep.startsWith('.') && !dep.startsWith('/')) {
              // Extract package name (handle scoped packages)
              const packageName = dep.startsWith('@') ? dep.split('/').slice(0, 2).join('/') : dep.split('/')[0];
              dependencies.add(packageName);
            }
          });
        }
      }
    }

    return Array.from(dependencies);
  } catch (error) {
    return [];
  }
}

// Helper function to install dependencies using the specified package manager
async function installDependencies(
  dependencies: Map<string, string>,
  peerDependencies: Map<string, string>,
  packageManager: string
): Promise<void> {
  const { spawn } = await import('child_process');

  const allDeps = new Map([...dependencies, ...peerDependencies]);
  const depsList = Array.from(allDeps.entries()).map(([name, version]) => 
    version === 'latest' || version === '*' ? name : `${name}@${version}`
  );

  if (depsList.length === 0) {
    return;
  }

  console.log(chalk.blue(`\n🔧 Installing dependencies with ${packageManager}...\n`));

  let installCommand: string;
  let installArgs: string[];

  switch (packageManager) {
    case 'pnpm':
      installCommand = 'pnpm';
      installArgs = ['add', ...depsList];
      break;
    case 'yarn':
      installCommand = 'yarn';
      installArgs = ['add', ...depsList];
      break;
    case 'npm':
    default:
      installCommand = 'npm';
      installArgs = ['install', ...depsList];
      break;
  }

  return new Promise<void>((resolve, reject) => {
    const child = spawn(installCommand, installArgs, {
      stdio: 'inherit',
      shell: true
    });

    child.on('close', (code) => {
      if (code === 0) {
        console.log(chalk.green('\n✅ Dependencies installed successfully!'));
        resolve();
      } else {
        console.log(chalk.red('\n❌ Failed to install dependencies.'));
        reject(new Error(`${packageManager} install failed with code ${code}`));
      }
    });

    child.on('error', (error) => {
      console.log(chalk.red('\n❌ Failed to install dependencies:'), error.message);
      reject(error);
    });
  });
} 