// Auto-generated file - Do not edit manually
// Generated at: 2025-10-15T19:02:33.421Z

export const config = {
  network: 'localhost',
  rpcUrl: 'http://127.0.0.1:8545',
  contractAddress: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
  accounts: {
    deployer: {
      address: '0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266',
      privateKey: '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'
    },
    account1: {
      address: '0x70997970c51812dc3a010c7d01b50e0d17dc79c8',
      privateKey: '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d'
    },
    account2: {
      address: '0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc',
      privateKey: '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a'
    }
  },
  abi: [
    {
      inputs: [
        {
          internalType: 'uint256',
          name: '_initialSupply',
          type: 'uint256'
        }
      ],
      stateMutability: 'nonpayable',
      type: 'constructor'
    },
    {
      inputs: [],
      name: 'AllowanceOverflow',
      type: 'error'
    },
    {
      inputs: [
        {
          internalType: 'uint256',
          name: 'available',
          type: 'uint256'
        },
        {
          internalType: 'uint256',
          name: 'required',
          type: 'uint256'
        }
      ],
      name: 'InsufficientAllowance',
      type: 'error'
    },
    {
      inputs: [
        {
          internalType: 'uint256',
          name: 'available',
          type: 'uint256'
        },
        {
          internalType: 'uint256',
          name: 'required',
          type: 'uint256'
        }
      ],
      name: 'InsufficientBalance',
      type: 'error'
    },
    {
      inputs: [],
      name: 'ZeroAddressNotAllowed',
      type: 'error'
    },
    {
      anonymous: false,
      inputs: [
        {
          indexed: true,
          internalType: 'address',
          name: 'owner',
          type: 'address'
        },
        {
          indexed: true,
          internalType: 'address',
          name: 'spender',
          type: 'address'
        },
        {
          indexed: true,
          internalType: 'uint256',
          name: 'amount',
          type: 'uint256'
        }
      ],
      name: 'Approval',
      type: 'event'
    },
    {
      anonymous: false,
      inputs: [
        {
          indexed: true,
          internalType: 'address',
          name: 'from',
          type: 'address'
        },
        {
          indexed: true,
          internalType: 'address',
          name: 'to',
          type: 'address'
        },
        {
          indexed: true,
          internalType: 'uint256',
          name: 'amount',
          type: 'uint256'
        }
      ],
      name: 'Transfer',
      type: 'event'
    },
    {
      inputs: [
        {
          internalType: 'address',
          name: '',
          type: 'address'
        },
        {
          internalType: 'address',
          name: '',
          type: 'address'
        }
      ],
      name: 'allowance',
      outputs: [
        {
          internalType: 'uint256',
          name: '',
          type: 'uint256'
        }
      ],
      stateMutability: 'view',
      type: 'function'
    },
    {
      inputs: [
        {
          internalType: 'address',
          name: '_spender',
          type: 'address'
        },
        {
          internalType: 'uint256',
          name: '_amount',
          type: 'uint256'
        }
      ],
      name: 'approve',
      outputs: [
        {
          internalType: 'bool',
          name: 'success',
          type: 'bool'
        }
      ],
      stateMutability: 'nonpayable',
      type: 'function'
    },
    {
      inputs: [
        {
          internalType: 'address',
          name: '',
          type: 'address'
        }
      ],
      name: 'balanceOf',
      outputs: [
        {
          internalType: 'uint256',
          name: '',
          type: 'uint256'
        }
      ],
      stateMutability: 'view',
      type: 'function'
    },
    {
      inputs: [],
      name: 'decimals',
      outputs: [
        {
          internalType: 'uint8',
          name: '',
          type: 'uint8'
        }
      ],
      stateMutability: 'view',
      type: 'function'
    },
    {
      inputs: [
        {
          internalType: 'address',
          name: '_spender',
          type: 'address'
        },
        {
          internalType: 'uint256',
          name: '_subtractedAmount',
          type: 'uint256'
        }
      ],
      name: 'decreaseAllowance',
      outputs: [
        {
          internalType: 'bool',
          name: 'success',
          type: 'bool'
        }
      ],
      stateMutability: 'nonpayable',
      type: 'function'
    },
    {
      inputs: [
        {
          internalType: 'address',
          name: '_owner',
          type: 'address'
        }
      ],
      name: 'getAccountInfo',
      outputs: [
        {
          internalType: 'uint256',
          name: 'balance',
          type: 'uint256'
        },
        {
          internalType: 'uint256',
          name: 'supply',
          type: 'uint256'
        }
      ],
      stateMutability: 'view',
      type: 'function'
    },
    {
      inputs: [
        {
          internalType: 'address',
          name: '_spender',
          type: 'address'
        },
        {
          internalType: 'uint256',
          name: '_addedAmount',
          type: 'uint256'
        }
      ],
      name: 'increaseAllowance',
      outputs: [
        {
          internalType: 'bool',
          name: 'success',
          type: 'bool'
        }
      ],
      stateMutability: 'nonpayable',
      type: 'function'
    },
    {
      inputs: [],
      name: 'name',
      outputs: [
        {
          internalType: 'string',
          name: '',
          type: 'string'
        }
      ],
      stateMutability: 'view',
      type: 'function'
    },
    {
      inputs: [],
      name: 'symbol',
      outputs: [
        {
          internalType: 'string',
          name: '',
          type: 'string'
        }
      ],
      stateMutability: 'view',
      type: 'function'
    },
    {
      inputs: [],
      name: 'totalSupply',
      outputs: [
        {
          internalType: 'uint256',
          name: '',
          type: 'uint256'
        }
      ],
      stateMutability: 'view',
      type: 'function'
    },
    {
      inputs: [
        {
          internalType: 'address',
          name: '_to',
          type: 'address'
        },
        {
          internalType: 'uint256',
          name: '_amount',
          type: 'uint256'
        }
      ],
      name: 'transfer',
      outputs: [
        {
          internalType: 'bool',
          name: 'success',
          type: 'bool'
        }
      ],
      stateMutability: 'nonpayable',
      type: 'function'
    },
    {
      inputs: [
        {
          internalType: 'address',
          name: '_from',
          type: 'address'
        },
        {
          internalType: 'address',
          name: '_to',
          type: 'address'
        },
        {
          internalType: 'uint256',
          name: '_amount',
          type: 'uint256'
        }
      ],
      name: 'transferFrom',
      outputs: [
        {
          internalType: 'bool',
          name: 'success',
          type: 'bool'
        }
      ],
      stateMutability: 'nonpayable',
      type: 'function'
    }
  ],
  setupAt: '2025-10-15T19:02:33.420Z'
} as const;
