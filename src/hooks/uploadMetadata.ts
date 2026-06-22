export const uploadMetadataToIPFS = async (metadata: any) => {
    try {
      const formData = new FormData();
      const metadataBlob = new Blob([JSON.stringify(metadata)], { type: 'application/json' });
      const metadataFile = new File([metadataBlob], 'metadata.json', { type: 'application/json' });
      formData.append('file', metadataFile);
  
      const response = await fetch('/api/pinata', {
        method: 'POST',
        body: formData,
      });
  
      if (!response.ok) {
        // Surface the real server-side reason (e.g. 403 missing pinning scope)
        // instead of an opaque failure, so console/toast point at the fix.
        let detail = ` (${response.status})`;
        try {
          const err = await response.json();
          if (err?.error) detail = ` (${response.status}: ${err.error})`;
        } catch {
          /* non-JSON error body — keep the status-only detail */
        }
        throw new Error(`Failed to upload metadata to IPFS${detail}`);
      }
  
      const ipfsUrl = await response.json();
      return ipfsUrl;
    } catch (error) {
      console.error('Error uploading to IPFS:', error);
      throw error;
    }
  };