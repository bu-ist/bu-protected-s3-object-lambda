function getOriginalS3Key(url) {
    // Reconstruct what the original image s3 key would be, by removing the image size from the URL.
    const originalUrl = url.replace(/-(\d+)x(\d+)\.(jpg|png)$/, '.$3');
    const parsedUrl = new URL(originalUrl);
    const { pathname } = parsedUrl;
    // The s3 key is the pathname without the leading slash.
    const s3Key = pathname.replace(/^\//, '');

    return s3Key;
}

module.exports = { getOriginalS3Key };
