import { getBatteryLevel } from '../utils/shared';
import { runProducerAgent } from './producer';

async function testProducerAgent() {
  console.log('🧪 Testing Producer Agent (Maria)');
  console.log('='.repeat(80));

  const testTimestamps = [
    '2025-01-15T00:00:00', // Night - no production
    '2025-01-15T09:00:00', // Morning - good production starting
    '2025-01-15T12:00:00', // Noon - peak production
    '2025-01-15T19:00:00' // Evening - no production, high consumption
  ];

  for (const timestamp of testTimestamps) {
    console.log(`⏰ Testing at: ${timestamp}`);
    console.log('-'.repeat(80));

    try {
      const result = await runProducerAgent('maria', timestamp);

      console.log('🤖 Agent Response:');
      console.log(result.text);

      console.log('📊 Steps taken:', result.steps?.length || 0);

      console.log('🔋 Current Battery Level:', getBatteryLevel('maria').toFixed(2), 'kWh');

      console.log('💰 Token Usage:');
      console.log(`🔘 Prompt tokens: ${result.usage?.inputTokens || 0}`);
      console.log(`🔘 Completion tokens: ${result.usage?.outputTokens || 0}`);
      console.log(`🔘 Total tokens: ${result.usage?.totalTokens || 0}`);
    } catch (error) {
      console.error('❌ Error:', error);
    }

    console.log('='.repeat(80));

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  console.log('✅ All tests completed!');
}

testProducerAgent().catch(console.error);
