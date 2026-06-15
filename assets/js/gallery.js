const grid = document.querySelector("#photo-grid");
const sortSelect = document.querySelector("#sort-select");
const statusEl = document.querySelector("#gallery-status");
const sentinel = document.querySelector("#gallery-sentinel");
const galleryShell = grid.closest(".gallery-shell");
const originalAccessNotice = document.querySelector("#original-access-notice");
const clearSelectionButton = document.querySelector("#clear-selection-button");
const downloadSelectedButton = document.querySelector("#download-selected-button");
const zipProgressDialog = document.querySelector("#zip-progress-dialog");
const zipProgressTitle = document.querySelector("#zip-progress-title");
const zipProgressMessage = document.querySelector("#zip-progress-message");
const zipProgressBar = document.querySelector("#zip-progress-bar");
const zipProgressCloseButton = document.querySelector("#zip-progress-close");
const slideshowButton = document.querySelector("#slideshow-button");
const slideshowDialog = document.querySelector("#slideshow-dialog");
const slideshowCloseButton = document.querySelector("#slideshow-close-button");
const slideshowCounter = document.querySelector("#slideshow-counter");
const slideshowPrevButton = document.querySelector("#slideshow-prev-button");
const slideshowNextButton = document.querySelector("#slideshow-next-button");
const slideshowTrack = document.querySelector("#slideshow-track");

const PAGE_SIZE = 48;
const DEFAULT_POLL_INTERVAL_MS = 10000;
const SLIDESHOW_AUTO_INTERVAL_MS = 6000;
const SLIDESHOW_TRANSITION_MS = 820;

let offset = 0;
let total = 0;
let isLoading = false;
let isPolling = false;
let hasMore = true;
let isGalleryActive = false;
let currentSort = sortSelect.value;
let pollTimer = null;
let pollIntervalMs = DEFAULT_POLL_INTERVAL_MS;
let downloadZipMaxFiles = 200;
let originalImageAccessEnabled = true;
let lastAppliedOriginalImageAccessEnabled = null;
let slideshowPhotos = [];
let slideshowIndex = 0;
let slideshowAutoTimer = null;
let slideshowCloseTimer = null;
let slideshowTransitionTimer = null;
let isSlideshowAnimating = false;
let lastSlideshowFocus = null;

// Keep preloaded Image objects alive until decode completes so the browser
// does not cancel inflight requests before they are cached.
const slideshowPreloadCache = new Set();

const knownPhotoIds = new Set();
const selectedPhotoIds = new Set();
const photoStore = new Map();
const adminQueryValue = new URLSearchParams(window.location.search).get("admin");
const viewQueryValue = new URLSearchParams(window.location.search).get("view");
const isAdminMode = typeof adminQueryValue === "string" && adminQueryValue.length > 0;
const isViewMode = !isAdminMode && typeof viewQueryValue === "string" && viewQueryValue.length > 0;
let isAdminAuthenticated = false;
let isViewAuthenticated = false;
let adminPassword = adminQueryValue || "";
let viewPassword = viewQueryValue || "";
let adminStatusEl = null;
let thumbnailDebugPanelEl = null;

const dateFormatter = new Intl.DateTimeFormat("ja-JP", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

const formatPhotoDate = (photo) => {
  const dateValue = photo.capturedAt || photo.uploadedAt;
  const label = photo.capturedAt ? "撮影日時" : "共有日時";
  return `${label}: ${dateFormatter.format(new Date(dateValue))}`;
};

const photoDisplayUrl = (photo) => photo.originalUrl || photo.url || photo.thumbnailUrl;
const photoDownloadUrl = (photo) => photo.originalAvailable === false ? "" : (photo.originalUrl || photo.url || "");

const getOrderedLoadedPhotos = () =>
  Array.from(grid.querySelectorAll(".photo-item"))
    .map((item) => photoStore.get(item.dataset.id))
    .filter(Boolean);

const updateOriginalAccessControls = () => {
  const wasOriginalAccessEnabled = lastAppliedOriginalImageAccessEnabled;
  const didDisableOriginalAccess = wasOriginalAccessEnabled === true && !originalImageAccessEnabled;

  galleryShell.classList.toggle("is-thumbnail-only", !originalImageAccessEnabled);
  if (originalAccessNotice) {
    originalAccessNotice.hidden = originalImageAccessEnabled;
  }
  clearSelectionButton.hidden = !originalImageAccessEnabled;
  downloadSelectedButton.hidden = !originalImageAccessEnabled;
  slideshowButton.hidden = false;
  slideshowButton.disabled = !originalImageAccessEnabled;

  if (!originalImageAccessEnabled) {
    selectedPhotoIds.clear();
    if (didDisableOriginalAccess && slideshowDialog.open) closeSlideshow();
    if (lightbox.dialog.open && lightboxCurrentPhotoId) {
      const photo = photoStore.get(lightboxCurrentPhotoId);
      if (photo) renderPhotoLightbox(photo);
    }
  }

  grid.querySelectorAll(".photo-select-control").forEach((control) => {
    control.hidden = !originalImageAccessEnabled;
    const input = control.querySelector("input");
    if (input) {
      input.disabled = !originalImageAccessEnabled;
      if (!originalImageAccessEnabled) input.checked = false;
    }
  });

  grid.querySelectorAll(".photo-zoom-button").forEach((button) => {
    button.disabled = false;
    button.setAttribute(
      "aria-label",
      originalImageAccessEnabled
        ? button.dataset.originalAriaLabel || button.getAttribute("aria-label") || "写真を拡大表示"
        : button.dataset.originalAriaLabel || button.getAttribute("aria-label") || "写真を拡大表示",
    );
  });

  syncVisibleSelectionControls();
  updateDownloadSelectedButton();
  updateSelectionLimitControls();
  lastAppliedOriginalImageAccessEnabled = originalImageAccessEnabled;
};

const updateDownloadSelectedButton = () => {
  const count = selectedPhotoIds.size;
  clearSelectionButton.disabled = count === 0;
  downloadSelectedButton.disabled = count === 0 || !originalImageAccessEnabled;
  downloadSelectedButton.querySelector("span").textContent =
    !originalImageAccessEnabled
      ? "確認期間中はダウンロード無効"
      :
    count === 0
      ? "選択画像をまとめてダウンロード"
      : `選択画像をまとめてダウンロード（${count}/${downloadZipMaxFiles}枚）`;
};

const syncVisibleSelectionControls = () => {
  grid.querySelectorAll(".photo-item").forEach((item) => {
    const isSelected = selectedPhotoIds.has(item.dataset.id);
    const input = item.querySelector(".photo-select-control input");
    item.classList.toggle("is-selected", isSelected);
    if (input) {
      input.checked = isSelected;
    }
  });
};

const updateSelectionLimitControls = () => {
  const isAtLimit = selectedPhotoIds.size >= downloadZipMaxFiles;

  grid.querySelectorAll(".photo-item").forEach((item) => {
    const input = item.querySelector(".photo-select-control input");
    if (!input) return;
    input.disabled = isAtLimit && !selectedPhotoIds.has(item.dataset.id);
  });
};

const clearSelectedPhotos = () => {
  if (selectedPhotoIds.size === 0) return;

  selectedPhotoIds.clear();
  syncVisibleSelectionControls();
  updateDownloadSelectedButton();
  updateSelectionLimitControls();
  setStatus("選択を解除しました。");
};

const downloadPhoto = (photo) => {
  const url = photoDownloadUrl(photo);
  if (!url) {
    setStatus("現在は確認期間中のため、元画像のダウンロードは無効です。");
    return;
  }

  const link = document.createElement("a");
  link.href = url;
  link.download = photo.name || "";
  link.rel = "noopener";
  document.body.append(link);
  link.click();
  link.remove();
};

const selectedPhotoNames = () =>
  Array.from(selectedPhotoIds)
    .map((id) => photoStore.get(id))
    .filter(Boolean)
    .map((photo) => photo.name);

const filenameFromContentDisposition = (value) => {
  const match = typeof value === "string" ? value.match(/filename="?([^"]+)"?/) : null;
  return match ? match[1] : "";
};

