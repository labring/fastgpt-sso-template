declare module 'metadata-saml2' {
  export async function parseIDPMetadataFromString(metadata: string): Promise<{
    entityId: string;
    X509Certificates: string[];
    HTTPRedirect: string;
    HTTPPost: string;
  }>;
}
