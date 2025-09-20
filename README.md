# Home-app-node

¡Bienvenido al backend de tu aplicación de pagos! Este proyecto utiliza Node.js y el cliente de Open Payments para procesar transacciones seguras.

🚀 Guía de Inicio Rápido
Sigue estos pasos para poner en marcha el proyecto en tu máquina local.

Prerrequisitos
Asegúrate de tener instalado Node.js y npm (el gestor de paquetes de Node.js). Puedes descargarlo desde nodejs.org.

1. Instalación de dependencias
Abre tu terminal en la carpeta raíz del proyecto y ejecuta el siguiente comando para instalar las librerías necesarias (como Express, Body-Parser y la librería de Open Payments):

#colocalo en tu terminal: npm install

 Creación de la Clave Privada y Configuración
Para que el cliente de Open Payments pueda firmar las solicitudes, necesitas una clave privada. Esta clave nunca debe subirse a Git ni compartirse crealo desde tu wallet y colocalo en los archivos 
2. Configurar las credenciales
En tu archivo index.js, asegúrate de que la ruta del archivo y el keyId de la billetera sean correctos. La línea para leer la clave es la siguiente:

const privateKey = fs.readFileSync("private.key", "utf8");
// Asegúrate de que tu 'keyId' coincida con el de tu billetera Open Payments
const client = await createAuthenticatedClient({
  walletAddressUrl: "https://ilp.interledger-test.dev/prueba-mvr",
  privateKey: privateKey,
  keyId: "<TU_KEY_ID>",
});

🛠️ Uso y Endpoints de la API
Este backend expone dos endpoints principales para gestionar los pagos.

1. Iniciar un pago (/api/start-pay)
Este endpoint se encarga de crear el pago entrante y la cotización, y luego solicita la concesión de pago saliente con una URL de redirección.

Método: POST

URL: http://localhost:3000/api/start-pay

Cuerpo de la solicitud (JSON):

JSON

{
  "senderWalletAddressUrl": "https://ilp.interledger-test.dev/danieles2541",
  "receiverWalletAddressUrl": "https://ilp.interledger-test.dev/prueba-mvr",
  "amount": "100"
}
Respuesta Exitosa (JSON):

JSON

{
  "success": true,
  "redirectUrl": "https://ilp.interledger-test.dev/interact/...",
  "continueAccessToken": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "continueUri": "https://ilp.interledger-test.dev/continue/...",
  "quoteId": "https://ilp.interledger-test.dev/quote/...",
  "sendingWalletAddressId": "https://ilp.interledger-test.dev/danieles2541",
  "sendingWalletResourceServer": "https://ilp.interledger-test.dev"
}
2. Completar un pago (/api/complete-pay)
Este endpoint finaliza el proceso de pago utilizando los datos de la URL de redirección y los tokens recibidos en el paso anterior.

Método: POST

URL: http://localhost:3000/api/complete-pay

Cuerpo de la solicitud (JSON):

JSON

{
  "continueUri": "https://ilp.interledger-test.dev/continue/...",
  "accessToken": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "quoteId": "https://ilp.interledger-test.dev/quote/...",
  "sendingWalletAddressId": "https://ilp.interledger-test.dev/danieles2541",
  "sendingWalletResourceServer": "https://ilp.interledger-test.dev"
}
Respuesta Exitosa (JSON):

JSON

{
  "success": true,
  "message": "El pago se ha procesado con éxito.",
  "outgoingPayment": {
    // ... detalles del pago completado
  }
}
🚀 ¡Listo para Iniciar!
Una vez que tengas todo configurado, inicia el servidor de Node.js con el siguiente comando:

#Bash

node index.js
