/**
 * Phone-agent queue capacity: event.maxPhoneRounds and deal.includedFeatures.phoneCallsRound*
 * must stay aligned. Agent queue reads the effective max from both sources.
 */

export function maxPhoneRoundsFromDealFeatures(includedFeatures = {}) {
  if (includedFeatures.phoneCallsRound4) return 4;
  if (includedFeatures.phoneCallsRound3) return 3;
  if (includedFeatures.phoneCallsRound2) return 2;
  if (includedFeatures.phoneCallsRound1) return 1;
  return 0;
}

export function applyPhoneRoundsToDealFeatures(maxPhoneRounds, includedFeatures = {}) {
  const max = Math.max(0, Math.min(4, Number(maxPhoneRounds) || 0));
  return {
    ...includedFeatures,
    phoneCallsRound1: max >= 1,
    phoneCallsRound2: max >= 2,
    phoneCallsRound3: max >= 3,
    phoneCallsRound4: max >= 4
  };
}

/** Effective phone rounds for agent queue / dashboard badges. Admin checkboxes are the source of truth for all agents. */
export function resolveMaxPhoneRounds(user) {
  const fromEvent = Number(user?.event?.maxPhoneRounds);
  const eventRounds =
    Number.isInteger(fromEvent) && fromEvent >= 0 && fromEvent <= 4 ? fromEvent : 0;
  const fromDeal = maxPhoneRoundsFromDealFeatures(user?.deal?.includedFeatures);
  return Math.max(eventRounds, fromDeal);
}

/** Mongo clause: guest received at least one WhatsApp invite. */
export function buildWhatsAppSentMongoClause() {
  return {
    $or: [
      { whatsappRoundsSentCount: { $gte: 1 } },
      { reminderRound: { $gte: 1 } },
      { lastWhatsAppSentAt: { $ne: null } }
    ]
  };
}

/** Mongo clause: guest still has remaining phone attempts under the cap. */
export function buildPhoneAttemptsUnderCapMongoClause(maxPhoneRounds) {
  const cap = Math.max(0, Number(maxPhoneRounds) || 0);
  if (cap <= 0) {
    return { phoneAttemptsCount: { $lt: 0 } };
  }
  return {
    $or: [
      { phoneAttemptsCount: { $lt: cap } },
      { phoneAttemptsCount: { $exists: false } }
    ]
  };
}
