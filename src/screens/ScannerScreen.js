import { useIsFocused } from '@react-navigation/native';
import { BlurView } from 'expo-blur';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { StorageService } from '../services/storage';

export default function ScannerScreen({ navigation }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const insets = useSafeAreaInsets();

  const { theme } = useTheme();
  const styles = getStyles(theme);
  
  const isFocused = useIsFocused(); 

  // --- Animation Setup ---
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 1.05, 
          duration: 1000, 
          useNativeDriver: true, 
        }),
        Animated.timing(scaleAnim, {
          toValue: 1, 
          duration: 1000, 
          useNativeDriver: true,
        })
      ])
    ).start();
  }, [scaleAnim]);

  if (!permission) return <View style={styles.container} />;
  
  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Text style={{ color: theme.text, marginBottom: 20 }}>Camera permission required.</Text>
        <TouchableOpacity style={styles.btn} onPress={requestPermission}>
          <Text style={styles.btnText}>Grant</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const handleBarcodeScanned = async ({ data }) => {
    setScanned(true);
    try {
      const url = new URL(data);
      const cupboardId = url.searchParams.get("cupboard");
      const floorId = url.searchParams.get("floor") || "9";

      const sessionData = await StorageService.getSession();
      const userRole = sessionData?.role || "";
      const isAdmin = userRole === "admin";

      if (cupboardId) {
        navigation.navigate("Cupboard", { cupboardId, floorId, isAdmin });
      } else {
        alert("Invalid QR Code format.");
      }
    } catch (e) {
      alert("Unrecognized QR Code.");
    }
    
    setTimeout(() => setScanned(false), 2000); 
  };

  return (
    <View style={styles.container}>
      {/* Full Screen Camera */}
      {isFocused && (
        <CameraView
          style={StyleSheet.absoluteFillObject}
          facing="back"
          onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
          barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
        />
      )}
      
      {/* Glassmorphism Header */}
      <BlurView 
        intensity={50} 
        tint="dark" 
        style={[styles.header, { top: Math.max(insets.top, 20) }]}
      >
        <Text style={styles.headerText}>Scan QR</Text>
        <Text style={styles.subtitleText}>Align QR Code within the frame</Text>
      </BlurView>

      {/* Centered Scanner Reticle (No black overlay) */}
      <View style={styles.overlay}>
        <Animated.View style={[styles.focusedContainer, { transform: [{ scale: scaleAnim }] }]}>
          <View style={[styles.corner, styles.topLeft]} />
          <View style={[styles.corner, styles.topRight]} />
          <View style={[styles.corner, styles.bottomLeft]} />
          <View style={[styles.corner, styles.bottomRight]} />
        </Animated.View>
      </View>
    </View>
  );
}

const getStyles = (theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.background },
  
  header: { 
    position: 'absolute', 
    alignSelf: 'center',
    width: '85%', 
    zIndex: 10, 
    paddingVertical: 16,
    paddingHorizontal: 20, 
    alignItems: 'center', 
    borderRadius: 20,
    overflow: 'hidden', 
    backgroundColor: theme.background,
  },
  headerText: { color: theme.text, fontSize: 24, fontWeight: 'bold' },
  subtitleText: { color: theme.text, fontSize: 14, marginTop: 4, fontWeight: '500' },
  
  // Overlay Layout
  overlay: { 
    ...StyleSheet.absoluteFillObject, 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  focusedContainer: {
    width: 260, 
    height: 260,
    backgroundColor: 'transparent',
  },
  
  corner: {
    position: 'absolute',
    width: 50,
    height: 50,
    borderColor: '#FFFFFF',
    borderRadius: 8,
  },
  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 6,
    borderLeftWidth: 6,
    borderTopLeftRadius: 24,
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: 6,
    borderRightWidth: 6,
    borderTopRightRadius: 24,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 6,
    borderLeftWidth: 6,
    borderBottomLeftRadius: 24,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 6,
    borderRightWidth: 6,
    borderBottomRightRadius: 24,
  },

  btn: { backgroundColor: theme.primary, padding: 14, borderRadius: 12 },
  btnText: { color: theme.text, fontWeight: 'bold' }
});