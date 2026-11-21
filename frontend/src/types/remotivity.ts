export type InstanceType = 'antigravity' | 'claude' | 'vscode' | 'terminal' | 'jules';

export type InstanceStatus = 'online' | 'busy' | 'offline';

export type ModelProvider =
  | 'antigravity-host'
  | 'google-gemini'
  | 'openai-compatible'
  | 'anthropic-compatible';

export interface AIModelOption {
  id: string;
  label: string;
  provider: ModelProvider;
  description: string;
  badge: string;
}

export interface GoogleAuthConfig {
  apiKey: string;
  oauthAccessToken: string;
  oauthClientId: string;
  userEmail: string;
  userName: string;
  userPicture: string;
  antigravityPortalUrl: string;
  autoOpenPortalOnLaunch: boolean;
  customEndpointUrl: string;
  customApiKey: string;
  customModelName: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  text: string;
  timestamp: string;
  modelLabel?: string;
  isError?: boolean;
}

export interface WorkProjectItem {
  id: string;
  name: string;
  path: string;
  description: string;
  badge: string;
}

export interface RemoteInstance {
  id: string;
  name: string;
  type: InstanceType;
  hostUrl: string;
  webPortalUrl?: string;
  accessToken?: string;
  workspace: string;
  status: InstanceStatus;
  tags: string[];
  isFavorite: boolean;
  lastPingMs?: number;
  lastActive: string;
  sharedBy?: string;
  expiresAt?: number;
  readOnly?: boolean;
  isDemo?: boolean;
  description?: string;
}

export interface TerminalEntry {
  id: string;
  timestamp: string;
  kind: 'command' | 'output' | 'error' | 'prompt' | 'ai-reply' | 'system';
  text: string;
  durationMs?: number;
}

export interface ShareInvitePayload {
  v: number;
  name: string;
  type: InstanceType;
  hostUrl: string;
  webPortalUrl?: string;
  accessToken?: string;
  workspace: string;
  readOnly: boolean;
  expiresAt?: number;
  sharedBy?: string;
}

export interface HostSessionItem {
  id: string;
  type: string;
  lastUpdated: string;
  artifacts: string[];
}

export interface HostWorkspaceItem {
  name: string;
  path: string;
  hasGit: boolean;
  lastModified: string;
}

