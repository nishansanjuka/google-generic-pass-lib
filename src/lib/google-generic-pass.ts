import * as jwt from 'jsonwebtoken';
import fs from 'fs';

// Google Generic Pass Schema Interfaces
export interface GoogleGenericPassObject {
  id: string;
  classId: string;
  genericType: string;
  hexBackgroundColor?: string;
  logo?: ImageObject;
  cardTitle?: LocalizedObject;
  header?: LocalizedObject;
  subheader?: LocalizedObject;
  textModulesData?: TextModuleObject[];
  linksModuleData?: LinksModuleObject;
  imageModulesData?: ImageModuleObject[];
  barcode?: BarcodeObject;
  heroImage?: ImageObject;
  validTimeInterval?: TimeInterval;
  locations?: LatLongPoint[];
  customInfoModules?: InfoModuleData[];
  additionalInfo?: InfoModuleData[];
  appLinkData?: AppLinkData;
  groupingInfo?: GroupingInfo;
  [key: string]: unknown; // For additional custom fields
}

export interface GoogleGenericPassClass {
  id: string;
  issuerName: string;
  reviewStatus?: string;
  logoImage?: ImageObject;
  heroImage?: ImageObject;
  hexBackgroundColor?: string;
  classTemplateInfo?: ClassTemplateInfo;
  [key: string]: unknown; // For additional custom fields
}

export interface ClassTemplateInfo {
  cardTemplateOverride?: CardTemplateOverride;
}

export interface CardTemplateOverride {
  cardRowTemplateInfos?: CardRowTemplateInfo[];
}

export interface CardRowTemplateInfo {
  twoItems?: TwoItemsInfo;
  threeItems?: ThreeItemsInfo;
  oneItem?: OneItemInfo;
}

export interface TwoItemsInfo {
  startItem?: TemplateItem;
  endItem?: TemplateItem;
}

export interface ThreeItemsInfo {
  startItem?: TemplateItem;
  middleItem?: TemplateItem;
  endItem?: TemplateItem;
}

export interface OneItemInfo {
  item?: TemplateItem;
}

export interface TemplateItem {
  firstValue?: TemplateItemValue;
  secondValue?: TemplateItemValue;
}

export interface TemplateItemValue {
  fields?: FieldReference[];
}

export interface FieldReference {
  fieldPath: string;
}

export interface LocalizedObject {
  defaultValue: {
    language: string;
    value: string;
  };
}

export interface TextModuleObject {
  id: string;
  header?: string;
  body: string;
}

export interface ImageObject {
  sourceUri: {
    uri: string;
  };
  contentDescription?: {
    defaultValue: {
      language: string;
      value: string;
    };
  };
}

export interface ImageModuleObject {
  id: string;
  mainImage: ImageObject;
}

export interface BarcodeObject {
  type: string; // QR_CODE, AZTEC, UPC_A, etc.
  value: string;
  alternateText?: string;
}

export interface LinksModuleObject {
  uris: {
    uri: string;
    description: string;
    id: string;
  }[];
}

export interface LatLongPoint {
  latitude: number;
  longitude: number;
}

export interface TimeInterval {
  start: {
    date: string; // ISO format
  };
  end?: {
    date: string; // ISO format
  };
}

export interface InfoModuleData {
  id: string;
  labelValue: {
    label: string;
    value: string;
  };
}

export interface AppLinkData {
  androidAppLinkInfo?: AppLinkInfo;
  iosAppLinkInfo?: AppLinkInfo;
  webAppLinkInfo?: AppLinkInfo;
}

export interface AppLinkInfo {
  appLogoImage?: ImageObject;
  title: string;
  description?: string;
  appTarget: AppTarget;
}

export interface AppTarget {
  targetUri: string;
}

export interface GroupingInfo {
  groupingId: string;
  sortIndex?: number;
}

