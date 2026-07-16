
const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest';
const SCOPES = 'https://www.googleapis.com/auth/drive.file';

let tokenClient: any;
let gapiInited = false;
let gisInited = false;

export async function initDriveApi() {
  // Gán Client ID bạn đã cung cấp vào đây
  const clientId = '68539363188-77frjtpucnvprj7d854oagdfk5rt9fdc.apps.googleusercontent.com';
  
  if (!clientId) {
    console.warn("Google Drive Integration: GOOGLE_CLIENT_ID is not defined. Save to Drive feature will be disabled.");
    return Promise.reject("MISSING_CLIENT_ID");
  }

  return new Promise<void>((resolve, reject) => {
    try {
      if (!window.gapi || !window.google) {
        return reject("GAPI_NOT_LOADED");
      }

      window.gapi.load('client', async () => {
        try {
          await window.gapi.client.init({
            discoveryDocs: [DISCOVERY_DOC],
          });
          gapiInited = true;
          if (gisInited) resolve();
        } catch (e) {
          reject(e);
        }
      });

      tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: SCOPES,
        callback: '', // defined at request time
      });
      gisInited = true;
      if (gapiInited) resolve();
    } catch (e) {
      reject(e);
    }
  });
}

async function getAccessToken() {
  return new Promise<string>((resolve, reject) => {
    if (!tokenClient) {
      return reject("Google Drive API not initialized (Missing Client ID)");
    }
    try {
      tokenClient.callback = (resp: any) => {
        if (resp.error !== undefined) {
          reject(resp);
        }
        resolve(resp.access_token);
      };
      tokenClient.requestAccessToken({ prompt: 'consent' });
    } catch (err) {
      reject(err);
    }
  });
}

async function getOrCreateFolder(folderName: string) {
  const response = await window.gapi.client.drive.files.list({
    q: `name = '${folderName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: 'files(id, name)',
  });

  const folders = response.result.files;
  if (folders && folders.length > 0) {
    return folders[0].id;
  }

  const folderMetadata = {
    name: folderName,
    mimeType: 'application/vnd.google-apps.folder',
  };

  const folder = await window.gapi.client.drive.files.create({
    resource: folderMetadata,
    fields: 'id',
  });

  return folder.result.id;
}

export async function uploadToDrive(base64Data: string, fileName: string) {
  // Ensure token is available
  await getAccessToken();

  const folderId = await getOrCreateFolder('T-Shirt-Redesigns');

  // Convert base64 to Blob
  const byteString = atob(base64Data.split(',')[1]);
  const mimeString = base64Data.split(',')[0].split(':')[1].split(';')[0];
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);
  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }
  const blob = new Blob([ab], { type: mimeString });

  const metadata = {
    name: fileName,
    parents: [folderId],
  };

  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', blob);

  const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
    method: 'POST',
    headers: new Headers({ 'Authorization': 'Bearer ' + window.gapi.client.getToken().access_token }),
    body: form,
  });

  if (!response.ok) {
    throw new Error('Không thể tải lên Google Drive');
  }

  return await response.json();
}
