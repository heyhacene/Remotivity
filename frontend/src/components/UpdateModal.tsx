import { useState, useEffect } from 'react';
import {
  APP_CURRENT_VERSION,
  GITHUB_APK_URL,
  GITHUB_RELEASES_API,
  GITHUB_RELEASES_URL,
  compareVersions,
} from '../types/remotivity';
import {
  IconClose,
  IconCheck,
  IconArrowLeft,
  IconRefresh,
  IconDownload,
  IconExternalLink,
  IconSparkles,
  IconShield,
} from './Icons';

interface UpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentVersion?: string;
}

interface ReleaseInfo {
  tag_name: string;
  name: string;
  body: string;
  published_at: string;
  apk_url?: string;
  html_url: string;
  isSimulated?: boolean;
}

export const UpdateModal = ({
  isOpen,
  onClose,
  currentVersion = APP_CURRENT_VERSION,
}: UpdateModalProps) => {
  const [loading, setLoading] = useState(false);
  const [release, setRelease] = useState<ReleaseInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasChecked, setHasChecked] = useState(false);

  const fetchLatestRelease = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(GITHUB_RELEASES_API, { cache: 'no-store' });
      if (!res.ok) {
        if (res.status === 404) {
          throw new Error("Aucune release publiée pour le moment sur GitHub.");
        }
        throw new Error(`Erreur HTTP ${res.status}`);
      }
      const data = await res.json();
      const apkAsset = data.assets?.find((a: any) => String(a.name).toLowerCase().endsWith('.apk'));
      setRelease({
        tag_name: data.tag_name,
        name: data.name || data.tag_name,
        body: data.body || '',
        published_at: data.published_at,
        apk_url: apkAsset ? apkAsset.browser_download_url : GITHUB_APK_URL,
        html_url: data.html_url || GITHUB_RELEASES_URL,
      });
      setHasChecked(true);
    } catch (e: any) {
      console.warn('[Remotivity] Failed to fetch release info:', e);
      setError(
        e?.message ||
          "Impossible de vérifier les mises à jour pour le moment (vérifiez votre connexion Internet)."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSimulateUpdate = () => {
    const parts = currentVersion.replace(/^v/i, '').split('.');
    const patch = (parseInt(parts[2] || '1', 10) || 1) + 1;
    const nextTag = `v${parts[0] || '1'}.${parts[1] || '0'}.${patch}`;
    setError(null);
    setRelease({
      tag_name: nextTag,
      name: `Remotivity ${nextTag} (Aperçu Pop-up)`,
      body: [
        '### 🚀 Nouveautés simulées :',
        '- Connexion ultra-rapide aux sessions Antigravity & Claude Code',
        '- Partage d’instances par QR Code avec expiration automatique',
        '- Amélioration du terminal distant & notifications Android natives',
      ].join('\n'),
      published_at: new Date().toISOString(),
      apk_url: GITHUB_APK_URL,
      html_url: GITHUB_RELEASES_URL,
      isSimulated: true,
    });
  };

  useEffect(() => {
    if (isOpen && !hasChecked) {
      fetchLatestRelease();
    }
  }, [isOpen, hasChecked]);

  if (!isOpen) return null;

  const isNewer = release ? compareVersions(release.tag_name, currentVersion) > 0 : false;
  const isUpToDate = release ? !isNewer : false;

  return (
    <div className="fixed inset-0 z-[105] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/85 backdrop-blur-md text-white">
      <div className="fixed inset-0" onClick={onClose} />

      <div className="relative w-full max-w-lg max-h-[92vh] sm:max-h-[85vh] bg-[#0a0f1e] border border-cyan-500/40 rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col z-10">
        {/* Header */}
        <div className="sticky top-0 z-20 px-5 py-4 border-b border-cyan-500/20 flex items-center justify-between bg-gradient-to-r from-[#0e172a] via-[#0a1122] to-[#060913]">
          <div className="flex items-center gap-2.5">
            <button
              onClick={onClose}
              className="px-2.5 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-cyan-200 hover:text-white flex items-center gap-1.5 text-xs font-bold transition-all active:scale-95"
            >
              <IconArrowLeft size={16} />
              <span>Retour</span>
            </button>
            <div>
              <h2 className="text-base font-black tracking-tight text-white leading-tight flex items-center gap-1.5">
                <IconSparkles size={16} className="text-cyan-400" />
                <span>Mises à jour Remotivity</span>
              </h2>
              <p className="text-[11px] text-slate-400 font-semibold">
                Suivi automatique des Releases GitHub
              </p>
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

        {/* Content */}
        <div className="overflow-y-auto px-5 py-5 space-y-5 flex-1">
          {/* Current Version Card */}
          <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-700/60 flex items-center justify-between">
            <div>
              <div className="text-[11px] font-bold text-cyan-400 uppercase tracking-wider">
                Version installée
              </div>
              <div className="text-xl font-black text-white font-mono mt-0.5">
                {currentVersion}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                Canal officiel • GitHub Public
              </div>
            </div>

            <button
              onClick={fetchLatestRelease}
              disabled={loading}
              className="px-3.5 py-2.5 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 hover:text-white border border-cyan-500/35 transition-all active:scale-95 flex items-center gap-2 text-xs font-bold"
              title="Vérifier maintenant"
            >
              <IconRefresh size={16} className={loading ? 'animate-spin text-cyan-300' : ''} />
              <span>Vérifier</span>
            </button>
          </div>

          {loading && (
            <div className="p-6 rounded-2xl bg-slate-900/60 border border-cyan-500/25 flex flex-col items-center justify-center text-center space-y-3">
              <IconRefresh size={28} className="animate-spin text-cyan-400" />
              <p className="text-sm font-bold text-slate-200">
                Vérification de la dernière version sur GitHub...
              </p>
            </div>
          )}

          {!loading && error && (
            <div className="p-4 rounded-2xl bg-rose-950/40 border border-rose-500/40 text-rose-200 text-xs font-semibold space-y-2">
              <p>{error}</p>
            </div>
          )}

          {!loading && release && isUpToDate && (
            <div className="p-5 rounded-2xl bg-emerald-950/35 border border-emerald-500/40 space-y-3">
              <div className="flex items-center gap-2 text-emerald-400 font-extrabold text-sm">
                <IconCheck size={18} />
                <span>Votre application est à jour !</span>
              </div>
              <p className="text-xs text-emerald-100/80 leading-relaxed">
                Vous utilisez la dernière version publiée (<strong className="font-mono">{release.tag_name}</strong>). Dès qu’une nouvelle build sera poussée sur GitHub, une pop-up d’alerte s’ouvrira automatiquement au lancement.
              </p>
            </div>
          )}

          {!loading && release && isNewer && (
            <div className="p-5 rounded-2xl bg-gradient-to-br from-cyan-950/70 via-indigo-950/60 to-slate-900 border border-cyan-400/50 space-y-4 shadow-xl">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-400/35">
                    {release.isSimulated ? 'Aperçu Nouvelle Version' : 'Nouvelle version disponible'}
                  </span>
                  <h3 className="text-lg font-black text-white mt-1.5">
                    {release.name}
                  </h3>
                  <p className="text-[11px] text-slate-300 font-mono mt-0.5">
                    {currentVersion} → <span className="text-emerald-300 font-bold">{release.tag_name}</span>
                  </p>
                </div>
              </div>

              {release.apk_url && (
                <a
                  href={release.apk_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-3.5 px-4 bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-slate-950 font-black text-xs uppercase tracking-wider rounded-2xl flex items-center justify-center gap-2 transition-all shadow-lg active:scale-98"
                >
                  <IconDownload size={18} className="text-slate-950" />
                  <span>Télécharger la mise à jour (APK)</span>
                </a>
              )}

              {release.body && (
                <div className="pt-2 border-t border-slate-700/60">
                  <div className="text-[11px] font-bold text-cyan-300 uppercase tracking-wider mb-1.5">
                    Notes de version :
                  </div>
                  <div className="text-xs text-slate-200 whitespace-pre-line leading-relaxed max-h-40 overflow-y-auto bg-black/40 p-3 rounded-xl border border-slate-800">
                    {release.body}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-center gap-1.5 text-[11px] text-emerald-400 font-semibold">
                <IconShield size={14} />
                <span>APK signé et vérifié via GitHub Actions</span>
              </div>
            </div>
          )}

          {/* Action links & Popup preview */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
            <a
              href={GITHUB_RELEASES_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-cyan-300 hover:text-white transition-colors"
            >
              <span>Historique des versions GitHub</span>
              <IconExternalLink size={14} />
            </a>

            <button
              type="button"
              onClick={handleSimulateUpdate}
              className="px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-[11px] font-bold transition"
            >
              Tester la pop-up de MAJ
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-[#0d1426] border-t border-cyan-500/20 px-5 py-3.5 flex items-center justify-between pb-[max(1rem,env(safe-area-inset-bottom,16px))]">
          <span className="text-xs text-slate-400 font-semibold font-mono">
            Remotivity • {currentVersion}
          </span>
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
