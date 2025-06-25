import { Component } from '../types/index.js';
export declare class ComponentParser {
    parseComponent(componentPath: string, name: string): Promise<Component>;
    private getComponentFiles;
    private getFileType;
    private extractMetadata;
    private extractProps;
    private parsePropsFromTypeDefinition;
    private extractExports;
    private extractDependencies;
    private extractPeerDependencies;
    private extractPackageName;
    private generateChecksum;
    private generateVersion;
    validateComponent(component: Component): Promise<{
        valid: boolean;
        errors: string[];
    }>;
}
//# sourceMappingURL=component-parser.d.ts.map