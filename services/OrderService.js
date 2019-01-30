import { marketUtils } from '@0xproject/order-utils';
import { Web3Wrapper } from '@0xproject/web3-wrapper';
import {
  assetDataUtils,
  BigNumber,
  generatePseudoRandomSalt,
  orderHashUtils
} from '0x.js';
import * as _ from 'lodash';
import EthereumClient from '../clients/ethereum';
import ZeroExClient from '../clients/0x';
import RelayerClient from '../clients/relayer';
import { NULL_ADDRESS, ZERO } from '../constants/0x';
import {
  feeForMaker,
  feeForTaker,
  averagePriceByMakerAmount,
  averagePriceByTakerAmount,
  filterFillableOrders,
  findOrdersThatCoverTakerAssetFillAmount,
  makerAmountFromTakerAmount,
  takerAmountFromMakerAmount
} from '../utils';
import * as AssetService from './AssetService';
import * as WalletService from './WalletService';

let _store;

export function setStore(store) {
  _store = store;
}

export function getOrderbook(baseAsset, quoteAsset = null) {
  const {
    relayer: { orderbooks }
  } = _store.getState();

  if (!quoteAsset) {
    quoteAsset = AssetService.getQuoteAsset();
  } else if (typeof quoteToken === 'string') {
    quoteAsset = AssetService.findAssetByAddress(quoteAsset);
  }

  if (typeof baseAsset === 'string') {
    baseAsset = AssetService.findAssetByAddress(baseAsset);
  }

  if (!baseAsset || !quoteAsset) {
    return null;
  }

  return orderbooks[baseAsset.assetData][quoteAsset.assetData];
}

export function getOrderPrice(order) {
  if (!order) return 0;

  const makerToken = AssetService.findAssetByData(order.makerAssetData);
  const takerToken = AssetService.findAssetByData(order.takerAssetData);
  const quoteToken = AssetService.getQuoteAsset();

  if (!makerToken) return 0;
  if (!takerToken) return 0;
  if (!quoteToken) return 0;

  const makerTokenUnitAmount = Web3Wrapper.toUnitAmount(
    new BigNumber(order.makerAssetAmount),
    makerToken.decimals
  );
  const takerTokenUnitAmount = Web3Wrapper.toUnitAmount(
    new BigNumber(order.takerAssetAmount),
    takerToken.decimals
  );

  if (quoteToken.address === makerToken.address) {
    return makerTokenUnitAmount.div(takerTokenUnitAmount);
  } else if (quoteToken.address === takerToken.address) {
    return takerTokenUnitAmount.div(makerTokenUnitAmount);
  } else {
    return 0;
  }
}

export function getAveragePrice(orders) {
  if (orders.length === 0) {
    return 0;
  }

  const makerTokenAddresses = _.chain(orders)
    .map('makerTokenAddress')
    .uniq()
    .value();

  if (makerTokenAddresses.length > 1) {
    throw new Error('Orders contain different maker token addresses');
  }
  if (makerTokenAddresses.length < 1) {
    throw new Error('Need at least 1 order');
  }

  const takerTokenAddresses = _.chain(orders)
    .map('takerTokenAddress')
    .uniq()
    .value();
  if (takerTokenAddresses.length > 1) {
    throw new Error('Orders contain different taker token addresses');
  }
  if (takerTokenAddresses.length < 1) {
    throw new Error('Need at least 1 order');
  }

  return orders
    .map(o => getOrderPrice(o))
    .reduce((acc, price) => acc.add(price))
    .div(orders.length);
}

export function convertLimitOrderToZeroExOrder(limitOrder) {
  const {
    relayer: { assets }
  } = _store.getState();

  const quoteToken = _.find(assets, { address: limitOrder.quoteAddress });
  const baseToken = _.find(assets, { address: limitOrder.baseAddress });

  if (!quoteToken) return null;
  if (!baseToken) return null;

  let order = {
    makerAssetData: null,
    makerAssetAmount: null,
    takerAssetData: null,
    takerAssetAmount: null,
    expirationTimeSeconds: new BigNumber(limitOrder.expirationTimeSeconds)
  };

  switch (limitOrder.side) {
    case 'buy':
      order.makerAssetData = assetDataUtils.encodeERC20AssetData(
        quoteToken.address
      );
      order.makerAssetAmount = Web3Wrapper.toBaseUnitAmount(
        new BigNumber(limitOrder.price).mul(limitOrder.amount).abs(),
        quoteToken.decimals
      );
      order.takerAssetData = assetDataUtils.encodeERC20AssetData(
        baseToken.address
      );
      order.takerAssetAmount = Web3Wrapper.toBaseUnitAmount(
        new BigNumber(limitOrder.amount).abs(),
        baseToken.decimals
      );
      break;

    case 'sell':
      order.makerAssetData = assetDataUtils.encodeERC20AssetData(
        baseToken.address
      );
      order.makerAssetAmount = Web3Wrapper.toBaseUnitAmount(
        new BigNumber(limitOrder.amount).abs(),
        baseToken.decimals
      );
      order.takerAssetData = assetDataUtils.encodeERC20AssetData(
        quoteToken.address
      );
      order.takerAssetAmount = Web3Wrapper.toBaseUnitAmount(
        new BigNumber(limitOrder.price).mul(limitOrder.amount).abs(),
        quoteToken.decimals
      );
      break;
  }

  return order;
}