export interface JwtPayload {
  iss: string; // Issuer (your service account email)
  aud: string; // Audience (always "google")
  typ: string; // Type (always "savetowallet")
  iat: number; // Issued at time
  origins: string[]; // Allowed origins
  payload: {
    genericObjects: GoogleGenericPassObject[];
    genericClasses?: GoogleGenericPassClass[];
  };
}

export class GoogleGenericPass {
  private passObject: GoogleGenericPassObject;
  private passClass?: GoogleGenericPassClass;
  private serviceAccountEmail: string | undefined;
  private privateKey: string | undefined;

  constructor(issuerId: string, passId: string, classId: string) {
    this.passObject = {
      id: `${issuerId}.${passId}`,
      classId: `${issuerId}.${classId}`,
      genericType: 'GENERIC_TYPE_UNSPECIFIED',
      // Initialize the additionalInfo array with a default item to avoid empty array issues
      additionalInfo: [
        {
          id: 'default_info',
          labelValue: {
            label: 'Info',
            value: 'See details',
          },
        },
      ],
    };
  }

  /**
   * Load service account credentials for JWT signing
   */
  setServiceAccountCredentials(serviceAccountEmail: string, privateKeyPathOrJson: string): this {
    this.serviceAccountEmail = serviceAccountEmail;

    try {
      let serviceAccountJson;

      // Check if the input is a JSON string
      try {
        serviceAccountJson = JSON.parse(privateKeyPathOrJson);
      } catch {
        // If parsing fails, treat as file path
        serviceAccountJson = JSON.parse(fs.readFileSync(privateKeyPathOrJson, 'utf8'));
      }

      // Extract the private key from the JSON
      if (serviceAccountJson.private_key) {
        this.privateKey = serviceAccountJson.private_key;
      } else {
        // If no private_key in JSON, try to read as direct PEM file
        this.privateKey = fs.readFileSync(privateKeyPathOrJson, 'utf8');
      }
    } catch (error) {
      throw new Error(
        `Failed to load service account key: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
    }

    return this;
  }

  /**
   * Set service account credentials directly with key content
   */
  setServiceAccountCredentialsFromKeyData(serviceAccountEmail: string, privateKey: string): this {
    this.serviceAccountEmail = serviceAccountEmail;
    this.privateKey = privateKey;
    return this;
  }

  /**
   * Define the pass class (template)
   */
  setPassClass(issuerName: string): this {
    this.passClass = {
      id: this.passObject.classId,
      issuerName,
    };
    return this;
  }

  /**
   * Set pass class (template) with additional properties
   */
  setPassClassWithDetails(
    issuerName: string,
    reviewStatus?: string,
    logoImageUrl?: string,
    logoDescription?: string,
    heroImageUrl?: string,
    heroDescription?: string,
    hexBackgroundColor?: string,
  ): this {
    this.passClass = {
      id: this.passObject.classId,
      issuerName: this.ensureNonEmptyString(issuerName, 'Issuer'),
    };

    if (reviewStatus) {
      this.passClass.reviewStatus = reviewStatus;
    }

    if (logoImageUrl) {
      this.passClass.logoImage = this.createImageObject(logoImageUrl, logoDescription);
    }

    if (heroImageUrl) {
      this.passClass.heroImage = this.createImageObject(heroImageUrl, heroDescription);
    }

    if (hexBackgroundColor) {
      this.passClass.hexBackgroundColor = hexBackgroundColor;
    }

    return this;
  }

  /**
   * Add class template info to the pass class
   */
  setClassTemplateInfo(cardRowTemplates: CardRowTemplateInfo[]): this {
    if (!this.passClass) {
      throw new Error('Pass class must be created before adding template info');
    }

    this.passClass.classTemplateInfo = {
      cardTemplateOverride: {
        cardRowTemplateInfos: cardRowTemplates,
      },
    };

    return this;
  }

  /**
   * Helper to create a two-item row template
   */
  createTwoItemsRow(startFieldPath?: string, endFieldPath?: string): CardRowTemplateInfo {
    const row: CardRowTemplateInfo = {
      twoItems: {
        startItem: startFieldPath
          ? {
              firstValue: {
                fields: [{ fieldPath: startFieldPath }],
              },
            }
          : undefined,
        endItem: endFieldPath
          ? {
              firstValue: {
                fields: [{ fieldPath: endFieldPath }],
              },
            }
          : undefined,
      },
    };
    return row;
  }

  /**
   * Set basic pass properties
   */
  setBasicInfo(genericType: string, hexBackgroundColor?: string): this {
    this.passObject.genericType = genericType;
    if (hexBackgroundColor) this.passObject.hexBackgroundColor = hexBackgroundColor;
    return this;
  }

  /**
   * Set card title
   */
  setCardTitle(title: string): this {
    this.passObject.cardTitle = {
      defaultValue: {
        language: 'en-US',
        value: this.ensureNonEmptyString(title, 'Card'),
      },
    };
    return this;
  }

  /**
   * Set header and subheader
   */
  setHeaderInfo(header: string, subheader?: string): this {
    this.passObject.header = {
      defaultValue: {
        language: 'en-US',
        value: this.ensureNonEmptyString(header, 'Header'),
      },
    };

    if (subheader) {
      this.passObject.subheader = {
        defaultValue: {
          language: 'en-US',
          value: this.ensureNonEmptyString(subheader, 'Subheader'),
        },
      };
    }
    return this;
  }

  /**
   * Add a text module
   */
  addTextModule(id: string, body: string, header?: string): this {
    if (!this.passObject.textModulesData) {
      this.passObject.textModulesData = [];
    }

    // Format text modules exactly as expected by Google Wallet API
    this.passObject.textModulesData.push({
      id,
      body: this.ensureNonEmptyString(body, 'Information'),
      header: header ? this.ensureNonEmptyString(header, 'Section') : undefined,
    });

    return this;
  }

  /**
   * Add logo to pass
   */
  setLogo(imageUrl: string, description?: string): this {
    this.passObject.logo = this.createImageObject(imageUrl, description);
    return this;
  }

  /**
   * Add hero image to pass
   */
  setHeroImage(imageUrl: string, description?: string): this {
    this.passObject.heroImage = this.createImageObject(imageUrl, description);
    return this;
  }

  /**
   * Add an image module
   */
  addImageModule(id: string, imageUrl: string, description?: string): this {
    if (!this.passObject.imageModulesData) {
      this.passObject.imageModulesData = [];
    }

    this.passObject.imageModulesData.push({
      id,
      mainImage: this.createImageObject(imageUrl, description),
    });

    return this;
  }

  /**
   * Add an item to the additionalInfo section
   */
  addAdditionalInfo(id: string, label: string, value: string): this {
    if (!this.passObject.additionalInfo) {
      this.passObject.additionalInfo = [];
    }

    this.passObject.additionalInfo.push({
      id,
      labelValue: {
        label: this.ensureNonEmptyString(label, 'Info'),
        value: this.ensureNonEmptyString(value, 'Value'),
      },
    });

    return this;
  }

  /**
   * Add Android app link
   */
  addAndroidAppLink(
    title: string,
    targetUri: string,
    description?: string,
    logoImageUrl?: string,
    logoDescription?: string,
  ): this {
    if (!this.passObject.appLinkData) {
      this.passObject.appLinkData = {};
    }

    this.passObject.appLinkData.androidAppLinkInfo = {
      title: this.ensureNonEmptyString(title, 'Android App'),
      description: description,
      appTarget: {
        targetUri,
      },
    };

    if (logoImageUrl) {
      this.passObject.appLinkData.androidAppLinkInfo.appLogoImage = this.createImageObject(
        logoImageUrl,
        logoDescription,
      );
    }

    return this;
  }

  /**
   * Add iOS app link
   */
  addIosAppLink(
    title: string,
    targetUri: string,
    description?: string,
    logoImageUrl?: string,
    logoDescription?: string,
  ): this {
    if (!this.passObject.appLinkData) {
      this.passObject.appLinkData = {};
    }

    this.passObject.appLinkData.iosAppLinkInfo = {
      title: this.ensureNonEmptyString(title, 'iOS App'),
      description: description,
      appTarget: {
        targetUri,
      },
    };

    if (logoImageUrl) {
      this.passObject.appLinkData.iosAppLinkInfo.appLogoImage = this.createImageObject(
        logoImageUrl,
        logoDescription,
      );
    }

    return this;
  }

  /**
   * Add web app link
   */
  addWebAppLink(
    title: string,
    targetUri: string,
    description?: string,
    logoImageUrl?: string,
    logoDescription?: string,
  ): this {
    if (!this.passObject.appLinkData) {
      this.passObject.appLinkData = {};
    }

    this.passObject.appLinkData.webAppLinkInfo = {
      title: this.ensureNonEmptyString(title, 'Web App'),
      description: description,
      appTarget: {
        targetUri,
      },
    };

    if (logoImageUrl) {
      this.passObject.appLinkData.webAppLinkInfo.appLogoImage = this.createImageObject(
        logoImageUrl,
        logoDescription,
      );
    }

    return this;
  }

  /**
   * Set grouping info
   */
  setGroupingInfo(groupingId: string, sortIndex?: number): this {
    this.passObject.groupingInfo = {
      groupingId,
      ...(sortIndex !== undefined ? { sortIndex } : {}),
    };
    return this;
  }

  /**
   * Helper to create image objects
   */
  private createImageObject(imageUrl: string, description?: string): ImageObject {
    // The critical issue: Google Wallet REQUIRES a contentDescription
    // for all images, even when no description is provided
    return {
      sourceUri: {
        uri: imageUrl,
      },
      // Always include contentDescription, regardless if description is provided
      contentDescription: {
        defaultValue: {
          language: 'en-US',
          value: description || 'Image', // Default value if no description provided
        },
      },
    };
  }

  /**
   * Helper to ensure localized string values are never empty
   */
  private ensureNonEmptyString(value: string | undefined, fallback: string): string {
    if (!value || value.trim() === '') {
      return fallback;
    }
    return value;
  }

  /**
   * Validate the entire pass object before generating JWT
   * This ensures no empty localized strings exist
   */
  private validatePassObject(): void {
    // Validate card title
    if (this.passObject.cardTitle?.defaultValue) {
      this.passObject.cardTitle.defaultValue.value = this.ensureNonEmptyString(
        this.passObject.cardTitle.defaultValue.value,
        'Card',
      );
    }

    // Validate header
    if (this.passObject.header?.defaultValue) {
      this.passObject.header.defaultValue.value = this.ensureNonEmptyString(
        this.passObject.header.defaultValue.value,
        'Header',
      );
    }

    // Validate subheader
    if (this.passObject.subheader?.defaultValue) {
      this.passObject.subheader.defaultValue.value = this.ensureNonEmptyString(
        this.passObject.subheader.defaultValue.value,
        'Subheader',
      );
    }

    // Validate text modules
    if (this.passObject.textModulesData) {
      this.passObject.textModulesData = this.passObject.textModulesData.map(module => ({
        ...module,
        body: this.ensureNonEmptyString(module.body, `Info ${module.id}`),
        header: module.header
          ? this.ensureNonEmptyString(module.header, `Section ${module.id}`)
          : undefined,
      }));
    }

    // Validate links
    if (this.passObject.linksModuleData && this.passObject.linksModuleData.uris) {
      this.passObject.linksModuleData.uris = this.passObject.linksModuleData.uris.map(link => ({
        ...link,
        description: this.ensureNonEmptyString(link.description, `Link ${link.id}`),
      }));
    }

    // Validate custom info modules
    if (this.passObject.customInfoModules) {
      this.passObject.customInfoModules = this.passObject.customInfoModules.map(module => ({
        ...module,
        labelValue: {
          label: this.ensureNonEmptyString(module.labelValue.label, `Label ${module.id}`),
          value: this.ensureNonEmptyString(module.labelValue.value, `Value ${module.id}`),
        },
      }));
    }

    // Validate additional info modules
    if (this.passObject.additionalInfo) {
      this.passObject.additionalInfo = this.passObject.additionalInfo.map(module => ({
        ...module,
        labelValue: {
          label: this.ensureNonEmptyString(module.labelValue.label, `Label ${module.id}`),
          value: this.ensureNonEmptyString(module.labelValue.value, `Value ${module.id}`),
        },
      }));
    }

    // Validate image descriptions
    if (this.passObject.logo?.contentDescription?.defaultValue) {
      this.passObject.logo.contentDescription.defaultValue.value = this.ensureNonEmptyString(
        this.passObject.logo.contentDescription.defaultValue.value,
        'Logo',
      );
    }

    if (this.passObject.heroImage?.contentDescription?.defaultValue) {
      this.passObject.heroImage.contentDescription.defaultValue.value = this.ensureNonEmptyString(
        this.passObject.heroImage.contentDescription.defaultValue.value,
        'Hero Image',
      );
    }

    // Validate image modules
    if (this.passObject.imageModulesData) {
      this.passObject.imageModulesData.forEach(module => {
        if (module.mainImage?.contentDescription?.defaultValue) {
          module.mainImage.contentDescription.defaultValue.value = this.ensureNonEmptyString(
            module.mainImage.contentDescription.defaultValue.value,
            `Image ${module.id}`,
          );
        }
      });
    }

    // Validate barcode alternate text
    if (this.passObject.barcode?.alternateText) {
      this.passObject.barcode.alternateText = this.ensureNonEmptyString(
        this.passObject.barcode.alternateText,
        'Scan this code',
      );
    }

    // Validate app link data
    if (this.passObject.appLinkData) {
      if (this.passObject.appLinkData.androidAppLinkInfo) {
        this.passObject.appLinkData.androidAppLinkInfo.title = this.ensureNonEmptyString(
          this.passObject.appLinkData.androidAppLinkInfo.title,
          'Android App',
        );

        if (
          this.passObject.appLinkData.androidAppLinkInfo.appLogoImage?.contentDescription
            ?.defaultValue
        ) {
          this.passObject.appLinkData.androidAppLinkInfo.appLogoImage.contentDescription.defaultValue.value =
            this.ensureNonEmptyString(
              this.passObject.appLinkData.androidAppLinkInfo.appLogoImage.contentDescription
                .defaultValue.value,
              'Android App Logo',
            );
        }
      }

      if (this.passObject.appLinkData.iosAppLinkInfo) {
        this.passObject.appLinkData.iosAppLinkInfo.title = this.ensureNonEmptyString(
          this.passObject.appLinkData.iosAppLinkInfo.title,
          'iOS App',
        );

        if (
          this.passObject.appLinkData.iosAppLinkInfo.appLogoImage?.contentDescription?.defaultValue
        ) {
          this.passObject.appLinkData.iosAppLinkInfo.appLogoImage.contentDescription.defaultValue.value =
            this.ensureNonEmptyString(
              this.passObject.appLinkData.iosAppLinkInfo.appLogoImage.contentDescription
                .defaultValue.value,
              'iOS App Logo',
            );
        }
      }

      if (this.passObject.appLinkData.webAppLinkInfo) {
        this.passObject.appLinkData.webAppLinkInfo.title = this.ensureNonEmptyString(
          this.passObject.appLinkData.webAppLinkInfo.title,
          'Web App',
        );

        if (
          this.passObject.appLinkData.webAppLinkInfo.appLogoImage?.contentDescription?.defaultValue
        ) {
          this.passObject.appLinkData.webAppLinkInfo.appLogoImage.contentDescription.defaultValue.value =
            this.ensureNonEmptyString(
              this.passObject.appLinkData.webAppLinkInfo.appLogoImage.contentDescription
                .defaultValue.value,
              'Web App Logo',
            );
        }
      }
    }
  }

  /**
   * Add barcode to pass
   */
  setBarcode(value: string, type = 'QR_CODE', alternateText?: string): this {
    // Google Wallet expects barcode to have an alternateText, even if it's empty
    this.passObject.barcode = {
      type,
      value,
      alternateText: alternateText || '', // Include empty string if no value provided
    };
    return this;
  }

  /**
   * Add links module
   */
  addLinks(links: { uri: string; description: string; id: string }[]): this {
    // Ensure all descriptions are non-empty
    this.passObject.linksModuleData = {
      uris: links.map(link => ({
        ...link,
        description: this.ensureNonEmptyString(link.description, `Link ${link.id}`),
      })),
    };
    return this;
  }

  /**
   * Add locations
   */
  addLocations(locations: LatLongPoint[]): this {
    this.passObject.locations = locations;
    return this;
  }

  /**
   * Set validity time interval
   */
  setValidTimeInterval(start: string, end?: string): this {
    this.passObject.validTimeInterval = {
      start: { date: start },
    };

    if (end) {
      this.passObject.validTimeInterval.end = { date: end };
    }

    return this;
  }

  /**
   * Add custom info module
   */
  addCustomInfoModule(id: string, label: string, value: string): this {
    if (!this.passObject.customInfoModules) {
      this.passObject.customInfoModules = [];
    }

    this.passObject.customInfoModules.push({
      id,
      labelValue: {
        label: this.ensureNonEmptyString(label, 'Info'),
        value: this.ensureNonEmptyString(value, 'Value'),
      },
    });

    return this;
  }

  /**
   * Add any custom field to the pass object
   */
  addCustomField(key: string, value: unknown): this {
    this.passObject[key] = value;
    return this;
  }

  /**
   * Generate signed JWT
   */
  generateJwt(origins: string[] = []): string {
    if (!this.serviceAccountEmail || !this.privateKey) {
      throw new Error('Service account credentials not set');
    }

    // Validate all localized strings before generating the JWT
    this.validatePassObject();

    // Also validate pass class if present
    if (this.passClass) {
      this.passClass.issuerName = this.ensureNonEmptyString(this.passClass.issuerName, 'Issuer');
    }

    const payload: JwtPayload = {
      iss: this.serviceAccountEmail,
      aud: 'google',
      typ: 'savetowallet',
      iat: Math.floor(Date.now() / 1000),
      origins,
      payload: {
        genericObjects: [this.passObject],
      },
    };

    if (this.passClass) {
      payload.payload.genericClasses = [this.passClass];
    }

    return jwt.sign(payload, this.privateKey, { algorithm: 'RS256' });
  }

  /**
   * Generate "Add to Google Wallet" link
   */
  generateAddToWalletLink(origins: string[] = []): string {
    const token = this.generateJwt(origins);
    return `https://pay.google.com/gp/v/save/${token}`;
  }

  /**
   * Debug function to log generated payload
   */
  debugPayload(): void {
    if (!this.serviceAccountEmail || !this.privateKey) {
      console.log('Service account not configured');
      return;
    }

    try {
      this.validatePassObject();

      const payload: JwtPayload = {
        iss: this.serviceAccountEmail,
        aud: 'google',
        typ: 'savetowallet',
        iat: Math.floor(Date.now() / 1000),
        origins: [],
        payload: {
          genericObjects: [this.passObject],
        },
      };

      if (this.passClass) {
        payload.payload.genericClasses = [this.passClass];
      }

      console.log('JWT payload:', JSON.stringify(payload, null, 2));
    } catch (error) {
      console.error('Error preparing payload:', error);
    }
  }

  /**
   * Get the pass object
   */
  getPassObject(): GoogleGenericPassObject {
    return this.passObject;
  }

  /**
   * Get the pass class
   */
  getPassClass(): GoogleGenericPassClass | undefined {
    return this.passClass;
  }
}
