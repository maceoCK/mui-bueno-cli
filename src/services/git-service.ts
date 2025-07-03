import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import chalk from 'chalk';
import { GitConfig, GitInfo, ComponentInfo, Component } from '../types/index.js';

const execAsync = promisify(exec);

export class GitService {
  private config: GitConfig;
  private cacheDir: string;

  constructor(config: GitConfig, cacheDir?: string) {
    this.config = config;
    this.cacheDir = cacheDir || path.join(os.homedir(), '.mui-bueno-cache');
  }

  async testConnection(): Promise<boolean> {
    try {
      // Test SSH access to the repository
      const { stdout, stderr } = await execAsync(`ssh -T git@bitbucket.org`, {
        env: { ...process.env, GIT_SSH_COMMAND: this.getSSHCommand() }
      });
      
      // GitHub SSH test returns specific messages
      return stderr.includes('authenticated via ssh key.') || stdout.includes('authenticated via ssh key.');
    } catch (error: any) {
      // GitHub SSH test typically "fails" with exit code 1 but gives success message
      if (error.stderr && error.stderr.includes('authenticated via ssh key.')) {
        return true;
      }
      return false;
    }
  }

  async ensureRepositoryCache(): Promise<string> {
    const repoPath = path.join(this.cacheDir, 'mui-bueno-v2');
    
    if (await fs.pathExists(repoPath)) {
      // Update existing repository
      await this.updateRepository(repoPath);
    } else {
      // Clone repository
      await fs.ensureDir(this.cacheDir);
      await this.cloneRepository(repoPath);
    }
    
    return repoPath;
  }

