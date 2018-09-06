import { BigNumber } from '0x.js';
import ZeroExClient from '../clients/0x';
import EthereumClient from '../clients/ethereum';
import { TransactionService } from '../services/TransactionService';

export function deposit(address, amount) {
  return async (dispatch, getState) => {
    const {
      wallet: { web3 }
    } = getState();
    const ethereumClient = new EthereumClient(web3);
    const zeroExClient = new ZeroExClient(ethereumClient);
    const txhash = await zeroExClient.depositEther(new BigNumber(amount));
    const activeTransaction = {
      id: txhash,
      type: 'DEPOSIT',
      address,
      amount
    };
    await TransactionService.instance.addActiveTransaction(activeTransaction);
  };
}

export function withdraw(address, amount) {
  return async (dispatch, getState) => {
    const {
      wallet: { web3 }
    } = getState();
    const ethereumClient = new EthereumClient(web3);
    const zeroExClient = new ZeroExClient(ethereumClient);
    const txhash = await zeroExClient.withdrawEther(new BigNumber(amount));
    const activeTransaction = {
      id: txhash,
      type: 'WITHDRAWAL',
      address,
      amount
    };
    await TransactionService.instance.addActiveTransaction(activeTransaction);
  };
}

export function fillOrKillOrder(order, amount) {
  return async (dispatch, getState) => {
    const {
      wallet: { web3 }
    } = getState();
    const ethereumClient = new EthereumClient(web3);
    const zeroExClient = new ZeroExClient(ethereumClient);
    const txhash = await zeroExClient.fillOrKillOrder(order, amount);
    const activeTransaction = {
      ...order,
      id: txhash,
      type: 'FILL',
      amount
    };
    await TransactionService.instance.addActiveTransaction(activeTransaction);
  };
}

export function batchFillOrKill(orders, amounts) {
  return async (dispatch, getState) => {
    const {
      wallet: { web3 }
    } = getState();
    const ethereumClient = new EthereumClient(web3);
    const zeroExClient = new ZeroExClient(ethereumClient);
    const txhash = await zeroExClient.fillOrKillOrders(orders, amounts);
    const activeTransaction = {
      id: txhash,
      type: 'BATCH_FILL',
      amounts
    };
    await TransactionService.instance.addActiveTransaction(activeTransaction);
  };
}
