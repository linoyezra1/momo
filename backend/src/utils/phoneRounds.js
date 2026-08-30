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

/** Effective phone rounds for agent queue / dashboard badges. */
export function resolveMaxPhoneRounds(user) {
  const fromEvent = Number(user?.event?.maxPhoneRounds);
  const eventRounds =
    Number.isInteger(fromEvent) && fromEvent >= 0 && fromEvent <= 4 ? fromEvent : 0;
  const fromDeal = maxPhoneRoundsFromDealFeatures(user?.deal?.includedFeatures);
  return Math.max(eventRounds, fromDeal);
}

/** Default call capacity when main agent opens an event with no phone package configured. */
export const MAIN_AGENT_DEFAULT_PHONE_ROUNDS = 4;

/**
 * Agent call queue uses effective max — main agent gets a default when event deal has 0 rounds.
 */
export function resolveAgentQueueMaxPhoneRounds(user, agent) {
  const configured = resolveMaxPhoneRounds(user);
  if (configured > 0) {
    return { configured, effective: configured, usingMainAgentDefault: false };
  }
  if (agent?.isMainAgent === true) {
    return {
      configured: 0,
      effective: MAIN_AGENT_DEFAULT_PHONE_ROUNDS,
      usingMainAgentDefault: true
    };
  }
  return { configured: 0, effective: 0, usingMainAgentDefault: false };
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
