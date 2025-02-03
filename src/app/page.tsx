"use client"

import { Cluster, clusterApiUrl, Connection, PublicKey, Keypair } from "@solana/web3.js";
import { encodeURL, createQR, findReference, FindReferenceError, validateTransfer } from "@solana/pay";
import BigNumber from "bignumber.js";
import { useState } from "react";
import QRCode from "react-qr-code";

export default function Home() {
  const RPC = process.env.NEXT_PUBLIC_SOLANA_RPC_ENDPOINT!
  const connection = new Connection(RPC, 'confirmed');

  // URL Variables
  const [address, setAddress] = useState("");
  const [amount, setAmount] = useState(new BigNumber(1));
  const [message, setMessage] = useState("$LOCKIN Payment Request");
  const reference = new Keypair().publicKey;
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
      console.log("Creating a payment URL \n");
      const recipientAddress = new PublicKey(address);
      const url = encodeURL({
        recipient: recipientAddress,
        amount,
        splToken,
        reference,
        label,
        message,
        memo,
      });

      setQrCodeValue(url.toString());
      checkPayment(recipientAddress);
    } catch (error) {
      alert("Invalid recipient address");
      console.error(error);
    }
  }

  async function checkPayment(recipientAddress: PublicKey) {
    setPaymentStatus('pending');
    console.log('Searching for the payment\n');
    let signatureInfo;
    const { signature }: { signature: any } = await new Promise((resolve, reject) => {
      const interval = setInterval(async () => {
        console.count('Checking for transaction...' + reference);
        try {
          signatureInfo = await findReference(connection, reference, { finality: 'confirmed' });
          console.log('\n Signature: ', signatureInfo.signature, signatureInfo);
          clearInterval(interval);
          resolve(signatureInfo);
        } catch (error: any) {
          if (!(error instanceof FindReferenceError)) {
            console.error(error);
            clearInterval(interval);
            reject(error);
          }
        }
      }, 250);
    });

    setPaymentStatus('confirmed');
    console.log('Validating the payment\n');
    try {
      await validateTransfer(
        connection, 
        signature, 
        { 
          recipient: recipientAddress, 
          amount,
          splToken,
        }
      );
      setPaymentStatus('validated');
      console.log('Payment validated');
      return true;
    } catch (error) {
      console.error('Payment failed', error);
      return false;
    }
  }

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
            paymentStatus === 'validated' ? 'bg-green-900/30 text-green-100 border-green-500/30' : ''
          }`}>
            Status: {paymentStatus.charAt(0).toUpperCase() + paymentStatus.slice(1)}
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
                      value={qrCodeValue}
                      viewBox={`0 0 256 256`}
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
