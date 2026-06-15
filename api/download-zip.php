<?php

require __DIR__ . '/bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_response(405, ['ok' => false, 'error' => 'POSTメソッドでリクエストしてください。']);
}

$payload = json_decode((string) file_get_contents('php://input'), true);
if (!is_array($payload) || !isset($payload['names']) || !is_array($payload['names'])) {
    json_response(400, ['ok' => false, 'error' => 'ダウンロード対象の画像が指定されていません。']);
}

$maxFiles = max(1, config_int('DOWNLOAD_ZIP_MAX_FILES', 200));
$maxBytes = max(1, config_int('DOWNLOAD_ZIP_MAX_BYTES', 500 * 1024 * 1024));
$uploadDir = upload_dir();
$names = [];
$seen = [];
$totalBytes = 0;

foreach ($payload['names'] as $name) {
    $name = (string) $name;
    if (!is_safe_stored_name($name) || isset($seen[$name])) {
        continue;
    }

    $path = $uploadDir . '/' . $name;
    if (!is_file($path) || !is_readable($path)) {
        continue;
    }

    $fileSize = filesize($path);
    if ($fileSize === false) {
        continue;
    }

    if (count($names) >= $maxFiles) {
        json_response(413, ['ok' => false, 'error' => '一度にダウンロードできる枚数を超えています。']);
    }

    $totalBytes += (int) $fileSize;
    if ($totalBytes > $maxBytes) {
        json_response(413, ['ok' => false, 'error' => '選択画像の合計サイズが大きすぎます。']);
    }

    $seen[$name] = true;
    $names[] = $name;
}

if (count($names) === 0) {
    json_response(400, ['ok' => false, 'error' => 'ダウンロードできる画像がありません。']);
}

$zipTempPath = tempnam(sys_get_temp_dir(), 'photoshare_');
if ($zipTempPath === false) {
    json_response(500, ['ok' => false, 'error' => 'ZIPファイルを作成できませんでした。']);
}
$zipPath = $zipTempPath . '.zip';
@unlink($zipTempPath);

function create_zip_with_ziparchive($zipPath, $uploadDir, array $names)
{
    if (!class_exists('ZipArchive')) {
        return false;
    }

    $zip = new ZipArchive();
    if ($zip->open($zipPath, ZipArchive::OVERWRITE) !== true) {
        return false;
    }

    foreach ($names as $name) {
        $zip->addFile($uploadDir . '/' . $name, $name);
    }

    return $zip->close();
}

function create_zip_with_command($zipPath, $uploadDir, array $names, &$errorMessage)
{
    if (!function_exists('exec')) {
        $errorMessage = 'exec関数が利用できません。';
        return false;
    }

    @unlink($zipPath);

    $zipCommand = (string) config_value('DOWNLOAD_ZIP_COMMAND', 'zip');
    $arguments = [];
    foreach ($names as $name) {
        $arguments[] = escapeshellarg($name);
    }

    $currentDir = getcwd();
    if ($currentDir === false || !@chdir($uploadDir)) {
        $errorMessage = 'アップロードディレクトリに移動できません。';
        return false;
    }

    $command = escapeshellcmd($zipCommand)
        . ' -q ' . escapeshellarg($zipPath)
        . ' ' . implode(' ', $arguments)
        . ' 2>&1';

    $output = [];
    $exitCode = 1;
    @exec($command, $output, $exitCode);
    @chdir($currentDir);

    if ($exitCode !== 0) {
        $errorMessage = trim(implode("\n", $output));
        return false;
    }

    if (!is_file($zipPath)) {
        $errorMessage = 'zipコマンドは終了しましたが、ZIPファイルが見つかりません。';
        return false;
    }

    return true;
}

$zipCreated = create_zip_with_ziparchive($zipPath, $uploadDir, $names);
$zipCommandError = '';
if (!$zipCreated) {
    $zipCreated = create_zip_with_command($zipPath, $uploadDir, $names, $zipCommandError);
}

if (!$zipCreated) {
    @unlink($zipPath);
    $debugZip = (bool) config_value('DOWNLOAD_ZIP_DEBUG', false);
    $detail = $debugZip && $zipCommandError !== '' ? ' 詳細: ' . $zipCommandError : '';
    json_response(500, ['ok' => false, 'error' => 'ZIPファイルを作成できませんでした。ZipArchive拡張を有効化するか、zipコマンドとexec関数を利用可能にしてください。' . $detail]);
}

$zipSize = filesize($zipPath);
if ($zipSize === false) {
    @unlink($zipPath);
    json_response(500, ['ok' => false, 'error' => 'ZIPファイルを読み込めませんでした。']);
}

$downloadName = 'photos_' . date('Ymd_His') . '.zip';

header('Content-Type: application/zip');
header('Content-Disposition: attachment; filename="' . $downloadName . '"');
header('Content-Length: ' . (string) $zipSize);
header('Cache-Control: no-store');
send_noindex_header();
header('X-Content-Type-Options: nosniff');
readfile($zipPath);
@unlink($zipPath);
exit;
