import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { App as CapApp } from '@capacitor/app';
import { LocalNotifications } from '@capacitor/local-notifications';
import {
  AIModelOption,
  APP_CURRENT_VERSION,
  ChatMessage,
  DEFAULT_AI_MODELS,
  DEFAULT_ANTIGRAVITY_PORTAL_URL,
  DEFAULT_INSTANCES,
  GITHUB_RELEASES_API,
  GoogleAuthConfig,
  INSTANCE_TYPE_META,
  InstanceType,
  RemoteInstance,
  WORK_PROJECTS,
  compareVersions,
  decodeInstanceInvite,
  getCurrentNativePortalUrl,
  isNativePortalSupported,
  openRemotePortal,
} from './types/remotivity';
import {
  fetchAvailableGoogleModels,
  fetchGoogleUserInfo,
  loadGoogleAuthConfig,
  parseGoogleOAuthHash,
  saveGoogleAuthConfig,
  sendModelChatMessage,
} from './services/googleApi';
import {
  IconBook,
  IconCheck,
  IconCopy,
  IconExternalLink,
  IconGlobe,
  IconGoogle,
  IconMessage,
  IconPlay,
  IconPlus,
  IconRefresh,
  IconSearch,
  IconSend,
  IconServer,
  IconSettings,
  IconShare,
  IconShield,
  IconSignal,
  IconSparkles,
  IconStar,
  IconTrash,
} from './components/Icons';
import { UpdateModal } from './components/UpdateModal';
import { ShareModal } from './components/ShareModal';
import { InstanceConsoleModal } from './components/InstanceConsoleModal';
import { AddInstanceModal } from './components/AddInstanceModal';
import { GuideModal } from './components/GuideModal';
import { GoogleAuthModal } from './components/GoogleAuthModal';

const STORAGE_KEY_INSTANCES = 'remotivity_instances_v1';
const STORAGE_KEY_CHAT = 'remotivity_chat_v1';

type MainView = 'remote' | 'chat' | 'instances';
type FilterType = 'all' | InstanceType | 'favorites' | 'shared';

