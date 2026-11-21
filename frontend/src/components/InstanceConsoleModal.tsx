import { useState, useEffect, useRef } from 'react';
import {
  RemoteInstance,
  TerminalEntry,
  INSTANCE_TYPE_META,
  HostSessionItem,
  HostWorkspaceItem,
  HostProcessItem,
} from '../types/remotivity';
import {
  IconClose,
  IconArrowLeft,
  IconTerminal,
  IconSparkles,
  IconServer,
  IconSend,
  IconShare,
  IconRefresh,
  IconExternalLink,
  IconShield,
  IconCopy,
  IconCheck,
} from './Icons';

interface InstanceConsoleModalProps {
  instance: RemoteInstance | null;
  onClose: () => void;
  onShareInstance: (instance: RemoteInstance) => void;
  onUpdateInstanceStatus: (id: string, status: 'online' | 'busy' | 'offline', pingMs?: number) => void;
}

interface HostStatusData {
  hostname?: string;
  username?: string;
  os?: string;
  ramUsedPct?: number;
  ramFreeGB?: number;
  ramTotalGB?: number;
  workspaceRoot?: string;
  ips?: string[];
  processesCount?: number;
}

export const InstanceConsoleModal = ({
  instance,
  onClose,
  onShareInstance,
  onUpdateInstanceStatus,
}: InstanceConsoleModalProps) => {
  const [tab, setTab] = useState<'prompt' | 'terminal' | 'sessions'>('prompt');
  const [inputText, setInputText] = useState('');
  const [busy, setBusy] = useState(false);
  const [cwd, setCwd] = useState('');
  const [entries, setEntries] = useState<TerminalEntry[]>([]);
  const [hostStatus, setHostStatus] = useState<HostStatusData | null>(null);
  const [hostSessions, setHostSessions] = useState<HostSessionItem[]>([]);
  const [hostWorkspaces, setHostWorkspaces] = useState<HostWorkspaceItem[]>([]);
  const [hostProcesses, setHostProcesses] = useState<HostProcessItem[]>([]);
  const [hostReachable, setHostReachable] = useState<boolean | null>(null);
  const [copiedCmd, setCopiedCmd] = useState(false);

  const logEndRef = useRef<HTMLDivElement | null>(null);

  const storageKey = instance ? `rmv_logs_${instance.id}` : '';

  useEffect(() => {
    if (!instance) return;
    setCwd(instance.workspace || '');
    setTab(instance.type === 'terminal' ? 'terminal' : 'prompt');
    try {
      const saved = localStorage.getItem(`rmv_logs_${instance.id}`);
      if (saved) {
        setEntries(JSON.parse(saved));
      } else {
        setEntries([
          {
            id: 'init-1',
            timestamp: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            kind: 'system',
            text: `Cockpit initialisé pour « ${instance.name} » (${INSTANCE_TYPE_META[instance.type].label}) • Cible : ${instance.hostUrl}`,
          },
        ]);
      }
    } catch {
      setEntries([]);
    }
    probeHost(instance);
  }, [instance?.id]);

  useEffect(() => {
    if (storageKey && entries.length > 0) {
      try {
        localStorage.setItem(storageKey, JSON.stringify(entries.slice(-80)));
      } catch {
        // Ignore storage quota errors
      }
    }
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [entries, storageKey]);

  if (!instance) return null;

  const meta = INSTANCE_TYPE_META[instance.type];
  const baseUrl = instance.hostUrl.replace(/\/+$/, '');
  const authHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(instance.accessToken
      ? {
          Authorization: `Bearer ${instance.accessToken}`,
          'X-Remotivity-Token': instance.accessToken,
        }
      : {}),
  };

  const appendEntry = (kind: TerminalEntry['kind'], text: string, durationMs?: number) => {
    setEntries((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        timestamp: new Date().toLocaleTimeString('fr-FR', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }),
        kind,
        text,
        durationMs,
      },
    ]);
  };

  async function probeHost(target: RemoteInstance) {
    const cleanUrl = target.hostUrl.replace(/\/+$/, '');
    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      setHostReachable(false);
      return;
    }

    const start = performance.now();
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3500);
      const res = await fetch(`${cleanUrl}/api/status`, {
        headers: target.accessToken
          ? {
              Authorization: `Bearer ${target.accessToken}`,
              'X-Remotivity-Token': target.accessToken,
            }
          : {},
        signal: controller.signal,
      });
      clearTimeout(timeout);
      const ping = Math.round(performance.now() - start);

      if (res.ok) {
        const data = await res.json();
        setHostStatus(data);
        setHostReachable(true);
        onUpdateInstanceStatus(target.id, 'online', ping);

        // Also fetch sessions
        try {
          const sRes = await fetch(`${cleanUrl}/api/sessions`, {
            headers: target.accessToken
              ? {
                  Authorization: `Bearer ${target.accessToken}`,
                  'X-Remotivity-Token': target.accessToken,
                }
              : {},
          });
          if (sRes.ok) {
            const sData = await sRes.json();
            setHostSessions(sData.sessions || []);
            setHostWorkspaces(sData.workspaces || []);
            setHostProcesses(sData.processes || []);
          }
        } catch {
          // Optional sessions fetch
        }
      } else {
        setHostReachable(false);
        if (res.status === 401) {
          appendEntry('error', 'Hôte détecté mais jeton d’accès invalide ou manquant (HTTP 401).');
        }
      }
    } catch {
      setHostReachable(false);
    }
  }

  const executeRemoteCommand = async (cmdText: string) => {
    if (instance.readOnly) {
      appendEntry('error', 'Action bloquée : cette instance est en mode Lecture seule (Observation).');
      return;
    }
    const clean = cmdText.trim();
    if (!clean) return;

    appendEntry('command', clean);
    setBusy(true);

    try {
      const res = await fetch(`${baseUrl}/api/exec`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ command: clean, cwd }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP ${res.status}`);
      }

      const data = await res.json();
      setHostReachable(true);
      const combined = [data.stdout, data.stderr].filter(Boolean).join('\n').trim();
      appendEntry(
        data.exitCode && data.exitCode !== 0 ? 'error' : 'output',
        combined || `(Commande exécutée avec le code ${data.exitCode ?? 0})`,
        data.durationMs
      );
    } catch (e: any) {
      if (instance.isDemo) {
        appendEntry(
          'output',
          `[Aperçu Démo] Simulation de « ${clean} » sur ${instance.workspace} :\n• Statut : OK\n• Démarrez host-agent/Start-RemotivityHost.ps1 pour une exécution réelle sur votre PC.`,
          18
        );
      } else {
        appendEntry(
          'error',
          `Hôte injoignable (${e?.message || 'Réseau'}). Assurez-vous que Start-RemotivityHost.ps1 tourne sur ${baseUrl}.`
        );
      }
    } finally {
      setBusy(false);
    }
  };

  const sendRemotePrompt = async (promptText: string) => {
    if (instance.readOnly) {
      appendEntry('error', 'Envoi de prompt bloqué : instance partagée en mode Lecture seule.');
      return;
    }
    const clean = promptText.trim();
    if (!clean) return;

    appendEntry('prompt', clean);
    setBusy(true);

    try {
      const res = await fetch(`${baseUrl}/api/prompt`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          prompt: clean,
          agent: instance.type,
          cwd,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP ${res.status}`);
      }

      const data = await res.json();
      setHostReachable(true);
      appendEntry('ai-reply', data.reply || 'Instruction transmise à l’agent distant.');
    } catch (e: any) {
      if (instance.isDemo) {
        appendEntry(
          'ai-reply',
          `[Aperçu ${meta.shortLabel}] Instruction reçue : « ${clean} ».\nPour exécuter directement sur votre machine, connectez l'Agent Hôte Remotivity ou ouvrez le portail web associé.`
        );
      } else {
        appendEntry(
          'error',
          `Impossible de joindre l'agent (${e?.message || 'Hors ligne'}).`
        );
      }
    } finally {
      setBusy(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || busy) return;
    const text = inputText;
    setInputText('');
    if (tab === 'terminal') {
      executeRemoteCommand(text);
    } else {
      sendRemotePrompt(text);
    }
  };

  const quickActions =
    tab === 'terminal'
      ? [
          { label: 'git status', cmd: 'git status -sb' },
          { label: 'Lister fichiers', cmd: 'Get-ChildItem | Select-Object Name, LastWriteTime' },
          { label: 'Processus IA/Dev', cmd: 'Get-Process | Where-Object {$_.ProcessName -match "Antigravity|Code|node|claude"} | Select ProcessName, Id' },
          { label: 'IP & Hôte', cmd: 'hostname; (Get-NetIPAddress -AddressFamily IPv4 | Where-Object {$_.IPAddress -ne "127.0.0.1"}).IPAddress' },
        ]
      : [
          { label: '📊 Statut du projet', cmd: 'Analyse l’état actuel du workspace et résume les modifications récentes.' },
          { label: '🧪 Lancer les tests', cmd: 'Exécute la suite de tests et rapporte les éventuelles erreurs.' },
          { label: '🚀 Build & Push', cmd: 'Compile le projet, vérifie les erreurs TypeScript et prépare un commit propre.' },
          { label: '📝 Résumer la session', cmd: 'Fais un point synthétique sur la session en cours et les prochaines étapes.' },
        ];

  const hostStartCommand = 'powershell -ExecutionPolicy Bypass -File .\\host-agent\\Start-RemotivityHost.ps1 -BindAll';

  const handleCopyAgentCmd = () => {
    navigator.clipboard.writeText(hostStartCommand);
    setCopiedCmd(true);
    setTimeout(() => setCopiedCmd(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/85 backdrop-blur-md text-white">
      <div className="fixed inset-0" onClick={onClose} />

      <div className="relative w-full max-w-2xl h-[94vh] sm:h-[88vh] bg-[#070b17] border border-cyan-500/40 rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col z-10">
        {/* Top Bar */}
        <div className="px-4 py-3.5 border-b border-cyan-500/20 bg-gradient-to-r from-[#0d1629] via-[#0a1120] to-[#060913] flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-cyan-200 hover:text-white transition flex-shrink-0"
              title="Retour"
            >
              <IconArrowLeft size={18} />
            </button>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-base">{meta.iconEmoji}</span>
                <h2 className="text-sm sm:text-base font-black text-white truncate">
                  {instance.name}
                </h2>
                {instance.readOnly && (
                  <span className="px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/35 text-amber-300 text-[10px] font-bold flex-shrink-0">
                    Lecture seule
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono truncate">
                <span
                  className={`inline-block w-2 h-2 rounded-full ${
                    hostReachable
                      ? 'bg-emerald-400 animate-pulse'
                      : hostReachable === false
                      ? 'bg-amber-400'
                      : 'bg-slate-500'
                  }`}
                />
                <span className="truncate">{instance.hostUrl}</span>
                {instance.lastPingMs !== undefined && (
                  <span className="text-cyan-400 flex-shrink-0">• {instance.lastPingMs}ms</span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button
              onClick={() => probeHost(instance)}
              className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-cyan-300 transition"
              title="Tester la connexion hôte"
            >
              <IconRefresh size={16} />
            </button>
            <button
              onClick={() => onShareInstance(instance)}
              className="px-2.5 py-2 rounded-xl bg-indigo-600/80 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1 transition"
              title="Partager cette instance"
            >
              <IconShare size={15} />
              <span className="hidden sm:inline">Partager</span>
            </button>
            {(instance.webPortalUrl || instance.hostUrl.startsWith('https://')) && (
              <a
                href={instance.webPortalUrl || instance.hostUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 transition"
                title="Ouvrir l’interface Web"
              >
                <IconExternalLink size={16} />
              </a>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition"
              title="Fermer"
            >
              <IconClose size={18} />
            </button>
          </div>
        </div>

        {/* Cockpit Sub-Tabs */}
        <div className="px-4 py-2.5 bg-[#090e1c] border-b border-slate-800/80 flex items-center gap-2 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setTab('prompt')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition flex-shrink-0 ${
              tab === 'prompt'
                ? 'bg-gradient-to-r from-cyan-500 to-indigo-600 text-white shadow'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <IconSparkles size={14} />
            <span>Prompt Agent IA</span>
          </button>

          <button
            onClick={() => setTab('terminal')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition flex-shrink-0 ${
              tab === 'terminal'
                ? 'bg-gradient-to-r from-cyan-500 to-emerald-600 text-white shadow'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <IconTerminal size={14} />
            <span>Terminal Distant</span>
          </button>

          <button
            onClick={() => setTab('sessions')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition flex-shrink-0 ${
              tab === 'sessions'
                ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <IconServer size={14} />
            <span>Sessions & Hôte</span>
          </button>
        </div>

        {/* Body */}
        {tab === 'sessions' ? (
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Host Status Card */}
            <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black uppercase tracking-wider text-cyan-300">
                  État de la machine hôte
                </h3>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                    hostReachable
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/35'
                      : 'bg-amber-500/15 text-amber-300 border border-amber-500/35'
                  }`}
                >
                  {hostReachable ? 'Agent Hôte Connecté' : 'Agent Hôte Non Détecté'}
                </span>
              </div>

              {hostReachable && hostStatus ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
                  <div className="p-2.5 rounded-xl bg-[#060913] border border-slate-800">
                    <div className="text-[10px] text-slate-400 uppercase">Machine</div>
                    <div className="font-bold text-white truncate">{hostStatus.hostname}</div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-[#060913] border border-slate-800">
                    <div className="text-[10px] text-slate-400 uppercase">Mémoire RAM</div>
                    <div className="font-bold text-cyan-300">
                      {hostStatus.ramUsedPct}% utilisée ({hostStatus.ramFreeGB} Go libres)
                    </div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-[#060913] border border-slate-800 col-span-2 sm:col-span-1">
                    <div className="text-[10px] text-slate-400 uppercase">Processus Dev</div>
                    <div className="font-bold text-emerald-300">{hostStatus.processesCount || 0} actifs</div>
                  </div>
                </div>
              ) : (
                <div className="space-y-2 text-xs text-slate-300">
                  <p>
                    Pour piloter ce PC en direct depuis votre smartphone ou navigateur, exécutez l’agent compagnon sans installation :
                  </p>
                  <div className="p-2.5 rounded-xl bg-[#060913] border border-slate-800 flex items-center justify-between gap-2">
                    <code className="text-[11px] text-cyan-300 font-mono overflow-x-auto whitespace-nowrap">
                      {hostStartCommand}
                    </code>
                    <button
                      onClick={handleCopyAgentCmd}
                      className="px-2.5 py-1 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-[11px] flex items-center gap-1 flex-shrink-0"
                    >
                      {copiedCmd ? <IconCheck size={12} /> : <IconCopy size={12} />}
                      <span>{copiedCmd ? 'Copié' : 'Copier'}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Active AI / Dev Workspaces */}
            {hostWorkspaces.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 px-1">
                  Workspaces détectés ({hostWorkspaces.length})
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {hostWorkspaces.map((ws) => (
                    <button
                      key={ws.path}
                      onClick={() => {
                        setCwd(ws.path);
                        setTab('terminal');
                        appendEntry('system', `Répertoire de travail basculé vers : ${ws.path}`);
                      }}
                      className={`p-3 rounded-2xl border text-left transition ${
                        cwd === ws.path
                          ? 'bg-cyan-950/50 border-cyan-400'
                          : 'bg-slate-900/70 border-slate-800 hover:border-cyan-500/40'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-extrabold text-white truncate">
                          📁 {ws.name}
                        </span>
                        {ws.hasGit && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 font-mono">
                            git
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono truncate mt-1">
                        {ws.path}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Antigravity Sessions */}
            {hostSessions.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 px-1">
                  Sessions Antigravity récentes ({hostSessions.length})
                </h3>
                <div className="space-y-2">
                  {hostSessions.map((sess) => (
                    <div
                      key={sess.id}
                      className="p-3 rounded-2xl bg-slate-900/70 border border-slate-800 flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-mono font-bold text-cyan-300 truncate">
                          {sess.id}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          Maj : {sess.lastUpdated} • {sess.artifacts.length} artefact(s)
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setTab('prompt');
                          setInputText(`Reprends ou résume la session Antigravity ${sess.id}`);
                        }}
                        className="px-2.5 py-1.5 rounded-lg bg-indigo-600/80 hover:bg-indigo-500 text-white text-[11px] font-bold flex-shrink-0"
                      >
                        Cibler
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Running Processes */}
            {hostProcesses.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 px-1">
                  Processus actifs sur l’hôte
                </h3>
                <div className="bg-slate-900/70 border border-slate-800 rounded-2xl divide-y divide-slate-800/70">
                  {hostProcesses.slice(0, 10).map((p) => (
                    <div key={`${p.ProcessName}-${p.Id}`} className="px-3 py-2 flex items-center justify-between text-xs">
                      <div className="min-w-0">
                        <span className="font-bold text-white">{p.ProcessName}</span>
                        {p.MainWindowTitle && (
                          <span className="text-slate-400 ml-2 truncate text-[11px]">
                            — {p.MainWindowTitle}
                          </span>
                        )}
                      </div>
                      <span className="font-mono text-[11px] text-cyan-300 flex-shrink-0">
                        {p.MemoryMB} Mo
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Workspace & ReadOnly Bar */}
            <div className="px-4 py-2 bg-[#060913] border-b border-slate-800/70 flex items-center justify-between gap-2 text-[11px]">
              <div className="flex items-center gap-1.5 min-w-0 text-slate-400 font-mono">
                <span className="text-cyan-400 font-bold">CWD:</span>
                <span className="truncate">{cwd || '~'}</span>
              </div>
              {instance.readOnly && (
                <span className="flex items-center gap-1 text-amber-300 font-bold flex-shrink-0">
                  <IconShield size={12} />
                  <span>Lecture seule</span>
                </span>
              )}
            </div>

            {/* Output / Conversation Feed */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#050811] select-text">
              {entries.map((entry) => (
                <div
                  key={entry.id}
                  className={`rounded-2xl p-3 text-xs leading-relaxed border ${
                    entry.kind === 'command'
                      ? 'bg-slate-900/90 border-cyan-500/35 text-cyan-200 font-mono'
                      : entry.kind === 'prompt'
                      ? 'bg-indigo-950/60 border-indigo-400/40 text-white ml-6'
                      : entry.kind === 'ai-reply'
                      ? 'bg-slate-900/90 border-emerald-500/35 text-slate-100 mr-4'
                      : entry.kind === 'error'
                      ? 'bg-rose-950/40 border-rose-500/40 text-rose-200 font-mono'
                      : entry.kind === 'system'
                      ? 'bg-slate-900/40 border-slate-800 text-slate-400 text-[11px]'
                      : 'bg-black/60 border-slate-800 text-emerald-200 font-mono'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1 opacity-75 text-[10px]">
                    <span className="font-bold uppercase tracking-wider">
                      {entry.kind === 'command'
                        ? '$ Commande'
                        : entry.kind === 'prompt'
                        ? 'Vous → Agent'
                        : entry.kind === 'ai-reply'
                        ? `${meta.shortLabel}`
                        : entry.kind === 'error'
                        ? 'Erreur'
                        : entry.kind === 'system'
                        ? 'Système'
                        : 'Sortie'}
                    </span>
                    <span className="font-mono">
                      {entry.timestamp}
                      {entry.durationMs !== undefined ? ` • ${entry.durationMs}ms` : ''}
                    </span>
                  </div>
                  <pre className="whitespace-pre-wrap break-words font-inherit m-0">{entry.text}</pre>
                </div>
              ))}
              <div ref={logEndRef} />
            </div>

            {/* Quick Action Chips */}
            <div className="px-4 py-2 bg-[#090e1c] border-t border-slate-800/70 flex items-center gap-2 overflow-x-auto no-scrollbar">
              {quickActions.map((qa) => (
                <button
                  key={qa.label}
                  type="button"
                  disabled={busy || instance.readOnly}
                  onClick={() =>
                    tab === 'terminal' ? executeRemoteCommand(qa.cmd) : sendRemotePrompt(qa.cmd)
                  }
                  className="px-3 py-1.5 rounded-xl bg-slate-800/85 hover:bg-cyan-500/20 border border-slate-700 hover:border-cyan-400/50 text-[11px] font-bold text-slate-200 whitespace-nowrap transition disabled:opacity-40"
                >
                  {qa.label}
                </button>
              ))}
            </div>

            {/* Command / Prompt Input Bar */}
            <form
              onSubmit={handleSubmit}
              className="p-3 bg-[#0a0f1e] border-t border-cyan-500/25 flex items-center gap-2 pb-[max(0.75rem,env(safe-area-inset-bottom,12px))]"
            >
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                disabled={busy || instance.readOnly}
                placeholder={
                  instance.readOnly
                    ? 'Instance en lecture seule...'
                    : tab === 'terminal'
                    ? 'Commande PowerShell / Shell distante...'
                    : `Envoyer un prompt à ${meta.shortLabel}...`
                }
                className={`flex-1 bg-[#050811] border border-slate-700 focus:border-cyan-400 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none ${
                  tab === 'terminal' ? 'font-mono' : ''
                }`}
              />
              <button
                type="submit"
                disabled={busy || !inputText.trim() || instance.readOnly}
                className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-black text-xs flex items-center gap-1.5 transition disabled:opacity-40 active:scale-95"
              >
                <IconSend size={15} />
                <span className="hidden sm:inline">{busy ? 'Envoi...' : 'Exécuter'}</span>
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
};
