const MAX_INPUT_BYTES = 10 * 1024 * 1024;
const MAX_EDGE = 2000;
const JPEG_QUALITY = 0.85;

const VIDEO_EXTENSIONS = /\.(mp4|mov|m4v|avi|mkv|webm|3gp|hevc)$/i;
const IMAGE_EXTENSIONS = /\.(jpe?g|png|webp|heic|heif)$/i;

export function validateImageFile(file: File) {
  if (file.type.startsWith("video/") || VIDEO_EXTENSIONS.test(file.name)) {
    throw new Error("Videos sind nicht erlaubt. Bitte lade stattdessen ein Foto hoch.");
  }
  if (!file.type.startsWith("image/") && !IMAGE_EXTENSIONS.test(file.name)) {
    throw new Error("Bitte wähle eine Bilddatei im Format JPG, PNG, WEBP oder HEIC aus.");
  }
  if (file.size > MAX_INPUT_BYTES) {
    throw new Error("Das Bild ist größer als 10 MB. Bitte wähle ein kleineres Foto aus.");
  }
}

export async function optimizeImage(file: File, onProgress?: (message: string) => void): Promise<File> {
  validateImageFile(file);
  onProgress?.("Foto wird vorbereitet …");

  const sourceUrl = URL.createObjectURL(file);
  try {
    const image = await loadImage(sourceUrl);
    const longest = Math.max(image.naturalWidth, image.naturalHeight);
    const scale = Math.min(1, MAX_EDGE / longest);
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Das Foto konnte nicht optimiert werden.");
    context.drawImage(image, 0, 0, width, height);

    onProgress?.("Foto wird komprimiert …");
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(value => value ? resolve(value) : reject(new Error("Das Foto konnte nicht komprimiert werden.")), "image/jpeg", JPEG_QUALITY);
    });
    const base = file.name.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9_-]/g, "-") || "foto";
    return new File([blob], `${base}.jpg`, { type: "image/jpeg", lastModified: Date.now() });
  } catch (error) {
    if (/heic|heif/i.test(file.type) || /\.(heic|heif)$/i.test(file.name)) {
      throw new Error("Dieses HEIC-Foto kann auf diesem Gerät nicht verarbeitet werden. Bitte als JPG exportieren oder einen Screenshot verwenden.");
    }
    throw error;
  } finally {
    URL.revokeObjectURL(sourceUrl);
  }
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Das Bild konnte nicht geladen werden."));
    image.src = src;
  });
}
