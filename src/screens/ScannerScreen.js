import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useIsFocused } from '@react-navigation/native'; // <-- Import this
import { COLORS } from '../constants/theme';

export default function ScannerScreen({ navigation }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  
  // This hook returns true if the screen is currently active/visible
  const isFocused = useIsFocused(); 

  if (!permission) return <View style={styles.container} />;
  
  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Text style={{ color: COLORS.text, marginBottom: 20 }}>Camera permission required.</Text>
        <TouchableOpacity style={styles.btn} onPress={requestPermission}>
          <Text style={styles.btnText}>Grant</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const handleBarcodeScanned = ({ data }) => {
    setScanned(true);
    try {
      const url = new URL(data);
      const cupboardId = url.searchParams.get("cupboard");
      const floorId = url.searchParams.get("floor") || "9";

      if (cupboardId) {
        navigation.navigate("Cupboard", { cupboardId, floorId });
      } else {
        alert("Invalid QR Code format.");
      }
    } catch (e) {
      alert("Unrecognized QR Code.");
    }
    
    // Reset scanner after navigating away
    setTimeout(() => setScanned(false), 2000); 
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerText}>Scan QR</Text>
      </View>
      <View style={styles.scannerWrapper}>
        
        {/* Only render the CameraView if the screen is currently focused */}
        {isFocused && (
          <CameraView
            style={StyleSheet.absoluteFillObject}
            facing="back"
            onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
            barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
          />
        )}
        
        <View style={styles.overlay}>
          <View style={styles.scanTarget} />
          <Text style={styles.overlayText}>Align QR Code within the frame</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background },
  header: { padding: 20, alignItems: 'center', position: 'absolute', top: 40, width: '100%', zIndex: 10 },
  headerText: { color: COLORS.text, fontSize: 24, fontWeight: 'bold' },
  scannerWrapper: { flex: 1 },
  overlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center' },
  scanTarget: { width: 260, height: 260, borderWidth: 6, borderColor: COLORS.primary, borderRadius: 24, backgroundColor: 'transparent' },
  overlayText: { color: COLORS.text, marginTop: 40, fontSize: 16 },
  btn: { backgroundColor: COLORS.primary, padding: 14, borderRadius: 12 },
  btnText: { color: COLORS.text, fontWeight: 'bold' }
});