from flask import Flask, jsonify, Response, send_file
import os
from flask_cors import CORS
import cv2
import numpy as np
import threading
import time

app = Flask(__name__)
CORS(app)

# --- CONFIGURAÇÃO DO HARDWARE (RASPBERRY PI) ---
# 0 geralmente é a câmera padrão USB conectada no Raspberry.
# Se você tiver uma webcam e a térmica, teste 0 ou 1.
CAMERA_INDEX = 0 

# Resolução da Infiray P2 Pro (ajuste se usar outra)
FRAME_WIDTH = 256
FRAME_HEIGHT = 192

# Variável global para compartilhar o frame mais recente entre as rotas
global_frame = None
lock = threading.Lock() # Trava de segurança para threads

def start_camera_thread():
    """
    Thread dedicada para ler a câmera continuamente em segundo plano.
    Isso garante que o vídeo seja fluído e a análise de dados não trave a imagem.
    """
    global global_frame
    
    print(f"Tentando conectar na câmera {CAMERA_INDEX}...")
    cap = cv2.VideoCapture(CAMERA_INDEX)
    
    # Força a resolução da câmera térmica (Importante para drivers USB)
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, FRAME_WIDTH)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, FRAME_HEIGHT)
    
    # Tenta definir FPS para evitar lag
    cap.set(cv2.CAP_PROP_FPS, 25)

    if not cap.isOpened():
        print(f"❌ ERRO CRÍTICO: Não foi possível abrir a câmera {CAMERA_INDEX}.")
        print("Verifique se o adaptador USB está bem conectado no Raspberry Pi.")
        return

    print("✅ Câmera Térmica Iniciada com Sucesso!")

    while True:
        success, frame = cap.read()
        if success:
            with lock:
                global_frame = frame.copy()
        else:
            print("Aviso: Falha ao ler frame da câmera.")
            time.sleep(1) # Espera um pouco antes de tentar de novo
            
        time.sleep(0.01) # Pequena pausa para economizar CPU do Raspberry
            
# Inicia a câmera em uma thread separada assim que o script roda
t = threading.Thread(target=start_camera_thread)
t.daemon = True # Garante que a thread morra quando fechar o programa
t.start()

def generate_frames():
    """Gerador de frames para o Streaming MJPEG"""
    global global_frame
    while True:
        with lock:
            if global_frame is None:
                continue
            
            # Processamento Visual: Aplica cor para ficar bonito no dashboard
            # A Infiray as vezes manda imagem P/B, o COLORMAP_INFERNO deixa com cara de térmica
            frame_colorido = cv2.applyColorMap(global_frame, cv2.COLORMAP_INFERNO)
            
            # Codifica para JPEG (formato leve para web)
            ret, buffer = cv2.imencode('.jpg', frame_colorido)
            frame_bytes = buffer.tobytes()

        # Estrutura do protocolo MJPEG (Motion JPEG)
        yield (b'--frame\r\n'
               b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')

@app.route('/api/video')
def stream_video():
    """
    Rota de Streaming AO VIVO.
    O Frontend usa isso na tag <img src="..."> ou via MJPEG player.
    """
    return Response(generate_frames(), mimetype='multipart/x-mixed-replace; boundary=frame')


@app.route('/api/video-file')
def serve_video_file():
    """Serve um arquivo MP4 de fallback quando a câmera não estiver disponível."""
    video_path = os.path.join(os.path.dirname(__file__), 'video_granja.mp4')
    if os.path.exists(video_path):
        return send_file(video_path, mimetype='video/mp4')
    return ("Vídeo de fallback não encontrado. Gere 'video_granja.mp4' em /backend.", 404)

@app.route('/api/status', methods=['GET'])
def get_status():
    global global_frame
    
    with lock:
        if global_frame is None:
            return jsonify({
                "temperatura": 0,
                "status": "OFFLINE",
                "cor": "gray",
                "mensagem": "Inicializando câmera ou sensor desconectado..."
            })
        
        # Trabalhamos com uma cópia para análise
        frame_analise = global_frame.copy()

    # --- LÓGICA DE VISÃO COMPUTACIONAL REAL ---
    
    # 1. Garante escala de cinza para medir intensidade
    if len(frame_analise.shape) == 3:
        gray = cv2.cvtColor(frame_analise, cv2.COLOR_BGR2GRAY)
    else:
        gray = frame_analise

    # 2. Leitura direta do frame: devolvemos métricas objetivas sem "simular" °C.
    # Observação: a decodificação correta para °C depende do formato RAW Y16
    # fornecido por alguns sensores térmicos e exige drivers específicos.
    # Aqui não estimamos temperatura em °C; fornecemos apenas estatísticas do frame.
    brilho_medio = float(np.mean(gray))
    brilho_min = int(np.min(gray))
    brilho_max = int(np.max(gray))

    return jsonify({
        "temperatura": None,
        "status": "LIVE",
        "cor": "green",
        "mensagem": "Feed térmico AO VIVO (sem estimativa em °C).",
        "metrics": {
            "brilho_medio": round(brilho_medio, 2),
            "brilho_min": brilho_min,
            "brilho_max": brilho_max,
            "frame_shape": frame_analise.shape
        }
    })

if __name__ == '__main__':
    print("🐔 ChickGuard AI - Servidor IoT Iniciado")
    print("Acesse na rede local via IP do Raspberry Pi")
    # host='0.0.0.0' libera o acesso para outros dispositivos na rede Wi-Fi
    app.run(host='0.0.0.0', port=5000, debug=False)
