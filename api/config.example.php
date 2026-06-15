<?php

// This file is kept as a reference for older deployments.
// The active configuration file is ../config.php.

define('UPLOAD_DIR', dirname(__DIR__) . '/uploads');
define('APP_TIMEZONE', 'Asia/Tokyo');
define('APP_NAME', 'Photo Sharing');
define('APP_PAGE_TITLE', 'Photo Sharing');
define('APP_DESCRIPTION', 'イベントやワークショップで写真をすばやく共有するためのシンプルなアップロードページです。');
define('APP_OG_TITLE', 'Photo Sharing');
define('APP_OG_DESCRIPTION', 'スマホから写真を選ぶだけで、同じページのギャラリーへ共有できます。');
define('APP_OG_IMAGE', 'assets/images/ogp.png');
define('APP_LOGO_SRC', 'assets/images/logo.svg');
define('APP_LOGO_ALT', '');
define('APP_UPLOAD_TAGLINE', '写真をみんなでシェアしよう。');
define('APP_USAGE_NOTES_TITLE', 'Photo Sharing 利用上の注意');
define('APP_USAGE_NOTES_STORAGE_KEY', 'photo-sharing-usage-notes-confirmed');
define('APP_USAGE_NOTES_CONTACT_TEXT', '権利者本人からの申し出、または運営判断により、画像を削除する場合があります。削除の申し出は運営までご連絡ください。');
define('MAX_IMAGE_SIZE', 25 * 1024 * 1024);
define('MAX_UPLOAD_COUNT', 20);
define('ALLOWED_IMAGE_EXTENSIONS', 'jpg,jpeg,png,gif,webp,heic,heif');
define('THUMBNAIL_MAX_WIDTH', 640);
define('THUMBNAIL_MAX_HEIGHT', 640);
define('THUMBNAIL_JPEG_QUALITY', 72);
define('GALLERY_DEFAULT_SORT', 'newest');
define('GALLERY_DEFAULT_LIMIT', 48);
define('GALLERY_MAX_LIMIT', 120);
define('GALLERY_POLL_INTERVAL_SECONDS', 10);
define('DOWNLOAD_ZIP_MAX_FILES', 200);
define('DOWNLOAD_ZIP_MAX_BYTES', 500 * 1024 * 1024);
define('DOWNLOAD_ZIP_COMMAND', 'zip');
define('DOWNLOAD_ZIP_DEBUG', false);
define('ADMIN_PASSWORD', getenv('ADMIN_PASSWORD') ?: '');
define('VIEW_PASSWORD', getenv('VIEW_PASSWORD') ?: '');
define('UPLOAD_RETENTION_SECONDS', 0);
define('UPLOAD_SUCCESS_MESSAGE', '写真が送信されました');
