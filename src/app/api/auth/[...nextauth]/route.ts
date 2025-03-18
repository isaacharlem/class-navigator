import NextAuth from "next-auth";
import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcrypt";
import { JWT } from "next-auth/jwt";
import { Session } from "next-auth";

const prisma = new PrismaClient();

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        // Look up the user
        const user = await prisma.user.findUnique({
          where: {
            email: credentials.email
          }
        });

        if (!user) {
          console.log("User not found");
          return null;
        }

        // Compare passwords
        const passwordMatch = await bcrypt.compare(
          credentials.password,
          user.password
        );

        if (!passwordMatch) {
          console.log("Password doesn't match");
          return null;
        }

        // Return the user object (minus the password)
        return {
          id: user.id,
          name: user.name,
          email: user.email
        };
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }: { token: JWT; user: any }) {
      // Add user id to the token
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }: { session: Session; token: JWT }) {
      // Add user id to the session
      if (session.user) {
        session.user.id = token.id as string;
      }
      return session;
    }
  },
  pages: {
    signIn: "/auth/signin",
    error: "/auth/error"
  },
  session: {
    strategy: "jwt"
  },
  secret: process.env.NEXTAUTH_SECRET
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST }; 