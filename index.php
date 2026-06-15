<?php
require __DIR__ . '/api/bootstrap.php';

$appConfig = app_public_config();
$usageNotesSections = is_array($appConfig['usageNotesSections']) ? $appConfig['usageNotesSections'] : [];
?>
<!doctype html>
<html lang="ja">

<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title><?= html_escape($appConfig['pageTitle']) ?></title>
  <meta name="description" content="<?= html_escape($appConfig['description']) ?>" />
  <meta name="robots" content="noindex, nofollow, noarchive, noimageindex" />
  <meta name="googlebot" content="noindex, nofollow, noarchive, noimageindex" />
  <meta name="bingbot" content="noindex, nofollow, noarchive" />
  <meta property="og:title" content="<?= html_escape($appConfig['ogTitle']) ?>" />
  <meta property="og:description" content="<?= html_escape($appConfig['ogDescription']) ?>" />
  <meta property="og:type" content="website" />
  <meta property="og:image" content="<?= html_escape($appConfig['ogImage']) ?>" />
  <meta name="twitter:card" content="summary_large_image" />
  <link rel="stylesheet" href="assets/css/styles.css" />
  <script>
    window.photoShareConfig = <?= json_encode($appConfig, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?>;
  </script>
</head>

<body>
  <main>
    <section class="upload-shell">
      <button id="license-info-button" class="license-info-button" type="button" aria-label="画像のライセンスと取り扱いを確認">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 11v6" />
          <path d="M12 7.2v.1" />
        </svg>
      </button>

      <section class="upload-composer" aria-label="<?= html_escape($appConfig['uploadAriaLabel']) ?>">
        <header class="upload-header">
          <img class="site-logo" src="<?= html_escape($appConfig['logoSrc']) ?>" alt="<?= html_escape($appConfig['logoAlt']) ?>" />
          <p><?= html_escape($appConfig['uploadTagline']) ?></p>
        </header>

        <div class="upload-stage">
          <button id="upload-button" class="upload-button" type="button" aria-label="写真を選択してアップロード">
            <span class="upload-progress" aria-hidden="true"></span>
            <svg class="upload-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 16V4" />
              <path d="m7 9 5-5 5 5" />
              <path d="M5 20h14" />
            </svg>
            <span class="upload-badge" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <path
                  d="M6.5 7.5 8.2 5h7.6l1.7 2.5H20a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9.5a2 2 0 0 1 2-2h2.5Z" />
                <circle cx="12" cy="13.5" r="3.2" />
              </svg>
            </span>
          </button>

          <input id="photo-input" name="photos[]" type="file"
            accept="image/jpeg,image/png,image/gif,image/webp,image/heic,image/heif,.heic,.heif" multiple />
        </div>
        <p id="upload-status" class="status" role="status" aria-live="polite"></p>
      </section>
      <button id="gallery-scroll-button" class="scroll-cue" type="button" aria-label="写真ギャラリーへスクロール">
        <span class="scroll-cue-photos">
          <span></span>
          <span></span>
          <span></span>
        </span>
        <svg viewBox="0 0 24 24">
          <path d="M12 5v14" />
          <path d="m6 13 6 6 6-6" />
        </svg>
      </button>
    </section>

    <section id="gallery-section" class="gallery-shell">
      <header class="gallery-header">
        <div>
          <p class="eyebrow"><?= html_escape($appConfig['galleryEyebrow']) ?></p>
        </div>

        <div class="gallery-actions">
          <button id="clear-selection-button" class="clear-selection-button" type="button" disabled>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
            <span>選択解除</span>
          </button>

          <button id="download-selected-button" class="download-selected-button" type="button" disabled>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 3v12" />
              <path d="m7 10 5 5 5-5" />
              <path d="M5 21h14" />
            </svg>
            <span>選択画像をまとめてダウンロード</span>
          </button>

          <button id="slideshow-button" class="slideshow-button" type="button" aria-label="スライドショーを開始">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M8 5v14l11-7-11-7Z" />
            </svg>
            <span>スライドショー</span>
          </button>

          <label class="sort-control" for="sort-select">
            <span>並び順</span>
            <select id="sort-select" name="sort">
              <option value="newest" selected>新しい順</option>
              <option value="oldest">古い順</option>
              <option value="captured_newest">撮影日時 新しい順</option>
              <option value="captured_oldest">撮影日時 古い順</option>
              <option value="name_asc">ファイル名 A-Z</option>
              <option value="name_desc">ファイル名 Z-A</option>
            </select>
          </label>
        </div>
      </header>

      <p id="gallery-status" class="gallery-status" role="status" aria-live="polite"></p>
      <section id="photo-grid" class="photo-grid" aria-label="共有写真一覧"></section>
      <div id="gallery-sentinel" class="gallery-sentinel" aria-hidden="true">
        <span></span>
      </div>
    </section>
  </main>

  <dialog id="preview-dialog" class="preview-dialog" aria-labelledby="preview-title">
    <section id="preview-panel" class="preview-panel" aria-labelledby="preview-title" hidden>
      <div class="preview-header">
        <div>
          <h2 id="preview-title">この写真を送信しますか？</h2>
          <p id="preview-count">0枚選択中</p>
        </div>
        <button id="clear-button" class="text-button" type="button">選び直す</button>
      </div>

      <ul id="preview-list" class="preview-list" aria-label="送信前の写真プレビュー"></ul>

      <div id="upload-progress-bar" class="upload-progress-bar" role="progressbar" aria-label="アップロード進捗"
        aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" hidden>
        <span></span>
      </div>

      <div class="preview-actions">
        <button id="select-more-button" class="secondary-button" type="button">写真を追加</button>
        <button id="send-button" class="primary-button" type="button">送信する</button>
      </div>
    </section>
  </dialog>

  <dialog id="zip-progress-dialog" class="zip-progress-dialog" aria-labelledby="zip-progress-title">
    <section class="zip-progress-panel">
      <h2 id="zip-progress-title">ZIPファイルを準備しています</h2>
      <p id="zip-progress-message">選択画像をZIPにまとめています...</p>
      <div id="zip-progress-bar" class="zip-progress-bar is-indeterminate" role="progressbar" aria-label="ZIPダウンロード準備"
        aria-valuemin="0" aria-valuemax="100">
        <span></span>
      </div>
      <div class="zip-progress-actions">
        <button id="zip-progress-close" class="secondary-button" type="button" hidden>閉じる</button>
      </div>
    </section>
  </dialog>

  <dialog id="license-dialog" class="license-dialog" aria-labelledby="license-title">
    <section class="license-panel">
      <header class="license-header">
        <div>
          <p class="eyebrow"><?= html_escape($appConfig['usageNotesEyebrow']) ?></p>
          <h2 id="license-title"><?= html_escape($appConfig['usageNotesTitle']) ?></h2>
        </div>
        <button id="license-close-button" class="license-close-button" type="button" aria-label="説明を閉じる">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
          </svg>
        </button>
      </header>

      <div class="license-content">
        <?php foreach ($usageNotesSections as $section): ?>
          <?php
          $heading = is_array($section) && isset($section['heading']) ? $section['heading'] : '';
          $paragraphs = is_array($section) && isset($section['paragraphs']) && is_array($section['paragraphs']) ? $section['paragraphs'] : [];
          $items = is_array($section) && isset($section['items']) && is_array($section['items']) ? $section['items'] : [];
          ?>
          <section>
            <?php if ($heading !== ''): ?>
              <h3><?= html_escape($heading) ?></h3>
            <?php endif; ?>
            <?php foreach ($paragraphs as $paragraph): ?>
              <p><?= html_escape($paragraph) ?></p>
            <?php endforeach; ?>
            <?php if (count($items) > 0): ?>
              <ul>
                <?php foreach ($items as $item): ?>
                  <li><?= html_escape($item) ?></li>
                <?php endforeach; ?>
              </ul>
            <?php endif; ?>
          </section>
        <?php endforeach; ?>
      </div>

      <footer class="license-actions">
        <button id="license-confirm-button" class="primary-button" type="button">確認しました</button>
      </footer>
    </section>
  </dialog>

  <dialog id="slideshow-dialog" class="slideshow-dialog" aria-labelledby="slideshow-title">
    <section class="slideshow-stage" aria-label="写真スライドショー">
      <header class="slideshow-toolbar">
        <div>
          <p class="eyebrow"><?= html_escape($appConfig['slideshowEyebrow']) ?></p>
          <h2 id="slideshow-title"><?= html_escape($appConfig['slideshowTitle']) ?></h2>
          <p id="slideshow-counter" class="slideshow-counter">0 / 0</p>
        </div>
        <button id="slideshow-close-button" class="slideshow-close-button" type="button" aria-label="スライドショーを閉じる">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
          </svg>
        </button>
      </header>

      <div class="slideshow-carousel" aria-live="polite">
        <div id="slideshow-track" class="slideshow-track"></div>
      </div>

      <div class="slideshow-controls" aria-label="スライドショー操作">
        <button id="slideshow-prev-button" class="slideshow-nav-button" type="button" aria-label="前の写真">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="m15 18-6-6 6-6" />
          </svg>
        </button>
        <button id="slideshow-next-button" class="slideshow-nav-button" type="button" aria-label="次の写真">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="m9 18 6-6-6-6" />
          </svg>
        </button>
      </div>
    </section>
  </dialog>

  <script src="assets/js/app.js" type="module"></script>
  <script src="assets/js/gallery.js" type="module"></script>
</body>

</html>
