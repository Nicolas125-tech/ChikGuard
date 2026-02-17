import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Thermometer, AlertTriangle, CheckCircle, Activity, WifiOff, RefreshCw } from 'lucide-react';

function App() {
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState(false);
  const [loading, setLoading] = useState(true);
  const [conectado, setConectado] = useState(false);  // Novo: rastrear se está conectado ao backend
  const [useFallback, setUseFallback] = useState(false);

  // Dados padrão quando backend estiver offline
  const offlineData = {
    temperatura: null,
    status: 'OFFLINE',
    cor: 'gray',
    mensagem: 'Conecte a câmera térmica no backend.'
  };

  const buscarDados = async () => {
    try {
      // Tenta conectar no Python (Backend Real)
      const response = await axios.get('http://localhost:5000/api/status', { 
        timeout: 3000,
        headers: {
          'Content-Type': 'application/json'
        }
      });
      console.log("✅ Dados recebidos do backend:", response.data);
      setDados(response.data);
      setConectado(true);  // Agora sabemos que está conectado
      setErro(false);
      setLoading(false);
    } catch (error) {
      console.warn("⚠️ Backend offline:", error.message);
      setDados(offlineData);
      setConectado(false);
      setErro(true);
      setLoading(false);
    }
  };

  useEffect(() => {
    buscarDados();
    // Polling a cada 2 segundos
    const intervalo = setInterval(buscarDados, 2000);
    return () => clearInterval(intervalo);
  }, []);

  // --- TELA DE CARREGAMENTO ---
  if (loading || !dados) return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center text-white">
      <Activity size={48} className="text-orange-500 mb-4 animate-bounce" />
      <h2 className="text-xl font-bold">Conectando ao ChickGuard...</h2>
    </div>
  );

  // --- DEFINIÇÃO DE CORES ---
  const corDeFundo = 
    dados.cor === 'red' ? 'bg-red-900/40 border-red-500' :
    dados.cor === 'blue' ? 'bg-blue-900/40 border-blue-500' :
    'bg-green-900/40 border-green-500';

  const corTexto = 
    dados.cor === 'red' ? 'text-red-400' :
    dados.cor === 'blue' ? 'text-blue-400' :
    'text-green-400';

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 font-sans p-4 md:p-8">
      {/* Cabeçalho */}
      <header className="flex flex-col md:flex-row justify-between items-center mb-10 border-b border-gray-800 pb-4 gap-4">
        <div className="flex items-center gap-3">
          <Activity className="text-orange-500" size={32} />
          <h1 className="text-3xl font-bold tracking-tight">ChickGuard <span className="text-orange-500">AI</span></h1>
        </div>
        
        {/* Status Real */}
        <div className={`flex items-center gap-2 text-sm px-4 py-1.5 rounded-full border ${
          conectado 
            ? 'bg-green-900/30 border-green-600 text-green-400' 
            : 'bg-yellow-900/30 border-yellow-600 text-yellow-400'
        }`}>
          <div className={`w-2 h-2 rounded-full ${conectado ? 'bg-green-500' : 'bg-yellow-500'} animate-pulse`}></div>
          {conectado ? '✅ Backend Real (localhost:5000)' : '⚠️ Modo Simulação'}
        </div>
      </header>

      {/* Grid Principal */}
      <main className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* Cartão de Temperatura */}
        <div className="bg-gray-900 p-8 rounded-3xl border border-gray-800 shadow-2xl flex flex-col items-center justify-center relative overflow-hidden group hover:border-gray-700 transition-colors">
          <Thermometer size={48} className="text-gray-500 mb-6" />
          
          <div className="relative">
            <div className="text-8xl font-bold mb-2 tracking-tighter">{dados.temperatura}°C</div>
            <div className={`absolute inset-0 blur-3xl opacity-20 ${dados.cor === 'red' ? 'bg-red-500' : dados.cor === 'blue' ? 'bg-blue-500' : 'bg-green-500'}`}></div>
          </div>
          
          <p className="text-gray-400 uppercase tracking-widest text-sm font-medium">Temperatura Média</p>
          
          <div className="w-full h-3 bg-gray-800 mt-8 rounded-full overflow-hidden relative">
             <div 
               className="h-full transition-all duration-500 ease-out relative z-10"
               style={{ 
                 width: `${Math.min(((dados.temperatura / 50) * 100), 100)}%`,
                 backgroundColor: dados.cor === 'red' ? '#ef4444' : dados.cor === 'blue' ? '#3b82f6' : '#22c55e'
               }}
             ></div>
          </div>
        </div>

        {/* Cartão de Status */}
        <div className={`p-8 rounded-3xl border-2 shadow-2xl flex flex-col justify-between transition-all duration-500 ${corDeFundo}`}>
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className={`p-3 rounded-xl bg-black/20 ${corTexto}`}>
                {dados.cor === 'green' ? <CheckCircle size={32} /> : <AlertTriangle size={32} />}
              </div>
              <h2 className={`text-2xl font-bold ${corTexto} tracking-tight`}>
                {dados.status}
              </h2>
            </div>
            <p className="text-lg font-medium text-white/90 leading-relaxed border-l-4 border-white/20 pl-4">
              {dados.mensagem}
            </p>
          </div>

          <div className="mt-8 bg-black/40 backdrop-blur-sm p-5 rounded-2xl border border-white/10">
            <h3 className="text-xs font-bold text-gray-400 mb-3 uppercase tracking-wider">Ação Recomendada</h3>
            <div className="flex items-center gap-3">
              {dados.cor === 'red' && <p className="font-bold text-white">⚠️ Ativar Ventilação Imediatamente</p>}
              {dados.cor === 'blue' && <p className="font-bold text-white">🔥 Verificar Aquecedores</p>}
              {dados.cor === 'green' && <p className="font-bold text-white">✅ Monitoramento Normal</p>}
            </div>
          </div>
        </div>

      </main>

      {/* Câmera Térmica - Stream AO VIVO (MJPEG) */}
      <div className="max-w-5xl mx-auto mt-8 bg-gray-900 rounded-3xl border border-gray-800 p-2 shadow-2xl">
        <div className="bg-black h-80 rounded-2xl flex items-center justify-center text-gray-600 relative overflow-hidden group">
          {/* Usamos <img> para MJPEG (multipart/x-mixed-replace) servido por /api/video */}
          {!useFallback ? (
            <img
              src="http://localhost:5000/api/video"
              alt="Câmera térmica ao vivo"
              className="w-full h-full object-cover rounded-2xl bg-black"
              crossOrigin="anonymous"
              onError={(e) => {
                console.error('Erro ao carregar stream MJPEG, ativando fallback MP4', e);
                setUseFallback(true);
              }}
            />
          ) : (
            <video
              className="w-full h-full object-cover rounded-2xl bg-black"
              autoPlay
              loop
              muted
              controls
              playsInline
            >
              <source src="http://localhost:5000/api/video-file" type="video/mp4" />
              Seu navegador não suporta vídeo.
            </video>
          )}

          {/* Label sobreposto */}
          <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-sm px-3 py-2 rounded-lg border border-gray-700 z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <p className="font-mono text-sm text-gray-300">📹 Câmera Térmica AO VIVO</p>
          </div>

          {/* Overlay de cor dinâmica */}
          <div className="absolute inset-0 opacity-10 pointer-events-none" style={{
            background: dados.cor === 'red'
              ? 'radial-gradient(circle at center, rgba(255,50,50,0.6) 0%, rgba(50,0,0,0.2) 60%, rgba(0,0,0,0.8) 100%)'
              : dados.cor === 'blue'
                ? 'radial-gradient(circle at center, rgba(50,50,255,0.6) 0%, rgba(0,0,50,0.2) 60%, rgba(0,0,0,0.8) 100%)'
                : 'radial-gradient(circle at center, rgba(50,255,50,0.2) 0%, rgba(0,50,0,0.1) 60%, rgba(0,0,0,0.8) 100%)'
          }}></div>
        </div>
      </div>
    </div>
  );
}

export default App;
