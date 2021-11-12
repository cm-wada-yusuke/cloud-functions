# cloud-storage-repeat

- 環境変数で指定されたGCSバケットを走査するサンプル集です

## 実行例 - cloudStorageMetaDataLogging

ローカルからデプロイします。gcloudコマンドが使えること、対象のプロジェクトへ`gcloud auth login`していることが前提です。

```shell
MY_PROJECT=my-project-develop MY_BUCKET=uploads-dev ./deploy-logger.sh
```

Cloud Shell から実行します。

```shell
DATA=$(printf '{ "maxResults": 50 }'|base64)
gcloud functions call cloudStorageMetaDataLogging --region asia-northeast1 --data '{"data":"'$DATA'"}'
```
