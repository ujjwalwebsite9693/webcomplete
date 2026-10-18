const path = require('path');
const fs = require('fs');
const Order = require('../models/Order');
const Project = require('../models/Project');
const User = require('../models/User');
const SiteSetting = require('../models/SiteSetting');
const { generateQrSvg, generateQrDataUri } = require('../gateway/qr');
const { BankSmsParser } = require('../gateway/bankSmsParser');

// Registered paired Android handsets
const pairedDevices = new Map();

// Helper to resolve backend base URL
function getBackendBaseUrl(req) {
  if (process.env.BACKEND_PUBLIC_URL) return process.env.BACKEND_PUBLIC_URL.replace(/\/+$/, '');
  const proto = req.headers['x-forwarded-proto'] || req.protocol || 'http';
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost:5000';
  return `${proto}://${host}`;
}

// -------------------------------------------------------------
// 1. INITIATE DIRECT UPI QR ORDER
// -------------------------------------------------------------
const initiateUpiOrder = async (req, res) => {
  try {
    const { projectId, customerPhone, couponCode } = req.body;

    if (!projectId) {
      return res.status(400).json({ success: false, message: 'Project ID is required' });
    }

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    let settings = await SiteSetting.findOne();
    if (!settings) {
      settings = await SiteSetting.create({});
    }

    let amount = (project.discountPrice && project.discountPrice > 0 && project.discountPrice < project.price)
      ? project.discountPrice
      : project.price;

    // Apply Coupon Code if provided
    if (couponCode) {
      const Coupon = require('../models/Coupon');
      const validCoupon = await Coupon.findOne({ code: couponCode.toUpperCase().trim(), isActive: true });
      if (validCoupon) {
        const discountVal = (amount * validCoupon.discountPercentage) / 100;
        const finalDiscount = Math.min(discountVal, validCoupon.maxDiscount || discountVal);
        amount = Math.max(1, Math.round(amount - finalDiscount));
      }
    }

    const monthNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    const currentMonth = monthNames[new Date().getMonth()];
    const random3Digits = String(Math.floor(1 + Math.random() * 999)).padStart(3, '0');
    const orderId = `uverse-${currentMonth}-${random3Digits}`;
    const secretRefCode = `REF-${Math.floor(100000 + Math.random() * 900000)}`;

    const cleanUpiId = (process.env.MERCHANT_UPI_VPA || settings.upiId || '9241034816@mbkns').trim();
    const cleanUpiName = (process.env.MERCHANT_NAME || settings.upiName || 'EasyUVerse').replace(/[^a-zA-Z0-9 ]/g, '').trim() || 'EasyUVerse';

    // Standard NPCI compliant UPI URI format
    const upiUri = `upi://pay?pa=${cleanUpiId}&pn=${encodeURIComponent(cleanUpiName)}&am=${amount}&cu=INR&tn=${encodeURIComponent('Order ' + orderId)}`;

    // Pure JS Crisp Data URI QR Code (Zero 3rd party dependency)
    const qrCodeUrl = generateQrDataUri(upiUri, 300);
    const qrSvg = generateQrSvg(upiUri, 300);

    // Create pending order
    const newOrder = await Order.create({
      user: req.user._id,
      project: project._id,
      amount,
      currency: 'INR',
      orderId,
      secretRefCode,
      paymentStatus: 'PENDING_VERIFICATION',
      paymentMethod: 'DIRECT_UPI_QR',
      customerDetails: {
        name: req.user.name,
        email: req.user.email,
        phone: customerPhone || req.user.phone || '',
      },
    });

    res.json({
      success: true,
      data: {
        orderId: newOrder.orderId,
        secretRefCode,
        amount,
        upiId: cleanUpiId,
        upiName: cleanUpiName,
        qrCodeUrl,
        qrSvg,
        upiUri,
      },
    });
  } catch (error) {
    console.error('Initiate UPI Exception:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// -------------------------------------------------------------
// 2. REAL-TIME ORDER STATUS CHECK (For Live Polling in Modal)
// -------------------------------------------------------------
const getOrderStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const order = await Order.findOne({ orderId }).populate('project');

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    res.json({
      success: true,
      status: order.paymentStatus,
      orderId: order.orderId,
      amount: order.amount,
      utrNumber: order.utrNumber,
      downloadUrl: order.paymentStatus === 'SUCCESS' ? order.project?.downloadUrl : null,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// -------------------------------------------------------------
// 3. SUBMIT 12-DIGIT UTR & INSTANT VERIFICATION
// -------------------------------------------------------------
const submitUtrVerification = async (req, res) => {
  try {
    const { orderId, utrNumber } = req.body;

    if (!orderId || !utrNumber) {
      return res.status(400).json({
        success: false,
        message: 'Order ID and 12-Digit UTR Number are required',
      });
    }

    const cleanUtr = utrNumber.toString().replace(/\D/g, '').trim();

    // 1. Strict Server-Side Validation: Must be exactly 12 numeric digits
    if (cleanUtr.length !== 12 || !/^\d{12}$/.test(cleanUtr)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid UTR format. UTR number must be exactly 12 digits (numbers only, e.g. 426189012345).',
      });
    }

    // 2. Prevent Duplicate UTR Reuse
    const existingUsedUtr = await Order.findOne({
      utrNumber: cleanUtr,
      paymentStatus: 'SUCCESS',
      orderId: { $ne: orderId }
    });

    if (existingUsedUtr) {
      return res.status(400).json({
        success: false,
        message: 'This UTR / Transaction Reference Number has already been used on another order.',
      });
    }

    const order = await Order.findOne({ orderId }).populate('project');
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order record not found' });
    }

    let settings = await SiteSetting.findOne();
    const shouldAutoApprove = !settings || settings.autoApproveUtr !== false;

    order.utrNumber = cleanUtr;

    if (shouldAutoApprove) {
      order.paymentStatus = 'SUCCESS';

      // Unlock project for user
      const user = await User.findById(order.user);
      if (user && order.project && !user.purchasedProjects.includes(order.project._id)) {
        user.purchasedProjects.push(order.project._id);
        await user.save();
      }

      if (order.project) {
        await Project.findByIdAndUpdate(order.project._id, { $inc: { salesCount: 1 } });
      }

      await order.save();

      return res.json({
        success: true,
        message: 'UTR Verified Successfully! Cloudinary source code zip unlocked.',
        data: {
          order,
          status: 'SUCCESS',
          downloadUrl: order.project?.downloadUrl || '',
        },
      });
    } else {
      order.paymentStatus = 'PENDING_VERIFICATION';
      await order.save();

      return res.json({
        success: true,
        message: '12-Digit UTR Number submitted successfully! Order is pending verification by admin.',
        data: {
          order,
          status: 'PENDING_VERIFICATION',
        },
      });
    }
  } catch (error) {
    console.error('Submit UTR Exception:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// -------------------------------------------------------------
// 4. ANDROID COMPANION APP PAIRING & LIVENESS
// -------------------------------------------------------------
const pairAndroidDevice = (req, res) => {
  const deviceId = req.body?.deviceId || req.headers['x-device-id'] || ('dev-' + Date.now());
  const deviceName = req.body?.deviceName || 'Android Mobile Observer';
  const deviceModel = req.body?.deviceModel || 'Android Device';
  const signingKey = 'sign_' + Buffer.from(deviceId + ':' + Date.now()).toString('hex').slice(0, 32);

  const deviceRecord = {
    id: deviceId,
    deviceName,
    deviceModel,
    signingKey,
    isActive: true,
    lastHeartbeatAt: new Date().toISOString(),
    lastObservationAt: null,
    pairedAt: new Date().toISOString()
  };

  pairedDevices.set(deviceId, deviceRecord);
  console.log(`[EasyUVerse Gateway Paired]: ${deviceName} (${deviceId}) connected successfully.`);

  res.json({
    status: 'PAIRED',
    success: true,
    paired: true,
    deviceId,
    signingKey,
    serverTime: Date.now()
  });
};

const handleHeartbeat = (req, res) => {
  const deviceId = req.headers['x-device-id'] || req.body?.deviceId;
  if (deviceId && pairedDevices.has(deviceId)) {
    const dev = pairedDevices.get(deviceId);
    dev.lastHeartbeatAt = new Date().toISOString();
    dev.isActive = true;
  }
  res.json({
    status: 'HEARTBEAT_ACK',
    success: true,
    timestamp: Date.now()
  });
};

// -------------------------------------------------------------
// 5. INCOMING BANK SMS / OBSERVER INGESTION
// -------------------------------------------------------------
const handleBankObservation = async (req, res) => {
  try {
    const body = req.body || {};
    const deviceId = req.headers['x-device-id'] || body.deviceId;

    if (deviceId && pairedDevices.has(deviceId)) {
      const dev = pairedDevices.get(deviceId);
      dev.lastObservationAt = new Date().toISOString();
      dev.lastHeartbeatAt = new Date().toISOString();
    }

    let creditedAmount = null;
    let utr = null;
    let senderVpa = 'Unknown';

    // Mode A: Android App sendObservation (already parsed amount & utr)
    if (body.amount !== undefined || body.amountPaise !== undefined) {
      creditedAmount = Number(body.amount) || (Number(body.amountPaise) / 100);
      utr = body.bankReferenceNumber || body.utr || ('UTR' + Date.now().toString().slice(-8));
      senderVpa = body.senderVpa || 'UPI Payment';
    }
    // Mode B: Android App sendSms (raw SMS text)
    else {
      const text = body.text || body.body || body.message || body.rawNotification?.text || body.rawPayload?.text || '';
      console.log('[EasyUVerse Gateway SMS Received]:', text.slice(0, 80));

      const parsed = BankSmsParser.parse({ text, timestamp: body.timestamp });
      if (parsed && parsed.amount) {
        creditedAmount = Number(parsed.amount);
        utr = parsed.bankReferenceNumber || ('UTR' + Date.now().toString().slice(-8));
        senderVpa = parsed.senderVpa || 'Unknown';
      }
    }

    if (!creditedAmount || isNaN(creditedAmount)) {
      return res.json({
        accepted: true,
        status: 'PROCESSED_NON_CREDIT',
        message: 'Event received but no bank credit detected.'
      });
    }

    console.log(`[Bank Credit Detected]: Amount=₹${creditedAmount}, UTR=${utr}, Sender=${senderVpa}`);

    // Look for pending order matching this amount
    const matchedOrder = await Order.findOne({
      paymentStatus: 'PENDING_VERIFICATION',
      amount: creditedAmount
    }).sort({ createdAt: -1 }).populate('project');

    if (matchedOrder) {
      matchedOrder.paymentStatus = 'SUCCESS';
      matchedOrder.utrNumber = utr;

      // Unlock project for user
      const user = await User.findById(matchedOrder.user);
      if (user && matchedOrder.project && !user.purchasedProjects.includes(matchedOrder.project._id)) {
        user.purchasedProjects.push(matchedOrder.project._id);
        await user.save();
      }

      if (matchedOrder.project) {
        await Project.findByIdAndUpdate(matchedOrder.project._id, { $inc: { salesCount: 1 } });
      }

      await matchedOrder.save();
      console.log(`🎉 [Bank Match Success]: Order ${matchedOrder.orderId} marked as SUCCESS via Bank SMS!`);

      return res.json({
        accepted: true,
        status: 'MATCHED_AND_CONFIRMED',
        orderId: matchedOrder.orderId,
        utr,
        amount: creditedAmount
      });
    }

    return res.json({
      accepted: true,
      status: 'CREDIT_INGESTED_NO_PENDING_MATCH',
      utr,
      amount: creditedAmount
    });
  } catch (err) {
    console.error('[Gateway Observation Error]:', err);
    res.status(500).json({ error: err.message });
  }
};

// -------------------------------------------------------------
// 6. PAIRING QR FOR ANDROID APP
// -------------------------------------------------------------
const getPairQr = (req, res) => {
  const customServerUrl = req.query.serverUrl;
  const serverUrl = customServerUrl ? customServerUrl.replace(/\/+$/, '') : getBackendBaseUrl(req);
  const token = process.env.ANDROID_ENROLLMENT_SECRET || 'easyuverse_android_secret_token_12345';
  const sessionId = Math.random().toString(36).substring(2, 10);

  const pairingPayload = JSON.stringify({
    version: 'v1',
    type: 'YOUPI_SMS_GATEWAY_PAIR',
    serverUrl,
    gatewayUrl: serverUrl,
    apiBaseUrl: serverUrl,
    token,
    enrollmentToken: token,
    sessionId,
    createdAt: Date.now()
  });

  const pairingQrSvg = generateQrSvg(pairingPayload, 260);

  res.json({
    success: true,
    serverUrl,
    enrollmentToken: token,
    pairingQrSvg,
    devices: Array.from(pairedDevices.values())
  });
};

// -------------------------------------------------------------
// 7. DOWNLOAD OBSERVER APK
// -------------------------------------------------------------
const downloadApk = (req, res) => {
  const candidates = [
    path.resolve(__dirname, '../../youpi-sms-gateway.apk'),
    path.resolve(__dirname, '../../../youpi-sms-gateway.apk'),
    path.resolve(__dirname, '../../uploads/youpi-sms-gateway.apk'),
    path.resolve(process.cwd(), 'youpi-sms-gateway.apk')
  ];

  for (const p of candidates) {
    if (fs.existsSync(p)) {
      res.setHeader('Content-Type', 'application/vnd.android.package-archive');
      res.setHeader('Content-Disposition', 'attachment; filename="youpi-sms-gateway.apk"');
      return fs.createReadStream(p).pipe(res);
    }
  }

  res.status(404).send('APK file not found on server.');
};

// -------------------------------------------------------------
// 8. TEST PAYMENT SIMULATOR
// -------------------------------------------------------------
const simulatePayment = async (req, res) => {
  try {
    const { orderId } = req.body;
    const order = await Order.findOne({ orderId }).populate('project');

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const testUtr = 'SIM' + Math.floor(1000000000 + Math.random() * 9000000000);
    order.paymentStatus = 'SUCCESS';
    order.utrNumber = testUtr;

    const user = await User.findById(order.user);
    if (user && order.project && !user.purchasedProjects.includes(order.project._id)) {
      user.purchasedProjects.push(order.project._id);
      await user.save();
    }

    if (order.project) {
      await Project.findByIdAndUpdate(order.project._id, { $inc: { salesCount: 1 } });
    }

    await order.save();

    res.json({
      success: true,
      message: 'Test payment simulation succeeded.',
      orderId,
      status: 'SUCCESS',
      utr: testUtr,
      downloadUrl: order.project?.downloadUrl || ''
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// -------------------------------------------------------------
// 9. ADMIN ACTIONS
// -------------------------------------------------------------
const adminApproveOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id).populate('project');
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    if (order.paymentStatus !== 'SUCCESS') {
      order.paymentStatus = 'SUCCESS';

      const user = await User.findById(order.user);
      if (user && order.project && !user.purchasedProjects.includes(order.project._id)) {
        user.purchasedProjects.push(order.project._id);
        await user.save();
      }

      if (order.project) {
        await Project.findByIdAndUpdate(order.project._id, { $inc: { salesCount: 1 } });
      }

      await order.save();
    }

    res.json({
      success: true,
      message: 'Order approved successfully!',
      data: order,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const adminRejectOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    order.paymentStatus = 'REJECTED';
    await order.save();

    res.json({
      success: true,
      message: 'Order rejected',
      data: order,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getMyPurchases = async (req, res) => {
  try {
    const orders = await Order.find({ user: req.user._id })
      .populate('project')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: orders,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  initiateUpiOrder,
  getOrderStatus,
  submitUtrVerification,
  pairAndroidDevice,
  handleHeartbeat,
  handleBankObservation,
  getPairQr,
  downloadApk,
  simulatePayment,
  adminApproveOrder,
  adminRejectOrder,
  getMyPurchases,
};
