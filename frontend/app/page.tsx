export default function Home() {
  return (
    <main className="min-h-screen bg-gray-950 flex items-center justify-center p-8">
      <div className="text-center max-w-2xl">

        {/* Logo */}
        <div className="mb-8">
          <h1 className="text-6xl font-bold text-white mb-2">
            Vox<span className="text-purple-500">Flow</span>
          </h1>
          <p className="text-gray-400 text-lg">Plateforme SaaS Call Center</p>
          <p className="text-gray-600 text-sm mt-1">Un produit de VNK Automatisation Inc.</p>
        </div>

        {/* Status cards */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <p className="text-purple-400 font-mono text-xs mb-1">Phase actuelle</p>
            <p className="text-white font-semibold">Phase 1</p>
            <p className="text-purple-300 text-xs mt-1">Fondations</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <p className="text-green-400 font-mono text-xs mb-1">Frontend</p>
            <p className="text-white font-semibold">Next.js 14</p>
            <p className="text-green-400 text-xs mt-1">✓ Actif :3001</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <p className="text-blue-400 font-mono text-xs mb-1">Backend</p>
            <p className="text-white font-semibold">Node.js</p>
            <p className="text-blue-400 text-xs mt-1">Port :4000</p>
          </div>
        </div>

        {/* Links */}
        <div className="flex gap-4 justify-center">
          <a
            href="http://localhost:4000/api/v1/health"
            target="_blank"
            className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            Tester le Backend
          </a>
          <a
            href="http://localhost:4000"
            target="_blank"
            className="border border-gray-700 hover:border-gray-500 text-gray-300 px-6 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            API Root
          </a>
        </div>

        {/* Footer */}
        <p className="text-gray-700 text-xs mt-12">
          © 2026 VNK Automatisation Inc. — VoxFlow v1.0.0
        </p>
      </div>
    </main>
  )
}
