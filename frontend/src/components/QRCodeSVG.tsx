import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

interface QRCodeSVGProps {
  text: string;
  size?: number;
  className?: string;
}

export const QRCodeSVG = ({ text, size = 210, className = '' }: QRCodeSVGProps) => {
  const [dataUrl, setDataUrl] = useState<string>('');
  const [error, setError] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;
    QRCode.toDataURL(text, {
      width: size * 2,
      margin: 2,
      color: {
        dark: '#060913',
        light: '#FFFFFF',
      },
      errorCorrectionLevel: 'M',
    })
      .then((url) => {
        if (isMounted) {
          setDataUrl(url);
          setError(false);
        }
      })
      .catch((err) => {
        console.error('[Remotivity] Failed to generate QR Code:', err);
        if (isMounted) setError(true);
      });

    return () => {
      isMounted = false;
    };
  }, [text, size]);

  if (error) {
    return (
      <div
        style={{ width: size, height: size }}
        className="bg-slate-900/70 border border-cyan-500/30 rounded-2xl flex flex-col items-center justify-center p-4 text-center text-xs text-cyan-300"
      >
        <span className="text-xl mb-1">📱</span>
        <span className="break-all line-clamp-4">{text}</span>
      </div>
    );
  }

  if (!dataUrl) {
    return (
      <div
        style={{ width: size, height: size }}
        className="bg-white/10 rounded-2xl animate-pulse flex items-center justify-center text-xs text-cyan-300 border border-cyan-400/20"
      >
        Génération du QR Code...
      </div>
    );
  }

  return (
    <div className={`relative inline-block ${className}`}>
      <img
        src={dataUrl}
        alt={`QR Code Remotivity`}
        width={size}
        height={size}
        className="rounded-2xl shadow-2xl border-4 border-white select-none pointer-events-none bg-white p-1"
      />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 rounded-xl bg-[#060913] border-2 border-cyan-400 shadow-lg flex items-center justify-center p-1 pointer-events-none">
        <img src="./logo-remotivity.png" alt="Remotivity" className="w-full h-full object-contain rounded-md" />
      </div>
    </div>
  );
};
