import React, { Component } from 'react';
import reactMixin from 'react-mixin';
import { Input, Text } from 'react-native-elements';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { connect } from 'react-redux';
import TimerMixin from 'react-timer-mixin';
import { unlock } from '../../thunks';
import Button from '../components/Button';
import LongInput from '../components/LongInput';
import BigCenter from '../components/BigCenter';
import * as WalletService from '../services/WalletService';

@reactMixin.decorate(TimerMixin)
class Unlock extends Component {
  constructor(props) {
    super(props);

    this.state = {
      password: '',
      passwordError: false
    };
  }

  onSetPassword = value => {
    this.setState({ password: value, passwordError: false });
  };

  unlock = () => {
    this.requestAnimationFrame(async () => {
      try {
        await WalletService.unlock(this.state.password);
      } catch (err) {
        this.setState({ passwordError: true });
        return;
      }

      if (this.props.onFinish) await this.props.onFinish();
    });
  };

  render() {
    return (
      <BigCenter style={{ width: '100%' }}>
        <LongInput
          secureTextEntry={true}
          placeholder="Password"
          onChangeText={this.onSetPassword}
          errorMessage={
            this.state.passwordError
              ? 'Wrong or poorly formatted password. Passwords must be at least 6 characters long and must contain both numbers and letters.'
              : null
          }
          errorStyle={{ color: 'red' }}
          leftIcon={<Icon name="person" size={24} color="black" />}
          containerStyle={{ marginBottom: 10 }}
        />
        <Button
          large
          title="Unlock"
          onPress={this.unlock}
          containerStyle={{ width: '100%' }}
        />
      </BigCenter>
    );
  }
}

export default connect(state => ({}), dispatch => ({ dispatch }))(Unlock);
