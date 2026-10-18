const express = require('express');
const router = express.Router();
const {
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
} = require('../controllers/paymentController');
const { protect } = require('../middleware/authMiddleware');
const { adminOnly } = require('../middleware/adminMiddleware');

// User payment flows
router.post('/initiate-upi', protect, initiateUpiOrder);
router.get('/status/:orderId', getOrderStatus);
router.post('/submit-utr', protect, submitUtrVerification);
router.get('/my-purchases', protect, getMyPurchases);
router.post('/simulate', simulatePayment);

// Android Bank Observer Companion Routes
router.get('/pair-qr', getPairQr);
router.get('/download-apk', downloadApk);
router.post('/pair', pairAndroidDevice);
router.post('/heartbeat', handleHeartbeat);
router.post('/events', handleBankObservation);

// Admin controls
router.put('/admin/approve/:id', protect, adminOnly, adminApproveOrder);
router.put('/admin/reject/:id', protect, adminOnly, adminRejectOrder);

module.exports = router;
