export interface RemoteSession {
  id: string;
  name: string;
  url: string;
  icon: string;
  subtitle?: string;
  isPrimary?: boolean;
  sharedBy?: string;
}

export interface ShareSessionPayload {
  v: number;
  name: string;
  url: string;
  icon: string;
  sharedBy?: string;
}

export interface RemotivityNativeBridge {
  isNativePortalSupported: () => boolean;
  openPortal: (url: string, title?: string) => void;
  hidePortal: () => void;
  getCurrentPortalUrl: () => string;
}

declare global {
  interface Window {
    RemotivityNative?: RemotivityNativeBridge;
  }
}

export const APP_CURRENT_VERSION = 'v1.0.3';

export const GITHUB_REPO_OWNER = 'heyhacene';
export const GITHUB_REPO_NAME = 'Remotivity';
export const GITHUB_RELEASES_API = `https://api.github.com/repos/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/releases/latest`;
export const GITHUB_RELEASES_URL = `https://github.com/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/releases`;
export const GITHUB_APK_URL = `https://github.com/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/releases/latest/download/Remotivity.apk`;
export const PWA_PUBLIC_URL = `https://${GITHUB_REPO_OWNER}.github.io/${GITHUB_REPO_NAME}/`;

export const DEFAULT_ANTIGRAVITY_URL = 'https://antigravity.google';

export const DEFAULT_SESSIONS: RemoteSession[] = [
  {
    id: 'antigravity-main',
    name: 'Antigravity Remote',
    url: 'https://antigravity.google',
    icon: '🛰️',
    subtitle: 'Mon PC • Connexion Google',
    isPrimary: true,
  },
  {
    id: 'jules-cloud',
    name: 'Google Jules',
    url: 'https://jules.google.com',
    icon: '🤖',
    subtitle: 'Sessions GitHub Google',
  },
  {
    id: 'claude-web',
    name: 'Claude',
    url: 'https://claude.ai',
    icon: '✨',
    subtitle: 'Modèle alternatif',
  },
];

export function isNativePortalSupported(): boolean {
  return Boolean(
    typeof window !== 'undefined' &&
      window.RemotivityNative &&
      window.RemotivityNative.isNativePortalSupported()
  );
}

export function openRemotePortal(url: string, title = 'Antigravity Remote'): boolean {
  if (typeof window === 'undefined') return false;
  if (window.RemotivityNative && window.RemotivityNative.isNativePortalSupported()) {
    window.RemotivityNative.openPortal(url, title);
    return true;
  }
  window.open(url, '_blank', 'noopener,noreferrer');
  return false;
}

export function getCurrentNativePortalUrl(): string | null {
  if (
    typeof window !== 'undefined' &&
    window.RemotivityNative &&
    typeof window.RemotivityNative.getCurrentPortalUrl === 'function'
  ) {
    const val = window.RemotivityNative.getCurrentPortalUrl();
    return val && val.trim() ? val.trim() : null;
  }
  return null;
}

export function compareVersions(remoteTag: string, currentTag: string): number {
  const parse = (v: string) =>
    v
      .replace(/^v/i, '')
      .split('.')
      .map((n) => parseInt(n.replace(/\D.*$/, ''), 10) || 0);

  const a = parse(remoteTag);
  const b = parse(currentTag);
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const numA = a[i] || 0;
    const numB = b[i] || 0;
    if (numA !== numB) return numA - numB;
  }
  return 0;
}

export function encodeSessionInvite(session: RemoteSession, sharedBy = 'heyhacene'): string {
  const payload: ShareSessionPayload = {
    v: 1,
    name: session.name,
    url: session.url,
    icon: session.icon,
    sharedBy,
  };
  const json = JSON.stringify(payload);
  const bytes = new TextEncoder().encode(json);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function decodeSessionInvite(rawInput: string): {
  payload: ShareSessionPayload | null;
  error?: string;
} {
  try {
    let token = rawInput.trim();
    if (!token) return { payload: null, error: 'Lien ou code vide.' };

    if (token.includes('invite=')) {
      try {
        const url = new URL(token);
        const param = url.searchParams.get('invite');
        if (param) token = param;
      } catch {
        const match = token.match(/[?&]invite=([^&]+)/);
        if (match && match[1]) token = decodeURIComponent(match[1]);
      }
    }

    let b64 = token.replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4 !== 0) {
      b64 += '=';
    }

    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const json = new TextDecoder().decode(bytes);
    const parsed = JSON.parse(json) as ShareSessionPayload;

    if (!parsed || !parsed.name || !parsed.url) {
      return { payload: null, error: 'Invitation invalide.' };
    }

    return { payload: parsed };
  } catch {
    return { payload: null, error: 'Impossible de lire ce code ou lien.' };
  }
}
