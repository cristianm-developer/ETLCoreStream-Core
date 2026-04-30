declare module "streamsaver" {
  export interface FilesystemPromise {
    createWritable(filename: string): Promise<WritableStream>;
  }

  const streamSaver: FilesystemPromise;
  export default streamSaver;
}
