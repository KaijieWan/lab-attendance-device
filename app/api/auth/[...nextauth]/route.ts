import CredentialsProvider from "next-auth/providers/credentials";
import NextAuth from "next-auth";
import jwt from "jsonwebtoken";
import type { JWT } from "next-auth/jwt";
import { authenticateUser } from "@/lib/apiUtils";

interface DecodedToken {
    sub: string;
    name: string;
    role: { authority: string }[];
    exp: number;
}

const handler = NextAuth({
    providers: [
        CredentialsProvider({
            name: "Credentials",
            credentials: {
                username: { label: "Username", type: "text", placeholder: "Your Username" },
                password: { label: "Password", type: "password", placeholder: "Your Password" },
            },
            async authorize(credentials, req) {
                console.log("trying to authorize, my credentials: ", credentials);

                const res: Response = await authenticateUser(credentials?.username as string, credentials?.password as string);

                console.log("Response Status: ", res.status);

                if (res.status === 401) {
                    console.log("login failed");
                    return null;
                }

                const data = await res.json();
                console.log("API Response Data: ", data); 

                if (res.ok && data.token) {
                    const decoded = jwt.decode(data.token) as DecodedToken;

                    if (decoded && typeof decoded === "object") {
                        console.log("authorize/login success: ", decoded);
                        console.log("returned jwt token: ", data.token);
                        return {
                            id: data.user.id.toString(),
                            username: data.user.username,
                            name: data.user.name,
                            email: data.user.email,
                            role: data.role,
                            backendJWT: data.token,
                            /*id: decoded.sub,
                            name: decoded.name,
                            role: decoded.role[0].authority,
                            backendJWT: data.token,*/
                        };
                    } else {
                        console.log("JWT decoding failed");
                        return null;
                    }
                }
                return null;
            },
        }),
    ],
    session: {
        strategy: "jwt",
        maxAge: 7 * 24 * 60 * 60, // 7 days
    },
    pages: {
        signIn: "/login",
    },
    callbacks: {
        async jwt({ token, user }) {
            // Check if the token has expired
            const currentTime = Math.floor(Date.now() / 1000);
            if (token.backendJWT) {
                const decoded = jwt.decode(token.backendJWT as string) as DecodedToken;
                if (decoded && decoded.exp && decoded.exp < currentTime) {
                    console.log("JWT token has expired");
                    // Handle token expiration (e.g., refresh token or force re-login)
                    return { ...token, expired: true };
                }
            }

            if (user) {
                return { ...token, ...user };
            }
            return token;
        },
        async session({ session, token }) {
            session.user = token;
            console.log("Current Session: ", session);
            return session;
        },
    },
});

export { handler as GET, handler as POST };
