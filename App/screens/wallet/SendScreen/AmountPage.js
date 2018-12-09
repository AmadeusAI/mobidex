import { BigNumber } from '0x.js';
import PropTypes from 'prop-types';
import React from 'react';
import Entypo from 'react-native-vector-icons/Entypo';
import * as TickerService from '../../../../services/TickerService';
import * as WalletService from '../../../../services/WalletService';
import { styles } from '../../../../styles';
import { formatAmount, getForexIcon, isValidAmount } from '../../../../utils';
import MaxButton from '../../../components/MaxButton';
import Row from '../../../components/Row';
import TokenAmount from '../../../components/TokenAmount';
import TouchableTokenAmount from '../../../components/TouchableTokenAmount';
import TokenAmountKeyboardLayout from '../../../layouts/TokenAmountKeyboardLayout';

export default class AmountPage extends TokenAmountKeyboardLayout {
  static get propTypes() {
    return {
      asset: PropTypes.object.isRequired,
      onSubmit: PropTypes.func.isRequired
    };
  }

  constructor(props) {
    super(props);

    this.state = {
      amount: [],
      forex: [],
      focus: 'amount',
      error: false
    };
  }

  renderTop() {
    const { asset } = this.props;
    const balance = WalletService.getAdjustedBalanceByAddress(asset.address);

    return (
      <React.Fragment>
        <TokenAmount
          label={'Wallet Amount'}
          symbol={asset.symbol}
          icon={<Entypo name="wallet" size={30} />}
          containerStyle={{
            marginTop: 10,
            marginBottom: 10,
            padding: 0
          }}
          symbolStyle={{ marginRight: 10 }}
          format={false}
          cursor={false}
          amount={formatAmount(balance ? balance : '0')}
          onPress={() => this.setState({ focus: 'amount' })}
        />
        <Row style={[styles.w100, styles.flex1]}>
          <TouchableTokenAmount
            label={'Send Amount'}
            symbol={asset.symbol}
            containerStyle={{
              flex: 1,
              marginTop: 10,
              marginBottom: 10,
              padding: 0
            }}
            symbolStyle={{ marginRight: 10 }}
            format={false}
            cursor={this.state.focus === 'amount'}
            cursorProps={{ style: { marginLeft: 2 } }}
            amount={this.state.amount.join('')}
            onPress={() => this.setState({ focus: 'amount' })}
            wrapperStyle={[styles.flex1]}
          />
          <MaxButton
            buttonStyle={[styles.mt3]}
            onPress={this.setMaxTokenAmount}
          />
        </Row>
        <TouchableTokenAmount
          label={'Send Amount in Forex'}
          symbol={'USD'}
          icon={getForexIcon('USD', { size: 30, style: { marginLeft: 10 } })}
          containerStyle={{
            marginTop: 10,
            marginBottom: 10,
            padding: 0
          }}
          symbolStyle={{ marginRight: 10 }}
          format={false}
          cursor={this.state.focus === 'forex'}
          cursorProps={{ style: { marginLeft: 2 } }}
          amount={this.state.forex.join('')}
          onPress={() => this.setState({ focus: 'forex' })}
        />
      </React.Fragment>
    );
  }

  getKeyboardProps() {
    return {
      decimal: this.state.amount.indexOf('.') !== -1
    };
  }

  getButtonProps() {
    return {
      title: 'Next'
    };
  }

  async press() {
    try {
      new BigNumber(this.state.amount);
      this.props.onSubmit(this.state.amount);
    } catch (err) {
      this.setState({ error: true });
    }
  }

  setColumn(column, valueArray) {
    if (!valueArray || !valueArray.length) {
      return;
    }

    const valueText = valueArray.join('');

    if (!isValidAmount(valueText)) {
      return;
    }

    const forexTicker = TickerService.getForexTicker(this.props.asset.symbol);
    const hasForexTicker = forexTicker && forexTicker.price;

    let amount = null;
    let forex = null;

    if (column === 'amount') {
      amount = valueArray;
      forex = hasForexTicker
        ? new BigNumber(valueText)
            .mul(forexTicker.price)
            .toString()
            .split('')
        : [];
    } else {
      amount = hasForexTicker
        ? formatAmount(new BigNumber(valueText).div(forexTicker.price)).split()
        : [];
      forex = valueArray;
    }

    this.setState({
      amount,
      forex
    });
  }

  setMaxTokenAmount = () => {
    const { asset } = this.props;
    const balance = WalletService.getBalanceByAddress(asset.address || null);
    this.setColumn('amount', balance.toString().split(''));
  };
}
