# 写真共有

スマホから写真を選ぶだけでアップロードでき、同じページ内のギャラリーで共有写真を閲覧できるシンプルな写真共有システムです。

## 動作環境

- PHP 8.1 以上
- Webサーバ、または PHP 組み込みサーバ
- PHP拡張:
  - fileinfo
  - gd（サムネイル生成を使う場合）
  - exif（撮影日時ソートを使う場合）
- モダンブラウザ

## Getting Started

1. 設定ファイルを作成します。

```bash
cp config.example.php config.php
```

2. `config.php` を編集します。最低限、管理モードを使う場合は `ADMIN_PASSWORD` を設定してください。

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

## 使い方

通常ページ:

```text
/
```

管理モード:

```text
/?admin=your-admin-password
```

管理モードは `admin` クエリにパスワードを含めてアクセスします。認証に成功すると、写真ごとの削除とアップロード済み写真の全削除ができます。

初回投稿フローのデバッグ:

```text
/?debug_first_visit=1
```

`debug_first_visit=1` を付けると、ブラウザに利用上の注意の確認済み状態が保存されていても、初めてアクセスしたユーザとして扱われます。アップロードボタンを押したときに利用上の注意モーダルが表示され、`確認しました` を押すと画像選択に進みます。

## 設定

`config.php` は管理パスワードなどの秘密情報を含むためGit管理外です。共有・デプロイ用のひな形は `config.example.php` を更新してください。

主な設定:

- `APP_NAME`: サービス名
- `APP_PAGE_TITLE`: ブラウザタイトル
- `APP_DESCRIPTION`: meta description
- `APP_OG_TITLE` / `APP_OG_DESCRIPTION` / `APP_OG_IMAGE`: OGP表示用のタイトル、説明、画像
- `APP_LOGO_SRC` / `APP_LOGO_ALT`: トップに表示するロゴ画像と代替テキスト
- `APP_UPLOAD_TAGLINE`: ロゴ下の短い説明文
- `APP_USAGE_NOTES_TITLE` / `APP_USAGE_NOTES_CONTACT_TEXT`: 利用上の注意のタイトルと削除連絡文
- `APP_USAGE_NOTES_SECTIONS`: 利用上の注意全文を差し替える配列
- `UPLOAD_DIR`: 画像保存先。絶対パス、またはプロジェクトルートからの相対パス
- `MAX_IMAGE_SIZE`: 1枚あたりの最大アップロードサイズ
- `MAX_UPLOAD_COUNT`: 一度にアップロードできる最大枚数
- `ALLOWED_IMAGE_EXTENSIONS`: 許可する画像拡張子
- `GALLERY_POLL_INTERVAL_SECONDS`: ギャラリーが新規画像を確認する間隔
- `DOWNLOAD_ZIP_MAX_FILES`: 一括ZIPダウンロードで選択できる最大枚数
- `DOWNLOAD_ZIP_MAX_BYTES`: 一括ZIPダウンロード対象の合計最大サイズ
- `DOWNLOAD_ZIP_COMMAND`: `ZipArchive` が使えない場合に利用する `zip` コマンド名またはパス
- `DOWNLOAD_ZIP_DEBUG`: ZIP作成失敗時に `zip` コマンドの詳細エラーを表示するか
- `ADMIN_PASSWORD`: 管理モード用パスワード。空の場合、削除APIは無効
- `VIEW_PASSWORD`: 閲覧モード用パスワード。`?view=パスワード` でGPS制限をバイパスして閲覧のみ可能。空の場合は `ADMIN_PASSWORD` を使用
- `UPLOAD_RETENTION_SECONDS`: 自動削除までの秒数。`0` なら無効

## メタデータ

アップロード画像は再エンコードせず、元ファイルのまま保存します。撮影日時を取得できた場合のみ、ギャラリーの並び替え用データとして `UPLOAD_DIR/.metadata` に保存します。

## デプロイメモ

- `config.php` はGit管理外のため、デプロイ先で個別に作成してください。
- 公開ページ本体は `index.php` です。
- `UPLOAD_DIR` はPHP実行ユーザが書き込める必要があります。
- Web公開ディレクトリ外に `UPLOAD_DIR` を置いた場合も、画像は `api/image.php` 経由で表示されます。
