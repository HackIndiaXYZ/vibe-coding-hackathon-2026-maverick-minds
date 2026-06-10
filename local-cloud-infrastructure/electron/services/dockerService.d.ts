export type GpuProfile = 'cpu' | 'nvidia' | 'amd';
export interface DockerServiceStatus {
    dockerInstalled: boolean;
    dockerRunning: boolean;
    ollamaRunning: boolean;
    ollamaContainer: string | null;
    activeProfile: GpuProfile;
    composePath: string;
    logs: string[];
}
export declare function getDockerServiceStatus(): Promise<DockerServiceStatus>;
export declare function startOllamaDocker(profile?: GpuProfile): Promise<DockerServiceStatus>;
export declare function stopOllamaDocker(): Promise<DockerServiceStatus>;
export declare function pullOllamaModel(model: string): Promise<void>;
export declare function getActiveGpuProfile(): GpuProfile;
export declare function getInfrastructurePath(): string;
