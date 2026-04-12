import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import {
  Upload,
  Download,
  CheckCircle,
  AlertTriangle,
  FileSpreadsheet,
} from 'lucide-react';
import toast from 'react-hot-toast';
import QRCodeLogin from '../components/QRCodeLogin';
import ContactTable from '../components/ContactTable';
import MessageComposer from '../components/MessageComposer';
import { useCampaign } from '../hooks/useCampaign';
import { useAuth } from '../context/AuthContext';

export default function NewCampaign({ waStatus, waInfo, waMessage, qrCode }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { uploadContacts, uploadMedia, createCampaign, startCampaign } =
    useCampaign();

  const [step, setStep] = useState(1); // 1=upload, 2=compose, 3=review
  const [campaignName, setCampaignName] = useState('');
  const [contacts, setContacts] = useState([]);
  const [parseResult, setParseResult] = useState(null);
  const [sourceFile, setSourceFile] = useState(null);
  const [message, setMessage] = useState('');
  const [mediaFile, setMediaFile] = useState(null);
  const [creating, setCreating] = useState(false);

  const validContacts = contacts.filter(
    (c) => c.status === 'pending'
  );
  const invalidContacts = contacts.filter(
    (c) => c.status === 'invalid' || c.status === 'skipped'
  );

  const onDrop = async (acceptedFiles) => {
    if (acceptedFiles.length === 0) return;
    try {
      const result = await uploadContacts(acceptedFiles[0]);
      setContacts(result.contacts);
      setParseResult(result);
      setSourceFile(result.sourceFile || null);
      toast.success(
        `Loaded ${result.validCount} valid contacts (${result.invalidCount} invalid, ${result.duplicateCount} duplicates)`
      );
    } catch (err) {
      toast.error('Failed to parse file: ' + err.message);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
    },
    maxFiles: 1,
  });

  const removeContact = (index) => {
    setContacts((prev) => prev.filter((_, i) => i !== index));
  };

  const handleCreate = async () => {
    if (!campaignName.trim()) {
      toast.error('Please enter a campaign name');
      return;
    }
    if (!message.trim()) {
      toast.error('Please enter a message');
      return;
    }
    if (validContacts.length === 0) {
      toast.error('No valid contacts to send to');
      return;
    }

    setCreating(true);
    try {
      const campaign = await createCampaign({
        name: campaignName,
        message,
        media_path: mediaFile?.path || null,
        source_file_path: sourceFile?.path || null,
        source_file_name: sourceFile?.originalName || sourceFile?.filename || null,
        contacts: validContacts,
      });
      toast.success('Campaign created!');
      navigate(`/campaign/${campaign.id}`);
    } catch (err) {
      toast.error('Failed to create campaign: ' + err.message);
    } finally {
      setCreating(false);
    }
  };

  const downloadSampleCSV = () => {
    const csv = `phone_number,name,custom_field_1,custom_field_2
923001234567,Ahmed Khan,Gold Member,Lahore
923009876543,Sara Ali,Silver Member,Karachi
923451234567,Usman Shah,Bronze Member,Islamabad`;
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sample_contacts.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  // Show QR if not connected
  if (waStatus !== 'connected') {
    return (
      <div className="max-w-lg mx-auto">
        <h1 className="text-2xl font-bold mb-6">Connect WhatsApp First</h1>
        <QRCodeLogin qrCode={qrCode} status={waStatus} info={waInfo} message={waMessage} />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">New Campaign</h1>

      {/* Step Indicator */}
      <div className="flex items-center gap-2">
        {[
          { n: 1, label: 'Upload Contacts' },
          { n: 2, label: 'Compose Message' },
          { n: 3, label: 'Review & Send' },
        ].map(({ n, label }) => (
          <button
            key={n}
            onClick={() => {
              if (n === 1 || (n === 2 && contacts.length > 0) || (n === 3 && message)) {
                setStep(n);
              }
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              step === n
                ? 'bg-whatsapp text-white'
                : step > n
                ? 'bg-green-100 text-green-700'
                : 'bg-gray-100 text-gray-500'
            }`}
          >
            <span className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-xs font-bold">
              {step > n ? <CheckCircle size={14} /> : n}
            </span>
            {label}
          </button>
        ))}
      </div>

      {/* Step 1: Upload */}
      {step === 1 && (
        <div className="card space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">Upload Contact List</h2>
            <button
              onClick={downloadSampleCSV}
              className="btn-secondary flex items-center gap-2 text-sm"
            >
              <Download size={16} /> Download Sample CSV
            </button>
          </div>

          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${
              isDragActive
                ? 'border-whatsapp bg-green-50 dark:bg-green-900/10'
                : 'border-gray-300 dark:border-gray-600 hover:border-whatsapp'
            }`}
          >
            <input {...getInputProps()} />
            <Upload
              className="mx-auto text-gray-400 mb-3"
              size={40}
            />
            <p className="text-gray-600 dark:text-gray-400">
              {isDragActive
                ? 'Drop your file here...'
                : 'Drag & drop a CSV or Excel file, or click to browse'}
            </p>
            <p className="text-xs text-gray-400 mt-2">
              Supported: .csv, .xlsx, .xls (max 10MB)
            </p>
          </div>

          {contacts.length > 0 && (
            <>
              <div className="flex gap-4 text-sm">
                <span className="flex items-center gap-1">
                  <CheckCircle size={14} className="text-green-500" />
                  {validContacts.length} valid
                </span>
                <span className="flex items-center gap-1">
                  <AlertTriangle size={14} className="text-yellow-500" />
                  {invalidContacts.length} invalid/skipped
                </span>
                <span className="flex items-center gap-1">
                  <FileSpreadsheet size={14} className="text-gray-400" />
                  {contacts.length} total
                </span>
              </div>
              <ContactTable
                contacts={contacts}
                onRemove={removeContact}
              />
              <button
                onClick={() => setStep(2)}
                disabled={validContacts.length === 0}
                className="btn-primary disabled:opacity-50"
              >
                Continue to Compose Message
              </button>
            </>
          )}
        </div>
      )}

      {/* Step 2: Compose */}
      {step === 2 && (
        <div className="card space-y-4">
          <h2 className="text-lg font-bold">Compose Message</h2>
          <MessageComposer
            message={message}
            setMessage={setMessage}
            mediaFile={mediaFile}
            setMediaFile={setMediaFile}
            contacts={validContacts}
            onMediaUpload={uploadMedia}
          />
          <div className="flex gap-3">
            <button onClick={() => setStep(1)} className="btn-secondary">
              Back
            </button>
            <button
              onClick={() => {
                if (!message.trim()) {
                  toast.error('Please enter a message');
                  return;
                }
                setStep(3);
              }}
              className="btn-primary"
            >
              Continue to Review
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Review */}
      {step === 3 && (
        <div className="card space-y-4">
          <h2 className="text-lg font-bold">Review & Launch</h2>

          <div>
            <label className="block text-sm font-medium mb-1">
              Campaign Name *
            </label>
            <input
              type="text"
              value={campaignName}
              onChange={(e) => setCampaignName(e.target.value)}
              placeholder="e.g., March Promo Blast"
              className="input-field"
            />
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
              <p className="text-gray-500 mb-1">Contacts</p>
              <p className="text-xl font-bold">{validContacts.length}</p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
              <p className="text-gray-500 mb-1">Message Length</p>
              <p className="text-xl font-bold">{message.length} chars</p>
            </div>
          </div>

          <div className="bg-whatsapp-light dark:bg-gray-700 rounded-lg p-4">
            <p className="text-sm font-medium mb-1">Message Preview:</p>
            <p className="text-sm whitespace-pre-wrap">{message}</p>
          </div>

          {mediaFile && (
            <p className="text-sm text-gray-500">
              Attachment: {mediaFile.name}
            </p>
          )}

          <div className={`rounded-lg p-3 text-sm border ${
            (user?.credits || 0) >= validContacts.length
              ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-700 dark:text-green-300'
              : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300'
          }`}>
            <strong>Credits required:</strong> {validContacts.length} (1 credit per message)
            {' | '}
            <strong>Your balance:</strong> {user?.credits || 0} credits
            {(user?.credits || 0) < validContacts.length && (
              <span className="block mt-1">
                <AlertTriangle size={14} className="inline mr-1" />
                Insufficient credits. Please <a href="/credits" className="underline font-bold">buy more credits</a> first.
              </span>
            )}
          </div>

          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3 text-sm text-yellow-700 dark:text-yellow-300">
            <AlertTriangle size={14} className="inline mr-1" />
            Messages will be sent with randomized delays to protect your account.
          </div>

          <div className="flex gap-3">
            <button onClick={() => setStep(2)} className="btn-secondary">
              Back
            </button>
            <button
              onClick={handleCreate}
              disabled={creating}
              className="btn-primary disabled:opacity-50"
            >
              {creating ? 'Creating...' : 'Create Campaign'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
