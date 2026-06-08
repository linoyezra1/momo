import express from "express";

const router = express.Router();

router.post("/twilio-compliance", (req, res) => {
  const { ComplianceProfileSid, VerificationStatus, FailureReason } = req.body;

  console.log(
    `[Twilio Webhook] Profile ${ComplianceProfileSid || "unknown"} status updated to: ${VerificationStatus || "unknown"}`
  );

  if (VerificationStatus === "approved") {
    console.log("Twilio Compliance Approved! We are ready to go live.");
  } else if (VerificationStatus === "rejected") {
    console.error(`Twilio Compliance Rejected. Reason: ${FailureReason || "not provided"}`);
  }

  res.status(200).send("Webhook received successfully");
});

export default router;
