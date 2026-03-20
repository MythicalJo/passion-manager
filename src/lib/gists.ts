import { Member, AttendanceRecord } from '../types';

export interface SyncData {
  members: Member[];
  attendanceRecords: AttendanceRecord[];
  updatedAt: string;
}

const TOKEN_KEY = 'yg_github_token';
const GIST_ID_KEY = 'yg_gist_id';

export const getGithubToken = () => localStorage.getItem(TOKEN_KEY);
export const getGistId = () => localStorage.getItem(GIST_ID_KEY);

export const saveGithubConfig = (token: string, gistId?: string): boolean => {
  if (!token.startsWith('ghp_') && !token.startsWith('github_pat_')) {
      return false;
  }
  localStorage.setItem(TOKEN_KEY, token.trim());
  if (gistId) {
      localStorage.setItem(GIST_ID_KEY, gistId.trim());
  }
  return true;
};

export const clearGithubConfig = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(GIST_ID_KEY);
};

// Ensure a gist exists or fetch the one provided
export const initGist = async (): Promise<boolean> => {
  const token = getGithubToken();
  let gistId = getGistId();
  if (!token) return false;

  const headers = {
    'Accept': 'application/vnd.github.v3+json',
    'Authorization': `token ${token}`
  };

  try {
    if (!gistId) {
      // Create a private gist
      const res = await fetch('https://api.github.com/gists', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          description: 'Passion Manager App Sync Data',
          public: false,
          files: {
            'passion_manager_sync.json': {
              content: JSON.stringify({ members: [], attendanceRecords: [], updatedAt: new Date().toISOString() })
            }
          }
        })
      });
      if (!res.ok) throw new Error('Failed to create Gist');
      const data = await res.json();
      gistId = data.id;
      localStorage.setItem(GIST_ID_KEY, gistId as string);
      return true;
    } else {
      // Verify existing gist
      const res = await fetch(`https://api.github.com/gists/${gistId}`, { headers });
      if (!res.ok) throw new Error('Failed to fetch Gist');
      return true;
    }
  } catch (error) {
    console.error("Gist init error:", error);
    return false;
  }
};

export const syncToCloud = async (data: SyncData): Promise<boolean> => {
  const token = getGithubToken();
  const gistId = getGistId();
  if (!token || !gistId) return false;

  try {
    const res = await fetch(`https://api.github.com/gists/${gistId}`, {
      method: 'PATCH',
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'Authorization': `token ${token}`
      },
      body: JSON.stringify({
        files: {
          'passion_manager_sync.json': {
            content: JSON.stringify(data)
          }
        }
      })
    });
    return res.ok;
  } catch (error) {
    console.error("Error syncing to gist:", error);
    return false;
  }
};

let lastSyncDate = new Date(0).toISOString();
let timer: any = null;

export const listenToCloud = (onDataUpdate: (data: SyncData) => void): (() => void) => {
  const token = getGithubToken();
  const gistId = getGistId();
  if (!token || !gistId) return () => {};

  const poll = async () => {
    try {
      const res = await fetch(`https://api.github.com/gists/${gistId}?t=${Date.now()}`, {
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'Authorization': `token ${token}`,
          'Cache-Control': 'no-cache'
        }
      });
      if (!res.ok) return;
      const data = await res.json();
      const updated_at = data.updated_at;
      
      // If the gist was updated remotely
      if (updated_at > lastSyncDate) {
        lastSyncDate = updated_at;
        const fileContent = data.files['passion_manager_sync.json']?.content;
        if (fileContent) {
            const parsed = JSON.parse(fileContent) as SyncData;
            onDataUpdate(parsed);
        }
      }
    } catch (error) {
       console.error("Gist polling error:", error);
    }
  };

  timer = setInterval(poll, 8000); // Check every 8 seconds
  poll(); // Initial check

  return () => clearInterval(timer);
};
