#!/usr/bin/env bash
# Deploy the built site to S3 and invalidate CloudFront.
# Requires AWS CLI configured. Set BUCKET and DISTRIBUTION_ID before running.
set -euo pipefail

: "${BUCKET:?Set BUCKET=your-s3-bucket-name}"
: "${DISTRIBUTION_ID:?Set DISTRIBUTION_ID=your-cloudfront-distribution-id}"

npm run build

# Hashed assets: long-lived immutable cache.
aws s3 sync dist/assets "s3://${BUCKET}/assets" \
  --delete \
  --cache-control "public, max-age=31536000, immutable"

# Everything else (index.html, favicon, robots.txt, fonts referenced by absolute URLs, etc.): no long cache.
aws s3 sync dist "s3://${BUCKET}" \
  --delete \
  --exclude "assets/*" \
  --cache-control "public, max-age=0, must-revalidate"

aws cloudfront create-invalidation \
  --distribution-id "${DISTRIBUTION_ID}" \
  --paths "/*"
