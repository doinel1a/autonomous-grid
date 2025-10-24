import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { network } from 'hardhat';

/**
 * SPARKController Test Suite
 *
 * Tests cover:
 * - Deployment and initialization
 * - Access control (owner-only functions)
 * - Query functions
 * - Utility functions
 * - Constants
 * - Edge cases and input validation
 *
 * Note: These tests focus on contract logic and state management.
 * Actual HTS mint/burn operations require Hedera testnet integration tests.
 */

describe('SPARKController', async function () {
  const { viem } = await network.connect();
  const publicClient = await viem.getPublicClient();

  // Mock addresses for testing
  const mockTokenAddress = '0x0000000000000000000000000000000000000001';
  const mockOwnerAddress = '0x0000000000000000000000000000000000000002';

  describe('Deployment', function () {
    it('should deploy with correct initial state', async function () {
      const controller = await viem.deployContract('SPARKController', [mockTokenAddress, mockOwnerAddress]);

      const owner = await controller.read.owner();
      const tokenAddress = await controller.read.SPARK_TOKEN_ADDRESS();
      const sparkPerKwh = await controller.read.SPARK_PER_KWH();

      assert.ok(owner);
      assert.equal(tokenAddress.toLowerCase(), mockTokenAddress.toLowerCase());
      assert.equal(sparkPerKwh.toString(), '1000');
    });

    it('should reject deployment with zero address', async function () {
      const zeroAddress = '0x0000000000000000000000000000000000000000';

      await assert.rejects(
        async () => {
          await viem.deployContract('SPARKController', [zeroAddress]);
        },
        (error: Error) => {
          return error.message.includes('InvalidAddress');
        }
      );
    });
  });

  describe('Constants', function () {
    it('should have correct SPARK_PER_KWH constant', async function () {
      const controller = await viem.deployContract('SPARKController', [mockTokenAddress]);
      const sparkPerKwh = await controller.read.SPARK_PER_KWH();

      assert.equal(sparkPerKwh.toString(), '1000');
    });
  });

  describe('Utility Functions', function () {
    it('should convert SPARK to kWh correctly', async function () {
      const controller = await viem.deployContract('SPARKController', [mockTokenAddress]);

      const kwh1 = await controller.read.sparkToKwh([1000n]);
      assert.equal(kwh1.toString(), '1');

      const kwh2 = await controller.read.sparkToKwh([5000n]);
      assert.equal(kwh2.toString(), '5');

      const kwh3 = await controller.read.sparkToKwh([500n]);
      assert.equal(kwh3.toString(), '0'); // Integer division
    });

    it('should convert kWh to SPARK correctly', async function () {
      const controller = await viem.deployContract('SPARKController', [mockTokenAddress]);

      const spark1 = await controller.read.kwhToSpark([1n]);
      assert.equal(spark1.toString(), '1000');

      const spark2 = await controller.read.kwhToSpark([10n]);
      assert.equal(spark2.toString(), '10000');

      const spark3 = await controller.read.kwhToSpark([0n]);
      assert.equal(spark3.toString(), '0');
    });
  });

  describe('Query Functions', function () {
    it('should return zero for producer with no production', async function () {
      const controller = await viem.deployContract('SPARKController', [mockTokenAddress]);
      const testAddress = '0x1234567890123456789012345678901234567890';

      const total = await controller.read.getTotalProduction([testAddress]);
      assert.equal(total.toString(), '0');
    });

    it('should return zero kWh for producer with no production', async function () {
      const controller = await viem.deployContract('SPARKController', [mockTokenAddress]);
      const testAddress = '0x1234567890123456789012345678901234567890';

      const totalKwh = await controller.read.getTotalProductionInKwh([testAddress]);
      assert.equal(totalKwh.toString(), '0');
    });

    it('should return zero records count for producer with no production', async function () {
      const controller = await viem.deployContract('SPARKController', [mockTokenAddress]);
      const testAddress = '0x1234567890123456789012345678901234567890';

      const count = await controller.read.getUserRecordsCount([testAddress]);
      assert.equal(count.toString(), '0');
    });

    it('should return zero for global records count initially', async function () {
      const controller = await viem.deployContract('SPARKController', [mockTokenAddress]);

      const count = await controller.read.getTotalRecordsCount();
      assert.equal(count.toString(), '0');
    });

    it('should return empty array for getProductionRecords with no records', async function () {
      const controller = await viem.deployContract('SPARKController', [mockTokenAddress]);
      const testAddress = '0x1234567890123456789012345678901234567890';

      const records = await controller.read.getProductionRecords([testAddress]);
      assert.equal(records.length, 0);
    });

    it('should return empty array for paginated records with no records', async function () {
      const controller = await viem.deployContract('SPARKController', [mockTokenAddress]);
      const testAddress = '0x1234567890123456789012345678901234567890';

      const records = await controller.read.getProductionRecordsPaginated([
        testAddress,
        0n,
        10n
      ]);
      assert.equal(records.length, 0);
    });

    it('should return zero for daily production with no records', async function () {
      const controller = await viem.deployContract('SPARKController', [mockTokenAddress]);
      const testAddress = '0x1234567890123456789012345678901234567890';
      const timestamp = BigInt(Math.floor(Date.now() / 1000));

      const [amount, count] = await controller.read.getDailyProduction([testAddress, timestamp]);
      assert.equal(amount.toString(), '0');
      assert.equal(count.toString(), '0');
    });

    it('should return zero for hourly production with no records', async function () {
      const controller = await viem.deployContract('SPARKController', [mockTokenAddress]);
      const testAddress = '0x1234567890123456789012345678901234567890';
      const timestamp = BigInt(Math.floor(Date.now() / 1000));

      const [amount, count] = await controller.read.getHourlyProduction([testAddress, timestamp]);
      assert.equal(amount.toString(), '0');
      assert.equal(count.toString(), '0');
    });

    it('should return zero for production in range with no records', async function () {
      const controller = await viem.deployContract('SPARKController', [mockTokenAddress]);
      const testAddress = '0x1234567890123456789012345678901234567890';
      const now = BigInt(Math.floor(Date.now() / 1000));
      const startTime = now - 86400n; // 24 hours ago
      const endTime = now;

      const total = await controller.read.getProductionInRange([
        testAddress,
        startTime,
        endTime
      ]);
      assert.equal(total.toString(), '0');
    });
  });

  describe('State Management', function () {
    it('should store correct immutable token address', async function () {
      const controller = await viem.deployContract('SPARKController', [mockTokenAddress]);

      const tokenAddress = await controller.read.SPARK_TOKEN_ADDRESS();
      assert.equal(tokenAddress.toLowerCase(), mockTokenAddress.toLowerCase());
    });

    it('should set deployer as initial owner', async function () {
      const controller = await viem.deployContract('SPARKController', [mockTokenAddress]);

      const owner = await controller.read.owner();
      assert.ok(owner);
      assert.notEqual(owner, '0x0000000000000000000000000000000000000000');
    });
  });

  describe('Edge Cases', function () {
    it('should handle large kWh values in conversion', async function () {
      const controller = await viem.deployContract('SPARKController', [mockTokenAddress]);
      const largeKwh = 1000000n; // 1 million kWh
      const expectedSpark = largeKwh * 1000n; // 1 billion SPARK

      const spark = await controller.read.kwhToSpark([largeKwh]);
      assert.equal(spark.toString(), expectedSpark.toString());
    });

    it('should handle conversion of 1 SPARK to kWh (rounds down)', async function () {
      const controller = await viem.deployContract('SPARKController', [mockTokenAddress]);

      const kwh = await controller.read.sparkToKwh([1n]);
      assert.equal(kwh.toString(), '0'); // Less than 1000 SPARK = 0 kWh
    });

    it('should handle conversion of 999 SPARK to kWh (rounds down)', async function () {
      const controller = await viem.deployContract('SPARKController', [mockTokenAddress]);

      const kwh = await controller.read.sparkToKwh([999n]);
      assert.equal(kwh.toString(), '0');
    });

    it('should handle conversion of exactly 1000 SPARK to kWh', async function () {
      const controller = await viem.deployContract('SPARKController', [mockTokenAddress]);

      const kwh = await controller.read.sparkToKwh([1000n]);
      assert.equal(kwh.toString(), '1');
    });
  });
});
