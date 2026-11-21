import { useState, useEffect, useMemo, useCallback } from 'react';
import { App as CapApp } from '@capacitor/app';
import { LocalNotifications } from '@capacitor/local-notifications';
import {
  APP_CURRENT_VERSION,
  DEFAULT_ANTIGRAVITY_URL,
  DEFAULT_SESSIONS,
  GITHUB_RELEASES_API,
  RemoteSession,
  compareVersions,
  decodeSessionInvite,
  getCurrentNativePortalUrl,
  isNativePortalSupported,
  openRemotePortal,
} from './types/remotivity';
import {
  IconExternalLink,
  IconGlobe,
  IconGoogle,
  IconPlus,
  IconShare,
  IconSparkles,
  IconStar,
  IconTrash,
} from './components/Icons';
import { UpdateModal } from './components/UpdateModal';
import { ShareModal } from './components/ShareModal';

const STORAGE_KEY_SESSIONS = 'remotivity_sessions_v2';
const STORAGE_KEY_AUTO_OPEN = 'remotivity_auto_open_v2';

export default function App() {
  const [sessions, setSessions] = useState<RemoteSession[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_SESSIONS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // Fallback
    }
    return DEFAULT_SESSIONS;
  });

  const [autoOpenOnLaunch, setAutoOpenOnLaunch] = useState<boolean>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY_AUTO_OPEN) === 'true';
    } catch {
      return false;
    }
  });

  const [portalOpenedOnce, setPortalOpenedOnce] = useState(false);
  const [capturedUrl, setCapturedUrl] = useState<string | null>(null);

  // Simple Add Shortcut form
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newUrl, setNewUrl] = useState('');

  // Modals
  const [updateModalOpen, setUpdateModalOpen] = useState(false);
  const [hasNewUpdate, setHasNewUpdate] = useState(false);
  const [latestTagFound, setLatestTagFound] = useState<string | null>(null);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareInitialTab, setShareInitialTab] = useState<'app' | 'session'>('app');
  const [shareTargetId, setShareTargetId] = useState<string | null>(null);

  const [toastMsg, setToastMsg] = useState<{ type: 'info' | 'success' | 'error'; text: string } | null>(null);

  const showToast = useCallback((type: 'info' | 'success' | 'error', text: string) => {
    setToastMsg({ type, text });
    setTimeout(() => {
      setToastMsg((prev) => (prev?.text === text ? null : prev));
    }, 4000);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_SESSIONS, JSON.stringify(sessions));
    } catch {}
  }, [sessions]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_AUTO_OPEN, String(autoOpenOnLaunch));
    } catch {}
  }, [autoOpenOnLaunch]);

  const primarySession = useMemo(
    () => sessions.find((s) => s.isPrimary) || sessions[0],
    [sessions]
  );

  // Listen for pin-url event triggered from native WebView top bar ("Garder")
  useEffect(() => {
    const onPinUrl = (ev: Event) => {
      const customEv = ev as CustomEvent<string>;
      const pinnedUrl = customEv?.detail;
      if (pinnedUrl && pinnedUrl.startsWith('http')) {
        setCapturedUrl(pinnedUrl);
        setSessions((prev) => {
          const hasPrimary = prev.some((s) => s.isPrimary);
          if (hasPrimary) {
            return prev.map((s) => (s.isPrimary ? { ...s, url: pinnedUrl } : s));
          }
          return prev.map((s, idx) => (idx === 0 ? { ...s, isPrimary: true, url: pinnedUrl } : s));
        });
        showToast('success', 'Session mémorisée comme accès principal !');
      }
    };

    const onPortalClosed = () => {
      const url = getCurrentNativePortalUrl();
      if (url && url.startsWith('http')) {
        setCapturedUrl(url);
      }
    };

    window.addEventListener('remotivity-pin-url', onPinUrl);
    window.addEventListener('remotivity-portal-hidden', onPortalClosed);
    return () => {
      window.removeEventListener('remotivity-pin-url', onPinUrl);
      window.removeEventListener('remotivity-portal-hidden', onPortalClosed);
    };
  }, [showToast]);

  // Handle ?invite=... shared session link on launch
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const inviteParam = params.get('invite');
      if (inviteParam) {
        const decoded = decodeSessionInvite(inviteParam);
        if (decoded.payload) {
          const p = decoded.payload;
          const imported: RemoteSession = {
            id: `shared-${Date.now()}`,
            name: p.name,
            url: p.url,
            icon: p.icon || '🛰️',
            subtitle: `Partagé par ${p.sharedBy || 'un contact'}`,
            sharedBy: p.sharedBy || 'Contact',
          };
          setSessions((prev) => [imported, ...prev]);
          showToast('success', `Session « ${imported.name} » ajoutée !`);
        } else {
          showToast('error', decoded.error || 'Lien d’invitation invalide.');
        }
        window.history.replaceState({}, '', window.location.pathname);
      }
    } catch {}
  }, [showToast]);

  // Automatic update check + popup + optional auto-open Antigravity
  useEffect(() => {
    const startupFlow = async () => {
      let openedUpdatePopup = false;
      try {
        const sessionChecked = sessionStorage.getItem('rmv_update_popup_checked');
        if (!sessionChecked) {
          sessionStorage.setItem('rmv_update_popup_checked', 'true');
          const res = await fetch(GITHUB_RELEASES_API, { cache: 'no-store' });
          if (res.ok) {
            const rel = await res.json();
            if (rel.tag_name && compareVersions(rel.tag_name, APP_CURRENT_VERSION) > 0) {
              setHasNewUpdate(true);
              setLatestTagFound(rel.tag_name);
              const lastNotified = localStorage.getItem('rmv_last_notified_release');
              if (rel.tag_name !== lastNotified) {
                localStorage.setItem('rmv_last_notified_release', rel.tag_name);
                setUpdateModalOpen(true);
                openedUpdatePopup = true;

                try {
                  const perm = await LocalNotifications.checkPermissions();
                  if (perm.display === 'granted') {
                    await LocalNotifications.schedule({
                      notifications: [
                        {
                          id: 90101,
                          title: `Remotivity ${rel.tag_name} disponible !`,
                          body: 'Une nouvelle version signée est prête au téléchargement.',
                          smallIcon: 'ic_launcher',
                        },
                      ],
                    });
                  }
                } catch {}
              }
            }
          }
        }
      } catch {}

      if (!openedUpdatePopup && autoOpenOnLaunch && isNativePortalSupported()) {
        const target = primarySession?.url || DEFAULT_ANTIGRAVITY_URL;
        setPortalOpenedOnce(true);
        openRemotePortal(target, primarySession?.name || 'Antigravity Remote');
      }
    };
    startupFlow();
  }, []);

  // Android Hardware Back Button handling
  useEffect(() => {
    let listenerHandle: { remove: () => Promise<void> } | null = null;
    try {
      CapApp.addListener('backButton', ({ canGoBack }) => {
        if (shareModalOpen) {
          setShareModalOpen(false);
        } else if (updateModalOpen) {
          setUpdateModalOpen(false);
        } else if (showAddForm) {
          setShowAddForm(false);
        } else if (canGoBack) {
          window.history.back();
        } else {
          CapApp.exitApp();
        }
      }).then((handle) => {
        listenerHandle = handle;
      });
    } catch {}

    return () => {
      if (listenerHandle) {
        listenerHandle.remove().catch(() => {});
      }
    };
  }, [shareModalOpen, updateModalOpen, showAddForm]);

  const handleOpenSession = (session: RemoteSession) => {
    setPortalOpenedOnce(true);
    openRemotePortal(session.url, session.name);
  };

  const handleSetPrimary = (id: string) => {
    setSessions((prev) =>
      prev.map((s) => ({
        ...s,
        isPrimary: s.id === id,
      }))
    );
    showToast('success', 'Session définie comme accès principal.');
  };

  const handleDeleteSession = (id: string) => {
    setSessions((prev) => {
      if (prev.length <= 1) return prev;
      const filtered = prev.filter((s) => s.id !== id);
      if (!filtered.some((s) => s.isPrimary) && filtered[0]) {
        filtered[0] = { ...filtered[0], isPrimary: true };
      }
      return filtered;
    });
    showToast('info', 'Raccourci supprimé.');
  };

  const handlePasteUrl = async () => {
    try {
      const txt = await navigator.clipboard.readText();
      if (txt && txt.trim().startsWith('http')) {
        setNewUrl(txt.trim());
        showToast('success', 'Lien collé !');
      } else {
        showToast('error', 'Le presse-papiers ne contient pas de lien valide.');
      }
    } catch {
      showToast('info', 'Collez directement le lien dans le champ.');
    }
  };

  const handleAddShortcut = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = newName.trim();
    const cleanUrl = newUrl.trim();
    if (!cleanName || !cleanUrl) return;

    const normalizedUrl =
      cleanUrl.startsWith('http://') || cleanUrl.startsWith('https://')
        ? cleanUrl
        : `https://${cleanUrl}`;

    const created: RemoteSession = {
      id: `sess-${Date.now()}`,
      name: cleanName,
      url: normalizedUrl,
      icon: normalizedUrl.includes('antigravity')
        ? '🛰️'
        : normalizedUrl.includes('jules')
        ? '🤖'
        : normalizedUrl.includes('claude')
        ? '✨'
        : '🔗',
      subtitle: 'Raccourci personnalisé',
    };

    setSessions((prev) => [...prev, created]);
    setNewName('');
    setNewUrl('');
    setShowAddForm(false);
    showToast('success', `« ${created.name} » ajouté !`);
  };

  const openShareApp = () => {
    setShareInitialTab('app');
    setShareTargetId(null);
    setShareModalOpen(true);
  };

  const openShareSession = (session: RemoteSession) => {
    setShareInitialTab('session');
    setShareTargetId(session.id);
    setShareModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-[#060913] text-slate-100 pb-28">
      {/* Minimal Header */}
      <header className="rmv-header">
        <div className="max-w-xl mx-auto flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <img
              src="./logo-remotivity.png"
              alt="Remotivity"
              className="w-9 h-9 rounded-xl border border-cyan-400/40 shadow-md flex-shrink-0"
            />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-base font-black tracking-tight text-white">Remotivity</h1>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                  {APP_CURRENT_VERSION}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 truncate">
                Accès mobile Antigravity Remote
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button
              onClick={openShareApp}
              className="p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-cyan-300 transition"
              title="Partager"
            >
              <IconShare size={17} />
            </button>
            <button
              onClick={() => setUpdateModalOpen(true)}
              className="relative p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-indigo-300 transition"
              title="Mises à jour"
            >
              <IconSparkles size={17} />
              {hasNewUpdate && (
                <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-amber-400 border-2 border-[#060913] animate-pulse" />
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main Centered Content */}
      <main className="max-w-xl mx-auto px-4 pt-5 space-y-5">
        {toastMsg && (
          <div
            className={`p-3 rounded-2xl border text-xs font-bold flex items-center justify-between gap-2 shadow-lg ${
              toastMsg.type === 'success'
                ? 'bg-emerald-950/75 border-emerald-500/45 text-emerald-200'
                : toastMsg.type === 'error'
                ? 'bg-rose-950/75 border-rose-500/45 text-rose-200'
                : 'bg-cyan-950/75 border-cyan-500/45 text-cyan-200'
            }`}
          >
            <span>{toastMsg.text}</span>
            <button onClick={() => setToastMsg(null)} className="text-white/70 hover:text-white">
              ✕
            </button>
          </div>
        )}

        {/* Update Banner if new release exists */}
        {hasNewUpdate && latestTagFound && (
          <button
            onClick={() => setUpdateModalOpen(true)}
            className="w-full p-3.5 rounded-2xl bg-gradient-to-r from-amber-500/15 to-cyan-500/15 border border-amber-400/45 flex items-center justify-between text-left"
          >
            <div>
              <div className="text-xs font-black text-amber-300">
                🚀 Nouvelle version {latestTagFound} disponible
              </div>
              <div className="text-[11px] text-slate-300">
                Touchez pour installer la mise à jour.
              </div>
            </div>
            <span className="px-3 py-1 rounded-xl bg-amber-400 text-slate-950 font-black text-[11px]">
              Mettre à jour
            </span>
          </button>
        )}

        {/* 1. CARTE CENTRALE ANTIGRAVITY REMOTE */}
        <section className="rmv-hero space-y-4">
          <div className="absolute -top-12 -right-12 w-44 h-44 bg-cyan-500/15 rounded-full blur-3xl pointer-events-none" />

          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/35 text-emerald-300 text-[11px] font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Session principale prête</span>
            </div>
            <h2 className="text-xl font-black text-white leading-tight">
              {primarySession.icon} {primarySession.name}
            </h2>
            <p className="text-xs text-slate-300 leading-relaxed">
              Connectez-vous une fois avec votre compte Google et retrouvez directement votre session Antigravity du PC du boulot en plein écran.
            </p>
          </div>

          <button
            onClick={() => handleOpenSession(primarySession)}
            className="w-full py-4 px-5 rounded-2xl bg-gradient-to-r from-cyan-500 via-sky-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-black text-sm flex items-center justify-center gap-2.5 shadow-xl active:scale-[0.98] transition"
          >
            <span className="p-1.5 rounded-lg bg-white text-slate-950">
              <IconGoogle size={16} />
            </span>
            <span>
              {portalOpenedOnce
                ? 'Reprendre Antigravity Remote'
                : 'Ouvrir Antigravity Remote'}
            </span>
            <IconExternalLink size={16} />
          </button>

          {/* Active URL status & auto-launch toggle */}
          <div className="space-y-2.5 pt-1">
            <div className="px-3 py-2 rounded-xl bg-[#060913]/80 border border-slate-800 flex items-center justify-between gap-2 text-[11px] font-mono">
              <span className="text-cyan-300 truncate">{primarySession.url}</span>
              {capturedUrl && capturedUrl !== primarySession.url && (
                <button
                  onClick={() => {
                    setSessions((prev) =>
                      prev.map((s) => (s.isPrimary ? { ...s, url: capturedUrl } : s))
                    );
                    showToast('success', 'Dernière page visitée définie par défaut !');
                  }}
                  className="text-amber-300 font-sans font-bold whitespace-nowrap hover:underline"
                >
                  📌 Mémoriser dernière page
                </button>
              )}
            </div>

            <label className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl bg-slate-900/70 border border-slate-800 cursor-pointer">
              <span className="text-xs font-semibold text-slate-200">
                Ouvrir Antigravity directement au lancement
              </span>
              <input
                type="checkbox"
                checked={autoOpenOnLaunch}
                onChange={(e) => setAutoOpenOnLaunch(e.target.checked)}
                className="w-5 h-5 accent-cyan-500"
              />
            </label>
          </div>
        </section>

        {/* 2. MES SESSIONS & ACCÈS RAPIDES */}
        <section className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">
              Mes sessions ({sessions.length})
            </h3>
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-cyan-300 text-xs font-bold flex items-center gap-1 transition"
            >
              <IconPlus size={14} />
              <span>{showAddForm ? 'Fermer' : 'Ajouter un lien'}</span>
            </button>
          </div>

          {showAddForm && (
            <form
              onSubmit={handleAddShortcut}
              className="p-4 rounded-2xl bg-slate-900/90 border border-cyan-500/35 space-y-3"
            >
              <input
                type="text"
                required
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Nom (ex: Antigravity Projet X)"
                className="w-full bg-[#060913] border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-400"
              />
              <div className="flex gap-2">
                <input
                  type="text"
                  required
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
                  placeholder="https://antigravity.google/..."
                  className="flex-1 bg-[#060913] border border-slate-700 rounded-xl px-3 py-2.5 text-xs font-mono text-white focus:outline-none focus:border-cyan-400"
                />
                <button
                  type="button"
                  onClick={handlePasteUrl}
                  className="px-3 py-2 rounded-xl bg-slate-800 text-cyan-300 text-xs font-bold flex-shrink-0"
                >
                  Coller
                </button>
              </div>
              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 text-white font-black text-xs"
              >
                Enregistrer ce raccourci
              </button>
            </form>
          )}

          <div className="space-y-2.5">
            {sessions.map((sess) => (
              <div
                key={sess.id}
                className={`rmv-card !p-3.5 flex-row items-center justify-between gap-3 ${
                  sess.isPrimary ? 'border-cyan-500/45' : ''
                }`}
              >
                <button
                  type="button"
                  onClick={() => handleOpenSession(sess)}
                  className="flex items-center gap-3 min-w-0 flex-1 text-left"
                >
                  <div className="w-11 h-11 rounded-2xl bg-slate-900 border border-slate-700 flex items-center justify-center text-xl flex-shrink-0">
                    {sess.icon}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-black text-white truncate">
                        {sess.name}
                      </span>
                      {sess.isPrimary && (
                        <span className="px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 text-[9px] font-black uppercase">
                          Principal
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-400 truncate">
                      {sess.subtitle || sess.url}
                    </div>
                  </div>
                </button>

                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => handleSetPrimary(sess.id)}
                    className={`p-2 rounded-xl transition ${
                      sess.isPrimary
                        ? 'text-amber-400 bg-amber-500/10'
                        : 'text-slate-500 hover:text-amber-300'
                    }`}
                    title="Définir comme session principale"
                  >
                    <IconStar size={16} filled={sess.isPrimary} />
                  </button>

                  <button
                    type="button"
                    onClick={() => openShareSession(sess)}
                    className="p-2 rounded-xl text-indigo-300 hover:bg-indigo-500/15 transition"
                    title="Partager cette session"
                  >
                    <IconShare size={15} />
                  </button>

                  {sessions.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleDeleteSession(sess.id)}
                      className="p-2 rounded-xl text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition"
                      title="Supprimer"
                    >
                      <IconTrash size={15} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>

      {/* 3. BARRE INFÉRIEURE SIMPLE À 3 BOUTONS */}
      <nav className="rmv-bottom-nav">
        <button
          onClick={() => handleOpenSession(primarySession)}
          className="flex flex-col items-center gap-0.5 text-cyan-400 font-bold"
        >
          <IconGlobe size={20} />
          <span className="text-[11px]">Ouvrir Remote</span>
        </button>

        <button
          onClick={openShareApp}
          className="flex flex-col items-center gap-0.5 text-slate-300 hover:text-indigo-300 font-bold transition"
        >
          <IconShare size={20} />
          <span className="text-[11px]">Partager</span>
        </button>

        <button
          onClick={() => setUpdateModalOpen(true)}
          className="relative flex flex-col items-center gap-0.5 text-slate-300 hover:text-amber-300 font-bold transition"
        >
          <IconSparkles size={20} />
          <span className="text-[11px]">Mise à jour</span>
          {hasNewUpdate && (
            <span className="absolute -top-0.5 right-3 w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
          )}
        </button>
      </nav>

      {/* Modals */}
      <ShareModal
        isOpen={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
        sessions={sessions}
        initialTab={shareInitialTab}
        preselectedSessionId={shareTargetId}
        onImportSession={(sess) => {
          setSessions((prev) => [sess, ...prev]);
          showToast('success', `Session « ${sess.name} » ajoutée !`);
        }}
      />

      <UpdateModal
        isOpen={updateModalOpen}
        onClose={() => setUpdateModalOpen(false)}
        currentVersion={APP_CURRENT_VERSION}
      />
    </div>
  );
}
