export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const blobUrl = URL.createObjectURL(file);
    img.onload = () => {
      const maxEdge = 960;
      const scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(blobUrl);
        reject(new Error("canvas"));
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(blobUrl);
      try {
        resolve(compressCanvas(canvas));
      } catch (error) {
        reject(error);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(blobUrl);
      reject(new Error("read"));
    };
    img.src = blobUrl;
  });
}

function compressCanvas(canvas: HTMLCanvasElement) {
  let quality = 0.72;
  let url = canvas.toDataURL("image/jpeg", quality);
  while (url.length > 140_000 && quality > 0.42) {
    quality -= 0.08;
    url = canvas.toDataURL("image/jpeg", quality);
  }
  if (!url.startsWith("data:image/jpeg") || url.length > 180_000) throw new Error("big");
  return url;
}

/** Light contrast lift. Sellers can skip it. Fails closed if the browser cannot redraw the photo. */
export function enhanceDataUrl(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, img.width);
      canvas.height = Math.max(1, img.height);
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("canvas"));
        return;
      }
      ctx.filter = "contrast(1.14) saturate(1.08) brightness(1.04)";
      ctx.drawImage(img, 0, 0);
      try {
        resolve(compressCanvas(canvas));
      } catch (error) {
        reject(error);
      }
    };
    img.onerror = () => reject(new Error("read"));
    img.src = url;
  });
}
