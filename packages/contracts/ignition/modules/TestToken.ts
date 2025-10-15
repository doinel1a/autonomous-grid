import { buildModule } from '@nomicfoundation/hardhat-ignition/modules';

export default buildModule('TestTokenModule', (m) => {
  const initialSupply = 100_000_000n;
  const testToken = m.contract('TestToken', [initialSupply]);
  return { testToken };
});
