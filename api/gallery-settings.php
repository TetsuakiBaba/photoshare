<?php

require __DIR__ . '/bootstrap.php';

header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    json_response(405, ['ok' => false, 'error' => 'GETメソッドで取得してください。']);
}

json_response(200, [
    'ok' => true,
    'appConfig' => app_public_config(),
    'locationConfig' => get_location_settings(),
    'downloadZipMaxFiles' => max(1, config_int('DOWNLOAD_ZIP_MAX_FILES', 200)),
]);