const openZipProgress = (count) => {
  zipProgressDialog.classList.remove("is-closing");
  zipProgressTitle.textContent = "ZIPファイルを準備しています";
  zipProgressMessage.textContent = `${count}枚の画像をZIPにまとめています...`;
  zipProgressCloseButton.hidden = true;
  zipProgressBar.classList.add("is-indeterminate");
  zipProgressBar.style.setProperty("--progress", "0%");
  zipProgressBar.removeAttribute("aria-valuenow");

  if (!zipProgressDialog.open) {
    zipProgressDialog.showModal();
  }

  window.requestAnimationFrame(() => {
    zipProgressDialog.classList.add("is-open");
  });
};

const updateZipProgress = ({ title, message, percent = null, indeterminate = false, canClose = false }) => {
  if (title) zipProgressTitle.textContent = title;
  if (message) zipProgressMessage.textContent = message;

  zipProgressBar.classList.toggle("is-indeterminate", indeterminate);
  zipProgressCloseButton.hidden = !canClose;

  if (percent === null) {
    zipProgressBar.removeAttribute("aria-valuenow");
    return;
  }

  const safePercent = Math.max(0, Math.min(100, percent));
  zipProgressBar.style.setProperty("--progress", `${safePercent}%`);
  zipProgressBar.setAttribute("aria-valuenow", String(Math.round(safePercent)));
};

const closeZipProgress = (delay = 0) => {
  window.setTimeout(() => {
    if (!zipProgressDialog.open) return;
    zipProgressDialog.classList.remove("is-open");
    zipProgressDialog.classList.add("is-closing");
    window.setTimeout(() => {
      zipProgressDialog.classList.remove("is-closing");
      if (zipProgressDialog.open) {
        zipProgressDialog.close();
      }
    }, prefersReducedMotion.matches ? 0 : 180);
  }, delay);
};

const responseBlobWithProgress = async (response, onProgress) => {
  const contentLength = Number(response.headers.get("Content-Length") || 0);

  if (!response.body || typeof response.body.getReader !== "function") {
    return response.blob();
  }

  const reader = response.body.getReader();
  const chunks = [];
  let received = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    chunks.push(value);
    received += value.length;

    if (contentLength > 0) {
      onProgress((received / contentLength) * 100);
    }
  }

  return new Blob(chunks, {
    type: response.headers.get("Content-Type") || "application/zip",
  });
};

const downloadSelectedPhotos = async () => {
  if (!originalImageAccessEnabled) {
    setStatus("現在は確認期間中のため、元画像のダウンロードは無効です。");
    updateDownloadSelectedButton();
    return;
  }

  const photos = Array.from(selectedPhotoIds)
    .map((id) => photoStore.get(id))
    .filter(Boolean);

  if (photos.length === 0) {
    updateDownloadSelectedButton();
    return;
  }

  downloadSelectedButton.disabled = true;
  setStatus("");
  openZipProgress(photos.length);

  try {
    const response = await fetch("api/download-zip.php", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ names: selectedPhotoNames() }),
    });

    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      throw new Error(result.error || "ZIPファイルを作成できませんでした。");
    }

    const responseSize = Number(response.headers.get("Content-Length") || 0);
    updateZipProgress({
      title: "ZIPファイルを受信しています",
      message: "ダウンロードの準備ができました。データを受信しています...",
      percent: responseSize > 0 ? 0 : null,
      indeterminate: responseSize <= 0,
    });

    const blob = await responseBlobWithProgress(response, (percent) => {
      updateZipProgress({
        message: `ZIPファイルを受信しています... ${Math.round(percent)}%`,
        percent,
      });
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filenameFromContentDisposition(response.headers.get("Content-Disposition")) || "photos.zip";
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 1000);
    updateZipProgress({
      title: "ダウンロードを開始しました",
      message: `${photos.length}枚のZIPダウンロードを開始しました。`,
      percent: 100,
    });
    closeZipProgress(900);
    setStatus(`${photos.length}枚のZIPダウンロードを開始しました。`);
  } catch (error) {
    updateZipProgress({
      title: "ZIPファイルを作成できませんでした",
      message: error.message,
      indeterminate: false,
      canClose: true,
    });
    setStatus(error.message);
  } finally {
    updateDownloadSelectedButton();
    updateSelectionLimitControls();
  }
};

const createPhotoLightbox = () => {
  let dialog = document.querySelector("#photo-lightbox");

  if (!dialog) {
    dialog = document.createElement("dialog");
    dialog.id = "photo-lightbox";
    dialog.className = "photo-lightbox";
    dialog.setAttribute("aria-label", "写真の拡大表示");

    const closeButton = document.createElement("button");
    closeButton.id = "photo-lightbox-close";
    closeButton.className = "photo-lightbox-close";
    closeButton.type = "button";
    closeButton.setAttribute("aria-label", "拡大表示を閉じる");
    closeButton.textContent = "×";

    const toolbar = document.createElement("div");
    toolbar.className = "photo-lightbox-toolbar";

    const downloadButton = document.createElement("button");
    downloadButton.id = "photo-lightbox-download";
    downloadButton.className = "photo-lightbox-download";
    downloadButton.type = "button";
    downloadButton.setAttribute("aria-label", "この写真をダウンロード");
    downloadButton.innerHTML = `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 3v12" />
        <path d="m7 10 5 5 5-5" />
        <path d="M5 21h14" />
      </svg>
      <span>ダウンロード</span>
    `;
    toolbar.append(downloadButton);

    const prevButton = document.createElement("button");
    prevButton.id = "photo-lightbox-prev";
    prevButton.className = "photo-lightbox-nav photo-lightbox-prev";
    prevButton.type = "button";
    prevButton.setAttribute("aria-label", "前の画像を表示");
    prevButton.innerHTML = `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="m15 18-6-6 6-6" />
      </svg>
    `;

    const nextButton = document.createElement("button");
    nextButton.id = "photo-lightbox-next";
    nextButton.className = "photo-lightbox-nav photo-lightbox-next";
    nextButton.type = "button";
    nextButton.setAttribute("aria-label", "次の画像を表示");
    nextButton.innerHTML = `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="m9 18 6-6-6-6" />
      </svg>
    `;

    const figure = document.createElement("figure");
    figure.className = "photo-lightbox-figure";

    const image = document.createElement("img");
    image.id = "photo-lightbox-image";
    image.alt = "";

    const caption = document.createElement("figcaption");
    caption.id = "photo-lightbox-caption";

    figure.append(image, caption);
    dialog.append(closeButton, toolbar, prevButton, figure, nextButton);
    document.body.append(dialog);
  }

  return {
    caption: dialog.querySelector("#photo-lightbox-caption"),
    closeButton: dialog.querySelector("#photo-lightbox-close"),
    dialog,
    downloadButton: dialog.querySelector("#photo-lightbox-download"),
    image: dialog.querySelector("#photo-lightbox-image"),
    nextButton: dialog.querySelector("#photo-lightbox-next"),
    prevButton: dialog.querySelector("#photo-lightbox-prev"),
  };
};

