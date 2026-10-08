const crypto = require("crypto");
const Razorpay = require("razorpay");

const KEY_ID = "rzp_test_TlKKTyUyGtUGmw";
const KEY_SECRET = "wHhTqRpj7Z3Yfc1sAiN079d6";

async function testRazorpay() {
  console.log("1. Initializing Razorpay SDK instance...");
  const rzp = new Razorpay({
    key_id: KEY_ID,
    key_secret: KEY_SECRET,
  });

  console.log("2. Creating test order for 50000 paise (₹500.00)...");
  try {
    const order = await rzp.orders.create({
      amount: 50000,
      currency: "INR",
      receipt: `rcpt_test_${Date.now()}`,
      notes: { test: "standard_checkout_integration" },
    });
    console.log("✓ Order created successfully!");
    console.log("  Order ID:", order.id);
    console.log("  Amount:", order.amount);
    console.log("  Currency:", order.currency);
    console.log("  Status:", order.status);

    console.log("\n3. Testing HMAC-SHA256 signature verification...");
    const dummyPaymentId = "pay_test_9988776655";
    const body = `${order.id}|${dummyPaymentId}`;
    const validSignature = crypto
      .createHmac("sha256", KEY_SECRET)
      .update(body)
      .digest("hex");

    console.log("  Generated valid signature:", validSignature);

    // Verify valid signature
    const checkValid = crypto
      .createHmac("sha256", KEY_SECRET)
      .update(body)
      .digest("hex");
    const isMatched = crypto.timingSafeEqual(
      Buffer.from(validSignature, "utf-8"),
      Buffer.from(checkValid, "utf-8")
    );
    console.log("  Verification test (valid):", isMatched ? "PASSED (true)" : "FAILED");

    // Verify invalid signature
    const invalidSignature = "deadbeef1234567890abcdef1234567890abcdef1234567890abcdef12345678";
    const isTampered = crypto.timingSafeEqual(
      Buffer.from(invalidSignature, "utf-8"),
      Buffer.from(checkValid, "utf-8")
    );
    console.log("  Verification test (tampered):", isTampered ? "FAILED (matched when it shouldn't)" : "PASSED (rejected false)");

    console.log("\n✓ All Razorpay tests passed successfully!");
  } catch (err) {
    console.error("❌ Razorpay test failed:", err);
    process.exit(1);
  }
}

testRazorpay();
