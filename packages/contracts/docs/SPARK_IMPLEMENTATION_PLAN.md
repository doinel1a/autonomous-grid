# SPARK Token Implementation Plan

## Overview

Implementazione di un token fungibile SPARK su Hedera utilizzando HTS (Hedera Token Service) con smart contract controller per tracking della produzione energetica.

**Token Specs:**

- Nome: SPARK
- Symbol: SPRK
- Decimals: 8
- Initial Supply: 0
- Max Supply: Unlimited (dynamic)
- Economics: 1000 SPARK = 1 kWh

---

## Phase 1: Environment Setup

### 1.1 Install Dependencies

- [ ] Installare `@hashgraph/sdk` per interazione con Hedera
- [ ] Verificare versioni compatibili con il progetto esistente
- [ ] Aggiornare `package.json` con le nuove dipendenze

### 1.2 Environment Configuration

- [ ] Aggiungere variabili in `.env`:
  - `HEDERA_NETWORK` (testnet/mainnet)
  - `HEDERA_TESTNET_ACCOUNT_ID` (treasury account)
  - `HEDERA_DER_TESTNET_PRIVATE_KEY` (treasury private key)
  - `TESTNET_SPARK_TOKEN_ID` (dopo creazione token)
  - `TESTNET_SPARK_CONTROLLER_ADDRESS` (dopo deploy contratto)
- [ ] Aggiungere `.env.example` con template
- [ ] Aggiungere documentazione per setup account Hedera

---

## Phase 2: HTS Token Creation

### 2.1 Create Token Script

**File:** `scripts/hedera/create-spark-token.ts`

- [ ] Implementare connessione a Hedera network
- [ ] Creare token con `TokenCreateTransaction`:
  - Nome: "SPARK"
  - Symbol: "SPRK"
  - Decimals: 8
  - Initial Supply: 0
  - Treasury: account configurato
  - Supply Key: abilitata per mint/burn dinamico
  - Admin Key: per gestione token
- [ ] Logging del Token ID creato
- [ ] Salvare Token ID in `.env` automaticamente
- [ ] Gestione errori e retry logic
- [ ] Aggiungere script in `package.json`: `"create:spark"`

### 2.2 Token Info Query Script

**File:** `scripts/hedera/query-spark-info.ts`

- [ ] Query per verificare info token
- [ ] Display: supply totale, treasury, decimals
- [ ] Aggiungere script in `package.json`: `"query:spark"`

---

## Phase 3: Smart Contract Development

### 3.1 SPARKController Contract

**File:** `contracts/SPARKController.sol`

**Storage Structures:**

```solidity
struct ProductionRecord {
  address producer;
  uint256 amount; // in SPARK tokens (1000 SPARK = 1 kWh)
  uint256 timestamp;
}

struct DailyAggregate {
  uint256 totalAmount;
  uint256 recordCount;
}

struct HourlyAggregate {
  uint256 totalAmount;
  uint256 recordCount;
}
```

**State Variables:**

- [ ] Implementare access control (owner only)
- [ ] Token ID reference (HTS token)
- [ ] Production records array
- [ ] Mappings:
  - `userProductions: address => ProductionRecord[]`
  - `userTotalProduction: address => uint256`
  - `dailyAggregates: address => (date => DailyAggregate)`
  - `hourlyAggregates: address => (dateHour => HourlyAggregate)`

**Events:**

- [ ] `ProductionRecorded(address indexed producer, uint256 amount, uint256 timestamp, uint256 recordId)`
- [ ] `TokensMinted(address indexed to, uint256 amount, uint256 timestamp)`
- [ ] `TokensBurned(address indexed from, uint256 amount, uint256 timestamp)`
- [ ] `OwnershipTransferred(address indexed previousOwner, address indexed newOwner)`

**Custom Errors (Gas Optimization):**

- [ ] `UnauthorizedAccess()`
- [ ] `InvalidAmount()`
- [ ] `InvalidAddress()`
- [ ] `TokenOperationFailed()`

**Core Functions:**

#### 3.1.1 Administrative

- [ ] `constructor(address _tokenId)` - inizializza con HTS token ID
- [ ] `setTokenId(address _tokenId)` - update token ID (owner only)
- [ ] `transferOwnership(address newOwner)` - trasferimento ownership

#### 3.1.2 Production Recording & Minting

