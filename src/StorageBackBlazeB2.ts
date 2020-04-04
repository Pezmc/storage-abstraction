import fs from "fs";
import path from "path";
import slugify from "slugify";
import { zip } from "ramda";
import to from "await-to-js";
import { Readable } from "stream";
import B2 from "backblaze-b2";
// require("@gideo-llc/backblaze-b2-upload-any").install(B2);
import { AbstractStorage } from "./AbstractStorage";
import { IStorage } from "./types";
import { parseUrlGeneric } from "./util";

export type ConfigBackBlazeB2 = {
  bucketName?: string;
  applicationKeyId: string;
  applicationKey: string;
};

export class StorageBackBlazeB2 extends AbstractStorage implements IStorage {
  protected type = "b2";
  private storage: B2;
  private authorized = false;

  constructor(config: string | ConfigBackBlazeB2) {
    super();
    const { applicationKey, applicationKeyId, bucketName } = this.parseConfig(config);
    this.storage = new B2({ applicationKey, applicationKeyId });
    // console.log(this.storage.authorize);
    this.bucketName = bucketName;
    if (bucketName) {
      this.buckets.push(bucketName);
    }
  }

  private parseConfig(config: string | ConfigBackBlazeB2): ConfigBackBlazeB2 {
    if (typeof config === "string") {
      const [type, applicationKeyId, applicationKey, options] = parseUrlGeneric(config);
      if (type !== this.type) {
        throw new Error(`expecting type "${this.type}" but found type "${type}"`);
      }
      console.log(applicationKeyId, applicationKey);
      return {
        applicationKeyId,
        applicationKey,
        ...options,
      };
    }
    return config;
  }

  private async authorize(): Promise<boolean> {
    if (this.authorized) {
      return Promise.resolve(true);
    }

    try {
      await this.storage.authorize();
      return true;
    } catch (e) {
      throw new Error(e.message);
    }

    // this.storage
    //   .authorize()
    //   .then(e => {
    //     console.log(e);
    //     return true;
    //   })
    //   .catch((e: Error) => {
    //     throw new Error(e.message);
    //   });
  }

  async getFileAsReadable(
    fileName: string,
    options: { start?: number; end?: number } = { start: 0 }
  ): Promise<Readable> {
    const file = this.storage.bucket(this.bucketName).file(fileName);
    const [exists] = await file.exists();
    if (exists) {
      return file.createReadStream(options);
    }
    throw new Error(`File ${fileName} could not be retrieved from bucket ${this.bucketName}`);
  }

  // not in use
  async downloadFile(fileName: string, downloadPath: string): Promise<void> {
    const file = this.storage.bucket(this.bucketName).file(fileName);
    const localFilename = path.join(downloadPath, fileName);
    await file.download({ destination: localFilename });
  }

  async removeFile(fileName: string): Promise<void> {
    try {
      await this.storage
        .bucket(this.bucketName)
        .file(fileName)
        .delete();
    } catch (e) {
      if (e.message.indexOf("No such object") !== -1) {
        return;
      }
      // console.log(e.message);
      throw e;
    }
  }

  // util members

  protected async store(buffer: Buffer, targetPath: string): Promise<void>;
  protected async store(stream: Readable, targetPath: string): Promise<void>;
  protected async store(origPath: string, targetPath: string): Promise<void>;
  protected async store(arg: string | Buffer | Readable, targetPath: string): Promise<void> {
    if (this.bucketName === null) {
      throw new Error("Please select a bucket first");
    }
    await this.createBucket(this.bucketName);

    let readStream: Readable;
    if (typeof arg === "string") {
      await fs.promises.stat(arg); // throws error if path doesn't exist
      readStream = fs.createReadStream(arg);
    } else if (arg instanceof Buffer) {
      readStream = new Readable();
      readStream._read = (): void => {}; // _read is required but you can noop it
      readStream.push(arg);
      readStream.push(null);
    } else if (arg instanceof Readable) {
      readStream = arg;
    }
    const writeStream = this.storage
      .bucket(this.bucketName)
      .file(targetPath)
      .createWriteStream();
    return new Promise((resolve, reject) => {
      readStream
        .pipe(writeStream)
        .on("error", reject)
        .on("finish", resolve);
      writeStream.on("error", reject);
    });
  }

  async createBucket(name: string): Promise<void> {
    if (name === null) {
      throw new Error("Can not use `null` as bucket name");
    }
    const n = slugify(name);
    if (super.checkBucket(n)) {
      return;
    }
    const bucket = this.storage.bucket(n);
    const [exists] = await bucket.exists();
    if (exists) {
      return;
    }

    try {
      await this.storage.createBucket(n);
      this.buckets.push(n);
    } catch (e) {
      if (e.code === 409) {
        // error code 409 is 'You already own this bucket. Please select another name.'
        // so we can safely return true if this error occurs
        return;
      }
      throw new Error(e.message);
    }
  }

  async selectBucket(name: string | null): Promise<void> {
    if (name === null) {
      this.bucketName = null;
      return;
    }

    const [error] = await to(this.createBucket(name));
    if (error !== null) {
      throw error;
    }
    this.bucketName = name;
  }

  async clearBucket(name?: string): Promise<void> {
    let n = name || this.bucketName;
    n = slugify(n);
    await this.storage.bucket(n).deleteFiles({ force: true });
  }

  async deleteBucket(name?: string): Promise<void> {
    let n = name || this.bucketName;
    n = slugify(n);
    await this.clearBucket(n);
    const data = await this.storage.bucket(n).delete();
    // console.log(data);
    if (n === this.bucketName) {
      this.bucketName = null;
    }
    this.buckets = this.buckets.filter(b => b !== n);
  }

  async listBuckets(): Promise<string[]> {
    this.authorized = await this.authorize();
    const {
      data: { buckets },
    } = await this.storage.listBuckets();
    this.buckets = buckets.map(b => b.bucketName);
    return this.buckets;
  }

  private async getMetaData(files: string[]): Promise<number[]> {
    const sizes: number[] = [];
    for (let i = 0; i < files.length; i += 1) {
      const file = this.storage.bucket(this.bucketName).file(files[i]);
      const [metadata] = await file.getMetadata();
      // console.log(metadata);
      sizes.push(parseInt(metadata.size, 10));
    }
    return sizes;
  }

  async listFiles(numFiles: number = 1000): Promise<[string, number][]> {
    if (this.bucketName === null) {
      throw new Error("Please select a bucket first");
    }
    const data = await this.storage.bucket(this.bucketName).getFiles();
    const names = data[0].map(f => f.name);
    const sizes = await this.getMetaData(names);
    return zip(names, sizes) as [string, number][];
  }

  async sizeOf(name: string): Promise<number> {
    if (this.bucketName === null) {
      throw new Error("Please select a bucket first");
    }
    const file = this.storage.bucket(this.bucketName).file(name);
    const [metadata] = await file.getMetadata();
    return parseInt(metadata.size, 10);
  }
}
