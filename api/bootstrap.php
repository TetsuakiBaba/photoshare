<?php

$projectRoot = dirname(__DIR__);
$configPath = $projectRoot . '/config.php';
if (is_file($configPath)) {
    require_once $configPath;
}

function json_response($status, array $payload)
{
    http_response_code($status);
    send_noindex_header();
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function send_noindex_header()
{
    if (!headers_sent()) {
        header('X-Robots-Tag: noindex, nofollow, noarchive, noimageindex');
    }
}

function config_value($name, $fallback)
{
    if (defined($name)) {
        return constant($name);
    }

    $value = getenv($name);
    return $value === false || $value === '' ? $fallback : $value;
}

date_default_timezone_set((string) config_value('APP_TIMEZONE', 'Asia/Tokyo'));

function config_int($name, $fallback)
{
    return max(0, (int) config_value($name, $fallback));
}

function config_array($name, array $fallback)
{
    $value = config_value($name, $fallback);
    if (is_array($value)) {
        return array_values($value);
    }

    if (is_string($value)) {
        return array_values(array_filter(array_map('trim', explode(',', $value))));
    }

    return $fallback;
}

function config_string($name, $fallback)
{
    return (string) config_value($name, $fallback);
}

function html_escape($value)
{
    return htmlspecialchars((string) $value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

function app_usage_notes_sections()
{
    $fallback = [
        [
            'heading' => '1. 投稿について',
            'paragraphs' => [
                '投稿者は、自身が投稿権限を有する画像のみを投稿してください。',
                '以下に該当する画像の投稿は禁止します。',
            ],
            'items' => [
                '他者の著作権・肖像権・プライバシーを侵害するもの',
                '個人情報を含むもの',
                '誹謗中傷、公序良俗に反するもの',
                'その他、運営が不適切と判断するもの',
            ],
        ],
        [
            'heading' => '2. 著作権について',
            'paragraphs' => [
                '投稿画像の著作権は、原則として投稿者または権利者に帰属します。',
                '投稿者は、本サービス内での表示・サムネイル生成・運営上必要な範囲での利用を許諾するものとします。',
            ],
        ],
        [
            'heading' => '3. 公開範囲について',
            'paragraphs' => [
                '本サービスは限定共有を目的としていますが、URLを知っている人はアクセス可能です。',
                '完全な非公開サービスではありません。公開されても問題のない画像のみ投稿してください。',
            ],
        ],
        [
            'heading' => '4. 肖像権・転載について',
            'paragraphs' => [
                '人物が写っている画像を投稿する場合は、必要に応じて本人の了承を得てください。',
                '閲覧者による無断転載・再配布・スクリーンショット共有はご遠慮ください。',
            ],
        ],
        [
            'heading' => '5. メタデータについて',
            'paragraphs' => [
                '画像には撮影日時や位置情報などのメタデータ（EXIF）が含まれる場合があります。',
                '投稿前に必要に応じて各自で削除・確認を行ってください。',
            ],
        ],
        [
            'heading' => '6. 削除対応について',
            'paragraphs' => [
                config_string('APP_USAGE_NOTES_CONTACT_TEXT', '権利者本人からの申し出、または運営判断により、画像を削除する場合があります。削除の申し出は運営までご連絡ください。'),
            ],
        ],
    ];

    $sections = config_value('APP_USAGE_NOTES_SECTIONS', $fallback);
    return is_array($sections) ? $sections : $fallback;
}

function app_public_config()
{
    $name = config_string('APP_NAME', 'Photo Sharing');
    $description = config_string('APP_DESCRIPTION', 'イベント写真をすばやく共有するためのシンプルなアップロードページです。');

    return [
        'name' => $name,
        'pageTitle' => config_string('APP_PAGE_TITLE', $name),
        'description' => $description,
        'ogTitle' => config_string('APP_OG_TITLE', $name),
        'ogDescription' => config_string('APP_OG_DESCRIPTION', $description),
        'ogImage' => config_string('APP_OG_IMAGE', 'assets/images/ogp.png'),
        'logoSrc' => config_string('APP_LOGO_SRC', 'assets/images/logo.svg'),
        'logoAlt' => config_string('APP_LOGO_ALT', ''),
        'uploadTagline' => config_string('APP_UPLOAD_TAGLINE', '写真をみんなでシェアしよう。'),
        'uploadAriaLabel' => config_string('APP_UPLOAD_ARIA_LABEL', '写真共有'),
        'galleryEyebrow' => config_string('APP_GALLERY_EYEBROW', 'Shared Photos'),
        'usageNotesEyebrow' => config_string('APP_USAGE_NOTES_EYEBROW', 'Usage Notes'),
        'usageNotesTitle' => config_string('APP_USAGE_NOTES_TITLE', $name . ' 利用上の注意'),
        'usageNotesStorageKey' => config_string('APP_USAGE_NOTES_STORAGE_KEY', 'photo-sharing-usage-notes-confirmed'),
        'usageNotesSections' => app_usage_notes_sections(),
        'slideshowEyebrow' => config_string('APP_SLIDESHOW_EYEBROW', 'Slideshow'),
        'slideshowTitle' => config_string('APP_SLIDESHOW_TITLE', '写真ギャラリー'),
    ];
}

function is_absolute_path($path)
{
    return substr($path, 0, 1) === '/' || preg_match('/^[A-Za-z]:[\/\\\\]/', $path) === 1;
}

function project_root()
{
    return dirname(__DIR__);
}

function upload_dir()
{
    $configuredDir = (string) config_value('UPLOAD_DIR', project_root() . '/uploads');
    $configuredDir = rtrim($configuredDir, "/\\");

    if ($configuredDir === '') {
        return project_root() . '/uploads';
    }

    if (is_absolute_path($configuredDir)) {
        return $configuredDir;
    }

    return project_root() . '/' . $configuredDir;
}

function thumbnail_dir()
{
    return upload_dir() . '/thumbnails';
}

function metadata_dir()
{
    return upload_dir() . '/.metadata';
}

function allowed_image_extensions()
{
    return array_map(function ($extension) {
        return strtolower(ltrim((string) $extension, '.'));
    }, config_array('ALLOWED_IMAGE_EXTENSIONS', ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif']));
}

function is_allowed_image_name($name)
{
    $extension = strtolower((string) pathinfo($name, PATHINFO_EXTENSION));
    return $extension !== '' && in_array($extension, allowed_image_extensions(), true);
}

function random_suffix()
{
    if (function_exists('random_bytes')) {
        return bin2hex(random_bytes(5));
    }

    if (function_exists('openssl_random_pseudo_bytes')) {
        $bytes = openssl_random_pseudo_bytes(5);
        if ($bytes !== false) {
            return bin2hex($bytes);
        }
    }

    return substr(str_replace('.', '', uniqid('', true)), -10);
}

function safe_public_filename($originalName)
{
    $extension = strtolower((string) pathinfo($originalName, PATHINFO_EXTENSION));
    $extension = preg_replace('/[^a-z0-9]+/', '', $extension);
    if ($extension === null) {
        $extension = '';
    }
    $suffix = random_suffix();

    return date('Ymd_His') . '_' . $suffix . ($extension !== '' ? '.' . $extension : '');
}

function image_mime_type($path, $fallbackName = '')
{
    if (function_exists('finfo_open')) {
        $finfo = finfo_open(FILEINFO_MIME_TYPE);
        if ($finfo !== false) {
            $mime = finfo_file($finfo, $path);
            finfo_close($finfo);
            if (is_string($mime) && $mime !== '') {
                return $mime;
            }
        }
    }

    $extension = strtolower((string) pathinfo($fallbackName !== '' ? $fallbackName : $path, PATHINFO_EXTENSION));
    switch ($extension) {
        case 'jpg':
        case 'jpeg':
            return 'image/jpeg';
        case 'png':
            return 'image/png';
        case 'gif':
            return 'image/gif';
        case 'webp':
            return 'image/webp';
        case 'heic':
            return 'image/heic';
        case 'heif':
            return 'image/heif';
        default:
            return 'application/octet-stream';
    }
}

function thumbnail_name($originalName)
{
    $baseName = pathinfo($originalName, PATHINFO_FILENAME);
    $safeBaseName = preg_replace('/[^a-zA-Z0-9._-]+/', '-', $baseName);
    if (!is_string($safeBaseName) || $safeBaseName === '') {
        $safeBaseName = sha1($originalName);
    }

    return $safeBaseName . '.jpg';
}

function thumbnail_path($originalName)
{
    return thumbnail_dir() . '/' . thumbnail_name($originalName);
}

function metadata_path($originalName)
{
    return metadata_dir() . '/' . thumbnail_name($originalName) . '.json';
}

function ensure_thumbnail_dir()
{
    $thumbnailDir = thumbnail_dir();

    if (!is_dir($thumbnailDir)) {
        @mkdir($thumbnailDir, 0755, true);
    }

    return is_dir($thumbnailDir) && is_writable($thumbnailDir);
}

function ensure_metadata_dir()
{
    $metadataDir = metadata_dir();

    if (!is_dir($metadataDir)) {
        @mkdir($metadataDir, 0755, true);
    }

    if (!is_dir($metadataDir) || !is_writable($metadataDir)) {
        return false;
    }

    $htaccessPath = $metadataDir . '/.htaccess';
    if (!is_file($htaccessPath)) {
        @file_put_contents($htaccessPath, "Require all denied\n");
    }

    return true;
}

function image_resource_from_path($path, $mime)
{
    switch ($mime) {
        case 'image/jpeg':
            return function_exists('imagecreatefromjpeg') ? @imagecreatefromjpeg($path) : false;
        case 'image/png':
            return function_exists('imagecreatefrompng') ? @imagecreatefrompng($path) : false;
        case 'image/gif':
            return function_exists('imagecreatefromgif') ? @imagecreatefromgif($path) : false;
        case 'image/webp':
            return function_exists('imagecreatefromwebp') ? @imagecreatefromwebp($path) : false;
        default:
            return false;
    }
}

function thumbnail_support_for_mime($mime)
{
    switch ($mime) {
        case 'image/jpeg':
            return function_exists('imagecreatefromjpeg');
        case 'image/png':
            return function_exists('imagecreatefrompng');
        case 'image/gif':
            return function_exists('imagecreatefromgif');
        case 'image/webp':
            return function_exists('imagecreatefromwebp');
        default:
            return false;
    }
}

function thumbnail_diagnostics()
{
    $uploadDir = upload_dir();
    $thumbnailDir = thumbnail_dir();
    $thumbnailDirReady = ensure_thumbnail_dir();
    $hasCoreGd = function_exists('imagecreatetruecolor') && function_exists('imagecopyresampled') && function_exists('imagejpeg');

    $summary = [
        'total' => 0,
        'ready' => 0,
        'created' => 0,
        'fallback' => 0,
        'failed' => 0,
    ];
    $photos = [];

    if (is_dir($uploadDir)) {
        foreach (new DirectoryIterator($uploadDir) as $entry) {
            if (!$entry->isFile()) {
                continue;
            }

            $name = $entry->getFilename();
            if (!is_safe_stored_name($name)) {
                continue;
            }

            $summary['total'] += 1;
            $sourcePath = $entry->getPathname();
            $thumbnailPath = thumbnail_path($name);
            $thumbnailExistedBefore = is_file($thumbnailPath);
            $sourceSize = @getimagesize($sourcePath);
            $mime = image_mime_type($sourcePath, $name);
            $issues = [];

            if (!$hasCoreGd) {
                $issues[] = 'GDの基本関数(imagecreatetruecolor/imagecopyresampled/imagejpeg)が不足しています。';
            }
            if (!$thumbnailDirReady) {
                $issues[] = 'サムネイル保存先を作成または書き込みできません。';
            }
            if (!is_array($sourceSize) || count($sourceSize) < 2) {
                $issues[] = '画像サイズを取得できません。';
            }
            if (!thumbnail_support_for_mime($mime)) {
                $issues[] = $mime . ' のサムネイル生成に必要なGD関数がありません。';
            }

            $ok = ensure_thumbnail_for($name);
            $thumbnailExistsAfter = is_file($thumbnailPath);
            $created = !$thumbnailExistedBefore && $thumbnailExistsAfter;

            if ($ok) {
                $summary['ready'] += 1;
                if ($created) {
                    $summary['created'] += 1;
                }
            } else {
                $summary['fallback'] += 1;
                $summary['failed'] += 1;
                if (count($issues) === 0) {
                    $issues[] = 'サムネイル生成に失敗しました。画像の破損またはサーバー環境を確認してください。';
                }
            }

            $photos[] = [
                'name' => $name,
                'mime' => $mime,
                'originalSize' => is_file($sourcePath) ? filesize($sourcePath) : 0,
                'originalWidth' => is_array($sourceSize) && isset($sourceSize[0]) ? (int) $sourceSize[0] : null,
                'originalHeight' => is_array($sourceSize) && isset($sourceSize[1]) ? (int) $sourceSize[1] : null,
                'thumbnailName' => thumbnail_name($name),
                'thumbnailExists' => $thumbnailExistsAfter,
                'thumbnailCreated' => $created,
                'thumbnailSize' => $thumbnailExistsAfter ? filesize($thumbnailPath) : 0,
                'usesOriginalFallback' => !$ok,
                'issues' => $issues,
            ];
        }
    }

    return [
        'environment' => [
            'phpVersion' => PHP_VERSION,
            'uploadDir' => $uploadDir,
            'uploadDirExists' => is_dir($uploadDir),
            'uploadDirReadable' => is_readable($uploadDir),
            'thumbnailDir' => $thumbnailDir,
            'thumbnailDirExists' => is_dir($thumbnailDir),
            'thumbnailDirWritable' => is_writable($thumbnailDir),
            'thumbnailDirReady' => $thumbnailDirReady,
            'thumbnailMaxWidth' => config_int('THUMBNAIL_MAX_WIDTH', 640),
            'thumbnailMaxHeight' => config_int('THUMBNAIL_MAX_HEIGHT', 640),
            'thumbnailJpegQuality' => config_int('THUMBNAIL_JPEG_QUALITY', 72),
            'gdFunctions' => [
                'imagecreatetruecolor' => function_exists('imagecreatetruecolor'),
                'imagecopyresampled' => function_exists('imagecopyresampled'),
                'imagejpeg' => function_exists('imagejpeg'),
                'imagecreatefromjpeg' => function_exists('imagecreatefromjpeg'),
                'imagecreatefrompng' => function_exists('imagecreatefrompng'),
                'imagecreatefromgif' => function_exists('imagecreatefromgif'),
                'imagecreatefromwebp' => function_exists('imagecreatefromwebp'),
            ],
        ],
        'summary' => $summary,
        'photos' => $photos,
    ];
}

function normalized_exif_datetime($value)
{
    $value = trim((string) $value);
    if ($value === '' || strpos($value, '0000:00:00') === 0) {
        return null;
    }

    if (!preg_match('/^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/', $value, $matches)) {
        return null;
    }

    $timezone = new DateTimeZone(date_default_timezone_get());
    $date = DateTimeImmutable::createFromFormat(
        '!Y-m-d H:i:s',
        $matches[1] . '-' . $matches[2] . '-' . $matches[3] . ' ' . $matches[4] . ':' . $matches[5] . ':' . $matches[6],
        $timezone
    );

    return $date === false ? null : $date->getTimestamp();
}

function extract_capture_timestamp($path)
{
    if (!function_exists('exif_read_data') || !is_file($path)) {
        return null;
    }

    $exif = @exif_read_data($path);
    if (!is_array($exif)) {
        return null;
    }

    foreach (['DateTimeOriginal', 'DateTimeDigitized', 'DateTime'] as $key) {
        if (!isset($exif[$key])) {
            continue;
        }

        $timestamp = normalized_exif_datetime($exif[$key]);
        if ($timestamp !== null) {
            return $timestamp;
        }
    }

    return null;
}

function write_photo_metadata($originalName, array $metadata)
{
    if (!is_safe_stored_name($originalName) || !ensure_metadata_dir()) {
        return false;
    }

    $payload = [
        'capturedAt' => isset($metadata['capturedAt']) ? $metadata['capturedAt'] : null,
        'capturedTimestamp' => isset($metadata['capturedTimestamp']) ? $metadata['capturedTimestamp'] : null,
    ];

    return @file_put_contents(
        metadata_path($originalName),
        json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)
    ) !== false;
}

function read_photo_metadata($originalName)
{
    if (!is_safe_stored_name($originalName)) {
        return [];
    }

    $path = metadata_path($originalName);
    if (!is_file($path)) {
        return [];
    }

    $metadata = json_decode((string) @file_get_contents($path), true);
    return is_array($metadata) ? $metadata : [];
}

function delete_photo_metadata($originalName)
{
    if (!is_safe_stored_name($originalName)) {
        return;
    }

    $path = metadata_path($originalName);
    if (is_file($path)) {
        @unlink($path);
    }
}

function delete_photo_file($originalName)
{
    if (!is_safe_stored_name($originalName)) {
        return false;
    }

    $sourcePath = upload_dir() . '/' . $originalName;
    $deleted = false;

    if (is_file($sourcePath)) {
        $deleted = @unlink($sourcePath);
    }

    $thumbnailPath = thumbnail_path($originalName);
    if (is_file($thumbnailPath)) {
        @unlink($thumbnailPath);
    }

    delete_photo_metadata($originalName);

    return $deleted;
}

function admin_password()
{
    return (string) config_value('ADMIN_PASSWORD', '');
}

function admin_password_is_configured()
{
    return admin_password() !== '';
}

function verify_admin_password($password)
{
    $configuredPassword = admin_password();
    return $configuredPassword !== '' && hash_equals($configuredPassword, (string) $password);
}

function view_password()
{
    $configuredPassword = (string) config_value('VIEW_PASSWORD', '');
    return $configuredPassword !== '' ? $configuredPassword : admin_password();
}

function view_password_is_configured()
{
    return view_password() !== '';
}

function verify_view_password($password)
{
    $configuredPassword = view_password();
    return $configuredPassword !== '' && hash_equals($configuredPassword, (string) $password);
}

function create_thumbnail($sourcePath, $originalName)
{
    if (!function_exists('imagecreatetruecolor') || !function_exists('imagejpeg') || !ensure_thumbnail_dir()) {
        return false;
    }

    $sourceSize = @getimagesize($sourcePath);
    if (!is_array($sourceSize) || count($sourceSize) < 2) {
        return false;
    }

    $sourceWidth = (int) $sourceSize[0];
    $sourceHeight = (int) $sourceSize[1];
    if ($sourceWidth <= 0 || $sourceHeight <= 0) {
        return false;
    }

    $mime = image_mime_type($sourcePath, $originalName);
    $sourceImage = image_resource_from_path($sourcePath, $mime);
    if ($sourceImage === false) {
        return false;
    }

    $maxWidth = max(1, config_int('THUMBNAIL_MAX_WIDTH', 640));
    $maxHeight = max(1, config_int('THUMBNAIL_MAX_HEIGHT', 640));
    $scale = min($maxWidth / $sourceWidth, $maxHeight / $sourceHeight, 1);
    $targetWidth = max(1, (int) round($sourceWidth * $scale));
    $targetHeight = max(1, (int) round($sourceHeight * $scale));

    $thumbnailImage = imagecreatetruecolor($targetWidth, $targetHeight);
    if ($thumbnailImage === false) {
        imagedestroy($sourceImage);
        return false;
    }

    $background = imagecolorallocate($thumbnailImage, 255, 255, 255);
    imagefill($thumbnailImage, 0, 0, $background);

    $resampled = imagecopyresampled(
        $thumbnailImage,
        $sourceImage,
        0,
        0,
        0,
        0,
        $targetWidth,
        $targetHeight,
        $sourceWidth,
        $sourceHeight
    );

    $saved = false;
    if ($resampled) {
        $quality = max(1, min(100, config_int('THUMBNAIL_JPEG_QUALITY', 72)));
        $saved = imagejpeg($thumbnailImage, thumbnail_path($originalName), $quality);
    }

    imagedestroy($thumbnailImage);
    imagedestroy($sourceImage);

    return $saved;
}

function ensure_thumbnail_for($originalName)
{
    if (!is_safe_stored_name($originalName)) {
        return false;
    }

    $sourcePath = upload_dir() . '/' . $originalName;
    if (!is_file($sourcePath)) {
        return false;
    }

    $targetPath = thumbnail_path($originalName);
    if (is_file($targetPath) && filemtime($targetPath) >= filemtime($sourcePath)) {
        return true;
    }

    return create_thumbnail($sourcePath, $originalName);
}

function is_safe_stored_name($name)
{
    return $name !== '' && basename($name) === $name && is_allowed_image_name($name);
}

function format_iso_time($timestamp)
{
    return date('c', $timestamp);
}

function location_settings_path()
{
    return __DIR__ . '/location-settings.json';
}

function get_location_settings()
{
    $defaults = [
        'enabled' => (bool) config_value('LOCATION_RESTRICT_ENABLED', false),
        'lat' => (float) config_value('LOCATION_LAT', 0.0),
        'lng' => (float) config_value('LOCATION_LNG', 0.0),
        'radiusMeters' => max(1, config_int('LOCATION_RADIUS_METERS', 1000)),
    ];

    $path = location_settings_path();
    if (!is_file($path)) {
        return $defaults;
    }

    $data = json_decode((string) @file_get_contents($path), true);
    if (!is_array($data)) {
        return $defaults;
    }

    return [
        'enabled' => array_key_exists('enabled', $data) ? (bool) $data['enabled'] : $defaults['enabled'],
        'lat' => array_key_exists('lat', $data) ? (float) $data['lat'] : $defaults['lat'],
        'lng' => array_key_exists('lng', $data) ? (float) $data['lng'] : $defaults['lng'],
        'radiusMeters' => array_key_exists('radiusMeters', $data) ? max(1, (int) $data['radiusMeters']) : $defaults['radiusMeters'],
    ];
}

function save_location_settings(array $settings)
{
    $path = location_settings_path();
    $data = [
        'enabled' => (bool) $settings['enabled'],
        'lat' => (float) $settings['lat'],
        'lng' => (float) $settings['lng'],
        'radiusMeters' => max(1, (int) $settings['radiusMeters']),
    ];

    return @file_put_contents($path, json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT)) !== false;
}

function photo_entries()
{
    $uploadDir = upload_dir();
    if (!is_dir($uploadDir)) {
        return [];
    }

    $entries = [];
    foreach (new DirectoryIterator($uploadDir) as $entry) {
        if (!$entry->isFile()) {
            continue;
        }

        $name = $entry->getFilename();
        if (!is_safe_stored_name($name)) {
            continue;
        }

        $timestamp = $entry->getMTime();
        $metadata = read_photo_metadata($name);
        $capturedTimestamp = isset($metadata['capturedTimestamp']) ? (int) $metadata['capturedTimestamp'] : null;
        if ($capturedTimestamp !== null && $capturedTimestamp <= 0) {
            $capturedTimestamp = null;
        }
        $capturedAt = isset($metadata['capturedAt']) && is_string($metadata['capturedAt']) ? $metadata['capturedAt'] : null;

        $entries[] = [
            'id' => $name,
            'name' => $name,
            'url' => 'api/image.php?name=' . rawurlencode($name) . '&variant=original',
            'originalUrl' => 'api/image.php?name=' . rawurlencode($name) . '&variant=original',
            'thumbnailUrl' => 'api/image.php?name=' . rawurlencode($name) . '&variant=thumbnail',
            'uploadedAt' => format_iso_time($timestamp),
            'timestamp' => $timestamp,
            'capturedAt' => $capturedAt,
            'capturedTimestamp' => $capturedTimestamp,
            'size' => $entry->getSize(),
        ];
    }

    return $entries;
}
