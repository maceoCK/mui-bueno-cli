import { CliConfig, GitConfig } from '../types/index.js';
export declare class ConfigManager {
    private configPath;
    private config;
    constructor();
    load(): Promise<CliConfig>;
    save(config: CliConfig): Promise<void>;
    update(updates: Partial<CliConfig>): Promise<void>;
    setGitConfig(gitConfig: GitConfig): Promise<void>;
    getGitConfig(): Promise<GitConfig>;
    private getDefaultConfig;
    exists(): Promise<boolean>;
    reset(): Promise<void>;
    validateConfig(config?: CliConfig): Promise<{
        valid: boolean;
        errors: string[];
    }>;
}
//# sourceMappingURL=config.d.ts.map