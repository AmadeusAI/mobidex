import PropTypes from 'prop-types';
import React from 'react';
import { connect } from 'react-redux';
import Icon from 'react-native-vector-icons/FontAwesome';
import { formatAmount } from '../../../lib/utils';
import AddressInput from '../../components/AddressInput';
import TwoColumnListItem from '../../components/TwoColumnListItem';
import ConfirmationView from '../../views/ConfirmationView';

class AccountPage extends React.Component {
  static get propTypes() {
    return {
      asset: PropTypes.object.isRequired,
      amount: PropTypes.string.isRequired,
      onPrevious: PropTypes.func.isRequired,
      onNext: PropTypes.func.isRequired
    };
  }

  constructor(props) {
    super(props);

    this.state = {
      address: '',
      error: false
    };
  }

  render() {
    const { asset, amount } = this.props;

    return (
      <ConfirmationView
        buttonPropsRight={{
          title: 'Next',
          icon: <Icon name="check" size={24} color="white" />,
          disabled: !/^(0x)?[a-fA-F0-9]{40}$/.test(this.state.address)
        }}
        buttonPropsLeft={{
          title: 'Previous'
        }}
        pressLeft={this.pressLeft}
        pressRight={this.pressRight}
      >
        <TwoColumnListItem
          left="Amount"
          right={`${formatAmount(amount)} ${asset.symbol}`}
          style={{ marginBottom: 10, marginTop: 10 }}
          leftStyle={{ flex: 1, color: 'black' }}
          rightStyle={{ flex: 1, color: 'black' }}
          rowStyle={{ flex: 0, width: '100%' }}
        />
        <AddressInput
          placeholder="Address"
          onChangeText={v => this.setState({ address: v })}
          keyboardType="ascii-capable"
          containerStyle={{ width: '100%', marginBottom: 10 }}
        />
      </ConfirmationView>
    );
  }

  pressLeft = () => this.props.onPrevious();
  pressRight = () => {
    if (/^(0x)?[a-fA-F0-9]{40}$/.test(this.state.address)) {
      this.props.onNext(this.state.address);
    } else {
      this.setState({ error: true });
    }
  };
}

export default connect(
  state => ({
    ...state
  }),
  dispatch => ({ dispatch })
)(AccountPage);
