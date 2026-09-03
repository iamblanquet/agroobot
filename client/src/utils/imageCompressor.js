/**
 * Utilidad para comprimir imágenes en el cliente antes de almacenar en IndexedDB
 * o transmitir al backend por red móvil débil.
 * Redimensiona a un máximo de 1280px y comprime a JPEG con calidad 0.75-0.8.
 */

export function compressImage(file, maxWidth = 1280, maxHeight = 1280, quality = 0.75) {
  return new Promise((resolve, reject) => {
    if (!file.type.match(/image.*/)) {
      return reject(new Error('El archivo seleccionado no es una imagen válida.'));
    }

    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = (event) => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        // Exportar a base64 JPEG optimizado
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve({
          data: dataUrl,
          name: file.name,
          sizeBefore: file.size,
          sizeAfter: Math.round((dataUrl.length * 3) / 4),
          width,
          height
        });
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  });
}
