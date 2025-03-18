'use client';

import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

export default function AuthError() {
  const searchParams = useSearchParams();
  const error = searchParams?.get('error');

  let errorMessage = 'An authentication error occurred';

  // Map error codes to user-friendly messages
  if (error === 'CredentialsSignin') {
    errorMessage = 'Invalid email or password';
  } else if (error === 'SessionRequired') {
    errorMessage = 'You must be signed in to access this page';
  } else if (error === 'AccessDenied') {
    errorMessage = 'You do not have permission to access this resource';
  } else if (error === 'OAuthCallback') {
    errorMessage = 'There was a problem signing in with the external provider';
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Authentication Error
          </h2>
          <div className="mt-4 rounded-md bg-red-50 p-4">
            <div className="text-sm text-red-700">{errorMessage}</div>
          </div>
          <div className="mt-4 text-center">
            <Link
              href="/auth/signin"
              className="font-medium text-indigo-600 hover:text-indigo-500"
            >
              Back to sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
} 