import {
  AIModelOption,
  ChatMessage,
  DEFAULT_ANTIGRAVITY_PORTAL_URL,
  GoogleAuthConfig,
  RemoteInstance,
} from '../types/remotivity';

const STORAGE_KEY_GOOGLE_AUTH = 'remotivity_google_auth_v1';

export const DEFAULT_GOOGLE_AUTH: GoogleAuthConfig = {
  apiKey: '',
  oauthAccessToken: '',
  oauthClientId: '',
  userEmail: '',
  userName: '',
  userPicture: '',
  antigravityPortalUrl: DEFAULT_ANTIGRAVITY_PORTAL_URL,
  autoOpenPortalOnLaunch: false,
  customEndpointUrl: '',
  customApiKey: '',
  customModelName: 'claude-sonnet-4-5',
};

export function loadGoogleAuthConfig(): GoogleAuthConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_GOOGLE_AUTH);
    if (raw) {
      return { ...DEFAULT_GOOGLE_AUTH, ...JSON.parse(raw) };
    }
  } catch {
    // Ignore parse errors
  }
  return DEFAULT_GOOGLE_AUTH;
}

export function saveGoogleAuthConfig(cfg: GoogleAuthConfig): void {
  try {
    localStorage.setItem(STORAGE_KEY_GOOGLE_AUTH, JSON.stringify(cfg));
  } catch {
    // Ignore storage errors
  }
}

export function clearGoogleAuthConfig(): GoogleAuthConfig {
  const reset = {
    ...DEFAULT_GOOGLE_AUTH,
    antigravityPortalUrl: loadGoogleAuthConfig().antigravityPortalUrl,
  };
  saveGoogleAuthConfig(reset);
  return reset;
}

