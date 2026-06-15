# Photo Sharing

イベント、展示、ワークショップなどで写真を集め、その場でギャラリー表示できるシンプルな写真共有システムです。スマートフォンから複数枚をアップロードでき、同じページ内で閲覧、拡大表示、スライドショー、一括ZIPダウンロードができます。

## 主な機能

- 複数画像のアップロード
- JPG / PNG / GIF / WebP / HEIC / HEIF 対応
- ブラウザ側サムネイル生成と、サーバ側サムネイル生成のフォールバック
- 撮影日時または共有日時による並び替え
- ギャラリーの自動更新
- 写真の拡大表示、個別ダウンロード、スライドショー
- 選択画像の一括ZIPダウンロード
- 利用上の注意の初回確認フロー
- 管理モードでの個別削除、全削除、サムネイル診断
- 位置情報による閲覧制限と、閲覧パスワードによるバイパス
- タイトル、ロゴ、OGP、表示文言を `config.php` で差し替え

## 動作環境

- PHP 8.1 以上
- Webサーバ、または PHP 組み込みサーバ
- PHP拡張:
  - `fileinfo`: MIME判定に使用
  - `gd`: サーバ側サムネイル生成に使用
  - `exif`: 撮影日時ソートに使用
  - `zip`: `ZipArchive` で一括ZIPを作成する場合に使用
- `ZipArchive` が使えない場合は、`zip` コマンドと PHP の `exec` 関数
- モダンブラウザ

HEIC / HEIF はブラウザ側で `assets/vendor/heic-to/heic-to.js` を使ってプレビュー用サムネイルを生成します。元画像は再エンコードせず保存します。

## セットアップ

1. 設定ファイルを作成します。

```bash
cp config.example.php config.php
```

2. `config.php` を編集します。管理モードを使う場合は `ADMIN_PASSWORD` を設定してください。

```php
define('ADMIN_PASSWORD', 'your-admin-password');
```

3. アップロード先ディレクトリを用意します。

```bash
mkdir -p uploads
chmod 755 uploads
```

4. ローカルサーバを起動します。

```bash
php -S 127.0.0.1:8000
```

5. ブラウザで開きます。

```text
http://127.0.0.1:8000/
```

公開ページ本体は `index.php` です。

## 使い方

通常ページ:

```text
/
```

管理モード:

```text
/?admin=your-admin-password
```

管理モードでは、写真ごとの削除、全削除、サムネイル診断、位置制限設定ができます。

閲覧モード:

```text
/?view=your-view-password
```

閲覧モードは、位置制限を有効にしている場合でもGPS判定をバイパスしてギャラリーを閲覧できます。削除などの管理操作はできません。

初回投稿フローのデバッグ:

```text
/?debug_first_visit=1
```

ブラウザに利用上の注意の確認済み状態が保存されていても、初回ユーザとして扱います。

## 設定

`config.php` はGit管理外です。共有・デプロイ用のひな形は `config.example.php` を更新してください。

### 公開表示

- `APP_NAME`: サービス名
- `APP_PAGE_TITLE`: ブラウザタイトル
- `APP_DESCRIPTION`: meta description
- `APP_OG_TITLE` / `APP_OG_DESCRIPTION` / `APP_OG_IMAGE`: OGP用のタイトル、説明、画像
- `APP_LOGO_SRC` / `APP_LOGO_ALT`: トップに表示するロゴ画像と代替テキスト
- `APP_UPLOAD_TAGLINE`: ロゴ下の短い説明文
- `APP_GALLERY_EYEBROW`: ギャラリー見出しの小見出し
- `APP_USAGE_NOTES_TITLE` / `APP_USAGE_NOTES_CONTACT_TEXT`: 利用上の注意のタイトルと削除連絡文
- `APP_USAGE_NOTES_SECTIONS`: 利用上の注意全文を差し替える配列
- `APP_SLIDESHOW_TITLE`: スライドショーのタイトル

### アップロード

