import "jasmine";
import { Storage } from "../src/Storage";
import { StorageType } from "../src/types";

describe(`testing Amazon urls`, () => {
  it("[0] no options", () => {
    this.storage = new Storage("s3://key:secret/can/contain/slashes");
    expect(this.storage.getType()).toBe(StorageType.S3);
    expect(this.storage.getSelectedBucket()).toBe("");
    expect(this.storage.getConfiguration().accessKeyId).toBe("key");
    expect(this.storage.getConfiguration().secretAccessKey).toBe("secret/can/contain/slashes");
    expect(this.storage.getOptions().region).toBeUndefined();
  });

  it("[1] parameter string", () => {
    this.storage = new Storage(
      "s3://key:secret/can/contain/slashes?region=eu-west-2&bucketName=the-buck&sslEnabled=true"
    );
    expect(this.storage.getType()).toBe(StorageType.S3);
    expect(this.storage.getSelectedBucket()).toBe("the-buck");
    expect(this.storage.getConfiguration().accessKeyId).toBe("key");
    expect(this.storage.getConfiguration().secretAccessKey).toBe("secret/can/contain/slashes");
    expect(this.storage.getOptions().region).toBe("eu-west-2");
    expect(this.storage.getOptions().sslEnabled).toBe("true");
  });

  it("[2] typo", () => {
    this.storage = new Storage("s3://key:secret/can/contain/slashes?buckeName=the-buck");
    expect(this.storage.getSelectedBucket()).toBe("");
    expect(this.storage.getOptions().region).toBe(undefined);
  });

  it("[3] non-existent keys will not be filtered anymore", () => {
    this.storage = new Storage(
      [
        "s3://key:secret/can/contain/slashes",
        "?region=eu-west-2",
        "&bucketName=the-buck",
        "&sslEnabled=true",
        "&useDualstack=23",
        "&nonExistentKey=true",
        "&endPoint=https://kms-fips.us-west-2.amazonaws.com", // note: endpoint should not be camel cased
      ].join("")
    );
    expect(this.storage.getType()).toBe(StorageType.S3);
    expect(this.storage.getSelectedBucket()).toBe("the-buck");
    expect(this.storage.getConfiguration().accessKeyId).toBe("key");
    expect(this.storage.getConfiguration().secretAccessKey).toBe("secret/can/contain/slashes");
    expect(this.storage.getOptions().region).toBe("eu-west-2");
    expect(this.storage.getOptions().sslEnabled).toBe("true");
    expect(this.storage.getOptions().useDualStack).toBe(undefined);
    expect(this.storage.getOptions().nonExistentKey).toBe("true");
    expect(this.storage.getOptions().endpoint).toBe(undefined);
    expect(this.storage.getOptions().endPoint).toBe("https://kms-fips.us-west-2.amazonaws.com");
  });

  it("[4] object", () => {
    this.storage = new Storage({
      type: "s3",
      accessKeyId: "key",
      secretAccessKey: "secret/can/contain/slashes",
      bucketName: "the-buck",
      options: {
        region: "eu-west-2",
        sslEnabled: true,
      },
    });
    expect(this.storage.getType()).toBe(StorageType.S3);
    expect(this.storage.getSelectedBucket()).toBe("the-buck");
    expect(this.storage.getConfiguration().accessKeyId).toBe("key");
    expect(this.storage.getConfiguration().secretAccessKey).toBe("secret/can/contain/slashes");
    expect(this.storage.getOptions().region).toBe("eu-west-2");
    expect(this.storage.getOptions().sslEnabled).toBe(true);
    expect(this.storage.getConfiguration().options.region).toBe("eu-west-2");
    expect(this.storage.getConfiguration().options.sslEnabled).toBe(true);
  });

  it("[5] no bucket", () => {
    this.storage = new Storage({
      type: "s3",
      accessKeyId: "key",
      secretAccessKey: "secret/can/contain/slashes",
    });
    expect(this.storage.getSelectedBucket()).toBe("");
  });

  it("[6] number and boolean (object)", () => {
    this.storage = new Storage({
      type: "s3",
      accessKeyId: "key",
      secretAccessKey: "secret/can/contain/slashes",
      options: {
        optionNumber: 42,
        optionBoolean: true,
      },
    });
    expect(this.storage.getOptions().optionNumber).toBe(42);
    expect(this.storage.getOptions().optionBoolean).toBe(true);
  });

  it("[7] number and boolean (url)", () => {
    this.storage = new Storage(
      ["s3://key:secret/can/contain/slashes", "?optionNumber=42", "&optionBoolean=true"].join("")
    );
    expect(this.storage.getOptions().optionNumber).toBe("42");
    expect(this.storage.getOptions().optionBoolean).toBe("true");
  });
});
