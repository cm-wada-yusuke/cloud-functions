"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cloudStorageImagesSetContentType = void 0;
const storage_1 = require("@google-cloud/storage");
const fileType = require("file-type");
const pubsub_1 = require("@google-cloud/pubsub");
const path = require("path");
const BucketName = process.env.BUCKET_NAME;
const gcs = new storage_1.Storage();
const imageBucket = gcs.bucket(BucketName);
const pubsub = new pubsub_1.PubSub();
/**
 * PubSub経由で自分自身を呼び出す再帰関数です。
 * NextProps で定められた範囲を処理し、次の処理は改めて自分自身を呼び出します。
 * @param message PubSub から渡ってくるメッセージ
 * @param context トリガーのコンテキスト。後続でさらにトピックへメッセージを送るのに使う
 *   */
async function cloudStorageImagesSetContentType(message, context) {
    // Base64エンコードされたメッセージボディは data に格納されており、これがなければ終了
    if (!message.data) {
        return;
    }
    // NextProps をデコード
    const props = JSON.parse(Buffer.from(message.data, 'base64').toString());
    // PubSubメッセージには処理するべき範囲の情報が入っている
    // 定められた範囲のファイル名をCloudStorageから取得する
    const [fileNames, nextToken] = await getImageFileNames(props);
    // 担当ファイル分繰り返す
    for (const gcsFilePath of fileNames) {
        const remoteFile = imageBucket.file(gcsFilePath);
        // Cloud Storage のオブジェクトメタデータ
        // ref: https://cloud.google.com/storage/docs/viewing-editing-metadata#storage-set-object-metadata-nodejs
        const [metadata] = await remoteFile.getMetadata();
        // content-type が invalid/invalid のときは何か変なのでログを出してスキップ
        if (metadata.contentType?.includes('invalid')) {
            await cloudLogging('WARNING', 'contentTypeが不正なファイルを検出しました', metadata);
            continue;
        }
        // content-type が入っているなど置き換える必要がない場合はスキップ
        if (metadata.contentType) {
            console.log(`${gcsFilePath} には contentTypeがセットされていました：${metadata.contentType}。スキップします。`);
            continue;
        }
        // 拡張子が存在していて、処理対象の画像系以外であればスキップ。svgとか。
        const ext = path.extname(gcsFilePath);
        const isTargetExt = ['.png', '.jpeg', '.jpg', '.gif'].includes(ext);
        if (ext && !isTargetExt) {
            console.log(`${gcsFilePath} は処理対象の拡張子ではありません。スキップします。`);
            continue;
        }
        // ファイル名から拡張子が特定できず、なおかつ画像ファイルの contentType が空の場合
        // ストリームから memeType を検出
        const stream = remoteFile.createReadStream();
        const fileTypeResult = await fileType.fromStream(stream);
        console.log(gcsFilePath, `gcs metadata contentType: ${metadata.contentType}`, `mime-type: ${fileTypeResult?.mime}`);
        // mimeTypeが検出できない場合は不正ファイルを疑いログを出してスキップ
        if (!fileTypeResult?.mime) {
            await cloudLogging('WARNING', 'fileTypeからmimeTypeが検出できませんでした。不正なファイルかもしれません。', metadata, fileTypeResult);
            continue;
        }
        // stream から検出した mimeType に寄せる
        await replaceContentType(gcsFilePath, fileTypeResult.mime);
        await cloudLogging('INFO', `contentType: ${metadata.contentType} を ${fileTypeResult.mime} へ置き換えました。`, metadata, fileTypeResult);
    }
    // nextToken が存在する場合、次の関数を呼び出すためトピックへメッセージを送信する
    // 存在しない場合はなにもしない（おわり）
    if (nextToken) {
        // 'projects/my-project/topics/upload-image-type-replace-topic'
        const topicName = context.resource.name;
        const topic = pubsub.topic(topicName);
        const messageObject = {
            nextToken,
            maxResults: props.maxResults,
        };
        const messageBuffer = Buffer.from(JSON.stringify(messageObject), 'utf8');
        await topic.publish(messageBuffer);
    }
}
exports.cloudStorageImagesSetContentType = cloudStorageImagesSetContentType;
/**
 * Cloud Storage から パラメータ範囲のファイル名リストを抽出します
 * @returns [ファイル名の配列、次のトークン]
 */
async function getImageFileNames(nextProps) {
    // files 以外はドキュメントに明記されていない。型もany。
    // 実際に試した結果、2番目の戻り値に nextToken があると確認したのでそれを使う
    let files, query;
    [files, query] = await imageBucket.getFiles({
        autoPaginate: false,
        prefix: '',
        maxResults: nextProps.maxResults,
        pageToken: nextProps.nextToken,
    });
    const fileNames = await Promise.all(files.map((f) => f.name));
    return [fileNames, query?.pageToken];
}
/**
 * 置き換える判断をしたファイルについて、メタデータを編集します。
 * ref: https://cloud.google.com/storage/docs/viewing-editing-metadata#storage-set-object-metadata-nodejs
 * @param gcsFilePath リモートファイル名
 * @param mimeType このmimeTypeに置き換える
 */
async function replaceContentType(gcsFilePath, mimeType) {
    const [metadata] = await imageBucket.file(gcsFilePath).setMetadata({
        contentType: mimeType,
    });
    return metadata;
}
/**
 * 構造化ログを出力します。
 */
async function cloudLogging(severity, text, gcsMetadata, fileTypeResult) {
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
        fileTypeResult: fileTypeResult,
    };
    // Prepares a log entry
    const entry = logger.entry(metadata, message);
    logger.write(entry);
}