const lightbox = createPhotoLightbox();
let lastFocusedElement = null;
let lightboxCloseTimer = null;
let lightboxCurrentPhotoId = null;

const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

const slideshowPhotoUrl = photoDisplayUrl;

const setSlideshowStatus = (message) => {
  if (message) {
    setStatus(message);
  }
};

const preloadSlideshowPhoto = (index) => {
  const photo = slideshowPhotos[index];
  const url = photo ? slideshowPhotoUrl(photo) : "";
  if (!url) return;

  const image = new Image();
  slideshowPreloadCache.add(image);
  image.src = url;
  const release = () => slideshowPreloadCache.delete(image);
  if (typeof image.decode === "function") {
    image.decode().then(release).catch(release);
  } else {
    image.addEventListener("load", release, { once: true });
    image.addEventListener("error", release, { once: true });
  }
};

const updateSlideshowButtons = () => {
  const shouldDisable = slideshowPhotos.length <= 1 || isSlideshowAnimating;
  slideshowPrevButton.disabled = shouldDisable;
  slideshowNextButton.disabled = shouldDisable;
};

const normalizeSlideshowIndex = (index) => (index + slideshowPhotos.length) % slideshowPhotos.length;

const createSlideshowSlide = (index, position) => {
  const safeIndex = normalizeSlideshowIndex(index);
  const photo = slideshowPhotos[safeIndex];
  const url = slideshowPhotoUrl(photo);

  const figure = document.createElement("figure");
  figure.className = `slideshow-figure is-${position}`;
  figure.style.setProperty("--slideshow-rotate", photoRotation(photo));

  const image = document.createElement("img");
  image.className = "slideshow-image";
  image.src = url;
  image.alt = photo.name;
  image.decoding = "async";

  figure.append(image);
  return figure;
};

const renderSlideshowSlides = () => {
  if (slideshowPhotos.length === 0) return;

  slideshowTrack.classList.remove("is-animating", "is-moving-next", "is-moving-prev");
  slideshowTrack.style.transform = "translateX(calc(-1 * (var(--slideshow-slide-width) + var(--slideshow-slide-gap))))";
  slideshowTrack.replaceChildren(
    createSlideshowSlide(slideshowIndex - 1, "prev"),
    createSlideshowSlide(slideshowIndex, "current"),
    createSlideshowSlide(slideshowIndex + 1, "next"),
  );
  slideshowCounter.textContent = `${slideshowIndex + 1} / ${slideshowPhotos.length}`;
  preloadSlideshowPhoto(normalizeSlideshowIndex(slideshowIndex + 2));
  preloadSlideshowPhoto(normalizeSlideshowIndex(slideshowIndex - 2));
};

// Called after a slide transition completes. Reuses the same DOM layout as
// renderSlideshowSlides but adds an "is-entering" class to the brand-new side
// slide (the one that was not visible during the outgoing animation) so it
// fades in smoothly rather than popping into existence.
const transitionSlideshowSlides = (direction) => {
  if (slideshowPhotos.length === 0) return;

  const prevSlide = createSlideshowSlide(slideshowIndex - 1, "prev");
  const currentSlide = createSlideshowSlide(slideshowIndex, "current");
  const nextSlide = createSlideshowSlide(slideshowIndex + 1, "next");

  // Only the slide that was completely off-screen needs the entering treatment.
  const newSlide = direction > 0 ? nextSlide : prevSlide;
  newSlide.classList.add("is-entering");

  slideshowTrack.classList.remove("is-animating", "is-moving-next", "is-moving-prev");
  slideshowTrack.style.transform = "translateX(calc(-1 * (var(--slideshow-slide-width) + var(--slideshow-slide-gap))))";
  slideshowTrack.replaceChildren(prevSlide, currentSlide, nextSlide);

  slideshowCounter.textContent = `${slideshowIndex + 1} / ${slideshowPhotos.length}`;

  // Two rAF frames ensure the browser has painted the entering state before
  // the class is removed, which triggers the CSS transition.
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      newSlide.classList.remove("is-entering");
    });
  });

  preloadSlideshowPhoto(normalizeSlideshowIndex(slideshowIndex + 2));
  preloadSlideshowPhoto(normalizeSlideshowIndex(slideshowIndex - 2));
};

const moveSlideshow = (direction) => {
  if (slideshowPhotos.length <= 1 || isSlideshowAnimating) return;

  window.clearTimeout(slideshowTransitionTimer);
  isSlideshowAnimating = true;
  updateSlideshowButtons();

  const finishMove = () => {
    slideshowIndex = normalizeSlideshowIndex(slideshowIndex + direction);
    isSlideshowAnimating = false;
    transitionSlideshowSlides(direction);
    updateSlideshowButtons();
  };

  if (prefersReducedMotion.matches) {
    finishMove();
    return;
  }

  slideshowTrack.classList.add("is-animating", direction > 0 ? "is-moving-next" : "is-moving-prev");
  window.requestAnimationFrame(() => {
    slideshowTrack.style.transform =
      direction > 0
        ? "translateX(calc(-2 * (var(--slideshow-slide-width) + var(--slideshow-slide-gap))))"
        : "translateX(0)";
  });
  slideshowTransitionTimer = window.setTimeout(finishMove, SLIDESHOW_TRANSITION_MS);
};

const scheduleSlideshowAutoAdvance = () => {
  window.clearInterval(slideshowAutoTimer);

  if (slideshowPhotos.length <= 1 || prefersReducedMotion.matches) {
    slideshowAutoTimer = null;
    return;
  }

  slideshowAutoTimer = window.setInterval(() => {
    if (!slideshowDialog.open || document.hidden) return;
    moveSlideshow(1);
  }, SLIDESHOW_AUTO_INTERVAL_MS);
};

const closePhotoLightbox = () => {
  if (!lightbox.dialog.open) return;
  if (lightbox.dialog.classList.contains("is-closing")) return;

  window.clearTimeout(lightboxCloseTimer);
  lightbox.dialog.classList.remove("is-open");
  lightbox.dialog.classList.add("is-closing");

  const finishClose = () => {
    lightbox.dialog.classList.remove("is-closing");
    lightbox.dialog.close();
  };

  if (prefersReducedMotion.matches) {
    finishClose();
    return;
  }

  lightboxCloseTimer = window.setTimeout(finishClose, 180);
};

