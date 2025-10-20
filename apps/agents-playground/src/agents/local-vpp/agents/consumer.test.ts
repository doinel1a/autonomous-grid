import { createOffer, getEVChargingLevel } from '../utils/shared';
import { runConsumerAgent } from './consumer';

async function setupTestOffers(timestamp: string) {
  createOffer({
    timestamp,
    seller_id: 'maria',
    kwh_available: 5.0,
    price_eur_kwh: 0.22,
    status: 'active'
  });

  createOffer({
    timestamp,
    seller_id: 'lucia',
    kwh_available: 2.0,
    price_eur_kwh: 0.2,
    status: 'active'
  });
}

async function testConsumerAgent() {
  console.log('🧪 Testing Consumer Agent (Pietro)\n');
  console.log('='.repeat(80));
  const testTimestamps = [
    '2025-01-15T02:00:00', // Night - best for EV charging
    '2025-01-15T09:00:00', // Morning - prices rising
    '2025-01-15T12:00:00', // Noon - peak production
    '2025-01-15T19:00:00' // Evening - no production, high consumption
  ];

  for (const time of testTimestamps) {
    console.log(`⏰ Testing at: ${time}`);
    console.log('-'.repeat(80));

    await setupTestOffers(time);

    try {
      const result = await runConsumerAgent('pietro', time);

      console.log('🤖 Agent Response:');
      console.log(result.text);
      console.log('\n');

      console.log('📊 Steps taken:', result.steps?.length || 0);

      console.log(
        '🚗 EV Charging Status:',
        getEVChargingLevel('pietro').toFixed(2),
        'kWh / 20 kWh'
      );

      console.log('💰 Token Usage:');
      console.log(`🔘 Prompt tokens: ${result.usage?.inputTokens || 0}`);
      console.log(`🔘 Completion tokens: ${result.usage?.outputTokens || 0}`);
      console.log(`🔘 Total tokens: ${result.usage?.totalTokens || 0}`);
    } catch (error) {
      console.error('❌ Error:', error);
    }

    console.log('='.repeat(80));

    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  console.log('✅ All tests completed!\n');

  const finalCharge = getEVChargingLevel('pietro');
  const percentage = ((finalCharge / 20) * 100).toFixed(1);
  console.log(`🚗 Final EV Status: ${finalCharge.toFixed(2)} kWh charged (${percentage}%)`);
}

testConsumerAgent().catch(console.error);
