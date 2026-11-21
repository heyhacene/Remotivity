import { useState, useEffect, useMemo } from 'react';
import {
  RemoteSession,
  GITHUB_APK_URL,
  GITHUB_RELEASES_URL,
  PWA_PUBLIC_URL,
  encodeSessionInvite,
  decodeSessionInvite,
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
  IconQrCode,
  IconDownload,
} from './Icons';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessions: RemoteSession[];
  initialTab?: 'app' | 'session';
  preselectedSessionId?: string | null;
  onImportSession: (session: RemoteSession) => void;
}

export const ShareModal = ({
  isOpen,
  onClose,
  sessions,
  initialTab = 'app',
  preselectedSessionId = null,
  onImportSession,
}: ShareModalProps) => {
  const [activeTab, setActiveTab] = useState<'app' | 'session'>(initialTab);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string>(
    preselectedSessionId || sessions[0]?.id || ''
  );
  const [inviteInput, setInviteInput] = useState('');
  const [importFeedback, setImportFeedback] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      if (preselectedSessionId) {
        setSelectedId(preselectedSessionId);
      } else if (!selectedId && sessions.length > 0) {
        setSelectedId(sessions[0].id);
      }
      setImportFeedback(null);
    }
  }, [isOpen, initialTab, preselectedSessionId, sessions, selectedId]);

  const selectedSession = useMemo(
    () => sessions.find((s) => s.id === selectedId) || sessions[0] || null,
    [sessions, selectedId]
  );

  const inviteCode = useMemo(() => {
    if (!selectedSession) return '';
    return encodeSessionInvite(selectedSession);
  }, [selectedSession]);

  const inviteUrl = inviteCode ? `${PWA_PUBLIC_URL}?invite=${inviteCode}` : PWA_PUBLIC_URL;

  if (!isOpen) return null;

  const appDownloadPageUrl = `${GITHUB_RELEASES_URL}/latest`;
  const shareAppText =
    "Téléchargez Remotivity : accédez simplement à vos sessions Antigravity en remote depuis mobile :";
  const fullAppShareMsg = `${shareAppText} ${appDownloadPageUrl}`;

  const handleCopy = (key: string, value: string) => {
    navigator.clipboard.writeText(value);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2200);
  };

  const handleNativeShare = async (
    title: string,
    text: string,
    url: string,
    fallbackKey: string
  ) => {
    if (navigator.share) {
      try {
        await navigator.share({ title, text, url });
        return;
      } catch {
        // Cancelled
      }
    }
    handleCopy(fallbackKey, url);
  };

  const handleImportSubmit = () => {
    const res = decodeSessionInvite(inviteInput);
    if (!res.payload) {
      setImportFeedback({ type: 'error', text: res.error || 'Lien ou code invalide.' });
      return;
    }

    const p = res.payload;
    const newSession: RemoteSession = {
      id: `shared-${Date.now()}`,
      name: p.name,
      url: p.url,
      icon: p.icon || '🛰️',
      subtitle: `Partagé par ${p.sharedBy || 'un contact'}`,
      sharedBy: p.sharedBy || 'Contact',
    };

    onImportSession(newSession);
    setInviteInput('');
    setImportFeedback({
      type: 'success',
      text: `Session « ${newSession.name} » ajoutée !`,
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

      <div className="relative w-full max-w-lg max-h-[92vh] sm:max-h-[86vh] bg-[#0a0f1e] border border-cyan-500/40 rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col z-10">
        {/* Header */}
        <div className="sticky top-0 z-20 px-5 py-4 border-b border-cyan-500/20 flex items-center justify-between bg-[#0b1120]">
          <div className="flex items-center gap-2.5">
            <button
              onClick={onClose}
              className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-200 flex items-center gap-1.5 text-xs font-bold"
            >
              <IconArrowLeft size={16} />
              <span>Retour</span>
            </button>
            <h2 className="text-base font-black text-white">Partager</h2>
          </div>

          <button
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white"
          >
            <IconClose size={20} />
          </button>
        </div>

        {/* Switcher */}
        <div className="px-5 pt-4 pb-1">
          <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-900 border border-slate-800 rounded-2xl">
            <button
              type="button"
              onClick={() => setActiveTab('app')}
              className={`py-2 px-3 rounded-xl text-xs font-extrabold transition flex items-center justify-center gap-1.5 ${
                activeTab === 'app'
                  ? 'bg-gradient-to-r from-cyan-500 to-indigo-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <IconQrCode size={14} />
              <span>L’application</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('session')}
              className={`py-2 px-3 rounded-xl text-xs font-extrabold transition flex items-center justify-center gap-1.5 ${
                activeTab === 'session'
                  ? 'bg-gradient-to-r from-cyan-500 to-indigo-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <IconShare size={14} />
              <span>Une session</span>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="overflow-y-auto px-5 py-4 space-y-5 flex-1">
          {activeTab === 'app' ? (
            <>
              <button
                onClick={() =>
                  handleNativeShare(
                    'Remotivity • Antigravity Remote',
                    shareAppText,
                    appDownloadPageUrl,
                    'app-release'
                  )
                }
                className="w-full py-3.5 px-4 bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-black text-xs uppercase tracking-wider rounded-2xl flex items-center justify-center gap-2 shadow-lg"
              >
                <IconShare size={17} />
                <span>Partager Remotivity</span>
              </button>

              <div className="bg-slate-900/80 border border-cyan-500/30 rounded-3xl p-5 flex flex-col items-center text-center">
                <span className="text-[11px] font-black uppercase tracking-wider text-cyan-300 mb-3">
                  QR Code de téléchargement
                </span>
                <QRCodeSVG text={appDownloadPageUrl} size={180} />

                <div className="mt-4 w-full bg-[#060913] border border-slate-800 rounded-xl p-2.5 flex items-center justify-between gap-2">
                  <span className="text-xs text-cyan-300 font-mono truncate select-all">
                    {appDownloadPageUrl}
                  </span>
                  <button
                    onClick={() => handleCopy('app-release', appDownloadPageUrl)}
                    className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs flex items-center gap-1 flex-shrink-0"
                  >
                    {copiedKey === 'app-release' ? <IconCheck size={14} /> : <IconCopy size={14} />}
                    <span>{copiedKey === 'app-release' ? 'Copié !' : 'Copier'}</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {shareChannels.map((ch) => (
                  <a
                    key={ch.name}
                    href={ch.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`p-2.5 rounded-xl flex items-center justify-center gap-2 text-xs font-bold shadow ${ch.color}`}
                  >
                    <span>{ch.icon}</span>
                    <span>{ch.name}</span>
                  </a>
                ))}
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-900/70 border border-slate-800 flex items-center justify-between text-xs">
                <div>
                  <div className="font-bold text-white flex items-center gap-1.5">
                    <IconDownload size={14} className="text-emerald-400" />
                    <span>APK Android direct</span>
                  </div>
                  <div className="text-[11px] text-slate-400">Remotivity.apk</div>
                </div>
                <a
                  href={GITHUB_APK_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 bg-emerald-500/20 text-emerald-300 rounded-lg border border-emerald-500/35 font-bold flex items-center gap-1"
                >
                  <span>Télécharger</span>
                  <IconExternalLink size={13} />
                </a>
              </div>
            </>
          ) : (
            <>
              {selectedSession && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-cyan-300 mb-1.5">
                      Choisir la session à partager
                    </label>
                    <select
                      value={selectedSession.id}
                      onChange={(e) => setSelectedId(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-xs font-bold text-white focus:outline-none focus:border-cyan-400"
                    >
                      {sessions.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.icon} {s.name} ({s.url})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="bg-slate-900/80 border border-indigo-500/35 rounded-3xl p-4 flex flex-col items-center text-center space-y-3">
                    <span className="text-[11px] font-black uppercase tracking-wider text-indigo-300">
                      QR Code de la session
                    </span>

                    <QRCodeSVG text={inviteUrl} size={170} />

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
                            `Session Remotivity : ${selectedSession.name}`,
                            `Accède à la session ${selectedSession.name} sur Remotivity :`,
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
                  </div>
                </div>
              )}

              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-2.5">
                <div className="text-xs font-extrabold text-white">
                  📥 Importer une session reçue
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={inviteInput}
                    onChange={(e) => setInviteInput(e.target.value)}
                    placeholder="Collez le lien ou code reçu..."
                    className="flex-1 bg-[#060913] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-cyan-400"
                  />
                  <button
                    type="button"
                    onClick={handleImportSubmit}
                    className="px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs flex-shrink-0"
                  >
                    Ajouter
                  </button>
                </div>
                {importFeedback && (
                  <p
                    className={`text-xs font-semibold ${
                      importFeedback.type === 'success' ? 'text-emerald-300' : 'text-rose-300'
                    }`}
                  >
                    {importFeedback.text}
                  </p>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-[#0d1426] border-t border-cyan-500/20 px-5 py-3.5 flex justify-end pb-[max(1rem,env(safe-area-inset-bottom,16px))]">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};
