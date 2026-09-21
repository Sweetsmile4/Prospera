import { MerchantMapping } from "../models/MerchantMapping";
import { Transaction } from "../models/Transaction";
import { Types } from "mongoose";

const NORMALIZATION_RULES: Array<{ pattern: RegExp; merchant: string }> = [
  { pattern: /amzn|amazon/i, merchant: "Amazon" },
  { pattern: /swiggy/i, merchant: "Swiggy" },
  { pattern: /zomato/i, merchant: "Zomato" },
  { pattern: /netflix/i, merchant: "Netflix" },
  { pattern: /spotify/i, merchant: "Spotify" },
  { pattern: /flipkart/i, merchant: "Flipkart" },
  { pattern: /uber/i, merchant: "Uber" },
  { pattern: /ola/i, merchant: "Ola" },
  { pattern: /phonepe|phone.?pe/i, merchant: "PhonePe" },
  { pattern: /paytm/i, merchant: "Paytm" },
  { pattern: /gpay|google.?pay/i, merchant: "Google Pay" },
  { pattern: /rapido/i, merchant: "Rapido" },
  { pattern: /bigbasket|bb/i, merchant: "BigBasket" },
  { pattern: /jiomart/i, merchant: "JioMart" },
  { pattern: /cred/i, merchant: "CRED" },
  { pattern: /housing\.com/i, merchant: "Housing.com" },
  { pattern: /ntpc|electricity|bescom|msedcl|torrent|adani|tatapower/i, merchant: "Electricity Bill" },
  { pattern: /airtel|jio|vi |bsnl|reliance.?comm/i, merchant: "Mobile Recharge" },
  { pattern: /insurance|lic|star health|hdfc ergo/i, merchant: "Insurance" },
  { pattern: /sip|mutual.?fund|mf purchase/i, merchant: "SIP / Mutual Fund" },
];

function normalizeFromRules(description: string): string | null {
  for (const rule of NORMALIZATION_RULES) {
    if (rule.pattern.test(description)) return rule.merchant;
  }
  return null;
}

function cleanDescription(description: string): string {
  return description
    .replace(/[0-9]{8,}/g, "")
    .replace(/[/\\]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export async function normalizeMerchant(
  userId: Types.ObjectId,
  description: string
): Promise<string> {
  const trimmed = description.trim();

  const existing = await MerchantMapping.findOne({ userId, originalDescription: trimmed });
  if (existing) {
    await MerchantMapping.findByIdAndUpdate(existing._id, {
      $inc: { occurrenceCount: 1 },
      lastSeenAt: new Date(),
    });
    return existing.normalizedMerchant;
  }

  const fromRules = normalizeFromRules(trimmed);
  const normalized = fromRules || cleanDescription(trimmed);

  await MerchantMapping.findOneAndUpdate(
    { userId, originalDescription: trimmed },
    {
      $setOnInsert: { normalizedMerchant: normalized, userId },
      $inc: { occurrenceCount: 1 },
      $set: { lastSeenAt: new Date() },
    },
    { upsert: true, new: true }
  );

  return normalized;
}

export async function getMerchantMappings(userId: Types.ObjectId) {
  return MerchantMapping.find({ userId }).sort({ occurrenceCount: -1 }).limit(200);
}

export async function updateMerchantMapping(
  userId: Types.ObjectId,
  id: string,
  data: { normalizedMerchant?: string; categoryId?: string }
) {
  const mapping = await MerchantMapping.findOneAndUpdate(
    { _id: id, userId },
    data,
    { returnDocument: "after", runValidators: true }
  );
  return mapping;
}

export async function deleteMerchantMapping(userId: Types.ObjectId, id: string) {
  return MerchantMapping.findOneAndDelete({ _id: id, userId });
}

export async function applyMerchantNormalization(userId: Types.ObjectId) {
  const unmapped = await Transaction.find({
    userId,
    normalizedMerchant: { $exists: false },
    source: "import",
  }).limit(500);

  let normalized = 0;
  for (const tx of unmapped) {
    const merchant = await normalizeMerchant(userId, tx.title);
    await Transaction.findByIdAndUpdate(tx._id, { normalizedMerchant: merchant });
    normalized++;
  }
  return { normalized };
}
