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
      const { stdout, stderr } = await execAsync(`ssh -T git@github.com`, {
        env: { ...process.env, GIT_SSH_COMMAND: this.getSSHCommand() }
      });
      
      // GitHub SSH test returns specific messages
      return stderr.includes('successfully authenticated') || stdout.includes('successfully authenticated');
    } catch (error: any) {
      // GitHub SSH test typically "fails" with exit code 1 but gives success message
      if (error.stderr && error.stderr.includes('successfully authenticated')) {
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

      clone.on('close', (code) => {
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

      fetch.on('close', (code) => {
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
        .map(branch => branch.trim().replace('origin/', ''))
        .filter(branch => branch && !branch.includes('HEAD'))
        .sort();
    } catch (error) {
      return [];
    }
  }

  async getAvailableTags(): Promise<string[]> {
    const repoPath = await this.ensureRepositoryCache();
    
    try {
      const { stdout } = await execAsync('git tag --sort=-version:refname', { cwd: repoPath });
      return stdout.split('\n').filter(tag => tag.trim()).slice(0, 10); // Latest 10 tags
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

    const componentInfos: ComponentInfo[] = [];
    const items = await fs.readdir(componentsPath);

    for (const item of items) {
      const itemPath = path.join(componentsPath, item);
      const stat = await fs.stat(itemPath);
      
      if (stat.isDirectory() && !item.startsWith('.')) {
        // Check if this is a component directory (has .tsx files)
        const files = await fs.readdir(itemPath);
        const hasComponentFile = files.some(file => 
          file.endsWith('.tsx') && !file.includes('.stories.') && !file.includes('.test.')
        );

        if (hasComponentFile) {
          const branches = await this.getComponentBranches(item);
          const tags = await this.getComponentTags(item);
          
          componentInfos.push({
            name: item,
            path: itemPath,
            branches,
            tags,
            versions: [...branches, ...tags]
          });
        }
      }
    }

    return componentInfos.sort((a, b) => a.name.localeCompare(b.name));
  }

  async downloadComponent(name: string, version?: string, outputDir?: string): Promise<string> {
    const repoPath = await this.ensureRepositoryCache();
    
    // Determine what version to checkout
    if (version) {
      await this.checkoutVersion(repoPath, version);
    }

    const componentPath = path.join(repoPath, 'src', 'components', name);
    
    if (!await fs.pathExists(componentPath)) {
      // Try to find similar component names for better error messaging
      const componentsPath = path.join(repoPath, 'src', 'components');
      const availableComponents = await this.getAvailableComponentNames(componentsPath);
      
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

    // Copy component to output directory
    const targetDir = outputDir || './components';
    const targetPath = path.join(targetDir, name);
    
    await fs.ensureDir(targetDir);
    await fs.copy(componentPath, targetPath);

    return targetPath;
  }

  private async getAvailableComponentNames(componentsPath: string): Promise<string[]> {
    if (!await fs.pathExists(componentsPath)) {
      return [];
    }

    const items = await fs.readdir(componentsPath);
    const componentNames: string[] = [];

    for (const item of items) {
      const itemPath = path.join(componentsPath, item);
      const stat = await fs.stat(itemPath);
      
      if (stat.isDirectory() && !item.startsWith('.')) {
        // Check if this is a component directory (has .tsx files)
        const files = await fs.readdir(itemPath);
        const hasComponentFile = files.some(file => 
          file.endsWith('.tsx') && !file.includes('.stories.') && !file.includes('.test.')
        );

        if (hasComponentFile) {
          componentNames.push(item);
        }
      }
    }

    return componentNames.sort();
  }

  private async checkoutBranch(repoPath: string, branch: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const checkout = spawn('git', ['checkout', `origin/${branch}`], {
        cwd: repoPath,
        stdio: 'pipe'
      });

      checkout.on('close', (code) => {
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

      checkout.on('close', (code) => {
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