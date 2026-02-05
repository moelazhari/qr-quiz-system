import { AuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { pool } from './db';
import { User } from '@/types';

export const authOptions: AuthOptions = {
    providers: [
        CredentialsProvider({
            name: 'Credentials',
            credentials: {
                email: { label: 'Email', type: 'email' },
                password: { label: 'Password', type: 'password' },
            },
            async authorize(credentials) {
                if (!credentials?.email || !credentials?.password) {
                    throw new Error('Please enter your email and password');
                }

                try {
                    const client = await pool.connect();
                    const result = await client.query<User>(
                        'SELECT * FROM users WHERE email = $1',
                        [credentials.email]
                    );
                    client.release();

                    const user = result.rows[0];

                    if (!user) {
                        throw new Error('No user found with this email');
                    }

                    const isValid = await bcrypt.compare(credentials.password, user.password);
                    if (!isValid) {
                        throw new Error('Invalid password');
                    }

                    return {
                        id: user.id?.toString() || '',
                        email: user.email,
                        name: user.name,
                        role: user.role,
                    };
                } catch (error) {
                    console.error('Auth error:', error);
                    throw error;
                }
            },
        }),
    ],
    callbacks: {
        async jwt({ token, user }) {
            if (user) {
                token.role = (user as any).role;
                token.id = user.id;
            }
            return token;
        },
        async session({ session, token }) {
            if (session.user) {
                (session.user as any).role = token.role;
                (session.user as any).id = token.id;
            }
            return session;
        },
    },
    pages: {
        signIn: '/login',
    },
    session: {
        strategy: 'jwt',
    },
    secret: process.env.NEXTAUTH_SECRET,
};
