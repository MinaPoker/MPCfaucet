import { expect } from 'expect';
import { AccountUpdate, Mina, Permissions, TokenId, UInt64, PrivateKey, PublicKey } from 'o1js';
import { getProfiler } from '../utils/profiler.js';
import { TokenContract, addresses, createDex, keys, tokenIds } from './Faucet.js';

let proofsEnabled = false;
let Local = Mina.LocalBlockchain({
    proofsEnabled,
    enforceTransactionLimits: false,
});
Mina.setActiveInstance(Local);
let [{ privateKey: feePayerKey, publicKey: feePayerAddress }] =
    Local.testAccounts;
let tx, balances, oldBalances;

console.log('-------------------------------------------------');
console.log('FEE PAYER\t', feePayerAddress.toBase58());
console.log('TOKEN X ADDRESS\t', addresses.tokenX.toBase58());
console.log('TOKEN Y ADDRESS\t', addresses.tokenY.toBase58());
console.log('DEX ADDRESS\t', addresses.dex.toBase58());
console.log('USER ADDRESS\t', addresses.user.toBase58());
console.log('-------------------------------------------------');
console.log('TOKEN X ID\t', TokenId.toBase58(tokenIds.X));
console.log('TOKEN Y ID\t', TokenId.toBase58(tokenIds.Y));
console.log('-------------------------------------------------');

await TokenContract.analyzeMethods();
if (proofsEnabled) {
    console.log('compile (token)...');
    await TokenContract.compile();
}

await main({ withVesting: false });

// swap out ledger so we can start fresh
Local = Mina.LocalBlockchain({
    proofsEnabled,
    enforceTransactionLimits: false,
});
Mina.setActiveInstance(Local);
[{ privateKey: feePayerKey }] = Local.testAccounts;
feePayerAddress = feePayerKey.toPublicKey();

await main({ withVesting: true });

console.log('all dex tests were successful! 🎉');