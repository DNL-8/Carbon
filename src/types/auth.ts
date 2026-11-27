export interface AppAuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  image?: string | null;
  emailVerified: boolean;
  provider?: string;
}