  private async cloneRepository(targetPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const clone = spawn('git', ['clone', this.config.repositoryUrl, targetPath], {
        env: { ...process.env, GIT_SSH_COMMAND: this.getSSHCommand() },
        stdio: 'pipe'
      });

      clone.on('close', (code: number | null) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Git clone failed with exit code ${code}`));
        }
      });

      clone.on('error', reject);
    });
  }

  private async updateRepository(repoPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const fetch = spawn('git', ['fetch', '--all', '--tags'], {
        cwd: repoPath,
        env: { ...process.env, GIT_SSH_COMMAND: this.getSSHCommand() },
        stdio: 'pipe'
      });

      fetch.on('close', (code: number | null) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Git fetch failed with exit code ${code}`));
        }
      });

      fetch.on('error', reject);
    });
  }

  async getAvailableBranches(): Promise<string[]> {
    const repoPath = await this.ensureRepositoryCache();
    
    try {
      const { stdout } = await execAsync('git branch -r', { cwd: repoPath });
      return stdout
        .split('\n')
        .map((branch: string) => branch.trim().replace('origin/', ''))
        .filter((branch: string) => branch && !branch.includes('HEAD'))
        .sort();
    } catch (error) {
      return [];
    }
  }

  async getAvailableTags(): Promise<string[]> {
    const repoPath = await this.ensureRepositoryCache();
    
    try {
      const { stdout } = await execAsync('git tag --sort=-version:refname', { cwd: repoPath });
      return stdout.split('\n').filter((tag: string) => tag.trim()).slice(0, 10); // Latest 10 tags
    } catch (error) {
      return [];
    }
  }

  async getGitInfo(): Promise<GitInfo> {
    const repoPath = await this.ensureRepositoryCache();
    
    try {
      const { stdout: currentBranch } = await execAsync('git rev-parse --abbrev-ref HEAD', { cwd: repoPath });
      const { stdout: latestCommit } = await execAsync('git rev-parse HEAD', { cwd: repoPath });
      
      const branches = await this.getAvailableBranches();
      const tags = await this.getAvailableTags();

      return {
        currentBranch: currentBranch.trim(),
        latestCommit: latestCommit.trim(),
        availableBranches: branches,
        availableTags: tags
      };
    } catch (error) {
      throw new Error(`Failed to get git info: ${error}`);
    }
  }

  async listComponents(branch?: string): Promise<ComponentInfo[]> {
    const repoPath = await this.ensureRepositoryCache();
    
    // Switch to specified branch or default
    if (branch) {
      await this.checkoutBranch(repoPath, branch);
    }

    const componentsPath = path.join(repoPath, 'src', 'components');
    
    if (!await fs.pathExists(componentsPath)) {
      return [];
    }

    // Get git info once and reuse for all components
    const branches = await this.getAvailableBranches();
    const tags = await this.getAvailableTags();

    const componentInfos: ComponentInfo[] = [];
    const components = await this.findAllComponents(componentsPath);

    for (const component of components) {
      componentInfos.push({
        name: component.name,
        path: component.path,
        branches,
        tags,
        versions: [...branches, ...tags]
      });
    }

    return componentInfos.sort((a, b) => a.name.localeCompare(b.name));
  }

  async downloadComponent(name: string, version?: string, outputDir?: string): Promise<string> {
    const repoPath = await this.ensureRepositoryCache();
    
    // Determine what version to checkout
    if (version) {
      await this.checkoutVersion(repoPath, version);
    }

    const targetDir = outputDir || './components';
    const downloadedComponents = new Set<string>();
    
    // Download the main component and all its dependencies
    await this.downloadComponentWithDependencies(name, repoPath, targetDir, downloadedComponents);

    // After downloading all component dependencies, check for additional shared file dependencies
    const allComponents = await this.findAllComponents(path.join(repoPath, 'src', 'components'));
    await this.downloadSharedFileDependencies(targetDir, path.join(repoPath, 'src'), allComponents, downloadedComponents);

    const componentBaseName = path.basename(name);
    return path.join(targetDir, componentBaseName);
  }

  private async downloadComponentWithDependencies(
    name: string, 
    repoPath: string, 
    targetDir: string, 
    downloadedComponents: Set<string>
  ): Promise<void> {
    // Skip if already downloaded
    if (downloadedComponents.has(name)) {
      return;
    }

    // Find the component among all available components (including nested ones)
    const componentsPath = path.join(repoPath, 'src', 'components');
    const allComponents = await this.findAllComponents(componentsPath);
    const component = allComponents.find(comp => comp.name === name);
    
    if (!component) {
      // Try to find similar component names for better error messaging
      const availableComponents = allComponents.map(comp => comp.name);
      
      // Look for case-insensitive matches or partial matches
      const similarComponents = availableComponents.filter(comp => 
        comp.toLowerCase().includes(name.toLowerCase()) || 
        name.toLowerCase().includes(comp.toLowerCase())
      );

      let errorMessage = `Component "${name}" not found`;
      
      if (similarComponents.length > 0) {
        errorMessage += `\n\nDid you mean one of these?\n  ${similarComponents.join('\n  ')}`;
      } else if (availableComponents.length > 0) {
        errorMessage += `\n\nAvailable components:\n  ${availableComponents.slice(0, 10).join('\n  ')}`;
        if (availableComponents.length > 10) {
          errorMessage += `\n  ... and ${availableComponents.length - 10} more`;
        }
      }
      
      throw new Error(errorMessage);
    }

    console.log(`📦 Downloading ${name}...`);

    // Find all dependencies (components + shared files)
    const srcPath = path.join(repoPath, 'src');
    const allDependencies = await this.findAllDependencies(component.path, srcPath, allComponents);
    
    if (allDependencies.components.length > 0 || allDependencies.sharedFiles.length > 0) {
      const totalDeps = allDependencies.components.length + allDependencies.sharedFiles.length;
      console.log(`   📁 Found ${totalDeps} dependenc${totalDeps === 1 ? 'y' : 'ies'}:`);
      
      if (allDependencies.components.length > 0) {
        console.log(`      Components: ${allDependencies.components.join(', ')}`);
      }
      if (allDependencies.sharedFiles.length > 0) {
        console.log(`      Shared files: ${allDependencies.sharedFiles.map(f => path.basename(f)).join(', ')}`);
      }
      
      // Download component dependencies first
      for (const dep of allDependencies.components) {
        await this.downloadComponentWithDependencies(dep, repoPath, targetDir, downloadedComponents);
      }
      
      // Download shared files
      for (const sharedFile of allDependencies.sharedFiles) {
        await this.downloadSharedFile(sharedFile, srcPath, targetDir);
      }
      
      // Find and download additional dependencies from shared files (only run once at the end)
      // Skip for now - will be called from main download method
      
      // Fix import paths in shared files after downloading
      await this.fixSharedFileImportPaths(targetDir, srcPath, allComponents);
    }

    // Copy component to output directory and fix import paths
    const componentBaseName = path.basename(component.name);
    const targetPath = path.join(targetDir, componentBaseName);
    
    await fs.ensureDir(targetDir);
    await fs.copy(component.path, targetPath);
    
    // Fix import paths in the component files
    await this.fixImportPaths(targetPath, targetDir, allDependencies, srcPath);
    
    // Mark as downloaded
    downloadedComponents.add(name);
    
    console.log(`   ✅ ${name} downloaded to ${componentBaseName}/`);
  }

  private async findAllDependencies(
    componentPath: string, 
    srcPath: string,
    allComponents: Array<{name: string, path: string}>
  ): Promise<{components: string[], sharedFiles: string[]}> {
    const components: string[] = [];
    const sharedFiles: string[] = [];
    
    try {
      // Get all TypeScript/JavaScript files in the component directory
      const files = await fs.readdir(componentPath);
      const codeFiles = files.filter(file => 
        (file.endsWith('.tsx') || file.endsWith('.ts') || file.endsWith('.jsx') || file.endsWith('.js')) &&
        !file.includes('.stories.')
      );

      for (const file of codeFiles) {
        const filePath = path.join(componentPath, file);
        const content = await fs.readFile(filePath, 'utf-8');
        
        // Find local imports (relative imports starting with ./ or ../)
        const localImports = this.extractLocalImports(content);
        
        for (const importPath of localImports) {
          // Try to resolve as component dependency first
          const componentDep = this.resolveComponentDependency(
            importPath, 
            componentPath, 
            path.join(srcPath, 'components'), 
            allComponents
          );
          
          if (componentDep && !components.includes(componentDep)) {
            components.push(componentDep);
          } else {
            // Try to resolve as shared file dependency
            const sharedFileDep = await this.resolveSharedFileDependency(
              importPath, 
              componentPath, 
              srcPath
            );
            
            if (sharedFileDep && !sharedFiles.includes(sharedFileDep)) {
              sharedFiles.push(sharedFileDep);
            }
          }
        }
      }
    } catch (error) {
      console.warn(`Warning: Could not analyze dependencies for ${componentPath}: ${error}`);
    }

    return { components, sharedFiles };
  }

  private async resolveSharedFileDependency(
    importPath: string,
    currentComponentPath: string,
    srcPath: string
  ): Promise<string | null> {
    try {
      // Resolve the relative import path
      let resolvedPath = path.resolve(currentComponentPath, importPath);
      
      // If the import doesn't have an extension, try common extensions
      if (!path.extname(importPath)) {
        const potentialPaths = [
          resolvedPath + '.tsx',
          resolvedPath + '.ts',
          resolvedPath + '.jsx',
          resolvedPath + '.js',
          path.join(resolvedPath, 'index.tsx'),
          path.join(resolvedPath, 'index.ts'),
          path.join(resolvedPath, 'index.js')
        ];
        
        // Find the first path that exists
        for (const potentialPath of potentialPaths) {
          if (await fs.pathExists(potentialPath)) {
            resolvedPath = potentialPath;
            break;
          }
        }
      }
      
      // Check if the resolved path is within the src directory but not components
      if (resolvedPath.startsWith(srcPath) && await fs.pathExists(resolvedPath)) {
        // Don't include if it's within components directory (already handled)
        if (!resolvedPath.includes(path.join(srcPath, 'components'))) {
          return resolvedPath;
        }
      }

    } catch (error) {
      // Path resolution failed, skip this dependency
    }

    return null;
  }

  private async downloadSharedFile(sharedFilePath: string, srcPath: string, targetDir: string): Promise<void> {
    try {
      const relativePath = path.relative(srcPath, sharedFilePath);
      
      // Simplify common nested structures
      let simplifiedPath = relativePath;
      if (relativePath.includes('common/Utils')) {
        // Place Utils files directly in shared/Utils/
        simplifiedPath = relativePath.replace('common/Utils', 'Utils');
      } else if (relativePath.includes('common/')) {
        // Remove 'common/' prefix for other common files
        simplifiedPath = relativePath.replace('common/', '');
      }
      
      const targetPath = path.join(targetDir, 'shared', simplifiedPath);
      
      await fs.ensureDir(path.dirname(targetPath));
      await fs.copy(sharedFilePath, targetPath);
      
      console.log(`      📄 Downloaded shared file: ${simplifiedPath}`);
      
      // After downloading a shared file, check if it has its own shared dependencies (like @types)
      await this.downloadSharedFileOwnDependencies(sharedFilePath, srcPath, targetDir);
    } catch (error) {
      console.warn(`Warning: Could not download shared file ${sharedFilePath}: ${error}`);
    }
  }

  private async downloadSharedFileOwnDependencies(sharedFilePath: string, srcPath: string, targetDir: string): Promise<void> {
    try {
      const content = await fs.readFile(sharedFilePath, 'utf-8');
      const localImports = this.extractLocalImports(content);
      
      for (const importPath of localImports) {
        // Check for @types imports specifically
        if (importPath.includes('@types') || importPath.endsWith('@types')) {
          const typesDir = path.join(srcPath, '@types');
          if (await fs.pathExists(typesDir)) {
            const targetTypesDir = path.join(targetDir, 'shared', '@types');
            if (!await fs.pathExists(targetTypesDir)) {
              await fs.ensureDir(path.dirname(targetTypesDir));
              await fs.copy(typesDir, targetTypesDir);
              console.log(`      📄 Downloaded shared file: @types`);
            }
          }
        }
        
        // Could add more shared file dependency patterns here in the future
      }
    } catch (error) {
      // Ignore errors in analyzing shared file dependencies
    }
  }

  private async fixImportPaths(
    componentPath: string, 
    targetDir: string, 
    dependencies: {components: string[], sharedFiles: string[]},
    srcPath: string
  ): Promise<void> {
    try {
      // Get all TypeScript/JavaScript files in the component directory recursively
      const allFiles = await this.findAllFilesRecursive(componentPath, ['.tsx', '.ts', '.jsx', '.js']);
      
      // Filter out stories, tests, and spec files
      const codeFiles = allFiles.filter(filePath => {
        const fileName = path.basename(filePath);
        return !fileName.includes('.stories.');
      });

      for (const filePath of codeFiles) {
        let content = await fs.readFile(filePath, 'utf-8');
        
        // Fix import paths for local dependencies
        const localImports = this.extractLocalImports(content);
        
        for (const importPath of localImports) {
          const newImportPath = this.calculateNewImportPath(
            importPath, 
            filePath, // Pass the actual file path instead of component path
            targetDir, 
            dependencies,
            srcPath
          );
          
          if (newImportPath && newImportPath !== importPath) {
            // Replace the import path in the content
            const importRegex = new RegExp(
              `(import\\s+[^'"\`]*from\\s+['"\`])${importPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(['"\`])`,
              'g'
            );
            content = content.replace(importRegex, `$1${newImportPath}$2`);
          }
        }
        
        // Write the updated content back to the file
        await fs.writeFile(filePath, content, 'utf-8');
      }
    } catch (error) {
      console.warn(`Warning: Could not fix import paths for ${componentPath}: ${error}`);
    }
  }

  private calculateNewImportPath(
    originalImportPath: string,
    currentFilePath: string,
    targetDir: string,
    dependencies: {components: string[], sharedFiles: string[]},
    srcPath: string
  ): string | null {
    try {
      const currentFileDir = path.dirname(currentFilePath);
      
      // For component dependencies, calculate relative path from current file to component
      for (const componentDep of dependencies.components) {
        const componentBaseName = path.basename(componentDep);
        // If the import resolves to this component, calculate the proper relative path
        if (originalImportPath.includes(componentBaseName) || 
            originalImportPath.includes(componentDep)) {
          const componentDir = path.join(targetDir, componentBaseName);
          const relativeToComponent = path.relative(currentFileDir, componentDir);
          return `${relativeToComponent.replace(/\\/g, '/')}/${componentBaseName}`;
        }
      }
      
      // Handle @types imports specifically
      if (originalImportPath.includes('@types') || originalImportPath.endsWith('@types')) {
        const sharedTypesDir = path.join(targetDir, 'shared', '@types');
        const relativeToTypes = path.relative(currentFileDir, sharedTypesDir);
        return relativeToTypes.replace(/\\/g, '/');
      }
      
      // Handle common shared file imports by pattern
      if (originalImportPath.includes('common/Utils') || originalImportPath.endsWith('/Utils')) {
        const sharedUtilsDir = path.join(targetDir, 'shared', 'Utils');
        const relativeToUtils = path.relative(currentFileDir, sharedUtilsDir);
        return relativeToUtils.replace(/\\/g, '/');
      }
      
      // For shared files, point to the shared directory
      for (const sharedFilePath of dependencies.sharedFiles) {
        // Check if this import matches this shared file
        if (this.importMatchesSharedFile(originalImportPath, sharedFilePath, currentFilePath)) {
          // Calculate the simplified path that would be created by downloadSharedFile
          // Find the src/ directory by looking for it in the path
          let srcBasePath = sharedFilePath;
          while (path.basename(srcBasePath) !== 'src' && path.dirname(srcBasePath) !== srcBasePath) {
            srcBasePath = path.dirname(srcBasePath);
          }
          const relativePath = path.relative(srcBasePath, sharedFilePath);
          
          // Apply the same simplification logic as downloadSharedFile
          let simplifiedPath = relativePath;
          if (relativePath.includes('common/Utils')) {
            simplifiedPath = relativePath.replace('common/Utils', 'Utils');
          } else if (relativePath.includes('common/')) {
            simplifiedPath = relativePath.replace('common/', '');
          }
          
          // Calculate relative path from current file to shared directory
          const sharedDir = path.join(targetDir, 'shared');
          const relativeToShared = path.relative(currentFileDir, sharedDir);
          
          // Remove extension if import didn't have one
          let finalPath = `${relativeToShared.replace(/\\/g, '/')}/${simplifiedPath.replace(/\\/g, '/')}`;
          if (!path.extname(originalImportPath) && path.extname(finalPath)) {
            finalPath = finalPath.replace(path.extname(finalPath), '');
          }
          
          return finalPath;
        }
      }
      
    } catch (error) {
      // Failed to calculate new path
    }

    return null;
  }

  private importMatchesSharedFile(importPath: string, sharedFilePath: string, currentFilePath: string): boolean {
    try {
      // Resolve the original import to absolute path from the current file directory
      const currentFileDir = path.dirname(currentFilePath);
      let resolvedImportPath = path.resolve(currentFileDir, importPath);
      
      // If import has no extension, try common extensions
      if (!path.extname(importPath)) {
        const extensions = ['.tsx', '.ts', '.jsx', '.js', '.d.ts'];
        
        // Try direct file match with extensions
        for (const ext of extensions) {
          const testPath = resolvedImportPath + ext;
          if (testPath === sharedFilePath) {
            return true;
          }
        }
        
        // Try index files in directory
        for (const ext of extensions) {
          const testPath = path.join(resolvedImportPath, 'index' + ext);
          if (testPath === sharedFilePath) {
            return true;
          }
        }
      } else {
        // Direct path match for imports with extensions
        if (resolvedImportPath === sharedFilePath) {
          return true;
        }
      }
      
      // Additional check: see if the shared file is in the directory that the import resolves to
      // This handles cases where import is to a directory and shared file is the index file in that directory
      if (!path.extname(importPath)) {
        const importDir = resolvedImportPath;
        const sharedFileDir = path.dirname(sharedFilePath);
        const sharedFileName = path.basename(sharedFilePath);
        
        // Check if shared file is an index file in the import directory
        if (importDir === sharedFileDir && sharedFileName.startsWith('index.')) {
          return true;
        }
      }
      
      return false;
    } catch (error) {
      return false;
    }
  }

  private async fixSharedFileImportPaths(
    targetDir: string, 
    srcPath: string, 
    allComponents: Array<{name: string, path: string}>
  ): Promise<void> {
    try {
      const sharedDir = path.join(targetDir, 'shared');
      if (!await fs.pathExists(sharedDir)) {
        return;
      }

      // Find all TypeScript/JavaScript files in shared directory
      const files = await this.findAllFilesRecursive(sharedDir, ['.tsx', '.ts', '.jsx', '.js']);
      
      for (const filePath of files) {
        let content = await fs.readFile(filePath, 'utf-8');
        const localImports = this.extractLocalImports(content);
        
        for (const importPath of localImports) {
          const newImportPath = this.calculateSharedFileImportPath(
            importPath, 
            filePath, 
            targetDir, 
            srcPath,
            allComponents
          );
          
          if (newImportPath && newImportPath !== importPath) {
            // Replace the import path in the content
            const importRegex = new RegExp(
              `(import\\s+[^'"\`]*from\\s+['"\`])${importPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(['"\`])`,
              'g'
            );
            content = content.replace(importRegex, `$1${newImportPath}$2`);
          }
        }
        
        // Write the updated content back to the file
        await fs.writeFile(filePath, content, 'utf-8');
      }
    } catch (error) {
      console.warn(`Warning: Could not fix shared file import paths: ${error}`);
    }
  }

  private async findAllFilesRecursive(dir: string, extensions: string[]): Promise<string[]> {
    const files: string[] = [];
    
    try {
      const items = await fs.readdir(dir);
      
      for (const item of items) {
        const itemPath = path.join(dir, item);
        const stat = await fs.stat(itemPath);
        
        if (stat.isDirectory()) {
          const subFiles = await this.findAllFilesRecursive(itemPath, extensions);
          files.push(...subFiles);
        } else if (extensions.some(ext => item.endsWith(ext))) {
          files.push(itemPath);
        }
      }
    } catch (error) {
      // Directory doesn't exist or can't be read
    }
    
    return files;
  }

  private calculateSharedFileImportPath(
    originalImportPath: string,
    currentFilePath: string,
    targetDir: string,
    srcPath: string,
    allComponents: Array<{name: string, path: string}>
  ): string | null {
    try {
      // For shared files, we need different logic
      const sharedDir = path.join(targetDir, 'shared');
      const currentDir = path.dirname(currentFilePath);
      
      // Check if this import should go to @types
      if (originalImportPath.includes('@types') || originalImportPath.endsWith('@types')) {
        const typesPath = path.join(sharedDir, '@types');
        const relativeToTypes = path.relative(currentDir, typesPath);
        return relativeToTypes.replace(/\\/g, '/');
      }
      
      // Check if this import should go to a component that was downloaded
      for (const component of allComponents) {
        const componentName = component.name;
        const componentBaseName = path.basename(componentName);
        
        // Check for direct component references
        if (originalImportPath.includes(componentBaseName) || 
            originalImportPath.includes(`components/${componentName}`) ||
            originalImportPath.includes(componentName)) {
          
          // Components are always downloaded to their basename directory
          // For example: Form/Inputs/Select -> Select/
          const componentDir = path.join(targetDir, componentBaseName);
          const relativeToComponent = path.relative(currentDir, componentDir);
          return `${relativeToComponent.replace(/\\/g, '/')}/${componentBaseName}`;
        }
      }
      
      // Handle shared file to shared file imports
      if (originalImportPath.includes('../shared/') || originalImportPath.includes('./shared/')) {
        // Keep shared-to-shared imports as they are
        return null;
      }
      
      // For Utils file, don't change intra-Utils imports
      if (currentFilePath.includes('shared/Utils') && originalImportPath.startsWith('./')) {
        return null; // Keep relative imports within Utils unchanged
      }
      
    } catch (error) {
      // Failed to calculate new path
    }

    return null;
  }

  private async downloadSharedFileDependencies(
    targetDir: string, 
    srcPath: string, 
    allComponents: Array<{name: string, path: string}>,
    downloadedComponents: Set<string>
  ): Promise<void> {
    try {
      const sharedDir = path.join(targetDir, 'shared');
      if (!await fs.pathExists(sharedDir)) {
        return;
      }

      console.log(`🔍 Analyzing shared files for additional dependencies...`);

      // Find all TypeScript/JavaScript files in shared directory
      const files = await this.findAllFilesRecursive(sharedDir, ['.tsx', '.ts', '.jsx', '.js']);
      
      const foundDependencies: string[] = [];
      
      for (const filePath of files) {
        const content = await fs.readFile(filePath, 'utf-8');
        const localImports = this.extractLocalImports(content);
        
        for (const importPath of localImports) {
          // Check if this import resolves to a component that should be downloaded
          const componentDep = this.resolveComponentDependencyFromSharedFile(
            importPath, 
            filePath, 
            srcPath, 
            allComponents
          );
          
          if (componentDep && !downloadedComponents.has(componentDep) && !foundDependencies.includes(componentDep)) {
            foundDependencies.push(componentDep);
          }
        }
      }

      // Download all found dependencies
      if (foundDependencies.length > 0) {
        console.log(`   📦 Found ${foundDependencies.length} additional dependenc${foundDependencies.length === 1 ? 'y' : 'ies'} in shared files: ${foundDependencies.join(', ')}`);
        
        for (const componentDep of foundDependencies) {
          await this.downloadComponentWithDependencies(componentDep, path.dirname(srcPath), targetDir, downloadedComponents);
        }
        
        // After downloading new components, fix all shared file import paths again
        console.log(`   🔧 Updating shared file import paths...`);
        await this.fixSharedFileImportPaths(targetDir, srcPath, allComponents);
      }
    } catch (error) {
      console.warn(`Warning: Could not analyze shared file dependencies: ${error}`);
    }
  }

  private resolveComponentDependencyFromSharedFile(
    importPath: string,
    currentFilePath: string,
    srcPath: string,
    allComponents: Array<{name: string, path: string}>
  ): string | null {
    // Skip non-relative imports and @types
    if (!importPath.startsWith('.') || importPath.includes('@types')) {
      return null;
    }

    try {
      // Clean up the import path - remove file extensions and /index
      let cleanImportPath = importPath.replace(/\.(tsx?|jsx?)$/, '').replace(/\/index$/, '');
      
      // Handle relative path resolution
      const resolvedPath = path.resolve(path.dirname(currentFilePath), cleanImportPath);
      const relativePath = path.relative(srcPath, resolvedPath);
      
      // Normalize path separators
      const normalizedPath = relativePath.replace(/\\/g, '/');
      
      console.log(`      🔍 Analyzing import: "${importPath}" -> resolved: "${normalizedPath}"`);
      
      // Try to match this with available components
      for (const component of allComponents) {
        const componentPath = component.path.replace(/\\/g, '/');
        const componentName = component.name;
        
        // Direct name match in path
        if (normalizedPath.includes(componentName)) {
          console.log(`      ✅ Found component dependency: ${componentName} (direct name match)`);
          return componentName;
        }
        
        // Path-based matching
        if (componentPath.includes(normalizedPath) || normalizedPath.includes(componentPath)) {
          console.log(`      ✅ Found component dependency: ${componentName} (path match)`);
          return componentName;
        }
        
        // Handle nested component structures like Form/Inputs/Select
        if (componentName.includes('/')) {
          const componentBaseName = path.basename(componentName);
          if (normalizedPath.includes(componentBaseName) || normalizedPath.includes(componentName)) {
            console.log(`      ✅ Found component dependency: ${componentName} (nested component match)`);
            return componentName;
          }
        }
      }
      
      // Special pattern matching for common component structures
      const patterns = [
        { regex: /Form\/Inputs\/Select/, component: 'Form/Inputs/Select' },
        { regex: /Form\/Inputs\/TextField/, component: 'Form/Inputs/TextField' },
        { regex: /Form\/Inputs\/Autocomplete/, component: 'Form/Inputs/Autocomplete' },
        { regex: /Buttons\/Button/, component: 'Buttons/Button' },
        { regex: /Modals\/Modal/, component: 'Modals/Modal' },
        { regex: /Navigation\/NavBar/, component: 'Navigation/NavBar' },
      ];
      
      for (const pattern of patterns) {
        if (pattern.regex.test(normalizedPath)) {
          // Check if this component actually exists in our available components
          const found = allComponents.find(c => c.name === pattern.component);
          if (found) {
            console.log(`      ✅ Found component dependency: ${pattern.component} (pattern match)`);
            return pattern.component;
          }
        }
      }
      
      // Also check by relative path patterns for common component dependencies in shared files
      if (importPath.includes('components/')) {
        // Extract component name from path like '../../components/Form/Inputs/Select/Select'
        const match = importPath.match(/components\/(.+?)\/[^\/]+$/);
        if (match) {
          const componentCandidate = match[1];
          const found = allComponents.find(c => c.name === componentCandidate);
          if (found) {
            console.log(`      ✅ Found component dependency: ${componentCandidate} (components path match)`);
            return componentCandidate;
          }
        }
      }
      
      console.log(`      ❌ No component found for import: "${importPath}"`);
      return null;
    } catch (error) {
      console.log(`      ⚠️ Error resolving import "${importPath}": ${error}`);
      return null;
    }
  }

  private extractLocalImports(content: string): string[] {
    const imports: string[] = [];
    
    // Match import statements with relative paths - improved regex
    const importRegex = /import\s+(?:[^'"`\n]*\s+from\s+)?['"`](\.[^'"`]+)['"`]/g;
    let match;
    
    while ((match = importRegex.exec(content)) !== null) {
      imports.push(match[1]);
    }

    // Also match dynamic imports
    const dynamicImportRegex = /import\s*\(\s*['"`](\.[^'"`]+)['"`]\s*\)/g;
    while ((match = dynamicImportRegex.exec(content)) !== null) {
      imports.push(match[1]);
    }

    return imports;
  }

  private resolveComponentDependency(
    importPath: string,
    currentComponentPath: string,
    componentsBasePath: string,
    allComponents: Array<{name: string, path: string}>
  ): string | null {
    try {
      // Handle both file and directory imports
      let resolvedPath = path.resolve(currentComponentPath, importPath);
      
      // If the import doesn't have an extension, try common extensions
      if (!path.extname(importPath)) {
        const potentialPaths = [
          resolvedPath + '.tsx',
          resolvedPath + '.ts',
          path.join(resolvedPath, 'index.tsx'),
          path.join(resolvedPath, 'index.ts')
        ];
        
        // Use the first path that could exist (we don't check filesystem here)
        resolvedPath = potentialPaths[0];
      }
      
      // Check if the resolved path is within the components directory
      if (!resolvedPath.startsWith(componentsBasePath)) {
        return null; // External dependency, not a component
      }

      // Find which component this path belongs to by checking all components
      for (const component of allComponents) {
        // Check if the resolved path is within this component's directory
        if (resolvedPath.startsWith(component.path)) {
          // Make sure it's not the same component
          if (component.path !== currentComponentPath) {
            return component.name;
          }
        }
      }

      // Try to find by directory structure if direct match fails
      // Work backwards from the resolved path to find a matching component
      const relativePath = path.relative(componentsBasePath, resolvedPath);
      const pathParts = relativePath.split(path.sep);
      
      // Remove the file name and extension to get directory path
      let dirParts = pathParts.slice();
      if (path.extname(pathParts[pathParts.length - 1])) {
        dirParts = dirParts.slice(0, -1);
      }
      
      // Build potential component names from path parts
      for (let i = dirParts.length; i > 0; i--) {
        const potentialName = dirParts.slice(0, i).join('/');
        const foundComponent = allComponents.find(comp => comp.name === potentialName);
        if (foundComponent) {
          // Make sure it's not the same component we're currently processing
          const currentComponentName = path.relative(componentsBasePath, currentComponentPath).replace(/\\/g, '/');
          if (foundComponent.name !== currentComponentName) {
            return foundComponent.name;
          }
        }
      }

    } catch (error) {
      // Path resolution failed, skip this dependency
    }

    return null;
  }

  private async findAllComponents(basePath: string, relativePath: string = ''): Promise<Array<{name: string, path: string}>> {
    if (!await fs.pathExists(basePath)) {
      return [];
    }

    const components: Array<{name: string, path: string}> = [];
    const items = await fs.readdir(basePath);

    for (const item of items) {
      if (item.startsWith('.') || item === 'README.md') {
        continue;
      }

      const itemPath = path.join(basePath, item);
      const stat = await fs.stat(itemPath);
      
      if (stat.isDirectory()) {
        // Check if this directory contains component files
        const files = await fs.readdir(itemPath);
        const hasComponentFile = files.some(file => 
          file.endsWith('.tsx') && !file.includes('.stories.') && !file.includes('.test.')
        );

        const componentName = relativePath ? `${relativePath}/${item}` : item;

        if (hasComponentFile) {
          components.push({
            name: componentName,
            path: itemPath
          });
        }

        // Recursively search subdirectories
        const subComponents = await this.findAllComponents(itemPath, componentName);
        components.push(...subComponents);
      }
    }

    return components;
  }

  private async getAvailableComponentNames(componentsPath: string): Promise<string[]> {
    const components = await this.findAllComponents(componentsPath);
    return components.map(comp => comp.name).sort();
  }

  private async checkoutBranch(repoPath: string, branch: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const checkout = spawn('git', ['checkout', `origin/${branch}`], {
        cwd: repoPath,
        stdio: 'pipe'
      });

      checkout.on('close', (code: number | null) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Failed to checkout branch ${branch}`));
        }
      });

      checkout.on('error', reject);
    });
  }

  private async checkoutVersion(repoPath: string, version: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const checkout = spawn('git', ['checkout', version], {
        cwd: repoPath,
        stdio: 'pipe'
      });

      checkout.on('close', (code: number | null) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Failed to checkout version ${version}`));
        }
      });

      checkout.on('error', reject);
    });
  }

  private async getComponentBranches(componentName: string): Promise<string[]> {
    // This could be enhanced to check which branches actually contain the component
    return await this.getAvailableBranches();
  }

  private async getComponentTags(componentName: string): Promise<string[]> {
    // This could be enhanced to check which tags actually contain the component
    return await this.getAvailableTags();
  }

  private getSSHCommand(): string {
    let sshCommand = 'ssh -o StrictHostKeyChecking=no';
    
    if (this.config.sshKeyPath) {
      sshCommand += ` -i ${this.config.sshKeyPath}`;
    }
    
    return sshCommand;
  }

  async clearCache(): Promise<void> {
    if (await fs.pathExists(this.cacheDir)) {
      await fs.remove(this.cacheDir);
    }
  }
} 