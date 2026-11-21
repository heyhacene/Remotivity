import { useState, useEffect } from 'react';
import {
  RemoteInstance,
  InstanceType,
  INSTANCE_TYPE_META,
} from '../types/remotivity';
import {
  IconClose,
  IconArrowLeft,
  IconPlus,
  IconCheck,
  IconCopy,
  IconKey,
} from './Icons';

interface AddInstanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (instance: RemoteInstance) => void;
  editingInstance?: RemoteInstance | null;
}

export const AddInstanceModal = ({
  isOpen,
  onClose,
  onSave,
  editingInstance = null,
}: AddInstanceModalProps) => {
  const [name, setName] = useState('');
  const [type, setType] = useState<InstanceType>('antigravity');
  const [hostUrl, setHostUrl] = useState('http://localhost:7890');
  const [webPortalUrl, setWebPortalUrl] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [workspace, setWorkspace] = useState('C:\\Users\\HO791592\\Remotivity');
  const [tagsRaw, setTagsRaw] = useState('Antigravity, Tailscale');
  const [description, setDescription] = useState('');
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [testing, setTesting] = useState(false);
  const [copiedPs, setCopiedPs] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (editingInstance) {
        setName(editingInstance.name);
        setType(editingInstance.type);
        setHostUrl(editingInstance.hostUrl);
        setWebPortalUrl(editingInstance.webPortalUrl || '');
        setAccessToken(editingInstance.accessToken || '');
        setWorkspace(editingInstance.workspace);
        setTagsRaw(editingInstance.tags.join(', '));
        setDescription(editingInstance.description || '');
      } else {
        setName('');
        setType('antigravity');
        setHostUrl('http://localhost:7890');
        setWebPortalUrl('');
        setAccessToken('');
        setWorkspace('C:\\Users\\HO791592\\Remotivity');
        setTagsRaw('Agent Hôte, Distant');
        setDescription('');
      }
      setTestResult(null);
    }
  }, [isOpen, editingInstance]);

  if (!isOpen) return null;

  const psCmd = 'powershell -ExecutionPolicy Bypass -File .\\host-agent\\Start-RemotivityHost.ps1 -BindAll';

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    const cleanUrl = hostUrl.trim().replace(/\/+$/, '');
    const t0 = performance.now();
    try {
      const res = await fetch(`${cleanUrl}/api/status`, {
        headers: accessToken
          ? {
              Authorization: `Bearer ${accessToken}`,
              'X-Remotivity-Token': accessToken,
            }
          : {},
      });
      const ping = Math.round(performance.now() - t0);
      if (res.ok) {
        const data = await res.json();
        setTestResult({
          ok: true,
          msg: `Connexion réussie (${ping}ms) • Hôte : ${data.hostname} (${data.ramUsedPct}% RAM)`,
        });
      } else if (res.status === 401) {
        setTestResult({
          ok: false,
          msg: 'Agent trouvé, mais jeton d’accès invalide (HTTP 401).',
        });
      } else {
        setTestResult({ ok: false, msg: `Réponse HTTP ${res.status}` });
      }
    } catch {
      setTestResult({
        ok: false,
        msg: 'Impossible de joindre cet hôte depuis cet appareil (vérifiez l’IP / tunnel / agent lancé).',
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !hostUrl.trim()) return;

    const tags = tagsRaw
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    const saved: RemoteInstance = {
      id: editingInstance?.id || `inst-${Date.now()}`,
      name: name.trim(),
      type,
      hostUrl: hostUrl.trim().replace(/\/+$/, ''),
      webPortalUrl: webPortalUrl.trim() || undefined,
      accessToken: accessToken.trim() || undefined,
      workspace: workspace.trim() || '~',
      status: testResult?.ok ? 'online' : editingInstance?.status || 'online',
      tags: tags.length > 0 ? tags : [INSTANCE_TYPE_META[type].shortLabel],
      isFavorite: editingInstance?.isFavorite || false,
      lastPingMs: editingInstance?.lastPingMs,
      lastActive: 'Configuré à l’instant',
      isDemo: false,
      description: description.trim() || undefined,
      sharedBy: editingInstance?.sharedBy,
      readOnly: editingInstance?.readOnly,
      expiresAt: editingInstance?.expiresAt,
    };

    onSave(saved);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[105] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/85 backdrop-blur-md text-white">
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
            <div>
              <h2 className="text-base font-black text-white">
                {editingInstance ? 'Modifier l’instance' : 'Nouvelle Instance Distante'}
              </h2>
              <p className="text-[11px] text-slate-400">
                Antigravity, Claude Code, Jules, VS Code ou Terminal
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white"
          >
            <IconClose size={20} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="overflow-y-auto px-5 py-4 space-y-4 flex-1">
          {/* Type pills */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-cyan-300 mb-1.5">
              Type d’instance
            </label>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
              {(Object.keys(INSTANCE_TYPE_META) as InstanceType[]).map((t) => {
                const m = INSTANCE_TYPE_META[t];
                const active = type === t;
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setType(t)}
                    className={`p-2 rounded-xl border text-center transition ${
                      active
                        ? 'bg-cyan-500/20 border-cyan-400 text-white font-black'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <div className="text-base">{m.iconEmoji}</div>
                    <div className="text-[10px] mt-0.5 truncate">{m.shortLabel}</div>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              Nom de l’instance *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Mon PC Bureau • Antigravity"
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-400"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              URL de l’hôte / Agent / Tunnel *
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                required
                value={hostUrl}
                onChange={(e) => setHostUrl(e.target.value)}
                placeholder="http://192.168.1.42:7890 ou https://mon-tunnel.trycloudflare.com"
                className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-xs font-mono text-white focus:outline-none focus:border-cyan-400"
              />
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={testing}
                className="px-3 py-2 rounded-xl bg-cyan-600/80 hover:bg-cyan-500 text-white text-xs font-bold flex-shrink-0"
              >
                {testing ? '...' : 'Tester'}
              </button>
            </div>
            {testResult && (
              <p
                className={`mt-1.5 text-[11px] font-semibold ${
                  testResult.ok ? 'text-emerald-400' : 'text-amber-300'
                }`}
              >
                {testResult.msg}
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1 flex items-center gap-1">
                <IconKey size={12} />
                <span>Jeton d’accès (Token)</span>
              </label>
              <input
                type="text"
                value={accessToken}
                onChange={(e) => setAccessToken(e.target.value)}
                placeholder="rmv_..."
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-xs font-mono text-white focus:outline-none focus:border-cyan-400"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                Workspace par défaut
              </label>
              <input
                type="text"
                value={workspace}
                onChange={(e) => setWorkspace(e.target.value)}
                placeholder="C:\Users\...\projet"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-xs font-mono text-white focus:outline-none focus:border-cyan-400"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              URL Portail Web direct (optionnel)
            </label>
            <input
              type="text"
              value={webPortalUrl}
              onChange={(e) => setWebPortalUrl(e.target.value)}
              placeholder="https://vscode.dev ou https://jules.google.com"
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-xs font-mono text-white focus:outline-none focus:border-cyan-400"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              Étiquettes (séparées par des virgules)
            </label>
            <input
              type="text"
              value={tagsRaw}
              onChange={(e) => setTagsRaw(e.target.value)}
              placeholder="Tailscale, Prod, IA"
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-400"
            />
          </div>

          {/* Quick Pairing Helper */}
          <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-indigo-500/30 space-y-2">
            <div className="text-xs font-extrabold text-indigo-300">
              ⚡ Appairage rapide avec votre PC Windows
            </div>
            <p className="text-[11px] text-slate-400">
              Lancez cette commande dans votre dossier Remotivity sur PC pour obtenir immédiatement l’IP et le lien d’import :
            </p>
            <div className="p-2 rounded-xl bg-[#060913] border border-slate-800 flex items-center justify-between gap-2">
              <code className="text-[10px] text-cyan-300 font-mono truncate">{psCmd}</code>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(psCmd);
                  setCopiedPs(true);
                  setTimeout(() => setCopiedPs(false), 1800);
                }}
                className="px-2 py-1 rounded-lg bg-slate-800 text-cyan-300 text-[10px] font-bold flex items-center gap-1 flex-shrink-0"
              >
                {copiedPs ? <IconCheck size={12} /> : <IconCopy size={12} />}
                <span>{copiedPs ? 'Copié' : 'Copier'}</span>
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg active:scale-98"
          >
            <IconPlus size={16} />
            <span>{editingInstance ? 'Enregistrer les modifications' : 'Ajouter cette instance'}</span>
          </button>
        </form>
      </div>
    </div>
  );
};