- [ ] `recordProductionAndMint(address producer, uint256 kwh)` - Owner only
  - Calcola SPARK amount (kwh \* 1000)
  - Chiama HTS per mint
  - Registra produzione
  - Aggiorna aggregati
  - Emit eventi
- [ ] Input validation (address != 0, amount > 0)
- [ ] Reentrancy guard se necessario

#### 3.1.3 Burning

- [ ] `burnTokens(address from, uint256 amount)` - Owner only
  - Chiama HTS per burn
  - Registra operazione
  - Emit evento
- [ ] Input validation

#### 3.1.4 Query Functions (View)

- [ ] `getTotalProduction(address producer) returns (uint256)` - totale per produttore
- [ ] `getProductionRecords(address producer) returns (ProductionRecord[])` - tutti i record
- [ ] `getProductionRecordsPaginated(address producer, uint256 offset, uint256 limit)` - paginati
- [ ] `getDailyProduction(address producer, uint256 date) returns (uint256 amount, uint256 count)`
- [ ] `getHourlyProduction(address producer, uint256 dateHour) returns (uint256 amount, uint256 count)`
- [ ] `getProductionInRange(address producer, uint256 startTime, uint256 endTime) returns (uint256)`
- [ ] `getTotalRecordsCount() returns (uint256)` - contatore globale
- [ ] `getUserRecordsCount(address producer) returns (uint256)` - contatore per user

### 3.2 HTS Integration Library (Optional)

**File:** `contracts/libraries/HederaTokenService.sol`

- [ ] Wrapper per chiamate HTS native
- [ ] Helper functions per mint/burn
- [ ] Response code handling
- [ ] Considerare uso di librerie esistenti Hedera

### 3.3 Documentation

- [ ] NatSpec comments completi
- [ ] Diagrammi di flusso per operazioni principali
- [ ] Security considerations documented

---

## Phase 4: Testing

### 4.1 Unit Tests

**File:** `test/SPARKController.test.ts`

- [ ] Setup: deploy mock/testnet
- [ ] Test ownership e access control
- [ ] Test recording production:
  - Singola produzione
  - Multiple produzioni stesso user
  - Multiple produzioni differenti users
- [ ] Test aggregati:
  - Daily aggregates correttezza
  - Hourly aggregates correttezza
  - Edge cases (cambio giorno/ora)
- [ ] Test query functions:
  - Pagination
  - Range queries
  - Empty results
- [ ] Test mint/burn operazioni
- [ ] Test eventi emessi
- [ ] Test input validation e custom errors
- [ ] Test edge cases:
  - Zero amounts
  - Zero addresses
  - Overflow scenarios

### 4.2 Integration Tests

**File:** `test/SPARKController.integration.ts`

- [ ] Test completo su Hedera testnet
- [ ] Test interazione HTS reale
- [ ] Test mint → balance check
- [ ] Test burn → balance check
- [ ] Gas cost analysis

### 4.3 Solidity Unit Tests (Optional)

**File:** `contracts/SPARKController.t.sol`

- [ ] Test Foundry-style se necessario
- [ ] Coverage completa funzioni critiche

---

## Phase 5: Deployment Scripts

### 5.1 Contract Deployment

**File:** `scripts/hedera/deploy-spark-controller.ts`

- [ ] Deploy su Hedera testnet
- [ ] Configurazione con Token ID
- [ ] Verifica deployment
- [ ] Salvare contract address in `.env`
- [ ] Aggiungere script: `"deploy:controller:testnet"`

### 5.2 Associate Token to Contract

**File:** `scripts/hedera/associate-token.ts`

- [ ] Associare SPARK token al contratto
- [ ] Necessario per gestire i token
- [ ] Aggiungere script: `"associate:token"`

---

## Phase 6: Operational Scripts

### 6.1 Mint Script

**File:** `scripts/hedera/mint-spark.ts`

- [ ] Input: producer address, kWh amount
- [ ] Call contract `recordProductionAndMint()`
- [ ] Verificare mint avvenuto
- [ ] Display: transaction hash, amount mintato, nuovo balance
- [ ] Error handling e logging
- [ ] Aggiungere script: `"mint:spark"`

### 6.2 Burn Script

**File:** `scripts/hedera/burn-spark.ts`

- [ ] Input: address, amount
- [ ] Call contract `burnTokens()`
- [ ] Verificare burn avvenuto
- [ ] Display: transaction hash, amount bruciato, nuovo balance
- [ ] Error handling e logging
- [ ] Aggiungere script: `"burn:spark"`

