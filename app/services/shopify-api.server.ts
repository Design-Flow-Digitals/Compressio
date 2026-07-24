export async function createBackupFile(graphql: any, originalUrl: string, filename: string) {
  // Using fileCreate to create an unattached backup
  const response = await graphql(
    `
      mutation fileCreate($files: [FileCreateInput!]!) {
        fileCreate(files: $files) {
          files {
            id
            alt
          }
          userErrors {
            field
            message
          }
        }
      }
    `,
    {
      variables: {
        files: [
          {
            originalSource: originalUrl,
            contentType: "IMAGE",
            alt: `Backup of ${filename}`,
          },
        ],
      },
    }
  );
  const json = await response.json();
  const fileId = json.data?.fileCreate?.files?.[0]?.id;
  if (!fileId) {
    throw new Error(`Failed to create backup file: ${JSON.stringify(json.data?.fileCreate?.userErrors)}`);
  }
  return fileId;
}

export async function uploadStagedFile(graphql: any, buffer: Buffer, filename: string, mimeType: string) {
  // 1. Generate staged upload URL
  const stagedUploadResponse = await graphql(
    `
      mutation stagedUploadsCreate($input: [StagedUploadInput!]!) {
        stagedUploadsCreate(input: $input) {
          stagedTargets {
            url
            resourceUrl
            parameters {
              name
              value
            }
          }
          userErrors {
            field
            message
          }
        }
      }
    `,
    {
      variables: {
        input: [
          {
            filename,
            mimeType,
            resource: "FILE",
            httpMethod: "POST",
          },
        ],
      },
    }
  );

  const json = await stagedUploadResponse.json();
  const target = json.data?.stagedUploadsCreate?.stagedTargets?.[0];
  
  if (!target) {
    throw new Error(`Failed to create staged upload: ${JSON.stringify(json.data?.stagedUploadsCreate?.userErrors)}`);
  }

  // 2. Upload the file to the staged URL
  const formData = new FormData();
  target.parameters.forEach((param: any) => {
    formData.append(param.name, param.value);
  });
  formData.append("file", new Blob([new Uint8Array(buffer)], { type: mimeType }));

  const uploadResponse = await fetch(target.url, {
    method: "POST",
    body: formData,
  });

  if (!uploadResponse.ok) {
    throw new Error(`Failed to upload to staged target: ${uploadResponse.statusText}`);
  }

  return target.resourceUrl;
}

export async function replaceFile(graphql: any, fileId: string, stagedResourceUrl: string) {
  const response = await graphql(
    `
      mutation fileUpdate($input: [FileUpdateInput!]!) {
        fileUpdate(files: $input) {
          files {
            id
            fileStatus
          }
          userErrors {
            field
            message
          }
        }
      }
    `,
    {
      variables: {
        input: [
          {
            id: fileId,
            originalSource: stagedResourceUrl,
          },
        ],
      },
    }
  );
  
  const json = await response.json();
  const updatedFileId = json.data?.fileUpdate?.files?.[0]?.id;
  if (!updatedFileId) {
    throw new Error(`Failed to replace file: ${JSON.stringify(json.data?.fileUpdate?.userErrors)}`);
  }
  return updatedFileId;
}
