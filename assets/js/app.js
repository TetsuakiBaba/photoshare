const uploadButton = document.querySelector("#upload-button");
const photoInput = document.querySelector("#photo-input");
const progressEl = document.querySelector(".upload-progress");
const progressBar = document.querySelector("#upload-progress-bar");
const previewDialog = document.querySelector("#preview-dialog");
const previewPanel = document.querySelector("#preview-panel");
const previewList = document.querySelector("#preview-list");
const previewCount = document.querySelector("#preview-count");
const sendButton = document.querySelector("#send-button");
const clearButton = document.querySelector("#clear-button");
const selectMoreButton = document.querySelector("#select-more-button");
const uploadStatus = document.querySelector("#upload-status");
const galleryScrollButton = document.querySelector("#gallery-scroll-button");
const gallerySection = document.querySelector("#gallery-section");
const galleryHeader = document.querySelector(".gallery-header");
const licenseInfoButton = document.querySelector("#license-info-button");
const licenseDialog = document.querySelector("#license-dialog");
const licenseCloseButton = document.querySelector("#license-close-button");
const licenseConfirmButton = document.querySelector("#license-confirm-button");

const selectedPhotos = new Map();
const selectedThumbnails = new Map();
const previewUrls = new Map();
let previewCloseTimer = null;
let shouldResetPreviewAfterClose = false;
let uploadStatusTypeTimer = null;
let licenseCloseTimer = null;
let shouldOpenPhotoPickerAfterLicense = false;
let hasConfirmedUsageNotesInSession = false;
let heicLibraryPromise = null;

const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const photoShareConfig = window.photoShareConfig || {};
const usageNotesStorageKey = photoShareConfig.usageNotesStorageKey || "photo-sharing-usage-notes-confirmed";
const pageParams = new URLSearchParams(window.location.search);
const shouldDebugFirstVisit = pageParams.get("debug_first_visit") === "1";

const updateGalleryHeaderVisibility = () => {
  const galleryTop = gallerySection.getBoundingClientRect().top;
  galleryHeader.classList.toggle("is-fixed", galleryTop <= galleryHeader.offsetHeight);
};

const setProgress = (value) => {
  const safeValue = Math.max(0, Math.min(100, value));
  progressEl.style.setProperty("--progress", `${safeValue}%`);
  uploadButton.style.setProperty("--progress", `${safeValue}%`);
  progressBar.style.setProperty("--progress", `${safeValue}%`);
  progressBar.setAttribute("aria-valuenow", String(Math.round(safeValue)));
};

const setProgressBarActive = (isActive) => {
  if (isActive) {
    progressBar.hidden = false;
    progressBar.classList.add("is-active");
    return;
  }

  progressBar.classList.remove("is-active");

  window.setTimeout(() => {
    if (!progressBar.classList.contains("is-active")) {
      progressBar.hidden = true;
    }
  }, 180);
};

const formatCount = (count) => `${count}枚`;

const photoKey = (file) => `${file.name}-${file.size}-${file.lastModified}`;
const supportedPhotoExtensions = new Set(["jpg", "jpeg", "png", "gif", "webp", "heic", "heif"]);
const supportedPhotoMimeTypes = new Set(["image/jpeg", "image/png", "image/gif", "image/webp", "image/heic", "image/heif"]);
const heicPhotoExtensions = new Set(["heic", "heif"]);
const heicPhotoMimeTypes = new Set(["image/heic", "image/heif"]);
const thumbnailMaxWidth = 512;
const thumbnailMaxHeight = 512;
const thumbnailJpegQuality = 0.72;

const isSupportedPhotoFile = (file) => {
  if (supportedPhotoMimeTypes.has(file.type)) {
    return true;
  }

  const extension = file.name.split(".").pop()?.toLowerCase();
  return extension ? supportedPhotoExtensions.has(extension) : false;
};

const isHeicPhotoFile = (file) => {
  if (heicPhotoMimeTypes.has(file.type)) {
    return true;
  }

  const extension = file.name.split(".").pop()?.toLowerCase();
  return extension ? heicPhotoExtensions.has(extension) : false;
};

const setUploadStatus = (message = "", type = "") => {
  window.clearInterval(uploadStatusTypeTimer);
  uploadStatusTypeTimer = null;

  uploadStatus.classList.toggle("is-error", type === "error");
  uploadStatus.classList.toggle("is-success", type === "success");

  if (type !== "success" || message === "") {
    uploadStatus.textContent = message;
    return;
  }

  let index = 0;
  uploadStatus.textContent = "";
  uploadStatusTypeTimer = window.setInterval(() => {
    index += 1;
    uploadStatus.textContent = message.slice(0, index);

    if (index >= message.length) {
      window.clearInterval(uploadStatusTypeTimer);
      uploadStatusTypeTimer = null;
    }
  }, 100);
};

