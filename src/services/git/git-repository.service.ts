import { GitConfig, GitInfo } from '../../types/index.js';
import fs from 'fs-extra';
import path from 'path';
import simpleGit, { SimpleGit } from 'simple-git';

export class GitRepositoryService {
  private git: SimpleGit;
  private repoPath: string;

  constructor(private config: GitConfig, private cacheDir: string) {
    this.repoPath = path.join(cacheDir, '.repo-cache');
    console.log('Initializing GitRepositoryService with repoPath:', this.repoPath);
    fs.ensureDirSync(this.repoPath);
    this.git = simpleGit();
  }

  async testConnection(): Promise<boolean> {
    try {
      console.log('Testing connection to repository:', this.config.repositoryUrl);
      await this.git.listRemote(['--heads', this.config.repositoryUrl]);
      return true;
    } catch (error) {
      console.error('Connection test failed:', error);
      return false;
    }
  }

  async ensureRepositoryCache(branch?: string): Promise<void> {
    console.log('Ensuring repository cache exists...');
    // Check if repo already exists
    const isRepo = await fs.pathExists(path.join(this.repoPath, '.git'));
    console.log('Repository exists:', isRepo);

    if (!isRepo) {
      // Clone repository
      console.log('Cloning repository to:', this.repoPath);
      // First, ensure the directory is empty
      await fs.emptyDir(this.repoPath);
      // Clone into the directory
      await this.git.clone(this.config.repositoryUrl, this.repoPath);
      // Initialize git in the repo directory
      this.git = simpleGit({ baseDir: this.repoPath });
      console.log('Repository cloned successfully');
    } else {
      // Update existing repository
      console.log('Updating existing repository');
      this.git = simpleGit({ baseDir: this.repoPath });
      await this.git.fetch(['--all', '--prune']);
      await this.git.pull();
      console.log('Repository updated successfully');
    }

    // Switch to specified branch if provided
    if (branch) {
      console.log('Checking out branch:', branch);
      await this.checkoutBranch(branch);
    }
  }

  async getGitInfo(): Promise<GitInfo> {
    console.log('Getting Git info...');
    try {
      const [branches, tags, currentBranch, latestCommit] = await Promise.all([
        this.git.branchLocal(),
        this.git.tags(),
        this.git.revparse(['--abbrev-ref', 'HEAD']),
        this.git.revparse(['HEAD'])
      ]);

      const info = {
        currentBranch: currentBranch.trim(),
        latestCommit: latestCommit.trim(),
        availableBranches: branches.all,
        availableTags: tags.all || []
      };
      console.log('Git info:', info);
      return info;
    } catch (error) {
      console.error('Error getting Git info:', error);
      return {
        currentBranch: '',
        latestCommit: '',
        availableBranches: [],
        availableTags: []
      };
    }
  }

  async checkoutVersion(version: string): Promise<void> {
    console.log('Checking out version:', version);
    await this.git.checkout(version);
  }

  async checkoutBranch(branch: string): Promise<void> {
    console.log('Checking out branch:', branch);
    await this.git.checkout(branch);
  }

  async clearCache(): Promise<void> {
    console.log('Clearing cache directory:', this.repoPath);
    await fs.remove(this.repoPath);
  }
} 