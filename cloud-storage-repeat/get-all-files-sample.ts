import { File, Storage } from '@google-cloud/storage';

const BucketName = process.env.BUCKET_NAME!;
const gcs = new Storage();
const imageBucket = gcs.bucket(BucketName);

/**
 * CloudStorage上の全ファイルを取得します。
 */
async function getAllFiles(): Promise<string[]> {
    const result = [];
    let nextToken: string | undefined = undefined;
    do {
        // files 以外はドキュメントに明記されていない。型もany。
        // 結果から2番目の戻り値に nextToken があると確認したのでそれを使っている。
        let files: File[], query: any;
        [files, query] = await imageBucket.getFiles({
            autoPaginate: false,
            prefix: '',
            maxResults: 100,
            pageToken: nextToken,
        });

        const chunk = await Promise.all(files.map((f) => f.name));
        result.push(...chunk);
        nextToken = query?.pageToken;
    } while (nextToken);

    return result;
}

getAllFiles().then(console.log);