### 6.3 Query Production Script

**File:** `scripts/hedera/query-production.ts`

- [ ] Query produzione per address
- [ ] Display formattato:
  - Totale produzione (kWh e SPARK)
  - Records con timestamp
  - Aggregati giornalieri
- [ ] Export JSON option
- [ ] Aggiungere script: `"query:production"`

---

## Phase 7: Security & Optimization

### 7.1 Security Audit Checklist

- [ ] Access control review
- [ ] Reentrancy vulnerabilities check
- [ ] Integer overflow/underflow (Solidity 0.8+ safe)
- [ ] External call safety
- [ ] Event emission consistency
- [ ] Input validation completeness
- [ ] Time manipulation resistance (timestamp usage)

### 7.2 Gas Optimization

- [ ] Storage optimization review
- [ ] Batch operations possibili
- [ ] Custom errors usage (✓ già pianificato)
- [ ] View functions gas check
- [ ] Event indexing ottimizzato

### 7.3 Code Quality

- [ ] Linting con solhint: `npm run lint`
- [ ] TypeScript type safety
- [ ] Error messages chiari
- [ ] Code documentation completo

---

## Phase 8: Documentation & Finalization

### 8.1 User Documentation

**File:** `packages/contracts/docs/SPARK_TOKEN.md`

- [ ] Overview architettura
- [ ] Setup instructions
- [ ] Script usage examples
- [ ] Query API documentation
- [ ] Troubleshooting guide

### 8.2 Developer Documentation

**File:** `packages/contracts/docs/SPARK_DEVELOPER.md`

- [ ] Contract architecture
- [ ] Storage layout
- [ ] Function specifications
- [ ] Integration guide
- [ ] Testing guide

### 8.3 README Update

- [ ] Aggiornare `packages/contracts/README.md`
- [ ] Aggiungere sezione SPARK token
- [ ] Commands reference
- [ ] Links a documentazione dettagliata

---

## Phase 9: Mainnet Deployment (Future)

### 9.1 Pre-Deployment Checklist

- [ ] Tutti i test passano
- [ ] Security audit completato
- [ ] Code review completato
- [ ] Documentation completa
- [ ] Backup delle chiavi
- [ ] Testnet fully tested

### 9.2 Mainnet Deployment

- [ ] Configurare `.env` per mainnet
- [ ] Deploy token su mainnet
- [ ] Deploy contract su mainnet
- [ ] Verificare deployment
- [ ] Monitor initial transactions

---

## Best Practices Applied

1. **Security First:**
   - Access control rigoroso (owner only per operazioni critiche)
   - Custom errors per gas efficiency
   - Input validation su tutte le funzioni pubbliche
   - Eventi per tracking off-chain

2. **Gas Optimization:**
   - Struct packing efficiente
   - Custom errors invece di require strings
   - Storage layout ottimizzato
   - View functions per query senza gas

3. **Maintainability:**
   - Codice modulare e riusabile
   - Documentazione completa (NatSpec)
   - Testing comprehensivo
   - Naming conventions chiare

4. **Scalability:**
   - Pagination per query grandi dataset
   - Aggregati pre-calcolati
   - Events per off-chain indexing

5. **Hedera Best Practices:**
   - HTS nativo per efficienza
   - Token association management
   - Response code handling
   - Network-specific configuration

---

## Dependencies & Tools

- `@hashgraph/sdk` - Hedera SDK
- `hardhat` - Development framework (già installato)
- `viem` - Ethereum library (già installato)
- `dotenv` - Environment variables (già installato)
- `solhint` - Solidity linting (già installato)

---

## Timeline Estimate

- Phase 1-2: 2-3 ore (Setup + Token Creation)
- Phase 3: 6-8 ore (Smart Contract Development)
- Phase 4: 4-6 ore (Testing)
- Phase 5-6: 3-4 ore (Deployment & Scripts)
- Phase 7-8: 2-3 ore (Security & Documentation)

**Total: ~20-25 ore di sviluppo**

---

## Notes

- Iniziare sempre con testnet
- Testare ogni fase completamente prima di procedere
- Mantenere backup delle chiavi e configurazioni
- Documentare ogni decisione importante
- Considerare upgrade pattern per futuro (se necessario)