const revokePreviewUrl = (key) => {
  const previewUrl = previewUrls.get(key);
  if (!previewUrl) return;

  URL.revokeObjectURL(previewUrl);
  previewUrls.delete(key);
};

const clearSelectedPhotos = () => {
  for (const key of previewUrls.keys()) {
    revokePreviewUrl(key);
  }

  selectedPhotos.clear();
  selectedThumbnails.clear();
  photoInput.value = "";
  renderPreviews();
};

const loadImageFromBlob = (blob) =>
  new Promise((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(blob);

    image.addEventListener("load", () => {
      URL.revokeObjectURL(url);
      resolve(image);
    }, { once: true });

    image.addEventListener("error", () => {
      URL.revokeObjectURL(url);
      reject(new Error("画像を読み込めませんでした。"));
    }, { once: true });

    image.src = url;
  });

const blobFromCanvas = (canvas, type, quality) =>
  new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("サムネイルを作成できませんでした。"));
        return;
      }

      resolve(blob);
    }, type, quality);
  });

const loadHeicLibrary = () => {
  if (window.HeicTo) {
    return Promise.resolve(window.HeicTo);
  }

  if (heicLibraryPromise) {
    return heicLibraryPromise;
  }

  heicLibraryPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "assets/vendor/heic-to/heic-to.js";
    script.async = true;

    script.addEventListener("load", () => {
      if (window.HeicTo) {
        resolve(window.HeicTo);
        return;
      }

      reject(new Error("HEIC変換ライブラリを読み込めませんでした。"));
    }, { once: true });

    script.addEventListener("error", () => {
      reject(new Error("HEIC変換ライブラリを読み込めませんでした。"));
    }, { once: true });

    document.head.append(script);
  });

  return heicLibraryPromise;
};

const convertHeicToJpeg = async (file) => {
  const heicTo = await loadHeicLibrary();

  const convert = typeof heicTo === "function" ? heicTo : heicTo.heicTo;
  if (typeof convert !== "function") {
    throw new Error("HEIC変換ライブラリを実行できませんでした。");
  }

  return convert({
    blob: file,
    type: "image/jpeg",
    quality: 0.9,
  });
};

const createThumbnailBlob = async (file) => {
  const sourceBlob = isHeicPhotoFile(file) ? await convertHeicToJpeg(file) : file;
  const image = await loadImageFromBlob(sourceBlob);

  const scale = Math.min(thumbnailMaxWidth / image.naturalWidth, thumbnailMaxHeight / image.naturalHeight, 1);
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("サムネイル描画に対応していないブラウザです。");
  }

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);

  return blobFromCanvas(canvas, "image/jpeg", thumbnailJpegQuality);
};

const resetPreviewDialogContent = () => {
  previewList.innerHTML = "";
  previewPanel.hidden = true;
  previewPanel.classList.remove("is-sending");
  previewCount.textContent = `${formatCount(0)}選択中`;
  sendButton.disabled = true;
};

const closePreviewDialog = ({ resetAfterClose = false } = {}) => {
  if (!previewDialog.open) {
    if (resetAfterClose) resetPreviewDialogContent();
    return;
  }

  if (previewDialog.classList.contains("is-closing")) {
    shouldResetPreviewAfterClose = shouldResetPreviewAfterClose || resetAfterClose;
    return;
  }

  window.clearTimeout(previewCloseTimer);
  shouldResetPreviewAfterClose = resetAfterClose;
  previewDialog.classList.remove("is-open");
  previewDialog.classList.add("is-closing");

  const finishClose = () => {
    previewDialog.classList.remove("is-closing");
    previewDialog.close();
  };

  if (prefersReducedMotion.matches) {
    finishClose();
    return;
  }

  previewCloseTimer = window.setTimeout(finishClose, 180);
};

const openPreviewDialog = () => {
  const isAlreadyOpen = previewDialog.open && !previewDialog.classList.contains("is-closing");

  window.clearTimeout(previewCloseTimer);
  shouldResetPreviewAfterClose = false;

  if (isAlreadyOpen) {
    previewDialog.classList.add("is-open");
    return;
  }

  previewDialog.classList.remove("is-open", "is-closing");

  if (!previewDialog.open) {
    previewDialog.showModal();
  }

  window.requestAnimationFrame(() => {
    previewDialog.classList.add("is-open");
  });
};

const hasConfirmedUsageNotes = () => {
  if (hasConfirmedUsageNotesInSession) {
    return true;
  }

  if (shouldDebugFirstVisit) {
    return false;
  }

  try {
    return window.localStorage.getItem(usageNotesStorageKey) === "1";
  } catch {
    return false;
  }
};

