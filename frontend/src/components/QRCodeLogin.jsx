import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Smartphone, CheckCircle, XCircle, Loader2 } from 'lucide-react';

export default function QRCodeLogin({ qrCode, status, info }) {
  if (status === 'connected') {
    return (
      <div className="card text-center py-10">
        <CheckCircle className="mx-auto text-whatsapp mb-4" size={64} />
        <h2 className="text-2xl font-bold mb-2">Connected Successfully!</h2>
        <p className="text-gray-500 dark:text-gray-400">
          Logged in as <strong>{info?.pushname}</strong> ({info?.phone})
        </p>
        <p className="text-sm text-gray-400 mt-2">Platform: {info?.platform}</p>
      </div>
    );
  }

  if (status === 'auth_failure') {
    return (
      <div className="card text-center py-10">
        <XCircle className="mx-auto text-red-500 mb-4" size={64} />
        <h2 className="text-2xl font-bold mb-2">Authentication Failed</h2>
        <p className="text-gray-500">Please refresh and try again.</p>
      </div>
    );
  }

  if (!qrCode) {
    return (
      <div className="card text-center py-10">
        <Loader2 className="mx-auto text-whatsapp mb-4 animate-spin" size={64} />
        <h2 className="text-xl font-bold mb-2">Initializing WhatsApp...</h2>
        <p className="text-gray-500 dark:text-gray-400">
          Please wait while we set up the connection
        </p>
      </div>
    );
  }

  return (
    <div className="card text-center">
      <div className="flex items-center justify-center gap-3 mb-6">
        <Smartphone className="text-whatsapp" size={28} />
        <h2 className="text-2xl font-bold">Link Your WhatsApp</h2>
      </div>
      <div className="bg-white p-6 rounded-xl inline-block mb-6">
        <QRCodeSVG value={qrCode} size={280} level="M" />
      </div>
      <div className="text-left max-w-md mx-auto space-y-2">
        <p className="font-medium text-gray-700 dark:text-gray-300">To link your device:</p>
        <ol className="text-sm text-gray-500 dark:text-gray-400 space-y-1 list-decimal list-inside">
          <li>Open WhatsApp on your phone</li>
          <li>Go to Settings &gt; Linked Devices</li>
          <li>Tap "Link a Device"</li>
          <li>Point your phone camera at this QR code</li>
        </ol>
      </div>
    </div>
  );
}
