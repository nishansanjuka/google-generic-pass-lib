import { GoogleGenericPass } from '../google-generic-pass';
import * as jwt from 'jsonwebtoken';
import fs from 'fs';

// Mock dependencies
jest.mock('jsonwebtoken');
jest.mock('fs');

describe('GoogleGenericPass', () => {
  // Setup common variables
  const issuerId = 'test-issuer';
  const passId = 'test-pass';
  const classId = 'test-class';
  const serviceAccountEmail = 'test@example.com';
  const privateKey = '-----BEGIN PRIVATE KEY-----\nMockPrivateKey\n-----END PRIVATE KEY-----';
  const mockServiceAccountJson = JSON.stringify({ private_key: privateKey });

  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();

    // Setup common mock implementations
    (jwt.sign as jest.Mock).mockReturnValue('mock-jwt-token');
    (fs.existsSync as jest.Mock).mockImplementation(() => true);
    (fs.readFileSync as jest.Mock).mockImplementation(() => mockServiceAccountJson);
  });

  describe('Constructor and initialization', () => {
    test('should correctly initialize pass object with default values', () => {
      const pass = new GoogleGenericPass(issuerId, passId, classId);
      const passObj = pass.getPassObject();

      expect(passObj.id).toBe(`${issuerId}.${passId}`);
      expect(passObj.classId).toBe(`${issuerId}.${classId}`);
      expect(passObj.genericType).toBe('GENERIC_TYPE_UNSPECIFIED');
      expect(passObj.additionalInfo).toHaveLength(1);
      expect(passObj.additionalInfo?.[0].id).toBe('default_info');
    });
  });

  describe('Service account credentials', () => {
    test('should set service account credentials from JSON string', () => {
      const pass = new GoogleGenericPass(issuerId, passId, classId);
      pass.setServiceAccountCredentials(serviceAccountEmail, mockServiceAccountJson);

      expect(fs.readFileSync).not.toHaveBeenCalled();
      expect(() => pass.generateJwt()).not.toThrow();
    });

    test('should set service account credentials from file path', () => {
      const pass = new GoogleGenericPass(issuerId, passId, classId);

      // Force JSON parsing to fail to trigger file path logic
      jest.spyOn(JSON, 'parse').mockImplementationOnce(() => { throw new Error('Invalid JSON'); });

      pass.setServiceAccountCredentials(serviceAccountEmail, 'path/to/credentials.json');

      expect(fs.existsSync).toHaveBeenCalledWith('path/to/credentials.json');
      expect(fs.readFileSync).toHaveBeenCalledWith('path/to/credentials.json', 'utf8');
      expect(() => pass.generateJwt()).not.toThrow();
    });

    test('should throw error when file path does not exist', () => {
      const pass = new GoogleGenericPass(issuerId, passId, classId);

      // Force JSON parsing to fail to trigger file path logic
      jest.spyOn(JSON, 'parse').mockImplementationOnce(() => { throw new Error('Invalid JSON'); });
      (fs.existsSync as jest.Mock).mockReturnValueOnce(false);

      expect(() => {
        pass.setServiceAccountCredentials(serviceAccountEmail, 'nonexistent/path.json');
      }).toThrow();
    });

    test('should throw error when private key is missing', () => {
      const pass = new GoogleGenericPass(issuerId, passId, classId);

      jest.spyOn(JSON, 'parse').mockReturnValueOnce({ /* No private_key */ });

      expect(() => {
        pass.setServiceAccountCredentials(serviceAccountEmail, '{}');
      }).toThrow('Private key not found');
    });

    test('should set service account credentials directly from key data', () => {
      const pass = new GoogleGenericPass(issuerId, passId, classId);
      pass.setServiceAccountCredentialsFromKeyData(serviceAccountEmail, privateKey);

      expect(() => pass.generateJwt()).not.toThrow();
    });
  });

  describe('Pass class methods', () => {
    test('should create basic pass class', () => {
      const pass = new GoogleGenericPass(issuerId, passId, classId);
      const issuerName = 'Test Issuer';
      pass.setPassClass(issuerName);

      const passClass = pass.getPassClass();
      expect(passClass).toBeDefined();
      expect(passClass?.id).toBe(`${issuerId}.${classId}`);
      expect(passClass?.issuerName).toBe(issuerName);
    });

    test('should create detailed pass class', () => {
      const pass = new GoogleGenericPass(issuerId, passId, classId);
      pass.setPassClassWithDetails(
        'Test Issuer',
        'UNDER_REVIEW',
        'https://example.com/logo.png',
        'Logo Description',
        'https://example.com/hero.png',
        'Hero Description',
        '#000000'
      );

      const passClass = pass.getPassClass();
      expect(passClass).toBeDefined();
      expect(passClass?.reviewStatus).toBe('UNDER_REVIEW');
      expect(passClass?.logoImage).toBeDefined();
      expect(passClass?.heroImage).toBeDefined();
      expect(passClass?.hexBackgroundColor).toBe('#000000');
    });

    test('should add class template info', () => {
      const pass = new GoogleGenericPass(issuerId, passId, classId);
      pass.setPassClass('Test Issuer');

      const template = pass.createTwoItemsRow('object.header', 'object.barcode');
      pass.setClassTemplateInfo([template]);

      const passClass = pass.getPassClass();
      expect(passClass?.classTemplateInfo).toBeDefined();
      expect(passClass?.classTemplateInfo?.cardTemplateOverride?.cardRowTemplateInfos).toHaveLength(1);
    });

    test('should throw error when adding template info without defining class first', () => {
      const pass = new GoogleGenericPass(issuerId, passId, classId);
      const template = pass.createTwoItemsRow('object.header', 'object.barcode');

      expect(() => pass.setClassTemplateInfo([template])).toThrow('Pass class must be created');
    });
  });

  describe('Pass content methods', () => {
    let pass: GoogleGenericPass;

    beforeEach(() => {
      pass = new GoogleGenericPass(issuerId, passId, classId);
    });

    test('should set basic info', () => {
      pass.setBasicInfo('LOYALTY_CARD', '#FFFFFF');
      const passObj = pass.getPassObject();

      expect(passObj.genericType).toBe('LOYALTY_CARD');
      expect(passObj.hexBackgroundColor).toBe('#FFFFFF');
    });

    test('should set card title', () => {
      pass.setCardTitle('My Card');
      const passObj = pass.getPassObject();

      expect(passObj.cardTitle).toBeDefined();
      expect(passObj.cardTitle?.defaultValue.value).toBe('My Card');
    });

    test('should set header info', () => {
      pass.setHeaderInfo('Main Header', 'Sub Header');
      const passObj = pass.getPassObject();

      expect(passObj.header).toBeDefined();
      expect(passObj.header?.defaultValue.value).toBe('Main Header');
      expect(passObj.subheader?.defaultValue.value).toBe('Sub Header');
    });

    test('should add text module', () => {
      pass.addTextModule('info1', 'This is some info', 'Info Section');
      const passObj = pass.getPassObject();

      expect(passObj.textModulesData).toHaveLength(1);
      expect(passObj.textModulesData?.[0].id).toBe('info1');
      expect(passObj.textModulesData?.[0].body).toBe('This is some info');
      expect(passObj.textModulesData?.[0].header).toBe('Info Section');
    });

    test('should set logo', () => {
      pass.setLogo('https://example.com/logo.png', 'Company Logo');
      const passObj = pass.getPassObject();

      expect(passObj.logo).toBeDefined();
      expect(passObj.logo?.sourceUri.uri).toBe('https://example.com/logo.png');
      expect(passObj.logo?.contentDescription?.defaultValue.value).toBe('Company Logo');
    });

    test('should set hero image', () => {
      pass.setHeroImage('https://example.com/hero.png', 'Hero Image');
      const passObj = pass.getPassObject();

      expect(passObj.heroImage).toBeDefined();
      expect(passObj.heroImage?.sourceUri.uri).toBe('https://example.com/hero.png');
    });

    test('should add image module', () => {
      pass.addImageModule('image1', 'https://example.com/image.png', 'Product Image');
      const passObj = pass.getPassObject();

      expect(passObj.imageModulesData).toHaveLength(1);
      expect(passObj.imageModulesData?.[0].id).toBe('image1');
      expect(passObj.imageModulesData?.[0].mainImage.sourceUri.uri).toBe('https://example.com/image.png');
    });

    test('should set barcode', () => {
      pass.setBarcode('123456789', 'QR_CODE', 'Scan this code');
      const passObj = pass.getPassObject();

      expect(passObj.barcode).toBeDefined();
      expect(passObj.barcode?.type).toBe('QR_CODE');
      expect(passObj.barcode?.value).toBe('123456789');
      expect(passObj.barcode?.alternateText).toBe('Scan this code');
    });

    test('should add additional info', () => {
      pass.addAdditionalInfo('info1', 'Points', '100');
      const passObj = pass.getPassObject();

      // Should have 2 items - default one plus new one
      expect(passObj.additionalInfo).toHaveLength(2);
      expect(passObj.additionalInfo?.[1].id).toBe('info1');
      expect(passObj.additionalInfo?.[1].labelValue.label).toBe('Points');
      expect(passObj.additionalInfo?.[1].labelValue.value).toBe('100');
    });

    test('should add app links', () => {
      pass.addAndroidAppLink('Android App', 'android://example', 'Android description');
      pass.addIosAppLink('iOS App', 'ios://example', 'iOS description');
      pass.addWebAppLink('Web App', 'https://example.com', 'Web description');

      const passObj = pass.getPassObject();

      expect(passObj.appLinkData?.androidAppLinkInfo?.title).toBe('Android App');
      expect(passObj.appLinkData?.iosAppLinkInfo?.title).toBe('iOS App');
      expect(passObj.appLinkData?.webAppLinkInfo?.title).toBe('Web App');
    });

    test('should set grouping info', () => {
      pass.setGroupingInfo('group1', 2);
      const passObj = pass.getPassObject();

      expect(passObj.groupingInfo?.groupingId).toBe('group1');
      expect(passObj.groupingInfo?.sortIndex).toBe(2);
    });

    test('should add custom field', () => {
      pass.addCustomField('customField', { value: 'test' });
      const passObj = pass.getPassObject();

      expect(passObj.customField).toEqual({ value: 'test' });
    });
  });

  describe('JWT generation', () => {
    test('should generate JWT with correct payload', () => {
      const pass = new GoogleGenericPass(issuerId, passId, classId);
      pass.setServiceAccountCredentialsFromKeyData(serviceAccountEmail, privateKey);
      pass.setPassClass('Test Issuer');
      const token = pass.generateJwt(['example.com']);

      expect(jwt.sign).toHaveBeenCalled();

      // Extract the payload passed to jwt.sign
      const payloadArg = (jwt.sign as jest.Mock).mock.calls[0][0];

      expect(payloadArg.iss).toBe(serviceAccountEmail);
      expect(payloadArg.aud).toBe('google');
      expect(payloadArg.typ).toBe('savetowallet');
      expect(payloadArg.origins).toEqual(['example.com']);
      expect(payloadArg.payload.genericObjects).toHaveLength(1);
      expect(payloadArg.payload.genericClasses).toHaveLength(1);
    });

    test('should generate wallet link', () => {
      const pass = new GoogleGenericPass(issuerId, passId, classId);
      pass.setServiceAccountCredentialsFromKeyData(serviceAccountEmail, privateKey);
      const link = pass.generateAddToWalletLink();

      expect(link).toBe('https://pay.google.com/gp/v/save/mock-jwt-token');
    });

    test('should throw error when service account not configured', () => {
      const pass = new GoogleGenericPass(issuerId, passId, classId);
      expect(() => pass.generateJwt()).toThrow('Service account credentials not set');
    });
  });

  describe('Validation methods', () => {
    test('should handle empty strings with default values', () => {
      const pass = new GoogleGenericPass(issuerId, passId, classId);
      pass.setServiceAccountCredentialsFromKeyData(serviceAccountEmail, privateKey);

      // Set empty values that should be replaced with defaults
      pass.setCardTitle('');
      pass.setHeaderInfo('', '');

      // Generate JWT to trigger validation
      pass.generateJwt();

      const passObj = pass.getPassObject();
      expect(passObj.cardTitle?.defaultValue.value).toBe('Card');
      expect(passObj.header?.defaultValue.value).toBe('Header');
      expect(passObj.subheader?.defaultValue.value).toBe('Subheader');
    });

    test('should ensure image contentDescription is never empty', () => {
      const pass = new GoogleGenericPass(issuerId, passId, classId);
      pass.setLogo('https://example.com/logo.png');

      const passObj = pass.getPassObject();
      expect(passObj.logo?.contentDescription?.defaultValue.value).toBe('Image');
    });
  });

  describe('Debug methods', () => {
    test('should not throw when calling debugPayload', () => {
      const pass = new GoogleGenericPass(issuerId, passId, classId);
      pass.setServiceAccountCredentialsFromKeyData(serviceAccountEmail, privateKey);

      // Mock console.log to avoid output during tests
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      expect(() => pass.debugPayload()).not.toThrow();

      consoleLogSpy.mockRestore();
    });
  });
});
