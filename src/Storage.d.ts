/// <reference types="node" />
/// <reference types="node" />
import { Readable } from "stream";
import { IStorage, AdapterConfig } from "./types";
export declare class Storage implements IStorage {
    private adapter;
    constructor(config: string | AdapterConfig);
    getType(): string;
    getConfiguration(): AdapterConfig;
    switchAdapter(args: string | AdapterConfig): void;
    init(): Promise<boolean>;
    test(): Promise<string>;
    addFileFromBuffer(buffer: Buffer, targetPath: string): Promise<void>;
    addFileFromPath(origPath: string, targetPath: string): Promise<void>;
    addFileFromReadable(stream: Readable, targetPath: string): Promise<void>;
    createBucket(name?: string): Promise<string>;
    clearBucket(name?: string): Promise<string>;
    deleteBucket(name?: string): Promise<string>;
    listBuckets(): Promise<string[]>;
    getSelectedBucket(): string;
    getFileAsReadable(name: string, options?: {
        start?: number;
        end?: number;
    }): Promise<Readable>;
    removeFile(fileName: string): Promise<string>;
    listFiles(numFiles?: number): Promise<[string, number][]>;
    selectBucket(name?: string): Promise<string>;
    sizeOf(name: string): Promise<number>;
    fileExists(name: string): Promise<boolean>;
}
