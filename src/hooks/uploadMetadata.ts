export interface IpfsUploadResult {
  /** The bare IPFS CID (content identifier) of the pinned JSON. */
  cid: string;
  /** A gateway URL for the pinned JSON (handy for previews/debugging). */
  url: string;
}

export const uploadMetadataToIPFS = async (
  metadata: any
): Promise<IpfsUploadResult> => {
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

      const result = (await response.json()) as Partial<IpfsUploadResult>;
      // The on-chain VerifiableURI is built from `cid`. A missing CID must fail
      // loudly HERE rather than letting the caller encode `ipfs://undefined`
      // (a valid hash pointing at unfetchable content) into ERC725Y storage.
      if (!result?.cid) {
        throw new Error('IPFS upload succeeded but returned no CID');
      }
      return { cid: result.cid, url: result.url ?? '' };
    } catch (error) {
      console.error('Error uploading to IPFS:', error);
      throw error;
    }
  };
