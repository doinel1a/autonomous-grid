import path from 'node:path';

import { appendToCSV } from '../utils/csv';
import { BASE_DATA_PATH, createBid, createOffer, getMarketSummary } from '../utils/shared';
import { TBid, TOffer } from '../utils/types';
import { runGridManagerAgent } from './grid-manager';
import { runProducerAgent } from './producer';

async function setupTestMarket(timestamp: string) {
  console.log('📦 Setting up test market with offers and bids...\n');

  createOffer({
    timestamp,
    seller_id: 'maria',
    kwh_available: 4.5,
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

  createBid({
    timestamp,
    buyer_id: 'pietro',
    kwh_needed: 3.0,
    max_price_eur_kwh: 0.25,
    status: 'active'
  });

  createBid({
    timestamp,
    buyer_id: 'lucia',
    kwh_needed: 1.5,
    max_price_eur_kwh: 0.23,
    status: 'active'
  });

  console.log('✅ Test market created:');
  console.log('🔘 Offers: Maria (4.5 kWh @ €0.22), Lucia (2.0 kWh @ €0.20)');
  console.log('🔘 Bids: Pietro (3.0 kWh @ max €0.25), Lucia (1.5 kWh @ max €0.23)');
  console.log('🔘 Expected matches: All should match!\n');
}

async function testGridManagerBasic() {
  console.log('🧪 TEST 1: Basic Grid Manager Operations');
  console.log('='.repeat(80));

  const timestamp = '2025-01-15T12:00:00';

  await setupTestMarket(timestamp);

  console.log(`⏰ Running Grid Manager at: ${timestamp}`);
  console.log('-'.repeat(80));

  try {
    const result = await runGridManagerAgent(timestamp);

    console.log('🤖 Grid Manager Response:');
    console.log(result.text);
    console.log('\n');

    console.log('📊 Steps taken:', result.steps?.length || 0);
    console.log('\n');

    console.log('💰 Token Usage:');
    console.log(`🔘 Prompt tokens: ${result.usage?.inputTokens || 0}`);
    console.log(`🔘 Completion tokens: ${result.usage?.outputTokens || 0}`);
    console.log(`🔘 Total tokens: ${result.usage?.totalTokens || 0}`);
    console.log('\n');

    const summary = getMarketSummary(timestamp);
    console.log('📈 Market Summary After:');
    console.log(`🔘 Active Offers: ${summary.offers_count}`);
    console.log(`🔘 Active Bids: ${summary.bids_count}`);
    console.log(`🔘 Supply: ${summary.total_supply_kwh.toFixed(2)} kWh`);
    console.log(`🔘 Demand: ${summary.total_demand_kwh.toFixed(2)} kWh`);
    console.log(`🔘 Balance: ${summary.balance_kwh.toFixed(2)} kWh`);
  } catch (error) {
    console.error('❌ Error:', error);
  }

  console.log('='.repeat(80));
}

async function testGridManagerWithProducer() {
  console.log('\n');
  console.log('='.repeat(80));
  console.log('🧪 TEST 2: Grid Manager + Producer Agent Integration');
  console.log('='.repeat(80));

  const timestamp = '2025-01-15T12:00:00';

  console.log('1 | First, Producer Agent (Maria) creates offers...');
  console.log('-'.repeat(80));

  try {
    const producerResult = await runProducerAgent('maria', timestamp);
    console.log('🌞 Maria (Producer):');
    console.log(producerResult.text);
    console.log('\n');

    console.log('2 | Creating test bid for Pietro...');
    createBid({
      timestamp,
      buyer_id: 'pietro',
      kwh_needed: 2.0,
      max_price_eur_kwh: 0.3,
      status: 'active'
    });
    console.log('✅ Pietro wants to buy 2 kWh @ max €0.30/kWh');
    console.log('\n');

    // Run Grid Manager
    console.log('3 | Now Grid Manager coordinates the market...');
    console.log('-'.repeat(80));

    const gridResult = await runGridManagerAgent(timestamp);
    console.log('🌐 Grid Manager:');
    console.log(gridResult.text);

    console.log('✅ Integration test complete!');
  } catch (error) {
    console.error('❌ Error:', error);
  }

  console.log('='.repeat(80));
}

async function testPricingScenarios() {
  console.log('\n');
  console.log('='.repeat(80));
  console.log('🧪 TEST 3: Dynamic Pricing Scenarios\n');
  console.log('='.repeat(80));

  const scenarios = [
    {
      name: 'Balanced Market',
      timestamp: '2025-01-15T12:00:00',
      offers: [{ seller: 'maria', kwh: 5.0, price: 0.22 }],
      bids: [{ buyer: 'pietro', kwh: 4.8, maxPrice: 0.25 }]
    },
    {
      name: 'Critical Deficit',
      timestamp: '2025-01-15T19:00:00',
      offers: [{ seller: 'lucia', kwh: 1.0, price: 0.3 }],
      bids: [
        { buyer: 'pietro', kwh: 5.0, maxPrice: 0.4 },
        { buyer: 'maria', kwh: 2.0, maxPrice: 0.35 }
      ]
    },
    {
      name: 'Surplus',
      timestamp: '2025-01-15T11:00:00',
      offers: [
        { seller: 'maria', kwh: 8.0, price: 0.2 },
        { seller: 'lucia', kwh: 5.0, price: 0.19 }
      ],
      bids: [{ buyer: 'pietro', kwh: 2.0, maxPrice: 0.25 }]
    }
  ];

  for (const scenario of scenarios) {
    console.log(`📊 Scenario: ${scenario.name}`);
    console.log('-'.repeat(80));

    for (const offer of scenario.offers) {
      createOffer({
        timestamp: scenario.timestamp,
        seller_id: offer.seller,
        kwh_available: offer.kwh,
        price_eur_kwh: offer.price,
        status: 'active'
      });
    }

    for (const bid of scenario.bids) {
      createBid({
        timestamp: scenario.timestamp,
        buyer_id: bid.buyer,
        kwh_needed: bid.kwh,
        max_price_eur_kwh: bid.maxPrice,
        status: 'active'
      });
    }

    const summary = getMarketSummary(scenario.timestamp);
    console.log(
      `Supply: ${summary.total_supply_kwh.toFixed(2)} kWh, Demand: ${summary.total_demand_kwh.toFixed(2)} kWh`
    );
    console.log(`Balance: ${summary.balance_kwh.toFixed(2)} kWh`);

    try {
      const result = await runGridManagerAgent(scenario.timestamp);
      console.log(result.text);
    } catch (error) {
      console.error('❌ Error:', error);
    }

    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  console.log('='.repeat(80));
}

async function runAllTests() {
  console.log('🚀 GRID MANAGER AGENT - TEST SUITE');

  try {
    // await testGridManagerBasic();
    // await new Promise((resolve) => setTimeout(resolve, 2000));

    // await testGridManagerWithProducer();
    // await new Promise((resolve) => setTimeout(resolve, 2000));

    await testPricingScenarios();

    console.log('✅ All Grid Manager tests completed!\n');
  } catch (error) {
    console.error('❌ Test suite failed:', error);
  }
}

runAllTests().catch(console.error);
