# S3 + CloudFront deployment

This site is a static SPA. Recommended pattern: **private S3 bucket + CloudFront + Origin Access Control (OAC)**. Do **not** enable S3 static website hosting directly — it cannot serve the security headers below over HTTPS.

## 1. Build

```sh
npm ci
npm run build
```

Output goes to `dist/`.

## 2. Upload to S3

Set env vars and run:

```sh
BUCKET=your-bucket DISTRIBUTION_ID=YOUR_DIST_ID ./deploy/s3-deploy.sh
```

The script:
- syncs `dist/assets/*` with `Cache-Control: public, max-age=31536000, immutable` (safe because filenames are content-hashed)
- syncs the rest with `Cache-Control: public, max-age=0, must-revalidate`
- invalidates `/*` on CloudFront

## 3. CloudFront settings

- Origin: the S3 bucket via **Origin Access Control (OAC)**; block all public access on the bucket.
- Viewer protocol policy: **Redirect HTTP to HTTPS**.
- Allowed methods: **GET, HEAD** only.
- Default root object: `index.html`.
- SPA fallback: add a **Custom Error Response** for `403` and `404` → response code `200`, response page path `/index.html` (so client-side routes resolve).
- Compression: **enabled**.

## 4. Security response headers

Attach the response-headers policy in [`cloudfront-response-headers-policy.json`](./cloudfront-response-headers-policy.json) to the default cache behavior:

```sh
aws cloudfront create-response-headers-policy \
  --response-headers-policy-config file://deploy/cloudfront-response-headers-policy.json
```

Then bind the returned policy Id to your distribution's default behavior (`ResponseHeadersPolicyId`). This enforces:

- `Strict-Transport-Security` (HSTS, 2y + preload)
- `Content-Security-Policy` (strict, same-origin only)
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY` (clickjacking; also enforced by CSP `frame-ancestors 'none'`)
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy` disabling camera, mic, geo, USB, payment, etc.
- `Cross-Origin-Opener-Policy`, `Cross-Origin-Resource-Policy`, `Cross-Origin-Embedder-Policy`
- `Origin-Agent-Cluster: ?1`
- `X-XSS-Protection: 0` (legacy filter disabled per OWASP)

## 5. Bucket hardening checklist

- Block all public access (`BlockPublicAcls`, `IgnorePublicAcls`, `BlockPublicPolicy`, `RestrictPublicBuckets` = true).
- Bucket policy grants `s3:GetObject` **only** to the CloudFront distribution via OAC (`AWS:SourceArn` condition).
- Enable **default encryption** (SSE-S3 or SSE-KMS).
- Enable **versioning** + **MFA delete** for rollbacks.
- Enable **server access logging** to a separate log bucket.
- Deny insecure transport in bucket policy: `aws:SecureTransport = false` → `Deny`.

## 6. WAF (recommended)

Attach AWS WAF to the distribution with:
- `AWSManagedRulesCommonRuleSet`
- `AWSManagedRulesKnownBadInputsRuleSet`
- `AWSManagedRulesAmazonIpReputationList`
- Rate-based rule (e.g. 2000 req / 5 min / IP)
