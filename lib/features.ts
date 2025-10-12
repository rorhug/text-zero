import 'server-only';
import { db } from './db/queries';
import { featureFlag } from './db/schema';
import { eq } from 'drizzle-orm';
import { FEATURES, type FeatureKey } from './features-client';

export { FEATURES, type FeatureKey };

/**
 * Get the enabled state of a feature flag.
 * Returns the default value if no row exists in the database.
 */
export async function getFeature(key: FeatureKey): Promise<boolean> {
  const feature = FEATURES[key];
  if (!feature) {
    throw new Error(`Unknown feature: ${key}`);
  }

  const row = await db
    .select()
    .from(featureFlag)
    .where(eq(featureFlag.key, key))
    .get();

  return row ? row.enabled : feature.default;
}

/**
 * Get all feature flags with their enabled states.
 * Returns default values for features not in the database.
 */
export async function getAllFeatures(): Promise<
  Record<FeatureKey, boolean>
> {
  const rows = await db.select().from(featureFlag);
  const rowMap = new Map(rows.map((row) => [row.key, row.enabled]));

  const result = {} as Record<FeatureKey, boolean>;
  for (const [key, feature] of Object.entries(FEATURES)) {
    result[key as FeatureKey] = rowMap.get(key) ?? feature.default;
  }

  return result;
}

/**
 * Set the enabled state of a feature flag.
 * Upserts the feature in the database.
 */
export async function setFeature(
  key: FeatureKey,
  enabled: boolean,
): Promise<void> {
  const feature = FEATURES[key];
  if (!feature) {
    throw new Error(`Unknown feature: ${key}`);
  }

  const existing = await db
    .select()
    .from(featureFlag)
    .where(eq(featureFlag.key, key))
    .get();

  if (existing) {
    await db
      .update(featureFlag)
      .set({ enabled, updatedAt: new Date() })
      .where(eq(featureFlag.key, key));
  } else {
    await db.insert(featureFlag).values({
      key,
      enabled,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }
}