export function buildGoogleOAuthImplicitUrl(clientId: string, redirectUri: string): string {
  const params = new URLSearchParams({
    client_id: clientId.trim(),
    redirect_uri: redirectUri,
    response_type: 'token',
    scope: [
      'openid',
      'email',
      'profile',
      'https://www.googleapis.com/auth/generative-language.retriever',
    ].join(' '),
    include_granted_scopes: 'true',
    prompt: 'consent',
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export function parseGoogleOAuthHash(): { accessToken: string | null; error?: string } {
  if (typeof window === 'undefined' || !window.location.hash) {
    return { accessToken: null };
  }
  const hash = window.location.hash.replace(/^#/, '');
  const params = new URLSearchParams(hash);
  const error = params.get('error');
  if (error) {
    return { accessToken: null, error };
  }
  const token = params.get('access_token');
  return { accessToken: token || null };
}

export async function fetchGoogleUserInfo(accessToken: string): Promise<{
  email: string;
  name: string;
  picture: string;
} | null> {
  if (!accessToken.trim()) return null;
  try {
    const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${accessToken.trim()}` },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return {
      email: data.email || '',
      name: data.name || data.email || 'Compte Google',
      picture: data.picture || '',
    };
  } catch {
    return null;
  }
}

export async function fetchAvailableGoogleModels(
  config: GoogleAuthConfig
): Promise<{ models: AIModelOption[]; error?: string }> {
  const apiKey = config.apiKey.trim();
  const token = config.oauthAccessToken.trim();

  if (!apiKey && !token) {
    return { models: [], error: 'Aucune clé API Google ni jeton OAuth configuré.' };
  }

  try {
    const url = apiKey
      ? `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`
      : 'https://generativelanguage.googleapis.com/v1beta/models';

    const headers: Record<string, string> = {};
    if (!apiKey && token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(url, { headers });
    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson?.error?.message || `HTTP ${res.status}`);
    }

    const data = await res.json();
    const rawList: any[] = Array.isArray(data.models) ? data.models : [];

    const geminiModels: AIModelOption[] = rawList
      .filter(
        (m) =>
          Array.isArray(m.supportedGenerationMethods) &&
          m.supportedGenerationMethods.includes('generateContent')
      )
      .map((m) => {
        const cleanId = String(m.name || '').replace(/^models\//, '');
        return {
          id: cleanId,
          label: m.displayName || cleanId,
          provider: 'google-gemini' as const,
          description: m.description || 'Modèle Google Gemini via API officielle',
          badge: 'API Google',
        };
      })
      .slice(0, 12);

    return { models: geminiModels };
  } catch (e: any) {
    return {
      models: [],
      error: e?.message || 'Impossible de récupérer la liste des modèles Google.',
    };
  }
}

export async function sendModelChatMessage(params: {
  model: AIModelOption;
  messages: ChatMessage[];
  userText: string;
  googleAuth: GoogleAuthConfig;
  hostInstance?: RemoteInstance;
}): Promise<{ reply: string; error?: boolean }> {
  const { model, messages, userText, googleAuth, hostInstance } = params;

  // 1. Antigravity PC Host Agent
  if (model.provider === 'antigravity-host') {
    if (!hostInstance) {
      return {
        reply: "Aucune instance Antigravity PC configurée. Ajoutez votre hôte dans l'onglet Instances ou connectez l'API Google.",
        error: true,
      };
    }

    const cleanUrl = hostInstance.hostUrl.replace(/\/+$/, '');
    try {
      const res = await fetch(`${cleanUrl}/api/prompt`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(hostInstance.accessToken
            ? {
                Authorization: `Bearer ${hostInstance.accessToken}`,
                'X-Remotivity-Token': hostInstance.accessToken,
              }
            : {}),
        },
        body: JSON.stringify({
          prompt: userText,
          agent: 'antigravity',
          cwd: hostInstance.workspace,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      return {
        reply: data.reply || 'Instruction transmise à votre PC Antigravity.',
      };
    } catch (e: any) {
      return {
        reply:
          `Agent PC local non joignable (${e?.message || 'hors ligne'}).\n\n` +
          `• Pour piloter votre session Antigravity directement comme dans Firefox, touchez « Ouvrir Antigravity Remote ».\n` +
          `• Pour discuter directement via l'API Google, sélectionnez un modèle Google Gemini ci-dessus.`,
        error: true,
      };
    }
  }

  // 2. Google Gemini API (generativelanguage.googleapis.com)
  if (model.provider === 'google-gemini') {
    const apiKey = googleAuth.apiKey.trim();
    const token = googleAuth.oauthAccessToken.trim();

    if (!apiKey && !token) {
      return {
        reply:
          "Connexion API Google requise : touchez le bouton « Connexion Google » en haut pour renseigner votre clé API Google ou jeton OAuth Google.",
        error: true,
      };
    }

    const endpoint = apiKey
      ? `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model.id)}:generateContent?key=${encodeURIComponent(apiKey)}`
      : `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model.id)}:generateContent`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (!apiKey && token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const historyContents = messages
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .slice(-14)
      .map((m) => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.text }],
      }));

    historyContents.push({
      role: 'user',
      parts: [{ text: userText }],
    });

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          systemInstruction: {
            parts: [
              {
                text:
                  "Tu es l'assistant mobile Remotivity d'Antigravity. Réponds en français de façon claire, structurée et adaptée à un écran de smartphone.",
              },
            ],
          },
          contents: historyContents,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error?.message || `Erreur API Google (${res.status})`);
      }

      const textParts: string[] =
        data?.candidates?.[0]?.content?.parts
          ?.map((p: any) => p.text)
          .filter(Boolean) || [];

      if (textParts.length === 0) {
        return {
          reply: "Le modèle Google n'a renvoyé aucun texte (vérifiez les filtres ou la requête).",
          error: true,
        };
      }

      return { reply: textParts.join('\n') };
    } catch (e: any) {
      return {
        reply: `Erreur API Google : ${e?.message || 'Requête échouée'}`,
        error: true,
      };
    }
  }

  // 3. Adaptateur universel (Autres modèles : OpenAI / OpenRouter / Claude Proxy / Ollama)
  const customUrl = googleAuth.customEndpointUrl.trim();
  const customKey = googleAuth.customApiKey.trim();
  const customModel = googleAuth.customModelName.trim() || 'gpt-4o-mini';

  if (!customUrl) {
    return {
      reply:
        "Configurez d'abord l'endpoint d'un modèle externe dans Réglages / Connexion Google (onglet Autres modèles) ou sélectionnez un modèle Google.",
      error: true,
    };
  }

  try {
    const res = await fetch(customUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(customKey ? { Authorization: `Bearer ${customKey}` } : {}),
      },
      body: JSON.stringify({
        model: customModel,
        messages: [
          ...messages
            .filter((m) => m.role === 'user' || m.role === 'assistant')
            .slice(-12)
            .map((m) => ({ role: m.role, content: m.text })),
          { role: 'user', content: userText },
        ],
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.error?.message || `HTTP ${res.status}`);
    }

    const content =
      data?.choices?.[0]?.message?.content ||
      data?.content?.[0]?.text ||
      JSON.stringify(data);

    return { reply: String(content) };
  } catch (e: any) {
    return {
      reply: `Erreur adaptateur multi-modèle : ${e?.message || 'Échec réseau'}`,
      error: true,
    };
  }
}
