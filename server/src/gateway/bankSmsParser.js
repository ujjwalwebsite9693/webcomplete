/**
 * Intelligent Monetary Amount Extractor for Indian UPI & Bank SMS.
 */
function extractIntelligentAmount(text) {
  if (!text || typeof text !== 'string') return null;

  // Pattern 1: Standard currency prefix (e.g. Rs 499, Rs. 499, ₹499, INR 499)
  const prefixMatch = text.match(/(?:(?:rs\.?|inr)\b|₹)[\s:=-]*([\d,]+(?:\.\d{1,2})?)/i);
  if (prefixMatch && prefixMatch[1]) {
    const clean = prefixMatch[1].replace(/,/g, '');
    return { amountStr: clean, amountPaise: Math.round(Number(clean) * 100) };
  }

  // Pattern 2: Standard currency suffix (e.g. 499 Rs, 499.00 INR, 20.00 Rs)
  const suffixMatch = text.match(/(?:^|[^\w.])([\d,]+(?:\.\d{1,2})?)[\s:=-]*(?:(?:rs\.?|inr)\b|₹)/i);
  if (suffixMatch && suffixMatch[1]) {
    const clean = suffixMatch[1].replace(/,/g, '');
    return { amountStr: clean, amountPaise: Math.round(Number(clean) * 100) };
  }

  // Pattern 3: Adjacent to credit keywords
  const creditProximityMatch = text.match(/(?:credited|received|deposit|payment|paid|transferred|upi|cr)[\s\w:]*?([\d,]+(?:\.\d{1,2})?)|([\d,]+(?:\.\d{1,2})?)[\s\w:]*?(?:credited|received|deposit|payment|paid|transferred|upi|cr)/i);
  if (creditProximityMatch) {
    const rawVal = creditProximityMatch[1] || creditProximityMatch[2];
    if (rawVal) {
      const clean = rawVal.replace(/,/g, '');
      if (/^\d+(\.\d{1,2})?$/.test(clean) && Number(clean) < 10000000 && Number(clean) > 0) {
        return { amountStr: clean, amountPaise: Math.round(Number(clean) * 100) };
      }
    }
  }

  // Pattern 4: Standalone decimal currency number (e.g. 449.00, 1999.00)
  const standaloneDecimal = text.match(/\b(\d{1,6}\.\d{2})\b/);
  if (standaloneDecimal && standaloneDecimal[1]) {
    const clean = standaloneDecimal[1];
    return { amountStr: clean, amountPaise: Math.round(Number(clean) * 100) };
  }

  return null;
}

/**
 * Bank and UPI SMS parser for Indian financial institutions:
 * SBI, HDFC, ICICI, Axis, Kotak, PNB, Bank of Baroda, Paytm, PhonePe, GPay, etc.
 */
class BankSmsParser {
  static parse(sms) {
    const text = (typeof sms === 'string' ? sms : (sms.text || sms.body || sms.message || '')).trim();
    if (!text) return null;

    // Check if SMS represents an incoming credit
    const creditKeywords = /(credited|received|deposit|payment received|payment|upi\/cr|transferred)/i;
    if (!creditKeywords.test(text)) {
      return null;
    }

    // Ignore pure debits
    if (/(debited|withdrawn|sent rs|paid rs)/i.test(text) && !/(credited|received|deposit)/i.test(text)) {
      return null;
    }

    // Extract Amount
    const amountObj = extractIntelligentAmount(text);
    if (!amountObj) return null;

    // Extract 12-Digit Bank Reference Number (UTR / RRN)
    let bankReferenceNumber = null;
    const refMatch = text.match(/(?:upi\s*ref(?:\s*no\.?)?|ref\s*no\.?|rrn|utr|txn\s*id|reference)[\s:=-]*([0-9]{12})/i);
    if (refMatch && refMatch[1]) {
      bankReferenceNumber = refMatch[1];
    } else {
      const standalone12 = text.match(/\b([0-9]{12})\b/);
      if (standalone12 && standalone12[1]) {
        bankReferenceNumber = standalone12[1];
      }
    }

    // Extract Sender VPA
    let senderVpa = null;
    const vpaMatch = text.match(/(?:from|by|payer|vpa)[\s:=-]*([a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64})/i);
    if (vpaMatch && vpaMatch[1]) {
      senderVpa = vpaMatch[1].toLowerCase();
    }

    return {
      amount: amountObj.amountStr,
      amountPaise: amountObj.amountPaise,
      bankReferenceNumber,
      senderVpa,
      rawText: text
    };
  }
}

module.exports = {
  extractIntelligentAmount,
  BankSmsParser
};
