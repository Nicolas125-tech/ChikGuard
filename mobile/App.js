import React, { useState, useEffect, useCallback } from 'react';
import { 
  StyleSheet, Text, View, TextInput, TouchableOpacity, 
  ScrollView, SafeAreaView, StatusBar, ActivityIndicator, Alert 
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { WebView } from 'react-native-webview';
import { 
  Thermometer, Activity, AlertTriangle, CheckCircle, 
  Wifi, Settings, Save, RefreshCw, Zap, Wind 
} from 'lucide-react-native';

export default function App() {
  // Estado para armazenar o IP
  const [serverIP, setServerIP] = useState('');
  const [isConfigured, setIsConfigured] = useState(false);
  
  // Estado de Dados
  const [dados, setDados] = useState(null);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(new Date());

  // Carregar IP salvo ao abrir o app
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const savedIP = await AsyncStorage.getItem('cg_server_ip');
        if (savedIP) {
          setServerIP(savedIP);
          setIsConfigured(true);
        }
      } catch (e) {
        console.error("Erro ao carregar configuração");
      }
    };
    loadConfig();
  }, []);

  // Função para salvar o IP
  const handleSaveConfig = async () => {
    if (!serverIP) return Alert.alert("Erro", "Digite um IP válido");
    try {
      await AsyncStorage.setItem('cg_server_ip', serverIP);
      setIsConfigured(true);
      setLoading(true);
      buscarDados();
    } catch (e) {
      Alert.alert("Erro", "Não foi possível salvar");
    }
  };

  // URLs dinâmicas
  const API_URL = `http://${serverIP}:5000/api/status`;
  const VIDEO_URL = `http://${serverIP}:5000/api/video`;

  const buscarDados = useCallback(async () => {
    if (!serverIP) return;
    
    try {
      // AbortController para timeout rápido (2s)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);

      const response = await fetch(API_URL, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!response.ok) throw new Error('Falha HTTP');

      const data = await response.json();
      setDados(data);
      setLastUpdate(new Date());
      setErro(false);
      setLoading(false);
    } catch (error) {
      setErro(true);
      setLoading(false);
    }
  }, [serverIP]);

  // Loop de atualização (Polling)
  useEffect(() => {
    if (isConfigured) {
      buscarDados();
      const interval = setInterval(buscarDados, 1000);
      return () => clearInterval(interval);
    }
  }, [isConfigured, buscarDados]);

  // --- COMPONENTES VISUAIS ---

  // Tela de Configuração (Primeiro Acesso)
  if (!isConfigured) {
    return (
      <View style={styles.containerCenter}>
        <StatusBar barStyle="light-content" />
        <View style={styles.cardConfig}>
          <View style={styles.iconCircle}>
            <Settings size={32} color="#10b981" />
          </View>
          <Text style={styles.title}>Configurar ChickGuard</Text>
          <Text style={styles.subtitle}>Digite o IP do Raspberry Pi:</Text>
          
          <TextInput
            style={styles.input}
            placeholder="Ex: 192.168.1.100"
            placeholderTextColor="#64748b"
            value={serverIP}
            onChangeText={setServerIP}
            keyboardType="numeric"
          />
          
          <TouchableOpacity style={styles.buttonPrimary} onPress={handleSaveConfig}>
            <Save size={20} color="#FFF" />
            <Text style={styles.buttonText}>Salvar e Conectar</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Cores dinâmicas
  const getStatusColor = () => {
    if (!dados) return "#334155";
    if (dados.cor === 'blue') return "#2563eb";
    if (dados.cor === 'red') return "#dc2626";
    return "#10b981"; // Green
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
      
      {/* HEADER */}
      <View style={styles.header}>
        <View>
          <Text style={styles.appName}>ChickGuard <Text style={{color: '#10b981'}}>AI</Text></Text>
          <View style={styles.statusBadge}>
            <View style={[styles.statusDot, { backgroundColor: erro ? '#ef4444' : '#10b981' }]} />
            <Text style={styles.statusText}>
              {erro ? "DESCONECTADO" : "ONLINE"} • {serverIP}
            </Text>
          </View>
        </View>
        <TouchableOpacity onPress={() => setIsConfigured(false)} style={styles.settingsButton}>
          <Settings size={24} color="#94a3b8" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        {/* CARTÃO DE STATUS PRINCIPAL */}
        <View style={[styles.mainCard, { backgroundColor: getStatusColor() }]}>
          <View style={styles.cardHeader}>
            <View>
              <Text style={styles.cardLabel}>TEMPERATURA MÉDIA</Text>
              <Text style={styles.tempText}>{dados ? dados.temperatura : '--'}°</Text>
            </View>
            <View style={styles.iconBox}>
              {dados?.cor === 'green' ? 
                <CheckCircle size={32} color="#FFF" /> : 
                <AlertTriangle size={32} color="#FFF" />
              }
            </View>
          </View>
          <Text style={styles.statusTitle}>{dados ? dados.status : 'Carregando...'}</Text>
          <Text style={styles.statusMsg}>{dados ? dados.mensagem : 'Aguardando dados do sensor...'}</Text>
        </View>

        {/* ÁREA DE VÍDEO (WEBVIEW PARA STREAMING) */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Visão Térmica</Text>
          <View style={styles.liveBadge}>
            <View style={styles.redDot} />
            <Text style={styles.liveText}>AO VIVO</Text>
          </View>
        </View>

        <View style={styles.videoContainer}>
          {erro ? (
            <View style={styles.videoPlaceholder}>
              <Wifi size={48} color="#ef4444" />
              <Text style={styles.errorText}>Sem sinal de vídeo</Text>
              <TouchableOpacity onPress={buscarDados} style={styles.retryButton}>
                <RefreshCw size={16} color="#FFF" />
                <Text style={styles.retryText}>Reconectar</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <WebView
              source={{ uri: VIDEO_URL }}
              style={styles.webview}
              scrollEnabled={false}
              scalesPageToFit={true} // Ajusta o vídeo à tela
            />
          )}
        </View>

        {/* BOTÕES DE AÇÃO */}
        <View style={styles.actionGrid}>
          <TouchableOpacity style={styles.actionButton}>
            <Wind size={28} color="#3b82f6" />
            <Text style={styles.actionLabel}>Ventilação</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.actionButton}>
            <Zap size={28} color="#f97316" />
            <Text style={styles.actionLabel}>Aquecedor</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.footerText}>
          Última atualização: {lastUpdate.toLocaleTimeString()}
        </Text>

      </ScrollView>
    </SafeAreaView>
  );
}

