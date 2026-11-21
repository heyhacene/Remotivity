import { useState, useEffect, useMemo } from 'react';
import {
  RemoteInstance,
  GITHUB_APK_URL,
  GITHUB_RELEASES_URL,
  PWA_PUBLIC_URL,
  INSTANCE_TYPE_META,
  encodeInstanceInvite,
  decodeInstanceInvite,
} from '../types/remotivity';
import { QRCodeSVG } from './QRCodeSVG';
import {
  IconClose,
  IconArrowLeft,
  IconShare,
  IconCopy,
  IconCheck,
  IconTelegram,
  IconTwitter,
  IconExternalLink,
  IconShield,
  IconQrCode,
  IconDownload,
} from './Icons';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  instances: RemoteInstance[];
  initialTab?: 'app' | 'instance';
  preselectedInstanceId?: string | null;
  onImportInstance: (instance: RemoteInstance) => void;
}

export const ShareModal = ({
  isOpen,
  onClose,
  instances,
  initialTab = 'app',
  preselectedInstanceId = null,
  onImportInstance,
}: ShareModalProps) => {
  const [activeTab, setActiveTab] = useState<'app' | 'instance'>(initialTab);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Instance sharing options
  const [selectedId, setSelectedId] = useState<string>(
    preselectedInstanceId || instances[0]?.id || ''
  );
  const [readOnly, setReadOnly] = useState<boolean>(true);
  const [durationHours, setDurationHours] = useState<number | null>(24);
  const [sharedBy, setSharedBy] = useState<string>('heyhacene');

  // Import invite input
  const [inviteInput, setInviteInput] = useState<string>('');
  const [importFeedback, setImportFeedback] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      if (preselectedInstanceId) {
        setSelectedId(preselectedInstanceId);
      } else if (!selectedId && instances.length > 0) {
        setSelectedId(instances[0].id);
      }
      setImportFeedback(null);
    }
  }, [isOpen, initialTab, preselectedInstanceId, instances, selectedId]);

  const selectedInstance = useMemo(
    () => instances.find((i) => i.id === selectedId) || instances[0] || null,
    [instances, selectedId]
  );

  const inviteCode = useMemo(() => {
    if (!selectedInstance) return '';
    return encodeInstanceInvite(selectedInstance, {
      readOnly,
      durationHours,
      sharedBy,
    });
  }, [selectedInstance, readOnly, durationHours, sharedBy]);

  const inviteUrl = inviteCode ? `${PWA_PUBLIC_URL}?invite=${inviteCode}` : PWA_PUBLIC_URL;

  if (!isOpen) return null;

  const appDownloadPageUrl = GITHUB_RELEASES_URL + '/latest';
  const shareAppText =
    "Découvrez Remotivity : l'application mobile & web pour accéder à vos instances Antigravity, Claude Code, Jules et terminaux à distance !";
  const fullAppShareMsg = `${shareAppText} ${appDownloadPageUrl}`;

  const handleCopy = (key: string, value: string) => {
    navigator.clipboard.writeText(value);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2200);
  };

  const handleNativeShare = async (title: string, text: string, url: string, fallbackKey: string) => {
    if (navigator.share) {
      try {
        await navigator.share({ title, text, url });
        return;
      } catch {
        // User cancelled or unsupported
      }
    }
    handleCopy(fallbackKey, url);
  };

  const handleImportSubmit = () => {
    const res = decodeInstanceInvite(inviteInput);
    if (!res.payload) {
      setImportFeedback({ type: 'error', text: res.error || 'Invitation invalide.' });
      return;
    }

    const p = res.payload;
    const newInst: RemoteInstance = {
      id: `shared-${Date.now()}`,
      name: p.name,
      type: p.type || 'antigravity',
      hostUrl: p.hostUrl,
      webPortalUrl: p.webPortalUrl,
      accessToken: p.accessToken,
      workspace: p.workspace || '~',
      status: 'online',
      tags: ['Partagé', p.readOnly ? 'Lecture seule' : 'Contrôle complet'],
      isFavorite: false,
      lastActive: 'Importé à l’instant',
      sharedBy: p.sharedBy || 'Contact',
      expiresAt: p.expiresAt,
      readOnly: p.readOnly,
      description: `Instance partagée par ${p.sharedBy || 'un pair'}${p.readOnly ? ' (Observation)' : ' (Contrôle actif)'}.`,
    };

    onImportInstance(newInst);
    setInviteInput('');
    setImportFeedback({
      type: 'success',
      text: `Instance « ${newInst.name} » ajoutée à votre tableau de bord !`,
    });
  };

  const shareChannels = [
    {
      name: 'WhatsApp',
      icon: '💬',
      url: `https://api.whatsapp.com/send?text=${encodeURIComponent(fullAppShareMsg)}`,
      color: 'bg-emerald-600 hover:bg-emerald-500 text-white',
    },
    {
      name: 'Telegram',
      icon: <IconTelegram size={15} />,
      url: `https://t.me/share/url?url=${encodeURIComponent(appDownloadPageUrl)}&text=${encodeURIComponent(shareAppText)}`,
      color: 'bg-sky-600 hover:bg-sky-500 text-white',
    },
    {
      name: 'X (Twitter)',
      icon: <IconTwitter size={15} />,
      url: `https://twitter.com/intent/tweet?text=${encodeURIComponent(fullAppShareMsg)}`,
      color: 'bg-slate-800 hover:bg-slate-700 text-white border border-slate-600',
    },
    {
      name: 'SMS',
      icon: '✉️',
      url: `sms:?body=${encodeURIComponent(fullAppShareMsg)}`,
      color: 'bg-cyan-800 hover:bg-cyan-700 text-white',
    },
    {
      name: 'E-mail',
      icon: '📧',
      url: `mailto:?subject=${encodeURIComponent('Application Remotivity')}&body=${encodeURIComponent(fullAppShareMsg)}`,
      color: 'bg-indigo-700 hover:bg-indigo-600 text-white',
    },
  ];

  return (
    <div className="fixed inset-0 z-[105] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/85 backdrop-blur-md text-white">
      <div className="fixed inset-0" onClick={onClose} />

      <div className="relative w-full max-w-lg max-h-[93vh] sm:max-h-[88vh] bg-[#0a0f1e] border border-cyan-500/40 rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col z-10">
        {/* Sticky Header */}
        <div className="sticky top-0 z-20 px-5 py-4 border-b border-cyan-500/20 flex items-center justify-between bg-gradient-to-r from-[#0e172a] via-[#0a1122] to-[#060913]">
          <div className="flex items-center gap-2.5">
            <button
              onClick={onClose}
              className="px-2.5 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-cyan-200 hover:text-white flex items-center gap-1.5 text-xs font-bold transition-all active:scale-95"
            >
              <IconArrowLeft size={16} />
              <span>Retour</span>
            </button>
            <div className="flex items-center gap-2">
              <div className="p-2 bg-gradient-to-tr from-cyan-500 to-indigo-600 rounded-xl text-white shadow-md">
                <IconShare size={17} />
              </div>
              <div>
                <h2 className="text-base font-black tracking-tight text-white leading-tight">
                  Centre de Partage
                </h2>
                <p className="text-[11px] text-slate-400 font-semibold">
                  Application & Accès aux instances
                </p>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 active:scale-95 text-white transition-colors"
            title="Fermer"
          >
            <IconClose size={20} />
          </button>
        </div>

        {/* Mode Switcher */}
        <div className="px-5 pt-4 pb-2 bg-[#0a0f1e]">
          <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-900/90 border border-slate-800 rounded-2xl">
            <button
              type="button"
              onClick={() => setActiveTab('app')}
              className={`py-2 px-3 rounded-xl text-xs font-extrabold transition flex items-center justify-center gap-1.5 ${
                activeTab === 'app'
                  ? 'bg-gradient-to-r from-cyan-500 to-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <IconQrCode size={14} />
              <span>Partager l’appli</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('instance')}
              className={`py-2 px-3 rounded-xl text-xs font-extrabold transition flex items-center justify-center gap-1.5 ${
                activeTab === 'instance'
                  ? 'bg-gradient-to-r from-cyan-500 to-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <IconShield size={14} />
              <span>Partager une instance</span>
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="overflow-y-auto px-5 py-4 space-y-5 flex-1">
          {activeTab === 'app' ? (
            <>
              <button
                onClick={() =>
                  handleNativeShare(
                    'Remotivity • Instances Distantes',
                    shareAppText,
                    appDownloadPageUrl,
                    'app-release'
                  )
                }
                className="w-full py-3.5 px-4 bg-gradient-to-r from-cyan-500 via-sky-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-slate-950 hover:text-white font-black text-xs uppercase tracking-wider rounded-2xl flex items-center justify-center gap-2 transition-all shadow-xl active:scale-98"
              >
                <IconShare size={18} />
                <span>Partager Remotivity maintenant</span>
              </button>

              {/* QR Code Card */}
              <div className="bg-slate-900/80 border border-cyan-500/30 rounded-3xl p-5 flex flex-col items-center text-center shadow-lg">
                <span className="text-[11px] font-black uppercase tracking-wider text-cyan-300 mb-1">
                  📱 QR Code de téléchargement
                </span>
                <p className="text-xs text-slate-300 max-w-xs mb-4">
                  Faites scanner ce code pour installer directement Remotivity (APK Android) ou ouvrir la PWA :
                </p>

                <QRCodeSVG text={appDownloadPageUrl} size={180} />

                <div className="mt-4 w-full bg-[#060913] border border-slate-800 rounded-xl p-2.5 flex items-center justify-between gap-2">
                  <span className="text-xs text-cyan-300 font-mono truncate select-all">
                    {appDownloadPageUrl}
                  </span>
                  <button
                    onClick={() => handleCopy('app-release', appDownloadPageUrl)}
                    className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs flex items-center gap-1.5 transition flex-shrink-0"
                  >
                    {copiedKey === 'app-release' ? <IconCheck size={14} /> : <IconCopy size={14} />}
                    <span>{copiedKey === 'app-release' ? 'Copié !' : 'Copier'}</span>
                  </button>
                </div>
              </div>

              {/* Direct Share Channels */}
              <div className="space-y-2">
                <span className="text-xs font-black uppercase tracking-wider text-slate-400 block px-1">
                  Partage direct :
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {shareChannels.map((ch) => (
                    <a
                      key={ch.name}
                      href={ch.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`p-2.5 rounded-xl flex items-center justify-center gap-2 text-xs font-bold transition-all shadow-md active:scale-95 ${ch.color}`}
                    >
                      <span>{ch.icon}</span>
                      <span>{ch.name}</span>
                    </a>
                  ))}
                </div>
              </div>

              {/* Direct APK + PWA links */}
              <div className="space-y-2">
                <div className="p-3.5 rounded-2xl bg-slate-900/70 border border-slate-800 flex items-center justify-between text-xs">
                  <div>
                    <div className="font-bold text-white flex items-center gap-1.5">
                      <IconDownload size={14} className="text-emerald-400" />
                      <span>Lien direct APK Android</span>
                    </div>
                    <div className="text-[11px] text-slate-400">Remotivity.apk (signé)</div>
                  </div>
                  <a
                    href={GITHUB_APK_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 rounded-lg border border-emerald-500/35 font-bold flex items-center gap-1"
                  >
                    <span>Télécharger</span>
                    <IconExternalLink size={13} />
                  </a>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-900/70 border border-slate-800 flex items-center justify-between gap-2 text-xs">
                  <div className="min-w-0">
                    <div className="font-bold text-white">Version Web / PWA (GitHub Pages)</div>
                    <div className="text-[11px] text-cyan-300 font-mono truncate">{PWA_PUBLIC_URL}</div>
                  </div>
                  <button
                    onClick={() => handleCopy('pwa-url', PWA_PUBLIC_URL)}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg font-bold flex-shrink-0"
                  >
                    {copiedKey === 'pwa-url' ? 'Copié !' : 'Copier'}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Instance Selection & Permissions */}
              {selectedInstance ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-cyan-300 mb-1.5">
                      Instance à partager
                    </label>
                    <select
                      value={selectedInstance.id}
                      onChange={(e) => setSelectedId(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-xs font-bold text-white focus:outline-none focus:border-cyan-400"
                    >
                      {instances.map((inst) => (
                        <option key={inst.id} value={inst.id}>
                          {INSTANCE_TYPE_META[inst.type].iconEmoji} {inst.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Access Rights & Duration */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                        Niveau d’accès
                      </label>
                      <div className="grid grid-cols-2 gap-1.5">
                        <button
                          type="button"
                          onClick={() => setReadOnly(true)}
                          className={`py-2 px-2 rounded-xl text-[11px] font-bold border transition ${
                            readOnly
                              ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200'
                              : 'bg-slate-900 border-slate-800 text-slate-400'
                          }`}
                        >
                          👁️ Observation
                        </button>
                        <button
                          type="button"
                          onClick={() => setReadOnly(false)}
                          className={`py-2 px-2 rounded-xl text-[11px] font-bold border transition ${
                            !readOnly
                              ? 'bg-amber-500/20 border-amber-400 text-amber-200'
                              : 'bg-slate-900 border-slate-800 text-slate-400'
                          }`}
                        >
                          ⚡ Contrôle
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                        Validité du lien
                      </label>
                      <select
                        value={durationHours === null ? 'perm' : String(durationHours)}
                        onChange={(e) =>
                          setDurationHours(e.target.value === 'perm' ? null : Number(e.target.value))
                        }
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-cyan-400"
                      >
                        <option value="1">1 heure</option>
                        <option value="24">24 heures</option>
                        <option value="168">7 jours</option>
                        <option value="perm">Permanent</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                      Votre nom / signature d’invitation
                    </label>
                    <input
                      type="text"
                      value={sharedBy}
                      onChange={(e) => setSharedBy(e.target.value)}
                      placeholder="Ex: Hacene"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-400"
                    />
                  </div>

                  {/* Generated Invite QR Code */}
                  <div className="bg-slate-900/80 border border-indigo-500/35 rounded-3xl p-4 flex flex-col items-center text-center space-y-3">
                    <span className="text-[11px] font-black uppercase tracking-wider text-indigo-300">
                      🔑 Pass d’invitation {readOnly ? 'Lecture seule' : 'Contrôle complet'}
                    </span>

                    <QRCodeSVG text={inviteUrl} size={165} />

                    <p className="text-[11px] text-slate-400">
                      {readOnly
                        ? "Le jeton privé n'est pas inclus (mode observation sécurisé)."
                        : "Inclut la configuration et le jeton d'accès pour pilotage immédiat."}
                    </p>

                    <div className="w-full grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => handleCopy('invite-url', inviteUrl)}
                        className="py-2.5 px-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold flex items-center justify-center gap-1.5"
                      >
                        {copiedKey === 'invite-url' ? <IconCheck size={14} /> : <IconCopy size={14} />}
                        <span>{copiedKey === 'invite-url' ? 'Lien copié !' : 'Copier le lien'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          handleNativeShare(
                            `Accès Remotivity : ${selectedInstance.name}`,
                            `Rejoignez mon instance « ${selectedInstance.name} » sur Remotivity :`,
                            inviteUrl,
                            'invite-url'
                          )
                        }
                        className="py-2.5 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center justify-center gap-1.5"
                      >
                        <IconShare size={14} />
                        <span>Envoyer</span>
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleCopy('invite-code', inviteCode)}
                      className="text-[11px] text-slate-400 hover:text-cyan-300 font-mono underline"
                    >
                      {copiedKey === 'invite-code' ? 'Code brut copié !' : 'Copier uniquement le code brut'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 text-xs text-slate-400">
                  Ajoutez d’abord une instance pour pouvoir la partager.
                </div>
              )}

              {/* Import Invite Section */}
              <div className="p-4 rounded-2xl bg-slate-900/90 border border-cyan-500/25 space-y-2.5">
                <div className="text-xs font-extrabold text-white">
                  📥 Importer une instance partagée
                </div>
                <p className="text-[11px] text-slate-400">
                  Collez un lien d’invitation (<span className="font-mono">?invite=...</span>) ou un code brut généré par Remotivity ou par <span className="font-mono">Start-RemotivityHost.ps1</span> :
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={inviteInput}
                    onChange={(e) => setInviteInput(e.target.value)}
                    placeholder="Collez le lien ou le code d'invitation..."
                    className="flex-1 bg-[#060913] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-cyan-400"
                  />
                  <button
                    type="button"
                    onClick={handleImportSubmit}
                    className="px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs transition flex-shrink-0"
                  >
                    Importer
                  </button>
                </div>

                {importFeedback && (
                  <div
                    className={`p-2.5 rounded-xl text-xs font-semibold ${
                      importFeedback.type === 'success'
                        ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/35'
                        : 'bg-rose-500/15 text-rose-300 border border-rose-500/35'
                    }`}
                  >
                    {importFeedback.text}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-[#0d1426] border-t border-cyan-500/20 px-5 py-3.5 flex items-center justify-end pb-[max(1rem,env(safe-area-inset-bottom,16px))]">
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-bold text-xs rounded-xl shadow-md transition-all active:scale-95"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};