export function convertZeroExOrderToLimitOrder(order) {
  const {
    relayer: { assets }
  } = _store.getState();

  const makerToken = _.find(assets, { assetData: order.makerAssetData });
  const takerToken = _.find(assets, { assetData: order.takerAssetData });
  const quoteToken = AssetService.getQuoteAsset();

  if (!makerToken) return null;
  if (!takerToken) return null;

  const makerTokenUnitAmount = Web3Wrapper.toUnitAmount(
    new BigNumber(order.makerAssetAmount),
    makerToken.decimals
  );
  const takerTokenUnitAmount = Web3Wrapper.toUnitAmount(
    new BigNumber(order.takerAssetAmount),
    takerToken.decimals
  );

  const limitOrder = {
    baseAddress: null,
    quoteAddress: null,
    price: null,
    amount: null,
    side: null
  };

  if (quoteToken.address === makerToken.address) {
    limitOrder.baseAddress = assetDataUtils.decodeERC20AssetData(
      order.takerAssetData
    ).tokenAddress;
    limitOrder.quoteAddress = assetDataUtils.decodeERC20AssetData(
      order.makerAssetData
    ).tokenAddress;
    limitOrder.price = makerTokenUnitAmount.div(takerTokenUnitAmount);
    limitOrder.amount = takerTokenUnitAmount;
    limitOrder.side = 'buy';
    return limitOrder;
  } else if (quoteToken.address === takerToken.address) {
    limitOrder.baseAddress = assetDataUtils.decodeERC20AssetData(
      order.takerAssetData
    ).tokenAddress;
    limitOrder.quoteAddress = assetDataUtils.decodeERC20AssetData(
      order.makerAssetData
    ).tokenAddress;
    limitOrder.price = takerTokenUnitAmount.div(makerTokenUnitAmount);
    limitOrder.amount = makerTokenUnitAmount;
    limitOrder.side = 'sell';
    return limitOrder;
  } else {
    return null;
  }
}

export async function getFilledTakerAmounts(orders) {
  if (!orders) return null;
  if (!orders.length) return [];

  const web3 = WalletService.getWeb3();

  const ethereumClient = new EthereumClient(web3);
  const zeroExClient = new ZeroExClient(ethereumClient);

  return Promise.all(
    orders.map(order =>
      zeroExClient.getFilledTakerAmount(
        orderHashUtils.getOrderHashHex(order),
        false
      )
    )
  );
}

export async function getRemainingFillableMakerAssetAmounts(orders) {
  if (!orders) return null;
  if (!orders.length) return [];

  const filledTakerAmounts = await getFilledTakerAmounts(orders);
  const remainingFillableMakerAssetAmounts = _.zip(
    orders,
    filledTakerAmounts
  ).map(([order, filledTakerAmount]) =>
    new BigNumber(order.takerAssetAmount)
      .sub(filledTakerAmount)
      .div(order.takerAssetAmount)
      .mul(order.makerAssetAmount)
  );
  const remainingFillableMakerAssetAmountsRounded = remainingFillableMakerAssetAmounts.map(
    amount => amount.toFixed(0, BigNumber.ROUND_DOWN)
  );

  return remainingFillableMakerAssetAmountsRounded.map(
    amount => new BigNumber(amount)
  );
}

export async function getRemainingFillableTakerAssetAmounts(orders) {
  if (!orders) return null;
  if (!orders.length) return [];

  const filledTakerAmounts = await getFilledTakerAmounts(orders);
  const remainingFillableTakerAssetAmounts = _.zip(
    orders,
    filledTakerAmounts
  ).map(([order, filledTakerAmount]) =>
    new BigNumber(order.takerAssetAmount).sub(filledTakerAmount)
  );

  return remainingFillableTakerAssetAmounts;
}

