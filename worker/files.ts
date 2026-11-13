import { AwsClient } from "aws4fetch";
import { JobError } from "./types";

/** Where uploaded files live. S3Files is the real one; tests use a stub. */
export interface FileStore {
  /** Fetches a stored file, refusing anything larger than maxBytes. */
  download(key: string, maxBytes: number, signal: AbortSignal): Promise<Buffer>;
  /** Removes a stored file. Removing one that is already gone is fine. */
  remove(key: string, signal: AbortSignal): Promise<void>;
}

const BUCKET = "matter-files";
const KEY = /^[0-9a-f-]{36}(\/[0-9a-f-]{36}){3}$/;

export interface S3Settings {
  /** e.g. https://<project>.storage.supabase.co/storage/v1/s3 */
  endpoint: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
}

/**
 * Supabase Storage through its S3-compatible API, with an access key that
 * reaches file storage only (not the database). Only the worker holds it;
 * the website never does: people get short-lived signed links instead.
 */
export class S3Files implements FileStore {
  private readonly aws: AwsClient;
  private readonly base: string;

  constructor(s: S3Settings) {
    this.aws = new AwsClient({
      accessKeyId: s.accessKeyId,
      secretAccessKey: s.secretAccessKey,
      region: s.region,
      service: "s3",
    });
    this.base = s.endpoint.replace(/\/$/, "");
  }

  private url(key: string) {
    if (!KEY.test(key))
      throw new JobError("The stored file has an unexpected name.", false);
    return `${this.base}/${BUCKET}/${key}`;
  }

  async download(key: string, maxBytes: number, signal: AbortSignal) {
    const res = await this.aws.fetch(this.url(key), { signal });
    if (res.status === 404)
      throw new JobError("The uploaded file could not be found.", false);
    if (!res.ok || !res.body)
      throw new JobError("File storage is not responding. Will retry.");
    const parts: Uint8Array[] = [];
    let size = 0;
    const reader = res.body.getReader();
    for (;;) {
      const { done, value: part } = await reader.read();
      if (done) break;
      size += part.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        throw new JobError("The file is larger than the 20 MB limit.", false);
      }
      parts.push(part);
    }
    return Buffer.concat(parts);
  }

  async remove(key: string, signal: AbortSignal) {
    const res = await this.aws.fetch(this.url(key), {
      method: "DELETE",
      signal,
    });
    if (!res.ok && res.status !== 404)
      throw new JobError("File storage is not responding. Will retry.");
  }
}

/** Reads S3 settings from the environment; undefined if any is missing. */
export function s3FromEnv(
  env: Record<string, string | undefined> = process.env,
): S3Settings | undefined {
  const endpoint = env.CASEVEX_WORKER_S3_ENDPOINT;
  const region = env.CASEVEX_WORKER_S3_REGION;
  const accessKeyId = env.CASEVEX_WORKER_S3_KEY_ID;
  const secretAccessKey = env.CASEVEX_WORKER_S3_SECRET;
  if (!endpoint || !region || !accessKeyId || !secretAccessKey) return;
  return { endpoint, region, accessKeyId, secretAccessKey };
}