const renderPhotoLightbox = (photo) => {
  const orderedPhotos = getOrderedLoadedPhotos();
  const currentIndex = orderedPhotos.findIndex((item) => item.id === photo.id);

  lightboxCurrentPhotoId = photo.id;
  lightbox.image.src = photoDisplayUrl(photo);
  lightbox.image.alt = photo.name;
  lightbox.caption.textContent = `${formatPhotoDate(photo)}${currentIndex >= 0 ? ` / ${currentIndex + 1}枚目` : ""}`;
  const downloadUrl = photoDownloadUrl(photo);
  lightbox.downloadButton.disabled = !downloadUrl;
  lightbox.downloadButton.classList.toggle("is-low-resolution", !downloadUrl);
  lightbox.downloadButton.setAttribute(
    "aria-label",
    downloadUrl ? "この写真をダウンロード" : "現在低解像度表示中",
  );
  lightbox.downloadButton.innerHTML = downloadUrl
    ? `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 3v12" />
        <path d="m7 10 5 5 5-5" />
        <path d="M5 21h14" />
      </svg>
      <span>ダウンロード</span>
    `
    : "<span>現在低解像度表示中</span>";
  lightbox.prevButton.disabled = orderedPhotos.length <= 1;
  lightbox.nextButton.disabled = orderedPhotos.length <= 1;
};

const openPhotoLightbox = (photo) => {
  lastFocusedElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  window.clearTimeout(lightboxCloseTimer);
  lightbox.dialog.classList.remove("is-open", "is-closing");
  renderPhotoLightbox(photo);
  lightbox.dialog.showModal();
  window.requestAnimationFrame(() => {
    lightbox.dialog.classList.add("is-open");
  });
  lightbox.closeButton.focus();
};

const movePhotoLightbox = (direction) => {
  const orderedPhotos = getOrderedLoadedPhotos();
  if (orderedPhotos.length <= 1) return;

  const currentIndex = orderedPhotos.findIndex((photo) => photo.id === lightboxCurrentPhotoId);
  const nextIndex = currentIndex < 0
    ? 0
    : (currentIndex + direction + orderedPhotos.length) % orderedPhotos.length;
  renderPhotoLightbox(orderedPhotos[nextIndex]);
};

const setStatus = (message) => {
  statusEl.textContent = message;
};

const setAdminStatus = (message) => {
  if (adminStatusEl) {
    adminStatusEl.textContent = message;
  }
};

const returnToNormalPage = () => {
  const url = new URL(window.location.href);
  url.searchParams.delete("admin");
  url.searchParams.delete("view");
  window.location.replace(url.toString());
};

const adminRequest = async (payload) => {
  if (!adminPassword) {
    throw new Error("管理用URLパラメータが見つかりません。admin=パスワード 形式でアクセスしてください。");
  }

  const response = await fetch("api/admin.php", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      ...payload,
      password: adminPassword,
    }),
  });
  const result = await response.json().catch(() => ({}));

  if (!response.ok || !result.ok) {
    if (response.status === 403) adminPassword = "";
    throw new Error(result.error || "管理操作に失敗しました。");
  }

  return result;
};

const viewRequest = async (payload) => {
  if (!viewPassword) {
    throw new Error("閲覧用URLパラメータが見つかりません。view=パスワード 形式でアクセスしてください。");
  }

  const response = await fetch("api/admin.php", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      ...payload,
      password: viewPassword,
    }),
  });
  const result = await response.json().catch(() => ({}));

  if (!response.ok || !result.ok) {
    if (response.status === 403) viewPassword = "";
    throw new Error(result.error || "閲覧モードの認証に失敗しました。");
  }

  return result;
};

const formatBytes = (value) => {
  const bytes = Number(value || 0);
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const yesNo = (value) => (value ? "OK" : "NG");

const createThumbnailDebugPanel = () => {
  if (thumbnailDebugPanelEl) return thumbnailDebugPanelEl;

  thumbnailDebugPanelEl = document.createElement("div");
  thumbnailDebugPanelEl.className = "admin-thumbnail-debug";
  thumbnailDebugPanelEl.hidden = true;
  return thumbnailDebugPanelEl;
};

const renderThumbnailDiagnostics = (diagnostics) => {
  const panel = createThumbnailDebugPanel();
  panel.hidden = false;
  panel.replaceChildren();

  const environment = diagnostics.environment || {};
  const summary = diagnostics.summary || {};
  const photos = Array.isArray(diagnostics.photos) ? diagnostics.photos : [];

  const heading = document.createElement("strong");
  heading.className = "admin-thumbnail-debug-heading";
  heading.textContent = "サムネイル診断";

  const summaryText = document.createElement("p");
  summaryText.className = "admin-thumbnail-debug-summary";
  summaryText.textContent = [
    `写真 ${summary.total || 0}件`,
    `利用可能 ${summary.ready || 0}件`,
    `今回生成 ${summary.created || 0}件`,
    `オリジナル表示 ${summary.fallback || 0}件`,
  ].join(" / ");

  const environmentList = document.createElement("dl");
  environmentList.className = "admin-thumbnail-debug-env";

  const addEnv = (label, value) => {
    const term = document.createElement("dt");
    term.textContent = label;
    const description = document.createElement("dd");
    description.textContent = value;
    environmentList.append(term, description);
  };

  addEnv("PHP", environment.phpVersion || "-");
  addEnv("アップロード", `${yesNo(environment.uploadDirReadable)} ${environment.uploadDir || ""}`);
  addEnv("サムネイル保存先", `${yesNo(environment.thumbnailDirWritable)} ${environment.thumbnailDir || ""}`);
  addEnv("設定", `${environment.thumbnailMaxWidth}x${environment.thumbnailMaxHeight} / JPEG ${environment.thumbnailJpegQuality}`);

  const gdFunctions = environment.gdFunctions || {};
  const gdStatus = Object.entries(gdFunctions)
    .map(([name, enabled]) => `${name}:${enabled ? "OK" : "NG"}`)
    .join(" ");
  addEnv("GD", gdStatus || "-");

  const tableWrap = document.createElement("div");
  tableWrap.className = "admin-thumbnail-debug-table-wrap";

  const table = document.createElement("table");
  table.className = "admin-thumbnail-debug-table";
  const thead = document.createElement("thead");
  const headerRow = document.createElement("tr");
  ["ファイル", "形式", "元画像", "サムネイル", "状態", "メモ"].forEach((label) => {
    const th = document.createElement("th");
    th.textContent = label;
    headerRow.append(th);
  });
  thead.append(headerRow);

  const tbody = document.createElement("tbody");
  photos.forEach((photo) => {
    const row = document.createElement("tr");
    if (photo.usesOriginalFallback) row.classList.add("is-fallback");

    const originalDimensions = photo.originalWidth && photo.originalHeight
      ? `${photo.originalWidth}x${photo.originalHeight}`
      : "-";
    const issues = Array.isArray(photo.issues) && photo.issues.length > 0
      ? photo.issues.join(" / ")
      : "";

    [
      photo.name,
      photo.mime,
      `${originalDimensions} ${formatBytes(photo.originalSize)}`,
      photo.thumbnailExists ? `${photo.thumbnailName} ${formatBytes(photo.thumbnailSize)}` : "なし",
      photo.usesOriginalFallback ? "オリジナル表示" : (photo.thumbnailCreated ? "生成済み" : "OK"),
      issues,
    ].forEach((value) => {
      const td = document.createElement("td");
      td.textContent = value || "-";
      row.append(td);
    });

    tbody.append(row);
  });
  table.append(thead, tbody);
  tableWrap.append(table);

  panel.append(heading, summaryText, environmentList, tableWrap);
};

// --- Location restriction helpers ---

const haversineDistanceMeters = (lat1, lng1, lat2, lng2) => {
  const R = 6371000;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const getCurrentPosition = () =>
  new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("このブラウザはGPS機能に対応していません。"));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 60000,
    });
  });

