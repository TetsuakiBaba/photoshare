<?php

require __DIR__ . '/bootstrap.php';

header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_response(405, ['ok' => false, 'error' => 'POSTメソッドで実行してください。']);
}

$payload = json_decode((string) file_get_contents('php://input'), true);
if (!is_array($payload)) {
    $payload = $_POST;
}

$action = (string) (isset($payload['action']) ? $payload['action'] : '');

if ($action === 'verify_view') {
    if (!view_password_is_configured()) {
        json_response(403, ['ok' => false, 'error' => '閲覧パスワードが設定されていません。config.phpでVIEW_PASSWORDまたはADMIN_PASSWORDを設定してください。']);
    }

    $password = (string) (isset($payload['password']) ? $payload['password'] : '');
    if (!verify_view_password($password)) {
        json_response(403, ['ok' => false, 'error' => '閲覧パスワードが違います。']);
    }

    json_response(200, ['ok' => true]);
}

if (!admin_password_is_configured()) {
    json_response(403, ['ok' => false, 'error' => '管理パスワードが設定されていません。config.phpでADMIN_PASSWORDを設定してください。']);
}

$password = (string) (isset($payload['password']) ? $payload['password'] : '');
if (!verify_admin_password($password)) {
    json_response(403, ['ok' => false, 'error' => '管理パスワードが違います。']);
}

if ($action === 'verify') {
    json_response(200, ['ok' => true]);
}

if ($action === 'thumbnail_diagnostics') {
    json_response(200, [
        'ok' => true,
        'diagnostics' => thumbnail_diagnostics(),
    ]);
}

if ($action === 'delete') {
    $name = (string) (isset($payload['name']) ? $payload['name'] : '');
    if (!is_safe_stored_name($name)) {
        json_response(400, ['ok' => false, 'error' => '削除対象のファイル名が不正です。']);
    }

    if (!delete_photo_file($name)) {
        json_response(404, ['ok' => false, 'error' => '削除対象のファイルが見つかりません。']);
    }

    json_response(200, ['ok' => true, 'deleted' => 1]);
}

if ($action === 'delete_all') {
    $uploadDir = upload_dir();
    $deleted = 0;
    $failed = 0;
    $generatedDeleted = 0;

    if (is_dir($uploadDir)) {
        foreach (new DirectoryIterator($uploadDir) as $entry) {
            if (!$entry->isFile()) {
                continue;
            }

            $filename = $entry->getFilename();
            if (!is_safe_stored_name($filename)) {
                continue;
            }

            if (delete_photo_file($filename)) {
                $deleted += 1;
            } else {
                $failed += 1;
            }
        }
    }

    foreach ([thumbnail_dir(), metadata_dir()] as $generatedDir) {
        if (!is_dir($generatedDir)) {
            continue;
        }

        foreach (new DirectoryIterator($generatedDir) as $entry) {
            if (!$entry->isFile()) {
                continue;
            }

            $filename = $entry->getFilename();
            if ($filename === '.htaccess' || $filename === '.gitkeep') {
                continue;
            }

            if (@unlink($entry->getPathname())) {
                $generatedDeleted += 1;
            }
        }
    }

    json_response(200, [
        'ok' => true,
        'deleted' => $deleted,
        'failed' => $failed,
        'generatedDeleted' => $generatedDeleted,
    ]);
}

if ($action === 'get_location_config') {
    json_response(200, [
        'ok' => true,
        'locationConfig' => get_location_settings(),
    ]);
}

if ($action === 'set_location_config') {
    $enabled = isset($payload['enabled']) ? (bool) $payload['enabled'] : false;
    $lat = isset($payload['lat']) ? (float) $payload['lat'] : 0.0;
    $lng = isset($payload['lng']) ? (float) $payload['lng'] : 0.0;
    $radiusMeters = isset($payload['radiusMeters']) ? (int) $payload['radiusMeters'] : 1000;

    if ($lat < -90 || $lat > 90) {
        json_response(400, ['ok' => false, 'error' => '緯度は-90〜90の範囲で入力してください。']);
    }
    if ($lng < -180 || $lng > 180) {
        json_response(400, ['ok' => false, 'error' => '経度は-180〜180の範囲で入力してください。']);
    }
    if ($radiusMeters < 1 || $radiusMeters > 100000) {
        json_response(400, ['ok' => false, 'error' => '半径は1〜100000mの範囲で入力してください。']);
    }

    $settings = ['enabled' => $enabled, 'lat' => $lat, 'lng' => $lng, 'radiusMeters' => $radiusMeters];
    if (!save_location_settings($settings)) {
        json_response(500, ['ok' => false, 'error' => '設定の保存に失敗しました。']);
    }

    json_response(200, ['ok' => true, 'locationConfig' => get_location_settings()]);
}

json_response(400, ['ok' => false, 'error' => '管理操作を選択してください。']);