export async function createOrder(limitOrder) {
  const {
    wallet: { address }
  } = _store.getState();

  const web3 = WalletService.getWeb3();

  const ethereumClient = new EthereumClient(web3);
  const zeroExClient = new ZeroExClient(ethereumClient);
  return {
    ...convertLimitOrderToZeroExOrder(limitOrder),
    exchangeAddress: await zeroExClient.getExchangeContractAddress(),
    makerAddress: address.toLowerCase(),
    makerFee: ZERO,
    senderAddress: NULL_ADDRESS,
    takerAddress: NULL_ADDRESS,
    takerFee: ZERO,
    feeRecipientAddress: NULL_ADDRESS,
    salt: generatePseudoRandomSalt()
  };
}

export async function signOrder(order) {
  const web3 = WalletService.getWeb3();

  const ethereumClient = new EthereumClient(web3);
  const zeroExClient = new ZeroExClient(ethereumClient);

  if (!order.salt) order.salt = generatePseudoRandomSalt();

  const orderHash = orderHashUtils.getOrderHashHex(order);
  // Halting at signature -- seems like a performance or network issue.
  const signature = await zeroExClient.signOrderHash(orderHash);

  return {
    ...order,
    orderHash,
    signature
  };
}

export async function configureOrder(order) {
  let {
    settings: { network, relayerEndpoint }
  } = _store.getState();

  const relayerClient = new RelayerClient(relayerEndpoint, { network });

  const config = await relayerClient.getOrderConfig(order);

  return {
    ...order,
    ...config
  };
}

export async function getBuyAssetsQuoteAsync(
  assetData,
  assetBuyAmount,
  options = {
    slippagePercentage: 0.2,
    expiryBufferSeconds: 30,
    filterInvalidOrders: true
  }
) {
  if (!options)
    options = {
      slippagePercentage: 0.2,
      expiryBufferSeconds: 30,
      filterInvalidOrders: true
    };
  if (
    options.slippagePercentage === null ||
    options.slippagePercentage === undefined
  )
    options.slippagePercentage = 0.2;

  if (
    options.expiryBufferSeconds === null ||
    options.expiryBufferSeconds === undefined
  )
    options.expiryBufferSeconds = 30;

  assetBuyAmount = new BigNumber(assetBuyAmount.toString());

  const {
    relayer: { orderbooks }
  } = _store.getState();

  const web3 = WalletService.getWeb3();
  const ethereumClient = new EthereumClient(web3);
  const zeroExClient = new ZeroExClient(ethereumClient);
  const wrappers = await zeroExClient.getContractWrappers();
  const quoteAsset = AssetService.getQuoteAsset();
  const baseAsset = AssetService.findAssetByData(assetData);
  const orderbook = orderbooks[baseAsset.assetData][quoteAsset.assetData];
  if (!orderbook) {
    return null;
  }
  const orders = options.filterInvalidOrders
    ? await filterFillableOrders(wrappers, orderbook.asksArray())
    : orderbook.asksArray();
  if (!orders.length) {
    return null;
  }
  const worstCaseOrders = marketUtils.findOrdersThatCoverMakerAssetFillAmount(
    orders,
    assetBuyAmount,
    {
      slippageBufferAmount: assetBuyAmount
        .mul(options.slippagePercentage)
        .round()
    }
  );
  const bestCaseOrders = marketUtils.findOrdersThatCoverMakerAssetFillAmount(
    orders,
    assetBuyAmount,
    {
      slippageBufferAmount: ZERO
    }
  );

  // Filter expired.
  const earliestExperiationTimeInSeconds =
    Math.ceil(new Date().getTime() / 1000) - options.expiryBufferSeconds;
  worstCaseOrders.resultOrders = worstCaseOrders.resultOrders.filter(order =>
    new BigNumber(order.expirationTimeSeconds).gt(
      earliestExperiationTimeInSeconds
    )
  );
  bestCaseOrders.resultOrders = bestCaseOrders.resultOrders.filter(order =>
    new BigNumber(order.expirationTimeSeconds).gt(
      earliestExperiationTimeInSeconds
    )
  );

  // Prices
  const worstCasePrice = averagePriceByTakerAmount(
    worstCaseOrders.resultOrders,
    {
      makerAssetDecimals: quoteAsset.decimals,
      takerAssetDecimals: baseAsset.decimals
    }
  );
  const bestCasePrice = averagePriceByTakerAmount(bestCaseOrders.resultOrders, {
    makerAssetDecimals: quoteAsset.decimals,
    takerAssetDecimals: baseAsset.decimals
  });

  // Fees
  const worstCaseFee = feeForMaker(
    worstCaseOrders.resultOrders,
    assetBuyAmount
  );
  const bestCaseFee = feeForMaker(bestCaseOrders.resultOrders, assetBuyAmount);

  // Best case sell amount
  const assetSellAmount = takerAmountFromMakerAmount(
    bestCaseOrders.resultOrders,
    assetBuyAmount
  );

  return {
    assetBuyAmount,
    assetSellAmount,
    assetData,
    bestCaseQuoteInfo: {
      ethPerAssetPrice: bestCasePrice,
      fee: bestCaseFee
    },
    orders: worstCaseOrders.resultOrders,
    worstCaseQuoteInfo: {
      ethPerAssetPrice: worstCasePrice,
      fee: worstCaseFee
    }
  };
}