const checkLocationAccess = async (locationConfig) => {
  if (!locationConfig || !locationConfig.enabled) return true;

  setStatus("現在地を確認しています...");

  try {
    const position = await getCurrentPosition();
    const { latitude, longitude } = position.coords;
    const distance = haversineDistanceMeters(
      latitude,
      longitude,
      locationConfig.lat,
      locationConfig.lng,
    );

    if (distance <= locationConfig.radiusMeters) {
      setStatus("");
      return true;
    }

    setStatus(
      `この写真ギャラリーは会場内（${locationConfig.radiusMeters}m以内）でのみ閲覧できます。` +
      `現在地は会場から約${Math.round(distance)}m離れています。`,
    );
    return false;
  } catch (error) {
    if (error.code === 1) {
      setStatus(
        "位置情報の使用が拒否されました。ギャラリーを閲覧するにはブラウザの設定から位置情報の使用を許可してください。",
      );
    } else {
      setStatus("位置情報を取得できませんでした。ギャラリーを閲覧するには位置情報の使用を許可してください。");
    }
    return false;
  }
};

const fetchGallerySettings = async () => {
  const response = await fetch("api/gallery-settings.php", { cache: "no-store" });
  return response.json().catch(() => ({}));
};

// --- Admin mode ---

const authenticateAdminMode = async () => {
  if (!isAdminMode) return true;

  if (!adminPassword) {
    window.alert("admin=パスワード の形式で管理モードURLを指定してください。通常ページに戻ります。");
    returnToNormalPage();
    return false;
  }

  try {
    await adminRequest({ action: "verify" });
    isAdminAuthenticated = true;
    return true;
  } catch (error) {
    adminPassword = "";
    window.alert(`${error.message}\n通常ページに戻ります。`);
    returnToNormalPage();
    return false;
  }
};

const authenticateViewMode = async () => {
  if (!isViewMode) return true;

  if (!viewPassword) {
    window.alert("view=パスワード の形式で閲覧モードURLを指定してください。通常ページに戻ります。");
    returnToNormalPage();
    return false;
  }

  try {
    await viewRequest({ action: "verify_view" });
    isViewAuthenticated = true;
    return true;
  } catch (error) {
    viewPassword = "";
    window.alert(`${error.message}\n通常ページに戻ります。`);
    returnToNormalPage();
    return false;
  }
};

const createAdminToolbar = (locationConfig = null, originalAccessConfig = null) => {
  if (!isAdminMode || !isAdminAuthenticated || !galleryShell) return;

  const toolbar = document.createElement("section");
  toolbar.className = "admin-toolbar";
  toolbar.setAttribute("aria-label", "管理モード");

  const label = document.createElement("strong");
  label.textContent = "管理モード";

  adminStatusEl = document.createElement("span");
  adminStatusEl.className = "admin-status";
  adminStatusEl.textContent = "個別削除と全削除ができます。";

  const deleteAllButton = document.createElement("button");
  deleteAllButton.className = "danger-button";
  deleteAllButton.type = "button";
  deleteAllButton.textContent = "全て削除";
  deleteAllButton.addEventListener("click", async () => {
    if (total === 0) {
      setAdminStatus("削除する写真はありません。");
      return;
    }
    if (!window.confirm("アップロードされた全ての写真を削除します。よろしいですか？")) return;

    deleteAllButton.disabled = true;
    setAdminStatus("全て削除しています...");

    try {
      const result = await adminRequest({ action: "delete_all" });
      knownPhotoIds.clear();
      grid.innerHTML = "";
      offset = 0;
      total = 0;
      hasMore = false;
      sentinel.classList.remove("is-loading");
      updateStatus(`${result.deleted || 0}枚削除しました。`);
      setAdminStatus("全て削除しました。");
    } catch (error) {
      setAdminStatus(error.message);
    } finally {
      deleteAllButton.disabled = false;
    }
  });

  const thumbnailDebugButton = document.createElement("button");
  thumbnailDebugButton.className = "secondary-button";
  thumbnailDebugButton.type = "button";
  thumbnailDebugButton.textContent = "サムネイル診断";
  thumbnailDebugButton.addEventListener("click", async () => {
    thumbnailDebugButton.disabled = true;
    setAdminStatus("サムネイルを診断しています...");

    try {
      const result = await adminRequest({ action: "thumbnail_diagnostics" });
      renderThumbnailDiagnostics(result.diagnostics || {});
      const summary = (result.diagnostics && result.diagnostics.summary) || {};
      setAdminStatus(`診断完了: ${summary.ready || 0}/${summary.total || 0}件がサムネイル利用可能です。`);
    } catch (error) {
      setAdminStatus(error.message);
    } finally {
      thumbnailDebugButton.disabled = false;
    }
  });

  const exitButton = document.createElement("button");
  exitButton.className = "secondary-button";
  exitButton.type = "button";
  exitButton.textContent = "終了";
  exitButton.addEventListener("click", () => {
    const url = new URL(window.location.href);
    url.searchParams.delete("admin");
    window.location.href = url.toString();
  });

  const thumbnailDebugPanel = createThumbnailDebugPanel();

  toolbar.append(label, adminStatusEl, thumbnailDebugButton, deleteAllButton, exitButton, thumbnailDebugPanel);

  const originalConfig = originalAccessConfig || { enabled: true };

  const originalAccessSection = document.createElement("div");
  originalAccessSection.className = "admin-location-settings";

  const originalAccessHeading = document.createElement("strong");
  originalAccessHeading.className = "admin-location-heading";
  originalAccessHeading.textContent = "元画像公開設定";

  const originalAccessToggleRow = document.createElement("label");
  originalAccessToggleRow.className = "admin-location-toggle";
  const originalAccessToggle = document.createElement("input");
  originalAccessToggle.type = "checkbox";
  originalAccessToggle.checked = originalConfig.enabled;
  originalAccessToggleRow.append(originalAccessToggle, " 元画像表示とダウンロードを有効にする");

  const originalAccessNote = document.createElement("p");
  originalAccessNote.className = "admin-location-note";
  originalAccessNote.textContent = "OFFにすると、通常ページではサムネイルのみを表示し、元画像表示・個別ダウンロード・一括ZIPダウンロードを無効にします。";

  const originalAccessStatus = document.createElement("span");
  originalAccessStatus.className = "admin-location-status";

  const originalAccessActions = document.createElement("div");
  originalAccessActions.className = "admin-location-actions";

  const saveOriginalAccessButton = document.createElement("button");
  saveOriginalAccessButton.type = "button";
  saveOriginalAccessButton.className = "secondary-button";
  saveOriginalAccessButton.textContent = "保存";
  saveOriginalAccessButton.addEventListener("click", async () => {
    saveOriginalAccessButton.disabled = true;
    originalAccessStatus.textContent = "保存しています...";
    try {
      const result = await adminRequest({
        action: "set_original_access_config",
        enabled: originalAccessToggle.checked,
      });
      originalImageAccessEnabled = Boolean(result.originalAccessConfig && result.originalAccessConfig.enabled);
      originalAccessToggle.checked = originalImageAccessEnabled;
      updateOriginalAccessControls();
      originalAccessStatus.textContent = originalImageAccessEnabled
        ? "元画像表示とダウンロードを有効にしました。"
        : "確認期間用にサムネイルのみの公開へ切り替えました。";
      resetGallery();
    } catch (error) {
      originalAccessStatus.textContent = error.message;
    } finally {
      saveOriginalAccessButton.disabled = false;
    }
  });

  originalAccessActions.append(saveOriginalAccessButton);
  originalAccessSection.append(
    originalAccessHeading,
    originalAccessToggleRow,
    originalAccessNote,
    originalAccessActions,
    originalAccessStatus,
  );
  toolbar.append(originalAccessSection);

  // Location restriction settings panel
  const config = locationConfig || { enabled: false, lat: 0, lng: 0, radiusMeters: 1000 };

  const locationSection = document.createElement("div");
  locationSection.className = "admin-location-settings";

  const locationHeading = document.createElement("strong");
  locationHeading.className = "admin-location-heading";
  locationHeading.textContent = "位置制限設定";

  const toggleRow = document.createElement("label");
  toggleRow.className = "admin-location-toggle";
  const toggle = document.createElement("input");
  toggle.type = "checkbox";
  toggle.checked = config.enabled;
  toggleRow.append(toggle, " 位置制限を有効にする");

  const inputsRow = document.createElement("div");
  inputsRow.className = "admin-location-inputs";

  const latLabel = document.createElement("label");
  latLabel.textContent = "緯度";
  const latInput = document.createElement("input");
  latInput.type = "number";
  latInput.step = "0.000001";
  latInput.min = "-90";
  latInput.max = "90";
  latInput.value = config.lat;
  latInput.placeholder = "例: 35.689500";
  latLabel.append(latInput);

  const lngLabel = document.createElement("label");
  lngLabel.textContent = "経度";
  const lngInput = document.createElement("input");
  lngInput.type = "number";
  lngInput.step = "0.000001";
  lngInput.min = "-180";
  lngInput.max = "180";
  lngInput.value = config.lng;
  lngInput.placeholder = "例: 139.691700";
  lngLabel.append(lngInput);

  const radiusLabel = document.createElement("label");
  radiusLabel.textContent = "半径（m）";
  const radiusInput = document.createElement("input");
  radiusInput.type = "number";
  radiusInput.min = "1";
  radiusInput.max = "100000";
  radiusInput.value = config.radiusMeters;
  radiusInput.placeholder = "1000";
  radiusLabel.append(radiusInput);

  inputsRow.append(latLabel, lngLabel, radiusLabel);

  const locationPanelStatus = document.createElement("span");
  locationPanelStatus.className = "admin-location-status";

  const actionsRow = document.createElement("div");
  actionsRow.className = "admin-location-actions";

  const getLocationButton = document.createElement("button");
  getLocationButton.type = "button";
  getLocationButton.className = "secondary-button";
  getLocationButton.textContent = "現在地を取得";
  getLocationButton.addEventListener("click", async () => {
    getLocationButton.disabled = true;
    locationPanelStatus.textContent = "現在地を取得しています...";
    try {
      const pos = await getCurrentPosition();
      latInput.value = pos.coords.latitude.toFixed(6);
      lngInput.value = pos.coords.longitude.toFixed(6);
      locationPanelStatus.textContent = `現在地を取得しました（精度: 約${Math.round(pos.coords.accuracy)}m）`;
    } catch (error) {
      locationPanelStatus.textContent = `現在地の取得に失敗しました: ${error.message}`;
    } finally {
      getLocationButton.disabled = false;
    }
  });

  const saveLocationButton = document.createElement("button");
  saveLocationButton.type = "button";
  saveLocationButton.className = "secondary-button";
  saveLocationButton.textContent = "保存";
  saveLocationButton.addEventListener("click", async () => {
    saveLocationButton.disabled = true;
    locationPanelStatus.textContent = "保存しています...";
    try {
      await adminRequest({
        action: "set_location_config",
        enabled: toggle.checked,
        lat: parseFloat(latInput.value) || 0,
        lng: parseFloat(lngInput.value) || 0,
        radiusMeters: parseInt(radiusInput.value, 10) || 1000,
      });
      locationPanelStatus.textContent = "保存しました。";
    } catch (error) {
      locationPanelStatus.textContent = error.message;
    } finally {
      saveLocationButton.disabled = false;
    }
  });

  actionsRow.append(getLocationButton, saveLocationButton);
  locationSection.append(locationHeading, toggleRow, inputsRow, actionsRow, locationPanelStatus);
  toolbar.append(locationSection);

  galleryShell.insertBefore(toolbar, statusEl);
};

