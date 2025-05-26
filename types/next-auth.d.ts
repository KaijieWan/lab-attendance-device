import NextAuth from "next-auth";

declare module "next-auth" {
    interface Session {
        user?: {
            name?: string | null;
            username?: string | null;
            image?: string | null;
            id?: string;
            role?: string;
            backendJWT?: string;
            rolePermissions?: Record<string, Record<string, boolean>>;
        };
        expires: ISODateString;
    }
}
