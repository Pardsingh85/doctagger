import type { PublicClientApplication } from "@azure/msal-browser";
export declare function getAccessToken(instance: PublicClientApplication): Promise<string | null>;
import type { IPublicClientApplication } from "@azure/msal-browser";

export declare function getAccessToken(
  instance: IPublicClientApplication
): Promise<string | null>;

