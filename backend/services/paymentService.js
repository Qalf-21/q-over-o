const axios = require('axios');
const supabase = require('../config/supabase');
const { AppError } = require('../utils/errorHandler');

class PaymentService {
  constructor() {
    this.baseURL = process.env.MPESA_BASE_URL;
    this.consumerKey = process.env.MPESA_CONSUMER_KEY;
    this.consumerSecret = process.env.MPESA_CONSUMER_SECRET;
    this.passkey = process.env.MPESA_PASSKEY;
    this.shortcode = process.env.MPESA_SHORTCODE;
    this.callbackURL = process.env.MPESA_CALLBACK_URL;
  }

  /**
   * Get M-Pesa access token
   */
  async getAccessToken() {
    const auth = Buffer.from(`${this.consumerKey}:${this.consumerSecret}`).toString('base64');
    
    try {
      const response = await axios.get(
        `${this.baseURL}/oauth/v1/generate?grant_type=client_credentials`,
        {
          headers: { Authorization: `Basic ${auth}` }
        }
      );
      return response.data.access_token;
    } catch (error) {
      throw new AppError('Failed to get M-Pesa access token', 500);
    }
  }

  /**
   * Generate password for STK push
   */
  generatePassword(timestamp) {
    const str = `${this.shortcode}${this.passkey}${timestamp}`;
    return Buffer.from(str).toString('base64');
  }

  /**
   * Initiate M-Pesa STK Push
   */
  async initiateSTKPush(phoneNumber, amount, accountReference) {
    const token = await this.getAccessToken();
    const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, -3);
    const password = this.generatePassword(timestamp);

    // Format phone number (remove leading 0, add 254)
    const formattedPhone = phoneNumber.startsWith('0') 
      ? `254${phoneNumber.slice(1)}` 
      : phoneNumber;

    const payload = {
      BusinessShortCode: this.shortcode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline',
      Amount: amount,
      PartyA: formattedPhone,
      PartyB: this.shortcode,
      PhoneNumber: formattedPhone,
      CallBackURL: this.callbackURL,
      AccountReference: accountReference,
      TransactionDesc: 'Q-over-o Token Purchase'
    };

    try {
      const response = await axios.post(
        `${this.baseURL}/mpesa/stkpush/v1/processrequest`,
        payload,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      return {
        success: true,
        checkoutRequestID: response.data.CheckoutRequestID,
        merchantRequestID: response.data.MerchantRequestID,
        responseDescription: response.data.ResponseDescription
      };
    } catch (error) {
      console.error('M-Pesa STK Push Error:', error.response?.data || error.message);
      throw new AppError('Failed to initiate M-Pesa payment', 500);
    }
  }

  /**
   * Create payment intent record
   */
  async createPaymentIntent(userId, amountKes, tokensExpected) {
    const { data, error } = await supabase
      .from('payment_intents')
      .insert({
        user_id: userId,
        amount_kes: amountKes,
        tokens_expected: tokensExpected,
        status: 'pending'
      })
      .select()
      .single();

    if (error) throw new AppError('Failed to create payment intent', 500);
    return data;
  }

  /**
   * Complete payment and credit wallet
   */
  async completePayment(mpesaReference, paymentIntentId) {
    // Update payment intent
    const { data: paymentIntent, error: piError } = await supabase
      .from('payment_intents')
      .update({ 
        status: 'completed',
        mpesa_reference: mpesaReference,
        completed_at: new Date().toISOString()
      })
      .eq('id', paymentIntentId)
      .select()
      .single();

    if (piError) throw new AppError('Failed to update payment intent', 500);

    // Get wallet
    const { data: wallet, error: walletError } = await supabase
      .from('wallets')
      .select('*')
      .eq('user_id', paymentIntent.user_id)
      .single();

    if (walletError) throw new AppError('Wallet not found', 404);

    const newBalance = wallet.balance_tokens + paymentIntent.tokens_expected;

    // Update wallet
    const { error: updateError } = await supabase
      .from('wallets')
      .update({ balance_tokens: newBalance })
      .eq('user_id', paymentIntent.user_id);

    if (updateError) throw new AppError('Failed to credit wallet', 500);

    // Log transaction
    await supabase.from('transactions').insert({
      user_id: paymentIntent.user_id,
      type: 'purchase',
      amount_tokens: paymentIntent.tokens_expected,
      balance_before: wallet.balance_tokens,
      balance_after: newBalance,
      status: 'completed',
      reference: mpesaReference,
      metadata: { payment_intent_id: paymentIntentId }
    });

    return { 
      success: true, 
      tokensAdded: paymentIntent.tokens_expected,
      newBalance 
    };
  }

  /**
   * Handle M-Pesa callback
   */
  async handleCallback(callbackData) {
    const { Body } = callbackData;
    
    if (Body.stkCallback.ResultCode !== 0) {
      // Payment failed
      const checkoutRequestID = Body.stkCallback.CheckoutRequestID;
      await supabase
        .from('payment_intents')
        .update({ status: 'failed' })
        .eq('mpesa_reference', checkoutRequestID);
      
      return { success: false, message: Body.stkCallback.ResultDesc };
    }

    // Payment successful
    const mpesaReference = Body.stkCallback.CallbackMetadata.Item.find(
      item => item.Name === 'MpesaReceiptNumber'
    )?.Value;

    const checkoutRequestID = Body.stkCallback.CheckoutRequestID;

    // Find payment intent by checkout request ID
    const { data: paymentIntent } = await supabase
      .from('payment_intents')
      .select('*')
      .eq('mpesa_reference', checkoutRequestID)
      .single();

    if (!paymentIntent) {
      return { success: false, message: 'Payment intent not found' };
    }

    return await this.completePayment(mpesaReference, paymentIntent.id);
  }
}

module.exports = new PaymentService();