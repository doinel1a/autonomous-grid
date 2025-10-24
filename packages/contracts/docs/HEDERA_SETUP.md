# Hedera Account Setup Guide

## Prerequisites

Before working with SPARK token on Hedera, you need to have a Hedera account with testnet HBAR for transaction fees.

## Step 1: Create a Hedera Testnet Account

### Option A: Using Hedera Portal (Recommended)

1. Visit [Hedera Portal](https://portal.hedera.com/)
2. Sign up for a free account
3. Navigate to "Testnet Access"
4. Create a new testnet account
5. You will receive:
   - **Account ID** (format: `0.0.xxxxx`)
   - **Private Key** (DER encoded hex string)
   - **Public Key**
6. The account will be automatically funded with testnet HBAR

### Option B: Using Hedera SDK Programmatically

```typescript
import { AccountCreateTransaction, Client, Hbar, PrivateKey } from '@hashgraph/sdk';

async function createAccount() {
  const client = Client.forTestnet();

  // Generate new key pair
  const newAccountPrivateKey = PrivateKey.generateED25519();
  const newAccountPublicKey = newAccountPrivateKey.publicKey;

  // Create account (requires existing account with HBAR to pay for creation)
  const newAccount = await new AccountCreateTransaction()
    .setKey(newAccountPublicKey)
    .setInitialBalance(Hbar.fromTinybars(1000))
    .execute(client);

  const receipt = await newAccount.getReceipt(client);
  const newAccountId = receipt.accountId;

  console.log('New Account ID:', newAccountId.toString());
  console.log('Private Key:', newAccountPrivateKey.toString());
  console.log('Public Key:', newAccountPublicKey.toString());
}
```

## Step 2: Get Testnet HBAR

If your account doesn't have sufficient HBAR:

1. Visit [Hedera Testnet Faucet](https://portal.hedera.com/faucet)
2. Enter your Account ID
3. Request testnet HBAR (you can request multiple times)
4. Typical amount: 10,000 testnet HBAR

## Step 3: Configure Environment Variables

1. Copy `.env.example` to `.env` (if not already done):

   ```bash
   cp .env.example .env
   ```

2. Fill in your Hedera credentials in `.env`:

   ```
   HEDERA_NETWORK='testnet'
   HEDERA_TESTNET_ACCOUNT_ID='0.0.12345' # Replace with your account ID
   HEDERA_DER_TESTNET_PRIVATE_KEY='302e020100300506032b657004220420...' # Replace with your private key
   ```

3. **Important**: Never commit your `.env` file to version control!

## Step 4: Verify Account Setup

Create a simple verification script `scripts/hedera/verify-account.ts`:

```typescript
import { AccountBalanceQuery, Client } from '@hashgraph/sdk';
import dotenv from 'dotenv';

dotenv.config();

async function verifyAccount() {
  const accountId = process.env.HEDERA_TESTNET_ACCOUNT_ID;
  const privateKey = process.env.HEDERA_DER_TESTNET_PRIVATE_KEY;

  if (!accountId || !privateKey) {
    throw new Error('Missing HEDERA_TESTNET_ACCOUNT_ID or HEDERA_DER_TESTNET_PRIVATE_KEY in .env');
  }

  const client = Client.forTestnet();
  client.setOperator(accountId, privateKey);

  const balance = await new AccountBalanceQuery().setAccountId(accountId).execute(client);

  console.log(`Account ${accountId} balance: ${balance.hbars.toString()}`);

  client.close();
}

verifyAccount().catch(console.error);
```

Run verification:

```bash
npx tsx scripts/hedera/verify-account.ts
```

## Understanding Hedera Keys

### Key Types

1. **Admin Key**: Controls token configuration (name, symbol, etc.)
2. **Supply Key**: Controls minting and burning
3. **KYC Key**: Controls KYC status of accounts
4. **Freeze Key**: Controls freeze status of accounts
5. **Wipe Key**: Controls wiping tokens from accounts

For SPARK token, we'll use:

- **Admin Key**: For token management
- **Supply Key**: For dynamic mint/burn operations

### Key Format

Hedera accepts keys in DER encoded format (hex string starting with `302e020100...`).

The SDK will automatically convert from:

- DER encoded hex string
- Raw hex private key
- PrivateKey object

## Security Best Practices

1. **Never share your private key**: Keep it secure and never commit to Git
2. **Separate keys for different environments**: Use different accounts for testnet and mainnet
3. **Backup your keys**: Store private keys securely in multiple locations
4. **Rotate keys periodically**: Change keys regularly for production systems
5. **Use hardware wallets for mainnet**: For production, use hardware security modules

## Account Costs (Testnet)

All operations on testnet are free (using testnet HBAR):

- Token creation: ~$1 worth of HBAR (on mainnet)
- Token association: ~$0.05 worth of HBAR
- Token transfer: ~$0.0001 worth of HBAR
- Smart contract deployment: Varies based on contract size

## Troubleshooting

### Error: "INSUFFICIENT_TX_FEE"

- Solution: Request more testnet HBAR from the faucet

### Error: "INVALID_ACCOUNT_ID"

- Solution: Check that your account ID is in format `0.0.xxxxx`

### Error: "INVALID_SIGNATURE"

- Solution: Verify your private key matches your account ID

### Error: "ACCOUNT_DELETED"

- Solution: Account may have been deleted due to inactivity. Create a new one.

## Resources

- [Hedera Documentation](https://docs.hedera.com/)
- [Hedera Portal](https://portal.hedera.com/)
- [Hedera SDK Documentation](https://docs.hedera.com/hedera/sdks-and-apis/sdks)
- [Hedera Token Service](https://docs.hedera.com/hedera/sdks-and-apis/sdks/token-service)
- [HashScan Testnet Explorer](https://hashscan.io/testnet)

## Next Steps

Once your account is set up and verified, proceed to:

1. Create SPARK token: `npm run create:spark`
2. Deploy SPARKController contract: `npm run deploy:controller:testnet`
3. Start minting tokens: `npm run mint:spark`
