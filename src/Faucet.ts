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

    @method async requestTokens(amount: UInt64) {
        const sender = addresses.user3;
        const balance = this.faucetBalance.get();
        const remainingBalance = balance.sub(amount);

        remainingBalance.assertEquals(balance.sub(amount));

        await this.tokenContract.transfer(this.self, sender, amount);
        this.faucetBalance.set(remainingBalance);
    }
}

/**
 * Simple token with API flexible enough to handle all our use cases
 */
class TokenContract extends BaseTokenContract {
    @method async init() {
        super.init();
        // mint the entire supply to the token account with the same address as this contract
        /**
         * we mint the max uint64 of tokens here, so that we can overflow it in tests if we just mint a bit more
         */
        let receiver = this.internal.mint({
            address: this.address,
            amount: UInt64.MAXINT(),
        });
        // assert that the receiving account is new, so this can be only done once
        receiver.account.isNew.requireEquals(Bool(true));
        // pay fees for opened account
        this.balance.subInPlace(Mina.getNetworkConstants().accountCreationFee);
    }

    /**
     * for testing only
     * mint additional tokens to some user, so we can overflow token balances
     */
    @method async init2() {
        let receiver = this.internal.mint({
            address: addresses.user,
            amount: UInt64.from(10n ** 6n),
        });
        // assert that the receiving account is new, so this can be only done once
        receiver.account.isNew.requireEquals(Bool(true));
        // pay fees for opened account
        this.balance.subInPlace(Mina.getNetworkConstants().accountCreationFee);
    }

    @method
    async approveBase(forest: AccountUpdateForest) {
        this.checkZeroBalanceChange(forest);
    }
}

function createDex({
    lockedLiquiditySlots,
}: { lockedLiquiditySlots?: number } = {}) {
    class Dex extends BaseTokenContract {
        // addresses of token contracts are constants
        tokenX = addresses.tokenX;
        tokenY = addresses.tokenY;

        // Approvable API

        @state(UInt64) totalSupply = State<UInt64>();


        @method
        async approveBase(forest: AccountUpdateForest) {
            this.checkZeroBalanceChange(forest);
        }

        @method async supplyLiquidityBase(dx: UInt64, dy: UInt64, signerPrivateKey: PrivateKey): Promise<UInt64> {
            let user = signerPrivateKey.toPublicKey(); // unconstrained because transfer() requires the signature anyway
            let tokenX = new TokenContract(this.tokenX);
            let tokenY = new TokenContract(this.tokenY);

            // get balances of X and Y token
            let dexXUpdate = AccountUpdate.create(
                this.address,
                tokenX.deriveTokenId()
            );
            let dexXBalance = dexXUpdate.account.balance.getAndRequireEquals();

            let dexYUpdate = AccountUpdate.create(
                this.address,
                tokenY.deriveTokenId()
            );
            let dexYBalance = dexYUpdate.account.balance.getAndRequireEquals();

            // assert dy === [dx * y/x], or x === 0
            let isXZero = dexXBalance.equals(UInt64.zero);
            let xSafe = Provable.if(isXZero, UInt64.one, dexXBalance);
            let isDyCorrect = dy.equals(dx.mul(dexYBalance).div(xSafe));
            isDyCorrect.or(isXZero).assertTrue();

            await tokenX.transfer(user, dexXUpdate, dx);
            await tokenY.transfer(user, dexYUpdate, dy);

            // calculate liquidity token output simply as dl = dx + dy
            // => maintains ratio x/l, y/l
            let dl = dy.add(dx);
            let userUpdate = this.internal.mint({ address: user, amount: dl });
            if (lockedLiquiditySlots !== undefined) {
                /**
                 * exercise the "timing" (vesting) feature to lock the received liquidity tokens.
                 * THIS IS HERE FOR TESTING!
                  **/
                let amountLocked = dl;
                userUpdate.account.timing.set({
                    initialMinimumBalance: amountLocked,
                    cliffAmount: amountLocked,
                    cliffTime: UInt32.from(lockedLiquiditySlots),
                    vestingIncrement: UInt64.zero,
                    vestingPeriod: UInt32.one,
                });
                userUpdate.requireSignature();
            }

            // update l supply
            let l = this.totalSupply.get();
            this.totalSupply.requireEquals(l);
            this.totalSupply.set(l.add(dl));
            return dl;
        }
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
