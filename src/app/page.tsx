"use client"

import { Connection, PublicKey, Keypair } from "@solana/web3.js";
import { encodeURL, findReference, FindReferenceError, validateTransfer } from "@solana/pay";
import BigNumber from "bignumber.js";
import { useState, useEffect } from "react";
import dynamic from 'next/dynamic';

// Import QR code with no SSR
const QRCode = dynamic(() => import('react-qr-code'), { 
  ssr: false,
  loading: () => <div className="w-[256px] h-[256px] bg-gray-200 animate-pulse rounded-xl"></div>
});

const MAX_RETRIES = 5;
const INITIAL_BACKOFF_MS = 250;
const MAX_BACKOFF_MS = 2000;

// Add this type near the top of the file, after imports
type SignatureInfo = {
  signature: string;
};

const getConnection = () => {
  const RPC = process.env.NEXT_PUBLIC_SOLANA_RPC_ENDPOINT!;
  return new Connection(RPC, {
    commitment: 'confirmed',
    confirmTransactionInitialTimeout: 60000, // 60 seconds
    disableRetryOnRateLimit: false,
  });
}

const connection = getConnection();

export default function Home() {
  // URL Variables
  const [address, setAddress] = useState("");
  const [amount, setAmount] = useState(new BigNumber(1));
  const [message, setMessage] = useState("$LOCKIN Payment Request");
  const [reference, setReference] = useState<PublicKey | null>(null);
  const label = "$LOCKIN Payment";
  const memo = "$LOCKIN Transfer";
  
  // Define the token mint address
  const splToken = new PublicKey("8Ki8DpuWNxu9VsS3kQbarsCWMcFGWkzzA8pUPto9zBd5");

  // for the QR code
  const [qrCodeValue, setQrCodeValue] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('');

  async function createPayment() {
    if (!address) {
      alert("Please enter a recipient address");
      return;
    }

    try {
      setPaymentStatus('generating'); // Add a new status for QR generation
      console.log("Creating a payment URL");
      
      const newReference = new Keypair().publicKey;
      setReference(newReference);
      const recipientAddress = new PublicKey(address);
      
      const url = encodeURL({
        recipient: recipientAddress,
        amount,
        splToken,
        reference: newReference,
        label,
        message,
        memo,
      });

      const urlString = url.toString();
      console.log("Payment URL generated:", urlString);
      setQrCodeValue(urlString);

      // Start monitoring for payment
      checkPayment(recipientAddress, newReference).catch((error) => {
        console.error('Payment monitoring failed:', error);
        setPaymentStatus('failed');
        alert('Payment monitoring failed. Please try again.');
      });

    } catch (error) {
      console.error('Error creating payment:', error);
      setPaymentStatus('failed');
      alert("Failed to create payment request. Please check the recipient address and try again.");
    }
  }

  async function checkPayment(recipientAddress: PublicKey, paymentReference: PublicKey) {
    setPaymentStatus('pending');
    console.log('Starting payment check...');
    
    try {
      // Wait for the transaction using findReference
      const signatureInfo = await new Promise<SignatureInfo>((resolve, reject) => {
        let retryCount = 0;
        const checkTransaction = async () => {
          console.log(`Checking for transaction... (Attempt ${retryCount + 1})`);
          
          try {
            const signature = await findReference(connection, paymentReference, {
              finality: 'confirmed',
            });
            console.log('Transaction found! Signature:', signature.signature);
            resolve(signature);
          } catch (error) {
            if (error instanceof FindReferenceError) {
              // Transaction not found yet, continue checking
              retryCount++;
              if (retryCount < MAX_RETRIES) {
                const delay = Math.min(INITIAL_BACKOFF_MS * Math.pow(1.5, retryCount), MAX_BACKOFF_MS);
                console.log(`Transaction not found yet. Retrying in ${delay}ms...`);
                setTimeout(checkTransaction, delay);
              } else {
                reject(new Error('Payment timeout: Transaction not found'));
              }
            } else {
              // Unexpected error
              console.error('Unexpected error while checking for transaction:', error);
              reject(error);
            }
          }
        };

        // Start checking
        checkTransaction();
      });

      // Transaction found - update status and validate
      setPaymentStatus('confirmed');
      console.log('Transaction confirmed, validating payment...');

      // Validate the transaction
      try {
        await validateTransfer(
          connection,
          signatureInfo.signature,
          {
            recipient: recipientAddress,
            amount,
            splToken,
            reference: paymentReference,
          },
        );

        console.log('Payment validated successfully!');
        setPaymentStatus('validated');
        return true;
      } catch (error) {
        console.error('Payment validation failed:', error);
        setPaymentStatus('failed');
        throw new Error('Payment validation failed');
      }

    } catch (error) {
      console.error('Payment processing error:', error);
      setPaymentStatus('failed');
      throw error;
    }
  }

  const getStatusMessage = (status: string) => {
    switch (status) {
      case 'generating':
        return 'Generating payment request...';
      case 'pending':
        return 'Waiting for payment...';
      case 'confirmed':
        return 'Payment confirmed, validating...';
      case 'validated':
        return 'Payment successfully validated!';
      case 'failed':
        return 'Payment failed. Please try again.';
      default:
        return '';
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-[#5977c5] to-[#2a3b66]">
      <h1 className="mb-6 text-4xl font-bold text-white">
        $LOCKIN Payment Request
      </h1>
      <div className="w-full max-w-md p-6 mx-auto bg-white/10 backdrop-blur-md rounded-xl shadow-xl border border-[#5977c5]/20">
        <div className="mb-6 p-4 bg-[#5977c5]/20 rounded-lg border border-[#5977c5]/30">
          <h2 className="text-lg font-semibold text-white mb-2">$LOCKIN Payment Details</h2>
          <p className="text-sm text-blue-100">
            Create a payment request for $LOCKIN tokens using Solana Pay.
            <br />
            Token Address: {splToken.toString().slice(0, 4)}...{splToken.toString().slice(-4)}
          </p>
        </div>

        <div className="mb-4">
          <label className="block mb-2 text-sm font-medium text-white">
            Recipient Address:
            <span className="ml-1 text-xs text-blue-100">
              (Where the $LOCKIN will be sent)
            </span>
          </label>
          <input
            type="text"
            placeholder="Enter Solana wallet address"
            onChange={(e) => setAddress(e.target.value)}
            className="w-full px-3 py-2 text-sm leading-tight text-white bg-[#5977c5]/20 border border-[#5977c5]/30 rounded shadow appearance-none focus:outline-none focus:border-[#5977c5] focus:ring-1 focus:ring-[#5977c5]"
          />
          <p className="mt-1 text-xs text-blue-100">
            Enter the Solana wallet address that should receive the $LOCKIN tokens
          </p>
        </div>

        <div className="mb-4">
          <label className="block mb-2 text-sm font-medium text-white">
            $LOCKIN Amount:
            <span className="ml-1 text-xs text-blue-100">
              (Number of $LOCKIN tokens to request)
            </span>
          </label>
          <input
            type="number"
            placeholder="Enter amount"
            min="0"
            step="any"
            onChange={(e) => setAmount(new BigNumber(e.target.value))}
            className="w-full px-3 py-2 text-sm leading-tight text-white bg-[#5977c5]/20 border border-[#5977c5]/30 rounded shadow appearance-none focus:outline-none focus:border-[#5977c5] focus:ring-1 focus:ring-[#5977c5]"
          />
          <p className="mt-1 text-xs text-blue-100">
            Specify how many $LOCKIN tokens you want to request
          </p>
        </div>

        <div className="flex justify-center items-center">
          <button
            className="px-6 py-3 font-bold text-white bg-[#5977c5] rounded-lg hover:bg-[#4a62a3] transition-colors shadow-lg hover:shadow-[#5977c5]/20"
            onClick={createPayment}
          >
            Generate $LOCKIN Payment QR
          </button>
        </div>

        {paymentStatus && (
          <div className={`mt-4 p-3 text-center rounded-lg border ${
            paymentStatus === 'pending' ? 'bg-yellow-900/30 text-yellow-100 border-yellow-500/30' :
            paymentStatus === 'confirmed' ? 'bg-[#5977c5]/30 text-blue-100 border-[#5977c5]/30' :
            paymentStatus === 'validated' ? 'bg-green-900/30 text-green-100 border-green-500/30' :
            paymentStatus === 'failed' ? 'bg-red-900/30 text-red-100 border-red-500/30' :
            'bg-gray-900/30 text-gray-100 border-gray-500/30'
          }`}>
            {getStatusMessage(paymentStatus)}
          </div>
        )}

        <div>
          {paymentStatus === 'validated' ? (
            <div className="mt-4 p-4 bg-green-900/30 rounded-lg border border-green-500/30">
              <p className="text-green-100 text-center font-medium">$LOCKIN Payment Successfully Validated!</p>
            </div>
          ) : (
            <div className="flex flex-col items-center mt-4">
              {qrCodeValue && (
                <>
                  <p className="mb-2 text-sm text-blue-100">Scan this QR code to send $LOCKIN</p>
                  <div className="p-4 bg-white rounded-xl">
                    <QRCode
                      size={256}
                      style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                      value={qrCodeValue || ""}
                      viewBox={`0 0 256 256`}
                      level="L"
                      fgColor="#000000"
                      bgColor="#FFFFFF"
                    />
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
