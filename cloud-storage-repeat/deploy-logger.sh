#!/bin/bash

# myprojectにデプロイする

my_project=$MY_PROJECT
my_bucket=$MY_BUCKET

gcloud functions deploy cloudStorageMetaDataLogging \
  --runtime=nodejs16 \
  --source=.\
  --region=asia-northeast1 \
  --entry-point=cloudStorageMetaDataLogging \
  --memory=512\
  --timeout=300s\
  --project=${my_project}\
  --trigger-topic=cloud-storage-token-topic\
  --set-env-vars=BUCKET_NAME=${my_bucket}
