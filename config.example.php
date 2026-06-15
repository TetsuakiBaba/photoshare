<?php

// Copy this file to config.php and adjust values for your environment.

// Absolute path, or a path relative to this project root.
define('UPLOAD_DIR', __DIR__ . '/uploads');
define('APP_TIMEZONE', 'Asia/Tokyo');

// Public branding and page text.
define('APP_NAME', 'Photo Sharing');
define('APP_PAGE_TITLE', 'Photo Sharing');
define('APP_DESCRIPTION', 'イベントやワークショップで写真をすばやく共有するためのシンプルなアップロードページです。');
define('APP_OG_TITLE', 'Photo Sharing');
define('APP_OG_DESCRIPTION', 'スマホから写真を選ぶだけで、同じページのギャラリーへ共有できます。');
define('APP_OG_IMAGE', 'assets/images/ogp.sample.png');
define('APP_LOGO_SRC', 'assets/images/logo.sample.svg');
define('APP_LOGO_ALT', '');
define('APP_UPLOAD_TAGLINE', '写真をみんなでシェアしよう。');
define('APP_UPLOAD_ARIA_LABEL', '写真共有');
define('APP_GALLERY_EYEBROW', 'Shared Photos');
define('APP_USAGE_NOTES_EYEBROW', 'Usage Notes');
define('APP_USAGE_NOTES_TITLE', 'Photo Sharing 利用上の注意');
define('APP_USAGE_NOTES_STORAGE_KEY', 'photo-sharing-usage-notes-confirmed');
define('APP_USAGE_NOTES_CONTACT_TEXT', '権利者本人からの申し出、または運営判断により、画像を削除する場合があります。削除の申し出は運営までご連絡ください。');
define('APP_SLIDESHOW_EYEBROW', 'Slideshow');
define('APP_SLIDESHOW_TITLE', '写真ギャラリー');
define('APP_FOOTER_TEXT', 'Powered by Photo Sharing');
define('APP_FOOTER_LINK_TEXT', 'ia-tmu/photoshare');
define('APP_FOOTER_LINK_URL', 'https://github.com/ia-tmu/photoshare');
define('APP_FOOTER_LICENSE_TEXT', 'MIT License');

// To replace all usage-note sections, define APP_USAGE_NOTES_SECTIONS as an array.
// define('APP_USAGE_NOTES_SECTIONS', [
//     [
//         'heading' => '1. 投稿について',
//         'paragraphs' => ['投稿権限を有する画像のみを投稿してください。'],
//         'items' => ['権利侵害や個人情報を含むものは投稿しないでください。'],
//     ],
// ]);

// Upload limits.
define('MAX_IMAGE_SIZE', 25 * 1024 * 1024);
define('MAX_UPLOAD_COUNT', 20);
define('ALLOWED_IMAGE_EXTENSIONS', 'jpg,jpeg,png,gif,webp,heic,heif');
define('THUMBNAIL_MAX_WIDTH', 512);
define('THUMBNAIL_MAX_HEIGHT', 512);
define('THUMBNAIL_JPEG_QUALITY', 72);

// Gallery behavior.
define('GALLERY_DEFAULT_SORT', 'newest');
define('GALLERY_DEFAULT_LIMIT', 48);
define('GALLERY_MAX_LIMIT', 120);
define('GALLERY_POLL_INTERVAL_SECONDS', 10);
define('DOWNLOAD_ZIP_MAX_FILES', 200);
define('DOWNLOAD_ZIP_MAX_BYTES', 500 * 1024 * 1024);
define('DOWNLOAD_ZIP_COMMAND', 'zip');
define('DOWNLOAD_ZIP_DEBUG', false);
define('ORIGINAL_IMAGE_ACCESS_ENABLED', true);

// Admin mode. Set a non-empty password to enable deletion via ?admin=password.
define('ADMIN_PASSWORD', getenv('ADMIN_PASSWORD') ?: '');
// View mode. ?view=password bypasses GPS restriction without admin deletion tools.
// If empty, ADMIN_PASSWORD is used for view mode.
define('VIEW_PASSWORD', getenv('VIEW_PASSWORD') ?: '');

// Cleanup behavior. Set to 0 to keep files indefinitely.
define('UPLOAD_RETENTION_SECONDS', 0);

// User-facing messages.
define('UPLOAD_SUCCESS_MESSAGE', '写真が送信されました');