const updateStatus = (prefix = "") => {
  if (total === 0) {
    setStatus("");
    return;
  }

  setStatus(prefix);
};

const comparePhotos = (left, right, sort = currentSort) => {
  if (sort === "oldest") return left.timestamp - right.timestamp;
  if (sort === "captured_newest") return compareCapturedPhotos(left, right, "desc");
  if (sort === "captured_oldest") return compareCapturedPhotos(left, right, "asc");
  if (sort === "name_asc") return left.name.localeCompare(right.name, "ja", { numeric: true });
  if (sort === "name_desc") return right.name.localeCompare(left.name, "ja", { numeric: true });

  return right.timestamp - left.timestamp;
};

const compareCapturedPhotos = (left, right, direction) => {
  const leftCaptured = Number(left.capturedTimestamp || 0);
  const rightCaptured = Number(right.capturedTimestamp || 0);

  if (leftCaptured > 0 && rightCaptured > 0) {
    return direction === "asc" ? leftCaptured - rightCaptured : rightCaptured - leftCaptured;
  }

  if (leftCaptured > 0) return -1;
  if (rightCaptured > 0) return 1;

  return direction === "asc" ? left.timestamp - right.timestamp : right.timestamp - left.timestamp;
};

const photoFromItem = (item) => ({
  id: item.dataset.id,
  name: item.dataset.name,
  timestamp: Number(item.dataset.timestamp || 0),
  capturedTimestamp: Number(item.dataset.capturedTimestamp || 0),
});

const photoRotation = (photo) => {
  const source = photo.id || photo.name || "";
  let hash = 0;

  for (const character of source) {
    hash = (hash * 31 + character.charCodeAt(0)) % 1009;
  }

  return `${((hash % 13) - 6) * 0.55}deg`;
};

