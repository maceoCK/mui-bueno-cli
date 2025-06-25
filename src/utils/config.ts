import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { CliConfig, GitConfig } from '../types/index.js';

export class ConfigManager {
  private configPath: string;
  private config: CliConfig | null = null;

  constructor() {
    this.configPath = path.join(os.homedir(), '.mui-bueno-config.json');
  }

  async load(): Promise<CliConfig> {
    if (this.config) {
      return this.config;
    }

    try {
      if (await fs.pathExists(this.configPath)) {
        const configData = await fs.readJson(this.configPath);
        this.config = { ...this.getDefaultConfig(), ...configData };
        return this.config!
      }
    } catch (error) {
      console.warn('Failed to load config, using defaults');
    }

    this.config = this.getDefaultConfig();
    return this.config;
  }

  async save(config: CliConfig): Promise<void> {
    this.config = config;
    await fs.writeJson(this.configPath, config, { spaces: 2 });
  }

  async update(updates: Partial<CliConfig>): Promise<void> {
    const currentConfig = await this.load();
    const newConfig = { ...currentConfig, ...updates };
    await this.save(newConfig);
  }

  async setGitConfig(gitConfig: GitConfig): Promise<void> {
    await this.update({ git: gitConfig });
  }

  async getGitConfig(): Promise<GitConfig> {
    const config = await this.load();
    return config.git;
  }

  private getDefaultConfig(): CliConfig {
    return {
      git: {
        repositoryUrl: 'git@github.com:owner/mui-bueno-v2.git',
        branch: 'main'
      },
      defaultDownloadPath: './components',
      author: 'anonymous',
      workspace: process.cwd(),
      cacheDir: path.join(os.homedir(), '.mui-bueno-cache')
    };
  }

  async exists(): Promise<boolean> {
    return await fs.pathExists(this.configPath);
  }

  async reset(): Promise<void> {
    this.config = null;
    if (await fs.pathExists(this.configPath)) {
      await fs.remove(this.configPath);
    }
  }

  async validateConfig(config?: CliConfig): Promise<{ valid: boolean; errors: string[] }> {
    const configToValidate = config || await this.load();
    const errors: string[] = [];

    // Validate git config
    if (!configToValidate.git) {
      errors.push('Git configuration is missing');
    } else {
      if (!configToValidate.git.repositoryUrl) {
        errors.push('Git repository URL is required');
      }
      if (!configToValidate.git.branch) {
        errors.push('Git branch is required');
      }
    }

    // Validate paths
    if (configToValidate.defaultDownloadPath && !path.isAbsolute(configToValidate.defaultDownloadPath)) {
      // This is OK, relative paths are allowed
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
} 