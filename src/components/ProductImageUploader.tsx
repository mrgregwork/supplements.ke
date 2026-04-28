import { useState, useRef } from "react";

interface ProductImageUploaderProps {
  images: string[];
  onChange: (images: string[]) => void;
}

const TARGET_SIZE = 600;

// Resize/pad any non-square image to 600x600 with white background (contain fit)
function squareImage(file: File): Promise<{ blob: Blob; name: string; type: string }> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      // Already square at the right size — skip processing
      if (img.naturalWidth === img.naturalHeight && img.naturalWidth === TARGET_SIZE) {
        resolve({ blob: file, name: file.name, type: file.type });
        return;
      }

      const canvas = document.createElement("canvas");
      canvas.width = TARGET_SIZE;
      canvas.height = TARGET_SIZE;
      const ctx = canvas.getContext("2d");
      if (!ctx) { reject(new Error("Canvas not supported")); return; }

      // White background
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, TARGET_SIZE, TARGET_SIZE);

      // Scale image to fit inside 600x600 (contain, centered)
      const scale = Math.min(TARGET_SIZE / img.naturalWidth, TARGET_SIZE / img.naturalHeight);
      const drawW = img.naturalWidth * scale;
      const drawH = img.naturalHeight * scale;
      const offsetX = (TARGET_SIZE - drawW) / 2;
      const offsetY = (TARGET_SIZE - drawH) / 2;

      ctx.drawImage(img, offsetX, offsetY, drawW, drawH);

      canvas.toBlob(
        (blob) => {
          if (!blob) { reject(new Error("Failed to process image")); return; }
          const baseName = file.name.replace(/\.[^.]+$/, "");
          resolve({ blob, name: `${baseName}.jpg`, type: "image/jpeg" });
        },
        "image/jpeg",
        0.92
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error(`Could not load image: ${file.name}`));
    };

    img.src = objectUrl;
  });
}

export default function ProductImageUploader({ images, onChange }: ProductImageUploaderProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [processedCount, setProcessedCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    setError(null);
    setUploadProgress(0);
    setProcessedCount(0);
    setTotalCount(files.length);

    const newImages: string[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      try {
        // Step 1: process to 600x600 square if needed
        const { blob, name, type } = await squareImage(file);

        // Step 2: request presigned upload URL
        const urlRes = await fetch("/api/uploads/request-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, size: blob.size, contentType: type }),
        });

        if (!urlRes.ok) throw new Error("Failed to get upload URL");

        const { uploadURL, objectPath } = await urlRes.json();

        // Step 3: upload to storage
        await fetch(uploadURL, {
          method: "PUT",
          body: blob,
          headers: { "Content-Type": type },
        });

        newImages.push(objectPath);
        setProcessedCount(i + 1);
        setUploadProgress(Math.round(((i + 1) / files.length) * 100));
      } catch (err: any) {
        console.error("Upload failed:", err);
        setError(`Failed to upload ${file.name}: ${err.message}`);
      }
    }

    if (newImages.length > 0) {
      onChange([...images, ...newImages]);
    }

    setIsUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeImage = (index: number) => {
    const next = [...images];
    next.splice(index, 1);
    onChange(next);
  };

  const moveImage = (index: number, direction: "up" | "down") => {
    const next = [...images];
    const target = direction === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  return (
    <div className="space-y-4">
      {images.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {images.map((url, index) => (
            <div
              key={`${url}-${index}`}
              className="relative group aspect-square bg-muted rounded-lg overflow-hidden border"
            >
              <img
                src={url}
                alt={`Product image ${index + 1}`}
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).src =
                    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'%3E%3Crect fill='%23f0f0f0' width='100' height='100'/%3E%3Ctext fill='%23999' x='50' y='50' text-anchor='middle' dy='.3em' font-size='12'%3ENo image%3C/text%3E%3C/svg%3E";
                }}
              />

              {index === 0 && (
                <span className="absolute top-1 left-1 bg-primary text-primary-foreground text-xs px-2 py-0.5 rounded">
                  Main
                </span>
              )}

              {/* Desktop hover controls */}
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 md:transition-opacity flex items-center justify-center gap-1">
                <button
                  type="button"
                  onClick={() => moveImage(index, "up")}
                  disabled={index === 0}
                  className="w-10 h-10 min-h-[40px] bg-white/90 rounded-full flex items-center justify-center hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label="Move left"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M15 18l-6-6 6-6" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => removeImage(index)}
                  className="w-10 h-10 min-h-[40px] bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600"
                  aria-label="Remove image"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => moveImage(index, "down")}
                  disabled={index === images.length - 1}
                  className="w-10 h-10 min-h-[40px] bg-white/90 rounded-full flex items-center justify-center hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label="Move right"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                </button>
              </div>

              {/* Mobile controls */}
              <div className="absolute bottom-0 left-0 right-0 p-2 md:hidden bg-black/60 flex justify-center gap-3">
                <button type="button" onClick={() => moveImage(index, "up")} disabled={index === 0}
                  className="w-12 h-12 min-h-[48px] bg-white/90 rounded-lg flex items-center justify-center disabled:opacity-50" aria-label="Move left">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6" /></svg>
                </button>
                <button type="button" onClick={() => removeImage(index)}
                  className="w-12 h-12 min-h-[48px] bg-red-500 text-white rounded-lg flex items-center justify-center" aria-label="Remove">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
                </button>
                <button type="button" onClick={() => moveImage(index, "down")} disabled={index === images.length - 1}
                  className="w-12 h-12 min-h-[48px] bg-white/90 rounded-lg flex items-center justify-center disabled:opacity-50" aria-label="Move right">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6" /></svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {error && <p className="text-red-500 text-sm">{error}</p>}

      {isUploading && (
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-primary transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
            </div>
            <span className="text-sm text-muted-foreground tabular-nums">{uploadProgress}%</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Processing image {processedCount + 1} of {totalCount} — resizing to 600×600 square…
          </p>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileSelect}
          className="hidden"
          id="product-image-input"
          data-testid="input-image-file"
        />
        <label
          htmlFor="product-image-input"
          className={`inline-flex items-center justify-center gap-2 px-4 py-3 min-h-[48px] bg-primary text-primary-foreground rounded-lg font-medium cursor-pointer hover:opacity-90 transition ${isUploading ? "opacity-50 pointer-events-none" : ""}`}
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          {isUploading ? "Uploading…" : "Upload Images"}
        </label>

        <div className="text-sm text-muted-foreground">
          {images.length === 0
            ? "No images added yet."
            : `${images.length} image${images.length !== 1 ? "s" : ""} — first image is the main photo.`}
          <span className="block text-xs mt-0.5 text-muted-foreground/70">
            Non-square images are automatically padded to 600×600
          </span>
        </div>
      </div>
    </div>
  );
}
