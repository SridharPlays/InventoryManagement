import { Alert, Platform } from 'react-native';

export const UniversalAlert = {
  alert: (title, message, buttons = []) => {
    if (Platform.OS === 'web') {
      if (buttons.length > 1) {
        const confirmMessage = `${title}\n\n${message}`;
        const isConfirmed = window.confirm(confirmMessage);
        if (isConfirmed) {
          const confirmAction = buttons.find(b => b.style === 'destructive' || b.text !== 'Cancel');
          if (confirmAction && confirmAction.onPress) confirmAction.onPress();
        } else {
          const cancelAction = buttons.find(b => b.style === 'cancel' || b.text === 'Cancel');
          if (cancelAction && cancelAction.onPress) cancelAction.onPress();
        }
      } else {
        window.alert(`${title}\n\n${message}`);
        if (buttons[0] && buttons[0].onPress) buttons[0].onPress();
      }
    } else {
      Alert.alert(title, message, buttons, { cancelable: true });
    }
  }
};