const createPhotoItem = (photo, { isNew = false } = {}) => {
  const item = document.createElement("figure");
  item.className = `photo-item${isNew ? " is-new" : ""}`;
  item.dataset.id = photo.id;
  item.dataset.name = photo.name;
  item.dataset.timestamp = String(photo.timestamp || 0);
  item.dataset.capturedTimestamp = String(photo.capturedTimestamp || 0);
  item.style.setProperty("--photo-rotate", photoRotation(photo));

  const selectionLabel = document.createElement("label");
  selectionLabel.className = "photo-select-control";
  selectionLabel.setAttribute("aria-label", `${photo.name}を選択`);

  const selectionInput = document.createElement("input");
  selectionInput.type = "checkbox";
  selectionInput.checked = selectedPhotoIds.has(photo.id);
  selectionInput.disabled = !selectionInput.checked && selectedPhotoIds.size >= downloadZipMaxFiles;
  if (selectionInput.checked) item.classList.add("is-selected");
  selectionInput.addEventListener("change", () => {
    if (selectionInput.checked) {
      if (selectedPhotoIds.size >= downloadZipMaxFiles) {
        selectionInput.checked = false;
        setStatus(`一度に選択できる画像は${downloadZipMaxFiles}枚までです。`);
        updateSelectionLimitControls();
        return;
      }

      selectedPhotoIds.add(photo.id);
      item.classList.add("is-selected");
    } else {
      selectedPhotoIds.delete(photo.id);
      item.classList.remove("is-selected");
    }
    updateDownloadSelectedButton();
    updateSelectionLimitControls();
  });

  const selectionBox = document.createElement("span");
  selectionBox.setAttribute("aria-hidden", "true");
  selectionLabel.append(selectionInput, selectionBox);

  const frame = document.createElement("div");
  frame.className = "photo-frame";

  const loader = document.createElement("span");
  loader.className = "photo-loader";
  loader.setAttribute("aria-hidden", "true");

  const image = document.createElement("img");
  image.src = photo.thumbnailUrl || photoDisplayUrl(photo);
  image.alt = photo.name;
  image.loading = "lazy";
  image.decoding = "async";
  image.addEventListener("load", () => {
    frame.classList.add("is-loaded");
  });
  image.addEventListener("error", () => {
    frame.classList.add("is-error");
  });

  frame.append(loader, image);

  const canSelect = originalImageAccessEnabled && photo.originalAvailable !== false;
  const photoSurface = document.createElement("button");
  photoSurface.className = "photo-zoom-button";
  photoSurface.type = "button";
  photoSurface.dataset.originalAriaLabel = `${photo.name}を拡大表示`;
  photoSurface.setAttribute("aria-label", photoSurface.dataset.originalAriaLabel);
  photoSurface.addEventListener("click", () => {
    openPhotoLightbox(photo);
  });
  photoSurface.append(frame);

  const caption = document.createElement("figcaption");
  caption.textContent = formatPhotoDate(photo);

  item.append(photoSurface);

  if (canSelect) {
    item.append(selectionLabel);
  }

  if (isAdminMode && isAdminAuthenticated) {
    const deleteButton = document.createElement("button");
    deleteButton.className = "photo-delete-button";
    deleteButton.type = "button";
    deleteButton.setAttribute("aria-label", `${photo.name}を削除`);
    deleteButton.textContent = "削除";
    deleteButton.addEventListener("click", async () => {
      if (!window.confirm("この写真を削除します。よろしいですか？")) return;

      deleteButton.disabled = true;
      setAdminStatus("削除しています...");

      try {
        await adminRequest({ action: "delete", name: photo.name });
        knownPhotoIds.delete(photo.id);
        selectedPhotoIds.delete(photo.id);
        photoStore.delete(photo.id);
        item.remove();
        total = Math.max(0, total - 1);
        offset = Math.max(0, offset - 1);
        updateStatus("1枚削除しました。");
        updateDownloadSelectedButton();
        setAdminStatus("削除しました。");
      } catch (error) {
        setAdminStatus(error.message);
        deleteButton.disabled = false;
      }
    });
    item.append(deleteButton);
  }

  item.append(caption);
  return item;
};

const fetchPhotos = async ({ sort = currentSort, pageOffset = offset, limit = PAGE_SIZE } = {}) => {
  const params = new URLSearchParams({
    sort,
    offset: String(pageOffset),
    limit: String(limit),
  });

  const response = await fetch(`api/list.php?${params.toString()}`, {
    cache: "no-store",
  });
  const result = await response.json().catch(() => ({}));

  if (!response.ok || !result.ok) {
    throw new Error(result.error || "写真一覧を読み込めませんでした。");
  }

  if (typeof result.originalAccessEnabled === "boolean") {
    originalImageAccessEnabled = result.originalAccessEnabled;
    updateOriginalAccessControls();
  }

  const nextPollIntervalMs = Number(result.pollIntervalMs) || DEFAULT_POLL_INTERVAL_MS;
  if (nextPollIntervalMs !== pollIntervalMs) {
    pollIntervalMs = nextPollIntervalMs;
    if (pollTimer !== null) {
      schedulePolling();
    }
  }

  return result;
};

const fetchAllSlideshowPhotos = async () => {
  const photos = [];
  let pageOffset = 0;
  let hasNextPage = true;

  while (hasNextPage) {
    const result = await fetchPhotos({
      sort: currentSort,
      pageOffset,
      limit: PAGE_SIZE,
    });

    photos.push(...result.photos);
    pageOffset += result.photos.length;
    hasNextPage = Boolean(result.hasMore) && result.photos.length > 0;
  }

  return photos;
};

const closeSlideshow = () => {
  if (!slideshowDialog.open) return;
  if (slideshowDialog.classList.contains("is-closing")) return;

  window.clearInterval(slideshowAutoTimer);
  slideshowAutoTimer = null;
  window.clearTimeout(slideshowCloseTimer);
  slideshowDialog.classList.remove("is-open");
  slideshowDialog.classList.add("is-closing");

  const finishClose = () => {
    slideshowDialog.classList.remove("is-closing");
    slideshowDialog.close();
  };

  if (prefersReducedMotion.matches) {
    finishClose();
    return;
  }

  slideshowCloseTimer = window.setTimeout(finishClose, 180);
};

const openSlideshow = async () => {
  if (!isGalleryActive || slideshowButton.disabled || !originalImageAccessEnabled) return;

  lastSlideshowFocus = document.activeElement instanceof HTMLElement ? document.activeElement : slideshowButton;
  slideshowButton.disabled = true;
  setSlideshowStatus("スライドショーを準備しています...");

  try {
    slideshowPhotos = await fetchAllSlideshowPhotos();

    if (slideshowPhotos.length === 0) {
      setSlideshowStatus("表示できる写真がありません。");
      return;
    }

    slideshowIndex = 0;
    renderSlideshowSlides();
    updateSlideshowButtons();
    slideshowDialog.classList.remove("is-open", "is-closing");

    if (!slideshowDialog.open) {
      slideshowDialog.showModal();
    }

    window.requestAnimationFrame(() => {
      slideshowDialog.classList.add("is-open");
      scheduleSlideshowAutoAdvance();
    });

    slideshowCloseButton.focus();
    setStatus("");
  } catch (error) {
    setSlideshowStatus(error.message);
  } finally {
    slideshowButton.disabled = false;
  }
};

const appendPhoto = (photo, options = {}) => {
  if (knownPhotoIds.has(photo.id)) return false;

  knownPhotoIds.add(photo.id);
  photoStore.set(photo.id, photo);
  grid.append(createPhotoItem(photo, options));
  return true;
};

const insertPhoto = (photo, options = {}) => {
  if (knownPhotoIds.has(photo.id)) return false;

  const item = createPhotoItem(photo, options);
  const existingItems = Array.from(grid.querySelectorAll(".photo-item"));
  const nextItem = existingItems.find((existingItem) => {
    const existingPhoto = photoFromItem(existingItem);
    return comparePhotos(photo, existingPhoto) < 0;
  });

  knownPhotoIds.add(photo.id);
  photoStore.set(photo.id, photo);
  grid.insertBefore(item, nextItem || null);
  return true;
};

const loadNextPage = async () => {
  if (!isGalleryActive || isLoading || !hasMore) return;

  isLoading = true;
  sentinel.classList.add("is-loading");

  try {
    const result = await fetchPhotos();
    total = result.total || 0;
    hasMore = Boolean(result.hasMore);
    offset += result.photos.length;

    for (const photo of result.photos) {
      appendPhoto(photo);
    }

    updateStatus();
    updateDownloadSelectedButton();
    updateSelectionLimitControls();
  } catch (error) {
    setStatus(error.message);
    hasMore = false;
  } finally {
    isLoading = false;
    sentinel.classList.toggle("is-loading", hasMore);
  }
};

