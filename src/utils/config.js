"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConfigManager = void 0;
const fs_extra_1 = __importDefault(require("fs-extra"));
const path_1 = __importDefault(require("path"));
const os_1 = __importDefault(require("os"));
class ConfigManager {
    constructor() {
        this.config = null;
        this.configPath = path_1.default.join(os_1.default.homedir(), '.mui-bueno-config.json');
    }
    async load() {
        if (this.config) {
            return this.config;
        }
        try {
            if (await fs_extra_1.default.pathExists(this.configPath)) {
                const configData = await fs_extra_1.default.readJson(this.configPath);
                this.config = { ...this.getDefaultConfig(), ...configData };
                return this.config;
            }
        }
        catch (error) {
            console.warn('Failed to load config, using defaults');
        }
        this.config = this.getDefaultConfig();
        return this.config;
    }
    async save(config) {
        this.config = config;
        await fs_extra_1.default.writeJson(this.configPath, config, { spaces: 2 });
    }
    async update(updates) {
        const currentConfig = await this.load();
        const newConfig = { ...currentConfig, ...updates };
        await this.save(newConfig);
    }
    async setGitConfig(gitConfig) {
        await this.update({ git: gitConfig });
    }
    async getGitConfig() {
        const config = await this.load();
        return config.git;
    }
    getDefaultConfig() {
        return {
            git: {
                repositoryUrl: 'git@bitbucket.org:obp-dashboard/mui-bueno-v2.git',
                branch: 'main'
            },
            defaultDownloadPath: './components',
            author: 'anonymous',
            workspace: process.cwd(),
            cacheDir: path_1.default.join(os_1.default.homedir(), '.mui-bueno-cache')
        };
    }
    async exists() {
        return await fs_extra_1.default.pathExists(this.configPath);
    }
    async reset() {
        this.config = null;
        if (await fs_extra_1.default.pathExists(this.configPath)) {
            await fs_extra_1.default.remove(this.configPath);
        }
    }
    async validateConfig(config) {
        const configToValidate = config || await this.load();
        const errors = [];
        // Validate git config
        if (!configToValidate.git) {
            errors.push('Git configuration is missing');
        }
        else {
            if (!configToValidate.git.repositoryUrl) {
                errors.push('Git repository URL is required');
            }
            if (!configToValidate.git.branch) {
                errors.push('Git branch is required');
            }
        }
        // Validate paths
        if (configToValidate.defaultDownloadPath && !path_1.default.isAbsolute(configToValidate.defaultDownloadPath)) {
            // This is OK, relative paths are allowed
        }
        return {
            valid: errors.length === 0,
            errors
        };
    }
}
exports.ConfigManager = ConfigManager;
