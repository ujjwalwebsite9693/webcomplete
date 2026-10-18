import React, { useEffect, useState } from 'react';
import AdminLayout from '../../components/AdminLayout';
import api from '../../services/api';
import { Settings, Save, CheckCircle2, QrCode, Share2, Eye, Image, Smartphone, Download, Copy, RefreshCw } from 'lucide-react';

const AdminSettings = () => {
  const [settings, setSettings] = useState({
    siteName: 'EasyUVerse',
    siteLogo: '',
    tagline: 'Premium MERN, PHP, Python, Java & HTML Source Codes Marketplace',
    contactEmail: 'support@easyuverse.com',
    contactPhone: '+91 9241034816',
    bannerNotice: '🚀 Welcome to EasyUVerse! Scan UPI QR & enter 12-digit UTR for instant zip source code access.',
    upiId: '9241034816@mbkns',
    upiName: 'Ujjwal Kant / EasyUVerse',
    upiQrImage: '',
    autoApproveUtr: true,
    supportEnabled: true,
    visitorCount: 1420,
    socialLinks: {
      github: 'https://github.com/ujjwalkant',
      linkedin: 'https://linkedin.com/in/ujjwalkant',
      instagram: 'https://instagram.com/ujjwalkant',
      youtube: 'https://youtube.com/@easyuverse',
      whatsapp: 'https://wa.me/919241034816',
      telegram: 'https://t.me/easyuverse',
    },
  });

  const [pairData, setPairData] = useState(null);
  const [copiedKey, setCopiedKey] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    fetchSettings();
    fetchPairData();
  }, []);

  const fetchPairData = async () => {
    try {
      const res = await api.get('/payments/pair-qr');
      if (res.data?.success) {
        setPairData(res.data);
      }
    } catch (e) {
      console.warn('Pair QR fetch error:', e.message);
    }
  };

  const fetchSettings = async () => {
    try {
      const res = await api.get('/admin/settings');
      if (res.data?.success && res.data?.data) {
        setSettings({
          ...res.data.data,
          siteLogo: res.data.data.siteLogo || '',
          socialLinks: {
            github: res.data.data.socialLinks?.github || 'https://github.com/ujjwalkant',
            linkedin: res.data.data.socialLinks?.linkedin || 'https://linkedin.com/in/ujjwalkant',
            instagram: res.data.data.socialLinks?.instagram || 'https://instagram.com/ujjwalkant',
            youtube: res.data.data.socialLinks?.youtube || 'https://youtube.com/@easyuverse',
            whatsapp: res.data.data.socialLinks?.whatsapp || 'https://wa.me/919241034816',
            telegram: res.data.data.socialLinks?.telegram || 'https://t.me/easyuverse',
          },
        });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSuccessMsg('');

    try {
      const res = await api.put('/admin/settings', settings);
      if (res.data?.success) {
        setSuccessMsg('Settings updated successfully!');
      }
    } catch (err) {
      alert('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-4xl">
        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-gray-200 dark:border-slate-800 shadow-sm">
          <h1 className="text-2xl font-black text-gray-900 dark:text-white flex items-center gap-2">
            <Settings className="w-7 h-7 text-indigo-600 dark:text-indigo-400" />
            <span>Platform & Payment Settings</span>
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Manage custom PNG/JPEG logo image, UPI QR payment parameters, social media links, visitor counter, and developer info.
          </p>
        </div>

        {successMsg && (
          <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-sm font-bold flex items-center space-x-2">
            <CheckCircle2 className="w-5 h-5" />
            <span>{successMsg}</span>
          </div>
        )}

        {loading ? (
          <div className="p-8 text-center text-gray-400">Loading settings...</div>
        ) : (
          <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-900 rounded-3xl border border-gray-200 dark:border-slate-800 p-6 shadow-sm space-y-6 text-xs">
            {/* Brand Logo Upload Setup */}
            <div className="space-y-4">
              <h3 className="font-extrabold text-sm text-gray-900 dark:text-white border-b border-gray-100 dark:border-slate-800 pb-2 flex items-center space-x-2">
                <Image className="w-4 h-4 text-indigo-500" />
                <span>Custom Brand Logo Image (PNG / JPEG / SVG / WebP)</span>
              </h3>

              <div>
                <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Brand Logo Image URL (Optional)
                </label>
                <input
                  type="url"
                  value={settings.siteLogo}
                  onChange={(e) => setSettings({ ...settings, siteLogo: e.target.value })}
                  placeholder="https://res.cloudinary.com/demo/image/upload/v1/easyuverse_logo.png"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800"
                />
                <p className="text-[11px] text-gray-400 mt-1">
                  Leave empty to use the default EasyUVerse logo icon vector. Paste any custom PNG, JPEG, SVG, or Cloudinary image link here.
                </p>
              </div>
            </div>

            {/* Direct UPI Setup */}
            <div className="space-y-4 pt-4 border-t border-gray-100 dark:border-slate-800">
              <h3 className="font-extrabold text-sm text-gray-900 dark:text-white border-b border-gray-100 dark:border-slate-800 pb-2 flex items-center space-x-2">
                <QrCode className="w-4 h-4 text-indigo-500" />
                <span>Direct UPI Payment Details</span>
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">
                    UPI ID *
                  </label>
                  <input
                    type="text"
                    required
                    value={settings.upiId}
                    onChange={(e) => setSettings({ ...settings, upiId: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">
                    Payee Name / Developer Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={settings.upiName}
                    onChange={(e) => setSettings({ ...settings, upiName: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 font-bold"
                  />
                </div>
              </div>

              {/* Automatic Bank Observer Phone Pairing Card */}
              <div className="mt-6 pt-5 border-t border-gray-100 dark:border-slate-800">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    <Smartphone className="w-5 h-5 text-emerald-500" />
                    <div>
                      <h4 className="text-sm font-extrabold text-gray-900 dark:text-white">
                        Automate Bank Verification (Pair Observer Phone)
                      </h4>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400">
                        Scan with the <strong>YOUPI Bank Observer</strong> app on your bank-registered mobile to verify UPI payments automatically.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={fetchPairData}
                    className="p-1.5 rounded-lg border border-gray-200 dark:border-slate-700 hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-500 text-xs flex items-center space-x-1"
                    title="Refresh QR"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Refresh</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-center bg-gray-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-gray-200 dark:border-slate-700">
                  {/* QR Box */}
                  <div className="md:col-span-4 flex flex-col items-center justify-center text-center">
                    {pairData?.pairingQrSvg ? (
                      <div
                        className="w-40 h-40 bg-white p-2 rounded-xl border border-gray-200 shadow-md flex items-center justify-center"
                        dangerouslySetInnerHTML={{ __html: pairData.pairingQrSvg }}
                      />
                    ) : (
                      <div className="w-40 h-40 bg-gray-100 dark:bg-slate-700 rounded-xl animate-pulse flex items-center justify-center text-xs text-gray-400">
                        Loading Pairing QR...
                      </div>
                    )}
                    <span className="text-[10px] text-gray-500 font-bold mt-2">
                      Scan with Observer APK Camera
                    </span>
                  </div>

                  {/* Manual Configuration & Device Info */}
                  <div className="md:col-span-8 space-y-3 text-xs">
                    <div className="space-y-1">
                      <span className="text-gray-400 font-bold block text-[10px] uppercase">Gateway Server URL</span>
                      <div className="flex items-center gap-2">
                        <code className="bg-white dark:bg-slate-900 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-slate-700 font-mono text-cyan-600 dark:text-cyan-400 font-bold flex-1 truncate">
                          {pairData?.serverUrl || 'Loading...'}
                        </code>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(pairData?.serverUrl || '');
                            setCopiedKey('url');
                            setTimeout(() => setCopiedKey(null), 2000);
                          }}
                          className="px-2.5 py-1.5 rounded-lg bg-gray-200 dark:bg-slate-700 font-bold text-gray-700 dark:text-gray-300 flex items-center space-x-1"
                        >
                          <Copy className="w-3.5 h-3.5" />
                          <span>{copiedKey === 'url' ? 'Copied' : 'Copy'}</span>
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <span className="text-gray-400 font-bold block text-[10px] uppercase">Secret Token</span>
                      <div className="flex items-center gap-2">
                        <code className="bg-white dark:bg-slate-900 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-slate-700 font-mono text-indigo-600 dark:text-indigo-400 font-bold flex-1 truncate">
                          {pairData?.enrollmentToken || '...'}
                        </code>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(pairData?.enrollmentToken || '');
                            setCopiedKey('token');
                            setTimeout(() => setCopiedKey(null), 2000);
                          }}
                          className="px-2.5 py-1.5 rounded-lg bg-gray-200 dark:bg-slate-700 font-bold text-gray-700 dark:text-gray-300 flex items-center space-x-1"
                        >
                          <Copy className="w-3.5 h-3.5" />
                          <span>{copiedKey === 'token' ? 'Copied' : 'Copy'}</span>
                        </button>
                      </div>
                    </div>

                    {/* Status & Download APK */}
                    <div className="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-gray-200 dark:border-slate-700/80">
                      <div className="flex items-center space-x-1.5">
                        <span className={`w-2.5 h-2.5 rounded-full ${pairData?.devices?.length > 0 ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                        <span className="font-bold text-gray-700 dark:text-gray-300 text-xs">
                          {pairData?.devices?.length > 0 ? `${pairData.devices.length} Phone Connected (Live)` : 'No Phone Paired'}
                        </span>
                      </div>

                      <a
                        href="/api/payments/download-apk"
                        download="youpi-sms-gateway.apk"
                        className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs flex items-center space-x-1.5 shadow-md transition-all"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Download Observer APK</span>
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Social Media Links Manager */}
            <div className="space-y-4 pt-4 border-t border-gray-100 dark:border-slate-800">
              <h3 className="font-extrabold text-sm text-gray-900 dark:text-white border-b border-gray-100 dark:border-slate-800 pb-2 flex items-center space-x-2">
                <Share2 className="w-4 h-4 text-indigo-500" />
                <span>Social Media Links Manager</span>
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">GitHub URL</label>
                  <input
                    type="url"
                    value={settings.socialLinks?.github}
                    onChange={(e) => setSettings({ ...settings, socialLinks: { ...settings.socialLinks, github: e.target.value } })}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">LinkedIn URL</label>
                  <input
                    type="url"
                    value={settings.socialLinks?.linkedin}
                    onChange={(e) => setSettings({ ...settings, socialLinks: { ...settings.socialLinks, linkedin: e.target.value } })}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">Instagram URL</label>
                  <input
                    type="url"
                    value={settings.socialLinks?.instagram}
                    onChange={(e) => setSettings({ ...settings, socialLinks: { ...settings.socialLinks, instagram: e.target.value } })}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">YouTube Channel URL</label>
                  <input
                    type="url"
                    value={settings.socialLinks?.youtube}
                    onChange={(e) => setSettings({ ...settings, socialLinks: { ...settings.socialLinks, youtube: e.target.value } })}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">WhatsApp Direct Chat</label>
                  <input
                    type="url"
                    value={settings.socialLinks?.whatsapp}
                    onChange={(e) => setSettings({ ...settings, socialLinks: { ...settings.socialLinks, whatsapp: e.target.value } })}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">Telegram Group / Channel</label>
                  <input
                    type="url"
                    value={settings.socialLinks?.telegram}
                    onChange={(e) => setSettings({ ...settings, socialLinks: { ...settings.socialLinks, telegram: e.target.value } })}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800"
                  />
                </div>
              </div>
            </div>

            {/* Visitor Counter Config */}
            <div className="space-y-4 pt-4 border-t border-gray-100 dark:border-slate-800">
              <h3 className="font-extrabold text-sm text-gray-900 dark:text-white border-b border-gray-100 dark:border-slate-800 pb-2 flex items-center space-x-2">
                <Eye className="w-4 h-4 text-indigo-500" />
                <span>Live Visitor Counter</span>
              </h3>

              <div>
                <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">Current Total Visitors</label>
                <input
                  type="number"
                  value={settings.visitorCount}
                  onChange={(e) => setSettings({ ...settings, visitorCount: Number(e.target.value) })}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 font-bold text-indigo-600"
                />
              </div>
            </div>

            <div className="pt-4 flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="flex items-center space-x-2 px-6 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold shadow-lg shadow-indigo-500/25 transition-all disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>{saving ? 'Saving...' : 'Save Settings'}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminSettings;
