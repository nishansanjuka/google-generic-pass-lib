# wallet-pass

A library for managing wallet passes.

## Installation

```bash
npm install wallet-pass
```

## Usage

```javascript
const walletPass = require('wallet-pass');
// Your usage examples here
```

# Wallet Pass

A TypeScript library for generating Google Wallet passes.

## Installation

```bash
npm install wallet-pass
```

## Usage

```typescript
import { GoogleGenericPass } from 'wallet-pass';

// Initialize the pass
const pass = new GoogleGenericPass('issuer_id', 'pass_id', 'class_id');

// Configure service account
pass.setServiceAccountCredentials('service-account@example.com', 'path/to/key.json');

// Set up the pass
pass
  .setPassClass('Issuer Name')
  .setCardTitle('My Pass')
  .setHeaderInfo('Pass Header', 'Subheader info')
  .setBarcode('https://example.com/1234', 'QR_CODE', 'Scan this code')
  .addTextModule('info', 'Additional information about the pass.');

// Generate JWT or link
const jwt = pass.generateJwt(['https://your-website.com']);
const walletLink = pass.generateAddToWalletLink(['https://your-website.com']);
```

## API Documentation

### GoogleGenericPass

Main class for creating Google Wallet passes.

#### Constructor

```typescript
new GoogleGenericPass(issuerId: string, passId: string, classId: string)
```

### Example usage

```typescript
import { GoogleGenericPass } from './lib/google-generic-pass';
import path from 'path';
import fs from 'fs';

try {
  // Create a new generic pass with issuer ID, pass ID and class ID
  const issuerId = '3388000000022926467';
  const passId = 'pass-' + Date.now(); // Unique identifier for each pass
  const classId = 'generic-class-1';

  const pass = new GoogleGenericPass(issuerId, passId, classId);

  // Set service account credentials (required for JWT signing)
  const keyFilePath = path.join(__dirname, '../keys/service-account.json');
  if (!fs.existsSync(keyFilePath)) {
    throw new Error(`Service account key file not found at ${keyFilePath}`);
  }

  console.log(`Using service account key from: ${keyFilePath}`);
  pass.setServiceAccountCredentials(
    'nipunanishanprimary@secret-aria-409310.iam.gserviceaccount.com',
    keyFilePath,
  );

  // ===== SIMPLIFIED IMPLEMENTATION - MINIMAL FIELDS FOR DEBUGGING =====

  // 1. First set up the pass class
  pass.setPassClass('Your Company Name');
  pass.setClassTemplateInfo([
    pass.createTwoItemsRow(
      "object.textModulesData['points']",
      "object.textModulesData['contacts']",
    ),
  ]);

  // 2. Then set up the minimal pass object fields required
  pass.setBasicInfo('GENERIC_TYPE_UNSPECIFIED', '#2F2F31');

  // Set exactly the required fields to match Google's example
  pass.setCardTitle('DMI Cards');
  pass.setHeaderInfo('Nipuna Nishan', 'Software Engineer');

  // Add exact text modules matching Google's example
  pass.addTextModule('Web', 'https://example.com', 'WEB');

  // Add barcode with empty alternateText as shown in Google's example
  pass.setBarcode('BARCODE_VALUE', 'QR_CODE', '');

  // Add logo and hero image
  pass.setLogo('https://dmi.cards.xleron.io/logo/logo.webp', 'LOGO_IMAGE_DESCRIPTION');
  pass.setHeroImage(
    'https://s3.eu-north-1.amazonaws.com/app.toolgenie.io-dev/3a1016a2-fd91-4594-ae2f-86ce563d33bc',
    'HERO_IMAGE_DESCRIPTION',
  );

  // // Add Links Module Data
  pass.addLinks([
    {
      id: 'website',
      uri: 'https://example.com',
      description: 'Visit our website',
    },
    {
      id: 'support',
      uri: 'https://example.com/support',
      description: 'Contact support',
    },
    {
      id: 'terms',
      uri: 'https://example.com/terms',
      description: 'Terms and conditions',
    },
  ]);

  const passObj = pass.getPassObject();
  if (passObj.additionalInfo && passObj.additionalInfo.length > 0) {
    passObj.additionalInfo = [];
  }

  // Debug output - log the full payload to see what's being sent
  console.log('\n----- DEBUG: PAYLOAD STRUCTURE -----');
  pass.debugPayload();

  // Generate link with allowed origins
  const allowedOrigins = ['https://example.com']; // Add valid origins here
  const addToWalletLink = pass.generateAddToWalletLink(allowedOrigins);

  console.log('\nAdd to Google Wallet link:');
  console.log(addToWalletLink);
} catch (error) {
  console.error('Error creating pass:', error);
}
```
