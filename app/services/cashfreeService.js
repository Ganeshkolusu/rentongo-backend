const { Cashfree, CFEnvironment } = require("cashfree-pg");
const cashfreeConfig = require("../../config/cashfree.config");

const cashfree = new Cashfree(
  cashfreeConfig.env === "PRODUCTION" ? CFEnvironment.PRODUCTION : CFEnvironment.SANDBOX,
  cashfreeConfig.appId,
  cashfreeConfig.secretKey
);

/**
 * Create a Cashfree order for a one-time subscription-period payment.
 * @param {Object} params
 * @param {string} params.orderId - our own unique order id
 * @param {number} params.amount - order amount in INR
 * @param {string} params.customerId - our User _id
 * @param {string} params.customerEmail
 * @param {string} params.customerPhone - required by Cashfree's order API
 * @param {string} [params.returnUrl]
 * @returns {Promise<{paymentSessionId: string, orderId: string}>}
 */
exports.createOrder = async ({ orderId, amount, customerId, customerEmail, customerPhone, returnUrl }) => {
  const response = await cashfree.PGCreateOrder({
    order_id: orderId,
    order_amount: amount,
    order_currency: "INR",
    customer_details: {
      customer_id: customerId,
      customer_email: customerEmail,
      customer_phone: customerPhone,
    },
    order_meta: returnUrl ? { return_url: returnUrl } : undefined,
  });

  return {
    paymentSessionId: response.data.payment_session_id,
    orderId: response.data.order_id,
  };
};

/**
 * Verify a Cashfree webhook's signature via the official SDK and return the
 * parsed webhook body (`{ type, data }`, e.g. `data.order.order_id`) on
 * success, or null if the signature doesn't match.
 * The raw (unparsed) request body MUST be used — re-serializing a parsed
 * JSON object will not reliably reproduce the exact bytes Cashfree signed.
 * See server.js for why this route is mounted with express.raw() ahead of
 * the global express.json().
 * @param {Buffer|string} rawBody
 * @param {string} signatureHeader
 * @param {string} timestampHeader
 * @returns {{ type: string, data: any } | null}
 */
exports.verifyWebhookSignature = (rawBody, signatureHeader, timestampHeader) => {
  if (!signatureHeader || !timestampHeader) return null;

  const bodyString = Buffer.isBuffer(rawBody) ? rawBody.toString("utf8") : rawBody;

  try {
    // event.object is the already-parsed webhook body, i.e. { type, data }
    // — return it as-is rather than re-wrapping it.
    return cashfree.PGVerifyWebhookSignature(signatureHeader, bodyString, timestampHeader).object;
  } catch (error) {
    return null;
  }
};