- `UPLOAD_DIR`: 画像保存先。絶対パス、またはプロジェクトルートからの相対パス
- `MAX_IMAGE_SIZE`: 1枚あたりの最大アップロードサイズ
- `MAX_UPLOAD_COUNT`: 一度にアップロードできる最大枚数
- `ALLOWED_IMAGE_EXTENSIONS`: 許可する画像拡張子
- `UPLOAD_SUCCESS_MESSAGE`: アップロード成功時の表示文
- `UPLOAD_RETENTION_SECONDS`: 自動削除までの秒数。`0` なら無効

### サムネイル

- `THUMBNAIL_MAX_WIDTH`: サーバ側サムネイルの最大幅
- `THUMBNAIL_MAX_HEIGHT`: サーバ側サムネイルの最大高さ
- `THUMBNAIL_JPEG_QUALITY`: サーバ側サムネイルのJPEG品質

管理モードの「サムネイル診断」から、GD関数、保存先、各画像のサムネイル状態を確認できます。

### ギャラリーとダウンロード

- `GALLERY_DEFAULT_SORT`: 初期並び順
- `GALLERY_DEFAULT_LIMIT`: 初期取得件数
- `GALLERY_MAX_LIMIT`: APIで取得できる最大件数
- `GALLERY_POLL_INTERVAL_SECONDS`: ギャラリーが新規画像を確認する間隔
- `DOWNLOAD_ZIP_MAX_FILES`: 一括ZIPダウンロードで選択できる最大枚数
- `DOWNLOAD_ZIP_MAX_BYTES`: 一括ZIPダウンロード対象の合計最大サイズ
- `DOWNLOAD_ZIP_COMMAND`: `ZipArchive` が使えない場合に利用する `zip` コマンド名またはパス
- `DOWNLOAD_ZIP_DEBUG`: ZIP作成失敗時に詳細エラーを表示するか

### 管理・閲覧

- `ADMIN_PASSWORD`: 管理モード用パスワード。空の場合、削除などの管理APIは無効
- `VIEW_PASSWORD`: 閲覧モード用パスワード。空の場合は `ADMIN_PASSWORD` を使用

パスワードはURLクエリに含まれるため、ログやアクセス解析に残る可能性があります。公開範囲に応じて十分に長い値を設定してください。

### 位置制限

位置制限は管理モードの「位置制限設定」から有効化・保存できます。設定は `api/location-settings.json` に保存され、このファイルはGit管理外です。

初期値をコード側で指定したい場合は、`config.php` に以下を定義できます。

```php
define('LOCATION_RESTRICT_ENABLED', false);
define('LOCATION_LAT', 0.0);
define('LOCATION_LNG', 0.0);
define('LOCATION_RADIUS_METERS', 1000);
```

ブラウザの位置情報APIは、通常 HTTPS または localhost でのみ利用できます。

## 保存データ

- 元画像: `UPLOAD_DIR`
- サムネイル: `UPLOAD_DIR/thumbnails`
- 撮影日時などのメタデータ: `UPLOAD_DIR/.metadata`
- 位置制限設定: `api/location-settings.json`

アップロード画像は再エンコードせず、元ファイルのまま保存します。撮影日時を取得できた場合のみ、ギャラリーの並び替え用データとして保存します。

## デプロイメモ

- `config.php` はデプロイ先で個別に作成してください。
- `UPLOAD_DIR` はPHP実行ユーザが書き込める必要があります。
- Web公開ディレクトリ外に `UPLOAD_DIR` を置いた場合も、画像は `api/image.php` 経由で表示されます。
- Apacheでは `api/.htaccess` がJSON設定ファイルへの直接アクセスを拒否します。
- NginxなどApache以外では、`api/*.json` への直接アクセスをWebサーバ側で拒否してください。
- このアプリは検索エンジン向けに `noindex` メタタグと `X-Robots-Tag` を返しますが、URLを知っている人からのアクセスを完全に防ぐものではありません。

## 開発メモ

PHP構文チェック:

```bash
php -l index.php
php -l api/bootstrap.php
php -l api/send.php
php -l api/list.php
php -l api/image.php
php -l api/admin.php
php -l api/download-zip.php
php -l api/gallery-settings.php
```
