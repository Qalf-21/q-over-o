import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CreditCard, AlertCircle, CheckCircle2 } from 'lucide-react';
import { AuthButton } from '../../../shared/components/AuthButton';
import { tokensToKes } from '../../wallet/utils/tokenPackages';

interface WithdrawModalProps {
  isOpen: boolean;
  onClose: () => void;
  availableBalance: number;
  onWithdraw: (amount: number, phoneNumber: string) => Promise<void>;
}

export const WithdrawModal: React.FC<WithdrawModalProps> = ({
  isOpen,
  onClose,
  availableBalance,
  onWithdraw
}) => {
  const [amount, setAmount] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [step, setStep] = useState<'form' | 'confirm' | 'success'>('form');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const numericAmount = parseInt(amount) || 0;
  const kesAmount = tokensToKes(numericAmount);
  const hasEnoughBalance = numericAmount <= availableBalance && numericAmount >= 100;
  const isValidIncrement = numericAmount % 10 === 0;

  const handleSubmit = async () => {
    if (!hasEnoughBalance || !isValidIncrement || !phoneNumber.match(/^(?:07|01)\d{8}$|^\+?254(?:7|1)\d{8}$/)) {
      setError('Enter at least 100 tokens in 10-token increments and a valid M-Pesa number');
      return;
    }
    setStep('confirm');
  };

  const handleConfirm = async () => {
    setIsProcessing(true);
    setError(null);
    
    try {
      await onWithdraw(numericAmount, phoneNumber);
      setStep('success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Withdrawal failed');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClose = () => {
    setAmount('');
    setPhoneNumber('');
    setStep('form');
    setError(null);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="app-modal-backdrop"
          onClick={handleClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="app-modal-panel max-w-md"
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-6 text-white">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold">Withdraw to M-Pesa</h2>
                <button onClick={handleClose} className="rounded-xl p-2 transition-colors hover:bg-white/20">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-indigo-100 mt-1 text-sm">Available: {availableBalance.toLocaleString()} tokens</p>
            </div>

            <div className="p-6">
              {error && (
                <div className="app-alert-error mb-4">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {error}
                </div>
              )}

              {step === 'form' && (
                <div className="space-y-5">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Amount (tokens)</label>
                    <input
                      type="number"
                      min="100"
                      step="10"
                      max={availableBalance}
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="Min. 100 tokens"
                      className="app-input py-3 text-lg font-semibold"
                    />
                    <p className="text-sm text-gray-500 mt-1">
                      = KES {kesAmount.toLocaleString()} • Min: 100 tokens (KES 10)
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">M-Pesa Number</label>
                    <input
                      type="tel"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      placeholder="07XX XXX XXX"
                      className="app-input py-3"
                    />
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Amount</span>
                      <span className="font-medium">{numericAmount || 0} tokens</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Equivalent</span>
                      <span className="font-medium">KES {kesAmount.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between pt-2 border-t border-gray-200">
                      <span className="text-gray-600">Balance after</span>
                      <span className="font-medium">{availableBalance - numericAmount} tokens</span>
                    </div>
                  </div>

                  <AuthButton
                    onClick={handleSubmit}
                    disabled={!hasEnoughBalance || !isValidIncrement || !phoneNumber}
                    icon={<CreditCard className="w-5 h-5" />}
                  >
                    Continue
                  </AuthButton>
                </div>
              )}

              {step === 'confirm' && (
                <div className="space-y-5">
                  <div className="text-center py-4">
                    <CreditCard className="w-12 h-12 text-indigo-600 mx-auto mb-3" />
                    <h3 className="font-bold text-gray-900 mb-1">Confirm Withdrawal</h3>
                    <p className="text-gray-600 text-sm">
                      {numericAmount} tokens will be sent to {phoneNumber}
                    </p>
                  </div>

                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                    <p className="text-sm text-amber-800">
                      Tokens will be converted to KES {kesAmount.toLocaleString()} and sent to your M-Pesa. 
                      Processing usually takes 1-5 minutes in sandbox after Daraja accepts the B2C request.
                    </p>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => setStep('form')}
                      className="app-button-secondary flex-1 py-3"
                    >
                      Back
                    </button>
                    <AuthButton
                      onClick={handleConfirm}
                      isLoading={isProcessing}
                      disabled={isProcessing}
                      className="flex-1"
                    >
                      Confirm
                    </AuthButton>
                  </div>
                </div>
              )}

              {step === 'success' && (
                <div className="text-center py-6">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4"
                  >
                    <CheckCircle2 className="w-8 h-8 text-green-600" />
                  </motion.div>
                  <h3 className="font-bold text-gray-900 mb-2">Withdrawal Initiated!</h3>
                  <p className="text-gray-600 text-sm mb-2">
                    {numericAmount} tokens → KES {kesAmount.toLocaleString()}
                  </p>
                  <p className="text-gray-500 text-sm mb-6">
                    Check your M-Pesa ({phoneNumber}) for confirmation
                  </p>
                  <button
                    onClick={handleClose}
                    className="app-button-primary w-full py-3"
                  >
                    Done
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
