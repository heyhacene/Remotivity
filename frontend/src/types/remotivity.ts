export type InstanceType = 'antigravity' | 'claude' | 'vscode' | 'terminal' | 'jules';

export type InstanceStatus = 'online' | 'busy' | 'offline';

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

export const APP_CURRENT_VERSION = 'v1.0.1';

export const GITHUB_REPO_OWNER = 'heyhacene';
export const GITHUB_REPO_NAME = 'Remotivity';
export const GITHUB_RELEASES_API = `https://api.github.com/repos/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/releases/latest`;
export const GITHUB_RELEASES_URL = `https://github.com/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/releases`;
export const GITHUB_APK_URL = `https://github.com/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/releases/latest/download/Remotivity.apk`;
export const PWA_PUBLIC_URL = `https://${GITHUB_REPO_OWNER}.github.io/${GITHUB_REPO_NAME}/`;

export const INSTANCE_TYPE_META: Record<
  InstanceType,
  { label: string; shortLabel: string; badgeClass: string; iconEmoji: string; defaultPort: string }
> = {
  antigravity: {
    label: 'Antigravity IDE',
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
    id: 'inst-antigravity-pc',
    name: 'PC Principal • Antigravity IDE',
    type: 'antigravity',
    hostUrl: 'http://localhost:7890',
    workspace: 'C:\\Users\\HO791592\\Remotivity',
    status: 'online',
    tags: ['Agent Hôte', 'Windows', 'Workspaces'],
    isFavorite: true,
    lastPingMs: 14,
    lastActive: 'À l’instant',
    isDemo: false,
    description: 'Connexion directe à votre Agent Hôte PowerShell (sessions Antigravity, fichiers et shell distant).',
  },
  {
    id: 'inst-claude-code',
    name: 'Claude Code • Sessions CLI',
    type: 'claude',
    hostUrl: 'http://localhost:7890',
    workspace: '~/.gemini/antigravity/scratch',
    status: 'busy',
    tags: ['Claude CLI', 'Coding Agent'],
    isFavorite: true,
    lastPingMs: 22,
    lastActive: 'Il y a 2 min',
    isDemo: true,
    description: 'Pilotage de tâches Claude Code sur vos dépôts locaux ou serveur distant via tunnel.',
  },
  {
    id: 'inst-jules-cloud',
    name: 'Google Jules • Agent Asynchrone',
    type: 'jules',
    hostUrl: 'https://jules.google.com',
    webPortalUrl: 'https://jules.google.com',
    workspace: 'github.com/heyhacene/*',
    status: 'online',
    tags: ['Cloud', 'PR Auto', 'Async'],
    isFavorite: false,
    lastPingMs: 48,
    lastActive: 'En ligne',
    isDemo: true,
    description: 'Accès rapide à vos sessions asynchrones Jules connectées à vos dépôts GitHub.',
  },
  {
    id: 'inst-vscode-tunnel',
    name: 'VS Code Server • Tunnel Sécurisé',
    type: 'vscode',
    hostUrl: 'https://vscode.dev',
    webPortalUrl: 'https://vscode.dev',
    workspace: '/home/dev/workspace',
    status: 'online',
    tags: ['Web IDE', 'Tailscale'],
    isFavorite: false,
    lastPingMs: 36,
    lastActive: 'En ligne',
    isDemo: true,
    description: 'Éditeur VS Code complet accessible depuis mobile ou tablette via Cloudflare / VS Code Tunnel.',
  },
];

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