export default function App() {
  const [mainView, setMainView] = useState<MainView>('remote');

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

  const [googleAuth, setGoogleAuth] = useState<GoogleAuthConfig>(() => loadGoogleAuthConfig());
  const [availableModels, setAvailableModels] = useState<AIModelOption[]>(DEFAULT_AI_MODELS);
  const [selectedModelId, setSelectedModelId] = useState<string>(() => {
    const cfg = loadGoogleAuthConfig();
    return cfg.apiKey || cfg.oauthAccessToken ? 'gemini-2.5-pro' : 'antigravity-host';
  });

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_CHAT);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // Ignore
    }
    return [
      {
        id: 'welcome-1',
        role: 'assistant',
        text:
          "Bienvenue sur Remotivity !\n\n" +
          "• Onglet « Remote » : lancez directement le portail officiel Antigravity avec votre compte Google en plein écran (comme dans Firefox, sans quitter l'appli).\n" +
          "• Onglet « Chat IA » : discutez via l'API Google Gemini, votre Agent PC Antigravity, ou d'autres modèles configurés.",
        timestamp: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        modelLabel: 'Remotivity',
      },
    ];
  });
  const [chatInput, setChatInput] = useState('');
  const [chatSending, setChatSending] = useState(false);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [pingingAll, setPingingAll] = useState(false);
  const [copiedPortal, setCopiedPortal] = useState(false);

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
  const [googleModalOpen, setGoogleModalOpen] = useState(false);

  // Toast Banner
  const [toastMsg, setToastMsg] = useState<{ type: 'info' | 'success' | 'error'; text: string } | null>(null);

  const showToast = useCallback((type: 'info' | 'success' | 'error', text: string) => {
    setToastMsg({ type, text });
    setTimeout(() => {
      setToastMsg((prev) => (prev?.text === text ? null : prev));
    }, 4500);
  }, []);

  // Persist instances & chat & googleAuth
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_INSTANCES, JSON.stringify(instances));
    } catch {}
  }, [instances]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_CHAT, JSON.stringify(chatMessages.slice(-60)));
    } catch {}
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const handleSaveGoogleAuth = useCallback((next: GoogleAuthConfig) => {
    setGoogleAuth(next);
    saveGoogleAuthConfig(next);
  }, []);

  const mergeDiscoveredModels = useCallback((googleModels: AIModelOption[]) => {
    if (!googleModels || googleModels.length === 0) return;
    setAvailableModels(() => {
      const host = DEFAULT_AI_MODELS[0];
      const custom = DEFAULT_AI_MODELS[DEFAULT_AI_MODELS.length - 1];
      return [host, ...googleModels, custom];
    });
  }, []);

  // Handle Google OAuth #access_token=... callback or ?invite=... deep link on launch
  useEffect(() => {
    const initUrlParams = async () => {
      try {
        const oauth = parseGoogleOAuthHash();
        if (oauth.accessToken) {
          const user = await fetchGoogleUserInfo(oauth.accessToken);
          const nextCfg: GoogleAuthConfig = {
            ...loadGoogleAuthConfig(),
            oauthAccessToken: oauth.accessToken,
            userEmail: user?.email || '',
            userName: user?.name || 'Compte Google',
            userPicture: user?.picture || '',
          };
          handleSaveGoogleAuth(nextCfg);
          const res = await fetchAvailableGoogleModels(nextCfg);
          if (res.models.length > 0) {
            mergeDiscoveredModels(res.models);
            setSelectedModelId(res.models[0].id);
          }
          showToast('success', `Connecté avec Google (${user?.email || 'OAuth2'}) !`);
          window.history.replaceState({}, '', window.location.pathname + window.location.search);
        }

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
          window.history.replaceState({}, '', window.location.pathname);
        }
      } catch {
        // Ignore URL parsing errors
      }
    };
    initUrlParams();
  }, [handleSaveGoogleAuth, mergeDiscoveredModels, showToast]);

  // Refresh available Google models silently on mount if key/token already exists
  useEffect(() => {
    if (googleAuth.apiKey || googleAuth.oauthAccessToken) {
      fetchAvailableGoogleModels(googleAuth).then((res) => {
        if (res.models.length > 0) {
          mergeDiscoveredModels(res.models);
        }
      });
    }
  }, []);

  // Automatic startup update check + popup + optional auto-open native portal
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

      if (!openedUpdatePopup && googleAuth.autoOpenPortalOnLaunch && isNativePortalSupported()) {
        openRemotePortal(
          googleAuth.antigravityPortalUrl || DEFAULT_ANTIGRAVITY_PORTAL_URL,
          'Antigravity Remote'
        );
      }
    };
    startupFlow();
  }, []);

  // Android Hardware Back Button handling
  useEffect(() => {
    let listenerHandle: { remove: () => Promise<void> } | null = null;
    try {
      CapApp.addListener('backButton', ({ canGoBack }) => {
        if (activeConsoleInstance) {
          setActiveConsoleInstance(null);
        } else if (googleModalOpen) {
          setGoogleModalOpen(false);
        } else if (shareModalOpen) {
          setShareModalOpen(false);
        } else if (updateModalOpen) {
          setUpdateModalOpen(false);
        } else if (addModalOpen) {
          setAddModalOpen(false);
        } else if (guideModalOpen) {
          setGuideModalOpen(false);
        } else if (mainView !== 'remote') {
          setMainView('remote');
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
  }, [
    activeConsoleInstance,
    googleModalOpen,
    shareModalOpen,
    updateModalOpen,
    addModalOpen,
    guideModalOpen,
    mainView,
  ]);

  const primaryHostInstance = useMemo(
    () => instances.find((i) => i.type === 'antigravity') || instances[0],
    [instances]
  );

  const selectedModel = useMemo(
    () => availableModels.find((m) => m.id === selectedModelId) || availableModels[0],
    [availableModels, selectedModelId]
  );

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
      const isLocalAgent =
        cleanUrl.includes('localhost') ||
        cleanUrl.includes('127.0.0.1') ||
        Boolean(cleanUrl.match(/:\d{4,5}$/));
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

  const handleLaunchAntigravityPortal = () => {
    const targetUrl = googleAuth.antigravityPortalUrl.trim() || DEFAULT_ANTIGRAVITY_PORTAL_URL;
    const usedNative = openRemotePortal(targetUrl, 'Antigravity Remote');
    if (!usedNative) {
      showToast('info', 'Portail Antigravity ouvert dans un onglet sécurisé.');
    }
  };

  const handleCapturePortalUrl = () => {
    const activeUrl = getCurrentNativePortalUrl();
    if (activeUrl) {
      const next = { ...googleAuth, antigravityPortalUrl: activeUrl };
      handleSaveGoogleAuth(next);
      showToast('success', 'URL de votre session Antigravity mémorisée !');
    } else {
      showToast('info', "Ouvrez d'abord le portail natif dans l'APK pour capturer son URL courante.");
    }
  };

  const handlePastePortalUrl = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text && text.trim().startsWith('http')) {
        handleSaveGoogleAuth({ ...googleAuth, antigravityPortalUrl: text.trim() });
        showToast('success', 'URL collée depuis Firefox / presse-papiers !');
      } else {
        showToast('error', 'Le presse-papiers ne contient pas une URL http/https.');
      }
    } catch {
      showToast('info', 'Collez directement votre URL dans le champ.');
    }
  };

  const handleSendChat = async (e?: React.FormEvent, overrideText?: string) => {
    if (e) e.preventDefault();
    const text = (overrideText !== undefined ? overrideText : chatInput).trim();
    if (!text || chatSending) return;

    const nowTime = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      text,
      timestamp: nowTime,
    };

    const nextHistory = [...chatMessages, userMsg];
    setChatMessages(nextHistory);
    if (overrideText === undefined) setChatInput('');
    setChatSending(true);

    const res = await sendModelChatMessage({
      model: selectedModel,
      messages: nextHistory,
      userText: text,
      googleAuth,
      hostInstance: primaryHostInstance,
    });

    const replyMsg: ChatMessage = {
      id: `a-${Date.now()}`,
      role: 'assistant',
      text: res.reply,
      timestamp: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      modelLabel: selectedModel.label,
      isError: res.error,
    };
    setChatMessages((prev) => [...prev, replyMsg]);
    setChatSending(false);
  };

  const handleLoadLatestHostTranscript = async () => {
    if (!primaryHostInstance) return;
    const cleanUrl = primaryHostInstance.hostUrl.replace(/\/+$/, '');
    try {
      const res = await fetch(`${cleanUrl}/api/transcript`, {
        headers: primaryHostInstance.accessToken
          ? {
              Authorization: `Bearer ${primaryHostInstance.accessToken}`,
              'X-Remotivity-Token': primaryHostInstance.accessToken,
            }
          : {},
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (Array.isArray(data.messages) && data.messages.length > 0) {
        const imported: ChatMessage[] = data.messages.map((m: any, idx: number) => ({
          id: `tr-${Date.now()}-${idx}`,
          role: m.role === 'user' ? 'user' : 'assistant',
          text: String(m.text || ''),
          timestamp: m.time || 'PC',
          modelLabel: `Antigravity (${data.conversationId?.slice(0, 8) || 'PC'})`,
        }));
        setChatMessages(imported);
        showToast('success', `Transcript PC chargé (${imported.length} messages).`);
      } else {
        showToast('info', 'Aucun message récent trouvé dans le transcript Antigravity.');
      }
    } catch {
      showToast('error', "Agent Hôte PC non détecté. Utilisez le Portail Remote ou lancez Start-RemotivityHost.ps1.");
    }
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

  const isGoogleConnected = Boolean(
    googleAuth.userEmail || googleAuth.apiKey.trim() || googleAuth.oauthAccessToken.trim()
  );

  const slashPresets = [
    { label: '/plan', text: '/plan ' },
    { label: '/boost', text: '/boost ' },
    { label: '/goal', text: '/goal ' },
    { label: '📊 Statut Git', text: 'Fais un point sur git status et les modifications récentes.' },
    { label: '🧪 Tests', text: 'Vérifie et lance les tests du projet.' },
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
                Antigravity Remote • Connexion Google & Multi-Modèles
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button
              onClick={() => setGoogleModalOpen(true)}
              className="px-2.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-xs font-bold flex items-center gap-1.5 transition"
              title="Connexion Google & API"
            >
              {googleAuth.userPicture ? (
                <img src={googleAuth.userPicture} alt="" className="w-4 h-4 rounded-full" />
              ) : (
                <IconGoogle size={15} />
              )}
              <span className="hidden sm:inline text-white">
                {googleAuth.userName ? googleAuth.userName.split(' ')[0] : 'Google'}
              </span>
              <span
                className={`w-2 h-2 rounded-full ${
                  isGoogleConnected ? 'bg-emerald-400' : 'bg-cyan-400'
                }`}
              />
            </button>

            <button
              onClick={() => setGuideModalOpen(true)}
              className="p-2.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700/80 text-slate-300 hover:text-white transition"
              title="Guide de connexion"
            >
              <IconBook size={16} />
            </button>

            <button
              onClick={openShareApp}
              className="p-2.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700/80 text-cyan-300 hover:text-white transition"
              title="Partager Remotivity"
            >
              <IconShare size={16} />
            </button>

            <button
              onClick={() => setUpdateModalOpen(true)}
              className="relative p-2.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700/80 text-indigo-300 hover:text-white transition"
              title="Mises à jour"
            >
              <IconSparkles size={16} />
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

        {/* New Update Inline Alert */}
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
                  Touchez ici pour télécharger Remotivity.apk.
                </div>
              </div>
            </div>
            <span className="px-3 py-1 rounded-xl bg-amber-400 text-slate-950 font-black text-[11px] flex-shrink-0">
              Mettre à jour
            </span>
          </button>
        )}

        {/* ==================== VUE 1 : ANTIGRAVITY REMOTE (PRINCIPAL) ==================== */}
        {mainView === 'remote' && (
          <div className="space-y-5">
            {/* Hero Portal Card */}
            <section className="rmv-hero space-y-4">
              <div className="absolute -top-12 -right-12 w-48 h-48 bg-cyan-500/15 rounded-full blur-3xl pointer-events-none" />

              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-cyan-500/15 border border-cyan-500/35 text-cyan-300 text-[11px] font-bold">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span>Antigravity Remote • PC du boulot</span>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                    Pilotez Antigravity comme dans Firefox, en natif.
                  </h2>
                  <p className="text-xs text-slate-300 leading-relaxed max-w-2xl">
                    Ouvre le portail officiel Antigravity Remote en plein écran directement dans l’application Android avec votre compte Google (session et cookies mémorisés, sans blocage WebView).
                  </p>
                </div>
              </div>

              {/* Primary Google Portal Launch CTA */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  onClick={handleLaunchAntigravityPortal}
                  className="py-4 px-5 rounded-2xl bg-gradient-to-r from-cyan-500 via-sky-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-black text-sm flex items-center justify-center gap-2.5 shadow-xl active:scale-[0.98] transition"
                >
                  <span className="p-1.5 rounded-lg bg-white text-slate-950">
                    <IconGoogle size={16} />
                  </span>
                  <span>Lancer Antigravity Remote</span>
                  <IconExternalLink size={16} />
                </button>

                <button
                  onClick={() => setMainView('chat')}
                  className="py-4 px-5 rounded-2xl bg-slate-900/90 hover:bg-slate-800 border border-cyan-500/35 text-cyan-200 font-black text-sm flex items-center justify-center gap-2 shadow-lg active:scale-[0.98] transition"
                >
                  <IconMessage size={18} />
                  <span>Mode Chat Natif (API Google)</span>
                </button>
              </div>

              {/* Direct Session URL Memory Box */}
              <div className="p-3.5 rounded-2xl bg-[#060913]/85 border border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between gap-2 text-[11px]">
                  <span className="font-extrabold uppercase tracking-wider text-cyan-300 flex items-center gap-1.5">
                    <IconGlobe size={13} />
                    <span>URL de votre session Antigravity (depuis Firefox)</span>
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handlePastePortalUrl}
                      className="text-cyan-300 hover:text-white font-bold"
                    >
                      📋 Coller
                    </button>
                    {isNativePortalSupported() && (
                      <button
                        type="button"
                        onClick={handleCapturePortalUrl}
                        className="text-indigo-300 hover:text-white font-bold"
                      >
                        📌 Capturer URL active
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={googleAuth.antigravityPortalUrl}
                    onChange={(e) =>
                      handleSaveGoogleAuth({
                        ...googleAuth,
                        antigravityPortalUrl: e.target.value,
                      })
                    }
                    placeholder="https://antigravity.google"
                    className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-cyan-400"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(
                        googleAuth.antigravityPortalUrl || DEFAULT_ANTIGRAVITY_PORTAL_URL
                      );
                      setCopiedPortal(true);
                      setTimeout(() => setCopiedPortal(false), 1800);
                    }}
                    className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1 flex-shrink-0"
                  >
                    {copiedPortal ? <IconCheck size={14} /> : <IconCopy size={14} />}
                    <span className="hidden sm:inline">{copiedPortal ? 'Copié' : 'Copier'}</span>
                  </button>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <label className="flex items-center gap-2 text-[11px] text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={googleAuth.autoOpenPortalOnLaunch}
                      onChange={(e) =>
                        handleSaveGoogleAuth({
                          ...googleAuth,
                          autoOpenPortalOnLaunch: e.target.checked,
                        })
                      }
                      className="w-4 h-4 accent-cyan-500"
                    />
                    <span>Ouvrir Antigravity Remote automatiquement au lancement de l’appli</span>
                  </label>

                  <button
                    type="button"
                    onClick={() => setGoogleModalOpen(true)}
                    className="text-[11px] font-bold text-cyan-300 hover:text-white flex items-center gap-1"
                  >
                    <IconSettings size={13} />
                    <span>Réglages Google / API</span>
                  </button>
                </div>
              </div>
            </section>

            {/* Quick Google API Status Card */}
            <section className="p-4 rounded-2xl bg-slate-900/75 border border-indigo-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center flex-shrink-0 shadow">
                  <IconGoogle size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white">
                    {isGoogleConnected
                      ? `Compte & API Google actifs${googleAuth.userEmail ? ` (${googleAuth.userEmail})` : ''}`
                      : 'Connecter votre compte / API Google'}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    {isGoogleConnected
                      ? `${availableModels.filter((m) => m.provider === 'google-gemini').length} modèle(s) Google Gemini prêts + adaptateur autres modèles.`
                      : 'Renseignez votre clé API Google ou connectez-vous via OAuth pour piloter en chat natif.'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setGoogleModalOpen(true)}
                className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs flex-shrink-0 transition"
              >
                {isGoogleConnected ? 'Configurer / Modèles' : 'Connecter Google'}
              </button>
            </section>

            {/* Work PC Workspaces Quick Access */}
            <section className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">
                  Vos Projets Antigravity sur le PC du boulot
                </h3>
                <button
                  onClick={() => setMainView('instances')}
                  className="text-[11px] font-bold text-cyan-300 hover:text-white"
                >
                  Voir tous les ponts →
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {WORK_PROJECTS.map((proj) => (
                  <div key={proj.id} className="rmv-card space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-black text-white">📁 {proj.name}</span>
                      <span className="px-2 py-0.5 rounded-full bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 text-[10px] font-bold">
                        {proj.badge}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400">{proj.description}</p>
                    <div className="text-[10px] font-mono text-slate-500 truncate">{proj.path}</div>
                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={handleLaunchAntigravityPortal}
                        className="flex-1 py-2 px-3 rounded-xl bg-cyan-600/20 hover:bg-cyan-600/35 border border-cyan-500/35 text-cyan-200 text-[11px] font-bold transition"
                      >
                        Ouvrir Remote
                      </button>
                      <button
                        onClick={() => {
                          setMainView('chat');
                          setChatInput(`Sur le projet ${proj.name} (${proj.path}), `);
                        }}
                        className="flex-1 py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-bold transition"
                      >
                        💬 Prompter
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}

        {/* ==================== VUE 2 : CHAT NATIF API GOOGLE & MULTI-MODÈLES ==================== */}
        {mainView === 'chat' && (
          <div className="flex flex-col h-[calc(100vh-12.5rem)] min-h-[440px] bg-[#080d1b] border border-cyan-500/30 rounded-3xl overflow-hidden shadow-2xl">
            {/* Model Picker Top Bar */}
            <div className="px-4 py-3 bg-[#0c1326] border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-xs font-black text-cyan-300 whitespace-nowrap">Modèle :</span>
                <select
                  value={selectedModelId}
                  onChange={(e) => setSelectedModelId(e.target.value)}
                  className="flex-1 sm:max-w-xs bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs font-bold text-white focus:outline-none focus:border-cyan-400"
                >
                  {availableModels.map((m) => (
                    <option key={m.id} value={m.id}>
                      [{m.badge}] {m.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleLoadLatestHostTranscript}
                  className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-[11px] font-bold text-cyan-300"
                  title="Importer le dernier transcript depuis votre PC"
                >
                  ↻ Session PC
                </button>
                <button
                  type="button"
                  onClick={() => setGoogleModalOpen(true)}
                  className="px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-[11px] font-bold text-white flex items-center gap-1"
                >
                  <IconGoogle size={13} />
                  <span>API</span>
                </button>
                <button
                  type="button"
                  onClick={handleLaunchAntigravityPortal}
                  className="px-2.5 py-1.5 rounded-xl bg-cyan-600/80 hover:bg-cyan-500 text-[11px] font-bold text-white"
                >
                  Portail
                </button>
              </div>
            </div>

            {/* Messages Feed */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#050811] select-text">
              {chatMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={`rounded-2xl p-3.5 text-xs leading-relaxed border ${
                    msg.role === 'user'
                      ? 'bg-indigo-950/70 border-indigo-400/40 text-white ml-8'
                      : msg.isError
                      ? 'bg-rose-950/40 border-rose-500/40 text-rose-200 mr-4'
                      : 'bg-slate-900/90 border-cyan-500/25 text-slate-100 mr-4'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1 text-[10px] opacity-75">
                    <span className="font-black uppercase tracking-wider text-cyan-300">
                      {msg.role === 'user' ? 'Vous' : msg.modelLabel || 'Assistant'}
                    </span>
                    <span className="font-mono">{msg.timestamp}</span>
                  </div>
                  <div className="whitespace-pre-wrap break-words">{msg.text}</div>
                </div>
              ))}
              {chatSending && (
                <div className="p-3 rounded-2xl bg-slate-900/60 border border-cyan-500/20 text-xs text-cyan-300 animate-pulse mr-10">
                  Réponse en cours via {selectedModel.label}...
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Slash Commands & Quick Prompts */}
            <div className="px-3 py-2 bg-[#0a0f1e] border-t border-slate-800/80 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              {slashPresets.map((sp) => (
                <button
                  key={sp.label}
                  type="button"
                  onClick={() => setChatInput((prev) => `${prev}${sp.text}`)}
                  className="px-2.5 py-1 rounded-xl bg-slate-800/90 hover:bg-cyan-500/20 border border-slate-700 text-[11px] font-mono font-bold text-cyan-200 whitespace-nowrap"
                >
                  {sp.label}
                </button>
              ))}
            </div>

            {/* Input Bar */}
            <form
              onSubmit={(e) => handleSendChat(e)}
              className="p-3 bg-[#0c1326] border-t border-cyan-500/20 flex items-center gap-2"
            >
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                disabled={chatSending}
                placeholder={`Envoyer une instruction à ${selectedModel.label}...`}
                className="flex-1 bg-[#050811] border border-slate-700 focus:border-cyan-400 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none"
              />
              <button
                type="submit"
                disabled={chatSending || !chatInput.trim()}
                className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-black text-xs flex items-center gap-1.5 disabled:opacity-40 active:scale-95 transition"
              >
                <IconSend size={15} />
                <span className="hidden sm:inline">Envoyer</span>
              </button>
            </form>
          </div>
        )}

        {/* ==================== VUE 3 : PONTS, INSTANCES & PARTAGES ==================== */}
        {mainView === 'instances' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-black text-white">
                Instances & Ponts Distants ({instances.length})
              </h2>
              <div className="flex gap-2">
                <button
                  onClick={handlePingAll}
                  disabled={pingingAll}
                  className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-cyan-300 text-xs font-bold flex items-center gap-1.5"
                >
                  <IconRefresh size={14} className={pingingAll ? 'animate-spin' : ''} />
                  <span>Ping tout</span>
                </button>
                <button
                  onClick={() => {
                    setEditingInstance(null);
                    setAddModalOpen(true);
                  }}
                  className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 text-white text-xs font-black flex items-center gap-1.5"
                >
                  <IconPlus size={14} />
                  <span>Ajouter</span>
                </button>
              </div>
            </div>

            <div className="relative">
              <IconSearch size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filtrer par nom, workspace, IP, tag..."
                className="w-full bg-slate-900/80 border border-slate-800 focus:border-cyan-400 rounded-2xl pl-10 pr-4 py-2.5 text-xs text-white focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
              {(
                [
                  { id: 'all', label: `Toutes (${instances.length})` },
                  { id: 'antigravity', label: '🛰️ Antigravity' },
                  { id: 'jules', label: '🤖 Jules' },
                  { id: 'claude', label: '✨ Claude' },
                  { id: 'vscode', label: '💻 VS Code' },
                  { id: 'terminal', label: '⚡ Terminal' },
                  { id: 'favorites', label: '⭐ Favoris' },
                  { id: 'shared', label: '🔗 Partagées' },
                ] as { id: FilterType; label: string }[]
              ).map((chip) => (
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {filteredInstances.map((inst) => {
                const meta = INSTANCE_TYPE_META[inst.type];
                return (
                  <article key={inst.id} className="rmv-card space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2.5 py-1 rounded-xl text-[11px] font-extrabold border flex items-center gap-1 ${meta.badgeClass}`}
                        >
                          <span>{meta.iconEmoji}</span>
                          <span>{meta.shortLabel}</span>
                        </span>
                        <span className="text-[11px] font-bold text-emerald-300 flex items-center gap-1">
                          <span
                            className={`w-2 h-2 rounded-full ${
                              inst.status === 'online'
                                ? 'bg-emerald-400'
                                : inst.status === 'busy'
                                ? 'bg-amber-400'
                                : 'bg-rose-400'
                            }`}
                          />
                          <span>
                            {inst.status === 'online'
                              ? 'En ligne'
                              : inst.status === 'busy'
                              ? 'Prêt'
                              : 'Hors ligne'}
                          </span>
                        </span>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleToggleFavorite(inst.id)}
                          className={`p-1.5 rounded-lg ${
                            inst.isFavorite ? 'text-amber-400' : 'text-slate-500'
                          }`}
                        >
                          <IconStar size={15} filled={inst.isFavorite} />
                        </button>
                        <button
                          onClick={() => handleDeleteInstance(inst.id)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400"
                        >
                          <IconTrash size={15} />
                        </button>
                      </div>
                    </div>

                    <div
                      className="space-y-1 cursor-pointer"
                      onClick={() => setActiveConsoleInstance(inst)}
                    >
                      <h3 className="text-base font-black text-white">{inst.name}</h3>
                      {inst.description && (
                        <p className="text-xs text-slate-400 line-clamp-2">{inst.description}</p>
                      )}
                    </div>

                    <div className="p-2.5 rounded-xl bg-[#060913]/85 border border-slate-800 space-y-1 text-[11px] font-mono">
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

                    {inst.sharedBy && (
                      <div className="px-2.5 py-1 rounded-xl bg-indigo-500/15 border border-indigo-500/35 text-[11px] text-indigo-200 flex items-center justify-between">
                        <span className="flex items-center gap-1 font-bold">
                          <IconShield size={12} />
                          <span>Partagé par {inst.sharedBy}</span>
                        </span>
                        <span>{inst.readOnly ? 'Observation' : 'Contrôle'}</span>
                      </div>
                    )}

                    <div className="flex items-center gap-2 pt-1 mt-auto">
                      <button
                        onClick={() => setActiveConsoleInstance(inst)}
                        className="flex-1 py-2.5 px-3 rounded-xl bg-gradient-to-r from-cyan-600 to-indigo-600 text-white font-black text-xs flex items-center justify-center gap-1.5"
                      >
                        <IconPlay size={12} />
                        <span>Cockpit</span>
                      </button>

                      {inst.webPortalUrl && (
                        <button
                          onClick={() => openRemotePortal(inst.webPortalUrl!, inst.name)}
                          className="px-3 py-2.5 rounded-xl bg-cyan-500/20 border border-cyan-500/35 text-cyan-200 text-xs font-bold"
                        >
                          Portail
                        </button>
                      )}

                      <button
                        onClick={() => openShareInstance(inst)}
                        className="p-2.5 rounded-xl bg-slate-800 border border-slate-700 text-indigo-300"
                        title="Partager"
                      >
                        <IconShare size={15} />
                      </button>

                      <button
                        onClick={() => {
                          setEditingInstance(inst);
                          setAddModalOpen(true);
                        }}
                        className="px-2.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 text-[11px] font-bold"
                      >
                        Éditer
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        )}
      </main>

      {/* Bottom Mobile Navigation */}
      <nav className="rmv-bottom-nav">
        <button
          onClick={() => setMainView('remote')}
          className={`flex flex-col items-center gap-0.5 font-bold transition ${
            mainView === 'remote' ? 'text-cyan-400' : 'text-slate-400 hover:text-white'
          }`}
        >
          <IconGlobe size={19} />
          <span className="text-[10px]">Remote</span>
        </button>

        <button
          onClick={() => setMainView('chat')}
          className={`flex flex-col items-center gap-0.5 font-bold transition ${
            mainView === 'chat' ? 'text-cyan-400' : 'text-slate-400 hover:text-white'
          }`}
        >
          <IconMessage size={19} />
          <span className="text-[10px]">Chat IA</span>
        </button>

        <button
          onClick={() => setMainView('instances')}
          className={`flex flex-col items-center gap-0.5 font-bold transition ${
            mainView === 'instances' ? 'text-cyan-400' : 'text-slate-400 hover:text-white'
          }`}
        >
          <IconServer size={19} />
          <span className="text-[10px]">Ponts</span>
        </button>

        <button
          onClick={openShareApp}
          className="flex flex-col items-center gap-0.5 text-slate-400 hover:text-indigo-300 font-bold transition"
        >
          <IconShare size={19} />
          <span className="text-[10px]">Partager</span>
        </button>

        <button
          onClick={() => setUpdateModalOpen(true)}
          className="relative flex flex-col items-center gap-0.5 text-slate-400 hover:text-amber-300 font-bold transition"
        >
          <IconSparkles size={19} />
          <span className="text-[10px]">MAJ</span>
          {hasNewUpdate && (
            <span className="absolute -top-0.5 right-1 w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
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

      <GoogleAuthModal
        isOpen={googleModalOpen}
        onClose={() => setGoogleModalOpen(false)}
        config={googleAuth}
        onSaveConfig={handleSaveGoogleAuth}
        onModelsDiscovered={mergeDiscoveredModels}
      />
    </div>
  );
}
