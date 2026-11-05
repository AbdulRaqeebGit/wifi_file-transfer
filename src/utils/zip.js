import JSZip from 'jszip';

export async function downloadAllAsZip(files) {
  if (!files || files.length === 0) return;

  const zip = new JSZip();

  for (const file of files) {
    if (file.blob) {
      zip.file(file.name, file.blob);
    } else if (file.url) {
      try {
        const res = await fetch(file.url);
        const blob = await res.blob();
        zip.file(file.name, blob);
      } catch (err) {
        console.error('Error fetching file for zip:', err);
      }
    }
  }

  const content = await zip.generateAsync({ type: 'blob' });
  const downloadUrl = URL.createObjectURL(content);
  const a = document.createElement('a');
  a.href = downloadUrl;
  a.download = `AR_WiFi_TR_${Date.now()}.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(downloadUrl), 5000);
}
