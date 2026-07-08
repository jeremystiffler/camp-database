"use client";

import { useEffect, useState } from "react";

type Props = {
  value?: string | null;
  label?: string;
  size?: number;
  className?: string;
};

export default function CamperScannableCode({ value, label = "Participant QR", size = 148, className = "" }: Props) {
  const [src, setSrc] = useState("");

  useEffect(() => {
    let cancelled = false;
    if (!value) {
      setSrc("");
      return;
    }
    import("qrcode")
      .then((QRCode) => QRCode.toDataURL(value, { errorCorrectionLevel: "M", margin: 1, width: size }))
      .then((dataUrl) => { if (!cancelled) setSrc(dataUrl); })
      .catch(() => { if (!cancelled) setSrc(""); });
    return () => { cancelled = true; };
  }, [value, size]);

  if (!value) {
    return <div className={`rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-center text-xs font-bold text-slate-400 ${className}`}>No scan code yet</div>;
  }

  return (
    <div className={`inline-flex flex-col items-center rounded-2xl border border-slate-200 bg-white p-3 ${className}`}>
      <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">{label}</div>
      {src ? <img src={src} width={size} height={size} alt={label} className="mt-2 rounded-lg" /> : <div style={{ width: size, height: size }} className="mt-2 animate-pulse rounded-lg bg-slate-100" />}
      <div className="mt-2 max-w-[12rem] break-all rounded-lg bg-slate-50 px-2 py-1 text-center font-mono text-[10px] text-slate-500">{value}</div>
    </div>
  );
}
