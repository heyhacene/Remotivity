import { useState, useEffect, useMemo, useCallback } from 'react';
import { App as CapApp } from '@capacitor/app';
import { LocalNotifications } from '@capacitor/local-notifications';
import {
  RemoteInstance,
  InstanceType,
  APP_CURRENT_VERSION,
  DEFAULT_INSTANCES,
  GITHUB_RELEASES_API,
  INSTANCE_TYPE_META,
  compareVersions,
  decodeInstanceInvite,
} from './types/remotivity';
import {
  IconTerminal,
  IconShare,
  IconRefresh,
  IconPlus,
  IconSearch,
  IconStar,
  IconSparkles,
  IconBook,
  IconSignal,
  IconTrash,
  IconServer,
  IconExternalLink,
  IconShield,
  IconPlay,
} from './components/Icons';
import { UpdateModal } from './components/UpdateModal';
import { ShareModal } from './components/ShareModal';
import { InstanceConsoleModal } from './components/InstanceConsoleModal';
import { AddInstanceModal } from './components/AddInstanceModal';
import { GuideModal } from './components/GuideModal';

const STORAGE_KEY_INSTANCES = 'remotivity_instances_v1';

type FilterType = 'all' | InstanceType | 'favorites' | 'shared';

export default function App() {
  const [instances, setInstances] = useState<RemoteInstance[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_INSTANCES);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // Fallback to defaults
    }
    return DEFAULT_INSTANCES;
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [pingingAll, setPingingAll] = useState(false);

  // Modals
  const [activeConsoleInstance, setActiveConsoleInstance] = useState<RemoteInstance | null>(null);
  const [updateModalOpen, setUpdateModalOpen] = useState(false);
  const [hasNewUpdate, setHasNewUpdate] = useState(false);
  const [latestTagFound, setLatestTagFound] = useState<string | null>(null);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareInitialTab, setShareInitialTab] = useState<'app' | 'instance'>('app');
  const [shareTargetId, setShareTargetId] = useState<string | null>(null);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editingInstance, setEditingInstance] = useState<RemoteInstance | null>(null);
  const [guideModalOpen, setGuideModalOpen] = useState(false);

  // Toast Banner for invites / feedback
  const [toastMsg, setToastMsg] = useState<{ type: 'info' | 'success' | 'error'; text: string } | null>(null);

  const showToast = useCallback((type: 'info' | 'success' | 'error', text: string) => {
    setToastMsg({ type, text });
    setTimeout(() => {
      setToastMsg((prev) => (prev?.text === text ? null : prev));
    }, 4500);
  }, []);

  // Persist instances
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_INSTANCES, JSON.stringify(instances));
    } catch {
      // Ignore storage errors
    }
  }, [instances]);

  // Handle ?invite=... deep link on launch
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const inviteParam = params.get('invite');
      if (inviteParam) {
        const decoded = decodeInstanceInvite(inviteParam);
        if (decoded.payload) {
          const p = decoded.payload;
          const imported: RemoteInstance = {
            id: `shared-${Date.now()}`,
            name: p.name,
            type: p.type || 'antigravity',
            hostUrl: p.hostUrl,
            webPortalUrl: p.webPortalUrl,
            accessToken: p.accessToken,
            workspace: p.workspace || '~',
            status: 'online',
            tags: ['Partagé', p.readOnly ? 'Lecture seule' : 'Contrôle'],
            isFavorite: true,
            lastActive: 'Importé via lien',
            sharedBy: p.sharedBy || 'Contact',
            expiresAt: p.expiresAt,
            readOnly: p.readOnly,
            description: `Instance partagée par ${p.sharedBy || 'un pair'}.`,
          };
          setInstances((prev) => [imported, ...prev]);
          showToast('success', `Instance partagée « ${imported.name} » ajoutée !`);
        } else {
          showToast('error', decoded.error || 'Lien d’invitation invalide.');
        }

        // Clean query param so reload doesn't re-import
        const cleanUrl = window.location.pathname + window.location.hash;
        window.history.replaceState({}, '', cleanUrl);
      }
    } catch {
      // Ignore URL parsing issues
    }
  }, [showToast]);

  // Automatic startup update check + popup + Android notification
  useEffect(() => {
    const checkUpdateStartup = async () => {
      try {
        const sessionChecked = sessionStorage.getItem('rmv_update_popup_checked');
        if (sessionChecked) return;
        sessionStorage.setItem('rmv_update_popup_checked', 'true');

        const res = await fetch(GITHUB_RELEASES_API, { cache: 'no-store' });
        if (!res.ok) return;
        const rel = await res.json();
        if (rel.tag_name && compareVersions(rel.tag_name, APP_CURRENT_VERSION) > 0) {
          setHasNewUpdate(true);
          setLatestTagFound(rel.tag_name);

          const lastNotified = localStorage.getItem('rmv_last_notified_release');
          if (rel.tag_name !== lastNotified) {
            localStorage.setItem('rmv_last_notified_release', rel.tag_name);
            setUpdateModalOpen(true);

            // Trigger native Android notification if available
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
            } catch {
              // Web browser fallback
            }
          }
        }
      } catch {
        // Offline or network error
      }
    };
    checkUpdateStartup();
  }, []);

  // Android Hardware Back Button handling
  useEffect(() => {
    let listenerHandle: { remove: () => Promise<void> } | null = null;
    try {
      CapApp.addListener('backButton', ({ canGoBack }) => {
        if (activeConsoleInstance) {
          setActiveConsoleInstance(null);
        } else if (shareModalOpen) {
          setShareModalOpen(false);
        } else if (updateModalOpen) {
          setUpdateModalOpen(false);
        } else if (addModalOpen) {
          setAddModalOpen(false);
        } else if (guideModalOpen) {
          setGuideModalOpen(false);
        } else if (canGoBack) {
          window.history.back();
        } else {
          CapApp.exitApp();
        }
      }).then((handle) => {
        listenerHandle = handle;
      });
    } catch {
      // Not running in Capacitor native shell
    }

    return () => {
      if (listenerHandle) {
        listenerHandle.remove().catch(() => {});
      }
    };
  }, [activeConsoleInstance, shareModalOpen, updateModalOpen, addModalOpen, guideModalOpen]);

  const updateInstanceStatus = useCallback(
    (id: string, status: 'online' | 'busy' | 'offline', pingMs?: number) => {
      setInstances((prev) =>
        prev.map((inst) =>
          inst.id === id
            ? {
                ...inst,
                status,
                lastPingMs: pingMs !== undefined ? pingMs : inst.lastPingMs,
                lastActive: status === 'online' ? 'En ligne maintenant' : inst.lastActive,
              }
            : inst
        )
      );
    },
    []
  );

  const pingSingleInstance = async (inst: RemoteInstance) => {
    const cleanUrl = inst.hostUrl.replace(/\/+$/, '');
    const t0 = performance.now();
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);
      const isLocalAgent = cleanUrl.includes('localhost') || cleanUrl.includes('127.0.0.1') || cleanUrl.match(/:\d{4,5}$/);
      const targetUrl = isLocalAgent ? `${cleanUrl}/api/status` : cleanUrl;

      const res = await fetch(targetUrl, {
        method: 'GET',
        mode: isLocalAgent ? 'cors' : 'no-cors',
        headers:
          isLocalAgent && inst.accessToken
            ? {
                Authorization: `Bearer ${inst.accessToken}`,
                'X-Remotivity-Token': inst.accessToken,
              }
            : {},
        signal: controller.signal,
      });
      clearTimeout(timeout);
      const ms = Math.max(1, Math.round(performance.now() - t0));

      if (res.type === 'opaque' || res.ok) {
        updateInstanceStatus(inst.id, 'online', ms);
      } else {
        updateInstanceStatus(inst.id, inst.isDemo ? 'busy' : 'offline', ms);
      }
    } catch {
      updateInstanceStatus(inst.id, inst.isDemo ? 'busy' : 'offline');
    }
  };

  const handlePingAll = async () => {
    setPingingAll(true);
    await Promise.all(instances.map((inst) => pingSingleInstance(inst)));
    setPingingAll(false);
    showToast('info', 'État des instances actualisé.');
  };

  const handleToggleFavorite = (id: string) => {
    setInstances((prev) =>
      prev.map((i) => (i.id === id ? { ...i, isFavorite: !i.isFavorite } : i))
    );
  };

  const handleDeleteInstance = (id: string) => {
    setInstances((prev) => prev.filter((i) => i.id !== id));
    showToast('info', 'Instance supprimée.');
  };

  const handleSaveInstance = (saved: RemoteInstance) => {
    setInstances((prev) => {
      const exists = prev.some((i) => i.id === saved.id);
      if (exists) {
        return prev.map((i) => (i.id === saved.id ? saved : i));
      }
      return [saved, ...prev];
    });
    showToast('success', `Instance « ${saved.name} » enregistrée.`);
  };

  const openShareApp = () => {
    setShareInitialTab('app');
    setShareTargetId(null);
    setShareModalOpen(true);
  };

  const openShareInstance = (inst: RemoteInstance) => {
    setShareInitialTab('instance');
    setShareTargetId(inst.id);
    setShareModalOpen(true);
  };

  const filteredInstances = useMemo(() => {
    return instances.filter((inst) => {
      if (activeFilter === 'favorites' && !inst.isFavorite) return false;
      if (activeFilter === 'shared' && !inst.sharedBy) return false;
      if (
        activeFilter !== 'all' &&
        activeFilter !== 'favorites' &&
        activeFilter !== 'shared' &&
        inst.type !== activeFilter
      ) {
        return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const hay = `${inst.name} ${inst.workspace} ${inst.hostUrl} ${inst.tags.join(' ')} ${inst.type}`.toLowerCase();
        return hay.includes(q);
      }

      return true;
    });
  }, [instances, activeFilter, searchQuery]);

  const stats = useMemo(() => {
    const online = instances.filter((i) => i.status === 'online').length;
    const pings = instances.map((i) => i.lastPingMs).filter((p): p is number => typeof p === 'number');
    const avgPing = pings.length > 0 ? Math.round(pings.reduce((a, b) => a + b, 0) / pings.length) : 18;
    return { total: instances.length, online, avgPing };
  }, [instances]);

  const filterChips: { id: FilterType; label: string }[] = [
    { id: 'all', label: `Toutes (${instances.length})` },
    { id: 'antigravity', label: '🛰️ Antigravity' },
    { id: 'claude', label: '✨ Claude' },
    { id: 'jules', label: '🤖 Jules' },
    { id: 'vscode', label: '💻 VS Code' },
    { id: 'terminal', label: '⚡ Terminal' },
    { id: 'favorites', label: '⭐ Favoris' },
    { id: 'shared', label: '🔗 Partagées' },
  ];

  return (
    <div className="min-h-screen bg-[#060913] text-slate-100 pb-28">
      {/* Sticky Top Header */}
      <header className="rmv-header">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <img
              src="./logo-remotivity.png"
              alt="Remotivity"
              className="w-9 h-9 rounded-xl border border-cyan-400/40 shadow-md flex-shrink-0"
            />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-black tracking-tight text-white truncate">
                  Remotivity
                </h1>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                  {APP_CURRENT_VERSION}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 truncate">
                Cockpit d’accès distant • IA, Code & Terminaux
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button
              onClick={() => setGuideModalOpen(true)}
              className="p-2.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700/80 text-slate-300 hover:text-white transition"
              title="Guide de connexion PC & Tunnels"
            >
              <IconBook size={17} />
            </button>

            <button
              onClick={openShareApp}
              className="p-2.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700/80 text-cyan-300 hover:text-white transition"
              title="Partager l'application ou une instance"
            >
              <IconShare size={17} />
            </button>

            <button
              onClick={() => setUpdateModalOpen(true)}
              className="relative p-2.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700/80 text-indigo-300 hover:text-white transition"
              title="Vérifier les mises à jour"
            >
              <IconSparkles size={17} />
              {hasNewUpdate && (
                <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-amber-400 border-2 border-[#060913] animate-pulse" />
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-3.5 sm:px-5 pt-4 space-y-5">
        {/* Toast Banner */}
        {toastMsg && (
          <div
            className={`p-3 rounded-2xl border text-xs font-bold flex items-center justify-between gap-2 shadow-lg ${
              toastMsg.type === 'success'
                ? 'bg-emerald-950/70 border-emerald-500/45 text-emerald-200'
                : toastMsg.type === 'error'
                ? 'bg-rose-950/70 border-rose-500/45 text-rose-200'
                : 'bg-cyan-950/70 border-cyan-500/45 text-cyan-200'
            }`}
          >
            <span>{toastMsg.text}</span>
            <button onClick={() => setToastMsg(null)} className="text-white/70 hover:text-white">
              ✕
            </button>
          </div>
        )}

        {/* New Update Inline Alert Pill if available */}
        {hasNewUpdate && latestTagFound && (
          <button
            onClick={() => setUpdateModalOpen(true)}
            className="w-full p-3 rounded-2xl bg-gradient-to-r from-amber-500/15 via-cyan-500/15 to-indigo-500/15 border border-amber-400/45 flex items-center justify-between text-left transition hover:border-amber-300"
          >
            <div className="flex items-center gap-2.5">
              <span className="text-lg">🚀</span>
              <div>
                <div className="text-xs font-black text-amber-300">
                  Nouvelle version {latestTagFound} disponible !
                </div>
                <div className="text-[11px] text-slate-300">
                  Touchez ici pour télécharger Remotivity.apk et voir les nouveautés.
                </div>
              </div>
            </div>
            <span className="px-3 py-1 rounded-xl bg-amber-400 text-slate-950 font-black text-[11px] flex-shrink-0">
              Mettre à jour
            </span>
          </button>
        )}

        {/* Hero Status Card */}
        <section className="rmv-hero">
          <div className="absolute -top-10 -right-10 w-40 h-40 bg-cyan-500/15 rounded-full blur-3xl pointer-events-none" />
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/35 text-emerald-300 text-[11px] font-bold">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>
                  {stats.online}/{stats.total} instances actives • Latence moy. {stats.avgPing} ms
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                Vos instances, partout en un tap.
              </h2>
              <p className="text-xs text-slate-300 max-w-xl leading-relaxed">
                Pilotez Antigravity IDE, Claude Code, Google Jules, VS Code et vos terminaux Windows/Linux depuis votre mobile ou partagez un accès temporaire par QR Code.
              </p>
            </div>

            <div className="flex flex-wrap sm:flex-col gap-2 flex-shrink-0">
              <button
                onClick={() => {
                  setEditingInstance(null);
                  setAddModalOpen(true);
                }}
                className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-black text-xs flex items-center justify-center gap-1.5 shadow-lg active:scale-95 transition"
              >
                <IconPlus size={15} />
                <span>Nouvelle Instance</span>
              </button>

              <div className="flex gap-2">
                <button
                  onClick={handlePingAll}
                  disabled={pingingAll}
                  className="flex-1 px-3 py-2 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700 text-cyan-300 text-xs font-bold flex items-center justify-center gap-1.5 transition"
                >
                  <IconRefresh size={14} className={pingingAll ? 'animate-spin' : ''} />
                  <span>Ping tout</span>
                </button>
                <button
                  onClick={() => {
                    setShareInitialTab('instance');
                    setShareTargetId(instances[0]?.id || null);
                    setShareModalOpen(true);
                  }}
                  className="flex-1 px-3 py-2 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700 text-indigo-300 text-xs font-bold flex items-center justify-center gap-1.5 transition"
                >
                  <IconShare size={14} />
                  <span>Partager / Importer</span>
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Search & Filter Chips */}
        <section className="space-y-3">
          <div className="relative">
            <IconSearch size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher une instance, workspace, tag, IP..."
              className="w-full bg-slate-900/80 border border-slate-800 focus:border-cyan-400 rounded-2xl pl-10 pr-4 py-3 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none shadow-inner"
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
            {filterChips.map((chip) => (
              <button
                key={chip.id}
                onClick={() => setActiveFilter(chip.id)}
                className={`rmv-chip ${
                  activeFilter === chip.id ? 'rmv-chip-active' : 'rmv-chip-inactive'
                }`}
              >
                {chip.label}
              </button>
            ))}
          </div>
        </section>

        {/* Instances Grid */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {filteredInstances.length === 0 ? (
            <div className="col-span-full p-8 rounded-3xl bg-slate-900/60 border border-slate-800 text-center space-y-3">
              <div className="text-3xl">🛰️</div>
              <h3 className="text-sm font-black text-white">Aucune instance trouvée</h3>
              <p className="text-xs text-slate-400">
                Modifiez votre filtre ou ajoutez une nouvelle machine / session distante.
              </p>
              <button
                onClick={() => {
                  setActiveFilter('all');
                  setSearchQuery('');
                }}
                className="px-4 py-2 rounded-xl bg-cyan-600 text-white font-bold text-xs"
              >
                Réinitialiser les filtres
              </button>
            </div>
          ) : (
            filteredInstances.map((inst) => {
              const meta = INSTANCE_TYPE_META[inst.type];
              return (
                <article key={inst.id} className="rmv-card space-y-3">
                  {/* Top Row */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className={`px-2.5 py-1 rounded-xl text-[11px] font-extrabold border flex items-center gap-1 flex-shrink-0 ${meta.badgeClass}`}
                      >
                        <span>{meta.iconEmoji}</span>
                        <span>{meta.shortLabel}</span>
                      </span>

                      <span className="inline-flex items-center gap-1 text-[11px] font-bold">
                        <span
                          className={`w-2 h-2 rounded-full ${
                            inst.status === 'online'
                              ? 'bg-emerald-400 animate-pulse'
                              : inst.status === 'busy'
                              ? 'bg-amber-400'
                              : 'bg-rose-400'
                          }`}
                        />
                        <span
                          className={
                            inst.status === 'online'
                              ? 'text-emerald-300'
                              : inst.status === 'busy'
                              ? 'text-amber-300'
                              : 'text-rose-300'
                          }
                        >
                          {inst.status === 'online'
                            ? 'En ligne'
                            : inst.status === 'busy'
                            ? 'Prêt / Démo'
                            : 'Hors ligne'}
                        </span>
                      </span>
                    </div>

                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => handleToggleFavorite(inst.id)}
                        className={`p-1.5 rounded-lg transition ${
                          inst.isFavorite
                            ? 'text-amber-400 bg-amber-500/10'
                            : 'text-slate-500 hover:text-amber-300'
                        }`}
                        title="Favori"
                      >
                        <IconStar size={16} filled={inst.isFavorite} />
                      </button>

                      <button
                        onClick={() => handleDeleteInstance(inst.id)}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition"
                        title="Supprimer"
                      >
                        <IconTrash size={15} />
                      </button>
                    </div>
                  </div>

                  {/* Title & Description */}
                  <div
                    className="space-y-1 cursor-pointer"
                    onClick={() => setActiveConsoleInstance(inst)}
                  >
                    <h3 className="text-base font-black text-white leading-snug">
                      {inst.name}
                    </h3>
                    {inst.description && (
                      <p className="text-xs text-slate-400 line-clamp-2">{inst.description}</p>
                    )}
                  </div>

                  {/* Endpoint & Workspace Info */}
                  <div className="p-2.5 rounded-xl bg-[#060913]/85 border border-slate-800/90 space-y-1 text-[11px] font-mono">
                    <div className="flex items-center justify-between gap-2 text-cyan-300">
                      <span className="truncate">{inst.hostUrl}</span>
                      {inst.lastPingMs !== undefined && (
                        <span className="flex items-center gap-1 text-emerald-300 flex-shrink-0">
                          <IconSignal size={12} />
                          <span>{inst.lastPingMs}ms</span>
                        </span>
                      )}
                    </div>
                    <div className="text-slate-400 truncate">📁 {inst.workspace}</div>
                  </div>

                  {/* Shared Banner if applicable */}
                  {inst.sharedBy && (
                    <div className="px-2.5 py-1.5 rounded-xl bg-indigo-500/15 border border-indigo-500/35 text-[11px] text-indigo-200 flex items-center justify-between">
                      <span className="flex items-center gap-1 font-bold">
                        <IconShield size={13} />
                        <span>Partagé par {inst.sharedBy}</span>
                      </span>
                      <span className="text-[10px] font-mono">
                        {inst.readOnly ? 'Observation' : 'Contrôle'}
                      </span>
                    </div>
                  )}

                  {/* Tags */}
                  <div className="flex flex-wrap gap-1.5">
                    {inst.tags.map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-0.5 rounded-lg bg-slate-800/80 text-slate-300 text-[10px] font-semibold"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>

                  {/* Card Actions */}
                  <div className="pt-1 flex items-center gap-2 mt-auto">
                    <button
                      onClick={() => setActiveConsoleInstance(inst)}
                      className="flex-1 py-2.5 px-3 rounded-xl bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-black text-xs flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition"
                    >
                      <IconPlay size={12} />
                      <span>Accéder</span>
                    </button>

                    <button
                      onClick={() => openShareInstance(inst)}
                      className="p-2.5 rounded-xl bg-slate-800/90 hover:bg-indigo-600/30 border border-slate-700 hover:border-indigo-400/50 text-indigo-300 transition"
                      title="Partager l'accès à cette instance"
                    >
                      <IconShare size={15} />
                    </button>

                    <button
                      onClick={() => {
                        setEditingInstance(inst);
                        setAddModalOpen(true);
                      }}
                      className="px-2.5 py-2.5 rounded-xl bg-slate-800/90 hover:bg-slate-700 border border-slate-700 text-slate-300 text-[11px] font-bold transition"
                      title="Configurer"
                    >
                      Éditer
                    </button>

                    {(inst.webPortalUrl || inst.hostUrl.startsWith('https://')) && (
                      <a
                        href={inst.webPortalUrl || inst.hostUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2.5 rounded-xl bg-slate-800/90 hover:bg-cyan-500/20 border border-slate-700 text-cyan-300 transition"
                        title="Ouvrir le portail Web"
                      >
                        <IconExternalLink size={15} />
                      </a>
                    )}
                  </div>
                </article>
              );
            })
          )}
        </section>
      </main>

      {/* Bottom Mobile Navigation */}
      <nav className="rmv-bottom-nav">
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="flex flex-col items-center gap-0.5 text-cyan-400 font-bold"
        >
          <IconServer size={19} />
          <span className="text-[10px]">Instances</span>
        </button>

        <button
          onClick={() => {
            setEditingInstance(null);
            setAddModalOpen(true);
          }}
          className="flex flex-col items-center gap-0.5 text-slate-300 hover:text-cyan-300 font-bold transition"
        >
          <IconTerminal size={19} />
          <span className="text-[10px]">Ajouter</span>
        </button>

        <button
          onClick={openShareApp}
          className="flex flex-col items-center gap-0.5 text-slate-300 hover:text-indigo-300 font-bold transition"
        >
          <IconShare size={19} />
          <span className="text-[10px]">Partager</span>
        </button>

        <button
          onClick={() => setUpdateModalOpen(true)}
          className="relative flex flex-col items-center gap-0.5 text-slate-300 hover:text-amber-300 font-bold transition"
        >
          <IconSparkles size={19} />
          <span className="text-[10px]">Mises à jour</span>
          {hasNewUpdate && (
            <span className="absolute -top-0.5 right-2 w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
          )}
        </button>
      </nav>

      {/* Modals */}
      <InstanceConsoleModal
        instance={activeConsoleInstance}
        onClose={() => setActiveConsoleInstance(null)}
        onShareInstance={(inst) => openShareInstance(inst)}
        onUpdateInstanceStatus={updateInstanceStatus}
      />

      <ShareModal
        isOpen={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
        instances={instances}
        initialTab={shareInitialTab}
        preselectedInstanceId={shareTargetId}
        onImportInstance={(inst) => {
          setInstances((prev) => [inst, ...prev]);
          showToast('success', `Instance « ${inst.name} » importée !`);
        }}
      />

      <UpdateModal
        isOpen={updateModalOpen}
        onClose={() => setUpdateModalOpen(false)}
        currentVersion={APP_CURRENT_VERSION}
      />

      <AddInstanceModal
        isOpen={addModalOpen}
        onClose={() => {
          setAddModalOpen(false);
          setEditingInstance(null);
        }}
        onSave={handleSaveInstance}
        editingInstance={editingInstance}
      />

      <GuideModal isOpen={guideModalOpen} onClose={() => setGuideModalOpen(false)} />
    </div>
  );
}
