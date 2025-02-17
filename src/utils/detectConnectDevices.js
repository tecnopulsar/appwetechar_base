const { exec } = require('child_process');

function detectConnectedDevices() {
    exec('arp-scan --localnet', (error, stdout, stderr) => {
        if (error) {
            console.error(`Error: ${error.message}`);
            return;
        }
        if (stderr) {
            console.error(`Stderr: ${stderr}`);
            return;
        }
        console.log(`Dispositivos conectados:\n${stdout}`);
        // Aquí puedes analizar la salida para detectar la app móvil
    });
}

// Escanear dispositivos cada 10 segundos
setInterval(detectConnectedDevices, 10000);