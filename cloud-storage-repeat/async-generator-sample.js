"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cloudStorageMetadataLogger = void 0;
const storage_1 = require("@google-cloud/storage");
const BucketName = process.env.BUCKET_NAME;
const gcs = new storage_1.Storage();
const imageBucket = gcs.bucket(BucketName);
async function cloudStorageMetadataLogger() {
    // Bucketからファイル一覧のかたまりを取得、かたまりごとにcontent-typeメタデータを是正
    let fileCount = 0;
    for await (const files of getAllImages()) {
        fileCount += files.length;
        for (const gcsFilePath of files) {
            const remoteFile = imageBucket.file(gcsFilePath);
            // Cloud Storage のオブジェクトメタデータから取得したContentType
            // ref: https://cloud.google.com/storage/docs/viewing-editing-metadata#storage-set-object-metadata-nodejs
            const [metadata] = await remoteFile.getMetadata();
            await cloudLogging('INFO', 'メタデータを検出しました', metadata);
        }
    }
    return console.log(`合計${fileCount}ファイルを処理しました。`);
}
exports.cloudStorageMetadataLogger = cloudStorageMetadataLogger;
/**
 * CloudStorage上の全画像を取得します。fileNameの配列をGenerate。
 */
async function* getAllImages() {
    // Cloud Storage から ディレクトリも含む一覧を取得
    let nextToken = undefined;
    do {
        // files 以外はドキュメントに明記されていない。型もany。
        // 結果から2番目の戻り値に nextToken があると確認したのでそれを使っている。
        let files, query;
        [files, query] = await imageBucket.getFiles({
            autoPaginate: false,
            prefix: '',
            maxResults: 100,
            pageToken: nextToken,
        });
        yield Promise.all(files.map((f) => f.name));
        nextToken = query?.pageToken;
    } while (nextToken);
}
/**
 * 構造化ログを出力します。
 */
async function cloudLogging(severity, text, gcsMetadata) {
    const { Logging } = require('@google-cloud/logging-min');
    const projectId = process.env.GCP_PROJECT || 'my-project';
    const logging = new Logging({ projectId });
    const logger = logging.logSync('cloud-storage-images-set-content-type');
    const metadata = {
        severity,
        resource: { type: 'cloud_function' }, // https://cloud.google.com/monitoring/api/resources#tag_cloud_function
    };
    const message = {
        infoMessage: text,
        gcsMetadata: gcsMetadata,
    };
    // Prepares a log entry
    const entry = logger.entry(metadata, message);
    logger.write(entry);
}
