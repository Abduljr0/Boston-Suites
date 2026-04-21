const express = require('express');
const router = express.Router();
const axios = require('axios');

// M-PESA DARAJA CREDENTIALS (FROM USER)
const consumerKey = 'L2HNFgrGr5YLAx6Q8rjtGPa3SdaAGGJFCgWorRDqEUzxyPMt';
const consumerSecret = '5y5Wg4hcnLgg3ZhsTT7k92JpVfzTHMUlG0Ao6JRKuUJOwWO1lH4ozMR2XKOkoj3x';
const passkey = 'bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919';
const shortCode = '174379'; // Sandbox Store/Paybill Number

/**
 * 1. Generate Token Function
 * We will call this function to generate the M-Pesa token before any Daraja API request.
 * It's structured as a middleware or standalone function we can call.
 */
const getAccessToken = async () => {
    // We are using sandbox for Daraja development environment
    const url = "https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials";
    
    try {
        const encodedCredentials = new Buffer.from(consumerKey + ":" + consumerSecret).toString('base64');
        const headers = {
            'Authorization': "Basic " + encodedCredentials,
            'Content-Type': 'application/json'
        };

        const response = await axios.get(url, { headers });
        return response.data.access_token;
    } catch (error) {
        console.error("Error generating token:", error?.response?.data || error.message);
        throw new Error('Failed to get access token.');
    }
};

/**
 * Endpoint to manually test generating the token 
 * GET /api/v1/mpesa/token
 */
router.get('/token', async (req, res) => {
    try {
        const token = await getAccessToken();
        res.json({ success: true, token });
    } catch (error) {
         res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * 2. STK Push Route
 * POST /api/v1/mpesa/stkpush
 */
router.post('/stkpush', async (req, res) => {
    console.log("STK request received:", req.body);
    // In a real flow, you extract values from the req.body
    let { amount, phone, accountReference, transactionDesc } = req.body;
    
    if (!phone || !amount) {
        return res.status(400).json({ success: false, error: 'Phone number and Amount are required.'});
    }

    // Format phone to start with 254
    let formattedPhone = phone.trim();
    if (formattedPhone.startsWith('0')) {
        formattedPhone = '254' + formattedPhone.slice(1);
    } else if (formattedPhone.startsWith('+')) {
        formattedPhone = formattedPhone.slice(1);
    }

    try {
        // Step 1: Generate Access Token
        const token = await getAccessToken();

        // Step 2: Generate Timestamp
        const date = new Date();
        const timestamp =
            date.getFullYear() +
            ("0" + (date.getMonth() + 1)).slice(-2) +
            ("0" + date.getDate()).slice(-2) +
            ("0" + date.getHours()).slice(-2) +
            ("0" + date.getMinutes()).slice(-2) +
            ("0" + date.getSeconds()).slice(-2);

        // Step 3: Generate STK Password
        const stk_password = new Buffer.from(shortCode + passkey + timestamp).toString("base64");

        const url = "https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest";
        
        const headers = {
            'Authorization': 'Bearer ' + token,
            'Content-Type': 'application/json'
        };

        // Step 4: Construct Body
        const requestBody = {
            "BusinessShortCode": shortCode,
            "Password": stk_password,
            "Timestamp": timestamp,
            "TransactionType": "CustomerPayBillOnline", 
            "Amount": amount,
            "PartyA": formattedPhone,
            "PartyB": shortCode,
            "PhoneNumber": formattedPhone,
            "CallBackURL": "https://yourwebsite.co.ke/callbackurl", // We will deal with this in next sessions
            "AccountReference": accountReference || "Boston Suites",
            "TransactionDesc": transactionDesc || "Booking Payment"
        };
        
        // Step 5: Process Request
        const response = await axios.post(url, requestBody, { headers });

        // ✅ Log confirmation so you can see it in the server terminal
        console.log('✅ STK Push INITIATED successfully!');
        console.log(`   📱 Phone       : ${formattedPhone}`);
        console.log(`   💰 Amount      : KES ${amount}`);
        console.log(`   🔑 CheckoutID  : ${response.data.CheckoutRequestID}`);
        console.log(`   📋 MerchantID  : ${response.data.MerchantRequestID}`);
        console.log(`   💬 Message     : ${response.data.CustomerMessage}`);

        return res.json({ success: true, data: response.data });
        
    } catch (error) {
        const errData = (error.response && error.response.data) || error.message;
        console.error('❌ STK Push FAILED!');
        console.error('   Error:', JSON.stringify(errData));
        res.status(500).json({ success: false, error: errData || 'Failed to initiate STK Push.' });
    }
});

/**
 * 3. STK Push Callback Endpoint
 * POST /api/v1/mpesa/callback
 * This endpoint handles the webhook from Safaricom after the user interacts with the STK prompt.
 */
router.post('/callback', (req, res) => {
    const callbackData = req.body;

    // Log the callback data to the console for debugging
    console.log("M-PESA Callback Data received:", JSON.stringify(callbackData, null, 2));

    // Ensure we have the basic structure expected
    if (!callbackData?.Body?.stkCallback) {
        return res.status(400).json({ status: 'error', message: 'Invalid callback format' });
    }

    // Check the result code
    const result_code = callbackData.Body.stkCallback.ResultCode;
    
    if (result_code !== 0) {
        // If the result code is not 0, there was an error or user cancelled
        const error_message = callbackData.Body.stkCallback.ResultDesc;
        const response_data = { ResultCode: result_code, ResultDesc: error_message };
        console.log("Transaction Failed/Cancelled:", response_data);
        return res.json(response_data);
    }

    // If the result code is 0, the transaction was completed successfully
    const body = callbackData.Body.stkCallback.CallbackMetadata;

    // Helper function to extract a value by name safely
    const getValue = (itemName) => {
        const item = body.Item.find(obj => obj.Name === itemName);
        return item ? item.Value : null;
    };

    // Extract metadata
    const amount = getValue('Amount');
    const mpesaCode = getValue('MpesaReceiptNumber');
    const phone = getValue('PhoneNumber');
    const transactionDate = getValue('TransactionDate');

    console.log(`✅ Payment Successful! Received ${amount} KES from ${phone}. Receipt: ${mpesaCode}`);

    // TODO: Build your business logic here!
    // Example: Save the variables to a file or database, update booking status to PAID, etc.
    // ...

    // Return a success response to M-PESA so they stop sending the webhook
    return res.json({ status: "success" });
});

module.exports = router;