const pollForNewPhotos = async () => {
  if (!isGalleryActive || isPolling || document.hidden) return;

  isPolling = true;

  try {
    const result = await fetchPhotos({
      sort: "newest",
      pageOffset: 0,
      limit: PAGE_SIZE,
    });
    const newPhotos = result.photos.filter((photo) => !knownPhotoIds.has(photo.id));

    if (newPhotos.length > 0) {
      total = result.total || total + newPhotos.length;
      offset += newPhotos.length;

      const sortedNewPhotos = [...newPhotos].sort((left, right) => comparePhotos(left, right));
      let insertedCount = 0;
      for (const photo of sortedNewPhotos) {
        if (insertPhoto(photo, { isNew: true })) {
          insertedCount += 1;
        }
      }

      if (insertedCount > 0) {
        updateStatus(`${insertedCount}枚追加されました。`);
        updateDownloadSelectedButton();
        updateSelectionLimitControls();
      }
    } else {
      total = result.total || total;
      updateStatus();
      updateDownloadSelectedButton();
      updateSelectionLimitControls();
    }

    hasMore = knownPhotoIds.size < total;
    sentinel.classList.toggle("is-loading", hasMore && isLoading);
  } catch (_error) {
    // Temporary polling failures should not disturb the projected gallery.
  } finally {
    isPolling = false;
  }
};

const schedulePolling = () => {
  window.clearInterval(pollTimer);
  pollTimer = window.setInterval(pollForNewPhotos, pollIntervalMs);
};

const resetGallery = () => {
  offset = 0;
  total = 0;
  hasMore = true;
  knownPhotoIds.clear();
  selectedPhotoIds.clear();
  photoStore.clear();
  grid.innerHTML = "";
  setStatus("");
  updateDownloadSelectedButton();
  updateSelectionLimitControls();
  loadNextPage();
};

const observer = new IntersectionObserver(
  (entries) => {
    if (entries.some((entry) => entry.isIntersecting)) {
      loadNextPage();
    }
  },
  {
    rootMargin: "720px 0px",
  },
);

observer.observe(sentinel);

downloadSelectedButton.addEventListener("click", () => {
  downloadSelectedPhotos();
});

clearSelectionButton.addEventListener("click", () => {
  clearSelectedPhotos();
});

zipProgressCloseButton.addEventListener("click", () => {
  closeZipProgress();
});

zipProgressDialog.addEventListener("cancel", (event) => {
  if (zipProgressCloseButton.hidden) {
    event.preventDefault();
  }
});

slideshowButton.addEventListener("click", () => {
  openSlideshow();
});

slideshowCloseButton.addEventListener("click", () => {
  closeSlideshow();
});

slideshowPrevButton.addEventListener("click", () => {
  moveSlideshow(-1);
  scheduleSlideshowAutoAdvance();
});

slideshowNextButton.addEventListener("click", () => {
  moveSlideshow(1);
  scheduleSlideshowAutoAdvance();
});

slideshowDialog.addEventListener("cancel", (event) => {
  event.preventDefault();
  closeSlideshow();
});

slideshowDialog.addEventListener("keydown", (event) => {
  if (event.key === "ArrowLeft") {
    event.preventDefault();
    moveSlideshow(-1);
    scheduleSlideshowAutoAdvance();
  }

  if (event.key === "ArrowRight") {
    event.preventDefault();
    moveSlideshow(1);
    scheduleSlideshowAutoAdvance();
  }
});

slideshowDialog.addEventListener("close", () => {
  window.clearInterval(slideshowAutoTimer);
  window.clearTimeout(slideshowCloseTimer);
  window.clearTimeout(slideshowTransitionTimer);

  slideshowDialog.classList.remove("is-open", "is-closing");
  slideshowTrack.classList.remove("is-animating");
  slideshowTrack.style.transform = "translateX(calc(-1 * (var(--slideshow-slide-width) + var(--slideshow-slide-gap))))";
  slideshowTrack.innerHTML = "";
  slideshowCounter.textContent = "0 / 0";
  slideshowPhotos = [];
  slideshowIndex = 0;
  isSlideshowAnimating = false;
  updateSlideshowButtons();
  lastSlideshowFocus?.focus();
  lastSlideshowFocus = null;
});

lightbox.closeButton.addEventListener("click", () => {
  closePhotoLightbox();
});

lightbox.downloadButton.addEventListener("click", () => {
  if (lightbox.downloadButton.disabled) return;

  const photo = photoStore.get(lightboxCurrentPhotoId);
  if (photo) {
    downloadPhoto(photo);
  }
});

lightbox.prevButton.addEventListener("click", () => {
  movePhotoLightbox(-1);
});

lightbox.nextButton.addEventListener("click", () => {
  movePhotoLightbox(1);
});

lightbox.dialog.addEventListener("click", (event) => {
  if (event.target === lightbox.dialog) {
    closePhotoLightbox();
  }
});

lightbox.dialog.addEventListener("cancel", (event) => {
  event.preventDefault();
  closePhotoLightbox();
});

lightbox.dialog.addEventListener("keydown", (event) => {
  if (event.key === "ArrowLeft") {
    event.preventDefault();
    movePhotoLightbox(-1);
  }

  if (event.key === "ArrowRight") {
    event.preventDefault();
    movePhotoLightbox(1);
  }
});

lightbox.dialog.addEventListener("close", () => {
  window.clearTimeout(lightboxCloseTimer);
  lightbox.dialog.classList.remove("is-open", "is-closing");
  lightbox.image.removeAttribute("src");
  lightbox.image.alt = "";
  lightbox.caption.textContent = "";
  lightboxCurrentPhotoId = null;
  lastFocusedElement?.focus();
  lastFocusedElement = null;
});

sortSelect.addEventListener("change", () => {
  currentSort = sortSelect.value;
  resetGallery();
});

document.addEventListener("visibilitychange", () => {
  if (!document.hidden) {
    pollForNewPhotos();
  }
});

const initializeGallery = async () => {
  if (!(await authenticateAdminMode())) return;
  if (!(await authenticateViewMode())) return;

  let locationConfig = null;
  let originalAccessConfig = null;
  try {
    const settings = await fetchGallerySettings();
    locationConfig = settings.locationConfig || null;
    originalAccessConfig = settings.originalAccessConfig || null;
    if (originalAccessConfig && typeof originalAccessConfig.enabled === "boolean") {
      originalImageAccessEnabled = originalAccessConfig.enabled;
    }
    downloadZipMaxFiles = Math.max(1, Number(settings.downloadZipMaxFiles) || downloadZipMaxFiles);
    updateOriginalAccessControls();
  } catch (_error) {
    // 設定取得失敗時は位置制限なしで続行
  }

  // 管理モード・閲覧モードは位置制限をバイパス
  if (!isAdminMode && !isViewAuthenticated && !(await checkLocationAccess(locationConfig))) {
    return;
  }

  isGalleryActive = true;
  createAdminToolbar(locationConfig, originalAccessConfig);
  resetGallery();
  schedulePolling();
};

initializeGallery();
