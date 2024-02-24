import {
    Account,
    AccountUpdate,
    Bool,
    Mina,
    PrivateKey,
    Provable,
    PublicKey,
    SmartContract,
    State,
    Struct,
    TokenId,
    UInt32,
    UInt64,
    method,
    state,
    TokenContract as BaseTokenContract,
    AccountUpdateForest,
} from 'o1js';

export { TokenContract, addresses, createDex, keys, randomAccounts, tokenIds, MPCTokenFaucet };

class UInt64x2 extends Struct([UInt64, UInt64]) { }


// MPC Token Faucet Contract
class MPCTokenFaucet extends SmartContract {
    // @state(PublicKey) tokenAddress = State<PublicKey>();
    tokenAddress: PublicKey;
    tokenContract: TokenContract;

    init() {
        super.init();
        this.tokenAddress = addresses.tokenX;
        this.tokenContract = new TokenContract(this.tokenAddress);
    }

    @state(UInt64) faucetBalance = State<UInt64>();

    @method async initialBalance(initialBalance: UInt64) {
        const deployer = addresses.user2;
        await this.tokenContract.transfer(deployer, this.self, initialBalance);
        this.faucetBalance.set(initialBalance);
    }
}


const savedKeys = [
    'EKFcUu4FLygkyZR8Ch4F8hxuJps97GCfiMRSWXDP55sgvjcmNGHc',
    'EKENfq7tEdTf5dnNxUgVo9dUnAqrEaB9syTgFyuRWinR5gPuZtbG',
    'EKEPVj2PDzQUrMwL2yeUikoQYXvh4qrkSxsDa7gegVcDvNjAteS5',
    'EKDm7SHWHEP5xiSbu52M1Z4rTFZ5Wx7YMzeaC27BQdPvvGvF42VH',
    'EKEuJJmmHNVHD1W2qmwExDyGbkSoKdKmKNPZn8QbqybVfd2Sd4hs',
    'EKEyPVU37EGw8CdGtUYnfDcBT2Eu7B6rSdy64R68UHYbrYbVJett',
];

let { keys, addresses } = randomAccounts(
    process.env.USE_CUSTOM_LOCAL_NETWORK === 'true',
    'tokenX',
    'tokenY',
    'dex',
    'user',
    'user2',
    'user3'
);
let tokenIds = {
    X: TokenId.derive(addresses.tokenX),
    Y: TokenId.derive(addresses.tokenY),
    lqXY: TokenId.derive(addresses.dex),
};

let mainUser = PrivateKey.fromBase58('EKFAdBGSSXrBbaCVqy4YjwWHoGEnsqYRQTqz227Eb5bzMx2bWu3F')