// ESTILOS (CSS DO REACT NATIVE)
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a', // Slate 900
  },
  containerCenter: {
    flex: 1,
    backgroundColor: '#0f172a',
    justifyContent: 'center',
    padding: 20,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  
  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#0f172a',
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  appName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFF',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600',
  },
  settingsButton: {
    padding: 8,
    backgroundColor: '#1e293b',
    borderRadius: 50,
  },

  // Main Card
  mainCard: {
    borderRadius: 24,
    padding: 24,
    marginBottom: 24,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  cardLabel: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 4,
  },
  tempText: {
    fontSize: 56,
    fontWeight: 'bold',
    color: '#FFF',
    includeFontPadding: false,
  },
  iconBox: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    padding: 12,
    borderRadius: 16,
  },
  statusTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: 4,
  },
  statusMsg: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    lineHeight: 20,
  },

  // Video Section
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#e2e8f0',
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.5)',
  },
  redDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#ef4444',
    marginRight: 6,
  },
  liveText: {
    color: '#ef4444',
    fontSize: 10,
    fontWeight: 'bold',
  },
  videoContainer: {
    height: 220,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#000',
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 24,
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
    opacity: 0.9,
  },
  videoPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    color: '#ef4444',
    marginTop: 10,
    marginBottom: 15,
  },
  retryButton: {
    flexDirection: 'row',
    backgroundColor: '#334155',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  retryText: {
    color: '#FFF',
    marginLeft: 8,
    fontWeight: '600',
  },

  // Actions
  actionGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  actionButton: {
    width: '48%',
    backgroundColor: '#1e293b',
    padding: 20,
    borderRadius: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  actionLabel: {
    color: '#cbd5e1',
    marginTop: 8,
    fontWeight: '600',
    fontSize: 14,
  },

  // Config Screen
  cardConfig: {
    backgroundColor: '#1e293b',
    padding: 24,
    borderRadius: 24,
    alignItems: 'center',
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: 8,
  },
  subtitle: {
    color: '#94a3b8',
    marginBottom: 20,
  },
  input: {
    width: '100%',
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 12,
    padding: 16,
    color: '#FFF',
    fontSize: 16,
    marginBottom: 20,
    textAlign: 'center',
  },
  buttonPrimary: {
    width: '100%',
    backgroundColor: '#10b981',
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 16,
    marginLeft: 8,
  },
  footerText: {
    textAlign: 'center',
    color: '#475569',
    fontSize: 12,
    marginTop: 10,
  }
});