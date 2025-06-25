"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GitService = void 0;
const child_process_1 = require("child_process");
const util_1 = require("util");
const fs_extra_1 = __importDefault(require("fs-extra"));
const path_1 = __importDefault(require("path"));
const os_1 = __importDefault(require("os"));
const execAsync = (0, util_1.promisify)(child_process_1.exec);
class GitService {
    constructor(config, cacheDir) {
        this.config = config;
        this.cacheDir = cacheDir || path_1.default.join(os_1.default.homedir(), '.mui-bueno-cache');
    }
    async testConnection() {
        try {
            // Test SSH access to the repository
            const { stdout, stderr } = await execAsync(`ssh -T git@github.com`, {
                env: { ...process.env, GIT_SSH_COMMAND: this.getSSHCommand() }
            });
            // GitHub SSH test returns specific messages
            return stderr.includes('successfully authenticated') || stdout.includes('successfully authenticated');
        }
        catch (error) {
            // GitHub SSH test typically "fails" with exit code 1 but gives success message
            if (error.stderr && error.stderr.includes('successfully authenticated')) {
                return true;
            }
            return false;
        }
    }
    async ensureRepositoryCache() {
        const repoPath = path_1.default.join(this.cacheDir, 'mui-bueno-v2');
        if (await fs_extra_1.default.pathExists(repoPath)) {
            // Update existing repository
            await this.updateRepository(repoPath);
        }
        else {
            // Clone repository
            await fs_extra_1.default.ensureDir(this.cacheDir);
            await this.cloneRepository(repoPath);
        }
        return repoPath;
    }
    async cloneRepository(targetPath) {
        return new Promise((resolve, reject) => {
            const clone = (0, child_process_1.spawn)('git', ['clone', this.config.repositoryUrl, targetPath], {
                env: { ...process.env, GIT_SSH_COMMAND: this.getSSHCommand() },
                stdio: 'pipe'
            });
            clone.on('close', (code) => {
                if (code === 0) {
                    resolve();
                }
                else {
                    reject(new Error(`Git clone failed with exit code ${code}`));
                }
            });
            clone.on('error', reject);
        });
    }
    async updateRepository(repoPath) {
        return new Promise((resolve, reject) => {
            const fetch = (0, child_process_1.spawn)('git', ['fetch', '--all', '--tags'], {
                cwd: repoPath,
                env: { ...process.env, GIT_SSH_COMMAND: this.getSSHCommand() },
                stdio: 'pipe'
            });
            fetch.on('close', (code) => {
                if (code === 0) {
                    resolve();
                }
                else {
                    reject(new Error(`Git fetch failed with exit code ${code}`));
                }
            });
            fetch.on('error', reject);
        });
    }
    async getAvailableBranches() {
        const repoPath = await this.ensureRepositoryCache();
        try {
            const { stdout } = await execAsync('git branch -r', { cwd: repoPath });
            return stdout
                .split('\n')
                .map(branch => branch.trim().replace('origin/', ''))
                .filter(branch => branch && !branch.includes('HEAD'))
                .sort();
        }
        catch (error) {
            return [];
        }
    }
    async getAvailableTags() {
        const repoPath = await this.ensureRepositoryCache();
        try {
            const { stdout } = await execAsync('git tag --sort=-version:refname', { cwd: repoPath });
            return stdout.split('\n').filter(tag => tag.trim()).slice(0, 10); // Latest 10 tags
        }
        catch (error) {
            return [];
        }
    }
    async getGitInfo() {
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
        }
        catch (error) {
            throw new Error(`Failed to get git info: ${error}`);
        }
    }
    async listComponents(branch) {
        const repoPath = await this.ensureRepositoryCache();
        // Switch to specified branch or default
        if (branch) {
            await this.checkoutBranch(repoPath, branch);
        }
        const componentsPath = path_1.default.join(repoPath, 'src', 'components');
        if (!await fs_extra_1.default.pathExists(componentsPath)) {
            return [];
        }
        const componentInfos = [];
        const items = await fs_extra_1.default.readdir(componentsPath);
        for (const item of items) {
            const itemPath = path_1.default.join(componentsPath, item);
            const stat = await fs_extra_1.default.stat(itemPath);
            if (stat.isDirectory() && !item.startsWith('.')) {
                // Check if this is a component directory (has .tsx files)
                const files = await fs_extra_1.default.readdir(itemPath);
                const hasComponentFile = files.some(file => file.endsWith('.tsx') && !file.includes('.stories.') && !file.includes('.test.'));
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
    async downloadComponent(name, version, outputDir) {
        const repoPath = await this.ensureRepositoryCache();
        // Determine what version to checkout
        if (version) {
            await this.checkoutVersion(repoPath, version);
        }
        const componentPath = path_1.default.join(repoPath, 'src', 'components', name);
        if (!await fs_extra_1.default.pathExists(componentPath)) {
            // Try to find similar component names for better error messaging
            const componentsPath = path_1.default.join(repoPath, 'src', 'components');
            const availableComponents = await this.getAvailableComponentNames(componentsPath);
            // Look for case-insensitive matches or partial matches
            const similarComponents = availableComponents.filter(comp => comp.toLowerCase().includes(name.toLowerCase()) ||
                name.toLowerCase().includes(comp.toLowerCase()));
            let errorMessage = `Component "${name}" not found`;
            if (similarComponents.length > 0) {
                errorMessage += `\n\nDid you mean one of these?\n  ${similarComponents.join('\n  ')}`;
            }
            else if (availableComponents.length > 0) {
                errorMessage += `\n\nAvailable components:\n  ${availableComponents.slice(0, 10).join('\n  ')}`;
                if (availableComponents.length > 10) {
                    errorMessage += `\n  ... and ${availableComponents.length - 10} more`;
                }
            }
            throw new Error(errorMessage);
        }
        // Copy component to output directory
        const targetDir = outputDir || './components';
        const targetPath = path_1.default.join(targetDir, name);
        await fs_extra_1.default.ensureDir(targetDir);
        await fs_extra_1.default.copy(componentPath, targetPath);
        return targetPath;
    }
    async getAvailableComponentNames(componentsPath) {
        if (!await fs_extra_1.default.pathExists(componentsPath)) {
            return [];
        }
        const items = await fs_extra_1.default.readdir(componentsPath);
        const componentNames = [];
        for (const item of items) {
            const itemPath = path_1.default.join(componentsPath, item);
            const stat = await fs_extra_1.default.stat(itemPath);
            if (stat.isDirectory() && !item.startsWith('.')) {
                // Check if this is a component directory (has .tsx files)
                const files = await fs_extra_1.default.readdir(itemPath);
                const hasComponentFile = files.some(file => file.endsWith('.tsx') && !file.includes('.stories.') && !file.includes('.test.'));
                if (hasComponentFile) {
                    componentNames.push(item);
                }
            }
        }
        return componentNames.sort();
    }
    async checkoutBranch(repoPath, branch) {
        return new Promise((resolve, reject) => {
            const checkout = (0, child_process_1.spawn)('git', ['checkout', `origin/${branch}`], {
                cwd: repoPath,
                stdio: 'pipe'
            });
            checkout.on('close', (code) => {
                if (code === 0) {
                    resolve();
                }
                else {
                    reject(new Error(`Failed to checkout branch ${branch}`));
                }
            });
            checkout.on('error', reject);
        });
    }
    async checkoutVersion(repoPath, version) {
        return new Promise((resolve, reject) => {
            const checkout = (0, child_process_1.spawn)('git', ['checkout', version], {
                cwd: repoPath,
                stdio: 'pipe'
            });
            checkout.on('close', (code) => {
                if (code === 0) {
                    resolve();
                }
                else {
                    reject(new Error(`Failed to checkout version ${version}`));
                }
            });
            checkout.on('error', reject);
        });
    }
    async getComponentBranches(componentName) {
        // This could be enhanced to check which branches actually contain the component
        return await this.getAvailableBranches();
    }
    async getComponentTags(componentName) {
        // This could be enhanced to check which tags actually contain the component
        return await this.getAvailableTags();
    }
    getSSHCommand() {
        let sshCommand = 'ssh -o StrictHostKeyChecking=no';
        if (this.config.sshKeyPath) {
            sshCommand += ` -i ${this.config.sshKeyPath}`;
        }
        return sshCommand;
    }
    async clearCache() {
        if (await fs_extra_1.default.pathExists(this.cacheDir)) {
            await fs_extra_1.default.remove(this.cacheDir);
        }
    }
}
exports.GitService = GitService;
//# sourceMappingURL=git-service.js.map