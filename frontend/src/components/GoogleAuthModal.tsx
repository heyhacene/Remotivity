import { useState, useEffect } from 'react';
import {
  AIModelOption,
  DEFAULT_ANTIGRAVITY_PORTAL_URL,
  GoogleAuthConfig,
  getCurrentNativePortalUrl,
  isNativePortalSupported,
  openRemotePortal,
} from '../types/remotivity';
import {
  buildGoogleOAuthImplicitUrl,
  fetchAvailableGoogleModels,
  fetchGoogleUserInfo,
} from '../services/googleApi';
import {
  IconArrowLeft,
  IconCheck,
  IconClose,
  IconExternalLink,
  IconGlobe,
  IconGoogle,
  IconKey,
  IconRefresh,
  IconShield,
} from './Icons';

interface GoogleAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: GoogleAuthConfig;
  onSaveConfig: (next: GoogleAuthConfig) => void;
  onModelsDiscovered: (models: AIModelOption[]) => void;
}

export const GoogleAuthModal = ({
  isOpen,
  onClose,
  config,
  onSaveConfig,
  onModelsDiscovered,
}: GoogleAuthModalProps) => {
  const [draft, setDraft] = useState<GoogleAuthConfig>(config);
  const [tab, setTab] = useState<'portal' | 'google-api' | 'other-models'>('portal');
  const [testing, setTesting] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (isOpen) {
      setDraft(config);
      setStatusMsg(null);
    }
  }, [isOpen, config]);

  if (!isOpen) return null;

  const isGoogleConnected = Boolean(draft.userEmail || draft.apiKey.trim() || draft.oauthAccessToken.trim());

  const handleSave = () => {
    const clean: GoogleAuthConfig = {
      ...draft,
      antigravityPortalUrl: draft.antigravityPortalUrl.trim() || DEFAULT_ANTIGRAVITY_PORTAL_URL,
    };
    onSaveConfig(clean);
    setStatusMsg({ ok: true, text: 'Configuration Google & Antigravity enregistrée.' });
  };

  const handleTestGoogleApi = async () => {
    setTesting(true);
    setStatusMsg(null);
    try {
      let nextDraft = { ...draft };
      if (nextDraft.oauthAccessToken.trim()) {
        const user = await fetchGoogleUserInfo(nextDraft.oauthAccessToken);
        if (user) {
          nextDraft = {
            ...nextDraft,
            userEmail: user.email,
            userName: user.name,
            userPicture: user.picture,
          };
          setDraft(nextDraft);
        }
      }

      const res = await fetchAvailableGoogleModels(nextDraft);
      if (res.error && res.models.length === 0) {
        setStatusMsg({ ok: false, text: res.error });
      } else {
        onSaveConfig(nextDraft);
        onModelsDiscovered(res.models);
        setStatusMsg({
          ok: true,
          text: `Connexion API Google réussie ! ${res.models.length} modèle(s) Gemini détecté(s) sur votre compte.`,
        });
      }
    } finally {
      setTesting(false);
    }
  };

  const handleStartGoogleOAuth = () => {
    if (!draft.oauthClientId.trim()) {
      setStatusMsg({
        ok: false,
        text: "Saisissez un Client ID OAuth Google Web, ou connectez-vous directement dans le Portail Antigravity (qui mémorise votre session Google nativement).",
      });
      return;
    }
    const redirectUri = window.location.origin + window.location.pathname;
    const authUrl = buildGoogleOAuthImplicitUrl(draft.oauthClientId, redirectUri);
    window.location.href = authUrl;
  };

  const handleSyncActivePortalUrl = () => {
    const nativeUrl = getCurrentNativePortalUrl();
    if (nativeUrl) {
      setDraft((prev) => ({ ...prev, antigravityPortalUrl: nativeUrl }));
      setStatusMsg({ ok: true, text: `URL capturée depuis le portail : ${nativeUrl}` });
    } else {
      setStatusMsg({
        ok: false,
        text: "Ouvrez d'abord le portail Antigravity dans l'APK Android pour capturer automatiquement l'URL de session.",
      });
    }
  };

  const handlePastePortalUrl = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text && text.trim().startsWith('http')) {
        setDraft((prev) => ({ ...prev, antigravityPortalUrl: text.trim() }));
        setStatusMsg({ ok: true, text: 'URL collée depuis le presse-papiers !' });
      } else {
        setStatusMsg({ ok: false, text: 'Le presse-papiers ne contient pas une URL http/https valide.' });
      }
    } catch {
      setStatusMsg({ ok: false, text: 'Collez manuellement votre URL Firefox dans le champ ci-dessous.' });
    }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/85 backdrop-blur-md text-white">
      <div className="fixed inset-0" onClick={onClose} />

      <div className="relative w-full max-w-lg max-h-[93vh] sm:max-h-[88vh] bg-[#0a0f1e] border border-cyan-500/40 rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col z-10">
        {/* Header */}
        <div className="sticky top-0 z-20 px-5 py-4 border-b border-cyan-500/20 flex items-center justify-between bg-gradient-to-r from-[#0e172a] via-[#0a1122] to-[#060913]">
          <div className="flex items-center gap-2.5">
            <button
              onClick={onClose}
              className="px-2.5 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-cyan-200 hover:text-white flex items-center gap-1.5 text-xs font-bold transition"
            >
              <IconArrowLeft size={16} />
              <span>Retour</span>
            </button>
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-white text-slate-950 shadow">
                <IconGoogle size={18} />
              </div>
              <div>
                <h2 className="text-base font-black text-white leading-tight">
                  Compte Google & Antigravity
                </h2>
                <p className="text-[11px] text-slate-400 font-semibold">
                  Portail Remote, API Google & Multi-Modèles
                </p>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white"
          >
            <IconClose size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="px-5 pt-3.5 pb-1 grid grid-cols-3 gap-1.5 bg-[#0a0f1e]">
          <button
            type="button"
            onClick={() => setTab('portal')}
            className={`py-2 px-2 rounded-xl text-[11px] font-extrabold transition ${
              tab === 'portal'
                ? 'bg-gradient-to-r from-cyan-500 to-indigo-600 text-white shadow'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            🛰️ Portail Remote
          </button>
          <button
            type="button"
            onClick={() => setTab('google-api')}
            className={`py-2 px-2 rounded-xl text-[11px] font-extrabold transition ${
              tab === 'google-api'
                ? 'bg-gradient-to-r from-cyan-500 to-indigo-600 text-white shadow'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            🔑 API Google
          </button>
          <button
            type="button"
            onClick={() => setTab('other-models')}
            className={`py-2 px-2 rounded-xl text-[11px] font-extrabold transition ${
              tab === 'other-models'
                ? 'bg-gradient-to-r from-cyan-500 to-indigo-600 text-white shadow'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            🤖 Autres Modèles
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="overflow-y-auto px-5 py-4 space-y-4 flex-1 text-xs">
          {/* Account status summary */}
          <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              {draft.userPicture ? (
                <img src={draft.userPicture} alt="" className="w-9 h-9 rounded-full border border-cyan-400" />
              ) : (
                <div className="w-9 h-9 rounded-full bg-white flex items-center justify-center flex-shrink-0">
                  <IconGoogle size={18} />
                </div>
              )}
              <div className="min-w-0">
                <div className="font-black text-white truncate">
                  {draft.userName || (isGoogleConnected ? 'API Google configurée' : 'Session Google prête')}
                </div>
                <div className="text-[11px] text-slate-400 truncate">
                  {draft.userEmail || (draft.apiKey ? 'Clé API Google active' : 'Connectez-vous via le portail ou une clé API')}
                </div>
              </div>
            </div>
            <span
              className={`px-2.5 py-1 rounded-full text-[10px] font-black flex-shrink-0 ${
                isGoogleConnected
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/35'
                  : 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30'
              }`}
            >
              {isGoogleConnected ? 'Connecté' : 'Portail natif'}
            </span>
          </div>

          {tab === 'portal' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-cyan-950/25 border border-cyan-500/30 space-y-2">
                <div className="font-extrabold text-cyan-300 flex items-center gap-1.5">
                  <IconGlobe size={15} />
                  <span>Remplacer Firefox par Remotivity (Connexion Google native)</span>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  L’application intègre un portail Android plein écran avec cookies Google persistants (sans erreur <span className="font-mono">disallowed_useragent</span>). Connectez-vous une fois à votre compte Google et retrouvez directement votre session Antigravity du PC du boulot.
                </p>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    URL de votre session Antigravity Remote
                  </label>
                  <button
                    type="button"
                    onClick={handlePastePortalUrl}
                    className="text-[11px] font-bold text-cyan-300 hover:text-white"
                  >
                    📋 Coller depuis Firefox
                  </button>
                </div>
                <input
                  type="text"
                  value={draft.antigravityPortalUrl}
                  onChange={(e) => setDraft({ ...draft, antigravityPortalUrl: e.target.value })}
                  placeholder="https://antigravity.google"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-xs font-mono text-white focus:outline-none focus:border-cyan-400"
                />

                {/* Presets */}
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {[
                    { label: 'antigravity.google', url: 'https://antigravity.google' },
                    { label: 'jules.google.com', url: 'https://jules.google.com' },
                    { label: 'idx.google.com', url: 'https://idx.google.com' },
                  ].map((p) => (
                    <button
                      key={p.url}
                      type="button"
                      onClick={() => setDraft({ ...draft, antigravityPortalUrl: p.url })}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[10px] font-mono text-cyan-300 border border-slate-700"
                    >
                      {p.label}
                    </button>
                  ))}
                  {isNativePortalSupported() && (
                    <button
                      type="button"
                      onClick={handleSyncActivePortalUrl}
                      className="px-2.5 py-1 rounded-lg bg-indigo-600/30 hover:bg-indigo-600/50 text-[10px] font-bold text-indigo-200 border border-indigo-500/35"
                    >
                      Capturer l’URL ouverte
                    </button>
                  )}
                </div>
              </div>

              <label className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between gap-3 cursor-pointer">
                <div>
                  <div className="font-bold text-white">Ouvrir Antigravity Remote au démarrage</div>
                  <div className="text-[11px] text-slate-400">
                    Lance directement votre session en plein écran dès l’ouverture de l’APK
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={draft.autoOpenPortalOnLaunch}
                  onChange={(e) => setDraft({ ...draft, autoOpenPortalOnLaunch: e.target.checked })}
                  className="w-5 h-5 accent-cyan-500"
                />
              </label>

              <button
                type="button"
                onClick={() => {
                  handleSave();
                  openRemotePortal(
                    draft.antigravityPortalUrl.trim() || DEFAULT_ANTIGRAVITY_PORTAL_URL,
                    'Antigravity Remote'
                  );
                }}
                className="w-full py-3.5 px-4 rounded-2xl bg-white hover:bg-slate-100 text-slate-950 font-black text-xs flex items-center justify-center gap-2 shadow-xl active:scale-98 transition"
              >
                <IconGoogle size={18} />
                <span>Ouvrir le Portail & Se connecter avec Google</span>
                <IconExternalLink size={15} />
              </button>
            </div>
          )}

          {tab === 'google-api' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-indigo-500/30 text-[11px] text-slate-300 space-y-1.5">
                <div className="font-extrabold text-indigo-300">
                  API Google Gemini / Generative Language
                </div>
                <p>
                  Connectez votre clé API Google (Google AI Studio / Cloud) ou un jeton OAuth2 Google pour discuter en natif dans l’app et découvrir automatiquement vos modèles disponibles.
                </p>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1 flex items-center gap-1">
                  <IconKey size={12} />
                  <span>Clé API Google (AIza...)</span>
                </label>
                <input
                  type="password"
                  value={draft.apiKey}
                  onChange={(e) => setDraft({ ...draft, apiKey: e.target.value })}
                  placeholder="AIzaSy..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-xs font-mono text-white focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Jeton OAuth2 Google (optionnel, Bearer ya29...)
                </label>
                <input
                  type="password"
                  value={draft.oauthAccessToken}
                  onChange={(e) => setDraft({ ...draft, oauthAccessToken: e.target.value })}
                  placeholder="ya29.a0..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-xs font-mono text-white focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Google OAuth Client ID (optionnel pour bouton Sign-In Web)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={draft.oauthClientId}
                    onChange={(e) => setDraft({ ...draft, oauthClientId: e.target.value })}
                    placeholder="123456789-xxx.apps.googleusercontent.com"
                    className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-cyan-400"
                  />
                  <button
                    type="button"
                    onClick={handleStartGoogleOAuth}
                    className="px-3 py-2 rounded-xl bg-white text-slate-950 font-black text-xs flex items-center gap-1.5 flex-shrink-0"
                  >
                    <IconGoogle size={14} />
                    <span>OAuth</span>
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={handleTestGoogleApi}
                disabled={testing}
                className="w-full py-3 rounded-2xl bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-black text-xs flex items-center justify-center gap-2 shadow-lg"
              >
                <IconRefresh size={15} className={testing ? 'animate-spin' : ''} />
                <span>{testing ? 'Vérification...' : 'Tester l’API Google & Charger les modèles'}</span>
              </button>
            </div>
          )}

          {tab === 'other-models' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-amber-500/30 text-[11px] text-slate-300 space-y-1">
                <div className="font-extrabold text-amber-300">
                  Adaptateur Multi-Modèles (Claude, OpenAI, OpenRouter, Ollama...)
                </div>
                <p>
                  Antigravity reste la priorité, mais vous pouvez brancher ici n’importe quel autre modèle compatible pour l’utiliser dans le Chat mobile Remotivity.
                </p>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Endpoint API (/v1/chat/completions)
                </label>
                <input
                  type="text"
                  value={draft.customEndpointUrl}
                  onChange={(e) => setDraft({ ...draft, customEndpointUrl: e.target.value })}
                  placeholder="https://openrouter.ai/api/v1/chat/completions"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-xs font-mono text-white focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Nom du modèle cible
                </label>
                <input
                  type="text"
                  value={draft.customModelName}
                  onChange={(e) => setDraft({ ...draft, customModelName: e.target.value })}
                  placeholder="claude-sonnet-4-5 / gpt-4o / llama3"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-xs font-mono text-white focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Clé API du fournisseur externe
                </label>
                <input
                  type="password"
                  value={draft.customApiKey}
                  onChange={(e) => setDraft({ ...draft, customApiKey: e.target.value })}
                  placeholder="sk-..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-xs font-mono text-white focus:outline-none focus:border-cyan-400"
                />
              </div>
            </div>
          )}

          {statusMsg && (
            <div
              className={`p-3 rounded-2xl border text-xs font-semibold flex items-start gap-2 ${
                statusMsg.ok
                  ? 'bg-emerald-500/15 border-emerald-500/35 text-emerald-300'
                  : 'bg-rose-500/15 border-rose-500/35 text-rose-200'
              }`}
            >
              <IconShield size={15} className="flex-shrink-0 mt-0.5" />
              <span>{statusMsg.text}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-[#0d1426] border-t border-cyan-500/20 px-5 py-3.5 flex items-center justify-between pb-[max(1rem,env(safe-area-inset-bottom,16px))]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold"
          >
            Fermer
          </button>
          <button
            type="button"
            onClick={() => {
              handleSave();
              onClose();
            }}
            className="px-5 py-2.5 bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-black text-xs rounded-xl flex items-center gap-1.5 shadow"
          >
            <IconCheck size={15} />
            <span>Enregistrer</span>
          </button>
        </div>
      </div>
    </div>
  );
};
