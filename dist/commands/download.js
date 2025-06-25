"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.downloadCommand = downloadCommand;
const fs_extra_1 = __importDefault(require("fs-extra"));
const path_1 = __importDefault(require("path"));
const chalk_1 = __importDefault(require("chalk"));
const ora_1 = __importDefault(require("ora"));
const inquirer_1 = __importDefault(require("inquirer"));
const config_js_1 = require("../utils/config.js");
const git_service_js_1 = require("../services/git-service.js");
async function downloadCommand(componentName, options = {}) {
    const spinner = (0, ora_1.default)('Initializing download...').start();
    try {
        // Load configuration
        const configManager = new config_js_1.ConfigManager();
        const config = await configManager.load();
        // Validate configuration
        const configValidation = await configManager.validateConfig();
        if (!configValidation.valid) {
            spinner.fail('Configuration is invalid');
            console.error(chalk_1.default.red('Configuration errors:'));
            configValidation.errors.forEach(error => console.error(chalk_1.default.red(`  - ${error}`)));
            console.log(chalk_1.default.yellow('\nRun "mui-bueno init" to fix configuration issues.'));
            return;
        }
        // Initialize git service
        const gitService = new git_service_js_1.GitService(config.git, config.cacheDir);
        // Test git connection
        spinner.text = 'Testing SSH connection to repository...';
        const isConnected = await gitService.testConnection();
        if (!isConnected) {
            spinner.fail('Failed to connect to git repository');
            console.error(chalk_1.default.red('Please ensure you have SSH access to the repository and try again.'));
            console.error(chalk_1.default.red('Run "ssh -T git@github.com" to test your SSH connection.'));
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
            console.log(chalk_1.default.blue(`Found ${components.length} components:\n`));
            components.forEach((comp, index) => {
                console.log(`${chalk_1.default.dim(`${index + 1}.`)} ${chalk_1.default.bold(comp.name)} ${chalk_1.default.dim(`(${comp.versions.length} versions)`)}`);
            });
            console.log();
            const { selectedComponent } = await inquirer_1.default.prompt([
                {
                    type: 'list',
                    name: 'selectedComponent',
                    message: 'Select a component to download:',
                    choices: [
                        { name: chalk_1.default.dim('🔍 Search components...'), value: '__search__' },
                        new inquirer_1.default.Separator(),
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
                const { searchQuery } = await inquirer_1.default.prompt([
                    {
                        type: 'input',
                        name: 'searchQuery',
                        message: 'Enter search term:'
                    }
                ]);
                const filteredComponents = components.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()));
                if (filteredComponents.length === 0) {
                    console.log(chalk_1.default.yellow(`No components found matching "${searchQuery}"`));
                    return;
                }
                const { selectedFromSearch } = await inquirer_1.default.prompt([
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
            }
            else {
                targetComponent = selectedComponent;
            }
        }
        if (!targetComponent) {
            console.log(chalk_1.default.yellow('No component selected for download.'));
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
                const { selectedVersion } = await inquirer_1.default.prompt([
                    {
                        type: 'list',
                        name: 'selectedVersion',
                        message: 'Select a version to download:',
                        choices: [
                            { name: 'Latest (current branch)', value: undefined },
                            new inquirer_1.default.Separator(),
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
        const componentPath = path_1.default.join(outputDir, targetComponent);
        if (await fs_extra_1.default.pathExists(componentPath) && !options.force) {
            const { overwrite } = await inquirer_1.default.prompt([
                {
                    type: 'confirm',
                    name: 'overwrite',
                    message: `Component "${targetComponent}" already exists. Overwrite?`,
                    default: false
                }
            ]);
            if (!overwrite) {
                console.log(chalk_1.default.yellow('Download cancelled.'));
                return;
            }
        }
        // Download component
        const downloadSpinner = (0, ora_1.default)(`Downloading ${targetComponent}${targetVersion ? `@${targetVersion}` : ''}...`).start();
        try {
            const extractedPath = await gitService.downloadComponent(targetComponent, targetVersion, outputDir);
            downloadSpinner.succeed(`${chalk_1.default.green('✓')} ${targetComponent}${targetVersion ? `@${targetVersion}` : ''} downloaded successfully`);
            console.log(chalk_1.default.dim(`  Location: ${extractedPath}`));
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
        }
        catch (error) {
            downloadSpinner.fail(`Failed to download ${targetComponent}`);
            console.error(chalk_1.default.red(`Error: ${error}`));
        }
    }
    catch (error) {
        spinner.fail('Download failed');
        console.error(chalk_1.default.red(`Error: ${error}`));
        process.exit(1);
    }
}
async function removeTestFiles(componentPath) {
    try {
        const files = await fs_extra_1.default.readdir(componentPath, { withFileTypes: true });
        for (const file of files) {
            if (file.isFile() && (file.name.includes('.test.') || file.name.includes('.spec.'))) {
                await fs_extra_1.default.remove(path_1.default.join(componentPath, file.name));
            }
        }
    }
    catch (error) {
        console.warn(chalk_1.default.yellow(`Warning: Could not remove test files: ${error}`));
    }
}
async function removeStoryFiles(componentPath) {
    try {
        const files = await fs_extra_1.default.readdir(componentPath, { withFileTypes: true });
        for (const file of files) {
            if (file.isFile() && file.name.includes('.stories.')) {
                await fs_extra_1.default.remove(path_1.default.join(componentPath, file.name));
            }
        }
    }
    catch (error) {
        console.warn(chalk_1.default.yellow(`Warning: Could not remove story files: ${error}`));
    }
}
async function showComponentInfo(componentPath, version) {
    try {
        // Look for the main component file
        const files = await fs_extra_1.default.readdir(componentPath);
        const mainComponentFile = files.find(file => file.endsWith('.tsx') && !file.includes('.stories.') && !file.includes('.test.'));
        if (mainComponentFile) {
            const componentName = path_1.default.basename(componentPath);
            console.log(chalk_1.default.blue('\nComponent Information:'));
            console.log(`  Name: ${componentName}`);
            if (version) {
                console.log(`  Version: ${version}`);
            }
            console.log(`  Main file: ${mainComponentFile}`);
            // Try to extract component info from files
            const componentContent = await fs_extra_1.default.readFile(path_1.default.join(componentPath, mainComponentFile), 'utf8');
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
                    console.log(chalk_1.default.blue('\nDependencies found in component:'));
                    dependencies.forEach(dep => {
                        console.log(`  ${dep}`);
                    });
                }
            }
            // Usage example
            const mainExport = mainComponentFile.replace('.tsx', '');
            console.log(chalk_1.default.blue('\nUsage:'));
            console.log(chalk_1.default.gray(`  import { ${mainExport} } from './${componentName}/${mainComponentFile.replace('.tsx', '')}';`));
        }
    }
    catch (error) {
        console.warn(chalk_1.default.yellow(`Warning: Could not read component info: ${error}`));
    }
}
// Install dependencies for a specific component
async function installComponentDependencies(componentPath, packageManager) {
    try {
        // Look for package.json or component metadata
        const packageJsonPath = path_1.default.join(componentPath, 'package.json');
        let dependencies = new Map();
        let peerDependencies = new Map();
        if (await fs_extra_1.default.pathExists(packageJsonPath)) {
            const packageJson = await fs_extra_1.default.readJson(packageJsonPath);
            if (packageJson.dependencies) {
                Object.entries(packageJson.dependencies).forEach(([name, version]) => {
                    dependencies.set(name, version);
                });
            }
            if (packageJson.peerDependencies) {
                Object.entries(packageJson.peerDependencies).forEach(([name, version]) => {
                    peerDependencies.set(name, version);
                });
            }
        }
        else {
            // Try to extract dependencies from the component files
            const extractedDeps = await extractDependenciesFromFiles(componentPath);
            extractedDeps.forEach(dep => dependencies.set(dep, 'latest'));
        }
        const totalDeps = dependencies.size + peerDependencies.size;
        if (totalDeps === 0) {
            console.log(chalk_1.default.yellow('No dependencies found for this component.'));
            return;
        }
        console.log(chalk_1.default.blue(`\n📦 Found ${totalDeps} dependencies:`));
        if (dependencies.size > 0) {
            console.log(chalk_1.default.blue('Dependencies:'));
            Array.from(dependencies.entries()).forEach(([name, version]) => {
                console.log(chalk_1.default.dim(`  ${name}@${version}`));
            });
        }
        if (peerDependencies.size > 0) {
            console.log(chalk_1.default.blue('Peer Dependencies:'));
            Array.from(peerDependencies.entries()).forEach(([name, version]) => {
                console.log(chalk_1.default.dim(`  ${name}@${version}`));
            });
        }
        // Ask for confirmation
        const { shouldInstall } = await inquirer_1.default.prompt([
            {
                type: 'confirm',
                name: 'shouldInstall',
                message: `Install ${totalDeps} dependencies using ${packageManager}?`,
                default: true
            }
        ]);
        if (!shouldInstall) {
            console.log(chalk_1.default.yellow('Dependency installation cancelled.'));
            return;
        }
        // Install dependencies
        await installDependencies(dependencies, peerDependencies, packageManager);
    }
    catch (error) {
        console.warn(chalk_1.default.yellow(`Warning: Could not install dependencies: ${error}`));
    }
}
async function extractDependenciesFromFiles(componentPath) {
    try {
        const files = await fs_extra_1.default.readdir(componentPath);
        const dependencies = new Set();
        for (const file of files) {
            if (file.endsWith('.tsx') || file.endsWith('.ts')) {
                const content = await fs_extra_1.default.readFile(path_1.default.join(componentPath, file), 'utf8');
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
    }
    catch (error) {
        return [];
    }
}
// Helper function to install dependencies using the specified package manager
async function installDependencies(dependencies, peerDependencies, packageManager) {
    const { spawn } = await Promise.resolve().then(() => __importStar(require('child_process')));
    const allDeps = new Map([...dependencies, ...peerDependencies]);
    const depsList = Array.from(allDeps.entries()).map(([name, version]) => version === 'latest' || version === '*' ? name : `${name}@${version}`);
    if (depsList.length === 0) {
        return;
    }
    console.log(chalk_1.default.blue(`\n🔧 Installing dependencies with ${packageManager}...\n`));
    let installCommand;
    let installArgs;
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
    return new Promise((resolve, reject) => {
        const child = spawn(installCommand, installArgs, {
            stdio: 'inherit',
            shell: true
        });
        child.on('close', (code) => {
            if (code === 0) {
                console.log(chalk_1.default.green('\n✅ Dependencies installed successfully!'));
                resolve();
            }
            else {
                console.log(chalk_1.default.red('\n❌ Failed to install dependencies.'));
                reject(new Error(`${packageManager} install failed with code ${code}`));
            }
        });
        child.on('error', (error) => {
            console.log(chalk_1.default.red('\n❌ Failed to install dependencies:'), error.message);
            reject(error);
        });
    });
}
//# sourceMappingURL=download.js.map