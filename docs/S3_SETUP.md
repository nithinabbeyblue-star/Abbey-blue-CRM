# AWS S3 file storage setup

Use S3 for ticket documents and chat attachments. The app uses **either** S3 **or** Google Drive; if both are configured, S3 is used first.

## 1. Create an S3 bucket

1. In [AWS Console](https://console.aws.amazon.com/) go to **S3** → **Create bucket**.
2. Choose a **bucket name** (e.g. `abbey-crm-uploads`) and a **region** (e.g. `eu-west-1`).
3. Leave block public access **on** (the app uses presigned URLs; the bucket itself stays private).
4. Create the bucket.

## 2. Create an IAM user for the app

1. Go to **IAM** → **Users** → **Create user** (e.g. `abbey-crm-s3`).
2. Attach a policy (or create an inline policy) that allows S3 access for this bucket only.

**Example policy** (replace `YOUR-BUCKET-NAME` with your bucket name):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject"
      ],
      "Resource": "arn:aws:s3:::YOUR-BUCKET-NAME/*"
    }
  ]
}
```

3. Create **Access keys** for this user: **Security credentials** → **Create access key** → choose “Application running outside AWS” (or CLI). Copy the **Access key ID** and **Secret access key**.

## 3. Add to `.env`

Add (use your real values):

```env
AWS_ACCESS_KEY_ID="AKIA..."
AWS_SECRET_ACCESS_KEY="..."
AWS_S3_BUCKET_NAME="abbey-crm-uploads"
AWS_S3_REGION="eu-west-1"
```

- **AWS_S3_BUCKET_NAME**: the bucket you created.
- **AWS_S3_REGION**: the bucket’s region (e.g. `eu-west-1`, `us-east-1`). Optional; defaults to `eu-west-1`.

## 4. Restart the app

Restart the dev server (or redeploy). Ticket documents and chat attachments will upload to S3. If both S3 and Google Drive are set, the app uses S3 first.
