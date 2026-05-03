// Lookup-list shape used everywhere in PersonalInformationDetails
export interface CodeOption {
  code: string;
  description: string;
}

export interface BannerIdResponse {
  bannerId?: string;
}

export interface UserName {
  userName?: string;
  fullName?: string;
  [k: string]: unknown;
}

export interface PreferredName {
  preferredName?: string;
  [k: string]: unknown;
}

export interface PersonalDetails {
  birthDate?: string;
  legalSex?: string;
  maritalStatus?: string;
  ethnicity?: string;
  [k: string]: unknown;
}

export interface AddressEntry {
  type?: string;
  street1?: string;
  street2?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  nation?: string;
  [k: string]: unknown;
}

export interface PhoneEntry {
  type?: string;
  phoneNumber?: string;
  primaryIndicator?: boolean;
  [k: string]: unknown;
}

export interface EmailEntry {
  type?: string;
  emailAddress?: string;
  preferredIndicator?: boolean;
  [k: string]: unknown;
}

export interface EmergencyContactEntry {
  firstName?: string;
  lastName?: string;
  relationship?: string;
  phoneNumber?: string;
  [k: string]: unknown;
}