export interface HostProcessItem {
  ProcessName: string;
  Id: number;
  MainWindowTitle?: string;
  MemoryMB: number;
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

export const APP_CURRENT_VERSION = 'v1.0.2';

export const GITHUB_REPO_OWNER = 'heyhacene';
export const GITHUB_REPO_NAME = 'Remotivity';
export const GITHUB_RELEASES_API = `https://api.github.com/repos/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/releases/latest`;
export const GITHUB_RELEASES_URL = `https://github.com/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/releases`;
export const GITHUB_APK_URL = `https://github.com/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/releases/latest/download/Remotivity.apk`;
export const PWA_PUBLIC_URL = `https://${GITHUB_REPO_OWNER}.github.io/${GITHUB_REPO_NAME}/`;

export const DEFAULT_ANTIGRAVITY_PORTAL_URL = 'https://antigravity.google';

export const DEFAULT_AI_MODELS: AIModelOption[] = [
  {
    id: 'antigravity-host',
    label: 'Antigravity PC (Agent Hôte)',
    provider: 'antigravity-host',
    description: 'Envoie directement vos instructions à votre instance Antigravity du PC du boulot.',
    badge: 'PC Hôte',
  },
  {
    id: 'gemini-2.5-pro',
    label: 'Google Gemini 2.5 Pro',
    provider: 'google-gemini',
    description: 'Modèle de raisonnement avancé via l’API Google.',
    badge: 'API Google',
  },
  {
    id: 'gemini-2.5-flash',
    label: 'Google Gemini 2.5 Flash',
    provider: 'google-gemini',
    description: 'Réponses ultra-rapides sur mobile via l’API Google.',
    badge: 'API Google',
  },
  {
    id: 'custom-other-model',
    label: 'Modèle Externe (Claude / OpenAI / Custom)',
    provider: 'openai-compatible',
    description: 'Adaptateur universel pour connecter un autre fournisseur IA.',
    badge: 'Multi-Modèle',
  },
];

export const WORK_PROJECTS: WorkProjectItem[] = [
  {
    id: 'proj-remotivity',
    name: 'Remotivity',
    path: 'C:\\Users\\HO791592\\Remotivity',
    description: 'Cockpit mobile Antigravity Remote & Agent Hôte PC',
    badge: 'Actif',
  },
  {
    id: 'proj-lavenirencommun',
    name: 'lavenirencommun',
    path: 'C:\\Users\\HO791592\\.gemini\\antigravity\\scratch\\lavenirencommun',
    description: 'Programme 2027 • APK Capacitor & PWA',
    badge: 'App',
  },
  {
    id: 'proj-keotv',
    name: 'keotv',
    path: 'C:\\Users\\HO791592\\.gemini\\antigravity\\scratch\\keotv',
    description: 'Client Android TV natif & synchronisation cloud',
    badge: 'TV',
  },
  {
    id: 'proj-technicajob',
    name: 'Technicajob',
    path: 'C:\\Users\\HO791592\\.gemini\\antigravity\\scratch\\Technicajob',
    description: 'Veille offres & notifications Capacitor',
    badge: 'Veille',
  },
  {
    id: 'proj-bookshelf',
    name: 'Bookshelf',
    path: 'C:\\Users\\HO791592\\.gemini\\antigravity\\scratch\\Bookshelf',
    description: 'Édition & générateur de contenus',
    badge: 'Projet',
  },
];

export const INSTANCE_TYPE_META: Record<
  InstanceType,
  { label: string; shortLabel: string; badgeClass: string; iconEmoji: string; defaultPort: string }
> = {
  antigravity: {
    label: 'Antigravity Remote',
    shortLabel: 'Antigravity',
    badgeClass: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/35',
    iconEmoji: '🛰️',
    defaultPort: '7890',
  },
  claude: {
    label: 'Claude Code CLI',
    shortLabel: 'Claude',
    badgeClass: 'bg-amber-500/15 text-amber-300 border-amber-500/35',
    iconEmoji: '✨',
    defaultPort: '7890',
  },
  jules: {
    label: 'Google Jules',
    shortLabel: 'Jules',
    badgeClass: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/35',
    iconEmoji: '🤖',
    defaultPort: '443',
  },
  vscode: {
    label: 'VS Code Tunnel',
    shortLabel: 'VS Code',
    badgeClass: 'bg-sky-500/15 text-sky-300 border-sky-500/35',
    iconEmoji: '💻',
    defaultPort: '8080',
  },
  terminal: {
    label: 'Terminal Distant',
    shortLabel: 'Terminal',
    badgeClass: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/35',
    iconEmoji: '⚡',
    defaultPort: '7890',
  },
};

export const DEFAULT_INSTANCES: RemoteInstance[] = [
  {
    id: 'inst-antigravity-remote',
    name: 'Antigravity Remote • PC du Boulot',
    type: 'antigravity',
    hostUrl: 'http://localhost:7890',
    webPortalUrl: 'https://antigravity.google',
    workspace: 'C:\\Users\\HO791592\\Remotivity',
    status: 'online',
    tags: ['Antigravity', 'Google Auth', 'Principal'],
    isFavorite: true,
    lastPingMs: 14,
    lastActive: 'Session active',
    isDemo: false,
    description: 'Portail Antigravity Remote officiel (connexion Google intégrée) + pont Agent Hôte PC.',
  },
  {
    id: 'inst-jules-cloud',
    name: 'Google Jules • Tâches GitHub',
    type: 'jules',
    hostUrl: 'https://jules.google.com',
    webPortalUrl: 'https://jules.google.com',
    workspace: 'github.com/heyhacene/*',
    status: 'online',
    tags: ['Google', 'Cloud', 'Async'],
    isFavorite: false,
    lastPingMs: 42,
    lastActive: 'En ligne',
    isDemo: true,
    description: 'Agent asynchrone Google connecté à vos dépôts GitHub.',
  },
  {
    id: 'inst-claude-code',
    name: 'Claude Code • Adaptateur CLI',
    type: 'claude',
    hostUrl: 'http://localhost:7890',
    workspace: '~/.gemini/antigravity/scratch',
    status: 'busy',
    tags: ['Multi-modèle', 'CLI'],
    isFavorite: false,
    lastPingMs: 22,
    lastActive: 'Prêt',
    isDemo: true,
    description: 'Passerelle optionnelle pour piloter d’autres modèles ou sessions Claude Code.',
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

/**
 * Semantic comparison of tags like "v1.0.10" vs "v1.0.2".
 * Returns > 0 if remoteTag is newer than currentTag.
 */
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

/**
 * UTF-8 safe Base64URL encoding for sharing an instance invitation.
 */
export function encodeInstanceInvite(
  instance: RemoteInstance,
  options: { readOnly: boolean; durationHours: number | null; sharedBy?: string }
): string {
  const expiresAt =
    options.durationHours && options.durationHours > 0
      ? Date.now() + options.durationHours * 3600 * 1000
      : undefined;

  const payload: ShareInvitePayload = {
    v: 1,
    name: instance.name,
    type: instance.type,
    hostUrl: instance.hostUrl,
    webPortalUrl: instance.webPortalUrl,
    accessToken: options.readOnly ? undefined : instance.accessToken,
    workspace: instance.workspace,
    readOnly: options.readOnly,
    expiresAt,
    sharedBy: options.sharedBy || 'heyhacene',
  };

  const json = JSON.stringify(payload);
  const bytes = new TextEncoder().encode(json);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Decodes either a full URL containing ?invite=... or a raw Base64URL invite string.
 */
export function decodeInstanceInvite(rawInput: string): {
  payload: ShareInvitePayload | null;
  error?: string;
} {
  try {
    let token = rawInput.trim();
    if (!token) return { payload: null, error: 'Code d’invitation vide.' };

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
    const parsed = JSON.parse(json) as ShareInvitePayload;

    if (!parsed || !parsed.name || !parsed.hostUrl) {
      return { payload: null, error: 'Format d’invitation invalide.' };
    }

    if (parsed.expiresAt && Date.now() > parsed.expiresAt) {
      return { payload: null, error: 'Ce lien d’invitation a expiré.' };
    }

    return { payload: parsed };
  } catch {
    return { payload: null, error: 'Impossible de décoder le lien ou code d’invitation.' };
  }
}