const confirmUsageNotes = () => {
  hasConfirmedUsageNotesInSession = true;

  try {
    window.localStorage.setItem(usageNotesStorageKey, "1");
  } catch {
    // Continue for this click even if storage is unavailable.
  }
};

const closeLicenseDialog = ({ immediate = false, returnFocus = true } = {}) => {
  if (!licenseDialog.open) return;
  if (licenseDialog.classList.contains("is-closing")) return;

  window.clearTimeout(licenseCloseTimer);
  licenseDialog.classList.remove("is-open");
  licenseDialog.classList.add("is-closing");

  const finishClose = () => {
    licenseDialog.classList.remove("is-closing");
    licenseDialog.close();
    if (returnFocus) {
      licenseInfoButton.focus();
    }
  };

  if (immediate || prefersReducedMotion.matches) {
    finishClose();
    return;
  }

  licenseCloseTimer = window.setTimeout(finishClose, 180);
};

const openLicenseDialog = ({ focusConfirm = false } = {}) => {
  window.clearTimeout(licenseCloseTimer);
  licenseDialog.classList.remove("is-open", "is-closing");

  if (!licenseDialog.open) {
    licenseDialog.showModal();
  }

  window.requestAnimationFrame(() => {
    licenseDialog.classList.add("is-open");
  });

  if (focusConfirm) {
    licenseConfirmButton.focus();
    return;
  }

  licenseCloseButton.focus();
};

const requestPhotoSelection = () => {
  if (hasConfirmedUsageNotes()) {
    photoInput.click();
    return;
  }

  shouldOpenPhotoPickerAfterLicense = true;
  openLicenseDialog({ focusConfirm: true });
};

const renderPreviews = () => {
  const count = selectedPhotos.size;

  if (count === 0) {
    closePreviewDialog({ resetAfterClose: true });
    return;
  }

  previewPanel.hidden = false;
  previewList.innerHTML = "";

  for (const [key, file] of selectedPhotos.entries()) {
    let previewUrl = previewUrls.get(key);
    if (!previewUrl) {
      previewUrl = URL.createObjectURL(selectedThumbnails.get(key) || file);
      previewUrls.set(key, previewUrl);
    }

    const item = document.createElement("li");
    item.className = "preview-item";

    const image = document.createElement("img");
    image.src = previewUrl;
    image.alt = file.name;

    const removeButton = document.createElement("button");
    removeButton.className = "remove-preview";
    removeButton.type = "button";
    removeButton.setAttribute("aria-label", `${file.name}を外す`);
    removeButton.textContent = "×";
    removeButton.addEventListener("click", () => {
      selectedPhotos.delete(key);
      selectedThumbnails.delete(key);
      revokePreviewUrl(key);
      renderPreviews();
    });

    item.append(image, removeButton);
    previewList.append(item);
  }

  previewCount.textContent = `${formatCount(count)}選択中`;
  sendButton.disabled = false;

  openPreviewDialog();
};

const addPhotos = async (fileList) => {
  const files = Array.from(fileList).filter(isSupportedPhotoFile);
  if (files.length === 0) {
    setUploadStatus("JPEG、PNG、GIF、WebP、HEICの写真を選択してください。", "error");
    return;
  }

  uploadButton.classList.remove("is-success", "is-error");
  setUploadStatus();
  setProgress(0);
  setProgressBarActive(false);

  uploadButton.disabled = true;
  sendButton.disabled = true;
  clearButton.disabled = true;
  selectMoreButton.disabled = true;
  setUploadStatus("サムネイルを作成しています...");

  let addedCount = 0;
  let failedCount = 0;

  for (const file of files) {
    const key = photoKey(file);
    try {
      const thumbnail = await createThumbnailBlob(file);
      selectedPhotos.set(key, file);
      selectedThumbnails.set(key, thumbnail);
      revokePreviewUrl(key);
      addedCount += 1;
    } catch (_error) {
      failedCount += 1;
      selectedPhotos.delete(key);
      selectedThumbnails.delete(key);
      revokePreviewUrl(key);
    }
  }

  uploadButton.disabled = false;
  clearButton.disabled = false;
  selectMoreButton.disabled = false;

  if (failedCount > 0) {
    setUploadStatus(`${failedCount}枚はサムネイルを作成できなかったため除外しました。`, "error");
  } else {
    setUploadStatus();
  }

  if (addedCount === 0) {
    renderPreviews();
    return;
  }

  renderPreviews();
};

