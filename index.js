// index.js

import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors'; // Importa el paquete 'cors'
import { createAuthenticatedClient, isFinalizedGrant } from '@interledger/open-payments';
import fs from 'fs';

// Inicializa el servidor Express
const app = express();
const port = 3000;

// Middleware para procesar JSON
app.use(bodyParser.json());

// ----------------------------------------------------
// CAMBIO AÑADIDO: HABILITAR CORS
// ----------------------------------------------------
// Configura CORS para permitir solicitudes desde tu frontend de React
// Reemplaza 'http://localhost:5173' con la URL real de tu frontend si es diferente
const corsOptions = {
  origin: 'http://localhost:5175', 
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));
// Si solo quieres permitir cualquier origen, podrías usar: app.use(cors());
// ----------------------------------------------------

// Función para crear una pausa asíncrona (simula el tiempo de espera del servidor)
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Cargar la clave privada y configurar el cliente de Open Payments
const privateKey = fs.readFileSync("private.key", "utf8");
let client;

//
//
// Función asíncrona para iniciar el servidor
async function startServer() {
  try {
    // Inicializa el cliente solo una vez, cuando la aplicación arranca.
    client = await createAuthenticatedClient({
      walletAddressUrl: "https://ilp.interledger-test.dev/prueba-mvr",
      privateKey: privateKey,
      keyId: "2a0bbcd5-2885-46ad-bfba-1fe973014a5c",
    });
    console.log("✅ Cliente de Open Payments autenticado con éxito.");

    // Inicia el servidor Express solo si el cliente se autenticó correctamente.
    app.listen(port, () => {
      console.log(`Servidor de pagos escuchando en http://localhost:${port}`);
    });
  } catch (error) {
    console.error('❌ Error al iniciar el servidor o autenticar el cliente:', error.message);
    console.error('Asegúrate de que la clave privada y el keyId sean correctos para la billetera ilp.interledger-test.dev/prueba-mvr.');
    process.exit(1);
  }
}

// Inicia el servidor
startServer();

// Endpoint para iniciar el pago
app.post('/api/start-pay', async (req, res) => {
  try {
    const { senderWalletAddressUrl, receiverWalletAddressUrl, amount } = req.body;
    if (!senderWalletAddressUrl || !receiverWalletAddressUrl || !amount) {
      return res.status(400).json({ success: false, message: 'Faltan parámetros en el cuerpo de la solicitud.' });
    }

    console.log(`Iniciando pago de ${amount} desde ${senderWalletAddressUrl} hacia ${receiverWalletAddressUrl}`);

    // Paso 1-5: Obtener direcciones, crear pago entrante y cotización
    const sendingWalletAddress = await client.walletAddress.get({ url: senderWalletAddressUrl });
    const receivingWalletAddress = await client.walletAddress.get({ url: receiverWalletAddressUrl });
    const incomingPaymentGrant = await client.grant.request({ url: receivingWalletAddress.authServer }, { access_token: { access: [{ type: "incoming-payment", actions: ["create"] }] } });
    if (!isFinalizedGrant(incomingPaymentGrant)) throw new Error("La concesión del pago entrante no se finalizó.");
    const incomingPayment = await client.incomingPayment.create({ url: receivingWalletAddress.resourceServer, accessToken: incomingPaymentGrant.access_token.value }, { walletAddress: receivingWalletAddress.id, incomingAmount: { assetCode: receivingWalletAddress.assetCode, assetScale: receivingWalletAddress.assetScale, value: amount.toString() } });
    const quoteGrant = await client.grant.request({ url: sendingWalletAddress.authServer }, { access_token: { access: [{ type: "quote", actions: ["create"] }] } });
    if (!isFinalizedGrant(quoteGrant)) throw new Error("La concesión de la cotización no se finalizó.");
    const quote = await client.quote.create({ url: sendingWalletAddress.resourceServer, accessToken: quoteGrant.access_token.value }, { walletAddress: sendingWalletAddress.id, receiver: incomingPayment.id, method: "ilp" });

    // Paso 6: Obtener la concesión del pago saliente con redirección
    const outgoingPaymentGrant = await client.grant.request(
      { url: sendingWalletAddress.authServer },
      {
        access_token: {
          access: [
            {
              type: "outgoing-payment",
              actions: ["create"],
              limits: { debitAmount: quote.debitAmount },
              identifier: sendingWalletAddress.id,
            },
          ],
        },
        interact: { start: ["redirect"] },
      }
    );

    // Devolvemos la URL de redirección y TODOS los datos que el cliente necesitará para el paso 2.
    res.status(200).json({
      success: true,
      redirectUrl: outgoingPaymentGrant.interact.redirect,
      continueAccessToken: outgoingPaymentGrant.continue.access_token.value,
      continueUri: outgoingPaymentGrant.continue.uri,
      quoteId: quote.id,
      sendingWalletAddressId: sendingWalletAddress.id,
      sendingWalletResourceServer: sendingWalletAddress.resourceServer,
    });

  } catch (error) {
    console.error('Error al iniciar el pago:', error.message);
    res.status(500).json({ success: false, message: 'Error al iniciar el pago.', error: error.message });
  }
});

// Endpoint de callback para finalizar el pago
app.post('/api/complete-pay', async (req, res) => {
  try {
    // 1. Obtener datos del cuerpo de la solicitud
    const { continueUri, accessToken, quoteId, sendingWalletAddressId, sendingWalletResourceServer } = req.body;
    if (!continueUri || !accessToken || !quoteId || !sendingWalletAddressId || !sendingWalletResourceServer) {
      return res.status(400).json({ success: false, message: 'Faltan parámetros para continuar el pago.' });
    }

    // 2. Finalizar la concesión del pago saliente
    const finalizedOutgoingPaymentGrant = await client.grant.continue({
      url: continueUri,
      accessToken: accessToken,
    });

    if (!isFinalizedGrant(finalizedOutgoingPaymentGrant)) {
      throw new Error("La concesión de pago saliente no se finalizó correctamente.");
    }
    console.log("Concesión de pago saliente finalizada.");

    // 3. Crear el pago saliente
    const outgoingPayment = await client.outgoingPayment.create(
      {
        url: sendingWalletResourceServer,
        accessToken: finalizedOutgoingPaymentGrant.access_token.value,
      },
      {
        walletAddress: sendingWalletAddressId,
        quoteId: quoteId,
      }
    );
    console.log("Pago saliente creado y completado.");

    res.status(200).json({ success: true, message: 'El pago se ha procesado con éxito.', outgoingPayment });
  } catch (error) {
    console.error('Error al finalizar el pago:', error.message);
    res.status(500).json({ success: false, message: 'Error al finalizar el pago.', error: error.message });
  }
});