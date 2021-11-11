# cloud-storage-repeat

- 環境変数で指定されたGCSバケットを走査するサンプル集です

# 実行例

Cloud Shell から実行します。

```shell
DATA=$(printf '{ "maxResults": 500 }'|base64) 
gcloud functions call cloudStorageImagesSetContentType --region asia-northeast2 --data '{"data":"'$DATA'"}'
```
