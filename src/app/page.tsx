import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-24">
      <div className="z-10 w-full max-w-5xl items-center justify-between font-mono text-sm lg:flex">
        <div className="fixed bottom-0 left-0 flex h-48 w-full items-end justify-center bg-gradient-to-t from-white via-white dark:from-black dark:via-black lg:static lg:h-auto lg:w-auto lg:bg-none">
          <p className="flex h-10 justify-center items-center rounded-xl border border-gray-300 bg-gray-200 px-4 dark:border-neutral-800 dark:bg-neutral-800">
            Course Assistant powered by AI
          </p>
        </div>
      </div>

      <div className="flex flex-col items-center justify-center text-center">
        <h1 className="text-6xl font-bold mb-6">ClassNavigator</h1>
        <p className="text-2xl mb-8">Your AI-powered course assistant</p>
        <div className="flex gap-4">
          <Link 
            href="/login" 
            className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            Login
          </Link>
          <Link 
            href="/signup" 
            className="px-6 py-3 bg-white text-blue-600 border border-blue-600 rounded-md hover:bg-gray-100 transition-colors"
          >
            Sign Up
          </Link>
        </div>
      </div>

      <div className="mb-32 grid text-center lg:mb-0 lg:grid-cols-3 lg:text-left gap-8 mt-16">
        <div className="group rounded-lg border border-gray-300 px-5 py-4">
          <h2 className="mb-3 text-2xl font-semibold">
            Upload Course Materials
          </h2>
          <p className="m-0 text-sm opacity-75">
            Upload PDFs, notebooks, code files, and links to course websites
          </p>
        </div>

        <div className="group rounded-lg border border-gray-300 px-5 py-4">
          <h2 className="mb-3 text-2xl font-semibold">
            Chat with Your Assistant
          </h2>
          <p className="m-0 text-sm opacity-75">
            Get answers based on your course materials with accurate citations
          </p>
        </div>

        <div className="group rounded-lg border border-gray-300 px-5 py-4">
          <h2 className="mb-3 text-2xl font-semibold">
            Organize by Course
          </h2>
          <p className="m-0 text-sm opacity-75">
            Manage chats by course and create sub-chats for specific assignments
          </p>
        </div>
      </div>
    </main>
  );
}
