import PropTypes from 'prop-types';
import React from 'react';
import {Navigation} from 'react-native-navigation';
import {
  buildNavigationComponent,
  NavigationContext,
  showModal,
  showErrorModal,
  waitForComponentAppear,
  waitForComponentDisappear,
} from '../navigation';

export default class NavigationProvider extends React.Component {
  static get propTypes() {
    return {
      componentId: PropTypes.string.isRequired,
      children: PropTypes.node.isRequired,
    };
  }

  render() {
    return (
      <NavigationContext.Provider
        value={{
          componentId: this.props.componentId,
          push: this.push,
          pop: this.pop,
          popToRoot: this.popToRoot,
          showModal: showModal,
          showErrorModal: showErrorModal,
          dismissModal: this.dismissModal,
          waitForAppear: this.waitForAppear,
          waitForDisappear: this.waitForDisappear,
        }}>
        {this.props.children}
      </NavigationContext.Provider>
    );
  }

  push = (name, props) => {
    Navigation.push(this.props.componentId, {
      component: buildNavigationComponent(null, name, props),
    });
  };

  pop = () => {
    Navigation.pop(this.props.componentId);
  };

  popToRoot = () => {
    Navigation.popToRoot(this.props.componentId);
  };

  dismissModal = () => {
    Navigation.dismissModal(this.props.componentId);
  };

  waitForAppear = (fn, wait = 50, attempts = 20) => {
    waitForComponentAppear(this.props.componentId, fn, wait, attempts);
  };

  waitForDisappear = (fn, wait = 50, attempts = 20) => {
    waitForComponentDisappear(this.props.componentId, fn, wait, attempts);
  };
}
