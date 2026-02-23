import { Metadata } from 'next';
import { EmailSignupForm } from '@/components/landing/EmailSignupForm';

export const metadata: Metadata = {
  title: 'Veritable Games - Coming Soon',
  description: 'Creative collaboration platform in development',
};

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      <div className="container mx-auto max-w-4xl px-4 py-16">
        {/* Header */}
        <header className="mb-16 text-center">
          <h1 className="mb-4 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-5xl font-bold text-transparent">
            Veritable Games
          </h1>
          <p className="text-xl text-slate-300">Creative Collaboration Platform</p>
        </header>

        {/* Hero Section */}
        <main>
          <section className="mb-16 text-center">
            <div className="mb-6 inline-block rounded-full border border-yellow-500/50 bg-yellow-500/20 px-6 py-2">
              <span className="font-semibold text-yellow-300">
                🚧 Site Currently in Development
              </span>
            </div>
            <h2 className="mb-6 text-3xl font-bold">Building Something Special</h2>
            <p className="mx-auto max-w-2xl text-lg leading-relaxed text-slate-300">
              We're creating a comprehensive platform for creative collaboration—combining forums,
              wiki, project management, and innovative tools for teams and communities.
            </p>
          </section>

          {/* Email Signup Section */}
          <section className="mb-16 rounded-2xl border border-slate-700/50 bg-slate-800/50 p-8 backdrop-blur-sm">
            <h3 className="mb-4 text-center text-2xl font-bold">Get Notified When We Launch</h3>
            <p className="mb-6 text-center text-slate-300">
              Be the first to know when Veritable Games goes live. No spam, just launch updates.
            </p>
            <EmailSignupForm />
          </section>

          {/* Features Preview */}
          <section className="mb-16">
            <h3 className="mb-8 text-center text-2xl font-bold">What's Coming</h3>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <FeatureCard
                icon="💬"
                title="Community Forums"
                description="Engage in discussions with topic categories, moderation tools, and real-time updates."
              />
              <FeatureCard
                icon="📚"
                title="Collaborative Wiki"
                description="Create and maintain knowledge bases with Markdown editing and revision history."
              />
              <FeatureCard
                icon="🎨"
                title="Project Workspaces"
                description="Manage creative projects with reference galleries, concept art, and team collaboration."
              />
              <FeatureCard
                icon="📖"
                title="Reference Library"
                description="Organize documents, articles, and resources with tags and full-text search."
              />
              <FeatureCard
                icon="✨"
                title="Infinite Canvas"
                description="Brainstorm and plan on a limitless workspace with nodes, connections, and visual thinking."
              />
              <FeatureCard
                icon="🌌"
                title="3D Visualizations"
                description="Interactive stellar system viewer with realistic physics and beautiful graphics."
              />
            </div>
          </section>
        </main>

        {/* Footer */}
        <footer className="border-t border-slate-700 pt-8 text-center text-slate-400">
          <p>&copy; {new Date().getFullYear()} Veritable Games. All rights reserved.</p>
        </footer>
      </div>
    </div>
  );
}

interface FeatureCardProps {
  icon: string;
  title: string;
  description: string;
}

function FeatureCard({ icon, title, description }: FeatureCardProps) {
  return (
    <div className="rounded-xl border border-slate-700/50 bg-slate-800/30 p-6 backdrop-blur-sm transition-colors hover:border-slate-600/50">
      <div className="mb-3 text-4xl">{icon}</div>
      <h4 className="mb-2 text-xl font-semibold text-white">{title}</h4>
      <p className="text-slate-300">{description}</p>
    </div>
  );
}