export async function getSellAssetsQuoteAsync(
  assetData,
  assetSellAmount,
  options = {
    slippagePercentage: 0.2,
    expiryBufferSeconds: 30
  }
) {
  if (!options)
    options = {
      slippagePercentage: 0.2
    };
  if (
    options.slippagePercentage === null ||
    options.slippagePercentage === undefined
  )
    options.slippagePercentage = 0.2;

  if (
    options.expiryBufferSeconds === null ||
    options.expiryBufferSeconds === undefined
  )
    options.expiryBufferSeconds = 30;

  assetSellAmount = new BigNumber(assetSellAmount.toString());

  const {
    relayer: { orderbooks }
  } = _store.getState();

  const web3 = WalletService.getWeb3();
  const ethereumClient = new EthereumClient(web3);
  const zeroExClient = new ZeroExClient(ethereumClient);
  const wrappers = await zeroExClient.getContractWrappers();
  const quoteAsset = AssetService.getQuoteAsset();
  const baseAsset = AssetService.findAssetByData(assetData);
  const orderbook = orderbooks[baseAsset.assetData][quoteAsset.assetData];
  if (!orderbook) {
    return null;
  }
  const orders = await filterFillableOrders(wrappers, orderbook.bidsArray());
  if (!orders.length) {
    return null;
  }

  const worstCaseOrders = findOrdersThatCoverTakerAssetFillAmount(
    orders,
    assetSellAmount,
    {
      slippageBufferAmount: assetSellAmount
        .mul(options.slippagePercentage)
        .round()
    }
  );
  const bestCaseOrders = findOrdersThatCoverTakerAssetFillAmount(
    orders,
    assetSellAmount,
    {
      slippageBufferAmount: ZERO
    }
  );

  // Filter expired.
  const earliestExperiationTimeInSeconds =
    Math.ceil(new Date().getTime() / 1000) - options.expiryBufferSeconds;
  worstCaseOrders.resultOrders = worstCaseOrders.resultOrders.filter(order =>
    new BigNumber(order.expirationTimeSeconds).gt(
      earliestExperiationTimeInSeconds
    )
  );
  bestCaseOrders.resultOrders = bestCaseOrders.resultOrders.filter(order =>
    new BigNumber(order.expirationTimeSeconds).gt(
      earliestExperiationTimeInSeconds
    )
  );

  // Average prices
  const worstCasePrice = averagePriceByMakerAmount(
    worstCaseOrders.resultOrders,
    {
      makerAssetDecimals: baseAsset.decimals,
      takerAssetDecimals: quoteAsset.decimals
    }
  );
  const bestCasePrice = averagePriceByMakerAmount(bestCaseOrders.resultOrders, {
    makerAssetDecimals: baseAsset.decimals,
    takerAssetDecimals: quoteAsset.decimals
  });

  // Fees
  const worstCaseFee = feeForTaker(
    worstCaseOrders.resultOrders,
    assetSellAmount
  );
  const bestCaseFee = feeForTaker(bestCaseOrders.resultOrders, assetSellAmount);

  // Best case buy amount
  const assetBuyAmount = makerAmountFromTakerAmount(
    bestCaseOrders.resultOrders,
    assetSellAmount
  );

  return {
    assetBuyAmount,
    assetSellAmount,
    assetData,
    bestCaseQuoteInfo: {
      ethPerAssetPrice: bestCasePrice,
      fee: bestCaseFee
    },
    orders: worstCaseOrders.resultOrders,
    worstCaseQuoteInfo: {
      ethPerAssetPrice: worstCasePrice,
      fee: worstCaseFee
    }
  };
}
