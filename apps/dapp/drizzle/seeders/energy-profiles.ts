import { energyProfile } from '~/src/lib/constants/shared';
import { eq } from 'drizzle-orm';

import db from '../index';
import { energyProfilesSchema } from '../schemas/energy-profiles';

const energyProfiles = [
  { role: energyProfile.consumer },
  { role: energyProfile.producer },
  { role: energyProfile.prosumer }
];

export async function seedEnergyProfiles() {
  console.log('🌱 Seeding energy profiles...');

  try {
    for (const profile of energyProfiles) {
      const existing = await db
        .select()
        .from(energyProfilesSchema)
        .where(eq(energyProfilesSchema.role, profile.role))
        .limit(1);

      if (existing.length > 0) {
        await db
          .update(energyProfilesSchema)
          .set({ updatedAt: new Date() })
          .where(eq(energyProfilesSchema.role, profile.role));

        console.log(`✅ Updated energy profile: ${profile.role}`);
      } else {
        await db.insert(energyProfilesSchema).values(profile);

        console.log(`✅ Created energy profile: ${profile.role}`);
      }
    }

    const currentRoles = new Set(energyProfiles.map((profile) => profile.role));
    const allProfiles = await db.select().from(energyProfilesSchema);

    for (const profile of allProfiles) {
      if (!currentRoles.has(profile.role)) {
        await db.delete(energyProfilesSchema).where(eq(energyProfilesSchema.id, profile.id));

        console.log(`🗑️  Deleted energy profile: ${profile.role}`);
      }
    }

    console.log('✨ Energy profiles seeding completed!');
  } catch (error) {
    console.error('❌ Error seeding energy profiles:', error);
    throw error;
  }
}
