const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const { exec } = require('child_process');
const http = require('http');
const socketIo = require('socket.io');

const HOSTAPD_CONF = '/etc/hostapd/hostapd.conf';
const DEFAULT_CONF = `interface=wlan0
driver=nl80211
ssid=RaspberryAP
hw_mode=g
channel=6
wmm_enabled=0
macaddr_acl=0
auth_algs=1
ignore_broadcast_ssid=0
wpa=2
wpa_passphrase=rasp1234
wpa_key_mgmt=WPA-PSK
wpa_pairwise=TKIP
rsn_pairwise=CCMP`;

// Función para asegurar la configuración del hotspot (igual que antes)
function ensureHotspotConfig() {
  fs.readFile(HOSTAPD_CONF, 'utf8', (err, data) => {
    if (err || !data.includes('ssid=RaspberryAP') || !data.includes('wpa_passphrase=rasp1234')) {
      console.log('Configuración incorrecta o inexistente. Aplicando configuración por defecto...');
      fs.writeFile(HOSTAPD_CONF, DEFAULT_CONF, 'utf8', (err) => {
        if (err) {
          console.error('Error al escribir la configuración de hostapd:', err);
        } else {
          console.log('Configuración de hostapd actualizada con los valores por defecto.');
          exec('sudo systemctl restart hostapd', (error, stdout, stderr) => {
            if (error) {
              console.error(`Error al reiniciar hostapd: ${error}`);
            } else {
              console.log('Servicio hostapd reiniciado correctamente.');
            }
          });
        }
      });
    } else {
      console.log('La configuración del hotspot ya está establecida.');
    }
  });
}

// Crear ventana de la aplicación
function createWindow () {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });
  win.loadFile('index.html');
}

// --- Configuración de Socket.io ---
const server = http.createServer();
const io = socketIo(server);

io.on('connection', (socket) => {
  console.log('Nuevo cliente conectado:', socket.id);
  socket.on('register', (data) => {
    console.log(`Cliente registrado como: ${data.type}`);
    // Puedes guardar o diferenciar clientes según su tipo ("appmovil", "otro", etc.)
  });
  socket.on('disconnect', () => {
    console.log('Cliente desconectado:', socket.id);
  });
});

// Función para obtener la lista de clientes conectados
function getConnectedClients() {
  // Ejecutar el comando "iw" para obtener información de los clientes conectados
  exec('iw dev wlan0 station dump', (error, stdout, stderr) => {
    if (error) {
      console.error('Error obteniendo clientes conectados:', error);
      return;
    }
    const clients = parseClients(stdout);
    // Emitir un evento con la lista actualizada
    io.sockets.emit('clients-update', { clients });
    console.log('Clientes conectados actualizados:', clients);
  });
}

// Función para parsear la salida del comando "iw dev wlan0 station dump"
function parseClients(output) {
  const clients = [];
  const lines = output.split('\n');
  let client = null;
  lines.forEach(line => {
    line = line.trim();
    if (line.startsWith('Station')) {
      // Se encontró un nuevo cliente; si ya se estaba procesando otro, agrégalo
      if (client) {
        clients.push(client);
      }
      client = { mac: line.split(' ')[1] };
    } else if (line.startsWith('signal:')) {
      if (client) {
        // Se obtiene la intensidad de la señal (valor en dBm)
        client.signal = line.split(' ')[1];
      }
    }
    // Puedes agregar más parsers para otros datos relevantes (por ejemplo, tx bitrate, rx bitrate, etc.)
  });
  if (client) {
    clients.push(client);
  }
  return clients;
}

// Configurar el intervalo para actualizar la lista de clientes cada 5 segundos
setInterval(getConnectedClients, 5000);

// Arranque de la aplicación Electron
app.whenReady().then(() => {
  ensureHotspotConfig();
  createWindow();
  server.listen(3000, () => {
    console.log('Socket.io server escuchando en el puerto 3000');
  });
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