const uploadPhotos = (files) =>
  new Promise((resolve, reject) => {
    const formData = new FormData();

    for (const file of files) {
      const key = photoKey(file);
      formData.append("photos[]", file);
      formData.append("photoKeys[]", key);

      const thumbnail = selectedThumbnails.get(key);
      if (thumbnail) {
        formData.append("thumbnails[]", thumbnail, `${key}.jpg`);
        formData.append("thumbnailKeys[]", key);
      }
    }

    const request = new XMLHttpRequest();
    request.open("POST", "api/send.php");
    request.responseType = "json";

    request.upload.addEventListener("progress", (event) => {
      if (!event.lengthComputable) return;
      setProgress((event.loaded / event.total) * 100);
    });

    request.addEventListener("load", () => {
      const result = request.response || {};
      if (request.status < 200 || request.status >= 300 || !result.ok) {
        reject(new Error(result.error || "アップロードに失敗しました。"));
        return;
      }

      resolve(result);
    });

    request.addEventListener("error", () => {
      reject(new Error("通信に失敗しました。時間をおいてもう一度お試しください。"));
    });

    request.send(formData);
  });

const sendSelectedPhotos = async () => {
  const files = Array.from(selectedPhotos.values());
  if (files.length === 0) {
    return;
  }

  uploadButton.disabled = true;
  sendButton.disabled = true;
  clearButton.disabled = true;
  selectMoreButton.disabled = true;
  uploadButton.classList.remove("is-success", "is-error");
  uploadButton.classList.add("is-uploading");
  previewPanel.classList.add("is-sending");
  setProgress(0);
  setProgressBarActive(true);

  try {
    const result = await uploadPhotos(files);
    setProgress(100);
    uploadButton.classList.remove("is-uploading");
    uploadButton.classList.add("is-success");
    setUploadStatus(result.successMessage || "写真が送信されました", "success");
    clearSelectedPhotos();

    window.setTimeout(() => {
      uploadButton.classList.remove("is-success");
      setProgress(0);
      setProgressBarActive(false);
    }, 1800);
  } catch (error) {
    uploadButton.classList.remove("is-uploading");
    uploadButton.classList.add("is-error");
    sendButton.disabled = false;
    setUploadStatus(error.message, "error");

    window.setTimeout(() => {
      uploadButton.classList.remove("is-error");
      setProgress(0);
      setProgressBarActive(false);
    }, 1800);
  } finally {
    uploadButton.disabled = false;
    clearButton.disabled = false;
    selectMoreButton.disabled = false;
    previewPanel.classList.remove("is-sending");
    photoInput.value = "";
  }
};

uploadButton.addEventListener("click", () => {
  requestPhotoSelection();
});

selectMoreButton.addEventListener("click", () => {
  requestPhotoSelection();
});

clearButton.addEventListener("click", () => {
  clearSelectedPhotos();
});

licenseInfoButton.addEventListener("click", () => {
  shouldOpenPhotoPickerAfterLicense = false;
  openLicenseDialog();
});

licenseCloseButton.addEventListener("click", () => {
  shouldOpenPhotoPickerAfterLicense = false;
  closeLicenseDialog();
});

licenseDialog.addEventListener("click", (event) => {
  if (event.target === licenseDialog) {
    shouldOpenPhotoPickerAfterLicense = false;
    closeLicenseDialog();
  }
});

licenseDialog.addEventListener("cancel", (event) => {
  event.preventDefault();
  shouldOpenPhotoPickerAfterLicense = false;
  closeLicenseDialog();
});

licenseDialog.addEventListener("close", () => {
  window.clearTimeout(licenseCloseTimer);
  licenseDialog.classList.remove("is-open", "is-closing");
});

licenseConfirmButton.addEventListener("click", () => {
  const shouldOpenPhotoPicker = shouldOpenPhotoPickerAfterLicense;
  shouldOpenPhotoPickerAfterLicense = false;
  confirmUsageNotes();
  closeLicenseDialog({ immediate: shouldOpenPhotoPicker, returnFocus: !shouldOpenPhotoPicker });

  if (shouldOpenPhotoPicker) {
    photoInput.click();
  }
});

sendButton.addEventListener("click", () => {
  sendSelectedPhotos();
});

previewDialog.addEventListener("cancel", (event) => {
  event.preventDefault();
});

previewDialog.addEventListener("close", () => {
  window.clearTimeout(previewCloseTimer);
  previewDialog.classList.remove("is-open", "is-closing");

  if (shouldResetPreviewAfterClose) {
    resetPreviewDialogContent();
    shouldResetPreviewAfterClose = false;
  }
});

const scrollToGallery = () => {
  gallerySection.scrollIntoView({
    behavior: "smooth",
    block: "start",
  });
};

galleryScrollButton.addEventListener("click", () => {
  scrollToGallery();
});

window.addEventListener("scroll", updateGalleryHeaderVisibility, { passive: true });
window.addEventListener("resize", updateGalleryHeaderVisibility);
updateGalleryHeaderVisibility();

photoInput.addEventListener("change", (event) => {
  addPhotos(event.target.files);
  photoInput.value = "";
});
