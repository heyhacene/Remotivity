import { useState } from 'react';
import { IconClose, IconArrowLeft, IconBook, IconCopy, IconCheck, IconShield } from './Icons';

interface GuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GuideModal = ({ isOpen, onClose }: GuideModalProps) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  if (!isOpen) return null;

  const copyText = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const cmdLocal = 'powershell -ExecutionPolicy Bypass -File .\\host-agent\\Start-RemotivityHost.ps1';
  const cmdLan = 'powershell -ExecutionPolicy Bypass -File .\\host-agent\\Start-RemotivityHost.ps1 -BindAll';
  const cmdTunnel = 'cloudflared tunnel --url http://localhost:7890';

  return (
    <div className="fixed inset-0 z-[105] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/85 backdrop-blur-md text-white">
      <div className="fixed inset-0" onClick={onClose} />

      <div className="relative w-full max-w-lg max-h-[92vh] sm:max-h-[86vh] bg-[#0a0f1e] border border-cyan-500/40 rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col z-10">
        {/* Header */}
        <div className="sticky top-0 z-20 px-5 py-4 border-b border-cyan-500/20 flex items-center justify-between bg-gradient-to-r from-[#0e172a] via-[#0a1122] to-[#060913]">
          <div className="flex items-center gap-2.5">
            <button
              onClick={onClose}
              className="px-2.5 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-cyan-200 hover:text-white flex items-center gap-1.5 text-xs font-bold"
            >
              <IconArrowLeft size={16} />
              <span>Retour</span>
            </button>
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-cyan-500/20 text-cyan-300">
                <IconBook size={17} />
              </div>
              <div>
                <h2 className="text-base font-black text-white">Guide d’Accès Distant</h2>
                <p className="text-[11px] text-slate-400">Connexion PC, Mobile, Tailscale & Tunnels</p>
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

        {/* Content */}
        <div className="overflow-y-auto px-5 py-5 space-y-4 flex-1 text-xs leading-relaxed text-slate-300">
          <div className="p-4 rounded-2xl bg-slate-900/90 border border-cyan-500/30 space-y-2">
            <h3 className="text-sm font-black text-white">1. Lancer l’Agent Hôte sur votre PC</h3>
            <p>
              Le script <span className="font-mono text-cyan-300">host-agent/Start-RemotivityHost.ps1</span> fonctionne avec PowerShell natif (aucune installation requise). Il détecte vos sessions Antigravity, dossiers Git et exécute vos commandes.
            </p>
            <div className="p-2.5 rounded-xl bg-[#060913] border border-slate-800 flex items-center justify-between gap-2">
              <code className="text-[11px] text-cyan-300 font-mono truncate">{cmdLocal}</code>
              <button
                onClick={() => copyText('local', cmdLocal)}
                className="px-2.5 py-1 rounded-lg bg-cyan-600 text-white font-bold text-[11px] flex items-center gap-1 flex-shrink-0"
              >
                {copiedId === 'local' ? <IconCheck size={12} /> : <IconCopy size={12} />}
                <span>{copiedId === 'local' ? 'Copié' : 'Copier'}</span>
              </button>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900/90 border border-indigo-500/30 space-y-2">
            <h3 className="text-sm font-black text-white">2. Accéder depuis votre Android (Wi-Fi ou Tailscale)</h3>
            <p>
              Ajoutez <span className="font-mono text-indigo-300">-BindAll</span> (en PowerShell administrateur) pour accepter les connexions depuis votre IP locale ou votre réseau privé <strong>Tailscale</strong> :
            </p>
            <div className="p-2.5 rounded-xl bg-[#060913] border border-slate-800 flex items-center justify-between gap-2">
              <code className="text-[11px] text-indigo-300 font-mono truncate">{cmdLan}</code>
              <button
                onClick={() => copyText('lan', cmdLan)}
                className="px-2.5 py-1 rounded-lg bg-indigo-600 text-white font-bold text-[11px] flex items-center gap-1 flex-shrink-0"
              >
                {copiedId === 'lan' ? <IconCheck size={12} /> : <IconCopy size={12} />}
                <span>{copiedId === 'lan' ? 'Copié' : 'Copier'}</span>
              </button>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900/90 border border-emerald-500/30 space-y-2">
            <h3 className="text-sm font-black text-white">3. Accès depuis n’importe où (Cloudflare Tunnel HTTPS)</h3>
            <p>
              Sans ouvrir de port sur votre box, exposez temporairement l’agent en HTTPS puis scannez le lien généré :
            </p>
            <div className="p-2.5 rounded-xl bg-[#060913] border border-slate-800 flex items-center justify-between gap-2">
              <code className="text-[11px] text-emerald-300 font-mono truncate">{cmdTunnel}</code>
              <button
                onClick={() => copyText('tunnel', cmdTunnel)}
                className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white font-bold text-[11px] flex items-center gap-1 flex-shrink-0"
              >
                {copiedId === 'tunnel' ? <IconCheck size={12} /> : <IconCopy size={12} />}
                <span>{copiedId === 'tunnel' ? 'Copié' : 'Copier'}</span>
              </button>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-cyan-950/30 border border-cyan-500/25 flex items-start gap-2.5">
            <IconShield size={18} className="text-cyan-400 flex-shrink-0 mt-0.5" />
            <p className="text-[11px] text-slate-300">
              <strong>Sécurité des partages :</strong> Lorsque vous partagez une instance en mode <em>Observation (Lecture seule)</em>, votre jeton privé n’est jamais inclus dans le QR code ou le lien d’invitation.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-[#0d1426] border-t border-cyan-500/20 px-5 py-3.5 flex justify-end pb-[max(1rem,env(safe-area-inset-bottom,16px))]">
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-gradient-to-r from-cyan-600 to-indigo-600 text-white font-bold text-xs rounded-xl"
          >
            Compris
          </button>
        </div>
      </div>
    </div>
  );
};
